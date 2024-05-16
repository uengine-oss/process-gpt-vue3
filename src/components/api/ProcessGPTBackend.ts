import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import type { Backend } from './Backend';

class ProcessGPTBackend implements Backend {

    async listDefinition(path: string) {
        try {
            // 프로세스 정보, 폼 정보를 각각 불러와서 파일명을 포함해서 가공하기 위해서
            let procDefs = await storage.list('proc_def', (path ? { like: `${path}%` } : undefined));
            procDefs.map((item: any) => {
                item.path = `${item.id}.bpmn`
                item.name = item.name || item.path 
            });
            
            let formDefs = await storage.list('form_def', (path ? { like: `${path.replace(/\//g, "#")}%` } : undefined));
            formDefs.map((item: any) => {
                item.id = item.id.replace(/#/g, "/")
                item.path = `${item.id}.form`
                item.name = item.path
            });
            
            return [...procDefs, ...formDefs]

        } catch (error) {
            throw new Error('error in listDefinition');
        }
    }

    async listVersionDefinitions(version: string, basePath: string) {
        throw new Error("Method not implemented.");
    }

    async listVersions() {
        throw new Error("Method not implemented.");
    }

    async deleteDefinition(defId: string) {
        try {
            let result: any;
            await storage.delete(`proc_def/${defId}`, { key: 'id' });
            const list = await storage.list(defId);
            if (list && list.length > 0) {
                await axios.post('/drop-process-table/invoke', {
                    "input": {
                        "process_definition_id": defId
                    }
                }).then(res => {
                    result = res;
                }).catch(error => {
                    throw new Error(error && error.detail ? error.detail : error);
                });
            }
            const arcv = await storage.list(`proc_def_arcv/${defId}`, { key: 'proc_def_id' });
            if (arcv && arcv.length > 0) {
                await storage.delete(`proc_def_arcv/${defId}`, { key: 'proc_def_id' });
            }
            const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
            if (isLocked) {
                await storage.delete(`lock/${defId}`, { key: 'id' });
            }
            return result;
        } catch (error) {
            throw new Error('error in deleteDefinition');
        }
    }

    async putRawDefinition(xml: any, defId: string, options: any) {
        try {
            // 폼 정보를 저장하기 위해서
            if(options && options.type === "form") {
                await storage.putObject('form_def', {
                    id: defId.replace(/\//g, "#"),
                    html: xml
                });
                return
            }

            defId = defId.toLowerCase();
            
            const procDef: any = {
                id: defId,
                name: options.name,
                bpmn: xml,
                definition: options.definition,
            }
            await storage.putObject('proc_def', procDef);

            const procDefArcv: any = {
                arcv_id: options.arcv_id,
                proc_def_id: defId,
                version: options.version,
                snapshot: xml,
                diff: options.diffs,
            }
            await storage.putObject('proc_def_arcv', procDefArcv);

            const list = await storage.list(defId);
            if (list.code == "42P01") {
                try{
                    await axios.post('/process-db-schema/invoke', {
                        "input": {
                            "process_definition_id": defId
                        }
                    })
                }catch(error){
                    //@ts-ignore
                    throw new Error("Error when to creating database for the definition: " + (error && error.detail ? error.detail : error));
                }
            }

            try{
                const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
                if (isLocked) {
                    await storage.delete(`lock/${defId}`, { key: 'id' });
                }    

            }catch(error){
                //@ts-ignore
                throw new Error("Error when to unlock: " + (error && error.detail ? error.detail : error));

            }
        } catch (e) {
            throw new Error('error when to save definition: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async getRawDefinition(defId: string, options: any) {
        try {
            if (options) {
                // 폼 정보를 불러오기 위해서
                if(options.type === "form") {
                    const data = await storage.getString(`form_def/${defId.replace(/\//g, "#")}`, { key: 'id' });
                    if(!data) {
                        throw new Error('no such form definition');
                    }
                    return data.html;
                } else if(options.type === "bpmn") {
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'bpmn' });
                    // if(!data) {
                    //     throw new Error('no such bpmn definition');
                    // }
                    return data;
                }
            } else {
                const data = await storage.getObject(`proc_def/${defId}`, { key: 'id' });
                return data;
            }

        } catch (error) {
            throw new Error('error in getRawDefinition');
        }
    }

    async start(input: any) {
        try {
            let defId = input.process_definition_id || input.processDefinitionId;
            if (defId && defId != '') {
                const list = await storage.list(defId);
                if (list.code == "42P01") {
                    await axios.post('/process-db-schema/invoke', {
                        "input": {
                            "process_definition_id": defId
                        }
                    }).then(res => {
                        return res
                    }).catch(error => {
                        throw new Error(error && error.detail ? error.detail : error);
                    });
                }
            } else {
                if (input.process_instance_id && input.process_instance_id != '') {
                    defId = input.process_instance_id.split('.')[0];
                }
            }

            let newMessage;
            if (!input.answer) {
                input.answer = "";
            }
            if (!input.process_instance_id) {
                input.process_instance_id = "new";
            }
            if (!input.userInfo) {
                input.userInfo = await storage.getUserInfo();
            }
            input['process_definition_id'] = defId.toLowerCase();

            if (input.answer != "" && input.process_instance_id && input.process_instance_id != '') {
                newMessage = {
                    role: 'user',
                    name: input.userInfo.name,
                    email: input.userInfo.email,
                    timestamp: Date.now(),
                    content: input.answer,
                }
                await this.updateInstanceChat(input.process_instance_id, newMessage);
            }
            
            var result: any = null;
            var url = '/complete/invoke';
            if (input.image != null) {
                url = '/vision-complete/invoke';
            }
            
            var req = {
                input: input
            };

            await axios.post(url, req).then(async res => {
                if (res.data) {
                    const data = res.data;
                    if (data.output) {
                        result = JSON.parse(data.output);
                        console.log(result)
                        if (input.answer === "" && result.instanceId) {
                            newMessage = {
                                role: 'system',
                                timestamp: Date.now(),
                                content: `프로세스 '${defId}' 이/가 실행되었습니다.\n\n${result.description}`,
                                jsonContent: result
                            }
                            await this.updateInstanceChat(result.instanceId, newMessage);
                        } else {
                            newMessage = {
                                role: 'system',
                                timestamp: Date.now(),
                                content: result.description || "",
                                jsonContent: result
                            }
                            await this.updateInstanceChat(result.instanceId, newMessage);
                        }
                    }
                }
            })
            .catch(error => {
                throw new Error(error && error.detail ? error.detail : error);
            });

            return result;
        } catch (error) {
            throw new Error('error in start' + error);
        }
    }

    async getInstance(instanceId: string) {
        try {
            const defId = instanceId.split('.')[0];
            const options = {
                match: {
                    proc_inst_id: instanceId
                }
            };
            const data = await storage.getObject(defId, options);
            data.defId = defId;
            data.instanceId = instanceId;
            data.name = data.proc_inst_name;
            return data;
        } catch (error) {
            throw new Error('error in getInstance');
        }
    }

    async getWorkItem(taskId: string) {
        try {
            const data = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            const defInfo = await this.getRawDefinition(data.proc_def_id, null);
            let activityInfo: any = null;
            let parameters: any[] = [];
            if (defInfo && defInfo.definition) {
                activityInfo = defInfo.definition.activities.find((activity: any) => activity.id === data.activity_id);
                if (activityInfo.outputData) {
                    parameters = activityInfo.outputData.map((item: any) => {
                        const key = item;
                        return {
                            direction: 'OUT',
                            variable: {
                                name: key,
                            }
                        }
                    });
                }

            }
            const workItem = {
                worklist: {
                    defId: data.proc_def_id,
                    endpoint: data.user_id,
                    instId: data.proc_inst_id,
                    rootInstId: null,
                    taskId: data.id,
                    startDate: data.start_date,
                    dueDate: data.end_date,
                    status: data.status === 'TODO' ? 'NEW' : data.status === 'DONE' ? 'COMPLETED' : data.status,
                    description: data.description || "",
                    tool: data.tool || ""
                    
                },
                activity: {
                    name: data.activity_name,
                    tracingTag: data.activity_id,
                    parameters: parameters || []
                }
            }
            return workItem;
        } catch (error) {
            throw new Error('error in getWorkItem');
        }
    }

    async getWorkList() {
        try {
            const email = localStorage.getItem("email");
            const options = { match: { user_id: email } };
            const list = await storage.list('todolist', options);
            const worklist: any[] = [];
            if (list && list.length > 0) {
                for (const item of list) {
                    const workItem: any = {
                        defId: item.proc_def_id,
                        endpoint: item.user_id,
                        instId: item.proc_inst_id,
                        rootInstId: null,
                        taskId: item.id,
                        startDate: item.start_date,
                        dueDate: item.end_date,
                        status: item.status,
                        title: item.activity_name,
                        tracingTag: item.activity_id,
                        description: item.description || "",
                        tool: item.tool || ""
                    };
                    if (item.proc_inst_id) {
                        const data = await storage.getString(item.proc_def_id, { 
                            match: { proc_inst_id: item.proc_inst_id },
                            column: "proc_inst_name"
                        });
                        if (data && data.proc_inst_name) {
                            workItem.description = data.proc_inst_name;
                        }
                    }
                    worklist.push(workItem);
                }
            }
            return worklist;
        } catch (error) {
            throw new Error(`error in getWorkList`);
        }
    }

    async putWorkItem(taskId: string, workItem: any) {
        throw new Error("Method not implemented.");
    }
    
    async putWorklist(taskId: string, workItem: any) {
        const putObj = {
            id: taskId,
            proc_def_id: workItem.defId,
            user_id: workItem.endpoint,
            proc_inst_id: workItem.instId,
            start_date: workItem.startDate,
            end_date: workItem.dueDate,
            status: workItem.status,
            activity_id: workItem.title,
        }
        await storage.putObject('todolist', putObj);
    }

    async deleteWorkItem(taskId: string) {
        await storage.delete(`todolist/${taskId}`, { key: 'id' });
    }

    async getFormDefinition(formName: string) {
        const form = await storage.getString(`form_def/${formName}`, { key: 'key' });
        if (form && form.html) {
            return form.html;
        }
        return null;
    }

    // proc_map
    async getProcessDefinitionMap() {
        try {
            const procMap = await storage.getObject('configuration/proc_map', { key: 'key' });
            if (procMap && procMap.value) {
                return procMap.value;
            }
            return {};
        } catch (error) {
            throw new Error('error in getProcessDefinitionMap');
        } 
    }

    async putProcessDefinitionMap(definitionMap: any) {
        const putObj = {
            key: 'proc_map',
            value: definitionMap
        }
        await storage.putObject('configuration', putObj);
    }

    // Add stub implementations for the missing methods and properties
    async versionUp() {
        throw new Error("Method not implemented.");
    }

    async makeProduction() {
        throw new Error("Method not implemented.");
    }

    async getProduction() {
        throw new Error("Method not implemented.");
    }

    async getVersion() {
        throw new Error("Method not implemented.");
    }

    async getDefinition() {
        throw new Error("Method not implemented.");
    }

    async renameOrMove() {
        throw new Error("Method not implemented.");
    }

    async createFolder() {
        throw new Error("Method not implemented.");
    }

    async stop() {
        throw new Error("Method not implemented.");
    }
    
    async suspend(instanceId: string) {
        throw new Error("Method not implemented.");
    }

    async resume(instanceId: string) {
        throw new Error("Method not implemented.");
    }

    async backToHere(instanceId: string, tracingTag: string) {
        //
    }

    async getProcessVariables(instanceId: string) {
        throw new Error("Method not implemented.");
    }

    async getVariable(instId: string, varName: string) {
        throw new Error("Method not implemented.");
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        throw new Error("Method not implemented.");
    }

    async getRoleMapping(instId: string, roleName: string) {
        throw new Error("Method not implemented.");
    }

    async setRoleMapping(instanceId: string, roleName: string, roleMapping: any) {
        throw new Error("Method not implemented.");
    }

    async signal(instanceId: string, signal: string) {
        throw new Error("Method not implemented.");
    }

    async serviceMessage(requestPath: string) {
        throw new Error("Method not implemented.");
    }

    async postMessage(instanceId: string, message: any) {
        throw new Error("Method not implemented.");
    }

    async getInProgressList() {
        throw new Error("Method not implemented.");
    }

    async getCompletedList() {
        try {
            const email = localStorage.getItem("email");
            const options = { match: { user_id: email, status: "DONE" } };
            const list = await storage.list('todolist', options);
            const worklist: any[] = [];
            if (list && list.length > 0) {
                for (const item of list) {
                    const workItem: any = {
                        defId: item.proc_def_id,
                        endpoint: item.user_id,
                        instId: item.proc_inst_id,
                        rootInstId: null,
                        taskId: item.id,
                        startDate: item.start_date,
                        dueDate: item.end_date,
                        status: item.status,
                        title: item.activity_name,
                        tracingTag: item.activity_id,
                        description: item.description || "",
                        tool: item.tool || ""
                    };
                    if (item.proc_inst_id) {
                        const data = await storage.getString(item.proc_def_id, { 
                            match: { proc_inst_id: item.proc_inst_id },
                            column: "proc_inst_name"
                        });
                        if (data && data.proc_inst_name) {
                            workItem.description = data.proc_inst_name;
                        }
                    }
                    worklist.push(workItem);
                }
            }
            return worklist;
        } catch (error) {
            throw new Error(`error in getWorkList`);
        }
    }

    async getPendingList() {
        throw new Error("Method not implemented.");
    }

    async putWorkItemComplete(taskId: string, inputData: any) {
        try {
            let result: any = null;
            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            const userInfo = await storage.getUserInfo();
            
            const newMessage = {
                role: 'system',
                timestamp: Date.now(),
                content: `액티비티 '${workItem.activity_id}' 을/를 실행합니다.`,
                jsonContent: inputData
            }
            await this.updateInstanceChat(workItem.proc_inst_id, newMessage);
    
            const input = {
                answer: JSON.stringify(inputData),
                process_instance_id: workItem.proc_inst_id,
                process_definition_id: workItem.proc_def_id,
                userInfo: userInfo,
                activity_id: workItem.activity_id,
            };
            const req = {
                input: input
            };
            let url = '/complete/invoke';
            await axios.post(url, req).then(async res => {
                if (res.data) {
                    const data = res.data;
                    if (data.output) {
                        const output = JSON.parse(data.output);
                        // update instance message
                        const newMessage = {
                            role: 'system',
                            timestamp: Date.now(),
                            content: output.description,
                            jsonContent: data.output
                        }
                        await this.updateInstanceChat(output.instanceId, newMessage);
                    }
                    result = res.data;
                }
            })
            .catch(error => {
                result = error
                console.log(error)
                throw new Error(error && error.detail ? error.detail : error);
            });
    
            return result;

        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async updateInstanceChat(instanceId: string, newMessage: any) {
        try {
            const data = await storage.getObject(`proc_inst/${instanceId}`, { key: 'id' });
            const messages = data.messages || [];
            if (newMessage) {
                messages.push(newMessage);
            }
            const putObj = {
                id: instanceId,
                messages: messages
            }
            await storage.putObject('proc_inst', putObj);
        } catch (e) {
            return new Error('error in updateInstanceChat');
        }
    }

    async getInstanceList() {
        try {
            const instList: any[] = [];
            const data = await storage.list('proc_inst');
            const email = localStorage.getItem("email");
            let list = data.filter((item: any) => item.user_ids.includes(email));
            
            if (list && list.length > 0) {
                for (const item of list) {
                    const defId = item.id.split(".")[0];
                    const instance = await this.getInstance(item.id);
                    if (instance.current_activity_ids.length > 0) {
                        const instItem = {
                            instId: item.id,
                            instName: item.name,
                            status: "IN_PROGRESS",
                            startedDate: instance.start_date,
                            defId: defId
                        };
                        instList.push(instItem);
                    }
                }
            }
            return instList;
        } catch (error) {
            throw new Error('error in getInstanceList');
        }
    }

    async getCompleteInstanceList() {
        try {
            const instList: any[] = [];
            let list = await storage.list('proc_inst');
            const email = localStorage.getItem("email");
            list = list.filter((item: any) => item.user_ids.includes(email));
            
            if (list && list.length > 0) {
                for (const item of list) {
                    const defId = item.id.split(".")[0];
                    const instance = await this.getInstance(item.id);
                    if (instance.current_activity_ids.length == 0) {
                        const instItem = {
                            instId: item.id,
                            instName: item.name,
                            status: "COMPLETE",
                            startedDate: instance.start_date,
                            defId: defId
                        };
                        instList.push(instItem);
                    }
                }
            }
            return instList;
        } catch (error) {
            throw new Error('error in getCompleteInstanceList');
        }
    }

    async getWorkListByInstId(instId: number) {
        try {
            const list = await storage.list(`todolist`, { match: { 'proc_inst_id': instId } });
            const worklist: any[] = list.map((item: any) => {
                return {
                    defId: item.proc_def_id,
                    endpoint: item.user_id,
                    instId: item.proc_inst_id,
                    rootInstId: item.proc_inst_id,
                    taskId: item.id,
                    startDate: item.start_date,
                    dueDate: item.end_date,
                    status: item.status,
                    title: item.activity_name,
                    tool: item.tool || '',
                    tracingTag: item.activity_id,
                    description: item.description || '',
                    task: item
                }
            })
            return worklist;
        } catch (e) {
            throw new Error(`error in getWorkListByInstId`);
        }
    }

    async getEventList(instanceId: string) {
        try {
            return null;
        } catch (error) {
            throw new Error(`error in getEventList`);
        }
    }
}

export default ProcessGPTBackend;

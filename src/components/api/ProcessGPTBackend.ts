import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import type { Backend } from './Backend';

enum ErrorCode {
    TableNotFound = "42P01"
}

class ProcessGPTBackend implements Backend {

    async checkDBConnection() {
        return await storage.isConnection();
    }

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

        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async listVersionDefinitions(version: string, basePath: string) {
        throw new Error("Method not implemented.");
    }

    async listVersions() {
        throw new Error("Method not implemented.");
    }

    async deleteDefinition(defId: string, options: any) {
        try {
            if(options && options.type === "form") {
                await storage.delete(`form_def/${defId.replace(/\//g, "#")}`, { key: 'id' });
                return
            }

            await storage.delete(`proc_def/${defId}`, { key: 'id' });
            
            const arcv = await storage.list('proc_def_arcv', {
                sort: 'desc',
                orderBy: 'timeStamp',
                match: { 'proc_def_id': defId }
            });
            if (arcv && arcv.length > 0) {
                await storage.delete(`proc_def_arcv/${defId}`, { key: 'proc_def_id' });
            }
            const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
            if (isLocked) {
                await storage.delete(`lock/${defId}`, { key: 'id' });
            }

            if (!window.$jms) {
                await axios.post(`${window.$backend}/drop-process-table/invoke`, {
                    "input": {
                        "process_definition_id": defId,
                        "subdomain": window.location.hostname.split('.')[0]
                    }
                }).catch(error => {
                    throw new Error(error && error.detail ? error.detail : error);
                });
            }
            
        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(e.message);
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
            
            try {
                const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
                if (isLocked) {
                    await storage.delete(`lock/${defId}`, { key: 'id' });
                }
            } catch(error) {
                //@ts-ignore
                throw new Error("Error when to unlock: " + (error && error.detail ? error.detail : error));
            }

            if (!window.$jms) {
                const list = await storage.list(defId);
                if (list.code == ErrorCode.TableNotFound) {
                    try {
                        await axios.post(`${window.$backend}/process-db-schema/invoke`, {
                            "input": {
                                "process_definition_id": defId,
                                "subdomain": window.location.hostname.split('.')[0]
                            }
                        })
                    } catch(error) {
                        //@ts-ignore
                        throw new Error("Error when to creating database for the definition: " + (error && error.detail ? error.detail : error));
                    }
                }
            }

        } catch (e) {
            this.checkDBConnection();
            throw new Error('error when to save definition: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async getRawDefinition(defId: string, options: any) {
        try {
            if(defId) defId = defId.toLowerCase();

            if (options) {
                // 폼 정보를 불러오기 위해서
                if(options.type === "form") {
                    if (defId.includes('/')) defId = defId.replace(/\//g, "#")
                    const data = await storage.getString(`form_def/${defId}`, { key: 'id', column: 'html' });
                    if(!data) {
                        throw new Error('no such form definition');
                    }
                    return data;
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
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async start(input: any) {
        try {
            if (window.$jms) return;

            let defId = input.process_definition_id || input.processDefinitionId;
            if (defId && defId != '') {
                const list = await storage.list(defId);
                if (list.code == ErrorCode.TableNotFound) {
                    await axios.post(`${window.$backend}/process-db-schema/invoke`, {
                        "input": {
                            "process_definition_id": defId,
                            "subdomain": window.location.hostname.split('.')[0]
                        }
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
            
            var result: any = null;
            var url = `${window.$backend}/complete`;
            if (input.image != null) {
                url = `${window.$backend}/vision-complete`;
            }
            var req = {
                input: input,
                subdomain: window.location.hostname.split('.')[0]
            };
            const token = localStorage.getItem('accessToken');
            await axios.post(url, req, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).then(async res => {
                if (res.data) {
                    const data = res.data;
                    if (data.output) {
                        result = JSON.parse(data.output);
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
                                role: 'user',
                                name: input.userInfo.name,
                                email: input.userInfo.email,
                                timestamp: Date.now(),
                                content: input.answer,
                            }
                            await this.updateInstanceChat(result.instanceId, newMessage);
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
                result = error
                throw new Error(error && error.detail ? error.detail : error);
            });

            return result;
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
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
            if (data) {
                data.defId = defId;
                data.instanceId = instanceId;
                data.name = data.proc_inst_name;
                if (data.current_activity_ids && data.current_activity_ids.length > 0) {
                    data.status = 'RUNNING'
                } else {
                    data.status = 'COMPLETED'
                }
            }
            return data;
        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getWorkItem(taskId: string) {
        try {
            const data = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            const defInfo = await this.getRawDefinition(data.proc_def_id, null);
            const inst = await this.getInstance(data.proc_inst_id);

            let parameters: any[] = [];
            let variableForHtmlFormContext: any = {};

            if (defInfo && defInfo.definition) {
                // form
                const formData: any = defInfo.definition.data.filter((variable: any) => variable.type === 'Form') || [];
                // parameters
                const activityInfo: any = defInfo.definition.activities.find((activity: any) => activity.id === data.activity_id);
                if (activityInfo) {
                    let inputItems: any[] = [];
                    let outputItems: any[] = [];
                    if (activityInfo.outputData && activityInfo.outputData.length > 0) {
                        inputItems = activityInfo.outputData.map((item: any) => {
                            const key = item;
                            return {
                                direction: 'OUT',
                                variable: {
                                    name: key,
                                    value: inst[key.toLowerCase().replace(/ /g, '_')] || ""
                                }
                            }
                        });
                        if (formData.length > 0) {
                            formData.forEach((item: any) => {
                                if(activityInfo.outputData.includes(item.name)) {
                                    variableForHtmlFormContext = {
                                        name: item.name
                                    }
                                }
                            });
                        }
                    }
                    if (activityInfo.inputData && activityInfo.inputData.length > 0) {
                        outputItems = activityInfo.inputData.map((item: any) => {
                            const key = item;
                            return {
                                direction: 'IN',
                                variable: {
                                    name: key,
                                    value: inst[key.toLowerCase().replace(/ /g, '_')] || ""
                                }
                            }
                        });
                    }
                    parameters = [...inputItems, ...outputItems];
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
                    tracingTag: data.activity_id || '',
                    parameters: parameters || [],
                    variableForHtmlFormContext: variableForHtmlFormContext || {},
                }
            }
            return workItem;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getWorkList(options?: any) {
        try {
            const filter = { match: {} };
            if (options && options.instId) {
                filter.match = { proc_inst_id: options.instId };
            } else {
                const email = localStorage.getItem("email");
                filter.match = { user_id: email };
            }
            const list = await storage.list('todolist', filter);
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
                        tracingTag: item.activity_id || "",
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
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putWorkItem(taskId: string, workItem: any) {
        try {
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    
    async putWorklist(taskId: string, workItem: any) {
        try {
            let result: any = null;
            if (!workItem.instId) {
                const putObj = {
                    id: taskId,
                    proc_def_id: workItem.defId,
                    user_id: workItem.endpoint,
                    proc_inst_id: workItem.instId,
                    start_date: workItem.startDate,
                    end_date: workItem.dueDate,
                    status: workItem.status,
                    activity_id: workItem.tracingTag || workItem.title,
                }
                await storage.putObject('todolist', putObj);
            } else { // instance workItem
                result = await this.putWorkItemComplete(taskId, {});
                // 다음 액티비티로 넘어가지 못한 경우
                if (result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                    const dataNotExist = result.cannotProceedErrors.find((item: any) => item.type === 'DATA_FIELD_NOT_EXIST');
                    if (!dataNotExist) {
                        throw new Error(result.cannotProceedErrors.map((item: any) => item.reason).join('\n'));
                    }
                }
            }
            return result;
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }        
    }

    async deleteWorkItem(taskId: string) {
        try {
            await storage.delete(`todolist/${taskId}`, { key: 'id' });
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFormDefinition(formName: string) {
        try {
            const form = await storage.getString(`form_def/${formName}`, { key: 'key' });
            if (form && form.html) {
                return form.html;
            }
            return null;
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // proc_map
    async getProcessDefinitionMap() {
        try {
            const options = {
                match: {
                    key: 'proc_map'
                }
            };
            const procMap = await storage.getObject('configuration', options);
            if (procMap && procMap.value) {
                // const renameLabels = (obj: any) => {
                //     if (obj instanceof Array) {
                //         obj.forEach(item => renameLabels(item));
                //     } else if (obj instanceof Object) {
                //         if (obj.hasOwnProperty('label')) {
                //             obj.name = obj.label;
                //             delete obj.label;
                //         }
                //         Object.values(obj).forEach(value => renameLabels(value));
                //     }
                // };
                // renameLabels(procMap.value);
                return procMap.value;
            }
            return {};
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        } 
    }

    async putProcessDefinitionMap(definitionMap: any) {
        try {
            const putObj = {
                key: 'proc_map',
                value: definitionMap
            }
            await storage.putObject('configuration', putObj);
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getDefinitionVersions(defId: string, options: any) {
        try {
            if(!options) options = {};

            defId = defId.toLowerCase();
            if(!options.match) options.match = {}
            options.match.proc_def_id = defId;
            
        
            return await storage.list('proc_def_arcv', options);
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
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

    async getVariableWithTaskId(instId: string, taskId: string, varName: string) {
        try {
            const instance: any = await this.getInstance(instId);
            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            let varData: any = {};
            if (typeof instance[columnName] === 'string') {
                varData = JSON.parse(instance[columnName]);
            } else {
                varData = instance[columnName];
            }
            const result = {
                valueMap: varData
            }
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        throw new Error("Method not implemented.");
    }

    async setVariableWithTaskId(instId: string, taskId: string, varName: string, varValue: any) {
        try {
            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            const defId: any = instId.split('.')[0];
            const putObj: any = {
                proc_inst_id: instId,
                [columnName]: varValue.valueMap ? varValue.valueMap : varValue
            }
            await storage.putObject(defId, putObj);
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
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

    async getCompletedList(options?: any) {
        try {
            const filter: any = {
                match: {
                    status: "DONE"
                }
            };
            if (options && options.instId) {
                filter.match.proc_inst_id = options.instId;
            } else {
                const email = localStorage.getItem("email");
                filter.match.user_id = email;
            }
            const list = await storage.list('todolist', filter);
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
                        tracingTag: item.activity_id || "",
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
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getPendingList() {
        throw new Error("Method not implemented.");
    }

    async putWorkItemComplete(taskId: string, inputData: any) {
        try {
            if (window.$jms) return;

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
                input: input,
                subdomain: window.location.hostname.split('.')[0]
            };
            const token = localStorage.getItem('accessToken');
            let url = `${window.$backend}/complete`;
            await axios.post(url, req, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).then(async res => {
                if (res.data) {
                    const data = res.data;
                    if (data.output) {
                        const output = JSON.parse(data.output);
                        result = output;
                        const newMessage = {
                            role: 'system',
                            timestamp: Date.now(),
                            content: '',
                            jsonContent: data.output
                        }
                        if (output.cannotProceedErrors && output.cannotProceedErrors.length > 0) {
                            newMessage.content = output.cannotProceedErrors.map((item: any) => item.reason).join('\n');
                        } else {
                            newMessage.content = output.description;
                        }
                        await this.updateInstanceChat(output.instanceId, newMessage);
                    }
                }
            })
            .catch(error => {
                result = error
                throw new Error(error && error.detail ? error.detail : error);
            });
    
            return result;

        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async updateInstanceChat(instanceId: string, newMessage: any) {
        try {
            const data = await storage.getObject(`proc_inst/${instanceId}`, { key: 'id' });
            const messages = data && data.messages ? data.messages : [];
            if (newMessage) {
                messages.push(newMessage);
            }
            const putObj = {
                id: instanceId,
                messages: messages
            }
            await storage.putObject('proc_inst', putObj);
        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async fetchInstanceListByStatus(status: string): Promise<any[]> {
        let list = await storage.list('proc_inst', { match: { status: status } });
        const email = localStorage.getItem("email");
        list = list.filter((item: any) => item.user_ids.includes(email));
        if (list && list.length > 0) {
            list = list.map((item: any) => {
                return {
                    instId: item.id,
                    instName: item.name,
                    status: item.status,
                    defId: item.id.split(".")[0]
                }
            });
        }
        return list;
    }

    async getInstanceList() {
        try {
            let instList: any[] = await this.fetchInstanceListByStatus("RUNNING");
            return instList;
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getCompleteInstanceList() {
        try {
            let instList: any[] = await this.fetchInstanceListByStatus("COMPLETED");
            return instList;
        } catch (error) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
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
                    tracingTag: item.activity_id || '',
                    description: item.description || '',
                    task: item
                }
            })
            return worklist;
        } catch (e) {
            this.checkDBConnection();
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getEventList(instanceId: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getDryRunInstance(defPath: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
}

export default ProcessGPTBackend;

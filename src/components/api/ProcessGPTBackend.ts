import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import type { Backend } from './Backend';

import { formatDistanceToNowStrict } from 'date-fns';

enum ErrorCode {
    TableNotFound = "42P01"
}

class ProcessGPTBackend implements Backend {

    async deleteTest(testId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async releaseVersion(releaseName: string): Promise<any> {
    }
    
    testList(path: string): Promise<any> {
        throw new Error('Method not implemented.');
    }
    findCurrentWorkItemByInstId(instId: string): Promise<any> {
        throw new Error('Method not implemented.');
    }

    async checkDBConnection() {
        if (await storage.isConnection()) return true;
        return false;
    }

    async listDefinition(path: string) {
        try {
            // 프로세스 정보, 폼 정보를 각각 불러와서 파일명을 포함해서 가공하기 위해서
            let procDefs = await storage.list('proc_def', (path ? { like: `${path}%` } : undefined));
            procDefs.map((item: any) => {
                item.path = `${item.id}`
                item.name = item.name || item.path 
            });
            return procDefs
        } catch (e) {
            
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
            if (options && options.type === "form") {
                return await storage.delete(`form_def/${defId.replace(/\//g, "#")}`, { key: 'id' });
            } else {
                const form = await storage.list('form_def', {
                    sort: 'desc',
                    match: { 'proc_def_id': defId }
                });
                if (form && form.length > 0) {
                    await storage.delete(`form_def/${defId}`, { key: 'proc_def_id' });
                }
                
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

                // const instList = await storage.list(defId);
                // if (instList && instList.length > 0) {
                //     await Promise.all([
                //         await storage.delete('todolist', { match: { proc_def_id: defId } }),
                //         await storage.delete('proc_inst', { match: { proc_def_id: defId } }),
                //     ]);
                // }
                await Promise.all([
                    await storage.delete('todolist', { match: { proc_def_id: defId } }),
                    await storage.delete('bpm_proc_inst', { match: { proc_def_id: defId } }),
                ]);
                
                await storage.delete(`proc_def/${defId}`, { key: 'id' });

                // if (!window.$jms) {
                //     await axios.post(`/execution/drop-process-table/invoke`, {
                //         "input": {
                //             "process_definition_id": defId
                //         }
                //     }).catch(error => {
                //         throw new Error(error && error.detail ? error.detail : error);
                //     });
                // }
            }
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async putRawDefinition(xml: any, defId: string, options: any) {
        try {
            defId = defId.toLowerCase();
            defId = defId.replace(/[/.]/g, "_");

            // 폼 정보를 저장하기 위해서
            if(options && options.type === "form") {
                var formDef: any = await storage.getObject('form_def', {
                    match: {
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                    }
                });
                if(formDef) {
                    formDef.html = xml;
                    await storage.putObject('form_def', formDef);
                } else {
                    await storage.putObject('form_def', {
                        id: defId.replace(/\//g, "#"),
                    html: xml,
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                    });
                }
                return
            }

            var procDef: any = await storage.getObject('proc_def', {
                match: {
                    id: defId,
                }
            });
            if (procDef) {
                procDef.bpmn = xml;
                procDef.name = options.name;
                procDef.definition = options.definition;
                await storage.putObject('proc_def', procDef);
            } else {
                await storage.putObject('proc_def', {
                    id: defId,
                    name: options.name,
                    bpmn: xml,
                    definition: options.definition,
                });
            }

            if (options.version) {
                const procDefArcv: any = {
                    arcv_id: options.arcv_id,
                    proc_def_id: defId,
                    version: options.version,
                    snapshot: xml,
                    diff: options.diff,
                    message: options.message,
                }
                await storage.putObject('proc_def_arcv', procDefArcv);
            }

            try {
                const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
                if (isLocked) {
                    await storage.delete(`lock/${defId}`, { key: 'id' });
                }
            } catch(error) {
                //@ts-ignore
                throw new Error("Error when to unlock: " + (error && error.detail ? error.detail : error));
            }

            // if (!window.$jms) {
            //     try {
            //         await axios.post(`/execution/process-db-schema/invoke`, {
            //             "input": {
            //                 "process_definition_id": defId
            //             }
            //         })
            //     } catch(error) {
            //         //@ts-ignore
            //         throw new Error("Error when to creating database for the definition: " + (error && error.detail ? error.detail : error));
            //     }
            // }

        } catch (e) {
            
            throw new Error('error when to save definition: ' + (e instanceof Error ? e.message : ''));
        }
    }

    async getRawDefinition(defId: string, options: any) {
        try {
            if (defId) {
                defId = defId.toLowerCase();
            } else {
                return;
            }

            if (options) {
                // 폼 정보를 불러오기 위해서
                if(options.type === "form") {
                    if (defId.includes('/')) defId = defId.replace(/\//g, "#")
                    const data = await storage.getString(`form_def/${defId}`, { key: 'id', column: 'html' });
                    if(!data) {
                        return null;
                        // throw new Error('no such form definition');
                    }
                    return data;
                } else if(options.type === "bpmn") {
                    if (defId.includes('/')) defId = defId.replace(/\//g, "_")
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'bpmn' });
                    if(!data) {
                        return null;
                    }
                    return data;
                }
            } else {
                if (defId.includes('/')) defId = defId.replace(/\//g, "_")
                const data = await storage.getObject(`proc_def/${defId}`, { key: 'id' });
                return data;
            }

        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    uuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    async start(input: any) {
        try {
            if (window.$jms) return;

            let defId = input.process_definition_id || input.processDefinitionId;
            if (defId && defId != '') {
                // const list = await storage.list(defId);
                // if (list.code == ErrorCode.TableNotFound) {
                //     await axios.post(`/execution/process-db-schema/invoke`, {
                //         "input": {
                //             "process_definition_id": defId
                //         }
                //     }).catch(error => {
                //         throw new Error(error && error.detail ? error.detail : error);
                //     });
                // }
            } else {
                if (input.process_instance_id && input.process_instance_id != '') {
                    defId = input.process_instance_id.split('.')[0];
                }
            }

            if (!input.answer) {
                input.answer = "";
            }
            if (!input.process_instance_id) {
                input.process_instance_id = "new";
            } else {
                input['chat_room_id'] = input.process_instance_id;
            }
            if (!input.role_mappings) {
                input.role_mappings = [];
            }
            input['process_definition_id'] = defId.toLowerCase();
            if (!input.chat_room_id) {
                input['chat_room_id'] = `${input.process_definition_id}.${this.uuid()}`;
            }

            var result: any = null;
            var url = `/execution/complete`;
            if (input.image != null) {
                url = `/execution/vision-complete`;
            }
            var req = {
                input: input
            };
            const token = localStorage.getItem('accessToken');
            await axios.post(url, req, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => {
                if (res.data) {
                    const data = JSON.parse(res.data);
                    if (data) {
                        result = data;
                        if (result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                            result.errors = result.cannotProceedErrors;
                            const dataNotExist = result.cannotProceedErrors.find((item: any) => item.type === 'DATA_FIELD_NOT_EXIST');
                            if (!dataNotExist) {
                                throw new Error(result.cannotProceedErrors.map((item: any) => item.reason).join('\n'));
                            }
                        }
                    }
                }
            })
            .catch(error => {
                throw new Error(error && error.detail ? error.detail : error);
            });

            return result;
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getInstance(instanceId: string) {
        try {
            const options = {
                match: {
                    proc_inst_id: instanceId
                }
            };
            const instance = await storage.getObject('bpm_proc_inst', options);
            if (instance) {
                instance.defId = instance.proc_def_id;
                instance.instanceId = instanceId;
                instance.name = instance.proc_inst_name;
                if (instance.current_activity_ids && instance.current_activity_ids.length > 0) {
                    instance.status = 'RUNNING'
                } else {
                    instance.status = 'COMPLETED'
                }
            }
            console.log(instance);
            return instance;
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getAllInstanceList(page: any, size: any) {
        try {
            const list = await storage.list('bpm_proc_inst');
            return list;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getWorkItem(taskId: string) {
        try {
            if (!taskId) return
            const workitem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            const defInfo = await this.getRawDefinition(workitem.proc_def_id, null);
            const inst = await this.getInstance(workitem.proc_inst_id);

            let parameters: any[] = [];
            let variableForHtmlFormContext: any = {};
            let activityInfo: any = null;

            if (defInfo && defInfo.definition) {
                activityInfo = defInfo.definition.activities.find((activity: any) => activity.id === workitem.activity_id);
                if (activityInfo && activityInfo.properties) {
                    const properties = JSON.parse(activityInfo.properties);
                    if (properties.parameters) {
                        parameters = properties.parameters;
                        parameters.forEach((item: any) => {
                            item.variable.defaultValue = inst[item.variable.name.toLowerCase().replace(/ /g, '_')] || "";
                        })
                    }
                    if (properties.variableForHtmlFormContext) {
                        variableForHtmlFormContext = properties.variableForHtmlFormContext;
                    }
                }
            }
            const parameterValues: any = {}
            if (parameters.length > 0) {
                parameters.forEach((item) => {
                    parameterValues[item.argument.text] = item.variable.defaultValue
                })
            }
            const newWorkItem = {
                worklist: {
                    defId: workitem.proc_def_id,
                    endpoint: workitem.user_id,
                    instId: workitem.proc_inst_id,
                    rootInstId: null,
                    taskId: workitem.id,
                    startDate: workitem.start_date,
                    endDate: workitem.end_date,
                    dueDate: workitem.due_date,
                    status: workitem.status === 'TODO' ? 'NEW' : workitem.status === 'DONE' ? 'COMPLETED' : workitem.status,
                    description: workitem.description || "",
                    tool: workitem.tool || "",
                    currentActivities: inst.current_activity_ids || []
                },
                activity: {
                    name: workitem.activity_name,
                    tracingTag: workitem.activity_id || '',
                    parameters: parameters || [],
                    variableForHtmlFormContext: variableForHtmlFormContext || {},
                    instruction: activityInfo && activityInfo.instruction ? activityInfo.instruction : "",
                    checkpoints: activityInfo && activityInfo.checkpoints ? activityInfo.checkpoints : []
                },
                parameterValues: parameterValues || {}
            }
            return newWorkItem;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getWorkList(options?: any) {
        try {
            const filter: any = { match: {} };
            if (options && options.status) {
                filter.match.status = options.status;
            }
            if (options && options.instId) {
                filter.match.proc_inst_id = options.instId;
            } else {
                const email = localStorage.getItem("email");
                filter.match.user_id = email;
            }
            const list = await storage.list('worklist', filter);
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
                        endDate: item.end_date,
                        dueDate: item.due_date,
                        status: item.status,
                        title: item.activity_name || "",
                        tracingTag: item.activity_id || "",
                        description: item.description || "",
                        tool: item.tool || "",
                        instName: item.proc_inst_name || ""
                    };
                    worklist.push(workItem);
                }
            }
            return worklist;
        } catch (error) {
            
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
            if (!workItem.instId || workItem.status != "DONE") {
                const putObj = {
                    id: taskId,
                    proc_def_id: workItem.defId || workItem.defId,
                    user_id: workItem.endpoint || workItem.endpoint,
                    proc_inst_id: workItem.instId || workItem.instId,
                    start_date: workItem.startDate || workItem.startDate,
                    end_date: workItem.endDate || workItem.endDate,
                    due_date: workItem.dueDate || workItem.dueDate,
                    status: workItem.status || workItem.status,
                    activity_id: workItem.tracingTag || workItem.title,
                    activity_name: workItem.title || workItem.title,
                    description: workItem.description || workItem.description,
                    tool: workItem.tool || workItem.tool
                }
                await storage.putObject('todolist', putObj);

                if (workItem.status == "IN_PROGRESS" || workItem.status == "PENDING") {
                    const putInst = {
                        proc_inst_id: workItem.instId,
                        current_activity_ids: [workItem.tracingTag || workItem.title]
                    }
                    await storage.putObject('bpm_proc_inst', putInst);
                }
            } else { // instance workItem
                const answer = {
                    "activity_id": workItem.tracingTag || workItem.title,
                    "status_to_change": workItem.status,
                }
                result = await this.putWorkItemComplete(taskId, answer);
                // 다음 액티비티로 넘어가지 못한 경우
                if (result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                    result.errors = result.cannotProceedErrors;
                    const dataNotExist = result.cannotProceedErrors.find((item: any) => item.type === 'DATA_FIELD_NOT_EXIST');
                    if (!dataNotExist) {
                        throw new Error(result.cannotProceedErrors.map((item: any) => item.reason).join('\n'));
                    }
                }
            }
            return result;
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteWorkItem(taskId: string) {
        try {
            await storage.delete(`todolist/${taskId}`, { key: 'id' });
        } catch (error) {
            
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
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // proc_map
    async getProcessDefinitionMap() {
        try {
            const options = {
                match: {
                    key: 'proc_map',
                }
            };
            const procMap = await storage.getObject('configuration', options);
            if (procMap && procMap.value) {
                const renameLabels = (obj: any) => {
                    if (obj instanceof Array) {
                        obj.forEach(item => renameLabels(item));
                    } else if (obj instanceof Object) {
                        if (obj.hasOwnProperty('label')) {
                            obj.name = obj.label;
                            delete obj.label;
                        }
                        Object.values(obj).forEach(value => renameLabels(value));
                    }
                };
                renameLabels(procMap.value);
                return procMap.value;
            }
            return {};
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        } 
    }

    async putProcessDefinitionMap(definitionMap: any) {
        try {
            const options = {
                match: {
                    key: 'proc_map',
                },
                column: 'uuid'
            };
            const procMapId = await storage.getString('configuration', options);
            const putObj = {
                uuid: procMapId || this.uuid(),
                key: 'proc_map',
                value: definitionMap,
            }
            await storage.putObject('configuration', putObj);
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getDefinitionVersions(defId: string, options: any) {
        try {
            let list: any = [];
            defId = defId.toLowerCase();
            if(!options) {
                options = {
                    match: {
                        proc_def_id: defId
                    }
                };
            } else {
                if (!options.match) options.match = {};
                options.match.proc_def_id = defId;
            }
            list = await storage.list('proc_def_arcv', options);
            const procDefName = await storage.getString(`proc_def/${defId}`, { key: 'id', column: "name" });
            if(procDefName) {
                list.forEach((item: any) => {
                    item.name = procDefName;
                });
            }
            return list;
        } catch (error) {
            
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

    extractFields(htmlString: string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const fields: any[] = [];
    
        function extractFieldAttributes(elements: any) {
            elements.forEach((element: any) => {
                const alias = element.getAttribute('alias');
                const vModel = element.getAttribute('v-model');
                const match = vModel.match(/slotProps\.modelValue\['(.*?)'\]/);
                const tagName = element.tagName.toLowerCase();

                let field: any = {
                    text: alias || '',
                    key: match[1] || '',
                    type: tagName.replace('-field', '') || ''
                };
                fields.push(field);
            });
        }
    
        const fieldTags = [
            'text-field', 'select-field', 'checkbox-field', 'radio-field', 
            'file-field', 'label-field', 'boolean-field', 'textarea-field', 
            'user-select-field'
        ];
    
        fieldTags.forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            extractFieldAttributes(elements);
        });
    
        return fields;
    }

    async getVariableWithTaskId(instId: string, taskId: string, varName: string) {
        try {
            const html = await storage.getString(`form_def/${varName}`, { key: 'id', column: 'html' });
            const fields = this.extractFields(html);
            const instance: any = await this.getInstance(instId);
            let varData: any = {};
            if (instance && fields.length > 0) {
                fields.forEach((field) => {
                    let fieldName = field.text.toLowerCase().replace(/ /g, '_') || field.text;
                    let fieldValue = instance.variables_data[fieldName];
                    if (field.type === 'boolean') {
                        fieldValue = fieldValue === 'true' ? true : false;
                    }
                    varData[field.key] = fieldValue;
                });
            }
            const result = {
                valueMap: varData
            }
            console.log(result);
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        try {
            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            const putObj: any = {
                proc_inst_id: instanceId,
                variables_data: {
                    [columnName]: varValue
                }
            }

            await storage.putObject('bpm_proc_inst', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setVariableWithTaskId(instId: string, taskId: string, varName: string, varValue: any) {
        try {
            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            const putObj: any = {
                proc_inst_id: instId,
                variables_data: {
                    [columnName]: varValue.valueMap ? varValue.valueMap : varValue
                }
            }
            await storage.putObject('bpm_proc_inst', putObj);
        } catch (error) {
            
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

    async getInProgressList(options?: any) {
        const completedOptions = { ...options, status: "IN_PROGRESS" };
        return this.getWorkList(completedOptions);
    }

    async getCompletedList(options?: any) {
        const completedOptions = { ...options, status: "DONE" };
        return this.getWorkList(completedOptions);
    }

    async getPendingList(options?: any) {
        const completedOptions = { ...options, status: "PENDING" };
        return this.getWorkList(completedOptions);
    }

    async putWorkItemComplete(taskId: string, inputData: any) {
        try {
            if (window.$jms) return;

            let result: any = null;
            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });

            if (inputData.parameterValues && inputData.parameterValues["user_input_text"]) {
                const newMessage = {
                    "name": localStorage.getItem('userName'),
                    "role": "user",
                    "email": localStorage.getItem('email'),
                    "image": "",
                    "content": inputData.parameterValues["user_input_text"],
                    "timeStamp": new Date().toISOString()
                }
                this.updateInstanceChat(workItem.proc_inst_id, newMessage);
            }

            const input = {
                answer: JSON.stringify(inputData),
                process_instance_id: workItem.proc_inst_id,
                process_definition_id: workItem.proc_def_id,
                activity_id: workItem.activity_id,
                chat_room_id: workItem.proc_inst_id
            };
            const req = {
                input: input
            };
            const token = localStorage.getItem('accessToken');
            let url = `/execution/complete`;
            await axios.post(url, req, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).then(res => {
                if (res.data) {
                    const data = JSON.parse(res.data);
                    if (data) {
                        result = data;
                    }
                }
            })
            .catch(error => {
                result = error;
            });
    
            return result;

        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async updateInstanceChat(instanceId: string, newMessage: any) {
        try {
            const putObj = {
                id: instanceId,
                uuid: this.uuid(),
                messages: newMessage,
            }
            await storage.putObject('chats', putObj);
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async fetchInstanceListByStatus(status: string): Promise<any[]> {
        const list = await storage.list('bpm_proc_inst', { match: { status: status } });
        const email = window.localStorage.getItem("email");
        const filteredData = list.filter((item: any) => item.current_user_ids.includes(email));

        if (filteredData && filteredData.length > 0) {
            const result = filteredData.map((item: any) => {
                return {
                    instId: item.proc_inst_id,
                    instName: item.proc_inst_name,
                    status: item.status,
                    defId: item.proc_def_id
                }
            });
            return result;
        }
        return [];
    }

    async getInstanceList() {
        try {
            let instList: any[] = await this.fetchInstanceListByStatus("RUNNING");
            return instList;
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getCompleteInstanceList() {
        try {
            let instList: any[] = await this.fetchInstanceListByStatus("COMPLETED");
            return instList;
        } catch (error) {
            
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
                    endDate: item.end_date,
                    dueDate: item.due_date,
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
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFilteredInstanceList(filters: object, page: number) {
        //TODO: 인스턴스 목록 관리자 페이지 필터 결과
        return null
    }

    
    async getCompletedTaskId(instId: string) {
        // instance/{instanceId}/completed
        //TODO: 현재 완료된 태스크 ID 가져오기

        return null;
    }
    
    async getActivitiesStatus(instId: string) {
        // instance/{instanceId}/completed
        //TODO: 현재 프로세스 진행상태 추가
        try {
            const list = await storage.list(`worklist`, { match: { 'proc_inst_id': instId } });
            let result: any = {};
            list.forEach((item: any) => {
                if(item.status == 'DONE') {
                    result[item.activity_id] = 'Completed';
                } else if(item.status == 'IN_PROGRESS') {
                    result[item.activity_id] = 'Running';
                } else if(item.status == 'PENDING') {
                    result[item.activity_id] = 'Pending';
                } else if(item.status == 'TODO') {
                    result[item.activity_id] = 'New';
                }
            });
            return result;
        } catch (e) {
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

    async dryRun(defPath: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async startAndComplete(command: object, isSimulate: string) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putSystem(system: any) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteSystem(system: any) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getSystemList() {
        try {
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getSystem(systemId: String) {
        try {
            return {};
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    
    async validate(xml: string){
        try {
            return {};
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getCurrentWorkItemByCorrKey(corrKey: number) {
        try {
            return null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteInstance(instId: string) {
        try {
            await Promise.all([
                await storage.delete('bpm_proc_inst', { match: { proc_inst_id: instId } }),
                await storage.delete('todolist', { match: { proc_inst_id: instId } }),
                await storage.delete('chats', { match: { id: instId } })
            ]);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async bindRole(roles: any) {
        try {
            let result: any = null;
            const token = localStorage.getItem('accessToken');
            await axios.post(`/execution/role-binding`, {
                "input": {
                    "roles": roles
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(res => {
                if (res.data) {
                    const data = JSON.parse(res.data);
                    result = data.roleBindings;
                }
            })
            .catch(error => {
                throw new Error(error && error.detail ? error.detail : error);
            });
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getNotifications() {
        try {
            await storage.watch('notifications', async (data: any) => {
                if(data && data.new) {
                    await this.fetchNotifications();
                }
            });

            return await this.fetchNotifications();
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    private async fetchNotifications() {
        try {
            let notifications: any[] = [];
            const userId = localStorage.getItem('email');
            const options = {
                limit: 10,
                orderBy: 'time_stamp',
                sort: 'desc',
                match: { user_id: userId, is_checked: false },
            }
            const list = await storage.list('notifications', options);
            if (list.length > 0) {
                notifications = Object.values(list.reduce((acc: any, item: any) => {
                    const timeStamp = formatDistanceToNowStrict(new Date(item.time_stamp), {
                        addSuffix: false
                    });
                    item.timeStamp = timeStamp;
                    if (!acc[item.url]) {
                        item.count = 1;
                        acc[item.url] = item;
                    } else if (new Date(item.time_stamp) > new Date(acc[item.url].time_stamp)) {
                        item.count = acc[item.url].count + 1;
                        acc[item.url] = item;
                    } else {
                        acc[item.url].count += 1;
                    }
                    return acc;
                }, {}));
            }
            return notifications;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setNotifications(value: any) {
        try {
            if (value.count > 1) {
                const notifications = await this.getNotifications();
                notifications.forEach(async (item: any) => {
                    if (item.url === value.url && item.user_id === value.user_id) {
                        const putObj = { id: item.id, is_checked: true };
                        await storage.putObject('notifications', putObj);
                    }
                });
            } else {
                const putObj = { id: value.id, is_checked: true };
                await storage.putObject('notifications', putObj);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async search(keyword: string) {
        try {
            return await storage.search(keyword);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserList() {
        try {
            const options = {
                orderBy: 'username',
                sort: 'asc'
            }
            const users = await storage.list('users', options);
            return users
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserInfo() {
        try {
            const user = await storage.getUserInfo();
            return user;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateUserInfo(value: any) {
        try {
            if (value.type === 'update') {
                value.user.current_tenant = window.$tenantName;
                await storage.putObject('users', value.user);
                const user: any = await this.getUserInfo();
                if (user && value.user.id === user.uid) {
                    const userInfo = {
                        email: value.user.email,
                        user_metadata: {
                            name: value.user.username
                        }
                    }
                    await storage.updateUser(userInfo);
                    await storage.writeUserData(value);
                }
            } else if (value.type === 'delete') {
                await storage.delete('users', { match: { id: value.user.id } });
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadDefinition(file: File, path: string) {
    }

    async getLock(id: string) {
        try {
            const options = {
                match: {
                    id: id,
                }
            }
            const lock = await storage.getObject('lock', options);
            return lock;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setLock(lockObj: any) {
        try {
            const lock = await this.getLock(lockObj.id);
            var putObj: any = { 
                id: lockObj.id, 
                user_id: lockObj.user_id 
            };
            if(lock) {
                putObj.uuid = lock.uuid;
                await storage.putObject('lock', putObj);
            } else {
                await storage.putObject('lock', putObj);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteLock(id: string) {
        try {
            const options = {
                match: {
                    id: id,
                }
            }
            await storage.delete('lock', options);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTenants() {
        try {
            const tenants = await storage.list('tenants');
            return tenants;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTenant(tenantId: string) {
        try {
            const tenant = await storage.getString('tenants', { 
                match: { 
                    id: tenantId 
                },
                column: 'id'
            });
            return tenant;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setTenant(tenantId: string) {
        try {
            await storage.setCurrentTenant(tenantId);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putTenant(tenantId: string) {
        try {
            if (!tenantId) {
                throw new Error("Tenant ID cannot be null or empty");
            }
            await storage.putObject('tenants', { id: tenantId });
            const user: any = await this.getUserInfo();
            const tenantList = user?.tenants || [];
            if (!tenantList.includes(tenantId)) {
                tenantList.push(tenantId);
            }
            await storage.putObject('users', {
                id: user.uid,
                tenants: tenantList,
                current_tenant: tenantId
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteTenant(tenantId: string) {
        try {
            await storage.delete('tenants', { match: { id: tenantId } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkListAll() {
        try {
            const list = await this.getWorkList();
            return list;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getOpenAIToken() {
        try {
            let option = {
                match: {
                    key: 'openai_key'
                }
            };
            const res = await storage.getObject('configuration', option);
            return res?.value?.key || window.localStorage.getItem('openAIToken') || null;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
}

export default ProcessGPTBackend;

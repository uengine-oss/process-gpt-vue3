import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();
import type { Backend } from './Backend';

import { formatDistanceToNowStrict } from 'date-fns';

enum ErrorCode {
    TableNotFound = "42P01"
}

let streamText: string = "";

class ProcessGPTBackend implements Backend {

    async deleteTest(testId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async deleteRecordTest(path: string, index: number): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async releaseVersion(releaseName: string): Promise<any> {
    }
    
    testList(path: string): Promise<any> {
        throw new Error('Method not implemented.');
    }

    testRecordList(path: string): Promise<any> {
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
            if (path == 'form_def') {
                let formDefs = await storage.list('form_def');
                formDefs.map((item: any) => {
                    item.path = `${item.id}`
                    item.name = item.name || item.path 
                });
                return formDefs
            } else {
                let procDefs = await storage.list('proc_def', (path ? { like: `${path}%` } : undefined));
                procDefs.map((item: any) => {
                    item.path = `${item.id}`
                    item.name = item.name || item.path 
                });
                return procDefs
            }
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
            if (defId.includes('.bpmn')) defId = defId.replace('.bpmn', '')

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
            }
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    
    async restoreDefinition(defId: string, options: any): Promise<boolean | undefined> {
        if (defId.includes('.bpmn')) defId = defId.replace('.bpmn', '')
        return false;
    }
    
    async putRawDefinition(xml: any, defId: string, options: any) {
        try {
            defId = defId.toLowerCase();
            defId = defId.replace(/[/.]/g, "_");

            // 폼 정보를 저장하기 위해서
            if(options && options.type === "form") {
                const fieldsJson = this.extractFields(xml);
                var formDef: any = await storage.getObject('form_def', {
                    match: {
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                    }
                });
                if(formDef) {
                    formDef.html = xml;
                    if (fieldsJson) {
                        formDef.fields_json = fieldsJson;
                    }
                    await storage.putObject('form_def', formDef);
                } else {
                    await storage.putObject('form_def', {
                        id: defId.replace(/\//g, "#"),
                        html: xml,
                        proc_def_id: options.proc_def_id,
                        activity_id: options.activity_id,
                        fields_json: fieldsJson
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

            const isLocked = await storage.getObject(`lock/${defId}`, { key: 'id' });
            if (isLocked) {
                await storage.delete(`lock/${defId}`, { key: 'id' });
            }
            
            const content = `${options.name}: ${JSON.stringify(options.definition)}`;
            this.updateVectorStore(content, "process_definition"); 

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
            var me = this;
            if (window.$jms) return;

            let defId = input.process_definition_id || input.processDefinitionId;
            if (!defId && input.process_instance_id && input.process_instance_id != '') {
                defId = input.process_instance_id.split('.')[0];
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
                input['chat_room_id'] = `${input.process_definition_id}.${me.uuid()}`;
            }

            return await me.executeInstance(input);

        } catch (error) {
            //@ts-ignore
            return error;
        }
    }

    // async executeInstance(input: any) {
    //     try {
    //         const email = localStorage.getItem('email');
    //         input.email = email;

    //         var url = `/execution/complete`;
    //         if (input.answer && input.answer.image != null) {
    //             url = `/execution/vision-complete`;
    //         }
            
    //         var req = {
    //             input: input
    //         };

    //         var response: any = await axios.post(url, req, {
    //             responseType: 'stream',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             }
    //         })
    //         // .then(res => {
    //         //     if (res.data) {
    //         //         console.log(res.data);
    //         //         // const data = JSON.parse(res.data);
    //         //         // if (data) {
    //         //         //     result = data;
    //         //         // }
    //         //     }
    //         // })
    //         // .catch(error => {
    //         //     result = {}
    //         //     if (error.detail && error.detail.status_code && error.detail.status_code == 401) {
    //         //         alert('토큰이 만료되었습니다. 다시 로그인 해주세요.');
    //         //     } else if (error.detail) {
    //         //         result.error = error.detail;
    //         //     } else {
    //         //         result.error = error;
    //         //     }
    //         // });

    //         response.data.on('data', (chunk) => {
    //             console.log('Stream chunk:', chunk.toString());
    //         });
              
    //         response.data.on('end', () => {
    //             console.log('Stream complete');
    //         });              

    //         // return response.data;
    //     } catch (error) {
    //         return { error: error };
    //     }
    // }

    async executeInstance(input: any) {
        try {
            const email = localStorage.getItem('email');
            input.email = email;
        
            let url = `/execution/complete`;
            if (input.answer && input.answer.image != null) {
                url = `/execution/vision-complete`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input })
            });
        
            if (!response.body) {
                throw new Error("스트리밍 응답이 지원되지 않습니다.");
            }
        
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            return { reader, decoder };
        } catch (error: any) {
            return { error: error.message || error };
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
            }
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
            let outParameterContext: any = {
                variable: {
                    name: "",
                }
            };
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
                    if (properties.variableForHtmlFormContext && properties.variableForHtmlFormContext.name) {
                        outParameterContext.variable.name = properties.variableForHtmlFormContext.name;
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
                    outParameterContext: outParameterContext || {},
                    instruction: activityInfo && activityInfo.instruction ? activityInfo.instruction : "",
                    checkpoints: activityInfo && activityInfo.checkpoints ? activityInfo.checkpoints : [],
                    pythonCode: activityInfo && activityInfo.pythonCode ? activityInfo.pythonCode : "",
                    type: activityInfo && activityInfo.type ? activityInfo.type : ""
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
                    tool: workItem.tool || workItem.tool,
                    adhoc: workItem.adhoc || workItem.adhoc
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

    /**
     * 프로세스 정의 체계도 조회
     * @returns 
     */
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
                const usePermissions = await this.checkUsePermissions();
                const role = localStorage.getItem('role');
                if (role == 'superAdmin' || !usePermissions) {
                    return procMap.value;
                } else {
                    const filteredMap = await this.filterProcDefMap(procMap.value);
                    return filteredMap;
                }
            }
            return {};
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        } 
    }

    async putProcessDefinitionMap(editedMap: any) {
        try {
            const options = {
                match: {
                    key: 'proc_map',
                },
                column: 'uuid'
            };
            const procMapId = await storage.getString('configuration', options);
            let updatedProcMap: any = null;
            const role = localStorage.getItem('role');
            if (role !== 'superAdmin') {
                const existingProcMap = await storage.getObject('configuration', options);
                const usePermissions = await this.checkUsePermissions();
                if (usePermissions) {
                    updatedProcMap = await this.mergeProcessMaps(existingProcMap.value, editedMap);
                } else {
                    updatedProcMap = editedMap;
                }
                // console.log("병합한 프로세스 정의 체계도 ", updatedProcMap);
            } else {
                updatedProcMap = editedMap;
            }

            const putObj = {
                uuid: typeof procMapId === 'string' ? procMapId : this.uuid(),
                key: 'proc_map',
                value: updatedProcMap,
                tenant_id: window.$tenantName
            }
            await storage.putObject('configuration', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async filterProcDefMap(map: any) {
        // 사용자 권한에 따라 필터링
        const uid = localStorage.getItem('uid');
        const permissions = await storage.list('user_permissions', { match: { user_id: uid } });
        if (!permissions || permissions.length === 0) {
            return {};
        }
        const processList = permissions.map((permission: any) => permission.proc_def_ids);
        let filteredMap: any = {};
                
        if (processList.length > 0) {
            function removeDuplicates(processList: any) {
                const uniqueByIdAndName = (array: any) => {
                    const seen = new Map();
                    return array.filter((item: any) => {
                        const key = `${item.id}-${item.name}`;
                        if (seen.has(key)) {
                            const existingItem = seen.get(key);
                            if (item.major_proc_list && existingItem.major_proc_list) {
                                existingItem.major_proc_list = item.major_proc_list.length > existingItem.major_proc_list.length ? item.major_proc_list : existingItem.major_proc_list;
                            }
                            if (item.sub_proc_list && existingItem.sub_proc_list) {
                                existingItem.sub_proc_list = item.sub_proc_list.length > existingItem.sub_proc_list.length ? item.sub_proc_list : existingItem.sub_proc_list;
                            }
                            return false;
                        }
                        seen.set(key, item);
                        return true;
                    });
                };

                processList = uniqueByIdAndName(processList);

                return processList.map((megaProc: any) => {
                    if (megaProc.major_proc_list) {
                        megaProc.major_proc_list = uniqueByIdAndName(megaProc.major_proc_list.map((majorProc: any) => {
                            majorProc.sub_proc_list = uniqueByIdAndName(majorProc.sub_proc_list);
                            return majorProc;
                        }));
                    }
                    return megaProc;
                });
            }

            const uniqueProcessList = removeDuplicates(processList);
            filteredMap = {
                mega_proc_list: uniqueProcessList
            }
        } else {
            filteredMap = {
                mega_proc_list: []
            }
        }
        return filteredMap;
    }

    async mergeProcessMaps(oldValue: any, newValue: any) {
        if (!oldValue || !oldValue.mega_proc_list) {
            return newValue;
        } else {
            const existingMap = oldValue.mega_proc_list;
            const changes = newValue.mega_proc_list;
            const uid = localStorage.getItem('uid');

            for (const item of existingMap) {
                const change = changes.find((changeItem: any) => changeItem.id === item.id);
                if (change) {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (permission && permission.writable) {
                        // 개정 권한이 있는 경우 수정된 버전으로 권한 업데이트
                        const putObj = {
                            user_id: uid,
                            proc_def_id: item.id,
                            proc_def_ids: item
                        }
                        await this.putUserPermission(putObj);
                        Object.assign(item, change);
                    } else {
                        // 권한이 없는 프로세스
                    }

                    Object.assign(item, change);
                } else {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (permission && permission.writable) {
                        const index = existingMap.indexOf(item);
                        if (index > -1) {
                            existingMap.splice(index, 1);
                        }
                    } else {
                        // 권한이 없는 프로세스
                    }
                }
            }

            // 편집 내용 중 새로 추가된 프로세스
            for (const item of changes) {
                const newProc = existingMap.find((existingItem: any) => existingItem.id === item.id);
                if (!newProc) {
                    const permission = await this.getUserPermissions({ user_id: uid, proc_def_id: item.id });
                    if (!permission) {
                        const putObj = {
                            user_id: uid,
                            proc_def_id: item.id,
                            proc_def_ids: item
                        }
                        await this.putUserPermission(putObj);
                    }
                    existingMap.push(item);
                }
            }
            // console.log("변경된 프로세스 정의 체계도", existingMap);
            return {
                mega_proc_list: existingMap
            };
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
        try {
            let varData: any = {};
            const instance: any = await this.getInstance(instanceId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                instance.variables_data.forEach((item: any) => {
                    if (item.key) {
                        varData[item.key] = item.value;
                    }
                })
            }
            return varData;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
        // throw new Error("Method not implemented.");
    }

    async getVariable(instId: string, varName: string) {
        try {
            let varData: any = null;
            const instance: any = await this.getInstance(instId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                instance.variables_data.forEach((item: any) => {
                    if (item.key === varName || item.name === varName) {
                        varData = item.value;
                    }
                })
            }
            return varData;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    extractFields(html: string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const fields: any[] = [];
    
        function extractFieldAttributes(elements: any) {
            elements.forEach((element: any) => {
                const alias = element.getAttribute('alias');
                const vModel = element.getAttribute('v-model');
                const match = vModel.match(/slotProps\.modelValue\['(.*?)'\]/);
                const tagName = element.tagName.toLowerCase();
                const disabled = element.getAttribute('disabled');
                const readonly = element.getAttribute('readonly');

                let field: any = {
                    text: alias || '',
                    key: match ? (match[1] || '') : '',
                    type: tagName.replace('-field', '') || '',
                    disabled: disabled ? disabled : false,
                    readonly: readonly ? readonly : false
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

    async getVariableWithTaskId(instId: string, taskId: string, formDefId: string) {
        try {
            let varData: any = null;
            const instance: any = await this.getInstance(instId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                instance.variables_data.forEach((item: any) => {
                    if (item.key === formDefId) {
                        varData = item.value;
                    }
                })
            }

            if (!varData) {
                var fields: any = [];
                const formObject: any = await storage.getObject(`form_def/${formDefId}`, { key: 'id' });
                if (formObject) {
                    fields = formObject.fields_json;
                } else {
                    const html = await storage.getString(`form_def/${formDefId}`, { key: 'id', column: 'html' });
                    fields = this.extractFields(html);
                }
                if (fields && fields.length > 0) {
                    fields.forEach((field: any) => {
                        if (!varData[field.key]) {
                            varData[field.key] = "";
                        }
                    });
                }
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
            if (!varName) {
                console.log("varName is null");
                return;
            }

            const columnName: any = varName.toLowerCase().replace(/ /g, '_');
            const instance: any = await this.getInstance(instId);
            if (instance && instance.variables_data && instance.variables_data.length > 0) {
                let existed = false;
                instance.variables_data.forEach((item: any) => {
                    if (item.key === columnName) {
                        item.value = varValue.valueMap ? varValue.valueMap : varValue;
                        existed = true;
                    }
                })
                if (!existed) { 
                    instance.variables_data.push({
                        key: columnName,
                        value: varValue.valueMap ? varValue.valueMap : varValue
                    })
                }
            } else {
                instance.variables_data = [{
                    key: columnName,
                    value: varValue.valueMap ? varValue.valueMap : varValue
                }]
            }
            const putObj: any = {
                proc_inst_id: instId,
                variables_data: instance.variables_data
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

    async getAllWorkListByInstId(instId: number) {
        return this.getWorkListByInstId(instId);
    }

    async putWorkItemComplete(taskId: string, inputData: any) {
        try {
            var me = this;
            if (window.$jms) return;

            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            let answer = '';

            if (inputData["user_input_text"] && inputData["user_input_text"] != '') {
                answer = inputData["user_input_text"];
                const newMessage = {
                    "name": localStorage.getItem('userName'),
                    "role": "user",
                    "email": localStorage.getItem('email'),
                    "image": "",
                    "content": inputData["user_input_text"],
                    "timeStamp": new Date().toISOString()
                }
                me.updateInstanceChat(workItem.proc_inst_id, newMessage);
            }

            const formId = workItem.tool.replace('formHandler:', '');
            let formValues = {};
            if (formId && inputData.parameterValues) {
                formValues[formId] = inputData.parameterValues;
            }

            const input = {
                answer: answer,
                form_values: formValues,
                process_instance_id: workItem.proc_inst_id,
                process_definition_id: workItem.proc_def_id,
                activity_id: workItem.activity_id,
                chat_room_id: workItem.proc_inst_id
            };

            return await me.executeInstance(input);

        } catch (error) {
            return error;
        }
    }

    async updateInstanceChat(instanceId: string, newMessage: any, threadId: string = null) {
        try {
            const putObj = {
                id: instanceId,
                uuid: this.uuid(),
                messages: newMessage,
                thread_id: threadId || null
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

    async getInstanceListByRole(roles: string) {
        return this.getInstanceList();
    }
    
    async getInstanceListByGroup(group: string) {
        return null;
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
            const list = await storage.list('todolist', { match: { 'proc_inst_id': instId } });
            const worklist: any[] = list.map((item: any) => {
                return {
                    defId: item.proc_def_id,
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
                    endpoint: item.user_id,
                    assignees: item.assignees || [],
                    adhoc: item.adhoc || false,
                    reference_ids: item.reference_ids || [],
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
    
    async getActivitiesStatus(instId: string, executionScope: String = "0") {
        // instance/{instanceId}/completed
        //TODO: 현재 프로세스 진행상태 추가
        try {
            const list = await storage.list('todolist', { match: { 'proc_inst_id': instId } });
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

    async fireMessage(instanceId: string, event: any) {
        throw new Error("Method not implemented.");
    }

    async dryRun(isSimulate: string, command: object) {
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
            await axios.post(`/execution/role-binding`, {
                "input": {
                    "roles": roles,
                    "email": localStorage.getItem('email')
                }
            })
            .then(res => {
                if (res.data) {
                    const data = JSON.parse(res.data);
                    result = data.roleBindings;
                }
            })
            .catch(error => {
                if (error.detail && error.detail.status_code && error.detail.status_code == 401) {
                    alert('토큰이 만료되었습니다. 다시 로그인 해주세요.');
                }
                return null;
            });
            return result;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchNotifications(onNotification?: (notification: any) => void) {
        try {
            await storage.watchNotifications(`notifications`, (payload) => {
                if (payload && payload.new && payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
                    const notification = payload.new;
                    if (onNotification) {
                        onNotification(notification);
                    }
                }
            });
            
            return true;
        } catch (error) {
            console.error('알림 감시 설정 실패:', error);
            throw error;
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
                sort: 'asc',
                matchArray: {
                    column: 'tenants',
                    values: [window.$tenantName]
                }
            }
            const users = await storage.list('users', options);
            return users
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getGroupList() {
        try {
            const options = {
                match: {
                    key: 'organization'
                }
            }
            const result = await storage.getObject('configuration', options);
            const value = result.value;
            if (value && value.chart && value.chart.children) {
                return value.chart.children;
            } else {
                return [];
            }
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
                    await this.updateUser(userInfo);
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
            const uid: string = localStorage.getItem('uid') || '';
            const tenants = await storage.list('tenants', {
                match: {
                    owner: uid
                }
            });
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
            });;
            return tenant;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setTenant(tenantId: string) {
        try {
            if (!tenantId) {
                return;
            }
            const user: any = await this.getUserInfo();
            if (!user || !user.uid) {
                return false;
            }
            if (user.tenants && !user.tenants.includes(tenantId)) {
                return false;
            }
            const user_id = user.uid;
            const request = {
                input: {
                    user_id: user_id,
                    user_info: {
                        app_metadata: {
                            tenant_id: tenantId
                        }
                    }
                }
            }
            const response = await axios.post('/execution/set-tenant', request);
            if (response.status === 200) {
                const isOwner = await storage.checkTenantOwner(tenantId);
                const role = isOwner ? 'superAdmin' : 'user';
                const isAdmin = isOwner ? true : false;
                await storage.putObject('users', {
                    id: user_id,
                    role: role,
                    is_admin: isAdmin,
                    current_tenant: tenantId
                }, { onConflict: 'id' });

                await storage.refreshSession();
                return await storage.isConnection();
            } else {
                console.log(response);
                return false;
            }
        } catch (error) {
            //@ts-ignore
            // console.log(error);
            return false;
            // throw new Error(error.message);
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
                role: 'superAdmin',
                is_admin: true,
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

    async createUser(userInfo: any) {
        try {
            const request = {
                input: userInfo
            }
            const response = await axios.post('/execution/create-user', request);
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async updateUser(userInfo: any) {
        try {
            const user: any = await this.getUserInfo();
            if (user && user.uid) {
                const user_id = user.uid;
                const request = {
                    input: {
                        user_id: user_id,
                        user_info: userInfo
                    }
                }
                const response = await axios.post('/execution/update-user', request); 
                return response.data;
            }
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

    async uploadImage(fileName: string, image: File) {
        try {
            return await storage.uploadImage(fileName, image);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getImageUrl(fileName: string) {
        try {
            return await storage.getImageUrl(fileName);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadFile(fileName: string, file: File) {
        try {
            const res = await storage.uploadFile(fileName, file);
            if (!res.error && res.fullPath) {
                const indexRes = await this.indexFile(res.fullPath);
                console.log(indexRes);
            }
            return res;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getFileUrl(path: string) {
        try {
            return await storage.getFileUrl(path);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async indexFile(filePath: string) {
        try {
            const response = await axios.post('/memento/index', JSON.stringify({
                path: filePath
            }), {
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getEmbedding(text) {
        const response = await axios.post('/execution/langchain-chat/embeddings', JSON.stringify({
            text: text,
            model: 'text-embedding-3-small',
            vendor: 'openai'
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = response.data;
        return data.embedding;
    }

    async updateVectorStore(content: string, type: string) {
        try {
            const embedding = await this.getEmbedding(content);
            await storage.putObject('documents', {
                id: this.uuid(),
                content: content,
                metadata: {
                    tenant_id: window.$tenantName,
                    type: type
                },
                embedding: embedding
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putUserPermission(permission: any) {
        try {
            await storage.putObject('user_permissions', permission);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteUserPermission(options: any) {
        try {
            await storage.delete('user_permissions', options);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    /**
     * 사용자별 프로세스 권한 체크
     * @param options 
     *  proc_def_id: 프로세스 정의 ID
     *  user_id: 사용자 ID
     * @returns 
     */
    async getUserPermissions(options: any) {
        try {
            let filter: any = {};
            if (options.proc_def_id && options.user_id) {
                filter = {
                    p_user_id: options.user_id,
                    p_proc_def_id: options.proc_def_id
                }
            } else if (options.proc_def_id && !options.user_id) {
                filter = {
                    p_proc_def_id: options.proc_def_id
                }
            }
            const result = await storage.callProcedure('check_process_permission', filter);
            if (result && result.length > 0) {
                return result;
            } else {
                return null;
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async checkUsePermissions() {
        try {
            const permissionCount = await storage.getCount('user_permissions')
            if (permissionCount > 0) {
                return true
            } else {
                return false
            }
        } catch (error) {
            console.log(error)
        }
    }

    async addSampleProcess() {
        try {
            const response = await axios.post('/execution/insert-sample');
            // console.log(response.data);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async createThreadId() {
        try {
            const serverUrl = "http://127.0.0.1:2024";
            const threadRes = await axios.post(`${serverUrl}/threads`, JSON.stringify({}), {
                headers: { "Content-Type": "application/json" },
            });
            const threadData = threadRes.data;
            const currentThreadId = threadData.thread_id;
            return currentThreadId;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async sendMessageWithThreadId(threadId: string, message: string, chatRoomId: string) {
        try {
            const serverUrl = "http://127.0.0.1:2024";
            const assistantId = "agent";

            const runRes = await axios.post(`${serverUrl}/threads/${threadId}/runs`, JSON.stringify({
                    assistant_id: assistantId,
                    input: {
                        messages: [
                            { role: "user", content: message }
                        ]
                    }
                }),
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            const runData = runRes.data;
            const runId = runData.run_id;

            let messages = [];
            const streamRes = await axios.get(`${serverUrl}/threads/${threadId}/runs/${runId}/stream`, {
                headers: { "Content-Type": "application/json" },
            });
            if (streamRes.status === 200) {
                const result = streamRes.data;
                const data = result.split('data: ').pop();
                if (data) {
                    const json = JSON.parse(data);
                    if (json && json.messages) {
                        messages = json.messages;
                    }
                }
            }

            const aiMessage = messages.filter((message: any) => message.type === "ai").pop();
            const newMessage = {
                "name": "system",
                "role": "system",
                "email": "system@uengine.org",
                "image": "",
                "content": aiMessage.content,
                "timeStamp": new Date().toISOString()
            }
            await this.updateInstanceChat(chatRoomId, newMessage, threadId);

            return newMessage;
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async listMarketplaceDefinition() {
        try {
            const options = {
                orderBy: 'import_count',
                sort: 'desc',
            }
            const list = await storage.list('proc_def_marketplace', options);
            return list;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async putTemplateDefinition(definition: any) {
        try {
            const user = await this.getUserInfo();
            if (user && user.uid) {
                const putObj = {
                    id: definition.id,
                    name: definition.name,
                    definition: definition.definition,
                    bpmn: definition.bpmn,
                    description: definition.description,
                    category: definition.category,
                    tags: definition.tags,
                    author_name: user.name,
                    author_uid: user.uid,
                }
                const response = await storage.putObject('proc_def_marketplace', putObj);
                return response;
            } else {
                throw new Error('User not found');
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }
    async duplicateDefinition(definition: any) {
        try {
            // 프로세스 정의 복사
            const putObj = {
                id: definition.id,
                name: definition.name,
                definition: definition.definition,
                bpmn: definition.bpmn,
            }
            const response = await storage.putObject('proc_def', putObj);
            
            if (!response.error) {
                // 프로세스 정의 체계도 업데이트
                const megaId = definition.category.split('/')[0];
                const majorId = definition.category.split('/')[1];
                const newProcessMap = {
                    mega_proc_list: [{
                        id: megaId,
                        name: megaId,
                        major_proc_list: [{
                            id: majorId,
                            name: majorId,
                            sub_proc_list: [{
                                id: definition.id,
                                name: definition.name,
                            }]
                        }]
                    }]
                }
                const existed = await this.getProcessDefinitionMap();
                const merged = await this.mergeProcessMaps(existed, newProcessMap);
                await this.putProcessDefinitionMap(merged);

                // 프로세스 템플릿 카운트 증가
                await storage.putObject('proc_def_marketplace', {
                    uuid: definition.uuid,
                    id: definition.id,
                    import_count: definition.import_count + 1
                });

                return response;
            } else {
                throw new Error(response.error.message);
            }
        } catch (error) {
            if (error && error.cause && error.cause.message && error.cause.message.includes('409 Conflict')) {
                throw new Error('이미 추가된 프로세스입니다.');
            } else {
                throw new Error(error.message);
            }
        }
    }
}

export default ProcessGPTBackend;

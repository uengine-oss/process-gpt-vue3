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

    async listDefinition(path: string, options?: any) {
        try {
            // 프로세스 정보, 폼 정보를 각각 불러와서 파일명을 포함해서 가공하기 위해서
            if (path == 'form_def') {
                let formDefs = await storage.list('form_def', options);
                formDefs.map((item: any) => {
                    item.path = `${item.id}`
                    item.name = item.name || item.path 
                });
                return formDefs
            } else {
                if (options) {
                    options.match = { isdeleted: false }
                    if (path) {
                        options.like = `${path}%`
                    }
                }
                let procDefs = await storage.list('proc_def', options);
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

                await Promise.all([
                    await storage.delete('todolist', { match: { proc_def_id: defId } }),
                    await storage.delete('bpm_proc_inst', { match: { proc_def_id: defId } }),
                ]);
                
                return await storage.delete(`proc_def/${defId}`, { key: 'id' });
                
                // var procDef: any = await storage.getObject('proc_def', {
                //     match: {
                //         id: defId,
                //     }
                // });
                // if (procDef) {
                //     procDef.isdeleted = true;
                //     await storage.putObject('proc_def', procDef);
                // }
            }
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    
    async restoreDefinition(defId: string, options: any) {
        try {
            if (defId.includes('.bpmn')) defId = defId.replace('.bpmn', '');

            var procDef: any = await storage.getObject('proc_def', {
                match: {
                    id: defId,
                }
            });
            if (procDef) {
                procDef.isdeleted = false;
                return await storage.putObject('proc_def', procDef);
            }
        } catch (e) {
            throw new Error(e.message);
        }
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
                        proc_def_id: defId == 'defaultform' ? 'default' : options.proc_def_id,
                        activity_id: defId == 'defaultform' ? 'default' : options.activity_id,
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
            if (!defId) return;
            
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
                    let data = null;
                    // ::TODO: 개정된 프로세스 실행에 대한 작업 완료 후 사용
                    // if (options.version && options.version != '') {
                    //     data = await storage.getString(`proc_def_arcv`, { column: 'snapshot', match: {
                    //         proc_def_id: defId, arcv_id: options.version
                    //     } });
                    // } else {
                        data = await storage.getString(`proc_def`, { column: 'bpmn', match: { id: defId } });
                    // }
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

            if(input.projectId) {
                input['project_id'] = input.projectId
            }

            return await me.executeInstance(input);

        } catch (error) {
            //@ts-ignore
            return error;
        }
    }

    async executeInstance(input: any) {
        try {
            const email = localStorage.getItem('email');
            input.email = email;
            input['tenant_id'] = window.$tenantName;

            let url = `/execution/complete`;
            if (input.answer && input.answer.image != null) {
                url = `/execution/vision-complete`;
            }

            const request = { input };
            const response = await axios.post(url, request, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response && response.data) {
                return response.data;
            } else {
                return null;
            }

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
            // const instance = await storage.getObject('instance', { match: { 'instance_id': instanceId } });
            // if (instance) {
            //     instance.defId = instance.proc_def_id;
            //     instance.instanceId = instanceId;
            //     instance.name = instance.proc_inst_name;
            //     instance.defVer = instance.proc_def_version;
            // }
            return this.returnInstanceObject(instance);
            // return  {
            //     instId: instance.proc_inst_id,
            //     defId: instance.proc_def_id,
            //     name: instance.proc_inst_name,
            //     projectId: instance.project_id,
            //     currentActivityIds: instance.current_activity_ids,
            //     currentUserIds: instance.current_user_ids,
            //     roleBindings: instance.role_bindings,
            //     variables_data: instance.variables_data,
            //     status: instance.status,
            //     tenantId: instance.tenant_id,
            //     startDate: instance.start_date,
            //     endDate: instance.end_date,
            //     dueDate: instance.due_date,
            // };
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getAllInstanceList(page: any, size: any) {
        try {
            const list = await storage.list('bpm_proc_inst');
            return list.map((item: any) => {
                return this.returnInstanceObject(item);
                // return {
                //     instId: item.proc_inst_id,
                //     defId: item.proc_def_id,
                //     name: item.proc_inst_name,
                //     projectId: item.project_id,
                //     currentActivityIds: item.current_activity_ids,
                //     currentUserIds: item.current_user_ids,
                //     roleBindings: item.role_bindings,
                //     variables_data: item.variables_data,
                //     status: item.status,
                //     tenantId: item.tenant_id,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                // }
            })
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async getInstanceByProjectId(projectId: number) {
        try {
            const list = await storage.list('bpm_proc_inst', {match: { 'project_id': projectId } });

            return list.map((item: any) => {
                return this.returnInstanceObject(item);
                // return {
                //     instId: item.proc_inst_id,
                //     defId: item.proc_def_id,
                //     name: item.proc_inst_name,
                //     projectId: item.project_id,
                //     currentActivityIds: item.current_activity_ids,
                //     currentUserIds: item.current_user_ids,
                //     roleBindings: item.role_bindings,
                //     variables_data: item.variables_data,
                //     status: item.status,
                //     tenantId: item.tenant_id,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                // }
            })
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkItem(taskId: string) {
        try {
            if (!taskId) return
            
            const workitem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            let definition: any = null;
            let instance: any = null;

            if (!workitem) {
                return;
            } else if (workitem.proc_def_id) {
                definition = await this.getRawDefinition(workitem.proc_def_id, null);
                if (workitem.proc_inst_id) {
                    instance = await this.getInstance(workitem.proc_inst_id);
                }
            }
            
            let parameters: any[] = [];
            let outParameterContext: any = {
                variable: {
                    name: "",
                }
            };
            let activityInfo: any = null;

            if (definition && definition.definition) {
                activityInfo = definition.definition.activities.find((activity: any) => activity.id === workitem.activity_id);
                if (activityInfo && activityInfo.properties) {
                    const properties = JSON.parse(activityInfo.properties);
                    if (properties.parameters && instance) {
                        parameters = properties.parameters;
                        parameters.forEach((item: any) => {
                            item.variable.defaultValue = instance[item.variable.name.toLowerCase().replace(/ /g, '_')] || "";
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
                    adhoc: workitem.adhoc || false,
                    currentActivities: workitem.adhoc ? [] : (instance && instance.currentActivityIds ? instance.currentActivityIds : [ activityInfo.id ]),
                    defVerId: instance && instance.defVersion ? instance.defVersion : null,
                    output: workitem.output || ""
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
             
            if(options && options.projectId) {
                filter.match.project_id = options.projectId;
            }

            if (options && options.instId) {
                filter.match.proc_inst_id = options.instId;
            } else {
                const email = localStorage.getItem("email");
                filter.match.user_id = email;
            }
            const list = await storage.list('todolist', filter);

            return list.map((item: any) => {
                return this.returnWorkItemObject(item);
                // return {
                //     taskId: item.id,
                //     defId: item.proc_def_id,
                //     endpoint: item.user_id,
                //     instId: item.proc_inst_id,
                //     rootInstId: null,
                //     startDate: item.start_date,
                //     endDate: item.end_date,
                //     dueDate: item.due_date,
                //     status: item.status,
                //     name: item.activity_name || "",
                //     tracingTag: item.activity_id || "",
                //     description: item.description || "",
                //     tool: item.tool || "",
                //     instName: item.proc_inst_name || "",
                //     projectId: item.project_id || null,
                //     adhoc: item.adhoc || false,
                //     output: item.output || ""
                // }
            });
        } catch (error) {
            
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putWorkItem(taskId: string, workItem: any) {
        try {
            // id와 변경할 필드만 포함하여 upsert
            const putObj = { id: taskId, ...workItem };
            return await storage.putObject('todolist', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    
    async putWorklist(taskId: string, workItem: any) {
        try {
            let result: any = null;
            if (!workItem.instId || workItem.status != "DONE") {
                if(workItem.adhoc && !workItem.tool) workItem.tool = 'formHandler:defaultform'; // adhoc 작업인 경우 tool을 defaultform으로 설정
                const putObj = {
                    id: taskId || this.uuid(),
                    proc_def_id: workItem.defId || workItem.defId,
                    user_id: workItem.endpoint || localStorage.getItem('email'),
                    proc_inst_id: workItem.instId || workItem.parent,
                    start_date: workItem.startDate || workItem.startDate,
                    end_date: workItem.endDate || workItem.endDate,
                    due_date: workItem.dueDate || workItem.dueDate,
                    status: workItem.status || workItem.status,
                    activity_id: workItem.tracingTag || workItem.title,
                    activity_name: workItem.title || workItem.name,
                    description: workItem.description || null,
                    reference_ids: workItem.referenceIds || null,
                    tool: workItem.tool || null,
                    adhoc: workItem.adhoc || null,
                    project_id: workItem.projectId || null,
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

    async getBSCard() {
        try {
            const options = {
                match: {
                    key: 'strategy',
                },
                column: 'uuid'
            };
            const card = await storage.getObject(`configuration`, options);
            return card;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    async putBSCard(card: any) {
        try {
            const options = {
                match: {
                    key: 'strategy'
                },
                column: 'uuid'
            };
    
            const existing = await storage.getString('configuration', options);
    
            const uuid = typeof existing === 'string' ? existing : this.uuid();
    
            const putObj = {
                uuid,
                key: 'strategy',
                value: card,
                tenant_id: window.$tenantName
            };
    
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
                const nameAttr = element.getAttribute('name') || '';
                const vModel = element.getAttribute('v-model') || '';
                // v-model 바인딩에서 bracket 표기법으로 키를 추출, 없으면 name 속성을 기본으로 사용
                const bracketMatch = vModel.match(/\[['"](.+?)['"]\]/);
                const key = bracketMatch && bracketMatch[1] ? bracketMatch[1] : nameAttr;
                const tagName = element.tagName.toLowerCase();
                const disabled = element.getAttribute('disabled');
                const readonly = element.getAttribute('readonly');

                let field: any = {
                    text: alias || '',
                    key: key,
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
            'user-select-field', 'report-field', 'slide-field'
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
            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            if (workItem) {
                // const formId = workItem.tool.replace('formHandler:', '');
                if (formDefId) {
                    if(!workItem.output) workItem.output = {}

                    if(formDefId == 'user_input_text') {
                        if(!workItem.output[formDefId]) workItem.output[formDefId] = ''
                        varData = workItem.output
                    } else {
                        if(!workItem.output[formDefId]) workItem.output[formDefId] = {}
                        varData = workItem.output[formDefId]
                    }
                }
            }

            if (varData) {
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

            // if(formDefId == 'user_input_text') { 
            //     if(!varData['user_input_text']) varData['user_input_text'] = varData;
            // }

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

            if (varValue.valueMap) {
                varValue = varValue.valueMap;
            }

            if (varValue._type) {
                delete varValue._type;
            }

            const workItem = await storage.getObject(`todolist/${taskId}`, { key: 'id' });
            if (workItem) {
                if(varName == 'user_input_text') {
                    if(!workItem.output) workItem.output = {}
                    if(!workItem.output[varName]) workItem.output[varName] = ''
                    workItem.output[varName] = varValue[varName]
                } else {
                    if(workItem.adhoc && !workItem.tool) workItem.tool = 'formHandler:defaultform';
                    const formId = workItem.tool.replace('formHandler:', '')
                    if (formId) {
                        if(!workItem.output) workItem.output = {}
                        if(!workItem.output[formId]) workItem.output[formId] = {}
                        workItem.output[formId] = varValue;
                    }    
                }
            }
            await storage.putObject('todolist', workItem);
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

    async fetchInstances(callback: (payload: any) => void) {
        try {
            await storage.watch('bpm_proc_inst', 'bpm_proc_inst', (payload) => {
                if (payload && payload.new && payload.eventType) {
                    const instance = payload.new;
                    if (callback) {
                        callback(this.returnInstanceObject(instance));
                    }
                }
            });

            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async fetchInstanceListByStatus(status: string): Promise<any[]> {
        var me = this
        const list = await storage.list('bpm_proc_inst', { match: { status: status } });
        const email = window.localStorage.getItem("email");
        const filteredData = list.filter((item: any) => item.current_user_ids.includes(email));

        if (filteredData && filteredData.length > 0) {
            return filteredData.map((item: any) => {
                return me.returnInstanceObject(item);
            });
        }
        return [];
    }

    async getInstanceList(options?: any) {
        try {
            var me = this
            if(!options) {
                // 기본 정렬
                options = {
                    orderBy: 'updated_at',
                    sort: 'desc'
                }
            }

            const lists = await storage.list('bpm_proc_inst', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return me.returnInstanceObject(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getInstanceListByStatus(status: string[], options?: any) {
        try {
            var me = this
            if(!options) options = {}
            if(!status) return []
            if(status.includes('*')) status = ['NEW', 'RUNNING', 'DONE', 'PENDING', 'IN_PROGRESS']
            let email = window.localStorage.getItem("email");
            let filter = { 
                inArray: {
                    column: 'status',
                    values: status
                },
                matchArray: {
                    column: 'current_user_ids',
                    values: [email]
                },
                orderBy: 'updated_at',
                sort: 'desc',
                range: null,
                like: null,
            }
        
            if(options) {
                Object.keys(options).forEach((key)=> {
                    filter[key] = options[key]
                })
            }
            return await me.getInstanceList(filter)
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    

    async watchInstanceList(callback: (payload: any) => void){
        try {
            return await storage._watch({
                channel: 'instance',
                table: 'bpm_proc_inst',
                // filter: "status=in.(RUNNING,NEW)"
            },(payload) => {
                let obj = payload
                if(payload.eventType === 'UPDATE'){
                    if(payload.new.status == 'RUNNING'|| payload.new.status == 'NEW') {
                        obj = {id: payload.old.proc_inst_id, value: this.returnInstanceObject(payload.new)}
                    } else {
                        obj = {id: payload.old.proc_inst_id, value: null}
                    }
                } else if(payload.eventType === 'INSERT'){
                    obj = {id: payload.new.proc_inst_id, value: this.returnInstanceObject(payload.new)}
                } else if(payload.eventType === 'DELETE'){
                    obj = {id: payload.old.proc_inst_id, value: null}
                }
                callback(obj);
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getInstanceListByRole(roles: string) {
        // return this.getInstanceList();
        return this.getInstanceListByStatus(["NEW", "RUNNING"]);
    }
    
    async getInstanceListByGroup(group: string) {
        return null;
    }

    async getCompleteInstanceList(filter) {
        try {
            return this.getInstanceListByStatus(["COMPLETED"]);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getWorkListByInstId(instId: number) {
        try {
            const list = await storage.list('todolist', { match: { 'proc_inst_id': instId } });
            const worklist: any[] = list.map((item: any) => {
                return this.returnWorkItemObject(item);
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
                } else if(item.status == 'IN_PROGRESS' || item.status == 'SUBMITTED') {
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

    async putInstance(instId: string, instItem: any) {
        try {
            return await storage.putObject('bpm_proc_inst', {
                proc_inst_id: instId || this.uuid(),
                proc_def_id: instItem.procDefId,
                proc_def_version: instItem.procDefVersion,
                proc_inst_name: instItem.name,
                current_activity_ids: instItem.currentActivityIds || [],
                current_user_ids: instItem.currentUserIds || [],
                role_bindings: instItem.roleBindings || [],
                variables_data: instItem.variablesData || [],
                status: instItem.status,
                tenant_id: instItem.tenantId || 'localhost',
                start_date: instItem.startDate,
                end_date: instItem.endDate,
                due_date: instItem.dueDate,
                project_id: instItem.projectId,
            });
                
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
                if (payload && payload.new && payload.eventType === "INSERT") { // || payload.eventType === "UPDATE"
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

    async getNotifications(callback: (data: any) => void) {
        try {
            const uid = localStorage.getItem('uid');
            await storage.watch('notifications', `notifications-${uid}`, (data: any) => {
                if(data && data.new) {
                    callback(data);
                }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async fetchNotifications() {
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

            notifications = notifications.filter((item: any) => !item.is_checked);
            return notifications;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async setNotifications(value: any) {
        try {
            if (value.count > 1) {
                const notifications = await this.fetchNotifications();
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

    async search(keyword: string, callback?: (results: any[]) => void) {
        try {
            let results: any[] = [];

            const dbPromise = storage.search(keyword);
            const vectorPromise = this.searchVector(keyword);

            results.push({
                type: 'loading',
                header: '유사한 결과 검색 중...',
                list: []
            });
            const dbResult = await dbPromise;
            results = [...results, ...dbResult];
            
            if (callback) {
                callback(results);
            }

            vectorPromise.then(async (vectorResult) => {
                if (vectorResult && vectorResult.length > 0) {
                    const procDefs = await storage.list('proc_def', { match: { isdeleted: false } });
                    let list = procDefs.filter((item: any) => vectorResult.includes(item.id));
                    list = list.map((item: any) => {
                        return {
                            title: item.name,
                            href: `/definitions/${item.id}`,
                            matches: [item.bpmn]
                        }
                    });
                    if (list.length > 0) {
                        const loadingIndex = results.findIndex(item => item.type === 'loading');
                        if (loadingIndex !== -1) {
                            results.splice(loadingIndex, 1, {
                                type: 'similar-definition',
                                header: '유사한 프로세스 정의',
                                list: list
                            });
                        }
                    }
                }
                const newResults = results.filter((item: any) => item.type !== 'loading');
                if (callback) {
                    callback(newResults);
                }
            }).catch(error => {
                console.error('Vector search error:', error);
                const newResults = results.filter((item: any) => item.type !== 'loading');
                if (callback) {
                    callback(newResults);
                }
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async searchVector(keyword: string) {
        try {
            let list = [];
            const response = await axios.post('/execution/process-search', {
                query: keyword
            });
            let vectorResult = response.data;
            if (vectorResult && vectorResult.length > 0) {
                vectorResult = vectorResult.map((item: any) => {
                    const matchingColumns = item.page_content.split(": ");
                    const content = JSON.parse(matchingColumns[1]);
                    return content.processDefinitionId;
                });
            }

            const uniqueList = vectorResult.filter((item, index, self) => {
                if (item) {
                    return index === self.findIndex((t) => (
                        t === item
                    ))
                }
            });
            return uniqueList;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserAllTenants() {
        try {
            const uid: string = localStorage.getItem('uid') || '';
            const options = {
                orderBy: 'username',
                sort: 'asc',
                match: {
                    id: uid
                }
            }
            const users = await storage.list('users', options);
            return users
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getUserList(options: any) {
        try {
            if(!options) options = {}

            let filter = {
                orderBy: 'username',
                sort: 'asc',
                match: {
                    tenant_id: window.$tenantName
                }
            }
            if(options) {
                Object.keys(options).forEach((key)=> {
                    filter[key] = options[key]
                })
            }

            return await storage.list('users', filter);
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

    async getAgentList() {
        try {
            const list = await storage.list('agents');
            return list;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getAgent(agentId: string) {
        try {
            const options = {
                match: {
                    id: agentId
                }
            }
            const agent = await storage.getObject('agents', options);
            return agent;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async putAgent(newAgent: any) {
        try {
            const putObj: any = {
                id: newAgent.id,
                name: newAgent.name,
                role: newAgent.role,
                goal: newAgent.goal,
                persona: newAgent.persona,
                url: newAgent.url,
                description: newAgent.description,
                tools: newAgent.tools,
                profile: newAgent.img,
                skills: newAgent.skills,
                tenant_id: window.$tenantName
            }
            await storage.putObject('agents', putObj);
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteAgent(agentId: string) {
        try {
            await storage.delete('agents', { match: { id: agentId } });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async fetchAgentData(url: string) {
        try {
            const response = await axios.get(`/execution/multi-agent/fetch-data?agent_url=${encodeURIComponent(url)}`);
            return response.data;
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
                value.user.tenant_id = window.$tenantName;
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
                    tenant_id: window.$tenantName
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
            var putObj: any = { 
                id: lockObj.id, 
                user_id: lockObj.user_id 
            };
            const lock = await this.getLock(lockObj.id);
            if(lock && lock.tenant_id === window.$tenantName) {
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
                const putObj: any = {
                    id: user_id,
                    role: isOwner ? 'superAdmin' : 'user',
                    tenant_id: tenantId
                }
                if (isOwner) {
                    putObj.is_admin = true;
                }
                await storage.putObject('users', putObj, { onConflict: 'id' });
                await storage.refreshSession();
                return await storage.isConnection();
            } else {
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
            await storage.putObject('users', {
                id: user.uid,
                email: user.email,
                username: user.name,
                role: 'superAdmin',
                is_admin: true,
                tenant_id: tenantId
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

    async inviteUser(userInfo: any) {
        try {
            const request = {
                input: userInfo
            }
            const response = await axios.post('/execution/invite-user', request);
            if (response.status === 200) {
                if (response.data) {
                    return response.data;
                } else {
                    const newUser = await storage.getObject('users', {
                        match: {
                            email: userInfo.email,
                            tenant_id: userInfo.tenant_id
                        }
                    });
                    return { user: newUser };
                }
            } else {
                return { error: true, message: response.data.message };
            }
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
                if (response.data) {
                    return response.data;
                } else {
                    const newUser = await storage.getObject('users', {
                        match: {
                            email: userInfo.email,
                            tenant_id: window.$tenantName
                        }
                    });
                    return { user: newUser };
                }
            } else {
                return { error: true, message: response.data.message };
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

    async uploadFile(fileName: string, file: File, storageType: string, options?: any) {
        try {
            let response: any;
            if (storageType === 'drive') {
                response = await this.uploadFileToDrive(fileName, file, options);
            } else {
                storageType = 'storage';
                response = await this.uploadFileToStorage(fileName, file);
            }

            if (!response.error) {
                const indexRes = await this.processFile(response, storageType);
                console.log(indexRes);
                return response;
            } else {
                return response;
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async uploadFileToStorage(fileName: string, file: File) {
        try {
            const response = await storage.uploadFile(fileName, file);
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async uploadFileToDrive(fileName: string, file: File, options?: any) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_name', fileName);
            formData.append('tenant_id', window.$tenantName);

            const token = localStorage.getItem('accessToken');
            const response = await axios.post('/memento/save-to-drive', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 200) {
                if (options && options.chat_room_id) {
                    const putObj = {
                        id: response.data.file_id,
                        file_name: response.data.file_name,
                        file_path: response.data.download_link,
                        chat_room_id: options.chat_room_id,
                        user_name: options.user_name,
                        tenant_id: window.$tenantName
                    }
                    await storage.putObject('chat_attachments', putObj);
                }
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            if (error && error.error && error.error == 'authentication_required') {
                location.href = error.auth_url;
                return { error: true, message: 'authentication_required' };
            } else {
                //@ts-ignore
                throw new Error(error.message);
            }
        }
    }

    async getDriveInfo() {
        try {
            const response = await storage.getObject('tenant_oauth', {
                match: {
                    tenant_id: window.$tenantName
                }
            });
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveDriveInfo(driveInfo: any) {
        try {
            driveInfo.id = driveInfo.provider + '_' + driveInfo.tenant_id;
            const response = await storage.putObject('tenant_oauth', driveInfo);
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getFileUrl(path: string, options?: any) {
        try {
            if (options && options.storageType == 'drive') {
                const filePath = await storage.getString('chat_attachments', {
                    column: 'file_path',
                    match: {
                        id: path,
                        tenant_id: window.$tenantName
                    }
                });
                if (filePath) {
                    return filePath;
                } else {
                    return null;
                }
            } else {
                return await storage.getFileUrl(path);
            }
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async downloadFile(path: string) {
        try {
            return await storage.downloadFile(path);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async processFile(file: any, storageType: string) {
        try {
            let file_path = '';
            let original_filename = '';
            if (storageType == 'storage') {
                file_path = file.fullPath.replace('files/', '');
                original_filename = file.original_filename;
            } else {
                file_path = file.file_name;
                original_filename = file.file_name;
            }

            const token = localStorage.getItem('accessToken');
            const response = await axios.post('/memento/process', {
                file_path: file_path,
                original_filename: original_filename,
                storage_type: storageType,
                tenant_id: window.$tenantName
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getAttachments(chatRoomId: string, callback: (attachment: any) => void) {
        await storage.watch('chat_attachments', chatRoomId, (payload) => {
            if (payload && payload.new && payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
                const attachment = payload.new;
                if (callback) {
                    callback(attachment);
                }
            }
        });

        if (callback) {
            const attachments = await storage.list('chat_attachments', {
                match: {
                    chat_room_id: chatRoomId
                }
            });
            if (attachments && attachments.length > 0) {
                for (const attachment of attachments) {
                    callback(attachment);
                }
            }
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

    async listMarketplaceDefinition(tagOrKeyword?: string, isSearch: boolean = false) {
        try {
            const options = {
                orderBy: 'import_count',
                sort: 'desc',
            }
            const list = await storage.list('proc_def_marketplace', options);
            
            // 검색 기능이 활성화된 경우
            if (isSearch && tagOrKeyword && tagOrKeyword.trim() !== '') {
                const keyword = tagOrKeyword.toLowerCase().trim();
                return list.filter(item => {
                    // 이름, 작성자, 태그 검색
                    const nameMatch = item.name && item.name.toLowerCase().includes(keyword);
                    const authorMatch = item.author_name && item.author_name.toLowerCase().includes(keyword);
                    
                    // 태그 검색
                    let tagMatch = false;
                    if (item.tags) {
                        const tags = item.tags.split(',').map((t: string) => t.trim().toLowerCase());
                        tagMatch = tags.some(tag => tag.includes(keyword));
                    }
                    
                    return nameMatch || authorMatch || tagMatch;
                });
            }
            // 태그 필터링
            else if (tagOrKeyword && tagOrKeyword !== 'all') {
                return list.filter(item => {
                    if (!item.tags) return false;
                    const tags = item.tags.split(',').map((t: string) => t.trim());
                    return tags.includes(tagOrKeyword);
                });
            }
            
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
                    image: definition.image
                }
                const response = await storage.putObject('proc_def_marketplace', putObj);

                if (!response.error) {
                    const formList = await storage.list('form_def', {
                        match: {
                            proc_def_id: definition.id,
                            tenant_id: window.$tenantName
                        }
                    });
                    if (formList && formList.length > 0) {
                        for (const form of formList) {
                            const formObj = {
                                id: form.id,
                                proc_def_id: definition.id,
                                activity_id: form.activity_id,
                                html: form.html,
                                author_uid: user.uid
                            }
                            const formResponse = await storage.putObject('form_def_marketplace', formObj);
                            if (formResponse.error) {
                                console.log(formResponse.error);
                            }
                        }
                    }

                    return response;
                } else {
                    throw new Error('User not found');
                }
            } else {
                throw new Error('User not found');
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }
    async duplicateDefinition(definition: any) {
        try {
            // Supabase function을 사용하여 프로세스 정의 복사
            const result = await storage.callProcedure('duplicate_definition_from_marketplace', {
                p_definition_id: definition.id,
                p_definition_name: definition.name,
                p_author_uid: definition.author_uid
            });

            if (result && result.success) {
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

                return result;
            }
            
            throw new Error('Failed to duplicate definition');
        } catch (error) {
            if (error && error.cause && error.cause.message && error.cause.message.includes('409 Conflict')) {
                throw new Error('이미 추가된 프로세스입니다.');
            } else {
                throw new Error(error.message);
            }
        }
    }

    async getTaskLog(taskId: string, callback: (payload: any) => void) {
        try {
            await storage.watch('todolist', taskId, (payload) => {
                if (payload && payload.new && payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
                    const task = payload.new;
                    if (callback) {
                        callback(task);
                    }
                }
            });

            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async saveTask(id: string, name: string, type: string, json: any) {
        console.warn("method is not implemented only use PalModeBackend");
        return null;
    }
    
    async getRefForm(taskId: string) {
        try {
            const refForms = [];
            const workItem = await storage.getObject('todolist', { match: { id: taskId } });

            if (workItem && workItem.proc_def_id && workItem.reference_ids && workItem.reference_ids.length > 0) {
                const formPromises = workItem.reference_ids.map(async (referenceId: string) => {
                    const prevWorkItem = await storage.getObject('todolist', {
                        match: {
                            proc_inst_id: workItem.proc_inst_id,
                            activity_id: referenceId
                        }
                    });
                    
                    if (prevWorkItem && prevWorkItem.proc_inst_id && prevWorkItem.activity_id) {
                        const formId = prevWorkItem.tool.split('formHandler:')[1];
                        const [form, formData] = await Promise.all([
                            this.getRawDefinition(formId, { type: 'form' }),
                            this.getVariableWithTaskId(workItem.proc_inst_id, prevWorkItem.id, formId)
                        ]);
                        return {
                            name: prevWorkItem.activity_name,
                            html: form,
                            formData: formData.valueMap
                        };
                    }
                    return null;
                });

                const results = await Promise.all(formPromises);
                refForms.push(...results.filter(result => result !== null));
            }
            
            return refForms;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getTaskList() {
        console.warn("method is not implemented only use PalModeBackend");
        return null;
    }

    //////////////////////////////////////////////////////// PROJECT ////////////////////////////////////////////////////////
    async fetchProjectByStatus(status: string): Promise<any[]> {
        var me = this
        const list = await storage.list('project', { match: { status: status } });

        if(!list) return [];
        if(!Array.isArray(list)) return [];

        return list.map((item: any) => {
            return me.returnProjectObject(item);
        });
    }

    async putProject(project: any) {
        try {
            return await storage.putObject('project', {
                project_id: project.projectId || this.uuid(),
                name: project.name || 'Untitled Project',
                start_date: project.startDate || new Date().toISOString(),
                end_date: project.endDate || null,
                due_date: project.dueDate || null,
                status: project.status || "NEW",
                created_date: project.createdDate || new Date().toISOString(),
                user_id: project.userId || localStorage.getItem('email'),
                tenant_id: window.$tenantName
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }


    async getProjectList(options?: any) {
        try {
            var me = this
            if(!options) {
                // 기본 정렬
                options = {
                    orderBy: 'updated_at',
                    sort: 'desc'
                }
            }

            const lists = await storage.list('project', options);
            if (lists && lists.length > 0) {
                return lists.map((item: any) => {
                    return me.returnProjectObject(item);
                });
            }
            return [];
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getProjectListByStatus(status: string[], options?: any) {
        try {
            var me = this
            if(!options) options = {}
            if(!status) return []
            if(status.includes('*')) status = ['NEW', 'RUNNING', 'DONE', 'PENDING', 'IN_PROGRESS']
            let email = window.localStorage.getItem("email");
            let filter = { 
                inArray: {
                    column: 'status',
                    values: status
                },
                orderBy: 'updated_at',
                sort: 'desc',
                range: null,
                like: null,
            }
        
            if(options) {
                Object.keys(options).forEach((key)=> {
                    filter[key] = options[key]
                })
            }
            return await me.getProjectList(filter)
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async watchOff(ref: any){
        try {
            return await storage._watch_off(ref);
        }catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    async watchProjectList(callback: (payload: any) => void){
        try {
            return await storage._watch({
                channel: 'project',
                table: 'project'
            },(payload) => {
                let obj = payload
                if(payload.eventType === 'UPDATE'){
                    obj = {id: payload.old.project_id, value: this.returnProjectObject(payload.new)}
                } else if(payload.eventType === 'INSERT'){
                    obj = {id: payload.new.project_id, value: this.returnProjectObject(payload.new)}
                } else if(payload.eventType === 'DELETE'){
                    obj = {id: payload.old.project_id, value: null}
                }
                callback(obj);
            });
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getProjectById(projectId: number) {
        try {
            const list = await storage.list('project', {match: { 'project_id': projectId } });
            let project = list && list.length > 0 ? list[0] : null;
            if(!project) return null;
            return this.returnProjectObject(project)
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }


    async getTaskDependencyByProjectId(projectId: number) {
        try {
            let list = await storage.list('v_task_dependency', {
                key: `*`,
                orderBy: 'project_id',
                startAt: projectId,
                endAt: projectId,
            });

            return list.map((item: any) => {
                return this.returnDependencyObject(item);
            });
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async getTaskDependencyByInstId(instId: number) {
        try {
            let list = await storage.list('v_task_dependency', {
                key: `*`,
                orderBy: 'proc_inst_id',
                startAt: instId,
                endAt: instId,
            });

            return list.map((item: any) => {
                return this.returnDependencyObject(item);
            });
        } catch (e) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }


    async putTaskDependency(item: any) {
        try {
            return await storage.putObject('task_dependency', item);     
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    async deleteTaskDependency(id: string) {
        try {
            return await storage.delete('task_dependency', { match: { id: id } });     
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }

    // 백엔드로 보낼 날짜 포맷 함수
    formatDateForBackend(date, isEndDate) {
        if (!date) return;
        let year, month, day;

        if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date)) {
            // '일-월-연도' 형식
            const [d, m, y] = date.split('-');
            year = y;
            month = m.padStart(2, '0');
            day = d.padStart(2, '0');
        } else {
            // Date 객체 또는 ISO 문자열 등
            const d = new Date(date);
            year = d.getFullYear();
            month = String(d.getMonth() + 1).padStart(2, '0');
            day = String(d.getDate()).padStart(2, '0');
        }

        const time = isEndDate ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}.000Z`;
    }

    async isColumnValueExists(table: string, key: string, value: string) {
        try {
            return !!await storage.list(table, {
                orderBy: key,
                startAt: value,
                endAt: value,
                maybeSingle: true
            });     
        } catch (error) {
            //@ts-ignore
            throw new Error(error.message);
        }
    }
    
    private returnProjectObject(item: any) {
        return {
            projectId: item.project_id,
            name: item.name,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            createdDate: item.created_date,
            status: item.status,
            tenantId: item.tenant_id,
            updatedAt: item.updated_at
        }
    }

    private returnInstanceObject(item: any) {
        if (!item || !item.proc_inst_id) return null;
        return {
            instId: item.proc_inst_id,
            defId: item.proc_def_id,
            defVersion: item.proc_def_version,
            name: item.proc_inst_name,
            projectId: item.project_id,
            currentActivityIds: item.current_activity_ids,
            currentUserIds: item.current_user_ids,
            roleBindings: item.role_bindings,
            variables_data: item.variables_data,
            status: item.status,
            tenantId: item.tenant_id,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            updatedAt: item.updated_at
        }
    }

    private returnWorkItemObject(item: any) {
        return {
            defId: item.proc_def_id,
            instId: item.proc_inst_id,
            rootInstId: item.proc_inst_id,
            taskId: item.id,
            startDate: item.start_date,
            endDate: item.end_date,
            dueDate: item.due_date,
            status: item.status,
            name: item.activity_name,
            tool: item.tool || '',
            tracingTag: item.activity_id || '',
            description: item.description || '',
            endpoint: item.user_id,
            assignees: item.assignees || [],
            adhoc: item.adhoc || false,
            referenceIds: item.reference_ids || [],
            projectId: item.project_id || null,
            updatedAt: item.updated_at,
            task: item
        }
    }

    private returnDependencyObject(item: any) {
        return {
           ...item,
           lagTime: item.lag_time,
           leadTime: item.lead_time,
           createdDate: item.created_date,
           taskId: item.task_id,
           dependsId: item.depends_id,
           projectId: item.project_id,
           procInstId: item.proce_inst_id
        }
    }

    async getMCPTools() {
        try {
            const response = await axios.get('/execution/mcp-tools');
            return response.data;
        } catch (error) {
            throw new Error(error.message);
        }
    }
    
}

export default ProcessGPTBackend;

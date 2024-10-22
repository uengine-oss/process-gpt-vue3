import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend } from './Backend';

class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    async getUserList() {
        return [];
    }

    async getNotifications() {
        // Placeholder implementation
        return [];
    }

    async setNotifications(value: any) {
        // Placeholder implementation
    }

    async search(keyword: string) {
        // Placeholder implementation
        return [];
    }
    // Process Definition Service Impl API
    async listDefinition(basePath: string) {
        let url = '/definition';
        if (basePath) url += `?basePath=${basePath}`;

        const response = await axiosInstance.get(url);
        return response.data?._embedded?.definitions;
    }
    async listVersionDefinitions(version: string, basePath: string) {
        const response = await axiosInstance.get(`/version/${version}/definition/?basePath=${basePath}`);
        return response.data;
    }
    async listVersions() {
        const response = await axiosInstance.get('/version');
        return response.data;
    }
    async versionUp(version: string, major: boolean, makeProduction: boolean) {
        const response = await axiosInstance.post('/version', null);
        return response.data;
    }
    async makeProduction(version: string) {
        const response = await axiosInstance.post(`/version/${version}/production`);
        return response.data;
    }
    async getProduction() {
        const response = await axiosInstance.get('/version/production');
        return response.data;
    }

    async getDefinitionVersions(defId: string, options: any) {
        if (options.key) {
            if (options.key.includes('version')) {
                const response = await axiosInstance.get(`/versions/${defId}.${options.type}`, options);
                console.log(response);
                return response.data?._embedded?.definitions;
            } else if (options.key == 'snapshot') {
                options.version = options?.match?.version;
                const response = await this.getRawDefinition(`definitions/${defId}`, options);
                return [{ snapshot: response }];
            }
        } else {
            const response = await axiosInstance.get(`/versions/${defId}.${options.type}`, options);
                console.log(response);
                return response.data?._embedded?.definitions;
        }
    }
    async getVersion(version: string) {
        const response = await axiosInstance.get(`/version/${version}`);
        return response.data;
    }
    async renameOrMove(definition: any, requestPath: string) {
        const response = await axiosInstance.put(requestPath, definition);
        return response.data;
    }
    async deleteDefinition(requestPath: string) {
        const response = await axiosInstance.delete('/definition/' + requestPath);
        return response.data;
    }
    async deleteInstance(instanceId: string) {
        const response = await axiosInstance.delete(`/instance/${instanceId}`);
        return response.data;
    }
    async releaseVersion(releaseName: string): Promise<any> {
        const response = await axiosInstance.get(`/definition/release/${releaseName}`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${releaseName}.zip`); // or any other extension
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    async putRawDefinition(definition: any, requestPath: string, options: any) {
        console.log(options);
        var config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        let body = {
            definition: definition,
            version: options.releaseName ? options.releaseName : options.version
        };
        const response = await axiosInstance.put('/definition/raw/' + requestPath + '.' + options.type, body, config);
        return response.data;
    }
    // @ts-ignore
    async getRawDefinition(defPath: string, options) {
        let path = `/definition/raw/${defPath}.${options.type}`;
        if(options.version) {
            path = path + `/version/${options.version}`
        }
        const response = await axiosInstance.get(path, options);
        return response.data;

    }

    // Process Service Impl API
    async start(command: object) {
        console.log(command)
        const response = await axiosInstance.post('/instance', command);
        return response.data;
    }

    async findCurrentWorkItemByInstId(instId: string) {
        const response = await axiosInstance.get(`/instance/${instId}/running`);
        return response.data;
    }

    async stop(instanceId: string) {
        const response = await axiosInstance.post(`/instance/${instanceId}/stop`);
        return response.data;
    }

    async suspend(instanceId: string) {
        const response = await axiosInstance.post(`/instance/${instanceId}/suspend`);
        return response.data;
    }

    async resume(instanceId: string) {
        const response = await axiosInstance.post(`/instance/${instanceId}/resume`);
        return response.data;
    }

    async getInstance(instanceId: string) {
        const response = await axiosInstance.get(`/instance/${instanceId}`);
        if (!response) return null;

        let _links = response.data._links;
        let def_href = _links.definition.href;
        let def_id = def_href.split('/definition/')[1];

        // parse defId
        response.data.defId = def_id;

        return response.data;
    }

    async backToHere(instanceId: string, tracingTag: string) {
        const response = await axiosInstance.post(`/instance/${instanceId}/activity/${tracingTag}/backToHere`);
        return response.data;
    }

    async getProcessVariables(instanceId: string) {
        const response = await axiosInstance.get(`/instance/${instanceId}/variables`);
        return response.data;
    }

    async getVariable(instId: string, varName: string) {
        const response = await axiosInstance.get(`/instance/${instId}/variable/${varName}`);
        return response.data;
    }
    async getVariableWithTaskId(instId: string, taskId: string, varName: string) {
        const response = await axiosInstance.get(`/instance/${instId}/task/${taskId}/variable/${varName}`);
        return response.data;
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        var config = {
            headers: {
                'Content-Type': 'text/plain'
            },
            responseType: 'text' as const
        };

        const response = await axiosInstance.post(`/instance/${instanceId}/variable/${varName}`, JSON.stringify(varValue), config);
        return response.data;
    }

    async setVariableWithTaskId(instanceId: string, taskId: string, varName: string, varValue: any) {
        var config = {
            headers: {
                'Content-Type': 'text/plain'
            },
            responseType: 'text' as const
        };

        const response = await axiosInstance.post(
            `/instance/${instanceId}/task/${taskId}/variable/${varName}`,
            JSON.stringify(varValue),
            config
        );
        return response.data;
    }

    async getRoleMapping(instId: string, roleName: string) {
        const response = await axiosInstance.get(`/instance/${instId}/role-mapping/${roleName}`);
        return response.data;
    }

    async setRoleMapping(instanceId: string, roleName: string, roleMapping: any) {
        const response = await axiosInstance.post(`/instance/${instanceId}/role-mapping/${roleName}`, roleMapping);
        return response.data;
    }

    async signal(instanceId: string, signal: string) {
        const response = await axiosInstance.post(`/instance/${instanceId}/signal/${signal}`);
        return response.data;
    }

    async serviceMessage(requestPath: string) {
        const response = await axiosInstance.post(requestPath);
        return response.data;
    }

    async getWorkItem(taskId: string) {
        const response = await axiosInstance.get(`/work-item/${taskId}`);
        return response.data;
    }
    async putWorkItem(taskId: string, workItem: any) {
        const response = await axiosInstance.post(`/work-item/${taskId}/save`, workItem);
        return response.data;
    }

    async fireMessage(instanceId: string, message: any) {
        const response = await axiosInstance.post(`/instance/${instanceId}/fire-message`, { event: 'event', payload: message });
        return response.data;
    }

    async putWorkItemComplete(taskId: string, workItem: any, isSimulate: string) {
        let config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
        const response = await axiosInstance.post(`/work-item/${taskId}/complete`, workItem, config);
        return response.data;
    }
    // async putWorkItemComplete(taskId: string, workItem: any, isSimulate: boolean) {
    //     const headers = {
    //         'isSimulate': isSimulate ? 'true' : 'false'
    //     };
    //     const response = await axiosInstance.post(`/work-item/${taskId}/complete`, workItem, {headers});
    //     return response.data;
    // }

    async testList(path: string) {
        const response = await axiosInstance.get(`/test/${path}`);
        return response.data;
    }

    async getEventList(instanceId: string) {
        const response = await axiosInstance.get(`/instance/${instanceId}/eventList`);
        return response.data;
    }

    async putWorklist(taskId: string, workItem: any) {
        let url = `/worklist`;
        if (typeof taskId === 'number') url += `/${taskId}`;
        console.log(workItem);
        let task;
        if (workItem.task) {
            task = workItem.task;
            if (workItem.status) task.status = workItem.status;
            const response = await axiosInstance.put(url, task);
            return response.data;
        } else {
            task = {
                endpoint: workItem.endpoint,
                title: workItem.title,
                description: workItem.description,
                status: workItem.status,
                startDate: workItem.startDate,
                dueDate: workItem.dueDate
            };
            const response = await axiosInstance.post(url, task);
            return response.data;
        }
        // let test = {
        //     instId: 1,
        //     title: 'Task_b',
        //     description: null,
        //     endpoint: 'manager',
        //     roleName: 'initiator',
        //     refRoleName: 'null',
        //     resName: 'Initiator',
        //     defId: 'sales/testLaneProcess.xml',
        //     defName: 'Noname',
        //     trcTag: 'Task_b',
        //     tool: 'defaultHandler',
        //     parameter: null,
        //     priority: 1,
        //     startDate: '2024-04-17',
        //     endDate: null,
        //     saveDate: null,
        //     dueDate: '2024-04-22',
        //     status: 'NEW',
        //     dispatchOption: 0,
        //     dispatchParam1: null,
        //     prevUserName: null,
        //     rootInstId: 1,
        //     readDate: null,
        //     actType: null,
        //     absTrcTag: null,
        //     delegated: null,
        //     urget: null,
        //     execScope: null,
        //     ext1: null,
        //     ext2: null,
        //     ext3: null,
        //     ext4: null,
        //     ext5: null,
        //     _links: {
        //         self: {
        //             href: 'http://localhost:9094/worklist/2'
        //         },
        //         worklistEntity: {
        //             href: 'http://localhost:9094/worklist/2'
        //         },
        //         processInstance: {
        //             href: 'http://localhost:9094/worklist/2/processInstance'
        //         }
        //     }
        // };
        // workItem.task.status = workItem.status;
    }

    async postMessage(instanceId: string, message: any) {
        const response = await axiosInstance.post(`/instance/${instanceId}/message`, message);
        return response.data;
    }
    async getWorkListAll() {
        const response = await axiosInstance.get(`/worklist`);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        let result = response.data._embedded.worklist;
        return result;
    }
    // WorkListRepository API
    async getWorkList() {
        const response = await axiosInstance.get(`/worklist/search/findToDo`);

        if (!response.data) return null;
        if (!response.data._embedded) return null;
        let mappedResult = response.data._embedded.worklist.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: parseInt(task._links.self.href.split('/').pop()),
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));

        return mappedResult;
    }

    async getWorkListByInstId(instId: number) {
        const response = await axiosInstance.get(`/worklist/search/findWorkListByInstId`, { params: { instId: instId } });

        if (!response.data) return null;
        if (!response.data._embedded) return null;
        let mappedResult = response.data._embedded.worklist.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: parseInt(task._links.self.href.split('/').pop()),
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            tracingTag: task.trcTag,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));

        return mappedResult;
    }

    // get Completed WorkList API
    async getCompletedList(options?: any) {
        let basePath = '/worklist/search/findCompleted';
        if (!options) options = {};
        if (!options.page) options.page = 0;
        if (!options.size) options.size = 20;
        // if(!options.sort) options.sort = 'startDate,DESC'

        const response = await axiosInstance.get(`${basePath}?page=${options.page}&size=${options.size}`);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        return response.data._embedded.worklist.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: parseInt(task._links.self.href.split('/').pop()),
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            tracingTag: task.trcTag,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));
    }

    async getPendingList() {
        const response = await axiosInstance.get(`/worklist/search/findPending`);

        if (!response.data) return null;
        if (!response.data._embedded) return null;
        let mappedResult = response.data._embedded.worklist.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: parseInt(task._links.self.href.split('/').pop()),
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            tracingTag: task.trcTag,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));

        return mappedResult;
    }
    async getInProgressList() {
        const response = await axiosInstance.get(`/worklist/search/findInProgress`);

        if (!response.data) return null;
        if (!response.data._embedded) return null;
        let mappedResult = response.data._embedded.worklist.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: parseInt(task._links.self.href.split('/').pop()),
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            tracingTag: task.trcTag,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));

        return mappedResult;
    }
    async getDefinition(defPath: string) {
        const response = await axiosInstance.get(`/definition/${defPath}`);
        return response.data;
    }

    async createFolder(newResource: any, requestPath: string) {
        const response = await axiosInstance.post(`/definition/${requestPath}`, newResource);
        return response.data;
    }

    async getProcessDefinitionMap() {
        const response = await axiosInstance.get(`/definition/map`);
        return response.data;
    }

    async putProcessDefinitionMap(definitionMap: any) {
        definitionMap = JSON.stringify(definitionMap);
        const response = await axiosInstance.put(`/definition/map`, definitionMap, { headers: { 'Content-Type': 'text/plain' } });
        return response.data;
    }

    async getAllInstanceList(page: any, size: any) {
        const response = await axiosInstance.get(`/instances/search/findAll?page=${page}&size=${size}`);
        return response.data._embedded.instances;
    }

    // Running Instance API
    async getInstanceList() {
        // return [];
        const response = await axiosInstance.get(`/instances/search/findFilterICanSee?status=Running`);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        return response.data._embedded.instances.map((inst: any) => ({
            instId: inst.rootInstId,
            instName: inst.name,
            status: inst.status,
            startedDate: inst.startedDate,
            defId: inst.defId
        }));
    }
    
    // 관리자 페이지 필터링 관련  API
    async getFilteredInstanceList(filters: object, page: number, size: number) {
        const queryParams = new URLSearchParams();
        queryParams.append('page', page.toString());
        queryParams.append('size', size.toString()); // size 추가
    
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                queryParams.append(key, value as string);
            }
        });
    
        const request = `/instances/search/findFilterICanSee?${queryParams.toString()}`
        const response = await axiosInstance.get(request);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        return {
            instances: response.data._embedded.instances.map((inst: any) => ({
                instId: inst.rootInstId,
                instName: inst.name,
                status: inst.status,
                startedDate: inst.startedDate,
                finishedDate: inst.finishedDate,
                defId: inst.defId,
                initEp: inst.initEp,
                subProcess: inst.subProcess
            })),
            totalElements: response.data.page.totalElements, // totalElements 반환
            totalPages: response.data.page.totalPages,  // totalPages 반환
            currentPage: response.data.page.number      // currentPage 반환
        };
    }

    // Complate Instance API
    async getCompleteInstanceList() {
        const response = await axiosInstance.get(`/instances/search/findFilterICanSee?status=Completed`);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        return response.data._embedded.instances.map((inst: any) => ({
            instId: inst.rootInstId,
            instName: inst.name,
            status: inst.status,
            startedDate: inst.startedDate,
            defId: inst.defId
        }));
    }

    async getCompletedTaskId(instId: string) {
        // instance/{instanceId}/completed
        const response = await axiosInstance.get(`/instance/${instId}/completed`);

        return response.data;
    }

    async getActivitiesStatus(instId: string) {
        // instance/{instanceId}/completed
        const response = await axiosInstance.get(`/instance/${instId}/status`);

        return response.data;
    }

    async dryRun(defPath: String, isSimulate: string) {
        let config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
        const response = await axiosInstance.get(`/dry-run/${defPath}`, config);
        // const response = await axiosInstance.get(encodeURI(`/dry-run/${defPath}`));
        // const response = await axiosInstance.get(encodeURI(`/dry-run/${encodeURIComponent(defPath.toString())}`));

        if (!response.data) return null;
        return response.data;
    }

    async startAndComplete(command: object, isSimulate: string) {
        let config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
        const response = await axiosInstance.post(`/start-and-complete`, command, config);

        return response.data;
    }

    async putSystem(system: any) {
        const response = await axiosInstance.put(`/definition/system/${system.name}`, system);
        return response.data;
    }

    async deleteSystem(system: any) {
        try {
            const response = await axiosInstance.delete(`/definition/system/${system.name}`);
            return response.data;
        } catch (error) {
            alert(`시스템 삭제 중 오류 발생: ${error}`);
            throw error;
        }
    }

    async getSystemList() {
        const response = await axiosInstance.get(`/definition/system`);
        if (response.data._embedded.definitions.length > 0) return response.data._embedded.definitions;
        return null;
    }
    // async getSystemList() {
    //     const response = await axiosInstance.get(`/definition/system`);
    //     return response.data._embedded.definitions;
    // }

    async getSystem(systemId: String) {
        const response = await axiosInstance.get(`/definition/system/${systemId}`);
        return response.data;
    }

    async getCurrentWorkItemByCorrKey(corrKey: number) {
        const response = await axiosInstance.get(`/work-item?corrKey=${corrKey}`);
    }

    async validate(xml: string) {
        const response = await axiosInstance.post(`/validate`, xml);
        if (!response.data) return {};
        return response.data;
    }

    async uploadDefinition(file: File, path: string) {
        const formData = new FormData();
        formData.append('file', file);

        const config = {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        };

        try {
            const response = await axiosInstance.post('/definition/upload', formData, config);
            return response.data;
        } catch (error) {
            console.error('파일 업로드 중 오류 발생:', error);
            throw error;
        }
    }

    async downloadFile(filePath: string) {
        try {
            const response = await axiosInstance.get(`/download?path=${encodeURIComponent(filePath)}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filePath.split('/').pop() || 'downloaded_file');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('파일 다운로드 중 오류 발생:', error);
            throw error;
        }
    }

    async deleteTest(path: string, tracingTag: string, index: number): Promise<any> {
        const response = await axiosInstance.delete(`/test/${path}`, {
            data: { tracingTag: tracingTag, idx: index }
        });
        return response.data;
    }

    async checkDBConnection() {
        return true;
    }

    async getOpenAIToken(){
        return window.localStorage.getItem('openAIToken') || null;
    }
}

export default UEngineBackend;
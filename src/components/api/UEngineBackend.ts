import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend } from './Backend';

class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    // Process Definition Service Impl API
    async listDefinition(basePath: string) {
        let url = '/definition';
        if (basePath) url += `?basePath=${basePath}`;

        const response = await axiosInstance.get(url);
        return response.data._embedded.definitions;
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
    async putRawDefinition(definition: any, requestPath: string, options: any) {
        let req = {
            definition: definition
        };
        var config = {
            headers: {
                'Content-Type': 'text/plain'
            },
            responseType: 'text' as const
        };
        const response = await axiosInstance.put('/definition/raw/' + requestPath + '.' + options.type, definition, config);
        return response.data;
    }
    async getRawDefinition(defPath: string, options) {
        const response = await axiosInstance.get(`/definition/raw/${defPath}.${options.type}`);
        return response.data;
    }

    // Process Service Impl API
    async start(command: object) {
        const response = await axiosInstance.post('/instance', command);
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
        const response = await axiosInstance.post(`/work-item/${taskId}`, workItem);
        return response.data;
    }

    async putWorkItemComplate(taskId: string, workItem: any) {
        const response = await axiosInstance.post(`/work-item/${taskId}/complate`, workItem);
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
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            task: task
        }));

        return mappedResult;
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

    // Running Instance API
    async getInstanceList() {
        return [];
        // const response = await axiosInstance.get(`/instances/search/findFilterICanSee`);
        // return response.data;
    }

    // Complate Instance API
    async getCompleteInstanceList() {
        return [];
        const response = await axiosInstance.get(`/instances/search/findFilterICanSee`);
        return response.data;
    }
}

export default UEngineBackend;

import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend } from './Backend';

class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    // Process Definition Service Impl API
    async listDefinition(basePath: string) {
        try {
            let url = '/definition';
            if (basePath) url += `?basePath=${basePath}`;

            const response = await axiosInstance.get(url);
            return response.data._embedded.definitions;
        } catch (e) {
            alert(e);
        }
    }
    async listVersionDefinitions(version: string, basePath: string) {
        try {
            const response = await axiosInstance.get(`/version/${version}/definition/?basePath=${basePath}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async listVersions() {
        try {
            const response = await axiosInstance.get('/version');
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async versionUp(version: string, major: boolean, makeProduction: boolean) {
        try {
            const response = await axiosInstance.post('/version', null);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async makeProduction(version: string) {
        try {
            const response = await axiosInstance.post(`/version/${version}/production`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async getProduction() {
        try {
            const response = await axiosInstance.get('/version/production');
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async getVersion(version: string) {
        try {
            const response = await axiosInstance.get(`/version/${version}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async renameOrMove(definition: any, requestPath: string) {
        try {
            const response = await axiosInstance.put(requestPath, definition);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async deleteDefinition(requestPath: string) {
        try {
            const response = await axiosInstance.delete('/definition/' + requestPath);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async putRawDefinition(definition: any, requestPath: string) {
        try {
            let req = {
                definition: definition
            };
            var config = {
                headers: {
                    'Content-Type': 'text/plain'
                },
                responseType: 'text' as const
            };
            const response = await axiosInstance.put('/definition/raw/' + requestPath + '.xml', definition, config);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async getRawDefinition(defPath: string) {
        try {
            const response = await axiosInstance.get(`/definition/raw/${defPath}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    // Process Service Impl API
    async start(command: object) {
        try {
            const response = await axiosInstance.post('/instance', command);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async stop(instanceId: string) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/stop`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async suspend(instanceId: string) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/suspend`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async resume(instanceId: string) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/resume`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getInstance(instanceId: string) {
        try {
            const response = await axiosInstance.get(`/instance/${instanceId}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async backToHere(instanceId: string, tracingTag: string) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/activity/${tracingTag}/backToHere`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getProcessVariables(instanceId: string) {
        try {
            const response = await axiosInstance.get(`/instance/${instanceId}/variables`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getVariable(instId: string, varName: string) {
        try {
            const response = await axiosInstance.get(`/instance/${instId}/variable/${varName}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async setVariable(instanceId: string, varName: string, varValue: any) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/variable/${varName}`, null, { params: { varValue } });
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getRoleMapping(instId: string, roleName: string) {
        try {
            const response = await axiosInstance.get(`/instance/${instId}/role-mapping/${roleName}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async setRoleMapping(instanceId: string, roleName: string, roleMapping: any) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/role-mapping/${roleName}`, roleMapping);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async signal(instanceId: string, signal: string) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/signal/${signal}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async serviceMessage(requestPath: string) {
        try {
            const response = await axiosInstance.post(requestPath);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getWorkItem(taskId: string) {
        try {
            const response = await axiosInstance.get(`/work-item/${taskId}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async putWorkItem(taskId: string, workItem: any) {
        try {
            const response = await axiosInstance.post(`/work-item/${taskId}`, workItem);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async putWorklist(taskId: string, workItem: any) {
        try {
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
        } catch (e) {
            alert(e);
        }
    }

    async postMessage(instanceId: string, message: any) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/message`, message);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    // WorkListRepository API
    async getWorkList() {
        try {
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
        } catch (e) {
            alert(e);
        }
    }

    async getPendingList() {
        try {
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
        } catch (e) {
            alert(e);
        }
    }
    async getInProgressList() {
        try {
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
        } catch (e) {
            alert(e);
        }
    }
    async getDefinition(defPath: string) {
        try {
        } catch (e) {}
        const response = await axiosInstance.get(`/definition/${defPath}`);
        return response.data;
    }

    async createFolder(newResource: any, requestPath: string) {
        try {
        } catch (e) {}
        const response = await axiosInstance.post(`/definition/${requestPath}`, newResource);
        return response.data;
    }

    async getProcessDefinitionMap() {
        try {
            const response = await axiosInstance.get(`/definition/map`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async putProcessDefinitionMap(definitionMap: any) {
        try {
            definitionMap = JSON.stringify(definitionMap);
            const response = await axiosInstance.put(`/definition/map`, definitionMap, { headers: { 'Content-Type': 'text/plain' } });
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
}

export default UEngineBackend;

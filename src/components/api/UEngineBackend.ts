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
            const response = await axiosInstance.get(`/definition?basePath=${basePath}`);
            return response.data;
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
            const response = await axiosInstance.post('/version', null, { params: { version, major, makeProduction } });
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
            const response = await axiosInstance.get(`/worklist/search/findTodo`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
}

export default UEngineBackend;

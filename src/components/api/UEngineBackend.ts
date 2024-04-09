import axios from 'axios';
const axiosInstance = axios.create();
import * as Backend from './Backend';
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
    async versionUp(version: string, major: string, makeProduction: boolean) {
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
    async deleteDefinition(requestPath) {
        try {
            const response = await axiosInstance.delete('/definition/' + requestPath);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async putRawDefinition(definition, requestPath) {
        try {
            let req = {
                definition: definition
            };
            var config = {
                headers: {
                    'Content-Type': 'text/plain'
                },
                responseType: 'text'
            };
            const response = await axiosInstance.put('/definition/raw/' + requestPath + '.xml', definition, config);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async getRawDefinition(defPath) {
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

    async stop(instanceId) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/stop`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async suspend(instanceId) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/suspend`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async resume(instanceId) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/resume`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getInstance(instanceId) {
        try {
            const response = await axiosInstance.get(`/instance/${instanceId}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async backToHere(instanceId, tracingTag) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/activity/${tracingTag}/backToHere`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getProcessVariables(instanceId) {
        try {
            const response = await axiosInstance.get(`/instance/${instanceId}/variables`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getVariable(instId, varName) {
        try {
            const response = await axiosInstance.get(`/instance/${instId}/variable/${varName}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async setVariable(instanceId, varName, varValue) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/variable/${varName}`, null, { params: { varValue } });
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getRoleMapping(instId, roleName) {
        try {
            const response = await axiosInstance.get(`/instance/${instId}/role-mapping/${roleName}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async setRoleMapping(instanceId, roleName, roleMapping) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/role-mapping/${roleName}`, roleMapping);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async signal(instanceId, signal) {
        try {
            const response = await axiosInstance.post(`/instance/${instanceId}/signal/${signal}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async serviceMessage(requestPath) {
        try {
            const response = await axiosInstance.post(requestPath);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async getWorkItem(taskId) {
        try {
            const response = await axiosInstance.get(`/work-item/${taskId}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async putWorkItem(taskId, workItem) {
        try {
            const response = await axiosInstance.post(`/work-item/${taskId}`, workItem);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }

    async postMessage(instanceId, message) {
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

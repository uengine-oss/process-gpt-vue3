import axios from 'axios';
const axiosInstance = axios.create();
import * as Backend from './Backend';
export class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    // Process Definition Service Impl API
    async listDefinition(basePath) {
        try {
            const response = await axiosInstance.get(`/definition?basePath=${basePath}`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async listVersionDefinitions(version, basePath) {
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
    async versionUp(version, major, makeProduction) {
        try {
            const response = await axiosInstance.post('/version', null, { params: { version, major, makeProduction } });
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async makeProduction(version) {
        try {
            const response = await axiosInstance.post(`/version/${version}/production`);
            return response.data;
        } catch (e) {
            alert(e);
        }
    }
    async getProduction() {
        try {

        } catch (e) {

        }
        const response = await axiosInstance.get('/version/production');
        return response.data;
    }
    async getVersion(version) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/version/${version}`);
        return response.data;
    }
    async getDefinition(defPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition/${defPath}`);
        return response.data;
    }
    async renameOrMove(definition, requestPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.put(requestPath, definition);
        return response.data;
    }
    async createFolder(newResource, requestPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/definition/requestPath`, newResource);
        return response.data;
    }
    async deleteDefinition(requestPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.delete(requestPath);
        return response.data;
    }
    async putRawDefinition(definition, requestPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.put(requestPath, definition);
        return response.data;
    }
    async getRawDefinition(defPath) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition_raw/${defPath}`);
        return response.data;
    }
    async getXMLDefinition(defPath, production) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition/xml/${defPath}?production=${production}`);
        return response.data;
    }

    // Process Service Impl API
    async start(command) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post('/instance', command);
        return response.data;
    }

    async stop(instanceId) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/stop`);
        return response.data;
    }

    async suspend(instanceId) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/suspend`);
        return response.data;
    }

    async resume(instanceId) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/resume`);
        return response.data;
    }

    async getInstance(instanceId) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/instance/${instanceId}`);
        return response.data;
    }

    async backToHere(instanceId, tracingTag) {
        const response = await axiosInstance.post(`/instance/${instanceId}/activity/${tracingTag}/backToHere`);
        return response.data;
    }

    async getProcessVariables(instanceId) {
        const response = await axiosInstance.get(`/instance/${instanceId}/variables`);
        return response.data;
    }

    async getVariable(instId, varName) {
        const response = await axiosInstance.get(`/instance/${instId}/variable/${varName}`);
        return response.data;
    }

    async setVariable(instanceId, varName, varValue) {
        const response = await axiosInstance.post(`/instance/${instanceId}/variable/${varName}`, null, { params: { varValue } });
        return response.data;
    }

    async getRoleMapping(instId, roleName) {
        const response = await axiosInstance.get(`/instance/${instId}/role-mapping/${roleName}`);
        return response.data;
    }

    async setRoleMapping(instanceId, roleName, roleMapping) {
        const response = await axiosInstance.post(`/instance/${instanceId}/role-mapping/${roleName}`, roleMapping);
        return response.data;
    }

    async signal(instanceId, signal) {
        const response = await axiosInstance.post(`/instance/${instanceId}/signal/${signal}`);
        return response.data;
    }

    async serviceMessage(requestPath) {
        const response = await axiosInstance.post(requestPath);
        return response.data;
    }

    async getWorkItem(taskId) {
        const response = await axiosInstance.get(`/work-item/${taskId}`);
        return response.data;
    }

    async putWorkItem(taskId, workItem) {
        const response = await axiosInstance.post(`/work-item/${taskId}`, workItem);
        return response.data;
    }

    async postMessage(instanceId, message) {
        const response = await axiosInstance.post(`/instance/${instanceId}/message`, message);
        return response.data;
    }
    // WorkListRepository API
    async getWorkList() {
        const response = await axiosInstance.get(`/worklist/search/findTodo`);
        return response.data;
    }
}

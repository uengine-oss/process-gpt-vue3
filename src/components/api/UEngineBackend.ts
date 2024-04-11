import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend } from './Backend'; // Import the interface instead of the namespace
export class UEngineBackend implements Backend {
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

        } catch (e) {

        }
        const response = await axiosInstance.get('/version/production');
        return response.data;
    }
    async getVersion(version: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/version/${version}`);
        return response.data;
    }
    async getDefinition(defPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition/${defPath}`);
        return response.data;
    }
    async renameOrMove(definition: any, requestPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.put(requestPath, definition);
        return response.data;
    }
    async createFolder(newResource: any, requestPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/definition/requestPath`, newResource);
        return response.data;
    }
    async deleteDefinition(requestPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.delete(requestPath);
        return response.data;
    }
    async putRawDefinition(definition: any, requestPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.put(requestPath, definition);
        return response.data;
    }
    async getRawDefinition(defPath: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition_raw/${defPath}`);
        return response.data;
    }
    async getXMLDefinition(defPath: string, production: boolean) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.get(`/definition/xml/${defPath}?production=${production}`);
        return response.data;
    }

    // Process Service Impl API
    async start(command: any) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post('/instance', command);
        return response.data;
    }

    async stop(instanceId: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/stop`);
        return response.data;
    }

    async suspend(instanceId: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/suspend`);
        return response.data;
    }

    async resume(instanceId: string) {
        try {

        } catch (e) {
            
        }
        const response = await axiosInstance.post(`/instance/${instanceId}/resume`);
        return response.data;
    }

    async getInstance(instanceId: string) {
        try {

        } catch (e) {
            
        }
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
        const response = await axiosInstance.post(`/instance/${instanceId}/variable/${varName}`, null, { params: { varValue } });
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

    async postMessage(instanceId: string, message: any) {
        const response = await axiosInstance.post(`/instance/${instanceId}/message`, message);
        return response.data;
    }
    // WorkListRepository API
    async getWorkList() {
        const response = await axiosInstance.get(`/worklist/search/findTodo`);
        return response.data;
    }
}

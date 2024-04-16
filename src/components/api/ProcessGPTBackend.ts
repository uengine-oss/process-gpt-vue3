import axios from '@/utils/axios';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import type { Backend } from './Backend';

class ProcessGPTBackend implements Backend {

    async listDefinition(path: string) {
        try {
            path = 'proc_def'
            const data = await storage.list(path);
            return data;
        } catch (error) {
            throw new Error('error in listDefinition');
        }
    }

    async listVersionDefinitions(version: string, basePath: string) {
        //
    }

    async listVersions() {
        //
    }

    async deleteDefinition(defId: string) {
        try {
            return await storage.delete(`proc_def/${defId}`, { key: 'id' });
        } catch (error) {
            throw new Error('error in deleteDefinition');
        }
    }

    async putRawDefinition(xml: any, defId: string, options: any) {
        try {
            const procDef: any = {
                id: defId,
                name: options.name,
                bpmn: xml,
                definition: options.definition,
            }
            await storage.putObject('proc_def', procDef);

            const procDefArcv: any = {
                arcv_id: options.arcv_id,
                version: options.version,
                name: options.name,
                proc_def_id: defId,
                snapshot: xml,
                diff: options.diffs,
                timeStamp: options.timeStamp
            }
            await storage.putObject('proc_def_arcv', procDefArcv);

            await storage.delete(`lock/${defId}`, { key: 'id' });
            
            await axios.post('/process-db-schema/invoke', {
                "input": {
                    "process_definition_id": defId
                }
            }).then(res => {
                return res
            }).catch(error => {
                return error
            });
        } catch (e) {
            throw new Error('error in putRawDefinition');
        }
    }

    async getRawDefinition(defId: string) {
        try {
            const options = {
                match: {
                    id: defId
                }
            };
            const data = await storage.getObject('proc_def', options);
            return data;
        } catch (error) {
            throw new Error('error in getRawDefinition');
        }
    }

    async start(input: any) {
        try {
            var result: any = null;
            var url = '/complete/invoke';
            if (input.image != null) {
                url = '/vision-complete/invoke';
            }
            
            var req = {
                input: input
            };

            await axios.post(url, req).then(async res => {
                if (res.data) {
                    const data = res.data;
                    if (data.output) {
                        result = data.output;
                    }
                }
            })
            .catch(error => {
                return error;
            });

            return result;
        } catch (error) {
            throw new Error('error in start');
        }
    }
    
    async getInstance(instanceId: string) {
        try {
            const definitionId = instanceId.split('.')[0];
            const options = {
                match: {
                    proc_inst_id: instanceId
                }
            };
            const data = await storage.getObject(definitionId, options);
            return data;
        } catch (error) {
            throw new Error('error in getInstance');
        }
    }

    async getWorkItem(taskId: string) {
        try {
            const options = {
                match: {
                    id: taskId
                }
            };
            const data = await storage.getObject('todolist', options);
            return data;
        } catch (error) {
            throw new Error('error in getWorkItem');
        }
    }

    async getWorkList() {
        try {
            const email = localStorage.getItem("email");
            const options = {
                match: {
                    user_id: email
                }
            };
            const data = await storage.list('todolist', options);
            return data;

        } catch (error) {
            throw new Error('error in getWorkList');
        }
    }
    async getProcessDefinitionMap() {
        const procMap = await storage.getObject('configuration/proc_map', { key: 'key' });
        if (procMap && procMap.value) {
            return procMap.value;
        }
        // return await storage.getObject('proc_map', { key: 'key' });
    }
    async putProcessDefinitionMap(definitionMap: any) {
        const putObj = {
                key: 'proc_map',
                value: definitionMap
        }
        await storage.putObject('configuration', putObj);
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
    
    async suspend(instanceId: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async resume(instanceId: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async backToHere(instanceId: string, tracingTag: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async getProcessVariables(instanceId: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async getVariable(instId: string, varName: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async setVariable(instanceId: string, varName: string, varValue: any): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async getRoleMapping(instId: string, roleName: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async setRoleMapping(instanceId: string, roleName: string, roleMapping: any): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async signal(instanceId: string, signal: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async serviceMessage(requestPath: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async putWorkItem(taskId: string, workItem: any): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async postMessage(instanceId: string, message: any): Promise<any> {
        throw new Error("Method not implemented.");
    }
}

export default ProcessGPTBackend;

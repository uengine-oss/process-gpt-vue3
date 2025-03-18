import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import ProcessGPTBackend from './ProcessGPTBackend';
import axios from 'axios';
const axiosInstance = axios.create();

class PalModeBackend extends ProcessGPTBackend  {


    async dryRun(isSimulate: string, command: object) {
        // command를 object json으로 변경
        let config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
        
        //@ts-ignore
        command.authToken = localStorage.getItem('sb-127-auth-token') ? JSON.parse(localStorage.getItem('sb-127-auth-token')).access_token : null;
        const response = await axiosInstance.post(`/dry-run`, command, config);
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
    
    async listDefinition(path: string) {
        try {
            // 프로세스 정보, 폼 정보를 각각 불러와서 파일명을 포함해서 가공하기 위해서
            let procDefs = await storage.list('proc_def', (path ? { like: `${path}%` } : undefined));
            procDefs.map((item: any) => {
                item.path = `${item.id}`
                item.name = item.name || item.path 
                item.isDeleted = item.isDeleted || false
            });
            return procDefs
        } catch (e) {
            
            //@ts-ignore
            throw new Error(e.message);
        }
    }
    async deleteDefinition(defId: string, options: any): Promise<boolean | undefined> {
        try {
            const uuid = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'uuid' });
            await storage.putString(`proc_def`, 
                [{uuid: uuid, id: defId, isDeleted: true}],  { onConflict: "uuid" });
            return true;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
        }
    }

    async restoreDefinition(defId: string, options: any): Promise<boolean | undefined> {
        try {
            const uuid = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'uuid' });
            await storage.putString(`proc_def`, 
                [{uuid: uuid, id: defId, isDeleted: false}],  { onConflict: "uuid" });
            return true;
        } catch (e) {
            //@ts-ignore
            throw new Error(e.message);
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
                if (options.type === "form") {
                    if (defId.includes('/')) defId = defId.replace(/\//g, "#")
                    const data = await storage.getString(`form_def/${defId}`, { key: 'id', column: 'html' });
                    if (!data) {
                        return null;
                    }
                    return data;
                } else if (options.type === "bpmn") {
                    if (defId.includes('/')) defId = defId.replace(/\//g, "_")
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'bpmn' });
                    if (!data) {
                        return null;
                    }
                    return data;
                } else if (options.type === "deleted") {
                    const data = await storage.getString(`proc_def/${defId}`, { key: 'id', column: 'isDeleted' });
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

}

export default PalModeBackend;

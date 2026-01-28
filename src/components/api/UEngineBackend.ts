import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend } from './Backend';
import { businessRuleToDmnXml, dmnXmlToBusinessRule } from '@/utils/businessRuleDmn';

// uEngine 모드에서 ProcessGPT 전용(또는 미지원) 메서드 호출 시
// - null/undefined 반환으로 인해 호출부에서 NPE(예: .forEach, .path 접근) 나는 걸 방지하기 위해
// - 안전한 기본값을 반환하고, "다른 모드 전용 기능이라 추후 개발 가능" 경고를 1회만 출력한다.
const __uEngineWarnedUnsupported = new Set<string>();
function __warnUnsupported(methodName: string) {
    if (__uEngineWarnedUnsupported.has(methodName)) return;
    __uEngineWarnedUnsupported.add(methodName);
    // eslint-disable-next-line no-console
    console.warn(
        `[uEngine] '${methodName}' 는 다른 모드(ProcessGPT/Pal 등)에서 추가된 기능일 수 있어 현재 uEngine 모드에서는 스킵합니다. (추가 개발 가능성 있음)`
    );
}

// uEngine API 호출 시 인증 토큰을 자동으로 첨부한다.
// - uEngine 모드에서 Keycloak 토큰은 localStorage.accessToken(또는 localStorage.keycloak)에 저장됨
// - Authorization 헤더가 없으면 서버에서 principal/userId/scopes가 null로 떨어져 worklist 조회가 비게 됨
axiosInstance.interceptors.request.use(
    (config) => {
        // NOTE:
        // - 현재 코드베이스에서는 Supabase 세션도 localStorage 'accessToken'을 사용하고 있어(uEngine Keycloak 토큰과 키 충돌)
        //   uEngine API 호출에 Supabase JWT가 실릴 수 있다.
        // - 따라서 uEngine 모드에서는 keycloak 토큰을 최우선으로 사용한다.
        const token =
            (typeof window !== 'undefined' && (window as any).$mode === 'uEngine'
                ? (localStorage.getItem('keycloak') || localStorage.getItem('accessToken'))
                : (localStorage.getItem('accessToken') || localStorage.getItem('keycloak')));
        if (token) {
            // Axios v1에서는 config.headers 타입이 AxiosHeaders일 수 있어 단순 {} 할당이 타입에러를 유발할 수 있음
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyConfig = config as any;
            anyConfig.headers = anyConfig.headers ?? {};
            anyConfig.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    async fetchAgentData(url: string) {
        __warnUnsupported('fetchAgentData');
        return {};
    }

    async getMCPTools() {
        __warnUnsupported('getMCPTools');
        return {};
    }

    async getMCPByTenant() {
        // 호출부가 configuredData?.mcpServers / Object.keys(configuredData) 등을 사용하므로
        // null 대신 안전한 빈 객체 반환
        __warnUnsupported('getMCPByTenant');
        return {};
    }

    async setMCPByTenant(mcp: any) {
        __warnUnsupported('setMCPByTenant');
        return { ok: false };
    }

    async watchNotifications(callback: (notification: any) => void) {
        // 호출부에서 unsubscribe 함수를 기대할 수 있어 noop 반환
        __warnUnsupported('watchNotifications');
        return () => {};
    }

    async getRefForm(taskId: string) {
        // WorkItem.vue 에서 refForms.forEach(...) 를 호출하므로 배열 반환이 안전
        __warnUnsupported('getRefForm');
        return [];
    }
    async listMarketplaceDefinition() {
        __warnUnsupported('listMarketplaceDefinition');
        return [];
    }

    /**
     * Process-GPT 모드 전용 API들과의 인터페이스 호환을 위한 stub 구현
     * (uEngine 모드에서는 지원하지 않으므로 안전한 기본값을 리턴)
     */
    async getAgentList(options?: any) {
        return [];
    }

    async watchInstanceList(callback: (payload: any) => void, options?: any) {
        // uEngine 모드에서는 실시간 구독을 제공하지 않음
        // 호출 측에서 watchRef를 저장하므로, 해제 함수 형태로 반환
        return () => {};
    }

    async getCreditBalance() {
        // ExtraBox.vue에서 credit.available.toFixed(2)를 호출하므로 기본 구조 제공
        return {
            available: 0,
            used: 0,
            total: 0
        };
    }

    async watchCreditUsage(callback: (payload: any) => void) {
        // uEngine 모드에서는 크레딧 사용량 구독을 제공하지 않음
        return () => {};
    }

    /**
     * 재작업(리워크) 기능은 ProcessGPT 모드 전용.
     * 칸반/WorkItem UI에서 enableRework를 호출하므로, uEngine에서는 안전하게 false를 반환한다.
     */
    async enableRework(workItem?: any): Promise<boolean> {
        return false;
    }

    async getReworkActivities(options?: any): Promise<any> {
        // uEngine 모드에서는 재작업 액티비티 목록을 제공하지 않음
        return { reference: [], all: [] };
    }

    async reWorkItem(item?: any): Promise<any> {
        // uEngine 모드에서는 재작업 실행을 제공하지 않음
        __warnUnsupported('reWorkItem');
        return { ok: false };
    }

    /**
     * Process-GPT 스토리지 계층 호환용 API (uEngine 모드에서는 미지원)
     * - 호출부에서 null 체크를 하는 케이스가 많아 기본값은 null/false로 둠
     */
    async getData(path: string, options?: any) {
        __warnUnsupported('getData');
        // 호출부에서 null-check 하는 케이스가 많지만, 안전하게 빈 객체로 반환
        return {};
    }

    async putObject(path: string, obj: any, options?: any) {
        __warnUnsupported('putObject');
        return { ok: false };
    }

    async updateUser(userInfo: any) {
        __warnUnsupported('updateUser');
        return { ok: false };
    }

    async getTenant(tenantId: string) {
        __warnUnsupported('getTenant');
        return {};
    }

    async setTenant(tenantId: string) {
        __warnUnsupported('setTenant');
        return { ok: false };
    }

    async uploadImage(fileName: string, image: File) {
        __warnUnsupported('uploadImage');
        // Chat.vue 에서 data.path 사용 → 최소 path 제공
        return { path: null };
    }

    async getImageUrl(fileName: string) {
        __warnUnsupported('getImageUrl');
        // imageUrl 을 기대 → null 대신 빈 문자열
        return '';
    }

    async uploadFile(fileName: string, file: File, storageType: string) {
        __warnUnsupported('uploadFile');
        // FileField.vue 에서 res.path 체크 → path 키는 제공
        return { path: null };
    }

    async getFileUrl(path: string) {
        __warnUnsupported('getFileUrl');
        // URL(string)로 쓰는 곳이 있어 빈 문자열 반환
        return '';
    }

    async getUserList(options: any) {
        return [
            {
                id: 1,
                profile: null,
                username: 'hong',
                email: 'hong@uengine.io',
                is_admin: true
            },
            {
                id: 2,
                profile: null,
                username: 'lee',
                email: 'lee@uengine.io',
                is_admin: true
            },
            {
                id: 3,
                profile: null,
                username: 'kim',
                email: 'kim@uengine.io',
                is_admin: true
            }
        ];
    }

    async getGroupList() {
        return [];
    }

    async setNotifications(value: any) {
        // Placeholder implementation
        __warnUnsupported('setNotifications');
        return { ok: false };
    }
    async search(keyword: string) {
        let url = '/definition';
        let result = [];

        // 데이터 요청
        const response = await axiosInstance.get(url);
        const definitions = response.data?._embedded?.definitions;

        // 데이터 변환
        const formattedData = {
            type: "definition",
            header: "프로세스 정의",
            list: definitions
                .map((definition: any) => ({
                    title: definition.name,
                    href: `/definitions/${encodeURIComponent(definition.path)}`,
                    matches: [
                        definition.name,
                        definition.path,
                        definition._links?.raw?.href || ""
                    ].filter(Boolean), // 유효한 값만 포함
                }))
                .filter((item: any) =>
                    item.title.includes(keyword) ||
                    item.href.includes(keyword) ||
                    item.matches.some((match: string) => match.includes(keyword))
                ) // keyword가 title, href, matches 셋 중 아무거나 포함되면 필터링
        };

        result.push(formattedData);
        return result;
    }

    // Process Definition Service Impl API
    async listDefinition(basePath: string) {
        let url = '/definition';
        if (basePath) url += `?basePath=${basePath}`;

        const response = await axiosInstance.get(url);
        let data = response?.data;

        // 서버 구현에 따라 동일 endpoint가 "HAL object" 또는 "JSON string"을 반환할 수 있어 방어적으로 처리한다.
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // 그대로 둠
            }
        }

        // HAL 형태: _embedded 아래 배열 key가 'definitions'가 아닐 수 있으므로 첫 번째 배열을 탐색한다.
        if (data && data._embedded) {
            if (Array.isArray(data._embedded.definitions)) return data._embedded.definitions;
            const embedded = data._embedded;
            const firstArrayKey = Object.keys(embedded).find((k) => Array.isArray(embedded[k]));
            if (firstArrayKey) return embedded[firstArrayKey];
        }

        // 일부 구현은 그냥 배열을 반환할 수 있다.
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.content)) return data.content;

        return [];
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

    async restoreDefinition(defId: string, options: any): Promise<boolean | undefined> {
        return false;
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
        if (options.type == 'deleted') return null;
        let path = `/definition/raw/${defPath}.${options.type}`;
        if (options.version) {
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

    async testRecordList(path: string) {
        const response = await axiosInstance.get(`/test/${path}/record`);
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
    async getWorkList(options?: any) {
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
            adhoc: task.adhoc,
            task: task,
        }));

        if (options && options.instId !== undefined && options.instId !== null && options.instId !== '') {
            const rawInstId = options.instId;
            const instId =
                typeof rawInstId === 'number'
                    ? rawInstId
                    : parseInt(String(rawInstId).replace(/_DOT_/g, '.'), 10);

            if (!Number.isNaN(instId)) {
                mappedResult = mappedResult.filter((w: any) => {
                    const wInstId = typeof w.instId === 'number' ? w.instId : parseInt(String(w.instId), 10);
                    const wRootInstId =
                        typeof w.rootInstId === 'number' ? w.rootInstId : parseInt(String(w.rootInstId), 10);
                    return wInstId === instId || wRootInstId === instId;
                });
            }
        }

        return mappedResult;
    }

    // 해당 인스턴스의 할당된 업무
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
            adhoc: task.adhoc,
            task: task
        }));

        return mappedResult;
    }

    // 해당 인스턴스의 모든 업무 가져오기
    async getAllWorkListByInstId(instId: number) {
        const response = await axiosInstance.get(`/instance/${instId}/worklists`);

        if (!response.data) return null;
        let mappedResult = response.data.map((task: any) => ({
            defId: task.defId,
            endpoint: task.endpoint,
            instId: task.instId,
            rootInstId: task.rootInstId,
            taskId: task.taskId,
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            title: task.title,
            tool: task.tool,
            tracingTag: task.trcTag,
            description: task.description || '', // description이 null일 경우 빈 문자열로 처리
            adhoc: task.adhoc,
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
            adhoc: task.adhoc,
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
            adhoc: task.adhoc,
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
            adhoc: task.adhoc,
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

    async getMetricsMap() {
        return null;
    }

    async putMetricsMap(metricsMap: any) {
        return null;
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
            instId: inst._links.self.href.split('/').pop(),
            instName: inst.name,
            status: inst.status,
            startedDate: inst.startedDate,
            defId: inst.defId
        }));
    }

    async getInstanceListByRole(roles: string, names: string) {
        if (!roles && !names) {
            return this.getInstanceList();
        }
        let patternText = '';
        if (roles) {
            let pattern = roles
                .split(',')
                .map(item => {
                    const trimmedItem = item.trim();
                    return `(^|,)${trimmedItem}(,|$)|^${trimmedItem}$`;
                })
                .join('|');
            patternText += `rolePattern=${encodeURIComponent(pattern)}`;
        }

        if (names) {
            let namePattern = names
                .split(',')
                .map(item => {
                    const trimmedItem = item.trim();
                    return `(^|,)${trimmedItem}(,|$)|^${trimmedItem}$`;
                })
                .join('|');
            patternText += `namePattern=${encodeURIComponent(namePattern)}`;
        }

        const response = await axiosInstance.get(`/instances/search/findFilterICanSee?${patternText}`);
        if (!response.data) return null;
        if (!response.data._embedded) return null;
        return response.data._embedded.instances.map((inst: any) => ({
            instId: inst._links.self.href.split('/').pop(),
            instName: inst.name,
            status: inst.status,
            startedDate: inst.startedDate,
            defId: inst.defId
        }));
    }

    async getInstanceListByGroup(groups: string) {
        let pattern = groups
            .split(',')
            .map(item => {
                const trimmedItem = item.trim();
                return `(^|,)${trimmedItem}(,|$)|^${trimmedItem}$`;
            })
            .join('|');

        const response = await axiosInstance.get(
            `/instances/search/findAllByGroupsRegex?status=Running&pattern=${encodeURIComponent(pattern)}`
        );

        return response.data._embedded.instances.map((inst: any) => ({
            instId: inst._links.self.href.split('/').pop(),
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
                instId: inst._links.self.href.split('/').pop(),
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

    async getActivitiesStatus(instId: string, executionScope: String = "0") {
        const response = await axiosInstance.get(`/instance/${instId}/status/${executionScope}`);

        return response.data;
    }

    async dryRun(isSimulate: string, command: object) {
        // command를 object json으로 변경
        let config = {
            headers: {
                isSimulate: isSimulate ? isSimulate : 'false'
            }
        };
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
        try {
            const response = await axiosInstance.post(`/validate`, xml);
            if (!response.data) return {};
            return response.data;
        } catch (error) {
            // console.error('유효성 검사 중 오류 발생:', error);
            throw error;
        }
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

    async deleteRecordTest(path: string, index: number): Promise<any> {
        const response = await axiosInstance.delete(`/test/${path}/record`, {
            data: { idx: index }
        });
        return response.data;
    }

    async checkDBConnection() {
        return true;
    }

    async saveTask(id: string, name: string, type: string, json: any) {
        console.warn("method is not implemented only use PalModeBackend");
        return null;
    }

    async getTaskList() {
        console.warn("method is not implemented only use PalModeBackend");
        return null;
    }


    async fetchNotifications() {
        console.warn("method is not implemented only use Process-GPT Mode");
        return [];
    }

    async getBSCard() {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async putBSCard(card: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    __uuid() {
        // 브라우저 환경에서는 crypto.randomUUID() 우선 사용 (가능하면 표준 UUID)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyCrypto = (globalThis as any)?.crypto;
            if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
                return anyCrypto.randomUUID();
            }
        } catch (e) {
            // ignore
        }
        // fallback (UUID v4 유사)
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    }

    // =========================
    // Business Rule (비즈니스 규칙)
    // - UI에는 JSON을 노출하지 않는다. (내부 데이터)
    // - 정의 저장소(DefinitionServiceImpl)의 raw definition API를 사용한다.
    //   - GET  /definition/raw/{path}.json   (getRawDefinition)
    //   - PUT  /definition/raw/{path}.json   (putRawDefinition)
    //   - LIST /definition?basePath=...      (listDefinition)
    // =========================
    async listBusinessRules() {
        // NOTE:
        // - raw definition API는 디렉터리 listing을 제공하지 않으므로 /definition listing을 사용한다.
        // - 실제 룰 메타(name/description)는 각 파일(JSON)에서 읽는다. (정확성 우선)
        const root = 'businessRules';

        // folder 재귀 탐색(프로젝트 내 다른 definition 탐색 로직과 동일한 방식)
        // versions 폴더는 제외
        const collectRuleFiles = async (basePath?: string): Promise<any[]> => {
            const defs = (await this.listDefinition(basePath || root)) || [];
            const lists = Array.isArray(defs) ? defs : [];
            const results: any[] = [];

            for (const item of lists) {
                if (!item) continue;
                
                // versions 폴더는 제외
                const itemPath = typeof item?.path === 'string' ? item.path : '';
                const itemName = typeof item?.name === 'string' ? item.name : '';
                if (itemPath.includes('/versions/') || itemPath.endsWith('/versions') || itemName === 'versions') {
                    continue;
                }
                
                if (item.directory) {
                    // 하위 폴더는 item.path 기준으로 내려간다. (name만 쓰면 상위 경로를 잃을 수 있음)
                    const childPath = typeof item?.path === 'string' ? item.path : '';
                    if (childPath) {
                        const children = await collectRuleFiles(childPath);
                        results.push(...children);
                    }
                } else {
                    // 파일인 경우, versions 폴더 내부가 아닌지 확인
                    if (!itemPath.includes('/versions/')) {
                        results.push(item);
                    }
                }
            }
            return results;
        };

        const files = await collectRuleFiles();

        const results = await Promise.all(
            files
                .filter((d: any) => d && !d.directory)
                .filter((d: any) => typeof d?.name === 'string' && d.name.toLowerCase().endsWith('.rule'))
                .filter((d: any) => {
                    // versions 폴더 내부 파일 제외
                    const path = typeof d?.path === 'string' ? d.path : '';
                    return !path.includes('/versions/');
                })
                .map(async (d: any) => {
                    const name = typeof d?.name === 'string' ? d.name : '';
                    const path = typeof d?.path === 'string' ? d.path : '';
                    const fileName = name || path.split('/').pop() || '';
                    const idFromFile = fileName.replace(/\.rule$/i, '');

                    try {
                        const raw = await this.getRawDefinition(`businessRules/${encodeURIComponent(idFromFile)}`, { type: 'rule' });
                        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        return {
                            id: parsed?.id ?? idFromFile,
                            name: parsed?.name ?? idFromFile,
                            description: parsed?.description ?? ''
                        };
                    } catch (e) {
                        return { id: idFromFile, name: idFromFile, description: '' };
                    }
                })
        );

        // id/name 없는 항목 방어 + 정렬(이름 기준)
        return results
            .filter((r: any) => r && r.id)
            .sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')));
    }

    async getBusinessRule(ruleId: string) {
        if (!ruleId) return null;
        const raw = await this.getRawDefinition(`businessRules/${encodeURIComponent(ruleId)}`, { type: 'rule' });
        if (!raw) return null;
        const dto = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return this.__fromBusinessRuleDto(dto);
    }

    async saveBusinessRule(rule: any) {
        const toSave = { ...(rule || {}) };
        if (!toSave.id) toSave.id = this.__uuid();

        // 기존 룰이 있으면 버전 관리 (이전 버전을 versions 폴더에 저장)
        let currentVersion = '1.0';
        try {
            const existingRaw = await this.getRawDefinition(`businessRules/${encodeURIComponent(String(toSave.id))}`, { type: 'rule' });
            if (existingRaw) {
                const existingDto = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
                
                // 기존 버전 번호 확인 및 증가
                if (existingDto.version) {
                    const versionParts = String(existingDto.version).split('.');
                    const major = parseInt(versionParts[0] || '1', 10);
                    const minor = parseInt(versionParts[1] || '0', 10);
                    currentVersion = `${major}.${minor + 1}`;
                } else {
                    currentVersion = '1.1'; // 버전이 없으면 1.1로 시작
                }
                
                // 이전 버전을 versions 폴더에 저장 (원본 저장 전에)
                const previousVersion = existingDto.version || '1.0';
                await this.putRawDefinition(
                    JSON.stringify({
                        ...existingDto,
                        created_at: existingDto.created_at || new Date().toISOString(),
                        created_by: existingDto.created_by || this.__getCurrentUserId()
                    }),
                    `businessRules/${encodeURIComponent(String(toSave.id))}/versions/${previousVersion}`,
                    { type: 'rule' }
                );
            }
        } catch (e) {
            // 기존 룰이 없으면 신규 룰로 처리
            console.log('신규 룰 생성:', toSave.id);
        }

        // 원본 저장 (기존 방식 유지, 버전 정보만 추가)
        const payload = this.__toBusinessRuleDto(toSave);
        const versionedPayload = {
            ...payload,
            version: currentVersion,
            created_at: new Date().toISOString(),
            created_by: this.__getCurrentUserId()
        };

        // raw definition에는 "JSON 문자열"로 저장해 (서버/리소스매니저 직렬화 편차를 최소화)
        await this.putRawDefinition(
            JSON.stringify(versionedPayload),
            `businessRules/${encodeURIComponent(String(toSave.id))}`,
            { type: 'rule' }
        );

        return { id: toSave.id };
    }

    async deleteBusinessRule(ruleId: string): Promise<void> {
        if (!ruleId) return;
        // deleteDefinition 패턴 사용 (raw definition 삭제)
        await this.deleteDefinition(`businessRules/${encodeURIComponent(ruleId)}.rule`);
    }

    // =========================
    // Business Rule Test (룰 테스트 실행)
    // =========================
    async executeBusinessRule(ruleId: string, inputs: Record<string, any>): Promise<any> {
        if (!ruleId) {
            throw new Error('룰 ID가 필요합니다.');
        }
        
        try {
            const response = await axiosInstance.post(
                `/business-rules/${encodeURIComponent(ruleId)}/execute`,
                { inputs }
            );
            return response.data;
        } catch (error: any) {
            console.error('룰 실행 실패:', error);
            throw new Error(error?.response?.data?.message || error?.message || '룰 실행 중 오류가 발생했습니다.');
        }
    }

    async saveRuleTestCase(ruleId: string, testCase: any): Promise<void> {
        if (!ruleId || !testCase) {
            throw new Error('룰 ID와 테스트 케이스가 필요합니다.');
        }
        
        try {
            const testCaseId = testCase.id || this.__uuid();
            const testCaseData = {
                ...testCase,
                id: testCaseId,
                ruleId: ruleId,
                updatedAt: new Date().toISOString(),
                createdAt: testCase.createdAt || new Date().toISOString()
            };
            
            await this.putRawDefinition(
                JSON.stringify(testCaseData),
                `businessRules/${encodeURIComponent(ruleId)}/testCases/${encodeURIComponent(testCaseId)}`,
                { type: 'json' }
            );
        } catch (error: any) {
            console.error('테스트 케이스 저장 실패:', error);
            throw new Error(error?.response?.data?.message || error?.message || '테스트 케이스 저장 중 오류가 발생했습니다.');
        }
    }

    async getRuleTestCases(ruleId: string): Promise<any[]> {
        if (!ruleId) return [];
        
        try {
            const testCasesPath = `businessRules/${encodeURIComponent(ruleId)}/testCases`;
            const testCaseFiles = await this.listDefinition(testCasesPath);
            
            if (!Array.isArray(testCaseFiles) || testCaseFiles.length === 0) {
                return [];
            }
            
            const results = await Promise.all(
                testCaseFiles
                    .filter((f: any) => !f.directory && f.name?.endsWith('.json'))
                    .map(async (f: any) => {
                        try {
                            const fileName = f.name?.replace(/\.json$/i, '') || '';
                            const raw = await this.getRawDefinition(`${testCasesPath}/${fileName}`, { type: 'json' });
                            if (!raw) return null;
                            
                            const testCase = typeof raw === 'string' ? JSON.parse(raw) : raw;
                            return {
                                id: testCase.id || fileName,
                                name: testCase.name || fileName,
                                inputs: testCase.inputs || {},
                                expectedOutcome: testCase.expectedOutcome,
                                expectedNote: testCase.expectedNote,
                                createdAt: testCase.createdAt,
                                updatedAt: testCase.updatedAt
                            };
                        } catch (e) {
                            console.warn(`테스트 케이스 로드 실패: ${f.name}`, e);
                            return null;
                        }
                    })
            );
            
            return results.filter((r: any) => r !== null).sort((a: any, b: any) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return dateB - dateA; // 최신순
            });
        } catch (error) {
            console.error('테스트 케이스 목록 조회 실패:', error);
            return [];
        }
    }

    async deleteRuleTestCase(ruleId: string, testCaseId: string): Promise<void> {
        if (!ruleId || !testCaseId) {
            throw new Error('룰 ID와 테스트 케이스 ID가 필요합니다.');
        }
        
        try {
            await this.deleteDefinition(`businessRules/${encodeURIComponent(ruleId)}/testCases/${encodeURIComponent(testCaseId)}.json`);
        } catch (error: any) {
            console.error('테스트 케이스 삭제 실패:', error);
            throw new Error(error?.response?.data?.message || error?.message || '테스트 케이스 삭제 중 오류가 발생했습니다.');
        }
    }

    __getCurrentUserId(): string {
        // UEngine 모드에서 사용자 정보 조회
        // Keycloak 토큰에서 추출하거나 localStorage에서 조회
        try {
            const token = localStorage.getItem('keycloak') || localStorage.getItem('accessToken');
            if (token) {
                // JWT 토큰 파싱 (간단한 방식)
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.email || payload.preferred_username || payload.sub || 'unknown';
                } catch (e) {
                    // 토큰 파싱 실패 시 기본값
                }
            }
        } catch (e) {
            console.warn('사용자 정보 조회 실패:', e);
        }
        return 'unknown';
    }

    async getDmnHistory(agentId: string, ruleId?: string): Promise<any[]> {
        // UEngine 모드: ruleId를 사용하여 버전 이력 조회
        const targetRuleId = ruleId || agentId;
        if (!targetRuleId) return [];

        try {
            const historyList: any[] = [];
            
            // 현재 룰의 DMN XML 가져오기
            const currentRaw = await this.getRawDefinition(`businessRules/${encodeURIComponent(targetRuleId)}`, { type: 'rule' });
            if (currentRaw) {
                const currentDto = typeof currentRaw === 'string' ? JSON.parse(currentRaw) : currentRaw;
                const currentDmnXml = currentDto?.ruleJson?.dmnXml || '';
                
                if (currentDmnXml) {
                    historyList.push({
                        knowledge_id: targetRuleId,
                        knowledge_name: currentDto?.name || targetRuleId,
                        operation: historyList.length === 0 ? 'CREATE' : 'UPDATE',
                        change_summary: '현재 버전',
                        dmn_xml: currentDmnXml,
                        created_at: currentDto?.created_at || new Date().toISOString(),
                        created_by: currentDto?.created_by || 'unknown',
                        version: currentDto?.version || '1.0'
                    });
                }
            }

            // versions 폴더에서 이전 버전들 조회
            try {
                const versionsPath = `businessRules/${encodeURIComponent(targetRuleId)}/versions`;
                const versionFiles = await this.listDefinition(versionsPath);
                
                if (Array.isArray(versionFiles)) {
                    for (const file of versionFiles) {
                        if (file.directory || !file.name?.endsWith('.rule')) continue;
                        
                        try {
                            const versionName = file.name.replace(/\.rule$/i, '');
                            const versionRaw = await this.getRawDefinition(`${versionsPath}/${versionName}`, { type: 'rule' });
                            if (versionRaw) {
                                const versionDto = typeof versionRaw === 'string' ? JSON.parse(versionRaw) : versionRaw;
                                const versionDmnXml = versionDto?.ruleJson?.dmnXml || '';
                                
                                if (versionDmnXml) {
                                    historyList.push({
                                        knowledge_id: targetRuleId,
                                        knowledge_name: versionDto?.name || targetRuleId,
                                        operation: 'UPDATE',
                                        change_summary: `버전 ${versionDto?.version || versionName}`,
                                        dmn_xml: versionDmnXml,
                                        created_at: versionDto?.created_at || new Date().toISOString(),
                                        created_by: versionDto?.created_by || 'unknown',
                                        version: versionDto?.version || versionName
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn(`버전 파일 로드 실패: ${file.name}`, e);
                        }
                    }
                }
            } catch (e) {
                // versions 폴더가 없거나 접근 불가능한 경우 무시
                console.log('버전 이력 폴더 조회 실패 (신규 룰일 수 있음):', e);
            }

            // created_at 기준 내림차순 정렬 (최신순)
            return historyList.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });
        } catch (error) {
            console.error('DMN 히스토리 조회 실패:', error);
            return [];
        }
    }

    async getBusinessRuleVersions(ruleId: string): Promise<any[]> {
        if (!ruleId) return [];

        try {
            const versions: any[] = [];
            
            // 현재 룰 파일의 버전 정보 조회 (isCurrent 플래그 설정용)
            let currentVersion = null;
            try {
                const currentRaw = await this.getRawDefinition(`businessRules/${encodeURIComponent(ruleId)}`, { type: 'rule' });
                if (currentRaw) {
                    const currentDto = typeof currentRaw === 'string' ? JSON.parse(currentRaw) : currentRaw;
                    currentVersion = currentDto?.version || '1.0';
                }
            } catch (e) {
                console.warn('[getBusinessRuleVersions] 현재 버전 조회 실패:', e);
            }

            // versions 폴더에서 실제로 존재하는 버전 파일들만 조회
            try {
                const versionsPath = `businessRules/${encodeURIComponent(ruleId)}/versions`;
                const versionFiles = await this.listDefinition(versionsPath);
                
                console.log('[getBusinessRuleVersions] versionsPath:', versionsPath);
                console.log('[getBusinessRuleVersions] versionFiles:', versionFiles);
                
                if (Array.isArray(versionFiles) && versionFiles.length > 0) {
                    for (const file of versionFiles) {
                        // 디렉토리는 제외, .rule 파일만 처리
                        if (file.directory || !file.name?.endsWith('.rule')) {
                            console.log('[getBusinessRuleVersions] 파일 스킵:', file.name, 'directory:', file.directory, 'endsWith .rule:', file.name?.endsWith('.rule'));
                            continue;
                        }
                        
                        try {
                            const versionName = file.name.replace(/\.rule$/i, '');
                            const versionRaw = await this.getRawDefinition(`${versionsPath}/${versionName}`, { type: 'rule' });
                            
                            // 파일이 실제로 존재하고 읽을 수 있는지 확인
                            if (!versionRaw) {
                                console.warn('[getBusinessRuleVersions] 파일이 존재하지 않음, 스킵:', versionName);
                                continue;
                            }
                            
                            // 빈 문자열이나 잘못된 데이터인지 확인
                            const versionDto = typeof versionRaw === 'string' 
                                ? (versionRaw.trim() ? JSON.parse(versionRaw) : null)
                                : versionRaw;
                            
                            if (!versionDto || typeof versionDto !== 'object') {
                                console.warn('[getBusinessRuleVersions] 유효하지 않은 데이터, 스킵:', versionName);
                                continue;
                            }
                            
                            // 버전 정보가 있는지 확인
                            if (!versionDto.version && !versionName) {
                                console.warn('[getBusinessRuleVersions] 버전 정보가 없음, 스킵:', versionName);
                                continue;
                            }
                            
                            // 현재 룰 파일의 버전과 비교하여 isCurrent 설정
                            const isCurrent = (currentVersion && versionName === currentVersion);
                            
                            versions.push({
                                version: versionName, // 파일명 기준 버전 사용
                                name: versionDto?.name || ruleId, // 룰 이름 추가
                                description: versionDto?.description || versionDto?.message || '', // 설명 추가
                                created_at: versionDto?.created_at || new Date().toISOString(),
                                created_by: versionDto?.created_by || 'unknown',
                                isCurrent: isCurrent,
                                fileName: file.name // 파일명 저장 (정렬용)
                            });
                            console.log('[getBusinessRuleVersions] 버전 추가:', versionName, 'isCurrent:', isCurrent);
                        } catch (e) {
                            // 파일이 존재하지 않거나 읽을 수 없는 경우 스킵
                            console.warn(`[getBusinessRuleVersions] 버전 파일 로드 실패 (목록에서 제외): ${file.name}`, e);
                        }
                    }
                } else {
                    console.log('[getBusinessRuleVersions] versionFiles가 비어있거나 배열이 아님:', versionFiles);
                }
            } catch (e) {
                // versions 폴더가 없거나 접근 불가능한 경우 무시
                console.log('버전 폴더 조회 실패:', e);
            }

            console.log('[getBusinessRuleVersions] 최종 versions:', versions);

            // 버전 번호 기준 정렬 (오름차순, 최신 버전이 맨 뒤)
            return versions.sort((a, b) => {
                const parseVersion = (v: string) => {
                    const parts = String(v || '0.0').split('.');
                    const major = parseInt(parts[0] || '0', 10);
                    const minor = parseInt(parts[1] || '0', 10);
                    return major * 1000 + minor;
                };
                return parseVersion(a.version) - parseVersion(b.version);
            });
        } catch (error) {
            console.error('버전 목록 조회 실패:', error);
            return [];
        }
    }

    __toBusinessRuleDto(rule: any) {
        // 서버 스펙: ruleJson 필수
        // UI는 ruleJson을 직접 다루지 않으므로 여기서 래핑/정리한다.
        const inputs = Array.isArray(rule?.inputs) ? rule.inputs : [];
        const sanitizedInputs = inputs.map((i: any) => ({
            // UI 모델: label(사람용) + key(내부). 과거 호환을 위해 item도 허용.
            label: i?.label ?? '',
            key: i?.key ?? i?.item ?? '',
            inputMode: i?.inputMode ?? 'number',
            options: Array.isArray(i?.options) ? i.options : []
        }));

        const rules = Array.isArray(rule?.rules) ? rule.rules : [];
        const sanitizedRules = rules.map((r: any) => ({
            conditions: Array.isArray(r?.conditions)
                ? r.conditions.map((c: any) => ({
                      // UI는 key를 사용(내부 식별자). 레거시/호환을 위해 item도 허용.
                      item: c?.key ?? c?.item ?? '',
                      key: c?.key ?? c?.item ?? '',
                      operator: c?.operator ?? '',
                      value: c?.value ?? ''
                  }))
                : [],
            // note는 dmnXml(annotations)로만 저장한다.
            result: { outcome: r?.result?.outcome ?? 'approve' }
        }));

        // 내부 모델(조건/결과) → DMN XML (저장/실행용)
        // IMPORTANT: UI에는 절대 노출하지 않는다.
        // NOTE: 입력칸(note 등)은 annotations로만 보관하므로, 프론트가 dmnXml을 제공하면 그것을 우선 사용한다.
        // (그렇지 않으면 테이블 정보만으로 최소 DMN을 생성한다.)
        let dmnXml = typeof rule?.dmnXml === 'string' ? rule.dmnXml : '';
        if (!dmnXml || !String(dmnXml).trim()) {
            try {
                dmnXml = businessRuleToDmnXml({
                    id: rule?.id,
                    name: rule?.name,
                    description: rule?.description,
                    inputs: sanitizedInputs,
                    rules: sanitizedRules
                });
            } catch (e) {
                dmnXml = '';
            }
        }

        return {
            id: rule?.id,
            name: rule?.name ?? '',
            description: rule?.description ?? '',
            ruleJson: {
                // DMN XML을 우선 데이터로 제공 (UI에는 노출 금지)
                dmnXml
            }
        };
    }

    __fromBusinessRuleDto(dto: any) {
        if (!dto) return null;
        // 서버가 { id, name, description, ruleJson } 형태로 주는 경우를 UI 모델(conditions/result)로 펼친다.
        if (dto.ruleJson && (dto.conditions === undefined && dto.result === undefined)) {
            const flattened: any = {
                ...dto,
                ...(dto.ruleJson || {})
            };

            const hasInputs = Array.isArray(flattened.inputs) && flattened.inputs.length > 0;
            const hasRules = Array.isArray(flattened.rules) && flattened.rules.length > 0;
            const dmnXml = typeof flattened.dmnXml === 'string' ? flattened.dmnXml : '';

            if (dmnXml) {
                const parsed = dmnXmlToBusinessRule(dmnXml);
                if (parsed) {
                    if (!hasInputs) flattened.inputs = parsed.inputs || [];
                    if (!hasRules) flattened.rules = parsed.rules || [];
                    // note는 내부 JSON에 저장하지 않으므로, annotations에서 읽은 값을 "표시용"으로만 backfill 한다.
                    if (hasRules && Array.isArray(flattened.rules) && Array.isArray(parsed.rules)) {
                        flattened.rules = flattened.rules.map((r: any, idx: number) => {
                            const p = parsed.rules?.[idx];
                            const pNote = typeof p?.result?.note === 'string' ? p.result.note : '';
                            if (!pNote) return r;
                            if (!r || typeof r !== 'object') return r;
                            const next = { ...r };
                            next.result = { ...(next.result || {}) };
                            if (typeof next.result.note !== 'string' || !next.result.note.trim()) {
                                next.result.note = pNote;
                            }
                            return next;
                        });
                    }
                }
            }

            // 레거시(conditions/result)로 내려오는 경우도 신규 모델로 한 번 더 정리
            if ((!hasInputs || !hasRules) && (flattened.conditions || flattened.result)) {
                const parsedLegacy = businessRuleToDmnXml({
                    id: flattened.id,
                    name: flattened.name,
                    description: flattened.description,
                    conditions: flattened.conditions || [],
                    result: flattened.result || { outcome: 'approve', note: '' }
                });
                const back = parsedLegacy ? dmnXmlToBusinessRule(parsedLegacy) : null;
                if (back) {
                    flattened.inputs = flattened.inputs && flattened.inputs.length ? flattened.inputs : back.inputs;
                    flattened.rules = flattened.rules && flattened.rules.length ? flattened.rules : back.rules;
                    if (!flattened.dmnXml) flattened.dmnXml = parsedLegacy;
                }
            }

            return flattened;
        }
        return dto;
    }

    async getSchedule(id: string, version: string) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async setSchedule(json: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async deleteSchedule(defId: string, eventId: string) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async getDataSourceList() {
        console.warn("method is not implemented only use Process-GPT Mode");
        return [];
    }

    async addDataSource(dataSource: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async updateDataSource(dataSource: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async deleteDataSource(dataSource: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async extractDatasourceSchema(): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        // 호출부에서 this.datasourceSchema.map(...)을 수행하므로 null 대신 빈 배열을 반환해
        // UI/모델러 렌더링 흐름이 끊기지 않도록 한다.
        return [];
    }

    async callDataSource(dataSource: any, bodyData: any) {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async getEnvByTenant(): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async getSecretByTenant(): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async deleteEnvByTenant(name: string): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async deleteSecretByTenant(name: string): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async createEnvByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async createSecretByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async updateEnvByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async updateSecretByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async getBrowserUseSecretByTenant(): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async createBrowserUseSecretByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async updateBrowserUseSecretByTenant(data: any): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async deleteBrowserUseSecretByTenant(name: string): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    async getMCPLists(): Promise<any> {
        console.warn("method is not implemented only use Process-GPT Mode");
        return null;
    }

    // ============================================
    // Task Catalog API (Process-GPT Mode only)
    // ============================================

    async getTaskSystems(): Promise<any> {
        console.warn("getTaskSystems is not implemented - only use Process-GPT Mode");
        return [];
    }

    async saveTaskSystem(system: any): Promise<any> {
        console.warn("saveTaskSystem is not implemented - only use Process-GPT Mode");
        return system;
    }

    async deleteTaskSystem(id: string): Promise<void> {
        console.warn("deleteTaskSystem is not implemented - only use Process-GPT Mode");
    }

    async getTaskCatalogList(options?: any): Promise<any> {
        console.warn("getTaskCatalogList is not implemented - only use Process-GPT Mode");
        return [];
    }

    async getTaskCatalog(id: string): Promise<any> {
        console.warn("getTaskCatalog is not implemented - only use Process-GPT Mode");
        return null;
    }

    async saveTaskCatalog(item: any): Promise<any> {
        console.warn("saveTaskCatalog is not implemented - only use Process-GPT Mode");
        return item;
    }

    async deleteTaskCatalog(id: string): Promise<void> {
        console.warn("deleteTaskCatalog is not implemented - only use Process-GPT Mode");
    }

    async getPropertySchemas(taskType?: string): Promise<any> {
        console.warn("getPropertySchemas is not implemented - only use Process-GPT Mode");
        return [];
    }

    async savePropertySchema(schema: any): Promise<any> {
        console.warn("savePropertySchema is not implemented - only use Process-GPT Mode");
        return schema;
    }

    async deletePropertySchema(id: string): Promise<void> {
        console.warn("deletePropertySchema is not implemented - only use Process-GPT Mode");
    }

    async getPaletteSettings(): Promise<any> {
        console.warn("getPaletteSettings is not implemented - only use Process-GPT Mode");
        return { visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask'] };
    }

    async savePaletteSettings(settings: any): Promise<any> {
        console.warn("savePaletteSettings is not implemented - only use Process-GPT Mode");
        return settings;
    }

    async getPaletteTaskTypes(): Promise<any> {
        console.warn("getPaletteTaskTypes is not implemented - only use Process-GPT Mode");
        return [];
    }

    async updatePaletteTaskType(id: string, isEnabled: boolean): Promise<any> {
        console.warn("updatePaletteTaskType is not implemented - only use Process-GPT Mode");
        return null;
    }

    // Task Execution Properties - Not implemented in UEngine mode
    async getUserInfo(): Promise<any> {
        console.warn("getUserInfo is not implemented - only use Process-GPT Mode");
        return null;
    }

    async saveTaskExecutionProperties(params: any): Promise<any> {
        console.warn("saveTaskExecutionProperties is not implemented - only use Process-GPT Mode");
        return null;
    }

    async updateTaskExecutionCompletion(params: any): Promise<any> {
        console.warn("updateTaskExecutionCompletion is not implemented - only use Process-GPT Mode");
        return null;
    }

    async getTaskExecutionProperties(options?: any): Promise<any[]> {
        console.warn("getTaskExecutionProperties is not implemented - only use Process-GPT Mode");
        return [];
    }

}

export default UEngineBackend;
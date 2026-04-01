import axios from 'axios';
const axiosInstance = axios.create();
import type { Backend, BpmnModelingPolicy } from './Backend';
import {
    getAllUsers,
    getKeycloakGroupsForPermission,
    getKeycloakGroupsHierarchy,
    getKeycloakRootGroups,
    getUsersByRoles,
    getUserGroupsOnly
} from '@/utils/keycloak';
import { canManageProcess } from '@/utils/processManagement';
import { businessRuleToDmnXml, dmnXmlToBusinessRule } from '@/utils/businessRuleDmn';
import { buildActorUidForSave, normalizeRawDefinitionDisplayName } from '@/utils/definitionActorDisplay';
import { getKeycloakUserIdForSave } from '@/utils/keycloak';
// uEngine 모드에서 ProcessGPT 전용(또는 미지원) 메서드 호출 시
// - null/undefined 반환으로 인해 호출부에서 NPE(예: .forEach, .path 접근) 나는 걸 방지하기 위해
// - 안전한 기본값을 반환하고, "다른 모드 전용 기능이라 추후 개발 가능" 경고를 1회만 출력한다.
const __uEngineWarnedUnsupported = new Set<string>();
/** 저장/조회 시 폴더 경로가 없을 때 앞에 붙이는 기본 폴더 (예: test.bpmn → default/test.bpmn) */
const __defaultDefinitionFolder = 'default';

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
            // definition-service 등: DefinitionActorNameProvider / UserContext와 맞추기 위해 Keycloak 사용자 id(UUID)
            if (typeof window !== 'undefined' && (window as any).$mode === 'uEngine') {
                const userId = getKeycloakUserIdForSave();
                if (userId) {
                    anyConfig.headers['X-User-Id'] = userId;
                }
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

class UEngineBackend implements Backend {
    // constructor() {
    //     super();
    // }

    private __isOracleMode(): boolean {
        return typeof window !== 'undefined' && (window as any).$oracle === true;
    }

    private __safeParseJson(data: any): any {
        if (typeof data !== 'string') return data;
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }

    private __friendlyError(error: any, fallbackMessage: string): Error {
        const detail = error?.response?.data?.message || error?.message || '';
        const message = detail ? `${fallbackMessage}: ${detail}` : fallbackMessage;

        if (error && typeof error === 'object') {
            error.message = message;
            return error;
        }

        return new Error(message);
    }

    getGatewayExportCondition(gateway: any): string {
        return gateway?.condition || '';
    }

    getSequenceFlowExportCondition(flow: any): string {
        return flow?.condition || '';
    }

    encodeInstanceIdForInstancelistRoute(instId: string): string {
        if (instId == null || instId === '') return '';
        return String(instId);
    }

    decodeInstanceIdFromInstancelistRouteParam(routeParam: string): string {
        if (routeParam == null || routeParam === '') return '';
        return String(routeParam);
    }

    getBpmnModelingPolicy(): BpmnModelingPolicy {
        return {
            defaultAppendTaskBpmnType: 'bpmn:UserTask',
            paletteVisibleTaskBpmnTypes: ['bpmn:UserTask'],
            multiReplaceTaskBpmnTypes: ['bpmn:UserTask']
        };
    }

    async saveProcessDefinitionFromModeler(params: { info: any; xml: string; processDefinition?: any }): Promise<void> {
        const { info, xml } = params;
        const rawPath = info?.path || info?.proc_def_id || info?.id || '';
        await this.putRawDefinition(xml, rawPath, { type: 'bpmn' });
    }

    private __encodePathSegments(path: string): string {
        return String(path || '')
            .split('/')
            .filter((segment) => segment !== '')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
    }

    /**
     * raw 정의 경로 정규화 (저장/조회 공통).
     * - 앞뒤 공백·앞 슬래시, definition/raw/, definitions/ 접두사 제거
     * - 타입별 확장자 보정 (.bpmn, .form 등)
     * - 폴더 경로가 없으면(슬래시 없음) 기본 폴더를 앞에 붙임 (예: test.bpmn → default/test.bpmn)
     */
    private __normalizeRawResourcePath(defPath: string, type: string = 'bpmn'): string {
        let normalized = String(defPath || '')
            .trim()
            .replace(/^\/+/, '')
            .replace(/^definition\/raw\/?/i, '')
            .replace(/^definitions\//i, '')
            .replace(/\/version\/[^/]+$/i, '');

        if (!normalized) return normalized;

        const extensionMap: Record<string, string> = {
            bpmn: '.bpmn',
            form: '.form',
            rule: '.rule',
            json: '.json',
            unit: '.unit'
        };

        const expectedExtension = extensionMap[type];
        if (expectedExtension && !normalized.toLowerCase().endsWith(expectedExtension)) {
            normalized += expectedExtension;
        }

        if (!normalized.includes('/')) {
            normalized = __defaultDefinitionFolder + '/' + normalized;
        }
        return normalized;
    }

    private __normalizeRawDefinitionResponse(data: any, type: string) {
        const parsed = this.__safeParseJson(data);
        if (parsed == null) return null;

        if (type === 'bpmn') {
            if (typeof parsed === 'string') return parsed;
            if (typeof parsed === 'object' && (parsed.bpmn != null || parsed.definition != null))
                return parsed.bpmn ?? parsed.definition;
        }
        if (type === 'form' && typeof parsed === 'object' && 'html' in parsed) return parsed.html;

        return parsed;
    }

    private __normalizeMetricsMap(data: any): { domains: any[]; mega_processes: any[]; processes: any[] } {
        const parsed = this.__safeParseJson(data);
        if (!parsed || typeof parsed !== 'object') {
            return { domains: [], mega_processes: [], processes: [] };
        }

        return {
            domains: Array.isArray(parsed.domains) ? parsed.domains : [],
            mega_processes: Array.isArray(parsed.mega_processes)
                ? parsed.mega_processes
                : Array.isArray(parsed.megaProcesses)
                  ? parsed.megaProcesses
                  : [],
            processes: Array.isArray(parsed.processes) ? parsed.processes : []
        };
    }

    private async __getOracleRawDefinition(defPath: string, options?: any) {
        const type = options?.type ?? 'bpmn';
        const normalizedPath = this.__normalizeRawResourcePath(defPath, type);
        const encodedPath = this.__encodePathSegments(normalizedPath);
        const candidateRequests = [
            () =>
                axiosInstance.get('/definition/raw', {
                    params: {
                        defPath: normalizedPath,
                        ...(options?.version ? { version: options.version } : {})
                    }
                }),
            () =>
                axiosInstance.get(`/definition/raw/${encodedPath}`, {
                    params: options?.version ? { version: options.version } : undefined
                })
        ];

        let lastError: any = null;

        for (const request of candidateRequests) {
            try {
                const response = await request();
                return this.__normalizeRawDefinitionResponse(response?.data, type);
            } catch (error: any) {
                lastError = error;
                if (error?.response?.status === 404) continue;
                throw this.__friendlyError(error, `정의 '${normalizedPath}' 조회에 실패했습니다`);
            }
        }

        if (options?.version) {
            return null;
        }

        throw this.__friendlyError(lastError, `정의 '${normalizedPath}' 조회에 실패했습니다`);
    }

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
        const users = await getAllUsers(options);
        return users.map(user => {
            return {
                id: user.id,
                profile: user.profile || null,
                username: user.username,
                email: user.email,
                is_admin: user.is_admin || false 
            }
        })
    }

    /**
     * 담당자 설정 다이얼로그 등에서 표시할 담당자 후보 목록.
     * process-manager, admin 역할을 가진 사용자를 반환합니다.
     */
    async getOwnerCandidateUsers(): Promise<Array<{ id: string; name?: string; username?: string; email?: string }>> {
        try {
            const users = await getUsersByRoles(['process-manager', 'admin'], { max: 100 });
            return users.map((u) => ({
                id: u.id,
                username: u.username,
                email: u.email,
                name: u.username || u.email || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.id
            }));
        } catch (e) {
            console.warn('[UEngineBackend] getOwnerCandidateUsers failed:', e);
            return [];
        }
    }

    /**
     * 접근 권한 설정용 조직 목록. uEngine 모드에서는 Keycloak **루트 그룹만** 반환합니다.
     * Keycloak Admin API 권한(query-groups)이 필요합니다.
     * ProcessGPTBackend의 getGroupList와 동일한 형태(chart.children)로 반환합니다.
     */
    async getGroupList() {
        try {
            const groups = await getKeycloakRootGroups();
            if (!groups || groups.length === 0) return [];
            return groups.map((g) => ({
                id: g.id,
                data: { name: g.name },
                children: []
            }));
        } catch (e) {
            console.warn('[UEngineBackend] getGroupList (Keycloak) failed:', e);
            return [];
        }
    }

    /**
     * 접근 권한 설정용 조직 그룹 목록.
     * uEngine 모드에서는 Keycloak 그룹을 조직 그룹으로도 사용합니다.
     */
    /**
     * 조직 그룹 계층 트리 조회. 루트는 "Groups", 그 아래 Keycloak 그룹 계층.
     * 권한 다이얼로그에서 트리로 선택할 때 사용. (Keycloak 기준으로 루트명을 Groups로 통일)
     */
    async getOrgChartGroupListTree(): Promise<{
        id: string;
        name: string;
        children: Array<{ id: string; name: string; children: any[] }>;
    }> {
        try {
            const children = await getKeycloakGroupsHierarchy();
            return {
                id: 'org-root',
                name: 'Groups',
                children: children || []
            };
        } catch (e) {
            console.warn('[UEngineBackend] getOrgChartGroupListTree failed:', e);
            return { id: 'org-root', name: 'Groups', children: [] };
        }
    }

    async getOrgChartGroupList() {
        try {
            const groups = await getKeycloakGroupsForPermission();
            return groups || [];
        } catch (e) {
            console.warn('[UEngineBackend] getOrgChartGroupList (Keycloak) failed:', e);
            return [];
        }
    }

    async setNotifications(value: any) {
        // Placeholder implementation
        __warnUnsupported('setNotifications');
        return { ok: false };
    }
    async search(keyword: string, callback?: (results: any[]) => void) {
        let url = '/definition';
        let result: any[] = [];

        if (this.__isOracleMode()) {
            // Oracle 모드: /definition/{path} 로 하위 목록 조회 후 재귀적으로 전체 목록 수집
            try {
                const list = await this.__listAllDefinitionsOracle();
                const defList = Array.isArray(list) ? list : [];
                const pathOf = (item: any) =>
                    item.path ??
                    (item._links?.self?.href ? String(item._links.self.href).replace(/.*\/definition\/?/, '').replace(/\/$/, '') : '') ??
                    item.id ??
                    '';
                const nameOf = (item: any) => item.name ?? (pathOf(item) ? (pathOf(item).split('/').pop()?.split('.')[0] ?? pathOf(item)) : '');
                const mapped = defList.map((def: any) => ({
                    title: nameOf(def),
                    href: `/definitions/${encodeURIComponent(pathOf(def))}`,
                    matches: [nameOf(def), pathOf(def), def._links?.raw?.href || ''].filter(Boolean)
                }));
                // href는 인코딩되어 있으므로 디코딩한 값·인코딩한 키워드 둘 다로 검색
                const decodedHref = (href: string) => {
                    try {
                        return decodeURIComponent(href);
                    } catch {
                        return href;
                    }
                };
                const encodedKeyword = (() => {
                    try {
                        return encodeURIComponent(keyword);
                    } catch {
                        return keyword;
                    }
                })();
                const filtered = mapped.filter(
                    (item: any) =>
                        (item.title && item.title.includes(keyword)) ||
                        (item.href &&
                            (item.href.includes(keyword) ||
                                decodedHref(item.href).includes(keyword) ||
                                item.href.includes(encodedKeyword))) ||
                        item.matches.some((m: string) => m && m.includes(keyword))
                );
                result.push({ type: 'definition', header: '프로세스 정의', list: filtered });
            } catch (e) {
                console.warn('[UEngineBackend] search (Oracle) failed:', e);
                result.push({ type: 'definition', header: '프로세스 정의', list: [] });
            }
        } else {
            // 기존 uEngine 모드: _embedded.definitions 구조 (원본 유지)
            const response = await axiosInstance.get(url);
            const definitions = response.data?._embedded?.definitions;

            const formattedData = {
                type: 'definition',
                header: '프로세스 정의',
                list: definitions
                    .map((definition: any) => ({
                        title: definition.name,
                        href: `/definitions/${encodeURIComponent(definition.path)}`,
                        matches: [
                            definition.name,
                            definition.path,
                            definition._links?.raw?.href || ''
                        ].filter(Boolean)
                    }))
                    .filter(
                        (item: any) =>
                            item.title.includes(keyword) ||
                            item.href.includes(keyword) ||
                            item.matches.some((match: string) => match.includes(keyword))
                    )
            };
            result.push(formattedData);
        }
        if (typeof callback === 'function') {
            callback(result);
        }
        return result;
    }

    private __normalizeListDefinitionItem(item: any): {
        path: string;
        name: string;
        directory: boolean;
        id?: string;
        isDeleted?: boolean;
        definitionName?: string;
        createdByName?: string;
        updatedByName?: string;
    } {
        const path =
            (item.path ??
                (item._links?.self?.href ? String(item._links.self.href).replace(/.*\/definition\/?/, '').replace(/\/$/, '') : '')) ||
            item.id ||
            '';
        const pathBasename = path ? String(path.split('/').pop() ?? '').trim() : '';
        const stripKnownExt = (s: string) => s.replace(/\.(bpmn|form|rule|json)$/i, '');
        const pathBaseNoExt = stripKnownExt(pathBasename);
        const apiNameRaw = item.name != null ? String(item.name).trim() : '';

        const directory = item.directory ?? (typeof path === 'string' && !path.match(/\.(bpmn|form|rule|json)$/i));
        const isDeleted = item.isDeleted ?? item.isdeleted ?? false;

        /** TB_BPM_PROCDEF.name 등 사람이 읽는 표시명 후보 (여러 배포·직렬화 키) */
        const explicitHuman = [
            item.definitionName,
            item.processName,
            item.processDefinitionName,
            item.displayName,
            item.label,
            item.title,
            item.resourceName,
            item.definition_name,
            item.display_name,
            item.procDefName,
            item.proc_def_name,
            item.PROCESS_NAME,
            item.process_definition_name
        ]
            .map((v: any) => (v != null ? String(v).trim() : ''))
            .find((s: string) => s.length > 0);

        let definitionName: string | undefined = explicitHuman || undefined;
        if (!definitionName && apiNameRaw && pathBasename) {
            const a = apiNameRaw.toLowerCase();
            const b = pathBasename.toLowerCase();
            const n = pathBaseNoExt.toLowerCase();
            if (a !== b && a !== n && apiNameRaw !== path) {
                definitionName = apiNameRaw;
            }
        }

        /** 파일 식별·확장자 필터용: 경로 마지막 세그먼트 우선 (표시명이 한글인 경우에도 .bpmn 필터가 동작하도록) */
        const name = pathBasename || apiNameRaw || path;

        const createdRaw = item.createdByName ?? item.created_by_name ?? item.CREATED_BY_NAME;
        const updatedRaw = item.updatedByName ?? item.updated_by_name ?? item.UPDATED_BY_NAME;
        const createdByName =
            createdRaw != null && String(createdRaw).trim() !== '' ? String(createdRaw).trim() : undefined;
        const updatedByName =
            updatedRaw != null && String(updatedRaw).trim() !== '' ? String(updatedRaw).trim() : undefined;
        return {
            path,
            name,
            directory,
            id: path,
            isDeleted,
            ...(definitionName ? { definitionName } : {}),
            ...(createdByName && { createdByName }),
            ...(updatedByName && { updatedByName })
        };
    }

    // Process Definition Service Impl API
    async listDefinition(basePath: string) {
        const trim = String(basePath ?? '')
            .trim()
            .replace(/^\/+|\/+$/g, '');
        let data: any;
        try {
            if (!trim) {
                const response = await axiosInstance.get('/definition');
                data = this.__safeParseJson(response?.data);
            } else {
                // 하위 폴더: definition-service는 보통 GET /definition/{경로} 로만 목록을 주고
                // GET /definition?basePath= 경로 는 빈 목록이 되는 배포가 많음
                const pathSeg = trim
                    .split('/')
                    .filter(Boolean)
                    .map((s) => encodeURIComponent(s))
                    .join('/');
                try {
                    const response = await axiosInstance.get(`/definition/${pathSeg}`);
                    data = this.__safeParseJson(response?.data);
                } catch (firstErr: any) {
                    const st = firstErr?.response?.status;
                    if (st === 404 || st === 405) {
                        const response = await axiosInstance.get('/definition', { params: { basePath: trim } });
                        data = this.__safeParseJson(response?.data);
                    } else {
                        throw firstErr;
                    }
                }
            }
        } catch (error: any) {
            throw this.__friendlyError(error, `정의 목록 조회에 실패했습니다${trim ? ` (${trim})` : ''}`);
        }

        let list: any[] = [];
        if (data && data._embedded) {
            if (Array.isArray(data._embedded.definitions)) list = data._embedded.definitions;
            else {
                const embedded = data._embedded;
                const firstArrayKey = Object.keys(embedded).find((k) => Array.isArray(embedded[k]));
                if (firstArrayKey) list = embedded[firstArrayKey];
            }
        } else if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.content)) {
            list = data.content;
        }

        const normalized = list.map((item: any) => this.__normalizeListDefinitionItem(item));
        return normalized;
    }

    /** Oracle 모드: 루트 목록 후 디렉터리만 재귀 조회하여 전체 정의 목록 반환 (search용) */
    private async __listAllDefinitionsOracle(): Promise<any[]> {
        const root = await this.listDefinition('');
        const all: any[] = [];
        const queue = [...root];
        while (queue.length) {
            const item = queue.shift()!;
            if (item.directory) {
                try {
                    const children = await this.listDefinition(item.path);
                    children.forEach((c: any) => (c.directory ? queue.push(c) : all.push(c)));
                } catch {
                    // 하위 경로 조회 실패 시 해당 디렉터리만 스킵
                }
            } else {
                all.push(item);
            }
        }
        return all;
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
        const resolvedOptions = options || {};
        const type = resolvedOptions.type ?? 'bpmn';
        // getRawDefinition(putRawDefinition)과 동일한 경로 규칙: 확장자 보정 + 폴더 없으면 default/
        // 맵에 "test3"처럼 확장자 없는 id만 있으면 저장/조회는 default/test3.bpmn 인데,
        // 여기서 예전처럼 test3.bpmn 만 붙이면 /versions/test3.bpmn 으로 호출되어 버전 목록이 비게 됨.
        const pathSuffix = this.__normalizeRawResourcePath(defId, type);
        if (!pathSuffix) return [];

        // 목록 조회 시 sort/orderBy/size 등을 쿼리 파라미로 전달 (전체 버전 조회용)
        const listParams: Record<string, any> = {};
        if (resolvedOptions.sort != null) listParams.sort = resolvedOptions.sort;
        if (resolvedOptions.orderBy != null) listParams.orderBy = resolvedOptions.orderBy;
        if (resolvedOptions.size != null) listParams.size = resolvedOptions.size;

        if (resolvedOptions.key) {
            if (resolvedOptions.key.includes('version')) {
                const response = await axiosInstance.get(`/versions/${pathSuffix}`, { params: listParams });
                return response.data?._embedded?.definitions;
            } else if (resolvedOptions.key == 'snapshot') {
                resolvedOptions.version = resolvedOptions?.match?.version;
                const response = await this.getRawDefinition(`definitions/${defId}`, resolvedOptions);
                return [{ snapshot: response }];
            }
        } else {
            const response = await axiosInstance.get(`/versions/${pathSuffix}`, { params: listParams });
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
    /**
     * raw 정의 저장. requestPath에 폴더가 없으면 __normalizeRawResourcePath에서 기본 폴더(default/)를 붙임.
     */
    async putRawDefinition(definition: any, requestPath: string, options: any) {
        var config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        let pathToUse = requestPath;
        const type = options?.type ?? 'bpmn';
        pathToUse = this.__normalizeRawResourcePath(pathToUse, type);

        const body: Record<string, any> = {
            definition: typeof definition === 'string' ? definition : (definition?.bpmn ?? (definition && JSON.stringify(definition))),
            version: options?.releaseName ?? options?.version ?? null
        };

        const displayName = normalizeRawDefinitionDisplayName(options?.name);
        if (displayName !== undefined) {
            body.name = displayName;
        }

        // uEngine BPMN 저장: 본문 updatedByName = Keycloak 사용자 id(UUID, Admin API users[].id) — 조회 시 표시명은 서버/프론트에서 조회
        // Oracle/일부 서버는 JSON snake_case(updated_by_name)만 매핑하므로 둘 다 실음
        if (typeof window !== 'undefined' && (window as any).$mode === 'uEngine' && type === 'bpmn') {
            const manualUb = normalizeRawDefinitionDisplayName(options?.updatedByName);
            if (manualUb !== undefined) {
                body.updatedByName = manualUb;
            } else {
                const autoUb = buildActorUidForSave();
                if (autoUb) body.updatedByName = autoUb;
            }
            if (body.updatedByName) {
                body.updated_by_name = body.updatedByName;
            }
        }

        try {
            if (this.__isOracleMode()) {
                // Oracle: TB_BPM_PDEF_VER에 항상 proc_def_id/arcv_id가 .bpmn 포함 형식으로 저장되도록 전달
                body.proc_def_id = pathToUse;
                const ver = options?.version ?? (options?.arcv_id && String(options.arcv_id).split('_').pop()) ?? null;
                body.arcv_id = ver != null ? `${pathToUse}_${ver}` : options?.arcv_id ?? `${pathToUse}_0.0`;

                const url = `/definition/raw/${this.__encodePathSegments(pathToUse)}`;
                const response = await axiosInstance.put(url, body, config);
                return response.data;
            }

            // defPath는 필수: 쿼리 + body 둘 다 전달 (프록시가 PUT 쿼리를 제거하는 경우 대비)
            if (!pathToUse || String(pathToUse).trim() === '') {
                throw new Error('정의 경로(defPath)가 비어 있습니다. 저장할 정의 이름 또는 경로를 입력해 주세요.');
            }
            body.defPath = pathToUse;
            const urlWithQuery = `/definition/raw?defPath=${encodeURIComponent(pathToUse)}`;
            const response = await axiosInstance.put(urlWithQuery, body, config);
            return response.data;
        } catch (error: any) {
            throw this.__friendlyError(error, `정의 '${pathToUse}' 저장에 실패했습니다`);
        }
    }

    /**
     * uEngine 모드: BPMN 정의를 새 경로에 복제 (정의체계도 서브프로세스 복제 버튼용).
     * - desiredNewId가 있으면 해당 경로로 저장 (이미 존재 시 오류), 없으면 _copy, _copy2, ... 자동 생성
     */
    async duplicateLocalProcess(
        sourceId: string,
        newName: string,
        bpmn: string,
        _definition?: any,
        desiredNewId?: string
    ): Promise<{ success: boolean; newId: string }> {
        if (!sourceId || !bpmn || typeof bpmn !== 'string') {
            throw new Error('복제할 정의 ID와 BPMN 내용이 필요합니다.');
        }
        const basePath = String(sourceId)
            .trim()
            .replace(/\.bpmn$/i, '')
            .replace(/\s+/g, '_');
        let newPath: string;
        if (desiredNewId != null && String(desiredNewId).trim() !== '') {
            newPath = String(desiredNewId)
                .trim()
                .replace(/\s+/g, '_')
                .replace(/\.bpmn$/i, '');
            if (!newPath) throw new Error('복제 ID가 비어 있습니다.');
            try {
                const existing = await this.getRawDefinition(newPath, { type: 'bpmn' });
                if (existing) {
                    throw new Error('이미 존재하는 ID입니다. 다른 ID를 입력해 주세요.');
                }
            } catch (e: any) {
                if (e?.message?.includes('이미 존재하는')) throw e;
                // 404 등 = 없음 → 사용 가능
            }
        } else {
            let counter = 1;
            newPath = `${basePath}_copy`;
            while (true) {
                try {
                    const existing = await this.getRawDefinition(newPath, { type: 'bpmn' });
                    if (!existing) break;
                } catch {
                    break;
                }
                newPath = `${basePath}_copy${counter++}`;
            }
        }
        await this.putRawDefinition(bpmn, newPath, { type: 'bpmn', name: newName });
        return { success: true, newId: newPath };
    }

    /**
     * raw 정의 조회. defPath에 폴더가 없으면 __normalizeRawResourcePath에서 기본 폴더(default/)를 붙임.
     */
    // @ts-ignore
    async getRawDefinition(defPath: string, options) {
        if (!defPath) return null;
        if (options?.type === 'deleted') return null;

        const type = options?.type ?? 'bpmn';
        if (this.__isOracleMode()) {
            return this.__getOracleRawDefinition(defPath, options);
        }

        const pathToUse = this.__normalizeRawResourcePath(defPath, type);
        if (!pathToUse || String(pathToUse).trim() === '') return null;

        // 쿼리를 URL에 직접 포함 (프록시가 params 제거하는 경우 대비)
        let urlWithQuery = `/definition/raw?defPath=${encodeURIComponent(pathToUse)}`;
        if (options?.version) urlWithQuery += `&version=${encodeURIComponent(String(options.version))}`;

        try {
            const response = await axiosInstance.get(urlWithQuery, options ?? {});
            return this.__normalizeRawDefinitionResponse(response?.data, type);
        } catch (error: any) {
            throw this.__friendlyError(error, `정의 '${defPath}' 조회에 실패했습니다`);
        }
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

    /**
     * 태스크 반송(이전 단계 담당자에게 재처리 요청) 가능 여부 조회
     * - 실제 조건 판단/후보(이전 단계) 계산은 백엔드에서 수행
     */
    async getTaskReturnAvailability(taskId: string): Promise<any> {
        const response = await axiosInstance.get(`/work-item/${taskId}/return/availability`);
        return response.data;
    }

    /**
     * 태스크 반송 실행
     * - 백엔드에서 검증 후 상태 변경/담당자 변경/로그 기록 등 처리
     */
    async returnTask(taskId: string, payload: any): Promise<any> {
        const response = await axiosInstance.post(`/work-item/${taskId}/return`, payload);
        return response.data;
    }

    /**
     * 태스크 SKIP(건너뛰기) 가능 여부 조회
     */
    async getTaskSkipAvailability(taskId: string): Promise<any> {
        const response = await axiosInstance.get(`/work-item/${taskId}/skip/availability`);
        return response.data;
    }

    /**
     * 태스크 SKIP(건너뛰기) 실행
     */
    async skipTask(taskId: string, payload: any = {}): Promise<any> {
        const response = await axiosInstance.post(`/work-item/${taskId}/skip`, payload);
        return response.data;
    }

    async advanceToActivity(
        instanceId: string,
        tracingTag: string,
        body?: { payloadMapping?: Record<string, Record<string, any>>; maxAttempts?: number }
    ) {
        const response = await axiosInstance.post(
            `/instance/${instanceId}/advance-to-activity/${tracingTag}`,
            body || {}
        );
        return response.data;
    }

    async startFromActivity(
        instanceId: string,
        tracingTag: string,
        body?: { variables?: Record<string, any> }
    ) {
        const response = await axiosInstance.post(
            `/instance/${instanceId}/state/start-from-activity/${tracingTag}`,
            body || {}
        );
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

    async putRoleMapping(instanceId: string, roleName: string, roleMapping: any) {
        const response = await axiosInstance.put(`/instance/${instanceId}/role-mapping/${roleName}`, roleMapping);
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
    async delegateWorkItem(taskId: string, delegatedRoleMapping: any, delegateOnlyForWorkitem = false) {
        const response = await axiosInstance.post(`/work-item/${taskId}/delegate`, delegatedRoleMapping, { params: { delegateOnlyForWorkitem } });
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

    private __normalizeProcessDefinitionMap(data: any): { mega_proc_list: any[]; user_permissions?: any[]; proc_def_owners?: any[] } {
        if (!data || typeof data !== 'object') return { mega_proc_list: [], user_permissions: [], proc_def_owners: [] };
        const ensureName = (o: any) => (o && ('name' in o ? o : { ...o, name: o.label ?? o.id ?? '' }));
        const ensureList = (arr: any[] | undefined) => (Array.isArray(arr) ? arr : []);

        let raw = data.value ?? data.content ?? data;
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw);
            } catch {
                raw = data;
            }
        }
        const megaList = ensureList(
            raw?.mega_proc_list ?? raw?.megaProcList ?? (Array.isArray(raw) ? raw : data.mega_proc_list ?? data.megaProcList ?? data.content)
        );
        const userPermissions = ensureList(raw?.user_permissions);
        const procDefOwners = ensureList(raw?.proc_def_owners);
        if (megaList.length === 0 && Array.isArray(data)) {
            const subList = (data as any[]).map((d: any) => ({
                id: d.id ?? d.path ?? String(d),
                name: d.name ?? d.label ?? d.id ?? d.path ?? String(d),
                path: d.path ?? d.id
            }));
            return {
                mega_proc_list: [
                    {
                        id: 'default',
                        name: '프로세스',
                        major_proc_list: [{ id: 'default_major', name: '전체', sub_proc_list: subList }]
                    }
                ],
                user_permissions: userPermissions,
                proc_def_owners: procDefOwners
            };
        }

        return {
            user_permissions: userPermissions,
            proc_def_owners: procDefOwners,
            mega_proc_list: megaList.map((mega: any) => {
                const m = ensureName(mega);
                const majorList = ensureList(m.major_proc_list ?? m.majorProcList);
                return {
                    ...m,
                    id: m.id ?? m.name,
                    major_proc_list: majorList.map((major: any) => {
                        const j = ensureName(major);
                        const subList = ensureList(j.sub_proc_list ?? j.subProcList);
                        return {
                            ...j,
                            id: j.id ?? j.name,
                            domain: j.domain ?? '',
                            sub_proc_list: subList.map((sub: any) => {
                                const s = ensureName(sub);
                                return { ...s, id: s.id ?? s.name ?? s.path };
                            })
                        };
                    })
                };
            })
        };
    }

    /** uEngine 모드: 맵 JSON 내 user_permissions에서 해당 프로세스 권한만 반환 */
    async getPermissionsByProcDef(procDefId: string) {
        try {
            const map = await this.getProcessDefinitionMap();
            const list = Array.isArray((map as any).user_permissions) ? (map as any).user_permissions : [];
            return list.filter((p: any) => p && p.proc_def_id === procDefId);
        } catch (e) {
            console.warn('[UEngineBackend] getPermissionsByProcDef failed:', e);
            return [];
        }
    }

    /** uEngine 모드: 맵 JSON의 user_permissions에 권한 추가/갱신 후 맵 저장 */
    async putUserPermission(permission: any) {
        try {
            const map = (await this.getProcessDefinitionMap()) as any;
            const list = Array.isArray(map.user_permissions) ? [...map.user_permissions] : [];
            let idSuffix = '';
            if (permission.target_type === 'user') idSuffix = permission.user_id;
            else if (permission.target_type === 'organization') idSuffix = permission.organization_id;
            else if (permission.target_type === 'org_group') idSuffix = permission.org_group_id;
            const id = `${permission.proc_def_id}_${idSuffix}`;
            const payload = {
                ...permission,
                id,
                tenant_id: window.$tenantName
            };
            const idx = list.findIndex((p: any) => p.id === id);
            if (idx >= 0) list[idx] = payload;
            else list.push(payload);
            map.user_permissions = list;
            await this.putProcessDefinitionMap(map);
        } catch (e) {
            console.warn('[UEngineBackend] putUserPermission failed:', e);
            throw e;
        }
    }

    /** uEngine 모드: 맵 JSON의 user_permissions에서 항목 제거 후 맵 저장 */
    async deleteUserPermission(options: any) {
        try {
            const map = (await this.getProcessDefinitionMap()) as any;
            let list = Array.isArray(map.user_permissions) ? [...map.user_permissions] : [];
            if (options.id) {
                list = list.filter((p: any) => p.id !== options.id);
            } else {
                if (options.match && options.match.id) list = list.filter((p: any) => p.id !== options.match.id);
                else if (options.user_id && options.proc_def_id) list = list.filter((p: any) => !(p.user_id === options.user_id && p.proc_def_id === options.proc_def_id));
            }
            map.user_permissions = list;
            await this.putProcessDefinitionMap(map);
        } catch (e) {
            console.warn('[UEngineBackend] deleteUserPermission failed:', e);
            throw e;
        }
    }

    /** 현재 사용자의 Keycloak 그룹 ID 목록 (권한 필터용, uEngine 모드) */
    private async __getCurrentUserKeycloakGroupIds(): Promise<string[]> {
        try {
            if (typeof window === 'undefined' || (window as any).$mode !== 'uEngine') return [];
            const [allGroups, userGroupNames] = await Promise.all([
                getKeycloakGroupsForPermission(),
                getUserGroupsOnly()
            ]);
            if (!Array.isArray(userGroupNames) || userGroupNames.length === 0) return [];
            return (allGroups || [])
                .filter((g: { id: string; name: string }) => userGroupNames.includes(g.name))
                .map((g: { id: string; name: string }) => g.id);
        } catch (e) {
            console.warn('[UEngineBackend] __getCurrentUserKeycloakGroupIds failed:', e);
            return [];
        }
    }

    /** ProcessGPT와 동일: proc_def_id(및 user_id) 기준 권한 목록. 반환: 배열 또는 null */
    async getUserPermissions(options: any) {
        try {
            const list = await this.getPermissionsByProcDef(options.proc_def_id);
            if (!list || list.length === 0) return null;

            if (options.user_id) {
                const userGroupIds = await this.__getCurrentUserKeycloakGroupIds();
                const applicable = list.filter((p: any) => {
                    if (p.target_type === 'user' && p.user_id === options.user_id) return true;
                    if (!p.target_type && p.user_id === options.user_id) return true;
                    if (p.target_type === 'organization' && p.organization_id && userGroupIds.includes(p.organization_id)) return true;
                    if (p.target_type === 'org_group' && p.org_group_id && userGroupIds.includes(p.org_group_id)) return true;
                    return false;
                });
                return applicable.length > 0 ? applicable : null;
            }
            return list;
        } catch (e) {
            console.warn('[UEngineBackend] getUserPermissions failed:', e);
            return null;
        }
    }

    /** ProcessGPT와 동일: 현재 사용자의 해당 프로세스 권한 체크. 반환: { readable, executable, writable, isPublic } */
    async checkProcessPermission(
        procDefId: string
    ): Promise<{ readable: boolean; executable: boolean; writable: boolean; isPublic: boolean }> {
        try {
            if (canManageProcess()) {
                return { readable: true, executable: true, writable: true, isPublic: false };
            }
            const uid = localStorage.getItem('uid');
            if (!uid) {
                return { readable: false, executable: false, writable: false, isPublic: false };
            }
            const allPermissions = await this.getPermissionsByProcDef(procDefId);
            if (!allPermissions || allPermissions.length === 0) {
                return { readable: true, executable: true, writable: true, isPublic: true };
            }
            const userGroupIds = await this.__getCurrentUserKeycloakGroupIds();
            const applicable = allPermissions.filter((p: any) => {
                if (p.target_type === 'user' && p.user_id === uid) return true;
                if (!p.target_type && p.user_id === uid) return true;
                if (p.target_type === 'organization' && p.organization_id && userGroupIds.includes(p.organization_id)) return true;
                if (p.target_type === 'org_group' && p.org_group_id && userGroupIds.includes(p.org_group_id)) return true;
                return false;
            });
            let readable = false;
            let executable = false;
            let writable = false;
            for (const perm of applicable) {
                if (perm.readable) readable = true;
                if (perm.executable) executable = true;
                if (perm.writable) writable = true;
            }
            return { readable, executable, writable, isPublic: false };
        } catch (e) {
            console.warn('[UEngineBackend] checkProcessPermission failed:', e);
            return { readable: false, executable: false, writable: false, isPublic: false };
        }
    }

    /** ProcessGPT와 동일: 병합된 권한. 반환: { has_readable, has_executable, has_writable } */
    async getMergedPermission(options: any) {
        try {
            const list = await this.getPermissionsByProcDef(options.proc_def_id);
            if (!list || list.length === 0) {
                return { has_readable: false, has_executable: false, has_writable: false };
            }
            const userGroupIds =
                Array.isArray(options.user_organizations) && options.user_organizations.length > 0
                    ? options.user_organizations
                    : await this.__getCurrentUserKeycloakGroupIds();
            const applicable = list.filter((p: any) => {
                if (p.target_type === 'user' && p.user_id === options.user_id) return true;
                if (!p.target_type && p.user_id === options.user_id) return true;
                if (p.target_type === 'organization' && p.organization_id && userGroupIds.includes(p.organization_id)) return true;
                if (p.target_type === 'org_group' && p.org_group_id && userGroupIds.includes(p.org_group_id)) return true;
                return false;
            });
            let has_readable = false;
            let has_executable = false;
            let has_writable = false;
            for (const p of applicable) {
                if (p.readable) has_readable = true;
                if (p.executable) has_executable = true;
                if (p.writable) has_writable = true;
            }
            return { has_readable, has_executable, has_writable };
        } catch (e) {
            console.warn('[UEngineBackend] getMergedPermission failed:', e);
            return { has_readable: false, has_executable: false, has_writable: false };
        }
    }

    /** proc_def_ids 구조에서 모든 프로세스 ID 추출 (ProcessGPT와 동일) */
    private __extractProcDefIds(procDefIds: any, idSet: Set<string>): void {
        if (!procDefIds) return;
        if (procDefIds.id) idSet.add(procDefIds.id);
        if (procDefIds.major_proc_list && Array.isArray(procDefIds.major_proc_list)) {
            for (const major of procDefIds.major_proc_list) {
                if (major && major.id) idSet.add(major.id);
                if (major && major.sub_proc_list && Array.isArray(major.sub_proc_list)) {
                    for (const sub of major.sub_proc_list) {
                        if (sub && sub.id) idSet.add(sub.id);
                    }
                }
            }
        }
        if (procDefIds.sub_proc_list && Array.isArray(procDefIds.sub_proc_list)) {
            for (const sub of procDefIds.sub_proc_list) {
                if (sub && sub.id) idSet.add(sub.id);
            }
        }
    }

    /** ProcessGPT와 동일: 현재 사용자가 접근 가능한 proc_def_id 목록 */
    async getAccessibleProcDefIds(permissionType: 'readable' | 'executable' | 'writable' = 'readable'): Promise<string[]> {
        const uid = localStorage.getItem('uid');
        if (!uid) return [];
        try {
            const map = (await this.getProcessDefinitionMap()) as any;
            const allList = Array.isArray(map.user_permissions) ? map.user_permissions : [];
            const userGroupIds = await this.__getCurrentUserKeycloakGroupIds();

            const applicable: any[] = [];
            for (const p of allList) {
                const matchUser = p.target_type === 'user' || !p.target_type ? p.user_id === uid : false;
                const matchOrg = p.target_type === 'organization' && p.organization_id && userGroupIds.includes(p.organization_id);
                const matchGroup = p.target_type === 'org_group' && p.org_group_id && userGroupIds.includes(p.org_group_id);
                if (matchUser || matchOrg || matchGroup) applicable.push(p);
            }
            const filtered = applicable.filter((p) => p[permissionType] === true);
            const idSet = new Set<string>();
            for (const p of filtered) {
                if (p.proc_def_id) idSet.add(p.proc_def_id);
                if (p.proc_def_ids) this.__extractProcDefIds(p.proc_def_ids, idSet);
            }
            return Array.from(idSet);
        } catch (e) {
            console.warn('[UEngineBackend] getAccessibleProcDefIds failed:', e);
            return [];
        }
    }

    /** ProcessGPT와 동일: 권한 사용 여부 (맵에 권한이 하나라도 있으면 true) */
    async checkUsePermissions(): Promise<boolean> {
        try {
            const map = (await this.getProcessDefinitionMap()) as any;
            const list = Array.isArray(map.user_permissions) ? map.user_permissions : [];
            return list.length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * ProcessGPT filterProcDefMap과 동일: 읽기 권한에 따라 맵 필터링.
     * 권한이 정의되지 않은 프로세스는 공개, 정의된 프로세스는 readable 있을 때만 표시.
     * admin 역할은 권한 설정과 관계없이 전체 조회 가능 (lock은 별개로 동작).
     */
    async filterProcDefMap(map: any): Promise<any> {
        if (!map || !map.mega_proc_list) return map || {};
        if (canManageProcess()) return map;
        const uid = localStorage.getItem('uid');
        if (!uid) return {};

        try {
            const accessibleIds = new Set<string>(await this.getAccessibleProcDefIds('readable'));
            const restrictedIds = new Set<string>();
            const list = Array.isArray((map as any).user_permissions) ? (map as any).user_permissions : [];
            for (const p of list) {
                if (p?.proc_def_id) restrictedIds.add(p.proc_def_id);
                if (p?.proc_def_ids) this.__extractProcDefIds(p.proc_def_ids, restrictedIds);
            }

            const isProcessAllowed = (procId: string): boolean => {
                if (!restrictedIds.has(procId)) return true;
                return accessibleIds.has(procId);
            };

            const filteredMegaList = map.mega_proc_list
                .map((mega: any) => {
                    if (!mega) return null;
                    const megaAllowed = isProcessAllowed(mega.id);
                    let filteredMajorList: any[] = [];
                    if (mega.major_proc_list) {
                        filteredMajorList = mega.major_proc_list
                            .map((major: any) => {
                                if (!major) return null;
                                const majorAllowed = megaAllowed || isProcessAllowed(major.id);
                                let filteredSubList: any[] = [];
                                if (major.sub_proc_list) {
                                    filteredSubList = major.sub_proc_list.filter(
                                        (sub: any) => sub && (majorAllowed || isProcessAllowed(sub.id ?? sub.path ?? sub.name))
                                    );
                                }
                                if (majorAllowed || filteredSubList.length > 0) {
                                    return {
                                        ...major,
                                        sub_proc_list: majorAllowed ? major.sub_proc_list : filteredSubList
                                    };
                                }
                                return null;
                            })
                            .filter((m: any) => m !== null);
                    }
                    if (megaAllowed || filteredMajorList.length > 0) {
                        return {
                            ...mega,
                            major_proc_list: megaAllowed ? mega.major_proc_list : filteredMajorList
                        };
                    }
                    return null;
                })
                .filter((m: any) => m !== null);

            return { ...map, mega_proc_list: filteredMegaList };
        } catch (e) {
            console.warn('[UEngineBackend] filterProcDefMap failed:', e);
            return map;
        }
    }

    /** uEngine 모드: 맵 JSON 내 proc_def_owners에서 해당 프로세스 담당자(owner) 반환 */
    async getOwnerByProcDef(procDefId: string): Promise<string | null> {
        try {
            const map = await this.getProcessDefinitionMap();
            const list = Array.isArray((map as any).proc_def_owners) ? (map as any).proc_def_owners : [];
            const entry = list.find((e: any) => e && e.proc_def_id === procDefId);
            return entry != null && entry.owner != null && entry.owner !== '' ? String(entry.owner) : null;
        } catch (e) {
            console.warn('[UEngineBackend] getOwnerByProcDef failed:', e);
            return null;
        }
    }

    /** uEngine 모드: 맵 JSON의 proc_def_owners에 담당자 설정 후 맵 저장 */
    async putOwner(procDefId: string, owner: string | null): Promise<void> {
        try {
            const map = (await this.getProcessDefinitionMap()) as any;
            const list = Array.isArray(map.proc_def_owners) ? [...map.proc_def_owners] : [];
            const idx = list.findIndex((e: any) => e && e.proc_def_id === procDefId);
            const payload = { proc_def_id: procDefId, owner: owner ?? null };
            if (idx >= 0) list[idx] = payload;
            else list.push(payload);
            map.proc_def_owners = list;
            await this.putProcessDefinitionMap(map);
        } catch (e) {
            console.warn('[UEngineBackend] putOwner failed:', e);
            throw e;
        }
    }

    async getProcessDefinitionMap() {
        try {
            const response = await axiosInstance.get(`/definition/map`);
            const data = this.__safeParseJson(response?.data);
            return this.__normalizeProcessDefinitionMap(data);
        } catch (error: any) {
            throw this.__friendlyError(error, 'definition-map 조회에 실패했습니다');
        }
    }

    async putProcessDefinitionMap(definitionMap: any) {
        const body = typeof definitionMap === 'object' && definitionMap?.mega_proc_list
            ? definitionMap
            : definitionMap;
        definitionMap = JSON.stringify(body);
        try {
            const response = await axiosInstance.put(`/definition/map`, definitionMap, { headers: { 'Content-Type': 'text/plain' } });
            return response.data;
        } catch (error: any) {
            throw this.__friendlyError(error, 'definition-map 저장에 실패했습니다');
        }
    }

    async getMetricsMap() {
        try {
            const response = await axiosInstance.get(`/definition/metrics`);
            return this.__normalizeMetricsMap(response?.data);
        } catch (error: any) {
            if (error?.response?.status === 404) {
                return { domains: [], mega_processes: [], processes: [] };
            }
            throw this.__friendlyError(error, 'definition-metrics 조회에 실패했습니다');
        }
    }

    async putMetricsMap(metricsMap: any) {
        try {
            const payload = JSON.stringify(
                metricsMap && typeof metricsMap === 'object'
                    ? {
                          domains: Array.isArray(metricsMap.domains) ? metricsMap.domains : [],
                          mega_processes: Array.isArray(metricsMap.mega_processes) ? metricsMap.mega_processes : [],
                          processes: Array.isArray(metricsMap.processes) ? metricsMap.processes : []
                      }
                    : { domains: [], mega_processes: [], processes: [] }
            );
            const response = await axiosInstance.put(`/definition/metrics`, payload, {
                headers: { 'Content-Type': 'text/plain' }
            });
            return response.data;
        } catch (error: any) {
            throw this.__friendlyError(error, 'definition-metrics 저장에 실패했습니다');
        }
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
        if ((window as any).$pal) {
            return {};
        }
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

    async saveBusinessRule(rule: any, options?: { isNew?: boolean }) {
        const toSave = { ...(rule || {}) };
        if (!toSave.id) toSave.id = this.__uuid();

        let currentVersion = '1.0';
        if (!options?.isNew) {
            const existingRaw = await this.getRawDefinition(`businessRules/${encodeURIComponent(String(toSave.id))}`, { type: 'rule' });
            if (existingRaw) {
                const existingDto = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
                if (existingDto.version) {
                    const versionParts = String(existingDto.version).split('.');
                    const major = parseInt(versionParts[0] || '1', 10);
                    const minor = parseInt(versionParts[1] || '0', 10);
                    currentVersion = `${major}.${minor + 1}`;
                } else {
                    currentVersion = '1.1';
                }
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

    async claimWorkItem(taskId: string, data: any){
        const response = await axiosInstance.post(`/work-item/${taskId}/claim`, data);
        return response.data;
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

    // Task Execution Properties API (분석용) - UEngine 모드에서는 미지원
    async saveTaskExecutionProperties(params: {
        procDefId: string;
        procInstId: string;
        activityId: string;
        activityName?: string;
        todoId?: string;
        properties: any;
        executorEmail?: string;
    }): Promise<any> {
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

    // =====================================================
    // 노드 단위 댓글 API (프로세스 정의 요소별 코멘트)
    // =====================================================

    /**
     * 프로세스 정의의 특정 요소에 대한 댓글 목록 조회
     */
    async getElementComments(procDefId: string, elementId?: string): Promise<any[]> {
        try {
            const params: Record<string, string> = { procDefId };
            if (elementId) params.elementId = elementId;
            const response = await axiosInstance.get('/definition/element-comments', { params });
            return Array.isArray(response?.data) ? response.data : [];
        } catch (e) {
            console.error('[UEngineBackend] getElementComments error:', e);
            return [];
        }
    }

    /**
     * 프로세스 정의의 모든 요소에 대한 댓글 개수 조회
     */
    async getElementCommentCounts(procDefId: string): Promise<Record<string, { total: number; unresolved: number }>> {
        try {
            const response = await axiosInstance.get('/definition/element-comment-counts', {
                params: { procDefId }
            });
            const data = response?.data;
            if (!data || typeof data !== 'object') return {};
            return data as Record<string, { total: number; unresolved: number }>;
        } catch (e) {
            console.error('[UEngineBackend] getElementCommentCounts error:', e);
            return {};
        }
    }

    /**
     * 댓글 추가
     */
    async addElementComment(comment: {
        procDefId: string;
        elementId: string;
        elementType?: string;
        elementName?: string;
        content: string;
        parentCommentId?: string;
    }): Promise<any> {
        const response = await axiosInstance.post('/definition/element-comments', {
            proc_def_id: comment.procDefId,
            element_id: comment.elementId,
            element_type: comment.elementType ?? null,
            element_name: comment.elementName ?? null,
            content: comment.content,
            parent_comment_id: comment.parentCommentId ?? null
        });
        return response?.data;
    }

    /**
     * 댓글 수정
     */
    async updateElementComment(commentId: string, content: string): Promise<any> {
        const response = await axiosInstance.patch(`/definition/element-comments/${encodeURIComponent(commentId)}`, {
            content
        });
        return response?.data;
    }

    /**
     * 댓글 삭제
     */
    async deleteElementComment(commentId: string): Promise<void> {
        await axiosInstance.delete(`/definition/element-comments/${encodeURIComponent(commentId)}`);
    }

    /**
     * 댓글 해결/미해결 처리
     */
    async resolveElementComment(commentId: string, resolved: boolean = true, resolveActionText?: string): Promise<any> {
        const response = await axiosInstance.patch(
            `/definition/element-comments/${encodeURIComponent(commentId)}/resolve`,
            { resolved, resolve_action_text: resolveActionText }
        );
        return response?.data;
    }

    // --------------- Lock API (동시 수정 방지, uEngine definition-service /definition/lock) ---------------
    /** GET은 path 쿼리 파라미터 사용. uEngine에서는 user_id가 uid(Keycloak sub / localStorage 'uid') 기준. 타임아웃 시 null 반환해 스켈레톤에서 벗어나도록 함. */
    async getLock(id: string): Promise<{ id: string; user_id: string } | null> {
        try {
            const response = await axiosInstance.get('/definition/lock', {
                params: { path: id },
                timeout: 5000
            });
            const data = response?.data;
            const userId = data?.user_id ?? data?.userId;
            if (data && data.id && userId) return { id: data.id, user_id: userId };
            return null;
        } catch (e: any) {
            if (e?.response?.status === 404) return null;
            if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) return null;
            console.warn('[getLock] Lock 조회 실패, lock 없음으로 처리:', e?.message || e);
            return null;
        }
    }

    async setLock(lockObj: { id: string; user_id: string }): Promise<any> {
        try {
            const response = await axiosInstance.put('/definition/lock', lockObj, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            return response?.data;
        } catch (e: any) {
            console.warn('[setLock] Lock 설정 실패:', e?.message || e);
            throw e;
        }
    }

    async deleteLock(id: string): Promise<void> {
        try {
            // 슬래시 포함 path는 쿼리 파라미터로 보내야 백엔드/게이트웨이에서 안정적으로 도달
            if (id.includes('/')) {
                await axiosInstance.delete('/definition/lock', {
                    params: { path: id },
                    timeout: 5000
                });
            } else {
                await axiosInstance.delete(`/definition/lock/${encodeURIComponent(id)}`, {
                    timeout: 5000
                });
            }
        } catch (e: any) {
            console.warn('[deleteLock] Lock 해제 실패 (무시하고 진행):', e?.message || e);
        }
    }

    async setupAgentKnowledge(params: any): Promise<any> {
        console.warn("setupAgentKnowledge is not implemented - only use Process-GPT Mode");
        return null;
    }

}

export default UEngineBackend;
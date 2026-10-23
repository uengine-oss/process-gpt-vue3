/**
 * MCP Hub API 클라이언트
 *
 * 게이트웨이가 /api/mcp-hub/** 를 mcp-hub 서비스로 넘긴다.
 * 테넌트는 X-Tenant-Id 헤더로 전달한다.
 */
import axios from 'axios';

const api = axios.create({
    baseURL: '/api/mcp-hub',
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    // 테넌트는 앱이 부팅하면서 window.$tenantName 에 확정해 둔다.
    // localStorage 의 tenantId 는 없을 수도 있으므로 그쪽을 우선하되 폴백을 둔다.
    const tenantId =
        localStorage.getItem('tenantId') ||
        localStorage.getItem('tenant_id') ||
        (window as any).$tenantName;
    if (tenantId) {
        config.headers['X-Tenant-Id'] = tenantId;
    }
    const email = localStorage.getItem('email') || localStorage.getItem('userEmail');
    if (email) {
        config.headers['X-User-Email'] = email;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('MCP Hub API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export type Transport = 'stdio' | 'http' | 'sse' | 'streamable-http';
export type HealthState = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

export interface ConnectionConfig {
    transport: Transport;
    command?: string | null;
    args?: string[];
    url?: string | null;
    headers?: Record<string, string>;
    env?: Record<string, string>;
    timeout_ms?: number;
}

export interface McpServerSummary {
    id: string;
    name: string;
    display_name?: string | null;
    description?: string | null;
    category?: string | null;
    tags?: string[];
    department_id?: string | null;
    owner_email?: string | null;
    status: string;
    enabled: boolean;
    is_default: boolean;
    source: string;
    version?: number | null;
    transport?: Transport | null;
    tool_count: number;
    health_state?: HealthState | null;
    health_checked_at?: string | null;
    latency_ms?: number | null;
    availability_24h?: number | null;
    consecutive_failures?: number | null;
    health_error?: string | null;
    calls_24h?: number;
    error_rate_24h?: number | null;
    p95_ms?: number | null;
    updated_at?: string | null;
}

export const mcpHubApi = {
    // ---- 서버 ----
    async listServers(params: Record<string, any> = {}): Promise<McpServerSummary[]> {
        const { data } = await api.get('/servers', { params });
        return data;
    },
    async getServer(id: string) {
        const { data } = await api.get(`/servers/${id}`);
        return data;
    },
    async createServer(payload: any, dryRun = false) {
        const { data } = await api.post('/servers', payload, { params: { dry_run: dryRun } });
        return data;
    },
    async updateServer(id: string, patch: any) {
        const { data } = await api.patch(`/servers/${id}`, patch);
        return data;
    },
    async deleteServer(id: string) {
        await api.delete(`/servers/${id}`);
    },

    // ---- JSON 붙여넣기 (기존 등록 방식) ----
    async exportJson(): Promise<{ mcpServers: Record<string, any> }> {
        const { data } = await api.get('/servers/export');
        return data;
    },
    async importJson(
        mcpServers: Record<string, any>,
        opts: { prune?: boolean; validateAfter?: boolean } = {}
    ) {
        const { data } = await api.post('/servers/import', {
            mcpServers,
            prune: opts.prune ?? true,
            validate_after: opts.validateAfter ?? true
        });
        return data;
    },

    // ---- 버전 ----
    async listVersions(id: string) {
        const { data } = await api.get(`/servers/${id}/versions`);
        return data;
    },
    async createVersion(id: string, connection: ConnectionConfig, changeNote?: string) {
        const { data } = await api.post(`/servers/${id}/versions`, {
            connection,
            change_note: changeNote ?? null
        });
        return data;
    },
    async activateVersion(id: string, version: number) {
        const { data } = await api.post(`/servers/${id}/versions/${version}/activate`);
        return data;
    },
    async diffVersions(id: string, a: number, b: number) {
        const { data } = await api.get(`/servers/${id}/versions/${a}/diff/${b}`);
        return data;
    },

    // ---- 검증 · 헬스 ----
    async validateConnection(connection: ConnectionConfig, name = 'preview') {
        const { data } = await api.post('/validate-connection', connection, { params: { name } });
        return data;
    },
    async validateServer(id: string) {
        const { data } = await api.post(`/servers/${id}/validate`);
        return data;
    },
    async refreshTools(id: string) {
        const { data } = await api.post(`/servers/${id}/refresh-tools`);
        return data;
    },
    async healthSummary() {
        const { data } = await api.get('/health/summary');
        return data;
    },
    async serverHealth(id: string, limit = 100) {
        const { data } = await api.get(`/servers/${id}/health`, { params: { limit } });
        return data;
    },
    async forceHealthCheck(id: string) {
        const { data } = await api.post(`/servers/${id}/health/check`);
        return data;
    },

    // ---- 툴 카탈로그 ----
    async listTools(params: Record<string, any> = {}) {
        const { data } = await api.get('/tools', { params });
        return data;
    },
    async agentTools(agentId: string) {
        const { data } = await api.get(`/agents/${agentId}/tools`);
        return data;
    },
    async getBindings(agentId: string) {
        const { data } = await api.get(`/agents/${agentId}/bindings`);
        return data;
    },
    async setBindings(agentId: string, bindings: any[]) {
        const { data } = await api.put(`/agents/${agentId}/bindings`, bindings);
        return data;
    },

    // ---- 권한 ----
    async getPermissions(id: string) {
        const { data } = await api.get(`/servers/${id}/permissions`);
        return data;
    },
    async setPermissions(id: string, entries: any[]) {
        const { data } = await api.put(`/servers/${id}/permissions`, entries);
        return data;
    },

    // ---- 갤러리 · 레지스트리 ----
    async gallery() {
        const { data } = await api.get('/catalog/gallery');
        return data;
    },
    async searchRegistry(q: string, limit = 30) {
        const { data } = await api.get('/catalog/registry/search', { params: { q, limit } });
        return data;
    },
    async install(payload: any) {
        const { data } = await api.post('/catalog/install', payload);
        return data;
    },

    // ---- 관측 ----
    async obsSummary(range = '24h') {
        const { data } = await api.get('/observability/summary', { params: { range } });
        return data;
    },
    async obsServers(range = '24h') {
        const { data } = await api.get('/observability/servers', { params: { range } });
        return data;
    },
    async obsTools(range = '24h', limit = 50) {
        const { data } = await api.get('/observability/tools', { params: { range, limit } });
        return data;
    },
    async obsCalls(params: Record<string, any> = {}) {
        const { data } = await api.get('/observability/calls', { params });
        return data;
    },
    async obsTimeseries(range = '24h', bucket = '1 hour') {
        const { data } = await api.get('/observability/timeseries', { params: { range, bucket } });
        return data;
    },
    async taskObservability(todoId: string) {
        const { data } = await api.get(`/observability/tasks/${todoId}`);
        return data;
    },

    // ---- 연계 표준 ----
    async specGuide() {
        const { data } = await api.get('/spec/guide');
        return data;
    },
    async conformance(connection: ConnectionConfig, name = 'candidate') {
        const { data } = await api.post('/spec/conformance', connection, { params: { name } });
        return data;
    }
};

export default mcpHubApi;

// 온톨로지 데이터 화면(spec 020) — strategy-service 의 데이터셋(판단 설정)·Ontology Studio 조회·실행 이력 송신 API.
// 브라우저는 Studio 를 직접 부르지 않고 strategy-service 를 거친다.
import axios from 'axios';

const BASE = '/strategy-service/api';

function tenantId(): string {
    return (window as any).$tenantName;
}

export interface StudioClass {
    class_name: string;
    description: string;
    properties: { name: string; type?: string; description?: string }[];
    entity_count: number;
    binding_kind?: string;
}

export interface StudioSchema {
    id: string;
    name: string;
    description: string;
    total_entity_count: number;
    classes: StudioClass[];
    relationships: { name: string; from_class: string; to_class: string; description?: string }[];
}

export interface StudioColumn {
    key: string;
    filled: number;
    numeric: boolean;
    system?: boolean;
}

export interface StudioRows {
    class: string;
    total: number;
    rows: Record<string, any>[];
    columns: StudioColumn[];
    error: string | null;
}

export interface DatasetItem {
    proc_def_id: string;
    activity_id: string;
    config: Record<string, any>;
    updated_at?: string;
}

/**
 * strategy-service 가 주는 Studio 화면 주소(기본 http://localhost:27080 — Ontological Studio 서버 모드)를 브라우저가 닿는 주소로 바꾼다.
 * 서버 기준 localhost 는 외부 IP·도메인으로 접속한 사용자에게는 자기 PC 이므로, 그 경우 호스트만 현재 접속 호스트로 갈아 끼운다.
 */
export function studioWebUrl(url?: string | null): string {
    const raw = url || 'http://localhost:27080';
    try {
        const u = new URL(raw);
        const local = ['localhost', '127.0.0.1', '0.0.0.0'];
        if (local.includes(u.hostname) && !local.includes(window.location.hostname)) u.hostname = window.location.hostname;
        return u.toString().replace(/\/$/, '');
    } catch {
        return raw;
    }
}

export const ontologyDataApi = {
    async studioStatus() {
        const { data } = await axios.get(`${BASE}/studio/status`);
        return data as { rest: boolean; graph: boolean; error: string | null; studio_url: string };
    },
    async studioSchemas() {
        const { data } = await axios.get(`${BASE}/studio/schemas`);
        return data as { schemas: StudioSchema[]; studio_url: string; error: string | null };
    },
    async studioRows(className: string, where?: Record<string, any>, limit = 50) {
        const params: Record<string, any> = { limit };
        if (where && Object.keys(where).length) params.where = JSON.stringify(where);
        const { data } = await axios.get(`${BASE}/studio/classes/${encodeURIComponent(className)}/rows`, { params });
        return data as StudioRows;
    },

    async listDatasets() {
        const { data } = await axios.get(`${BASE}/decision/models`, { params: { tenant_id: tenantId() } });
        return (data?.items || []) as DatasetItem[];
    },
    async saveDataset(procDefId: string, activityId: string, config: Record<string, any>) {
        const { data } = await axios.put(`${BASE}/decision/models`, {
            tenant_id: tenantId(),
            proc_def_id: procDefId,
            activity_id: activityId || '',
            config
        });
        return data;
    },
    async deleteDataset(procDefId: string, activityId: string) {
        await axios.delete(`${BASE}/decision/models`, {
            params: { tenant_id: tenantId(), proc_def_id: procDefId, activity_id: activityId || '' }
        });
    },
    async validateDataset(config: Record<string, any>) {
        const { data } = await axios.post(`${BASE}/decision/models/validate`, { config });
        return data as { ok: boolean; errors: { field: string; message: string }[]; warnings: { field: string; message: string }[] };
    },
    async previewDataset(config: Record<string, any>, limit = 20) {
        const { data } = await axios.post(`${BASE}/decision/models/preview`, { config, limit });
        return data;
    },
    async draftDataset(body: { proc_def_id: string; activity_id: string; class_name: string; where?: Record<string, any>; name?: string }) {
        const { data } = await axios.post(`${BASE}/decision/models/draft`, body);
        return data;
    },

    async processDefinitions() {
        const { data } = await axios.get(`${BASE}/process-definitions`, { params: { tenant_id: tenantId() } });
        return (data || []) as { id: string; name: string }[];
    },
    async processActivities(procDefId: string) {
        const { data } = await axios.get(`${BASE}/process-definitions/${encodeURIComponent(procDefId)}/activities`, {
            params: { tenant_id: tenantId() }
        });
        return (data || []) as { id: string; name: string; type?: string }[];
    },

    async exportSettings() {
        const { data } = await axios.get(`${BASE}/studio/export/settings`, { params: { tenant_id: tenantId() } });
        return data;
    },
    async saveExportSettings(enabled: boolean, procDefIds: string[]) {
        const { data } = await axios.put(`${BASE}/studio/export/settings`, {
            tenant_id: tenantId(),
            enabled,
            proc_def_ids: procDefIds
        });
        return data;
    },
    async runExport(full = false) {
        const { data } = await axios.post(`${BASE}/studio/export/run`, null, { params: { tenant_id: tenantId(), full } });
        return data;
    },
    async clearExport() {
        const { data } = await axios.delete(`${BASE}/studio/export/data`, { params: { tenant_id: tenantId() } });
        return data;
    },

    // 연결 규칙(spec 021) — 폼 필드 → Studio 클래스.속성, 관계 이름
    async linkRules() {
        const { data } = await axios.get(`${BASE}/studio/links`, { params: { tenant_id: tenantId() } });
        return (data?.items || []) as LinkRule[];
    },
    async saveLinkRule(rule: Partial<LinkRule>) {
        const { data } = await axios.put(`${BASE}/studio/links`, { ...rule, tenant_id: tenantId() });
        return data as { id: number };
    },
    async deleteLinkRule(id: number) {
        await axios.delete(`${BASE}/studio/links/${id}`, { params: { tenant_id: tenantId() } });
    },
    async suggestLinkRules() {
        const { data } = await axios.get(`${BASE}/studio/links/suggest`, { params: { tenant_id: tenantId() } });
        return data as { items: LinkSuggestion[]; error: string | null };
    },
    async linkUsage(procDefId: string) {
        const { data } = await axios.get(`${BASE}/studio/links/usage`, { params: { tenant_id: tenantId(), proc_def_id: procDefId } });
        return data as LinkUsage;
    }
};

export interface LinkRule {
    id: number;
    proc_def_id: string;
    field: string;
    target_class: string;
    match_prop: string;
    relation: string;
    description: string;
    enabled: boolean;
}

export interface LinkSuggestion {
    field: string;
    target_class: string;
    match_prop: string;
    matched: number;
    distinct: number;
    share: number;
    samples: string[];
    procs: { id: string; name: string }[];
    all_procs: boolean;
    activities: string[];
    relation: string;
    exists: boolean;
}

export interface LinkUsage {
    proc_def_id: string;
    name: string;
    error: string | null;
    steps: {
        activity_id: string;
        name: string;
        type: string;
        role: string;
        decision: { name: string; reads: { class: string; role: string; filter: string }[] } | null;
        writes: {
            field: string;
            sample: string;
            links: { rule_id: number; relation: string; target_class: string; match_prop: string; enabled: boolean; count: number }[];
        }[];
    }[];
}

export function apiError(e: any): string {
    const d = e?.response?.data?.detail;
    if (d?.errors) return d.errors.map((x: any) => x.message).join(' / ');
    if (typeof d === 'string') return d;
    return e?.message || String(e);
}

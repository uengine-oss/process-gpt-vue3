/**
 * instance-classifier 마이크로서비스 클라이언트.
 * 게이트웨이(nginx)가 /instance-classifier/* 를 서비스로 프록시한다(prefix strip).
 * dev(vite)에서는 vite.config.ts 프록시가 :8088 게이트웨이로 보낸다.
 */
import axios from '@/utils/axios';

const BASE = '/instance-classifier';

export interface TopListItem {
    topic_id: number;
    topic_name: string;
    is_noise: boolean;
    keywords: string;
    count: number;
    pct: number;
    first_seen: string | null;
    last_seen: string | null;
}

export interface SimilarNeighbor {
    proc_inst_id: string;
    proc_inst_name: string | null;
    request_text: string;
    topic_id: number;
    topic_name: string;
    occurred_at: string | null;
    similarity: number | null;
    done_outputs?: Array<{
        activity_name: string;
        output: any;
        status: string;
        end_date: string | null;
    }>;
}

export const InstanceClassifierAPI = {
    async health() {
        const { data } = await axios.get(`${BASE}/health`);
        return data;
    },

    async procDefs(): Promise<Array<{ proc_def_id: string; tenant_id: string; count: number; topics: number }>> {
        const { data } = await axios.get(`${BASE}/proc-defs`);
        return data.proc_defs || [];
    },

    async topList(
        procDefId: string,
        period = 'all'
    ): Promise<{ total: number; noise_ratio: number; period: string; items: TopListItem[] }> {
        const { data } = await axios.get(`${BASE}/toplist`, { params: { proc_def_id: procDefId, period } });
        return data;
    },

    async topicInstances(procDefId: string, topicId: number, limit = 20, period = 'all') {
        const { data } = await axios.get(`${BASE}/topics/${encodeURIComponent(procDefId)}/${topicId}/instances`, {
            params: { limit, period }
        });
        return data.instances || [];
    },

    async similar(params: {
        proc_inst_id?: string;
        text?: string;
        proc_def_id?: string;
        k?: number;
        with_outputs?: boolean;
    }): Promise<{ proc_def_id: string; query_text: string; assigned_topic_id: number; neighbors: SimilarNeighbor[] }> {
        const { data } = await axios.get(`${BASE}/similar`, { params });
        return data;
    },

    async recluster(procDefId: string, opts: { min_cluster_size?: number; nr_topics?: number; tenant_id?: string } = {}) {
        const { data } = await axios.post(`${BASE}/recluster`, { proc_def_id: procDefId, ...opts });
        return data;
    },

    async ingest(procInstId: string, force = false) {
        const { data } = await axios.post(`${BASE}/ingest`, { proc_inst_id: procInstId, force });
        return data;
    }
};

export default InstanceClassifierAPI;

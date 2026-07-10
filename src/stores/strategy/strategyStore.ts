import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

// strategy 마이크로서비스 프록시 prefix.
// dev: vite proxy(:8014), prod: nginx gateway 가 /strategy-service prefix 를 strip 해 라우팅한다.
const BASE = '/strategy-service/api';

function tenantId(): string {
    return (window as any).$tenantName;
}

export const useStrategyStore = defineStore('strategy', () => {
    const loading = ref(false);
    const objectives = ref<any[]>([]);
    const processDefinitions = ref<any[]>([]);

    async function loadMap() {
        loading.value = true;
        try {
            const { data } = await axios.get(`${BASE}/map`, { params: { tenant_id: tenantId() } });
            objectives.value = data.objectives || [];
        } finally {
            loading.value = false;
        }
    }

    async function loadProcessDefinitions() {
        const { data } = await axios.get(`${BASE}/process-definitions`, { params: { tenant_id: tenantId() } });
        processDefinitions.value = data || [];
    }

    // ---- objectives -------------------------------------------------
    async function createObjective(payload: any) {
        await axios.post(`${BASE}/objectives`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function updateObjective(id: string, payload: any) {
        await axios.put(`${BASE}/objectives/${id}`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function deleteObjective(id: string) {
        await axios.delete(`${BASE}/objectives/${id}`, { params: { tenant_id: tenantId() } });
        await loadMap();
    }

    // ---- KPIs -------------------------------------------------------
    async function createKpi(payload: any) {
        await axios.post(`${BASE}/kpis`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function updateKpi(id: string, payload: any) {
        await axios.put(`${BASE}/kpis/${id}`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function deleteKpi(id: string) {
        await axios.delete(`${BASE}/kpis/${id}`, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function setManualValue(id: string, value: number) {
        await axios.post(`${BASE}/kpis/${id}/value`, { value }, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function getMeasurements(id: string) {
        const { data } = await axios.get(`${BASE}/kpis/${id}/measurements`);
        return data;
    }

    // ---- initiatives ------------------------------------------------
    async function createInitiative(payload: any) {
        await axios.post(`${BASE}/initiatives`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function updateInitiative(id: string, payload: any) {
        await axios.put(`${BASE}/initiatives/${id}`, payload, { params: { tenant_id: tenantId() } });
        await loadMap();
    }
    async function deleteInitiative(id: string) {
        await axios.delete(`${BASE}/initiatives/${id}`, { params: { tenant_id: tenantId() } });
        await loadMap();
    }

    // ---- AI 매핑 / 측정 / 설문 / 이관 -------------------------------
    async function suggestMapping(payload: { name: string; description?: string; measure_type?: string }) {
        const { data } = await axios.post(`${BASE}/ai/suggest`, payload, { params: { tenant_id: tenantId() } });
        return data;
    }
    async function runMeasurement() {
        const { data } = await axios.post(`${BASE}/measure/run`, null, { params: { tenant_id: tenantId() } });
        await loadMap();
        return data;
    }
    async function getSurveys(kpiId?: string) {
        const { data } = await axios.get(`${BASE}/surveys`, {
            params: { tenant_id: tenantId(), ...(kpiId ? { kpi_id: kpiId } : {}) }
        });
        return data;
    }
    async function getSurvey(requestId: string) {
        const { data } = await axios.get(`${BASE}/surveys/${requestId}`);
        return data;
    }
    async function respondSurvey(requestId: string, answers: any[]) {
        const { data } = await axios.post(`${BASE}/surveys/${requestId}/respond`, { answers });
        return data;
    }
    async function importLegacyBscard() {
        const { data } = await axios.post(`${BASE}/import-bscard`, null, { params: { tenant_id: tenantId() } });
        await loadMap();
        return data;
    }

    // ---- 온톨로지 그래프 / 영향도 -------------------------------------
    // 기업 운영 온톨로지(전략→프로세스→리소스→지식) 4레이어 그래프.
    async function getOntologyGraph(layers?: string[]) {
        const { data } = await axios.get(`${BASE}/ontology/graph`, {
            params: {
                tenant_id: tenantId(),
                ...(layers && layers.length ? { layers: layers.join(',') } : {})
            }
        });
        return data;
    }
    async function getNodeNeighbors(id: string, depth = 1) {
        const { data } = await axios.get(`${BASE}/ontology/nodes/${encodeURIComponent(id)}/neighbors`, {
            params: { tenant_id: tenantId(), depth }
        });
        return data;
    }
    async function getImpactKpi(id: string) {
        const { data } = await axios.get(`${BASE}/impact/kpi/${encodeURIComponent(id)}`, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }
    async function getImpactStrategy(id: string) {
        const { data } = await axios.get(`${BASE}/impact/strategy/${encodeURIComponent(id)}`, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }
    async function runOntologySync() {
        const { data } = await axios.post(`${BASE}/ontology/sync`, null, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }

    return {
        loading,
        objectives,
        processDefinitions,
        loadMap,
        loadProcessDefinitions,
        createObjective,
        updateObjective,
        deleteObjective,
        createKpi,
        updateKpi,
        deleteKpi,
        setManualValue,
        getMeasurements,
        createInitiative,
        updateInitiative,
        deleteInitiative,
        suggestMapping,
        runMeasurement,
        getSurveys,
        getSurvey,
        respondSurvey,
        importLegacyBscard,
        getOntologyGraph,
        getNodeNeighbors,
        getImpactKpi,
        getImpactStrategy,
        runOntologySync
    };
});

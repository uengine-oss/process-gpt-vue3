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

    async function resetMap() {
        const { data } = await axios.delete(`${BASE}/map`, { params: { tenant_id: tenantId() } });
        await loadMap();
        return data;
    }

    // 프로세스 정의의 활동 목록 — KPI '판단 적용 활동' 선택지(spec 018)
    async function loadProcessActivities(procDefId: string) {
        const { data } = await axios.get(`${BASE}/process-definitions/${encodeURIComponent(procDefId)}/activities`, {
            params: { tenant_id: tenantId() }
        });
        return data || [];
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
    async function deleteObjectives(ids: string[]) {
        await Promise.all(ids.map((id) => axios.delete(`${BASE}/objectives/${id}`, { params: { tenant_id: tenantId() } })));
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
    async function lookupAlignment(payload: { description: string; proc_def_id?: string | null }) {
        const { data } = await axios.post(`${BASE}/ai/alignment`, payload, { params: { tenant_id: tenantId() } });
        return data;
    }
    async function linkKpisToProcess(kpiIds: string[], procDefId: string) {
        const allKpis = objectives.value.flatMap((objective: any) => objective.kpis || []);
        const targets = allKpis.filter((kpi: any) => kpiIds.includes(kpi.id));
        await Promise.all(
            targets.map((kpi: any) =>
                axios.put(
                    `${BASE}/kpis/${kpi.id}`,
                    { ...kpi, proc_def_id: procDefId },
                    { params: { tenant_id: tenantId() } }
                )
            )
        );
        await loadMap();
        return targets.length;
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
    // asOf(YYYY-MM-DD) 를 주면 그날 시점의 KPI 값·실행 상태(spec 014 US5)
    async function getOntologyGraph(layers?: string[], asOf?: string | null) {
        const { data } = await axios.get(`${BASE}/ontology/graph`, {
            params: {
                tenant_id: tenantId(),
                ...(layers && layers.length ? { layers: layers.join(',') } : {}),
                ...(asOf ? { as_of: asOf } : {})
            }
        });
        return data;
    }
    async function getOntologyTimeline() {
        const { data } = await axios.get(`${BASE}/ontology/timeline`, { params: { tenant_id: tenantId() } });
        return data;
    }
    // 온톨로지 스키마(레이어·노드/관계 타입 메타 + 테넌트별 개수) — specs/013
    async function getOntologySchema() {
        const { data } = await axios.get(`${BASE}/ontology/schema`, { params: { tenant_id: tenantId() } });
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
    // 프로세스 변경 영향(spec 016) — 바꾸면 영향을 받는 다른 프로세스·KPI. versions=true 면 최신·이전 버전 차이로 범위를 정한다.
    async function getProcessImpact(id: string, opts: { tasks?: string[]; versions?: boolean } = {}) {
        const { data } = await axios.get(`${BASE}/impact/process/${encodeURIComponent(id)}`, {
            params: {
                tenant_id: tenantId(),
                tasks: opts.tasks?.length ? opts.tasks.join(',') : undefined,
                versions: opts.versions || undefined
            }
        });
        return data;
    }
    async function getImpactStrategy(id: string) {
        const { data } = await axios.get(`${BASE}/impact/strategy/${encodeURIComponent(id)}`, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }

    // ---- 기여도 (strategy_contribution-attribution) --------------------
    // KPI 측정에 실제 반영된 인스턴스·태스크 이력 기반 성과자(사람/에이전트) 기여도.
    async function getContributionKpi(id: string) {
        const { data } = await axios.get(`${BASE}/contribution/kpi/${encodeURIComponent(id)}`, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }
    async function getContributionPerformer(id: string) {
        const { data } = await axios.get(`${BASE}/contribution/performer/${encodeURIComponent(id)}`, {
            params: { tenant_id: tenantId() }
        });
        return data;
    }
    // 목표(+하위 전략) 범위의 성과 기여(성과자 순위) + 스킬 성장 기여(사람 기여자)를
    // analytic 결합 API 한 번으로 받는다 — 프론트가 strategy/agent-feedback 두 서비스를
    // 직접 오케스트레이션하지 않는다 (게이트웨이가 /api/analytics prefix 를 /api 로 rewrite).
    async function getObjectiveContribution(objectiveId: string) {
        const { data } = await axios.get('/api/analytics/dashboard/contribution', {
            params: { tenant_id: tenantId(), strategy_id: objectiveId }
        });
        return data;
    }
    // 익스플로러 자연어 질의 — 답변 + 근거 경로(spec 014 US3). LLM 탐색이라 수 초 걸린다.
    async function askOntology(question: string) {
        const { data } = await axios.post(`${BASE}/ontology/ask`, { tenant_id: tenantId(), question }, { timeout: 90000 });
        return data;
    }
    // 영향 가설 — 실행 지표 ↔ KPI 시계열 제안, 사람이 판정(spec 014 US4)
    async function getHypotheses(status?: string) {
        const { data } = await axios.get(`${BASE}/causal/hypotheses`, { params: { tenant_id: tenantId(), status } });
        return data;
    }
    async function discoverHypotheses() {
        const { data } = await axios.post(`${BASE}/causal/discover`, null, { params: { tenant_id: tenantId() }, timeout: 120000 });
        return data;
    }
    async function decideHypothesis(id: string, verdict: 'approved' | 'rejected' | 'pending', decidedBy: string) {
        const { data } = await axios.post(
            `${BASE}/causal/hypotheses/${encodeURIComponent(id)}/decision`,
            { verdict, decided_by: decidedBy },
            { params: { tenant_id: tenantId() } }
        );
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
        loadProcessActivities,
        loadMap,
        resetMap,
        loadProcessDefinitions,
        createObjective,
        updateObjective,
        deleteObjective,
        deleteObjectives,
        createKpi,
        updateKpi,
        deleteKpi,
        setManualValue,
        getMeasurements,
        createInitiative,
        updateInitiative,
        deleteInitiative,
        suggestMapping,
        lookupAlignment,
        linkKpisToProcess,
        runMeasurement,
        getSurveys,
        getSurvey,
        respondSurvey,
        importLegacyBscard,
        getOntologyGraph,
        getOntologySchema,
        getNodeNeighbors,
        getImpactKpi,
        getProcessImpact,
        getImpactStrategy,
        askOntology,
        getOntologyTimeline,
        getHypotheses,
        discoverHypotheses,
        decideHypothesis,
        getContributionKpi,
        getContributionPerformer,
        getObjectiveContribution,
        runOntologySync
    };
});

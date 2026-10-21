<script setup lang="ts">
// 전략–실행 온톨로지 익스플로러 (specs/013-ontology-explorer — 전략 보드 탭, 모든 모드).
// 전략 → KPI → 프로세스 → 태스크 → 실행 인스턴스 → 워크아이템 → 리소스 → 스킬 8단 워터폴.
// 노드를 고르면 상류(왜)·하류(무엇으로 실행되는가) 체인만 강조한다. 로직은 ontologyLineage.js.
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';
import { instanceRouteOf } from '@/shared/processLaunch.js';
import { useDashboardThresholds } from '@/services/dashboardThresholdsService';
import './strategyTheme.css';
import { LEVEL_TEXT, levelColor } from './achievementLevel.js';
import OntologySymbol from './OntologySymbol.vue';
import {
    COLLAPSED_WIDTH,
    EXPLORER_LAYERS,
    STAGES,
    applyColumns,
    buildIndex,
    computeMetrics,
    coursePath,
    layoutWaterfall,
    lineageOf,
    stageCounts,
    stageIndex,
    strategyConnected
} from './ontologyLineage.js';

const props = defineProps<{ focusId?: string | null }>();
const emit = defineEmits<{ (e: 'open-objective', id: string): void }>();

const store = useStrategyStore();
const router = useRouter();
const route = useRoute();

const COL_GAP = 40;
const TOP = 8;
// 워크아이템 열 — 수백 건이라 기본으로 접어 두고 요약 열만 보인다(열 순서는 스키마가 정하므로 키로 찾는다)
const workitemStage = ref(stageIndex('workitem'));

// 단계 색 — 단계는 다섯 무리로 묶인다: 계획(인디고) · 정의(틸) · 자산(슬레이트) · 실행(스카이) · 사람(푸크시아).
// 글자·아이콘색이며 흰 바탕 대비 4.5:1 이상. 열 바탕 틴트는 CSS 에서 이 색을 아주 옅게 섞어 만든다(다크 모드 대응).
// 열 순서는 스키마(columns)가 정하므로 index 가 아니라 키로 고른다. 모르는 열은 슬레이트.
const STAGE_TONE_BY_KEY: Record<string, string> = {
    strategy: '#4338ca',
    kpi: '#4338ca',
    architecture: '#0f766e',
    process: '#0f766e',
    task: '#0f766e',
    asset: '#475569',
    instance: '#0369a1',
    workitem: '#0369a1',
    resource: '#a21caf',
    skill: '#a21caf'
};
const STAGE_GROUPS = [
    { name: '계획', color: '#4338ca' },
    { name: '정의', color: '#0f766e' },
    { name: '실행', color: '#0369a1' },
    { name: '사람', color: '#a21caf' }
];
const toneOf = () => STAGES.map((st) => STAGE_TONE_BY_KEY[st.key] || '#475569');
const STAGE_COLORS = shallowRef<string[]>(toneOf());
// 코스 보라 — 선택 경로와 주 행동에만 쓴다(다른 의미로 쓰지 않는다). strategyTheme.css --sx-course 와 같은 값.
const COURSE = '#6d28d9';
const INK = 'primary';
// 단계 색을 CSS 변수로 넘긴다(열 머리·열 바탕 틴트)
function stageVars(stage: number, extra: Record<string, string> = {}): any {
    return { ...extra, '--ink': STAGE_COLORS.value[stage] };
}
const LABEL_TEXT: Record<string, string> = {
    Strategy: '전략',
    KPI: 'KPI',
    Initiative: '이니셔티브',
    Process: '프로세스',
    Task: '태스크',
    ProcessInstance: '실행 인스턴스',
    WorkItem: '워크아이템',
    User: '사용자',
    Agent: '에이전트',
    Team: '팀',
    Skill: '스킬',
    System: '시스템',
    DataObject: '데이터',
    Document: '문서',
    ProcessArea: '프로세스 영역',
    ProcessGroup: '프로세스 그룹'
};
const LABEL_ICON: Record<string, string> = {
    Strategy: 'mdi-flag-variant-outline',
    KPI: 'mdi-target',
    Initiative: 'mdi-rocket-launch-outline',
    Process: 'mdi-sitemap-outline',
    Task: 'mdi-checkbox-marked-outline',
    ProcessInstance: 'mdi-play-circle-outline',
    WorkItem: 'mdi-clipboard-text-outline',
    User: 'mdi-account-outline',
    Agent: 'mdi-robot-outline',
    Team: 'mdi-account-group-outline',
    Skill: 'mdi-star-four-points-outline',
    System: 'mdi-server-network',
    DataObject: 'mdi-file-table-outline',
    Document: 'mdi-file-document-outline',
    ProcessArea: 'mdi-view-dashboard-outline',
    ProcessGroup: 'mdi-folder-outline'
};
const REL_TEXT: Record<string, string> = {
    HAS_SUB_STRATEGY: '하위 전략',
    HAS_KPI: '측정 KPI',
    HAS_INITIATIVE: '실행과제',
    IMPACTS_KPI: 'KPI 산출',
    INFLUENCES_KPI: '영향 가설',
    EXECUTED_BY: '수행 프로세스',
    CONTAINS_TASK: '활동',
    HAS_INSTANCE: '실행',
    HAS_WORK_ITEM: '워크아이템',
    EXECUTES_TASK: '수행 활동',
    ASSIGNED_TO: '담당',
    PERFORMS: '수행',
    USES_SKILL: '스킬 사용',
    INHERITS: '상속',
    REFERENCES: '참조',
    HAS_SUB_TEAM: '하위 팀',
    MEMBER_OF: '소속',
    CONTRIBUTED_TO: '기여',
    PART_OF: '소속 그룹',
    USES_SYSTEM: '사용 시스템',
    READS_DATA: '입력 데이터',
    WRITES_DATA: '산출 데이터',
    GOVERNED_BY: '따르는 문서',
    CALLS_PROCESS: '호출',
    HANDS_OFF_TO: '인계',
    IN_CHARGE_OF: '담당 조직',
    CONFLICTS_WITH: '상충'
};
// 방향에 따라 읽는 말이 다른 관계 — 소속(PART_OF)은 지도에서 부모 → 자식으로 읽는다(ontologyLineage.buildIndex)
const REL_TEXT_DIR: Record<string, { out: string; in: string }> = {
    PART_OF: { out: '구성원', in: '소속' },
    IN_CHARGE_OF: { out: '맡은 태스크', in: '담당 조직' }
};
// 관계 출처(provenance) — 이 관계가 어디서 왔나
const ORIGIN_TEXT: Record<string, string> = {
    declared: '선언',
    measured: '측정 정의',
    synced: '동기화',
    extracted: 'LLM 추출',
    statistical: '통계 가설 승인'
};
// 코스 설명표의 좁은 종류 칸용 짧은 이름
const LABEL_SHORT: Record<string, string> = { ProcessInstance: '인스턴스', WorkItem: '워크아이템', Initiative: '이니셔티브' };
const PERSPECTIVE_TEXT: Record<string, string> = {
    financial: '재무',
    customer: '고객',
    internal_process: '내부 프로세스',
    learning_growth: '학습·성장'
};
const STATUS_TEXT: Record<string, string> = {
    COMPLETED: '완료',
    RUNNING: '진행',
    NEW: '신규',
    DONE: '완료',
    SUBMITTED: '제출',
    IN_PROGRESS: '진행',
    TODO: '대기',
    PENDING: '보류',
    CANCELLED: '취소',
    planned: '계획',
    in_progress: '진행',
    completed: '완료',
    on_hold: '보류'
};

// ---------------------------------------------------------------- 상태
const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const graph = ref<any>({ nodes: [], edges: [] });
const lastSyncedAt = ref<string | null>(null);

const selectedId = ref<string | null>(null);
const chainOnly = ref(false);
const includeUnlinked = ref(false);
const hiddenStages = ref<Set<number>>(new Set());
const collapsedStages = ref<Set<number>>(new Set([workitemStage.value]));
const compact = ref(false);
const colWidth = computed(() => (compact.value ? 168 : 200));
const search = ref('');
const showProps = ref(false);
const legendOpen = ref(false);

// 위험·주의·달성 기준 = 분석 대시보드 KPI RAG 기준값(관리자 설정, 실패 시 기본 100/50)
const dashboardThresholds = useDashboardThresholds();
const levelThresholds = computed(() => ({
    green: Number(dashboardThresholds.values?.kpi_rag_green_pct ?? 100),
    amber: Number(dashboardThresholds.values?.kpi_rag_amber_pct ?? 50)
}));

const impact = ref<any>(null);
const impactLoading = ref(false);

// 시점 (spec 014 US5) — 과거 어느 날의 KPI 값·실행 상태로 지도를 다시 그린다. null = 현재.
const timeOpen = ref(false);
const asOf = ref<string | null>(/^\d{4}-\d{2}-\d{2}$/.test(String(route.query.as_of || '')) ? String(route.query.as_of) : null);
const timeline = ref<{ first: string | null; today: string } | null>(null);
const asOfSummary = ref<any>(null);
const DAY = 86400000;
const timeSpan = computed(() => {
    const t = timeline.value;
    if (!t?.first) return 0;
    return Math.max(0, Math.round((Date.parse(t.today) - Date.parse(t.first)) / DAY));
});
const timeOffset = ref(0); // 오늘에서 며칠 전
function dateOf(offset: number): string {
    const today = timeline.value?.today || new Date().toISOString().slice(0, 10);
    return new Date(Date.parse(today) - offset * DAY).toISOString().slice(0, 10);
}
let timeTimer: any = null;
function onTimeSlide(v: number) {
    timeOffset.value = v;
    clearTimeout(timeTimer);
    timeTimer = setTimeout(() => {
        asOf.value = v > 0 ? dateOf(v) : null;
        load();
    }, 250);
}
function toNow() {
    timeOffset.value = 0;
    asOf.value = null;
    load();
}
async function openTime() {
    timeOpen.value = !timeOpen.value;
    if (timeOpen.value && !timeline.value) {
        try {
            timeline.value = await store.getOntologyTimeline();
        } catch {
            timeline.value = null;
        }
    }
}

// 질문하기 (spec 014 US3) — 에이전트가 온톨로지 도구로 탐색한 답과, 그 근거 노드를 코스로 그린다
const askOpen = ref(false);
const askText = ref('');
const askLoading = ref(false);
const askResult = ref<any>(null);
const askError = ref('');
// 예시 질문은 지금 지도의 데이터에서 만든다 — 가장 뒤처진 KPI, 에이전트 하나, 가장 오래 걸리는 태스크
function josa(word: string, withFinal: string, withoutFinal: string) {
    const code = (word || '').trim().slice(-1).charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 ? withFinal : withoutFinal;
}
const ASK_EXAMPLES = computed<string[]>(() => {
    const nodes = [...index.value.nodes.values()] as any[];
    const kpi = nodes
        .filter((n) => n.label === 'KPI' && metrics.value.get(n.id)?.achievement != null)
        .sort((a, b) => metrics.value.get(a.id).achievement - metrics.value.get(b.id).achievement)[0];
    const agent = nodes.find((n) => n.label === 'Agent');
    const task = nodes
        .filter((n) => n.label === 'Task' && metrics.value.get(n.id)?.avgHours != null)
        .sort((a, b) => metrics.value.get(b.id).avgHours - metrics.value.get(a.id).avgHours)[0];
    return [
        kpi && `${kpi.name}${josa(kpi.name, '이', '가')} 왜 목표 미달이야?`,
        agent && `${agent.name}${josa(agent.name, '은', '는')} 어떤 전략에 기여해?`,
        task && `${task.name}${josa(task.name, '이', '가')} 오래 걸리는 담당자는?`
    ].filter(Boolean) as string[];
});
const ASK_TOOL_TEXT: Record<string, string> = {
    ontology_schema: '온톨로지 구조 읽기',
    ontology_resolve_entity: '이름 찾기',
    ontology_get_node: '노드 조회',
    ontology_trace: '체인 추적',
    ontology_kpi_root_cause: '원인 분석',
    ontology_list_nodes: '목록 조회'
};

const canvasEl = ref<HTMLElement | null>(null);
const detailEl = ref<HTMLElement | null>(null);

const index = computed(() => buildIndex(graph.value));
const metrics = computed(() => computeMetrics(index.value, levelThresholds.value));
const connected = computed(() => strategyConnected(index.value));
const hasStrategy = computed(() => [...index.value.nodes.values()].some((n: any) => n.stage === 0));
const chain = computed(() => (selectedId.value ? lineageOf(index.value, selectedId.value) : null));

// 교차 필터(spec 014 US6) — 분석 대시보드에서 도메인을 들고 오면 그 도메인의 프로세스와 그 체인만 보인다(한 홉: 도메인 → 프로세스)
const domainFilter = ref<string | null>(route.query.domain ? String(route.query.domain) : null);
const domainProcesses = computed<string[]>(() =>
    domainFilter.value
        ? [...index.value.nodes.values()]
              .filter((n: any) => n.label === 'Process' && n.properties?.domain === domainFilter.value)
              .map((n: any) => n.id)
        : []
);
const domainIds = computed<Set<string> | null>(() => {
    if (!domainFilter.value) return null;
    const ids = new Set<string>();
    for (const pid of domainProcesses.value) for (const id of lineageOf(index.value, pid).nodes) ids.add(id);
    return ids;
});
function clearDomain() {
    domainFilter.value = null;
    router.replace({ query: { ...route.query, domain: undefined } });
}
// 도메인 필터가 있는 분석 대시보드는 PAL 모드 화면(/analysis-dashboard)이다 — 다른 모드에서는 버튼을 숨긴다
const hasFilterDashboard = !!(window as any).$pal;
function openInDashboard(n: any) {
    const query: Record<string, string> = {};
    if (n?.properties?.domain) query.domain = n.properties.domain;
    if (asOf.value && timeline.value?.first) {
        query.from = timeline.value.first;
        query.to = asOf.value;
    }
    router.push({ path: '/analysis-dashboard', query });
}
const baseIds = computed<Set<string>>(() => {
    const base = includeUnlinked.value ? new Set(index.value.nodes.keys()) : new Set(connected.value.nodes);
    if (!domainIds.value) return base;
    return new Set(
        [...domainIds.value].filter((id) => includeUnlinked.value || base.has(id) || index.value.nodes.get(id)?.stage > stageIndex('kpi'))
    );
});
const visibleIds = computed<Set<string>>(() => {
    const base = chainOnly.value && chain.value ? chain.value.nodes : baseIds.value;
    const ids = new Set<string>();
    for (const id of base) {
        const n: any = index.value.nodes.get(id);
        if (n && !hiddenStages.value.has(n.stage)) ids.add(id);
    }
    return ids;
});
// 노드가 하나라도 있는 단계만 열로 그린다(사용자가 끈 단계 제외)
const stageTotals = computed(() => stageCounts(index.value, baseIds.value));
const visibleStages = computed(() =>
    STAGES.map((_, i) => i).filter((i) => !hiddenStages.value.has(i) && stageCounts(index.value, visibleIds.value)[i] > 0)
);
// 코스 — 선택 노드를 지나는 결정적 경로(단계마다 가장 나쁜 노드). 번호는 전체 코스 기준, 접힌 열의 지점은 표에만 나온다.
const askPath = computed<string[]>(() =>
    (askResult.value?.path || []).map((p: any) => p.id).filter((id: string) => index.value.nodes.has(id))
);
const course = computed<string[]>(() =>
    askPath.value.length ? askPath.value : selectedId.value ? coursePath(index.value, metrics.value, selectedId.value) : []
);
const layout = computed(() =>
    layoutWaterfall(index.value, visibleIds.value, visibleStages.value, {
        colWidth: colWidth.value,
        colGap: COL_GAP,
        top: TOP,
        collapsed: collapsedStages.value,
        pinFirst: new Set(course.value)
    })
);

const searchMatches = computed<Set<string>>(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return new Set();
    const ids = new Set<string>();
    for (const id of layout.value.positions.keys()) {
        const n: any = index.value.nodes.get(id);
        if (
            String(n.name || '')
                .toLowerCase()
                .includes(q)
        )
            ids.add(id);
    }
    return ids;
});

// 그릴 엣지 — 선택 전에는 이웃한 열(과 같은 열) 사이만 옅게, 선택 후에는 체인 엣지만.
// 열을 건너뛰는 엣지(프로세스→인스턴스, 태스크→워크아이템)는 선택 체인일 때만 점선으로 그린다.
// 선택 후에는 열을 건너뛰는 엣지를 그리지 않는다(코스가 그 역할). 휴지 상태에서 한 노드의 같은 방향 팬아웃이
// 6개를 넘으면 그 노드에 마우스를 올렸을 때만 그린다 — 빗금 덩어리 방지.
const hoverId = ref<string | null>(null);
// 호버와 무관한 부분(후보 선별·경로 문자열)은 여기서 한 번만 계산하고, 호버는 hoverEdges 가 따로 고른다
// — 카드에 마우스를 올릴 때마다 모든 엣지 경로를 다시 만들지 않게.
const edgeSets = computed(() => {
    const pos = layout.value.positions;
    const colOf = new Map(layout.value.columns.map((c: any, i: number) => [c.stage, i]));
    const candidates: any[] = [];
    const fan = new Map<string, number>();
    for (const e of index.value.edges) {
        if (!pos.has(e.source) || !pos.has(e.target)) continue;
        const inChain = chain.value ? chain.value.edges.has(e.id) : false;
        if (chain.value && !inChain) continue;
        const gap = Math.abs(
            (colOf.get(index.value.nodes.get(e.source).stage) ?? 0) - (colOf.get(index.value.nodes.get(e.target).stage) ?? 0)
        );
        if (gap > 1) continue;
        candidates.push({ ...e, inChain });
        fan.set(e.source, (fan.get(e.source) || 0) + 1);
    }
    const shown: any[] = [];
    const onHover: any[] = [];
    for (const e of candidates) {
        const drawn = { ...e, skip: false, d: edgePath(pos.get(e.source), pos.get(e.target)) };
        if (chain.value || (fan.get(e.source) || 0) <= 6) shown.push(drawn);
        else onHover.push(drawn);
    }
    return { shown, onHover };
});
const drawnEdges = computed(() => edgeSets.value.shown);
const hoverEdges = computed(() => {
    const h = hoverId.value;
    if (!h) return [];
    return edgeSets.value.onHover.filter((e: any) => e.source === h || e.target === h);
});

function edgePath(a: any, b: any) {
    if (Math.abs(a.x - b.x) < colWidth.value / 2) {
        // 같은 열(하위 전략·팀 소속·스킬 관계) — 왼쪽으로 휘는 호
        const ax = a.x;
        const ay = a.y + a.h / 2;
        const bx = b.x;
        const by = b.y + b.h / 2;
        const bend = Math.min(40, 12 + Math.abs(by - ay) / 6);
        return `M${ax},${ay} C${ax - bend},${ay} ${bx - bend},${by} ${bx},${by}`;
    }
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const x1 = l.x + l.w;
    const y1 = l.y + l.h / 2;
    const x2 = r.x;
    const y2 = r.y + r.h / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

const selected = computed<any>(() => (selectedId.value ? index.value.nodes.get(selectedId.value) : null));

const courseNo = computed(() => new Map(course.value.map((id, i) => [id, i + 1])));
const courseDrawn = computed(() => {
    const pos = layout.value.positions;
    const pts = course.value
        .filter((id) => pos.has(id))
        .map((id) => {
            const p = pos.get(id);
            // 통제점 원은 카드 왼쪽 바깥 여백에 둔다(카드 아이콘을 가리지 않게)
            return { id, no: courseNo.value.get(id), x: p.x, cx: p.x - 11, y: p.y + p.h / 2, w: p.w };
        });
    const legs = [];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        // 다른 열: 앞 지점 카드 오른쪽 → 다음 지점 카드 왼쪽, 같은 열: 왼쪽 여백으로 휘어 내려간다
        legs.push(
            Math.abs(a.x - b.x) < colWidth.value / 2
                ? `M${a.cx},${a.y + 9} C${a.cx - 14},${a.y + 30} ${b.cx - 14},${b.y - 30} ${b.cx},${b.y - 9}`
                : `M${a.x + a.w},${a.y} L${b.cx - 9},${b.y}`
        );
    }
    return { pts, legs };
});
const courseRows = computed(() =>
    course.value.map((id) => {
        const n: any = index.value.nodes.get(id);
        return { id, no: courseNo.value.get(id), n, flags: cardFlags(n), positioned: layout.value.positions.has(id) };
    })
);
const chainSummary = computed(() => (chain.value ? stageCounts(index.value, chain.value.nodes) : null));

// 상세 패널의 직접 연결(관계 유형별) — 관계마다 출처를 붙인다. 통계 가설 관계는 r·시차도.
function hypoNote(edge: any): string {
    const p = edge.properties || {};
    if (edge.rel_type !== 'INFLUENCES_KPI' || p.r == null) return '';
    const lag = p.lag_weeks ? `${p.lag_weeks}주 뒤` : '같은 주';
    return `r ${Number(p.r) > 0 ? '+' : ''}${fmt(p.r, 2)} · ${lag}`;
}
const directLinks = computed(() => {
    if (!selected.value) return [];
    const groups = new Map<string, any>();
    for (const { edge, other, outgoing } of index.value.adj.get(selected.value.id) || []) {
        const dir = REL_TEXT_DIR[edge.rel_type];
        const text = dir ? (outgoing ? dir.out : dir.in) : REL_TEXT[edge.rel_type] || edge.rel_type;
        const key = `${outgoing ? '→' : '←'} ${text}`;
        if (!groups.has(key)) groups.set(key, { rel: key, origin: ORIGIN_TEXT[edge.origin] || '', items: [] });
        groups.get(key).items.push({ n: index.value.nodes.get(other), note: hypoNote(edge) });
    }
    return [...groups.values()];
});

// ---------------------------------------------------------------- 영향 가설 (spec 014 US4)
const hypoOpen = ref(false);
const hypos = ref<any[]>([]);
const hypoLoading = ref(false);
const hypoBusy = ref<string | null>(null);
const hypoError = ref('');
const pendingHypos = computed(() => hypos.value.filter((h) => h.status === 'pending').length);
const HYPO_STATUS: Record<string, string> = { pending: '검토 대기', approved: '승인', rejected: '거절' };
async function loadHypos() {
    try {
        hypos.value = (await store.getHypotheses()).hypotheses || [];
    } catch {
        hypos.value = [];
    }
}
async function rediscover() {
    hypoLoading.value = true;
    hypoError.value = '';
    try {
        await store.discoverHypotheses();
        await loadHypos();
    } catch (e: any) {
        hypoError.value = e?.response?.data?.detail || e?.message || '분석에 실패했습니다.';
    } finally {
        hypoLoading.value = false;
    }
}
async function decideHypo(h: any, verdict: 'approved' | 'rejected' | 'pending') {
    hypoBusy.value = h.id;
    try {
        const who = localStorage.getItem('userName') || localStorage.getItem('email') || 'unknown';
        await store.decideHypothesis(h.id, verdict, who);
        await Promise.all([loadHypos(), load()]);
    } catch (e: any) {
        hypoError.value = e?.response?.data?.detail || e?.message || '판정을 저장하지 못했습니다.';
    } finally {
        hypoBusy.value = null;
    }
}
function hypoLag(h: any) {
    return h.lag_weeks ? `${h.lag_weeks}주 뒤 KPI` : '같은 주 KPI';
}

// ---------------------------------------------------------------- 표시 헬퍼
function fmt(v: any, digits = 1) {
    if (v == null || v === '') return '-';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}
function fmtHours(h: any) {
    if (h == null) return '-';
    return h >= 48 ? `${fmt(h / 24)}일` : `${fmt(h)}시간`;
}
function fmtDate(v: any) {
    if (!v) return '-';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}
// 달성률 색 — 전략맵 탭과 같은 단계·색(achievementLevel.js)
function levelOf(id: string) {
    return metrics.value.get(id)?.level || null;
}
function levelHex(id: string) {
    return levelColor(levelOf(id));
}
const levelLegend = computed(
    () =>
        `위험 ${levelThresholds.value.amber}% 미만 · 주의 ${levelThresholds.value.amber}~${levelThresholds.value.green - 1}% · 양호 ${
            levelThresholds.value.green
        }% 이상`
);
// "10월 7일 05:14 (2시간 전)"
function fmtSynced(v: any) {
    if (!v) return '-';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    const abs = d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    const rel =
        min < 1 ? '방금' : min < 60 ? `${min}분 전` : min < 1440 ? `${Math.round(min / 60)}시간 전` : `${Math.round(min / 1440)}일 전`;
    return `${abs} (${rel})`;
}
function subtitle(n: any): string {
    const p = n.properties || {};
    const m: any = metrics.value.get(n.id) || {};
    switch (n.label) {
        case 'Strategy':
            return [PERSPECTIVE_TEXT[p.perspective], m.achievement != null ? `달성 ${fmt(m.achievement)}%` : null]
                .filter(Boolean)
                .join(' · ');
        case 'KPI':
            return `${fmt(p.current_value)} / ${fmt(p.target_value)}${p.unit ? ` ${p.unit}` : ''}${
                m.achievement != null ? ` · ${fmt(m.achievement)}%` : ''
            }`;
        case 'Initiative':
            return `${STATUS_TEXT[p.status] || p.status || ''} · ${fmt(p.progress)}%`;
        case 'Process':
            return m.instances ? `실행 ${m.instances} · 완료 ${m.completed} · 평균 ${fmtHours(m.avgHours)}` : '실행 이력 없음';
        case 'Task':
            return m.workItems ? `${m.workItems}건 · 평균 ${fmtHours(m.avgHours)}` : '';
        case 'ProcessInstance':
            return `${STATUS_TEXT[p.status] || p.status || ''}${p.duration_hours != null ? ` · ${fmtHours(p.duration_hours)}` : ''}`;
        case 'WorkItem':
            return `${STATUS_TEXT[p.status] || p.status || ''}${p.duration_hours != null ? ` · ${fmtHours(p.duration_hours)}` : ''}`;
        case 'System':
        case 'Document':
        case 'DataObject':
            return assetUsage(n);
        case 'ProcessArea':
        case 'ProcessGroup':
            return memberCount(n);
        default:
            return LABEL_TEXT[n.label] || n.label;
    }
}
// 시스템·데이터·문서 카드 둘째 줄 — 몇 개 태스크(문서는 프로세스 포함)가 쓰는가. 데이터는 쓰기·읽기를 나눈다.
function assetUsage(n: any): string {
    const adj = index.value.adj.get(n.id) || [];
    const by = (rel: string) => adj.filter((a: any) => a.edge.rel_type === rel && !a.outgoing).length;
    if (n.label === 'DataObject') return `데이터 · 쓰기 ${by('WRITES_DATA')} · 읽기 ${by('READS_DATA')}`;
    if (n.label === 'System') return `시스템 · 태스크 ${by('USES_SYSTEM')}`;
    return `문서 · 연결 ${by('GOVERNED_BY')}`;
}
// 영역·그룹 카드 둘째 줄 — 바로 아래 구성원 수(영역은 그룹, 그룹은 프로세스)
function memberCount(n: any): string {
    const kids = (index.value.adj.get(n.id) || []).filter((a: any) => a.edge.rel_type === 'PART_OF' && a.outgoing);
    return n.label === 'ProcessArea' ? `영역 · 그룹 ${kids.length}` : `그룹 · 프로세스 ${kids.length}`;
}
// 카드 둘째 줄 — 달성률은 앞에 숫자로 따로 보이므로 나머지만
function subtitleRest(n: any): string {
    const p = n.properties || {};
    if (n.label === 'KPI') return `${fmt(p.current_value)} / ${fmt(p.target_value)}${p.unit ? ` ${p.unit}` : ''}`;
    if (n.label === 'Strategy') return PERSPECTIVE_TEXT[p.perspective] || '';
    return subtitle(n);
}
// 카드 title·aria 용 상태 문구(카드에는 기호만 보이므로)
function stateText(n: any, flags?: any): string {
    const f = flags || cardFlags(n);
    const words = [f.risk && '위험', f.warn && '주의', f.bottleneck && '병목', f.overdue && '지연', f.unlinked && '실행 미연결'].filter(
        Boolean
    );
    return words.length ? ` (${words.join(', ')})` : '';
}
// 코스 설명표의 값 칸
function courseValue(n: any): string {
    const m: any = metrics.value.get(n.id) || {};
    const p = n.properties || {};
    switch (n.label) {
        case 'Strategy':
        case 'KPI':
            return m.achievement != null ? `${fmt(m.achievement)}%` : '-';
        case 'Process':
            return `평균 ${fmtHours(m.avgHours)}`;
        case 'Task':
            return fmtHours(m.avgHours);
        case 'ProcessInstance':
        case 'WorkItem':
            return p.duration_hours != null ? fmtHours(p.duration_hours) : STATUS_TEXT[p.status] || '';
        default:
            return '';
    }
}

// 카드 상태: 위험(채움 배지+테두리+틴트) > 주의(외곽선 배지) > 달성(표시 없음). 병목은 위험급, 지연은 주의급.
function cardFlags(n: any) {
    const m: any = metrics.value.get(n.id) || {};
    const p = n.properties || {};
    const scored = n.label === 'KPI' || n.label === 'Strategy';
    return {
        risk: scored && m.level === 'risk',
        warn: scored && m.level === 'warn',
        bottleneck: !!m.bottleneck,
        overdue: (n.label === 'ProcessInstance' || n.label === 'WorkItem') && !!p.is_overdue,
        unlinked: n.label === 'KPI' && m.linked === false && p.measure_type !== 'manual'
    };
}
function cardClass(id: string) {
    const inChain = chain.value ? chain.value.nodes.has(id) : true;
    const ripple = rippleOf.value.get(id);
    return {
        selected: id === selectedId.value,
        dimmed: !inChain && !ripple,
        match: searchMatches.value.has(id),
        'ripple-high': ripple === 'high' || ripple === 'kpi',
        'ripple-medium': ripple === 'medium',
        'ripple-low': ripple === 'low'
    };
}

// 캔버스 카드 — 카드마다 템플릿에서 여러 번 부르던 계산(노드 조회·상태·클래스·문구)을 한 번에 만든다.
// 호버·스크롤은 여기에 의존하지 않으므로 카드는 v-memo 로 다시 그리지 않는다.
const cardViews = computed(() => {
    const out: any[] = [];
    const nodes = index.value.nodes;
    for (const [id, pos] of layout.value.positions) {
        const n: any = nodes.get(id);
        if (!n) continue;
        const flags = cardFlags(n);
        const cls = cardClass(id);
        const state = stateText(n, flags);
        const ach = metrics.value.get(id)?.achievement;
        out.push({
            id,
            pos,
            label: n.label,
            name: n.name,
            cls: [cls, flags],
            symbol: flags.risk || flags.bottleneck ? 'risk' : flags.warn || flags.overdue ? 'warn' : null,
            icon: LABEL_ICON[n.label],
            iconColor: STAGE_COLORS.value[n.stage],
            title: `${n.name}${state}`,
            aria: `${LABEL_TEXT[n.label]} ${n.name}${state}`,
            ach: ach != null ? fmt(ach) : null,
            achColor: cls.dimmed ? undefined : levelHex(id),
            sub: pos.h > 40 ? subtitleRest(n) : '',
            unlinked: flags.unlinked,
            selected: id === selectedId.value
        });
    }
    return out;
});

// 상세 패널 속성 표 — 라벨별로 의미 있는 속성만
const PROP_ROWS: Record<string, [string, string, ((v: any) => string)?][]> = {
    Strategy: [
        ['perspective', '관점', (v) => PERSPECTIVE_TEXT[v] || v],
        ['importance', '중요도'],
        ['priority', '판단 우선순위', (v) => `${v}${Number(v) === 1 ? ' (최우선)' : ''}`],
        ['description', '설명']
    ],
    KPI: [
        ['current_value', '현재값', fmt],
        ['target_value', '목표', fmt],
        ['baseline_value', '기준선', fmt],
        ['unit', '단위'],
        ['direction', '방향', (v) => (v === 'decrease' ? '낮을수록 좋음' : '높을수록 좋음')],
        ['measure_type', '측정 방식'],
        ['kpi_role', '선행/후행', (v) => (v === 'leading' ? '선행' : v === 'lagging' ? '후행' : v)],
        ['priority', '판단 우선순위', (v) => `${v}${Number(v) === 1 ? ' (최우선)' : ''}`],
        ['last_measured_at', '최근 측정', fmtDate]
    ],
    Initiative: [
        ['status', '상태', (v) => STATUS_TEXT[v] || v],
        ['progress', '진척(%)'],
        ['owner_email', '담당'],
        ['due_date', '기한', fmtDate]
    ],
    Task: [['activity_id', '활동 ID']],
    ProcessInstance: [
        ['status', '상태', (v) => STATUS_TEXT[v] || v],
        ['start_date', '시작', fmtDate],
        ['end_date', '완료', fmtDate],
        ['due_date', '기한', fmtDate],
        ['duration_hours', '소요', fmtHours],
        ['is_overdue', '지연', (v) => (v ? '예' : '아니오')]
    ],
    WorkItem: [
        ['status', '상태', (v) => STATUS_TEXT[v] || v],
        ['username', '담당자'],
        ['start_date', '시작', fmtDate],
        ['end_date', '완료', fmtDate],
        ['duration_hours', '소요', fmtHours],
        ['is_overdue', '지연', (v) => (v ? '예' : '아니오')],
        ['rework_count', '재작업']
    ],
    User: [['email', '이메일']],
    Agent: [['email', '이메일']],
    Skill: [['description', '설명']],
    System: [
        ['category', '분류'],
        ['description', '설명']
    ],
    DataObject: [
        ['kind', '종류', (v) => (v === 'store' ? '데이터 저장소' : '데이터 객체')],
        ['process_count', '쓰는 프로세스 수']
    ],
    Document: [
        ['kind', '종류', (v) => (v === 'link' ? '링크' : '파일')],
        ['link_url', '링크']
    ],
    ProcessArea: [['domain_id', '도메인']],
    ProcessGroup: [['domain_id', '도메인']]
};
// 프로세스 소속(프로세스 맵) — 영역·그룹은 열로 그리지 않고 원본 그래프의 PART_OF 로 찾는다
const membershipOf = computed(() => {
    const names = new Map<string, any>((graph.value?.nodes || []).map((n: any) => [n.id, n]));
    const parent = new Map<string, string>();
    for (const e of graph.value?.edges || []) if (e.rel_type === 'PART_OF') parent.set(e.source, e.target);
    return (id: string) => {
        const g = parent.get(id);
        const a = g ? parent.get(g) : undefined;
        return { group: g ? names.get(g)?.name || g : null, area: a ? names.get(a)?.name || a : null };
    };
});
const propRows = computed(() => {
    if (!selected.value) return [];
    const p = selected.value.properties || {};
    const rows = (PROP_ROWS[selected.value.label] || [])
        .filter(([key]) => p[key] != null && p[key] !== '')
        .map(([key, text, f]) => ({ text, value: f ? f(p[key]) : String(p[key]) }));
    if (selected.value.label === 'Process') {
        const m = membershipOf.value(selected.value.id);
        if (m.area) rows.push({ text: '영역', value: m.area });
        if (m.group) rows.push({ text: '그룹', value: m.group });
    }
    return rows;
});

// 담당 · 조직 — Lane 은 개인 역할일 수도, 특정 조직이 맡는 일일 수도 있다(strategy-service app/lane_org.py).
// 태스크 ← 담당 조직(IN_CHARGE_OF) · 담당자(PERFORMS), 사람 → 소속(MEMBER_OF), 팀 → 상위(HAS_SUB_TEAM)를 원본 그래프에서 모은다.
const LANE_MATCH_TEXT: Record<string, string> = {
    lane_setting: 'Lane 에 조직 지정',
    endpoint: '역할에 팀 지정',
    lane_name: 'Lane 이름 = 팀 이름'
};
const orgIndex = computed(() => {
    const byId = new Map<string, any>((graph.value?.nodes || []).map((n: any) => [n.id, n]));
    const parent = new Map<string, string>();
    const members = new Map<string, string[]>();
    const teamsOf = new Map<string, string[]>();
    const inCharge = new Map<string, any[]>();
    const performers = new Map<string, string[]>();
    const taskOf = new Map<string, string>();
    const assignees = new Map<string, string[]>();
    const push = (m: Map<string, any[]>, k: string, v: any) => (m.get(k) || m.set(k, []).get(k)!).push(v);
    for (const e of graph.value?.edges || []) {
        if (e.rel_type === 'HAS_SUB_TEAM') parent.set(e.target, e.source);
        else if (e.rel_type === 'MEMBER_OF') push(members, e.target, e.source), push(teamsOf, e.source, e.target);
        else if (e.rel_type === 'IN_CHARGE_OF')
            push(inCharge, e.target, { team: e.source, lane: e.properties?.lane, match: e.properties?.match });
        else if (e.rel_type === 'PERFORMS' && e.properties?.source !== 'execution') push(performers, e.target, e.source);
        else if (e.rel_type === 'EXECUTES_TASK') taskOf.set(e.source, e.target);
        else if (e.rel_type === 'ASSIGNED_TO') push(assignees, e.source, e.target);
    }
    // 상위 조직 경로 — 'BPM 사업부 › 운영'
    const pathOf = (teamId: string) => {
        const names: string[] = [];
        for (let id: string | undefined = parent.get(teamId), guard = 0; id && guard < 8; id = parent.get(id), guard++) {
            const n = byId.get(id);
            if (n) names.unshift(n.name);
        }
        return names.join(' › ');
    };
    return { byId, parent, members, teamsOf, inCharge, performers, taskOf, assignees, pathOf };
});
const assignInfo = computed<any>(() => {
    const n = selected.value;
    if (!n) return null;
    const o = orgIndex.value;
    const teamView = (id: string, extra: any = {}) => ({
        id,
        name: o.byId.get(id)?.name || id,
        path: o.pathOf(id),
        memberCount: (o.members.get(id) || []).length,
        selectable: index.value.nodes.has(id),
        ...extra
    });
    const nodeView = (id: string) => ({
        id,
        name: o.byId.get(id)?.name || id,
        label: o.byId.get(id)?.label,
        selectable: index.value.nodes.has(id)
    });
    if (n.label === 'Task' || n.label === 'WorkItem') {
        const taskId = n.label === 'Task' ? n.id : o.taskOf.get(n.id);
        const task = taskId ? o.byId.get(taskId) : null;
        const teams = (taskId && o.inCharge.get(taskId)) || [];
        const lane = task?.properties?.lane || teams[0]?.lane || '';
        const teamIds = new Set(teams.map((t: any) => t.team));
        const people =
            n.label === 'Task' ? [...new Set((taskId && o.performers.get(taskId)) || [])] : [...new Set(o.assignees.get(n.id) || [])];
        // 워크아이템 담당자가 Lane 담당 조직(하위 조직 포함) 구성원인가
        const inOrg = (uid: string) =>
            (o.teamsOf.get(uid) || []).some((t) => {
                for (let id: string | undefined = t, g = 0; id && g < 8; id = o.parent.get(id), g++) if (teamIds.has(id)) return true;
                return false;
            });
        if (!lane && !teams.length && !people.length) return null;
        return {
            kind: 'task',
            lane,
            teams: teams.map((t: any) => teamView(t.team, { match: LANE_MATCH_TEXT[t.match] || '' })),
            people: people.map((id) => ({ ...nodeView(id), inOrg: teamIds.size ? inOrg(id) : null })),
            peopleText: n.label === 'Task' ? '정의상 담당자' : '실제 담당자'
        };
    }
    if (n.label === 'User' || n.label === 'Agent') {
        const teams = o.teamsOf.get(n.id) || [];
        return teams.length ? { kind: 'member', teams: teams.map((id) => teamView(id)) } : null;
    }
    if (n.label === 'Team') {
        const lanes = new Set<string>();
        let tasks = 0;
        for (const list of o.inCharge.values())
            for (const t of list)
                if (t.team === n.id) {
                    tasks++;
                    if (t.lane) lanes.add(t.lane);
                }
        return {
            kind: 'team',
            path: o.pathOf(n.id),
            members: (o.members.get(n.id) || []).map(nodeView),
            lanes: [...lanes],
            tasks
        };
    }
    return null;
});
function selectAndShow(id: string) {
    select(id);
    scrollTo(id);
}

// ---------------------------------------------------------------- 동작
// 스키마(열·레이어) — 처음 한 번. 스키마에 레이어·노드 타입을 추가하면 지도에도 그대로 나온다. 못 받으면 기본 열로 그린다.
let explorerLayers: string[] = EXPLORER_LAYERS;
let schemaLoaded = false;
async function loadColumns() {
    if (schemaLoaded) return;
    try {
        const schema = await store.getOntologySchema();
        if (applyColumns(schema?.columns)) {
            const inColumns = new Set(STAGES.flatMap((st) => st.labels));
            explorerLayers = (schema.layers || [])
                .filter((l: any) => (l.labels || []).some((x: string) => inColumns.has(x)))
                .map((l: any) => l.key);
            STAGE_COLORS.value = toneOf();
            workitemStage.value = stageIndex('workitem');
            collapsedStages.value = new Set(workitemStage.value >= 0 ? [workitemStage.value] : []);
            hiddenStages.value = new Set();
        }
        schemaLoaded = true;
    } catch {
        // 기본 열(ontologyLineage.js STAGES)로 그린다
    }
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        await loadColumns();
        const data = await store.getOntologyGraph(explorerLayers, asOf.value);
        graph.value = data;
        asOfSummary.value = data.as_of || null;
        lastSyncedAt.value = data.last_synced_at || null;
        if (selectedId.value && !index.value.nodes.has(selectedId.value)) selectedId.value = null;
        applyFocus();
    } catch (e: any) {
        error.value = e?.response?.data?.detail || e?.message || '온톨로지를 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

async function sync() {
    syncing.value = true;
    try {
        await store.runOntologySync();
        await load();
    } catch (e: any) {
        error.value = e?.response?.data?.detail || e?.message || '동기화에 실패했습니다.';
    } finally {
        syncing.value = false;
    }
}

function select(id: string | null) {
    // 답의 근거 경로 밖을 고르거나 패널을 닫으면 질문 답에서 평소 코스로 돌아간다
    if (askResult.value && (!id || !askPath.value.includes(id))) askResult.value = null;
    selectedId.value = id === selectedId.value ? null : id;
    impact.value = null;
    changeImpact.value = null;
    showProps.value = false;
    // 접힌 단계의 노드를 고르면 그 단계를 펼친다
    const n: any = id ? index.value.nodes.get(id) : null;
    if (n && collapsedStages.value.has(n.stage)) toggleCollapsed(n.stage);
    // 코스 노드는 열 맨 위로 올라오므로, 코스 출발점(1번)부터 보이게 맞춘다. 패널은 맨 위(코스 설명표)부터.
    if (selectedId.value) {
        scrollToCourseStart();
        requestAnimationFrame(() => detailEl.value?.scrollTo({ top: 0 }));
    }
}
// 화면 밖 코스 지점(가로) — 스크롤 위치에 따라 좌우 가장자리 표식
// 스크롤마다 반응형 상태를 바꾸면 캔버스 전체가 다시 그려진다 — 프레임당 한 번만 재고, 표식이 실제로 바뀔 때만 갱신한다.
const courseOff = shallowRef<{ left: any[]; right: any[] }>({ left: [], right: [] });
let courseOffKey = '';
function updateCourseOff() {
    const el = canvasEl.value;
    const pts = courseDrawn.value.pts;
    let next = { left: [] as any[], right: [] as any[] };
    if (el && pts.length && el.clientWidth) {
        const pad = 20; // 캔버스 안쪽 여백
        const left = el.scrollLeft;
        const width = el.clientWidth;
        next = {
            left: pts.filter((p) => p.x + p.w - pad < left),
            right: pts.filter((p) => p.cx + pad > left + width)
        };
    }
    const key = `${next.left.map((p) => p.id).join(',')}|${next.right.map((p) => p.id).join(',')}`;
    if (key === courseOffKey) return;
    courseOffKey = key;
    courseOff.value = next;
}
let scrollFrame = 0;
function onCanvasScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateCourseOff();
    });
}
watch(courseDrawn, () => onCanvasScroll());
function scrollToCoursePoint(pt: any) {
    const el = canvasEl.value;
    if (!el || !pt) return;
    el.scrollTo({ left: Math.max(0, pt.x - el.clientWidth / 2), behavior: 'smooth' });
}
function scrollToCourseStart() {
    requestAnimationFrame(() => {
        const el = canvasEl.value;
        const first = courseDrawn.value.pts[0];
        if (!el || !first) return;
        el.scrollTo({ left: Math.max(0, first.x - 48), top: 0, behavior: 'smooth' });
        onCanvasScroll();
    });
}

function applyFocus() {
    if (props.focusId && index.value.nodes.has(props.focusId)) {
        selectedId.value = props.focusId;
        impact.value = null;
        scrollTo(props.focusId);
    }
}

function scrollTo(id: string) {
    requestAnimationFrame(() => {
        const pos = layout.value.positions.get(id);
        const el = canvasEl.value;
        if (!pos || !el) return;
        el.scrollTo({
            left: Math.max(0, pos.x - el.clientWidth / 3),
            top: Math.max(0, pos.y - el.clientHeight / 3),
            behavior: 'smooth'
        });
    });
}

function onSearchEnter() {
    const first = [...searchMatches.value][0];
    if (first) {
        selectedId.value = first;
        impact.value = null;
        scrollTo(first);
    }
}

function toggleStage(i: number) {
    const next = new Set(hiddenStages.value);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    hiddenStages.value = next;
}
function toggleCollapsed(i: number) {
    const next = new Set(collapsedStages.value);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    collapsedStages.value = next;
}
function onCardKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(id);
    }
}

// KPI 패널 — 연결 프로세스와 그 병목을 KPI 에서 바로 보여 준다(프로세스를 따로 클릭하지 않아도)
const kpiProcesses = computed(() => {
    const n = selected.value;
    if (!n || n.label !== 'KPI') return [];
    return (metrics.value.get(n.id)?.processIds || []).map((pid: string) => {
        const pm: any = metrics.value.get(pid) || {};
        const bt = pm.bottleneckTaskId ? index.value.nodes.get(pm.bottleneckTaskId) : null;
        return {
            id: pid,
            name: index.value.nodes.get(pid)?.name,
            instances: pm.instances || 0,
            overdue: pm.overdue || 0,
            avgHours: pm.avgHours,
            bottleneck: bt ? { id: bt.id, name: bt.name, avgHours: metrics.value.get(bt.id)?.avgHours } : null
        };
    });
});

function objectiveIdOf(n: any): string | null {
    if (n.label === 'Strategy') return n.id;
    return n.properties?.objective_id || null;
}

function openSource(n: any) {
    switch (n.label) {
        case 'Strategy':
        case 'KPI':
        case 'Initiative': {
            const oid = objectiveIdOf(n);
            if (oid) emit('open-objective', oid);
            break;
        }
        case 'Process':
            router.push(`/definitions/${n.id}`);
            break;
        case 'Task':
            if (n.properties?.proc_def_id) router.push(`/definitions/${n.properties.proc_def_id}`);
            break;
        case 'ProcessInstance':
            router.push(instanceRouteOf(n.id));
            break;
        case 'WorkItem':
            router.push(`/todolist/${n.id}`);
            break;
        case 'Skill':
            router.push(`/skills/${encodeURIComponent(n.name)}`);
            break;
        case 'Team':
        case 'User':
        case 'Agent':
            router.push('/organization');
            break;
        case 'System':
            router.push('/systems');
            break;
        case 'ProcessArea':
        case 'ProcessGroup':
            router.push('/process-hierarchy');
            break;
        case 'Document':
            if (n.properties?.link_url) window.open(n.properties.link_url, '_blank', 'noopener');
            break;
    }
}
const SOURCE_TEXT: Record<string, string> = {
    Strategy: '전략맵에서 열기',
    KPI: '전략맵에서 열기',
    Initiative: '전략맵에서 열기',
    Process: '프로세스 정의 열기',
    Task: '프로세스 정의 열기',
    ProcessInstance: '인스턴스 열기',
    WorkItem: '워크아이템 열기',
    Skill: '스킬 문서 열기',
    User: '조직도 열기',
    Agent: '조직도 열기',
    Team: '조직도 열기',
    System: '시스템 관리 열기',
    ProcessArea: '프로세스 계층 열기',
    ProcessGroup: '프로세스 계층 열기',
    Document: '문서 열기'
};

const canOpenSource = computed(() => {
    const n = selected.value;
    if (!n || !SOURCE_TEXT[n.label]) return false;
    if (n.label === 'Document') return !!n.properties?.link_url;
    return n.stage > stageIndex('kpi') || !!objectiveIdOf(n);
});

// ---------------------------------------------------------------- 드래그로 화면 이동
// 캔버스 어디서든(카드 위 포함) 끌면 스크롤된다. 4px 이상 움직였으면 이어지는 클릭(선택/해제)은 무시한다.
const drag = reactive({ active: false, moved: false, x: 0, y: 0, left: 0, top: 0 });
function onDragStart(e: PointerEvent) {
    if (e.button !== 0 || !canvasEl.value) return;
    drag.active = true;
    drag.moved = false;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.left = canvasEl.value.scrollLeft;
    drag.top = canvasEl.value.scrollTop;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd, { once: true });
}
function onDragMove(e: PointerEvent) {
    const el = canvasEl.value;
    if (!drag.active || !el) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    el.scrollLeft = drag.left - dx;
    el.scrollTop = drag.top - dy;
}
function onDragEnd() {
    drag.active = false;
    window.removeEventListener('pointermove', onDragMove);
}
function onCanvasClickCapture(e: MouseEvent) {
    if (drag.moved) {
        e.stopPropagation();
        e.preventDefault();
        drag.moved = false;
    }
}
onBeforeUnmount(onDragEnd);

async function ask(q?: string) {
    const question = (q ?? askText.value).trim();
    if (!question || askLoading.value) return;
    askText.value = question;
    askLoading.value = true;
    askError.value = '';
    try {
        const r = await store.askOntology(question);
        askResult.value = r;
        // 패널 기준 노드 = 에이전트가 처음 짚은 대상(이름 해소 결과), 없으면 경로의 첫 지점
        const anchor = (r.steps || []).flatMap((st: any) => st.node_ids || []).find((id: string) => askPath.value.includes(id));
        const target = anchor || askPath.value[0] || null;
        selectedId.value = target;
        impact.value = null;
        showProps.value = false;
        if (target) {
            const n: any = index.value.nodes.get(target);
            if (n && collapsedStages.value.has(n.stage)) toggleCollapsed(n.stage);
            scrollToCourseStart();
        }
        requestAnimationFrame(() => detailEl.value?.scrollTo({ top: 0 }));
    } catch (e: any) {
        askError.value = e?.response?.data?.detail || e?.message || '질문에 답하지 못했습니다.';
    } finally {
        askLoading.value = false;
    }
}
function closeAsk() {
    askResult.value = null;
    askError.value = '';
}

// 프로세스 변경 영향(spec 016) — 이 프로세스를 바꾸면 영향을 받는 다른 프로세스·KPI
const changeImpact = ref<any>(null);
const changeImpactLoading = ref(false);
async function runChangeImpact(versions = false) {
    if (!selected.value || selected.value.label !== 'Process') return;
    changeImpactLoading.value = true;
    try {
        changeImpact.value = await store.getProcessImpact(selected.value.id, { versions });
    } catch (e: any) {
        changeImpact.value = { error: e?.response?.data?.detail || e?.message || '변경 영향 분석에 실패했습니다.' };
    } finally {
        changeImpactLoading.value = false;
    }
}
// 지도 위 파급 표시: 영향 프로세스는 수준별 외곽선, 위험 KPI 는 high 로
const rippleOf = computed<Map<string, string>>(() => {
    const out = new Map<string, string>();
    const r = changeImpact.value;
    if (!r || r.error) return out;
    for (const a of r.affected || []) out.set(a.id, a.level);
    for (const k of r.kpis_at_risk || []) if (!out.has(k.id)) out.set(k.id, 'kpi');
    return out;
});
const RIPPLE_TEXT: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' };

async function runImpact() {
    if (!selected.value || selected.value.label !== 'KPI') return;
    impactLoading.value = true;
    try {
        impact.value = await store.getImpactKpi(selected.value.id);
    } catch (e: any) {
        impact.value = { error: e?.response?.data?.detail || e?.message || '원인 분석에 실패했습니다.' };
    } finally {
        impactLoading.value = false;
    }
}
const IMPACT_TYPE_TEXT: Record<string, string> = { task: '태스크', resource: '리소스', process: '프로세스', skill: '스킬' };
function diagnosisText(d: any): string {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return d.summary || d.text || d.diagnosis || '';
}

watch(
    () => props.focusId,
    () => applyFocus()
);
// 체인만 보기는 열이 줄어드니 처음부터, 해제하면 선택 노드로
watch(chainOnly, (only) => {
    if (only) requestAnimationFrame(() => canvasEl.value?.scrollTo({ left: 0, top: 0 }));
    else if (selectedId.value) scrollTo(selectedId.value);
});

onMounted(() => {
    load();
    loadHypos();
    window.addEventListener('resize', onCanvasScroll);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onCanvasScroll);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
});
watch(
    () => layout.value.width,
    () => requestAnimationFrame(onCanvasScroll)
);
defineExpose({ reload: load });
</script>

<template>
    <div class="soe sx-theme" data-testid="strategy-ontology-explorer">
        <!-- 툴바 -->
        <div class="soe-toolbar d-flex align-center flex-wrap ga-2 mb-2">
            <v-text-field
                v-model="search"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                placeholder="노드 검색 (Enter: 선택)"
                class="soe-search"
                @keyup.enter="onSearchEnter"
            />
            <div class="soe-tool-group" role="group" aria-label="분석 도구">
                <v-btn
                    size="small"
                    :variant="askOpen ? 'flat' : 'outlined'"
                    :color="askOpen ? COURSE : undefined"
                    data-testid="ask-toggle"
                    @click="askOpen = !askOpen"
                >
                    <v-icon start size="16">mdi-chat-question-outline</v-icon>질문하기
                </v-btn>
                <v-btn
                    size="small"
                    :variant="timeOpen || asOf ? 'flat' : 'outlined'"
                    :color="timeOpen || asOf ? INK : undefined"
                    data-testid="time-toggle"
                    @click="openTime"
                >
                    <v-icon start size="16">mdi-calendar-clock-outline</v-icon>{{ asOf ? `${asOf} 시점` : '시점' }}
                </v-btn>
                <v-btn size="small" variant="outlined" data-testid="hypo-open" @click="hypoOpen = true">
                    <v-icon start size="16">mdi-chart-scatter-plot</v-icon>영향 가설
                    <span v-if="pendingHypos" class="soe-count-badge" :aria-label="`검토 대기 ${pendingHypos}건`">{{ pendingHypos }}</span>
                </v-btn>
            </div>
            <v-spacer />
            <!-- 보기 설정: 단계 표시·접기, 체인만, 연결 안 된 노드, 촘촘히 — 툴바 선택지를 3개로 줄인다 -->
            <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: menuProps }">
                    <v-btn v-bind="menuProps" size="small" variant="outlined" data-testid="view-settings">
                        <v-icon start size="16">mdi-tune-variant</v-icon>보기 설정
                        <v-badge v-if="hiddenStages.size || includeUnlinked || chainOnly" dot inline :color="INK" class="ml-1" />
                    </v-btn>
                </template>
                <v-card min-width="300" class="pa-3">
                    <div class="text-caption font-weight-bold mb-1">단계</div>
                    <div v-for="(stage, i) in STAGES" :key="stage.key" class="soe-stage-row">
                        <v-checkbox-btn
                            :model-value="!hiddenStages.has(i)"
                            density="compact"
                            :data-testid="`stage-chip-${stage.key}`"
                            @update:model-value="toggleStage(i)"
                        />
                        <v-icon size="16" :color="STAGE_COLORS[i]">{{ LABEL_ICON[stage.labels[0]] }}</v-icon>
                        <span class="flex-grow-1">{{ stage.name }}</span>
                        <span class="text-medium-emphasis mr-2">{{ stageTotals[i] }}</span>
                        <v-btn size="x-small" variant="text" :disabled="hiddenStages.has(i)" @click="toggleCollapsed(i)">
                            {{ collapsedStages.has(i) ? '펼치기' : '접기' }}
                        </v-btn>
                    </div>
                    <v-divider class="my-2" />
                    <v-switch
                        v-model="chainOnly"
                        :disabled="!selectedId"
                        density="compact"
                        hide-details
                        :color="INK"
                        label="선택 체인만 보기"
                        data-testid="chain-only"
                    />
                    <v-switch
                        v-model="includeUnlinked"
                        density="compact"
                        hide-details
                        :color="INK"
                        label="전략과 연결 안 된 노드 포함"
                        data-testid="include-unlinked"
                    />
                    <v-switch v-model="compact" density="compact" hide-details :color="INK" label="촘촘히 보기" />
                </v-card>
            </v-menu>
            <span class="soe-toolbar-hint"><v-icon size="14">mdi-cursor-default-click-outline</v-icon>클릭: 코스 · 끌기: 이동</span>
            <v-btn class="soe-legend-toggle" size="small" variant="outlined" @click="legendOpen = !legendOpen">
                <v-icon start size="16">mdi-map-legend</v-icon>기호표
            </v-btn>
            <v-btn
                size="small"
                variant="outlined"
                :loading="syncing"
                data-testid="ontology-sync"
                :title="`마지막 동기화 ${fmtSynced(lastSyncedAt)}`"
                @click="sync"
            >
                <v-icon start size="16">mdi-database-sync-outline</v-icon>동기화
                <span class="soe-sync-time">{{ fmtSynced(lastSyncedAt) }}</span>
            </v-btn>
        </div>
        <!-- 교차 필터 표식 — 대시보드에서 들고 온 도메인 -->
        <div v-if="domainFilter" class="soe-xfilter mb-2" data-testid="domain-filter">
            <v-icon size="16">mdi-chart-box-outline</v-icon>
            분석 대시보드의 도메인 <b>{{ domainFilter }}</b> — 프로세스 {{ domainProcesses.length }}개와 그 체인만 보입니다.
            <button type="button" class="soe-link ml-2" @click="clearDomain">필터 해제</button>
        </div>
        <!-- 시점 — 그날까지의 KPI 측정값과 그날까지 시작된 실행만으로 다시 그린다 -->
        <div v-if="timeOpen" class="soe-time mb-2" data-testid="time-bar">
            <div class="d-flex align-center ga-3">
                <span class="soe-time-date" aria-live="polite">{{ timeOffset ? dateOf(timeOffset) : '오늘(현재)' }}</span>
                <v-slider
                    :model-value="timeSpan - timeOffset"
                    :min="0"
                    :max="timeSpan"
                    :step="7"
                    :disabled="!timeSpan"
                    hide-details
                    :color="INK"
                    track-color="rgba(var(--v-theme-on-surface), 0.12)"
                    thumb-label="always"
                    aria-label="시점"
                    data-testid="time-slider"
                    @update:model-value="(v: number) => onTimeSlide(timeSpan - v)"
                >
                    <template #thumb-label="{ modelValue }">{{ dateOf(timeSpan - modelValue).slice(5) }}</template>
                </v-slider>
                <v-btn size="small" variant="outlined" :disabled="!asOf" @click="toNow">현재로</v-btn>
            </div>
            <div class="soe-time-note">
                <template v-if="asOfSummary">
                    {{ asOfSummary.as_of }} 시점 — KPI 는 그날까지의 마지막 측정값, 실행은 그날까지 시작된 것만(그 뒤 시작한
                    {{ asOfSummary.execution_hidden }}건 숨김). 전략·KPI 정의는 현재 기준입니다.
                </template>
                <template v-else>{{ timeline?.first || '-' }} ~ 오늘. 왼쪽으로 끌면 과거 주의 지도를 봅니다(1주 단위).</template>
            </div>
        </div>
        <!-- 질문하기 — 에이전트가 MCP 와 같은 읽기 도구로 탐색하고, 근거 노드를 코스로 그린다 -->
        <div v-if="askOpen" class="soe-ask mb-2" data-testid="ask-bar">
            <div class="d-flex align-center ga-2">
                <v-text-field
                    v-model="askText"
                    density="compact"
                    variant="outlined"
                    hide-details
                    autofocus
                    :disabled="askLoading"
                    placeholder="예: 구매 리드타임이 왜 목표 미달이야?"
                    prepend-inner-icon="mdi-chat-question-outline"
                    data-testid="ask-input"
                    @keyup.enter="ask()"
                />
                <v-btn
                    :color="COURSE"
                    variant="flat"
                    :loading="askLoading"
                    :disabled="!askText.trim()"
                    data-testid="ask-submit"
                    @click="ask()"
                    >묻기</v-btn
                >
            </div>
            <div class="soe-ask-examples mt-1">
                <span class="text-caption text-medium-emphasis">예시</span>
                <button v-for="ex in ASK_EXAMPLES" :key="ex" type="button" class="soe-ask-example" :disabled="askLoading" @click="ask(ex)">
                    {{ ex }}
                </button>
            </div>
        </div>
        <!-- 범례 = 지도 기호표 -->
        <div class="soe-legend mb-3" :class="{ open: legendOpen }" aria-label="범례">
            <span class="soe-legend-item"
                ><OntologySymbol kind="course" />
                {{ askPath.length ? '코스 — 질문 답의 근거 경로' : '코스 — 선택한 노드를 지나는 결정적 경로' }}</span
            >
            <span class="soe-legend-item"><OntologySymbol kind="risk" /> 위험·병목</span>
            <span class="soe-legend-item"><OntologySymbol kind="warn" /> 주의·지연</span>
            <span class="soe-legend-item"><OntologySymbol kind="unlinked" /> 실행 미연결</span>
            <span class="soe-legend-item soe-legend-scale">{{ levelLegend }}</span>
            <span class="soe-legend-terrain">
                <span v-for="g in STAGE_GROUPS" :key="g.name" class="soe-legend-group"
                    ><i :style="{ background: g.color }" aria-hidden="true"></i>{{ g.name }}</span
                >
            </span>
        </div>

        <div v-if="loading && !graph.nodes.length" class="d-flex justify-center py-12">
            <v-progress-circular indeterminate :color="COURSE" />
        </div>
        <v-alert v-else-if="error" type="error" variant="tonal" class="mb-2">
            {{ error }}
            <template #append>
                <v-btn size="small" variant="text" @click="load">다시 시도</v-btn>
            </template>
        </v-alert>
        <div v-else class="soe-body">
            <div v-if="!visibleIds.size" class="soe-empty">
                <v-icon size="48" color="grey">mdi-graph-outline</v-icon>
                <template v-if="!hasStrategy">
                    <div class="text-subtitle-1 mt-2">전략맵이 아직 없습니다.</div>
                    <div class="text-caption text-medium-emphasis mb-3">
                        전략맵에 목표와 KPI를 등록하고 KPI를 프로세스에 연결하면 실행 결과까지 이어집니다.
                    </div>
                    <div class="d-flex ga-2 justify-center">
                        <v-btn size="small" :color="COURSE" variant="flat" @click="emit('open-objective', '')">전략맵으로 이동</v-btn>
                        <v-btn size="small" variant="outlined" @click="includeUnlinked = true">프로세스·실행만 보기</v-btn>
                    </div>
                </template>
                <div v-else class="text-subtitle-1 mt-2">표시할 노드가 없습니다. 단계 필터를 확인하세요.</div>
            </div>

            <!-- 워터폴 캔버스 -->
            <div v-else class="soe-canvas-wrap">
                <!-- 화면 밖 코스 지점 표식: 누르면 그쪽으로 이동 -->
                <button
                    v-if="courseOff.left.length"
                    type="button"
                    class="soe-offmark left"
                    @click="scrollToCoursePoint(courseOff.left[courseOff.left.length - 1])"
                >
                    ← 코스 {{ courseOff.left.map((p) => p.no).join('·') }}
                </button>
                <button
                    v-if="courseOff.right.length"
                    type="button"
                    class="soe-offmark right"
                    data-testid="course-offmark"
                    @click="scrollToCoursePoint(courseOff.right[0])"
                >
                    코스 {{ courseOff.right.map((p) => p.no).join('·') }} →
                </button>
                <div
                    ref="canvasEl"
                    class="soe-canvas"
                    :class="{ dragging: drag.active }"
                    @pointerdown="onDragStart"
                    @scroll.passive="onCanvasScroll"
                    @click.capture="onCanvasClickCapture"
                    @click.self="select(null)"
                >
                    <div class="soe-stage-headers" :style="{ width: layout.width + 'px' }">
                        <div
                            v-for="col in layout.columns"
                            :key="col.stage"
                            class="soe-stage-header"
                            :class="{ collapsed: col.collapsed }"
                            :style="stageVars(col.stage, { left: col.x - COL_GAP / 2 + 'px', width: col.width + COL_GAP + 'px' })"
                            :title="col.collapsed ? `${STAGES[col.stage].name} ${col.count} — 펼치기` : ''"
                        >
                            <template v-if="!col.collapsed">
                                <span class="soe-stage-name" :title="STAGES[col.stage].name"
                                    ><v-icon size="15" class="soe-stage-icon">{{ LABEL_ICON[STAGES[col.stage].labels[0]] }}</v-icon
                                    ><span class="soe-stage-text">{{ STAGES[col.stage].name }}</span></span
                                >
                                <span class="soe-stage-tail">
                                    <span class="soe-stage-count">{{ col.count.toLocaleString() }}</span>
                                    <button
                                        type="button"
                                        class="soe-stage-fold"
                                        :title="`${STAGES[col.stage].name} 열 접기`"
                                        :aria-label="`${STAGES[col.stage].name} 열 접기`"
                                        :data-testid="`collapse-${STAGES[col.stage].key}`"
                                        @pointerdown.stop
                                        @click.stop="toggleCollapsed(col.stage)"
                                    >
                                        <v-icon size="16">mdi-arrow-collapse-horizontal</v-icon>
                                    </button>
                                </span>
                            </template>
                            <button
                                v-else
                                type="button"
                                class="soe-stage-unfold"
                                :aria-label="`${STAGES[col.stage].name} ${col.count} — 열 펼치기`"
                                @pointerdown.stop
                                @click.stop="toggleCollapsed(col.stage)"
                            >
                                <v-icon size="16" :color="STAGE_COLORS[col.stage]">{{ LABEL_ICON[STAGES[col.stage].labels[0]] }}</v-icon>
                                <v-icon size="14" class="soe-stage-unfold-arrow">mdi-arrow-expand-horizontal</v-icon>
                            </button>
                        </div>
                    </div>
                    <div class="soe-plane" :style="{ width: layout.width + 'px', height: layout.height + 'px' }" @click.self="select(null)">
                        <!-- 지형대: 열마다 단계 지형 틴트 -->
                        <div
                            v-for="col in layout.columns.filter((c) => !c.collapsed)"
                            :key="`band-${col.stage}`"
                            class="soe-band"
                            :style="
                                stageVars(col.stage, {
                                    left: col.x - COL_GAP / 2 + 'px',
                                    width: col.width + COL_GAP + 'px',
                                    height: layout.height + 16 + 'px'
                                })
                            "
                            @click="select(null)"
                        ></div>
                        <svg class="soe-edges" :width="layout.width" :height="layout.height">
                            <path
                                v-for="e in drawnEdges"
                                :key="e.id"
                                :d="e.d"
                                fill="none"
                                :class="['soe-edge', { 'in-chain': e.inChain, skip: e.skip, hypo: e.rel_type === 'INFLUENCES_KPI' }]"
                            >
                                <title>{{ REL_TEXT[e.rel_type] || e.rel_type }}</title>
                            </path>
                            <path v-for="e in hoverEdges" :key="`h-${e.id}`" :d="e.d" fill="none" class="soe-edge hover">
                                <title>{{ REL_TEXT[e.rel_type] || e.rel_type }}</title>
                            </path>
                        </svg>
                        <!-- 접힌 단계: 개수만 보이는 세로 띠, 누르면 펼친다 -->
                        <button
                            v-for="col in layout.columns.filter((c) => c.collapsed)"
                            :key="`collapsed-${col.stage}`"
                            type="button"
                            class="soe-collapsed"
                            :style="{ left: col.x + 'px', width: col.width + 'px', height: Math.max(layout.height, 240) + 'px' }"
                            :data-testid="`expand-${STAGES[col.stage].key}`"
                            @click.stop="toggleCollapsed(col.stage)"
                        >
                            <span class="soe-collapsed-label">{{ STAGES[col.stage].name }} {{ col.count.toLocaleString() }} · 펼치기</span>
                        </button>
                        <div
                            v-for="c in cardViews"
                            :key="c.id"
                            v-memo="[c]"
                            class="soe-card"
                            :class="c.cls"
                            :style="{ left: c.pos.x + 'px', top: c.pos.y + 'px', width: c.pos.w + 'px', height: c.pos.h + 'px' }"
                            :data-node-id="c.id"
                            :data-label="c.label"
                            :title="c.title"
                            role="button"
                            tabindex="0"
                            :aria-pressed="c.selected"
                            :aria-label="c.aria"
                            @click.stop="select(c.id)"
                            @keydown="onCardKey($event, c.id)"
                            @mouseenter="hoverId = c.id"
                            @mouseleave="hoverId = null"
                        >
                            <div class="soe-card-title">
                                <OntologySymbol v-if="c.symbol" :kind="c.symbol" :size="11" />
                                <v-icon v-else size="14" :color="c.iconColor">{{ c.icon }}</v-icon>
                                <span class="text-truncate">{{ c.name }}</span>
                            </div>
                            <div v-if="c.pos.h > 40" class="soe-card-sub">
                                <span v-if="c.ach != null" class="soe-num" :style="{ color: c.achColor }">{{ c.ach }}%</span>
                                <span class="text-truncate">{{ c.sub }}</span>
                                <span v-if="c.unlinked" class="soe-state soe-state--muted"
                                    ><OntologySymbol kind="unlinked" :size="10" />미연결</span
                                >
                            </div>
                        </div>
                        <!-- 코스: 통제점(원)과 번호, 지점 사이 직선 -->
                        <svg
                            v-if="courseDrawn.pts.length"
                            class="soe-course"
                            :width="layout.width"
                            :height="layout.height"
                            aria-hidden="true"
                        >
                            <path
                                v-for="(d, i) in courseDrawn.legs"
                                :key="`leg-${i}`"
                                :d="d"
                                fill="none"
                                :stroke="COURSE"
                                stroke-width="2.5"
                            />
                            <!-- 출발 △ · 통제점 ○ · 결승 ◎ (번호는 원 바깥) -->
                            <g v-for="pt in courseDrawn.pts" :key="`ctl-${pt.id}`">
                                <path
                                    v-if="pt.no === 1"
                                    :d="`M${pt.cx},${pt.y - 11} L${pt.cx + 10},${pt.y + 7} L${pt.cx - 10},${pt.y + 7} Z`"
                                    class="soe-course-mark"
                                    :stroke="COURSE"
                                    stroke-width="2.5"
                                />
                                <template v-else>
                                    <circle :cx="pt.cx" :cy="pt.y" r="9" class="soe-course-mark" :stroke="COURSE" stroke-width="2.5" />
                                    <circle
                                        v-if="pt.no === course.length"
                                        :cx="pt.cx"
                                        :cy="pt.y"
                                        r="4.5"
                                        fill="none"
                                        :stroke="COURSE"
                                        stroke-width="2"
                                    />
                                </template>
                                <text :x="pt.cx - 9" :y="pt.y - 7" text-anchor="end" class="soe-course-no">{{ pt.no }}</text>
                            </g>
                        </svg>
                    </div>
                </div>
            </div>

            <!-- 상세 패널 -->
            <div v-if="selected || askResult || askError" ref="detailEl" class="soe-detail" data-testid="ontology-detail">
                <!-- 질문 답 — 결론, 에이전트가 한 일, 근거 경로(지도의 보라 코스) -->
                <section v-if="askResult || askError" class="soe-ask-answer" data-testid="ask-answer" aria-live="polite">
                    <div class="d-flex align-start justify-space-between ga-2">
                        <div class="soe-section-label">질문 답</div>
                        <v-btn icon size="x-small" variant="text" aria-label="질문 답 닫기" @click="closeAsk"
                            ><v-icon size="16">mdi-close</v-icon></v-btn
                        >
                    </div>
                    <template v-if="askResult">
                        <div class="soe-ask-q">{{ askResult.question }}</div>
                        <p class="soe-ask-text">{{ askResult.answer }}</p>
                        <div v-if="askResult.status === 'no_evidence'" class="soe-callout mt-2">
                            근거로 확인된 노드가 없어 지도에 경로를 그리지 않았습니다.
                        </div>
                        <div v-else class="soe-ask-path mt-2">
                            <OntologySymbol kind="course" :size="12" /> 근거 경로 {{ askPath.length }}개 지점 — 지도의 보라 코스와 아래 코스
                            설명표
                        </div>
                        <details class="soe-ask-steps mt-2">
                            <summary>
                                에이전트가 한 일 {{ askResult.steps.length }}단계 · {{ (askResult.elapsed_ms / 1000).toFixed(1) }}초
                            </summary>
                            <ol>
                                <li v-for="(st, i) in askResult.steps" :key="i">
                                    <b>{{ ASK_TOOL_TEXT[st.tool] || st.tool }}</b>
                                    <span v-if="st.args.text"> “{{ st.args.text }}”</span>
                                    <span v-if="st.summary" class="text-medium-emphasis"> — {{ st.summary }}</span>
                                </li>
                            </ol>
                        </details>
                    </template>
                    <div v-else class="soe-callout soe-callout--risk">{{ askError }}</div>
                </section>
                <template v-if="selected">
                    <div class="d-flex align-start justify-space-between">
                        <div class="min-w-0">
                            <div class="soe-detail-title">
                                <svg
                                    v-if="courseNo.get(selected.id)"
                                    class="soe-detail-ctl"
                                    width="26"
                                    height="26"
                                    viewBox="0 0 26 26"
                                    role="img"
                                    :aria-label="`코스 ${courseNo.get(selected.id)}번 지점`"
                                >
                                    <circle cx="13" cy="13" r="11" class="soe-course-mark" :stroke="COURSE" stroke-width="2.5" />
                                    <text x="13" y="18" text-anchor="middle" class="soe-detail-no">{{ courseNo.get(selected.id) }}</text>
                                </svg>
                                <span class="soe-detail-name">{{ selected.name }}</span>
                            </div>
                            <div class="soe-detail-sub">
                                <span :style="{ color: STAGE_COLORS[selected.stage] }">{{ LABEL_TEXT[selected.label] }}</span>
                                <template v-if="subtitleRest(selected)"> · {{ subtitleRest(selected) }}</template>
                            </div>
                        </div>
                        <v-btn icon size="x-small" variant="text" aria-label="상세 닫기" @click="select(null)"
                            ><v-icon size="18">mdi-close</v-icon></v-btn
                        >
                    </div>

                    <!-- 코스 설명표 — 지점마다 무엇이 어떤 상태인지 -->
                    <div v-if="courseRows.length > 1" class="soe-course-table mt-3" data-testid="course-table">
                        <div class="soe-section-label">{{ askPath.length ? '코스 설명표 — 질문 답의 근거' : '코스 설명표' }}</div>
                        <button
                            v-for="row in courseRows"
                            :key="row.id"
                            type="button"
                            class="soe-course-row"
                            :class="{ current: row.id === selected.id }"
                            @click="
                                select(row.id);
                                scrollTo(row.id);
                            "
                        >
                            <span class="soe-course-row-no">{{ row.no }}</span>
                            <span class="soe-course-row-kind" :style="{ color: STAGE_COLORS[row.n.stage] }">{{
                                LABEL_SHORT[row.n.label] || LABEL_TEXT[row.n.label]
                            }}</span>
                            <span class="soe-course-row-name">
                                <OntologySymbol v-if="row.flags.risk || row.flags.bottleneck" kind="risk" :size="10" />
                                <OntologySymbol v-else-if="row.flags.warn || row.flags.overdue" kind="warn" :size="10" />
                                {{ row.n.name }}
                            </span>
                            <span class="soe-course-row-val">{{ courseValue(row.n) }}</span>
                        </button>
                    </div>

                    <!-- KPI/전략 달성 — 큰 응축 숫자 -->
                    <div v-if="metrics.get(selected.id)?.achievement != null" class="soe-detail-metric mt-3">
                        <span class="soe-detail-big" :style="{ color: levelHex(selected.id) }"
                            >{{ fmt(metrics.get(selected.id).achievement) }}%</span
                        >
                        <span class="soe-detail-level">
                            <OntologySymbol v-if="levelOf(selected.id) === 'risk'" kind="risk" :size="11" />
                            <OntologySymbol v-else-if="levelOf(selected.id) === 'warn'" kind="warn" :size="11" />
                            {{ levelOf(selected.id) ? LEVEL_TEXT[levelOf(selected.id)] : '' }} · 목표 대비 달성률
                        </span>
                    </div>

                    <!-- KPI: 원인 분석을 맨 위에, 연결 프로세스의 병목을 바로 -->
                    <template v-if="selected.label === 'KPI'">
                        <v-btn
                            class="mt-3"
                            size="small"
                            block
                            :color="COURSE"
                            variant="flat"
                            :loading="impactLoading"
                            :disabled="!kpiProcesses.length"
                            data-testid="kpi-impact"
                            @click="runImpact"
                        >
                            <v-icon start size="16">mdi-magnify-scan</v-icon>원인 분석 (실행까지 역추적)
                        </v-btn>
                        <div v-if="!kpiProcesses.length" class="soe-callout mt-2" data-testid="kpi-unlinked">
                            <b>실행과 연결되지 않은 KPI입니다.</b>
                            {{ selected.properties?.measure_type === 'manual' ? '수동 입력 KPI라' : '연결된 프로세스가 없어' }}
                            실행 결과로 원인을 추적할 수 없습니다. 전략맵에서 KPI를 열어 측정 프로세스를 연결하세요.
                            <v-btn v-if="canOpenSource" size="small" variant="outlined" class="mt-2" @click="openSource(selected)">
                                <v-icon start size="16">mdi-link-variant</v-icon>전략맵에서 프로세스 연결
                            </v-btn>
                        </div>
                        <div v-for="pr in kpiProcesses" :key="pr.id" class="soe-kpi-process mt-2">
                            <button type="button" class="soe-link" @click="select(pr.id), scrollTo(pr.id)">{{ pr.name }}</button>
                            <div class="text-caption soe-muted">
                                실행 {{ pr.instances }} · 지연 {{ pr.overdue }} · 평균 {{ fmtHours(pr.avgHours) }}
                            </div>
                            <div v-if="pr.bottleneck" class="mt-1">
                                <span class="soe-state soe-state--risk mr-1"><OntologySymbol kind="risk" :size="10" />병목</span>
                                <button type="button" class="soe-link" @click="select(pr.bottleneck.id), scrollTo(pr.bottleneck.id)">
                                    {{ pr.bottleneck.name }}
                                </button>
                                <span class="text-caption soe-muted ml-1">평균 {{ fmtHours(pr.bottleneck.avgHours) }}</span>
                            </div>
                        </div>
                    </template>

                    <!-- 프로세스 실행 집계 -->
                    <div v-if="selected.label === 'Process'" class="soe-stats mt-3">
                        <div>
                            <b>{{ metrics.get(selected.id)?.instances || 0 }}</b
                            ><span>실행</span>
                        </div>
                        <div>
                            <b>{{ metrics.get(selected.id)?.completed || 0 }}</b
                            ><span>완료</span>
                        </div>
                        <div>
                            <b>{{ metrics.get(selected.id)?.running || 0 }}</b
                            ><span>진행</span>
                        </div>
                        <div>
                            <b>{{ metrics.get(selected.id)?.overdue || 0 }}</b
                            ><span>지연</span>
                        </div>
                        <div>
                            <b>{{ fmtHours(metrics.get(selected.id)?.avgHours) }}</b
                            ><span>평균 소요</span>
                        </div>
                    </div>
                    <div
                        v-if="selected.label === 'Process' && metrics.get(selected.id)?.bottleneckTaskId"
                        class="soe-callout soe-callout--risk mt-2"
                    >
                        <OntologySymbol kind="risk" :size="11" />
                        병목 태스크
                        <button
                            type="button"
                            class="soe-link"
                            @click="
                                select(metrics.get(selected.id).bottleneckTaskId);
                                scrollTo(metrics.get(selected.id).bottleneckTaskId);
                            "
                        >
                            {{ index.nodes.get(metrics.get(selected.id).bottleneckTaskId)?.name }}
                        </button>
                        · 평균 {{ fmtHours(metrics.get(metrics.get(selected.id).bottleneckTaskId)?.avgHours) }}
                    </div>
                    <div
                        v-if="selected.label === 'Task' && metrics.get(selected.id)?.bottleneck"
                        class="soe-callout soe-callout--risk mt-2"
                    >
                        <OntologySymbol kind="risk" :size="11" /> 이 프로세스에서 평균 소요가 가장 긴 병목 단계입니다.
                    </div>

                    <!-- 담당 · 조직 -->
                    <section v-if="assignInfo" class="soe-assign mt-3" data-testid="assign-info" aria-label="담당 · 조직">
                        <template v-if="assignInfo.kind === 'task'">
                            <div v-if="assignInfo.lane" class="soe-assign-row">
                                <span class="soe-assign-key">Lane</span>
                                <span class="soe-assign-lane">{{ assignInfo.lane }}</span>
                            </div>
                            <div class="soe-assign-row">
                                <span class="soe-assign-key">담당 조직</span>
                                <div v-if="assignInfo.teams.length" class="soe-assign-list">
                                    <div v-for="t in assignInfo.teams" :key="t.id" class="soe-assign-team">
                                        <v-icon size="15" :color="STAGE_TONE_BY_KEY.resource">mdi-account-group-outline</v-icon>
                                        <button v-if="t.selectable" type="button" class="soe-link" @click="selectAndShow(t.id)">
                                            {{ t.name }}
                                        </button>
                                        <b v-else>{{ t.name }}</b>
                                        <span class="soe-assign-note">구성원 {{ t.memberCount }}</span>
                                        <span v-if="t.path" class="soe-assign-path">{{ t.path }}</span>
                                        <span v-if="t.match" class="soe-assign-why">{{ t.match }}</span>
                                    </div>
                                </div>
                                <span v-else class="soe-muted">{{
                                    assignInfo.lane ? '조직도에 맞는 팀이 없습니다 — Lane 에서 조직을 지정하면 연결됩니다' : '지정 없음'
                                }}</span>
                            </div>
                            <div v-if="assignInfo.people.length" class="soe-assign-row">
                                <span class="soe-assign-key">{{ assignInfo.peopleText }}</span>
                                <div class="soe-assign-list soe-assign-list--inline">
                                    <span v-for="u in assignInfo.people" :key="u.id" class="soe-assign-person">
                                        <v-icon size="14">{{ LABEL_ICON[u.label] || 'mdi-account-outline' }}</v-icon>
                                        <button v-if="u.selectable" type="button" class="soe-link" @click="selectAndShow(u.id)">
                                            {{ u.name }}
                                        </button>
                                        <span v-else>{{ u.name }}</span>
                                        <span
                                            v-if="u.inOrg === false"
                                            class="sx-pill sx-pill--warn"
                                            title="Lane 담당 조직(하위 조직 포함)의 구성원이 아닙니다"
                                            >조직 밖</span
                                        >
                                    </span>
                                </div>
                            </div>
                        </template>
                        <div v-else-if="assignInfo.kind === 'member'" class="soe-assign-row">
                            <span class="soe-assign-key">소속 조직</span>
                            <div class="soe-assign-list">
                                <div v-for="t in assignInfo.teams" :key="t.id" class="soe-assign-team">
                                    <v-icon size="15" :color="STAGE_TONE_BY_KEY.resource">mdi-account-group-outline</v-icon>
                                    <button v-if="t.selectable" type="button" class="soe-link" @click="selectAndShow(t.id)">
                                        {{ t.name }}
                                    </button>
                                    <b v-else>{{ t.name }}</b>
                                    <span v-if="t.path" class="soe-assign-path">{{ t.path }}</span>
                                </div>
                            </div>
                        </div>
                        <template v-else-if="assignInfo.kind === 'team'">
                            <div v-if="assignInfo.path" class="soe-assign-row">
                                <span class="soe-assign-key">상위 조직</span>
                                <span>{{ assignInfo.path }}</span>
                            </div>
                            <div class="soe-assign-row">
                                <span class="soe-assign-key">맡은 Lane</span>
                                <span v-if="assignInfo.lanes.length">
                                    {{ assignInfo.lanes.join(', ') }}
                                    <span class="soe-assign-note">· 태스크 {{ assignInfo.tasks }}</span>
                                </span>
                                <span v-else class="soe-muted">없음</span>
                            </div>
                            <div class="soe-assign-row">
                                <span class="soe-assign-key">구성원 {{ assignInfo.members.length }}</span>
                                <div v-if="assignInfo.members.length" class="soe-assign-list soe-assign-list--inline">
                                    <span v-for="u in assignInfo.members" :key="u.id" class="soe-assign-person">
                                        <v-icon size="14">{{ LABEL_ICON[u.label] || 'mdi-account-outline' }}</v-icon>
                                        <button v-if="u.selectable" type="button" class="soe-link" @click="selectAndShow(u.id)">
                                            {{ u.name }}
                                        </button>
                                        <span v-else>{{ u.name }}</span>
                                    </span>
                                </div>
                                <span v-else class="soe-muted">조직도에 구성원이 없습니다</span>
                            </div>
                        </template>
                    </section>

                    <!-- 속성 -->
                    <v-btn
                        v-if="propRows.length && (selected.label === 'KPI' || selected.label === 'Strategy')"
                        size="small"
                        variant="text"
                        class="mt-2 px-0"
                        @click="showProps = !showProps"
                    >
                        <v-icon start size="16">{{ showProps ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                        {{ showProps ? '속성 접기' : `속성 ${propRows.length}개 보기` }}
                    </v-btn>
                    <v-table
                        v-if="propRows.length && (showProps || (selected.label !== 'KPI' && selected.label !== 'Strategy'))"
                        density="compact"
                        class="mt-1 soe-props"
                    >
                        <tbody>
                            <tr v-for="row in propRows" :key="row.text">
                                <td class="text-medium-emphasis">{{ row.text }}</td>
                                <td>{{ row.value }}</td>
                            </tr>
                        </tbody>
                    </v-table>

                    <!-- 체인 요약 -->
                    <div v-if="chainSummary" class="mt-3">
                        <div class="text-caption font-weight-bold mb-1">연결 체인</div>
                        <div class="d-flex flex-wrap ga-1">
                            <template v-for="(count, i) in chainSummary" :key="i">
                                <v-chip v-if="count" size="x-small" variant="tonal" :style="{ color: STAGE_COLORS[i] }">
                                    {{ STAGES[i].name }} {{ count }}
                                </v-chip>
                            </template>
                        </div>
                    </div>

                    <div class="d-flex flex-wrap ga-2 mt-3">
                        <v-btn size="small" variant="outlined" :color="COURSE" @click="chainOnly = !chainOnly">
                            <v-icon start size="16">{{ chainOnly ? 'mdi-arrow-expand-all' : 'mdi-filter-outline' }}</v-icon>
                            {{ chainOnly ? '전체 보기' : '체인만 보기' }}
                        </v-btn>
                        <v-btn v-if="canOpenSource" size="small" variant="outlined" data-testid="open-source" @click="openSource(selected)">
                            <v-icon start size="16">mdi-open-in-new</v-icon>{{ SOURCE_TEXT[selected.label] }}
                        </v-btn>
                        <v-btn
                            v-if="selected.label === 'Process'"
                            size="small"
                            variant="outlined"
                            data-testid="change-impact-open"
                            :loading="changeImpactLoading"
                            @click="runChangeImpact(false)"
                        >
                            <v-icon start size="16">mdi-vector-polyline</v-icon>변경 영향
                        </v-btn>
                        <v-btn
                            v-if="hasFilterDashboard && selected.label === 'Process' && selected.properties?.domain"
                            size="small"
                            variant="outlined"
                            data-testid="open-dashboard"
                            @click="openInDashboard(selected)"
                        >
                            <v-icon start size="16">mdi-chart-box-outline</v-icon>분석 대시보드에서 보기
                        </v-btn>
                    </div>

                    <!-- 프로세스 변경 영향 (spec 016) -->
                    <div v-if="selected.label === 'Process' && changeImpact" class="mt-4" data-testid="change-impact">
                        <div v-if="changeImpact.error" class="text-caption text-error">{{ changeImpact.error }}</div>
                        <template v-else>
                            <div class="soe-section-label">이 프로세스를 바꾸면</div>
                            <div class="text-caption text-medium-emphasis mb-2">
                                영향 프로세스 높음 {{ changeImpact.summary.high }} · 중간 {{ changeImpact.summary.medium }} · 낮음
                                {{ changeImpact.summary.low }}
                                <span v-if="changeImpact.group"> · 그룹 {{ changeImpact.group.name }}</span>
                            </div>
                            <div v-if="changeImpact.version_diff" class="text-caption mb-2" data-testid="change-impact-diff">
                                버전 {{ changeImpact.version_diff.base_version }} → {{ changeImpact.version_diff.head_version }}: 추가
                                {{ changeImpact.version_diff.added.length }} · 삭제 {{ changeImpact.version_diff.removed.length }} · 수정
                                {{ changeImpact.version_diff.modified.length }}
                            </div>
                            <div v-if="!changeImpact.affected.length" class="text-caption text-medium-emphasis">
                                호출·인계·데이터·시스템·문서·담당자·KPI 로 이어진 다른 프로세스가 없습니다.
                            </div>
                            <div
                                v-for="a in changeImpact.affected.slice(0, 8)"
                                :key="a.id"
                                class="soe-ripple"
                                :class="a.level"
                                data-testid="change-impact-row"
                            >
                                <div class="soe-ripple-head">
                                    <span class="soe-ripple-level">{{ RIPPLE_TEXT[a.level] }}</span>
                                    <button type="button" class="soe-link text-truncate" @click="index.nodes.has(a.id) && scrollTo(a.id)">
                                        {{ a.name }}
                                    </button>
                                    <span class="soe-ripple-score">{{ a.score }}</span>
                                </div>
                                <div v-for="(r, i) in a.reasons.slice(0, 3)" :key="i" class="soe-ripple-reason">
                                    <template v-if="r.via"
                                        ><b>{{ r.via.name }}</b> — </template
                                    >{{ r.text }}
                                </div>
                                <div v-if="a.kpis.length" class="soe-ripple-reason">
                                    KPI · {{ a.kpis.map((k: any) => k.name).join(', ') }}
                                </div>
                            </div>
                            <div v-if="changeImpact.kpis_at_risk.length" class="mt-2">
                                <div class="text-caption font-weight-bold mb-1">함께 볼 KPI</div>
                                <div class="d-flex flex-wrap ga-1">
                                    <v-chip
                                        v-for="k in changeImpact.kpis_at_risk"
                                        :key="k.id"
                                        size="x-small"
                                        variant="tonal"
                                        @click="index.nodes.has(k.id) && scrollTo(k.id)"
                                    >
                                        {{ k.name }}
                                    </v-chip>
                                </div>
                            </div>
                            <div class="d-flex align-center ga-2 mt-2">
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    class="px-0"
                                    data-testid="change-impact-versions"
                                    @click="runChangeImpact(!changeImpact.version_diff)"
                                >
                                    {{ changeImpact.version_diff ? '프로세스 전체로 보기' : '최근 버전 변경분만 보기' }}
                                </v-btn>
                            </div>
                            <div class="text-caption text-medium-emphasis">
                                근거: 호출·인계, 데이터(누가 이 산출물을 읽나), 같은 시스템·규정·담당자·KPI. 지도의 파란 외곽선이 영향
                                프로세스입니다.
                            </div>
                        </template>
                    </div>

                    <!-- KPI 원인 분석 결과 (strategy-service impact) -->
                    <div v-if="selected.label === 'KPI' && (impact || impactLoading)" class="mt-4">
                        <div v-if="impact?.error" class="text-caption text-error mt-2">{{ impact.error }}</div>
                        <template v-else-if="impact">
                            <div v-if="impact.no_downstream" class="text-caption text-medium-emphasis mt-2">
                                이 KPI에 연결된 프로세스·실행 이력이 없습니다.
                            </div>
                            <div v-else class="mt-2">
                                <div class="text-caption font-weight-bold mb-1">개선 후보 (영향 점수순)</div>
                                <div
                                    v-for="c in (impact.candidates || []).slice(0, 6)"
                                    :key="`${c.type}:${c.id}`"
                                    class="soe-candidate"
                                    @click="index.nodes.has(c.id) && select(c.id)"
                                >
                                    <v-chip size="x-small" variant="tonal">{{ IMPACT_TYPE_TEXT[c.type] || c.type }}</v-chip>
                                    <span class="text-truncate flex-grow-1">{{ c.name }}</span>
                                    <span class="text-caption text-medium-emphasis">{{ fmt(c.score, 2) }}</span>
                                </div>
                                <v-alert
                                    v-if="diagnosisText(impact.diagnosis)"
                                    type="info"
                                    variant="tonal"
                                    density="compact"
                                    class="mt-2 text-caption"
                                >
                                    {{ diagnosisText(impact.diagnosis) }}
                                </v-alert>
                                <div v-else class="text-caption text-disabled mt-1">AI 진단은 LLM 설정 시 함께 표시됩니다.</div>
                            </div>
                        </template>
                    </div>

                    <!-- 직접 연결 — 관계마다 출처(선언·측정 정의·동기화·통계 가설 승인) -->
                    <div v-if="directLinks.length" class="mt-4">
                        <div class="text-caption font-weight-bold mb-1">직접 연결</div>
                        <div v-for="g in directLinks" :key="g.rel" class="mb-2">
                            <div class="text-caption text-medium-emphasis">
                                {{ g.rel }} ({{ g.items.length }})<span v-if="g.origin" class="soe-origin">{{ g.origin }}</span>
                            </div>
                            <div class="d-flex flex-wrap ga-1">
                                <v-chip
                                    v-for="it in g.items.slice(0, 12)"
                                    :key="it.n.id"
                                    size="x-small"
                                    variant="outlined"
                                    @click="
                                        select(it.n.id);
                                        scrollTo(it.n.id);
                                    "
                                >
                                    {{ it.n.name }}<span v-if="it.note" class="soe-chip-note">{{ it.note }}</span>
                                </v-chip>
                                <span v-if="g.items.length > 12" class="text-caption text-medium-emphasis"
                                    >외 {{ g.items.length - 12 }}</span
                                >
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
        <!-- 영향 가설 검토 — 통계는 제안하고 사람이 정한다 -->
        <v-dialog v-model="hypoOpen" max-width="820" scrollable>
            <v-card class="soe-hypo-card" data-testid="hypo-dialog">
                <v-card-title class="d-flex align-center">
                    <span>영향 가설 검토</span>
                    <v-spacer />
                    <v-btn icon size="small" variant="text" aria-label="닫기" @click="hypoOpen = false"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text>
                    <p class="soe-hypo-intro">
                        실행 지표(주간 완료 건수·평균 소요시간·지연 비율)와 KPI 주간 값의 시차 상관으로 찾은 <b>후보</b>입니다. 상관은
                        인과를 증명하지 않습니다 — 업무를 아는 사람이 맞다고 판단한 것만 <b>승인</b>하세요. 승인한 가설은 지도에 점선
                        관계(영향 가설)로 들어가고, 거절한 가설은 다시 분석해도 대기로 돌아오지 않습니다.
                    </p>
                    <v-alert v-if="hypoError" type="error" variant="tonal" density="compact" class="mb-2">{{ hypoError }}</v-alert>
                    <div v-if="!hypos.length" class="soe-callout">
                        제안된 가설이 없습니다. KPI 측정 이력이 8주 이상 쌓이면 분석할 수 있습니다.
                    </div>
                    <div v-for="h in hypos" :key="h.id" class="soe-hypo" :class="h.status" data-testid="hypo-row">
                        <div class="soe-hypo-main">
                            <div class="soe-hypo-pair">
                                <span>{{ h.process_name || h.process_id }}</span>
                                <v-icon size="14">mdi-arrow-right</v-icon>
                                <span>{{ h.kpi_name || h.kpi_id }}</span>
                            </div>
                            <div class="soe-hypo-stat">
                                {{ h.metric_text }} → {{ hypoLag(h) }} · <b>{{ h.direction }}</b> · r
                                <span class="soe-num">{{ h.r > 0 ? '+' : '' }}{{ fmt(h.r, 2) }}</span> · {{ h.n }}주 · p
                                {{ fmt(h.p_value, 3) }}
                            </div>
                        </div>
                        <div class="soe-hypo-act">
                            <span class="soe-hypo-status">{{ HYPO_STATUS[h.status] || h.status }}</span>
                            <template v-if="h.status === 'pending'">
                                <v-btn
                                    size="small"
                                    variant="flat"
                                    :color="INK"
                                    :loading="hypoBusy === h.id"
                                    @click="decideHypo(h, 'approved')"
                                    >승인</v-btn
                                >
                                <v-btn size="small" variant="outlined" :disabled="hypoBusy === h.id" @click="decideHypo(h, 'rejected')"
                                    >거절</v-btn
                                >
                            </template>
                            <v-btn v-else size="small" variant="text" :loading="hypoBusy === h.id" @click="decideHypo(h, 'pending')"
                                >되돌리기</v-btn
                            >
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <span class="text-caption text-medium-emphasis px-2">시차 0~2주 · 8주 이상 · |r| ≥ 0.6 · 순열 검정 p ≤ 0.05(보정)</span>
                    <v-spacer />
                    <v-btn variant="outlined" :loading="hypoLoading" @click="rediscover">다시 분석</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
/* 전략–실행 지도 — 데이터(지형)는 조용한 면 위에, 코스(선택 경로)만 보라로 위에 얹는다. 토큰은 strategyTheme.css */
.soe {
    --ripple: var(--sx-ripple); /* 프로세스 변경 영향(파급) */
    --risk: var(--sx-risk);
    --warn: var(--sx-warn);
    --course: var(--sx-course);
    --course-wash: var(--sx-course-soft);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    color: var(--sx-ink);
}
.soe-toolbar :deep(.v-btn) {
    letter-spacing: 0;
    text-transform: none;
    border-radius: 8px;
    font-weight: 600;
}
.soe-toolbar :deep(.v-btn--variant-outlined) {
    border-color: var(--sx-line-strong);
    color: var(--sx-ink-2);
}
.soe-toolbar :deep(.v-btn--variant-outlined:hover) {
    color: var(--sx-ink);
    background: var(--sx-surface-hover);
}
.soe-tool-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.soe-search {
    max-width: 300px;
    min-width: 200px;
}
.soe-search :deep(.v-field) {
    border-radius: 8px;
    background: var(--sx-surface);
}
.soe-search :deep(.v-field--focused .v-field__outline) {
    color: var(--sx-accent);
}
.soe-sync-time {
    margin-left: 6px;
    font-weight: 500;
    color: var(--sx-ink-3);
}

/* 범례 */
.soe-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 18px;
    padding: 8px 12px;
    border-radius: var(--sx-radius);
    background: var(--sx-surface-sunken);
    font-size: 12.5px;
    color: var(--sx-ink-2);
}
.soe-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.soe-legend-scale {
    color: var(--sx-ink);
    font-variant-numeric: tabular-nums;
}
.soe-legend-terrain {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
}
.soe-legend-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.soe-legend-terrain i {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.soe-body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 14px;
}
.soe-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 16px;
    border: 1px dashed var(--sx-line-strong);
    border-radius: var(--sx-radius-lg);
}

/* 캔버스 */
.soe-canvas-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    width: 100%;
    display: flex;
}
.soe-offmark {
    position: absolute;
    /* 열 머리 띠 안 — 카드·통제점을 가리지 않는다 */
    top: 10px;
    z-index: 6;
    padding: 5px 12px;
    border: 1px solid var(--sx-course);
    border-radius: 999px;
    background: var(--sx-surface);
    color: var(--sx-course);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    box-shadow: var(--sx-shadow-2);
    transition: background-color var(--sx-dur) var(--sx-ease);
}
.soe-offmark:hover {
    background: var(--sx-course-soft);
}
.soe-offmark.left {
    left: 8px;
}
.soe-offmark.right {
    right: 8px;
}
.soe-canvas {
    flex: 1;
    min-width: 0;
    overflow: auto;
    cursor: grab;
    background: var(--sx-surface);
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-lg);
    padding: 0 20px 16px;
    overscroll-behavior: contain;
}
.soe-canvas.dragging {
    cursor: grabbing;
    user-select: none;
}
.soe-canvas.dragging .soe-card {
    cursor: grabbing;
}
.soe-stage-headers {
    position: sticky;
    top: 0;
    height: 52px;
    z-index: 5;
    background: var(--sx-surface);
}
.soe-stage-header {
    position: absolute;
    top: 0;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 0 calc(20px + 4px);
    background: color-mix(in srgb, var(--ink) 5%, var(--sx-surface));
    border-bottom: 1px solid var(--sx-line);
}
.soe-stage-header::after {
    /* 단계 색 밑줄 */
    content: '';
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: -1px;
    height: 2px;
    border-radius: 2px;
    background: var(--ink);
    opacity: 0.55;
}
.soe-stage-header.collapsed {
    justify-content: center;
    padding: 0;
}
.soe-stage-header.collapsed::after {
    display: none;
}
.soe-stage-name {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--sx-ink);
}
.soe-stage-text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.soe-stage-tail {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.soe-stage-fold,
.soe-stage-unfold {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--sx-ink-3);
    cursor: pointer;
    transition: background-color var(--sx-dur) var(--sx-ease), color var(--sx-dur) var(--sx-ease);
}
.soe-stage-fold {
    width: 26px;
    height: 26px;
    /* 평소엔 옅게, 열 머리에 마우스를 올리거나 키보드 포커스일 때 또렷하게 */
    opacity: 0.55;
}
.soe-stage-header:hover .soe-stage-fold,
.soe-stage-fold:focus-visible {
    opacity: 1;
}
@media (hover: none) {
    .soe-stage-fold {
        opacity: 1;
    }
}
.soe-stage-fold:hover,
.soe-stage-unfold:hover {
    background: var(--sx-surface-hover);
    color: var(--ink);
}
.soe-stage-unfold {
    flex-direction: column;
    gap: 2px;
    width: 100%;
    height: 100%;
}
.soe-stage-unfold-arrow {
    color: var(--sx-ink-3);
}
.soe-stage-icon {
    color: var(--ink) !important;
}
.soe-stage-count {
    min-width: 28px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--sx-surface);
    box-shadow: inset 0 0 0 1px var(--sx-line);
    font-size: 12px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
}
.soe-plane {
    position: relative;
    margin-top: 10px;
}
.soe-band {
    position: absolute;
    top: -10px;
    z-index: 0;
    background: color-mix(in srgb, var(--ink) 3%, transparent);
}
.soe-edges {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: visible;
}
.soe-edge {
    stroke: var(--sx-ink-3);
    stroke-width: 1;
    opacity: 0.28;
}
.soe-edge.in-chain {
    /* 보라는 코스 전용 — 체인의 나머지 선은 진한 회색 */
    stroke: var(--sx-ink-2);
    stroke-width: 1.25;
    opacity: 0.45;
}
.soe-edge.hover {
    stroke: var(--sx-accent);
    opacity: 0.6;
}
.soe-edge.skip {
    stroke-dasharray: 3 3;
}
.soe-edge.hypo {
    stroke: var(--sx-ink-2);
    stroke-dasharray: 5 4;
    opacity: 0.75;
}
.soe-origin {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--sx-surface-hover);
    font-size: 11px;
    color: var(--sx-ink-2);
}
.soe-chip-note {
    margin-left: 4px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--sx-ink-2);
}
.soe-count-badge {
    margin-left: 6px;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--sx-accent);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
}
/* 다이얼로그는 body 로 텔레포트되어 .soe 의 토큰을 물려받지 못한다 — 같은 토큰을 다시 연다 */
.soe-hypo-card {
    --sx-line: var(--cds-border, rgba(15, 23, 42, 0.1));
    --sx-ink: var(--cds-text-primary, #0f172a);
    --sx-ink-2: var(--cds-text-secondary, #475569);
    border-radius: 14px !important;
}
.soe-hypo-intro {
    font-size: 13px;
    line-height: 1.6;
    color: var(--sx-ink);
    margin-bottom: 12px;
}
.soe-hypo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 4px;
    border-bottom: 1px solid var(--sx-line);
}
.soe-hypo.rejected .soe-hypo-main {
    opacity: 0.55;
}
.soe-hypo-pair {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: var(--sx-ink);
}
.soe-hypo-stat {
    margin-top: 2px;
    font-size: 12.5px;
    color: var(--sx-ink-2);
}
.soe-hypo-act {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}
.soe-hypo-status {
    font-size: 12px;
    color: var(--sx-ink-2);
    min-width: 56px;
    text-align: right;
}
.soe-course {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    overflow: visible;
}
.soe-course-mark {
    fill: var(--sx-surface);
}
.soe-course-no {
    font-size: 13px;
    paint-order: stroke;
    stroke: var(--sx-surface);
    stroke-width: 3px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    fill: var(--course);
}

/* 접힌 단계 */
.soe-collapsed {
    position: absolute;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12px;
    border: 1px dashed var(--sx-line-strong);
    border-radius: var(--sx-radius);
    background: var(--sx-surface-sunken);
    color: var(--sx-ink-2);
    cursor: pointer;
    transition: border-color var(--sx-dur) var(--sx-ease), color var(--sx-dur) var(--sx-ease);
}
.soe-collapsed:hover,
.soe-collapsed:focus-visible {
    border-color: var(--sx-accent);
    color: var(--sx-accent);
    outline: none;
}
.soe-collapsed-label {
    writing-mode: vertical-rl;
    font-size: 12px;
    font-weight: 700;
}

/* 카드 = 지도 위 지점 */
.soe-card {
    position: absolute;
    z-index: 3;
    box-sizing: border-box;
    padding: 7px 10px 6px;
    background: var(--sx-surface);
    border: 1px solid var(--sx-line);
    border-radius: 8px;
    box-shadow: var(--sx-shadow-1);
    cursor: pointer;
    overflow: hidden;
    /* 코스 지점이 열 맨 위로 올라올 때 순간이동하지 않게(감속 곡선, 모션 줄이기 설정이면 끔) */
    transition: top 0.22s var(--sx-ease), left 0.22s var(--sx-ease), border-color var(--sx-dur) var(--sx-ease),
        box-shadow var(--sx-dur) var(--sx-ease);
}
.soe-card:hover {
    border-color: var(--sx-line-strong);
    box-shadow: var(--sx-shadow-2);
}
.soe-card:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
}
.soe-card.selected {
    border: 1px solid var(--course);
    background: color-mix(in srgb, var(--course) 6%, var(--sx-surface));
    box-shadow: 0 0 0 3px var(--sx-course-ring);
}
/* 프로세스 변경 영향 — 파급(코스 보라·위험 빨강과 겹치지 않는 파랑). 굵기·선 종류로 수준을 구분한다 */
.soe-card.ripple-high {
    outline: 2px solid var(--ripple);
    outline-offset: 1px;
}
.soe-card.ripple-medium {
    outline: 2px dashed var(--ripple);
    outline-offset: 1px;
}
.soe-card.ripple-low {
    outline: 1px dotted var(--ripple);
    outline-offset: 1px;
}
.soe-ripple {
    padding: 8px 10px;
    margin-bottom: 6px;
    border: 1px solid var(--sx-line);
    border-radius: 8px;
    box-shadow: inset 3px 0 0 var(--ripple);
}
.soe-ripple.medium {
    box-shadow: inset 2px 0 0 var(--ripple);
}
.soe-ripple.low {
    box-shadow: inset 1px 0 0 var(--ripple);
}
.soe-ripple-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
}
.soe-ripple-level {
    font-size: 11px;
    font-weight: 700;
    color: var(--ripple);
    flex: none;
}
.soe-ripple-score {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sx-ink-2);
}
.soe-ripple-reason {
    font-size: 12px;
    color: var(--sx-ink-2);
    line-height: 1.45;
}
.soe-card.dimmed {
    /* 맥락 노드: 상자를 지우고 글자만 — 배경처럼 읽히되 대비 3:1 이상 */
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    color: var(--sx-ink-3);
}
.soe-card.dimmed .soe-card-sub,
.soe-card.dimmed .soe-num {
    color: var(--sx-ink-3);
}
.soe-card.dimmed :deep(.v-icon) {
    color: var(--sx-ink-3) !important;
}
.soe-card.dimmed .osym {
    opacity: 0.55;
}
.soe-card.match {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
}
.soe-card.risk:not(.selected):not(.dimmed),
.soe-card.bottleneck:not(.selected):not(.dimmed) {
    border-color: color-mix(in srgb, var(--risk) 45%, var(--sx-surface));
    background: color-mix(in srgb, var(--risk) 3%, var(--sx-surface));
}
.soe-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
}
.soe-card-sub {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    margin-top: 4px;
    font-size: 12px;
    color: var(--sx-ink-2);
}
.soe-num {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--sx-ink);
}
.soe-state {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
}
.soe-state--risk {
    color: var(--risk);
}
.soe-state--warn {
    color: var(--warn);
}
.soe-state--muted {
    color: var(--sx-ink-2);
    font-weight: 600;
}

/* 상세 패널 */
.soe-detail {
    width: 360px;
    flex-shrink: 0;
    overflow-y: auto;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-lg);
    padding: 18px;
    background: var(--sx-surface);
    box-shadow: var(--sx-shadow-1);
}
.soe-detail-title {
    display: flex;
    align-items: center;
    gap: 8px;
}
.soe-detail-ctl {
    flex-shrink: 0;
}
.soe-detail-no {
    font-size: 12px;
    font-weight: 800;
    fill: var(--course);
}
.soe-detail-name {
    word-break: keep-all;
    overflow-wrap: anywhere;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
}
.soe-detail-sub {
    margin-top: 4px;
    font-size: 12.5px;
    color: var(--sx-ink-2);
    font-weight: 600;
}
.soe-detail-metric {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--sx-radius);
    background: var(--sx-surface-sunken);
}
.soe-detail-big {
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
}
.soe-detail-level {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--sx-ink-2);
}
.soe-toolbar-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--sx-ink-3);
    white-space: nowrap;
}
.soe-legend-toggle {
    display: none !important;
}
.soe-section-label {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--sx-ink-2);
    margin-bottom: 6px;
}
.soe-course-table {
    padding-top: 12px;
    border-top: 1px solid var(--sx-line);
}
.soe-course-row {
    display: grid;
    grid-template-columns: 22px 66px 1fr auto;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 6px;
    border-radius: 8px;
    text-align: left;
    font-size: 12.5px;
    transition: background-color var(--sx-dur) var(--sx-ease);
}
.soe-course-row:hover,
.soe-course-row:focus-visible {
    background: var(--sx-surface-hover);
    outline: none;
}
.soe-course-row.current {
    background: var(--course-wash);
    font-weight: 700;
}
.soe-course-row-no {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid var(--course);
    color: var(--course);
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.soe-course-row-kind {
    font-size: 11.5px;
    font-weight: 700;
}
.soe-course-row-name {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.soe-course-row-val {
    font-size: 12.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.soe-stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1px;
    overflow: hidden;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
    background: var(--sx-line);
}
.soe-stats > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 2px;
    background: var(--sx-surface);
}
.soe-stats b {
    font-size: 17px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.soe-stats span {
    font-size: 11px;
    color: var(--sx-ink-2);
}
.soe-props td {
    font-size: 12.5px;
    height: 30px !important;
    border-bottom-color: var(--sx-line) !important;
}
.soe-candidate {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12.5px;
    transition: background-color var(--sx-dur) var(--sx-ease);
}
.soe-candidate:hover {
    background: var(--sx-surface-hover);
}
.soe-xfilter {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: var(--sx-radius);
    background: var(--sx-accent-soft);
    font-size: 13px;
    color: var(--sx-ink);
}
.soe-time,
.soe-ask {
    padding: 10px 14px;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
    background: var(--sx-surface);
    box-shadow: var(--sx-shadow-1);
}
.soe-time-date {
    min-width: 92px;
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sx-ink);
}
.soe-time-note {
    font-size: 12px;
    color: var(--sx-ink-2);
}
.soe-ask-examples {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.soe-ask-example {
    padding: 3px 10px;
    border: 1px solid var(--sx-line);
    border-radius: 999px;
    font-size: 12px;
    color: var(--sx-ink-2);
    background: var(--sx-surface-sunken);
    transition: border-color var(--sx-dur) var(--sx-ease), color var(--sx-dur) var(--sx-ease);
}
.soe-ask-example:hover:not(:disabled) {
    border-color: var(--sx-course);
    color: var(--sx-course);
}
.soe-ask-answer {
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--sx-line);
}
.soe-ask-q {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--sx-ink-2);
}
.soe-ask-text {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.65;
    color: var(--sx-ink);
    white-space: pre-line;
}
.soe-ask-path {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--sx-ink);
}
.soe-ask-steps summary {
    cursor: pointer;
    font-size: 12.5px;
    color: var(--sx-ink-2);
}
.soe-ask-steps ol {
    margin: 6px 0 0 18px;
    padding: 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--sx-ink);
}
.soe-callout {
    padding: 10px 12px;
    border-radius: var(--sx-radius);
    background: var(--sx-surface-sunken);
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--sx-ink);
}
.soe-callout--risk {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    background: var(--sx-risk-soft);
    font-weight: 600;
}
.soe-assign {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
    font-size: 12.5px;
    color: var(--sx-ink);
}
.soe-assign-row {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: baseline;
    gap: 8px;
}
.soe-assign-key {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--sx-ink-3);
}
.soe-assign-lane {
    font-weight: 700;
    word-break: keep-all;
}
.soe-assign-list {
    display: grid;
    gap: 6px;
    min-width: 0;
}
.soe-assign-list--inline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
}
.soe-assign-team,
.soe-assign-person {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
}
.soe-assign-team .soe-link,
.soe-assign-person .soe-link {
    font-size: 12.5px;
}
.soe-assign-note,
.soe-assign-path {
    font-size: 11.5px;
    color: var(--sx-ink-2);
}
.soe-assign-path::before {
    content: '· ';
}
.soe-assign-why {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--sx-surface-hover);
    font-size: 11px;
    color: var(--sx-ink-2);
}
.soe-kpi-process {
    padding: 10px 12px;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
}
.soe-link {
    color: var(--sx-ink);
    font-weight: 700;
    font-size: 13px;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: var(--sx-line-strong);
    text-underline-offset: 3px;
    transition: text-decoration-color var(--sx-dur) var(--sx-ease);
}
.soe-link:hover {
    text-decoration-color: var(--sx-accent);
    color: var(--sx-accent);
}
.soe-muted {
    color: var(--sx-ink-2);
}
.soe-stage-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
}
.min-w-0 {
    min-width: 0;
}
.soe ::selection {
    background: var(--sx-course-soft);
}
@media (prefers-reduced-motion: reduce) {
    .soe-card {
        transition: none;
    }
}
/* 좁은 화면: 상세 패널을 캔버스 아래로 */
@media (max-width: 760px) {
    .soe-body {
        flex-direction: column;
    }
    .soe-canvas-wrap {
        flex: 0 0 auto;
    }
    .soe-canvas {
        flex: 1 1 0;
        min-width: 0;
        height: 60vh;
    }
    .soe-detail {
        width: 100%;
    }
    .soe-toolbar-hint,
    .soe-sync-time {
        display: none;
    }
    .soe-legend-toggle {
        display: inline-flex !important;
    }
    .soe-legend {
        display: none;
    }
    .soe-legend.open {
        display: flex;
    }
    .soe-legend-terrain {
        margin-left: 0;
    }
}
</style>

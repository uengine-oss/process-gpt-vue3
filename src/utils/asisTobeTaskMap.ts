/**
 * As-Is ↔ To-Be task box 매핑 자동 도출.
 *
 * As-Is/To-Be 는 서로 다른 element id 를 가진 별개 BPMN 이므로, task 이름 유사도로
 * 매칭하여 변화 유형(unchanged/modified/added/removed/consolidated(N:1)/split(1:N))을 분류한다.
 * 결과는 사용자가 수동 보정할 수 있으며(auto:false), 보정본은 재도출 시 보존된다.
 */
import { createTaskMapEntry, type TaskMapEntry, type MappingType } from '@/composables/blueprint/blueprintModel';

export interface BpmnTask {
    id: string;
    name: string;
    type: string;
}

const TASK_RE = /Task$|^task$|callActivity|subProcess/;

export function extractTasks(xml: string): BpmnTask[] {
    if (!xml) return [];
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return [];
    }
    if (doc.getElementsByTagName('parsererror').length) return [];
    const out: BpmnTask[] = [];
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
        const ln = el.localName || '';
        if (!TASK_RE.test(ln)) continue;
        const id = el.getAttribute('id');
        if (!id) continue;
        out.push({ id, name: el.getAttribute('name') || '', type: ln });
    }
    return out;
}

function normalize(name: string): string {
    return String(name || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9가-힣]/g, '');
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        let prevDiag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1));
            prevDiag = tmp;
        }
    }
    return prev[b.length];
}

/** 0~1 유사도. 정규화 동일 → 1. */
export function similarity(a: string, b: string): number {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na && !nb) return 0;
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    if (!maxLen) return 0;
    return 1 - levenshtein(na, nb) / maxLen;
}

const THRESHOLD = 0.55;

interface DeriveOptions {
    /** 사용자 수동 보정(auto:false) 보존용 기존 매핑. */
    existing?: TaskMapEntry[];
    /** tobe element id → {issue_id, solution_id} 부가정보. */
    annotations?: Record<string, { issue_id?: string | null; solution_id?: string | null; change_description?: string }>;
}

/**
 * As-Is/To-Be XML 으로부터 TaskMapEntry[] 자동 도출.
 */
export function deriveTaskMap(asIsXml: string, toBeXml: string, opts: DeriveOptions = {}): TaskMapEntry[] {
    const asisTasks = extractTasks(asIsXml);
    const tobeTasks = extractTasks(toBeXml);
    if (!tobeTasks.length && !asisTasks.length) return [];

    // 수동 보정 보존: tobe_element_id 기준
    const manual = new Map<string, TaskMapEntry>();
    for (const e of opts.existing || []) {
        if (e.auto === false && e.tobe_element_id) manual.set(e.tobe_element_id, e);
    }

    // best match 계산
    const bestAsisForTobe = new Map<string, { id: string; score: number }>();
    for (const t of tobeTasks) {
        let best: { id: string; score: number } | null = null;
        for (const a of asisTasks) {
            const s = similarity(t.name || t.type, a.name || a.type);
            if (s >= THRESHOLD && (!best || s > best.score)) best = { id: a.id, score: s };
        }
        if (best) bestAsisForTobe.set(t.id, best);
    }
    const bestTobeForAsis = new Map<string, { id: string; score: number }>();
    for (const a of asisTasks) {
        let best: { id: string; score: number } | null = null;
        for (const t of tobeTasks) {
            const s = similarity(a.name || a.type, t.name || t.type);
            if (s >= THRESHOLD && (!best || s > best.score)) best = { id: t.id, score: s };
        }
        if (best) bestTobeForAsis.set(a.id, best);
    }

    // 각 As-Is 가 어느 To-Be 의 best 인지로 fanout 집계 (split 판정)
    const asisFanout = new Map<string, number>(); // asisId → (그 asis 를 best 로 삼은 tobe 수)
    for (const [, m] of bestAsisForTobe) {
        asisFanout.set(m.id, (asisFanout.get(m.id) || 0) + 1);
    }

    const asisById = new Map(asisTasks.map((a) => [a.id, a]));
    const usedAsis = new Set<string>();
    const entries: TaskMapEntry[] = [];

    for (const t of tobeTasks) {
        if (manual.has(t.id)) {
            const m = manual.get(t.id)!;
            m.asis_element_ids.forEach((id) => usedAsis.add(id));
            entries.push(m);
            continue;
        }
        // 이 To-Be 가 흡수한 As-Is 들 = bestTobeForAsis 가 이 t 를 가리키는 asis ∪ bestAsisForTobe[t]
        const absorbed = new Set<string>();
        for (const a of asisTasks) {
            const bt = bestTobeForAsis.get(a.id);
            if (bt && bt.id === t.id) absorbed.add(a.id);
        }
        const bm = bestAsisForTobe.get(t.id);
        if (bm) absorbed.add(bm.id);

        const asisIds = Array.from(absorbed);
        let mappingType: MappingType;
        let changeDesc = '';

        if (asisIds.length === 0) {
            mappingType = 'added';
            changeDesc = '신규 추가된 단계';
        } else if (asisIds.length >= 2) {
            mappingType = 'consolidated';
            changeDesc = `${asisIds.length}개 As-Is 단계가 통합됨 (N:1)`;
        } else {
            const a = asisById.get(asisIds[0]);
            if (asisFanout.get(asisIds[0]) && (asisFanout.get(asisIds[0]) as number) >= 2) {
                mappingType = 'split';
                changeDesc = '하나의 As-Is 단계가 분할됨 (1:N)';
            } else if (a && normalize(a.name) === normalize(t.name)) {
                mappingType = 'unchanged';
            } else {
                mappingType = 'modified';
                changeDesc = a ? `"${a.name}" → "${t.name}"` : '변경됨';
            }
        }
        asisIds.forEach((id) => usedAsis.add(id));
        const anno = opts.annotations?.[t.id];
        entries.push(
            createTaskMapEntry({
                tobe_element_id: t.id,
                tobe_element_name: t.name,
                asis_element_ids: asisIds,
                mapping_type: mappingType,
                change_description: anno?.change_description || changeDesc,
                issue_id: anno?.issue_id ?? null,
                solution_id: anno?.solution_id ?? null,
                auto: true
            })
        );
    }

    // 매칭되지 않은 As-Is → removed
    for (const a of asisTasks) {
        if (usedAsis.has(a.id)) continue;
        entries.push(
            createTaskMapEntry({
                tobe_element_id: '',
                tobe_element_name: '',
                asis_element_ids: [a.id],
                mapping_type: 'removed',
                change_description: `"${a.name}" 단계 삭제`,
                auto: true
            })
        );
    }

    return entries;
}

/**
 * mapping_type → BpmnUengineViewer 의 diffActivities changeType.
 * 뷰어는 `bpmn-diff-${changeType}` 마커를 적용한다 (added/deleted/modified 는 기존 CSS,
 * consolidated/split 은 BpmnUengineViewer 에 추가한 CSS).
 */
const MAP_TO_DIFF: Record<MappingType, string | null> = {
    unchanged: null,
    modified: 'modified',
    added: 'added',
    removed: 'deleted',
    consolidated: 'consolidated',
    split: 'split'
};

/** To-Be 캔버스 마커: tobe_element_id → diff changeType. */
export function toBeMarkers(taskMap: TaskMapEntry[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of taskMap) {
        if (!e.tobe_element_id) continue;
        const ct = MAP_TO_DIFF[e.mapping_type];
        if (ct) out[e.tobe_element_id] = ct;
    }
    return out;
}

/** As-Is 캔버스 마커: asis_element_id → diff changeType. */
export function asIsMarkers(taskMap: TaskMapEntry[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of taskMap) {
        const ct = MAP_TO_DIFF[e.mapping_type];
        if (!ct) continue;
        for (const id of e.asis_element_ids) {
            if (id) out[id] = ct;
        }
    }
    return out;
}

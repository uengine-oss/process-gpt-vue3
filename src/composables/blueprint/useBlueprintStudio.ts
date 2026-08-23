/**
 * useBlueprintStudio — To-Be Blueprint Studio 의 핵심 상태/오케스트레이션.
 *
 * - 저장 위치: proc_def.definition.tobe (JSON). 구버전 definition.tobe_bpmn 흡수.
 * - 이슈는 As-Is BPMN 의 PI Flag 코멘트에서 시드.
 * - 솔루션 제안/블루프린트 생성은 AI(qdrantChat) 사용.
 * - ROI baseline 은 definition.fte 에서 산출.
 */
import { ref, computed, type Ref } from 'vue';
import {
    type ToBeData,
    type ToBeIssue,
    type SolutionOption,
    type TaskMapEntry,
    createEmptyToBe,
    createIssue,
    createSolution,
    normalizeToBe,
    hashString,
    nowIso
} from './blueprintModel';
import { computeBaselineFromDefinition } from './useToBeRoi';
import { parseFlagsFromBpmn, type ParsedFlag } from './piFlagParser';
import { isBpmnModelElement } from '@/utils/bpmnModelElement';
import { proposeSolutions } from '@/components/ai/SolutionProposalGenerator';
import { generateToBeBpmn } from '@/components/ai/BestBpmnGenerator';
import { generateExecutableDefinition, validationFeedback } from '@/components/ai/ExecutableProcessGenerator';
import {
    createEmptyExecutable,
    hasBpmnActivities,
    validateExecutableDefinition,
    type ExecutableData,
    type ExecutableDefinition
} from './executableModel';
import { buildExecutableForms } from './executableForms';
import { deriveTaskMap } from '@/utils/asisTobeTaskMap';

interface StudioOptions {
    backend: any;
    /** 현재 process definition id (proc_def.id). */
    defId: () => string;
    /** 현재 processDefinition 객체. */
    getProcessDefinition: () => any;
    /** 현재 As-Is BPMN XML. */
    getAsIsXml: () => string;
    /** 작성자 식별자(감사용). */
    getActor?: () => string | undefined;
}

function flagToIssue(flag: ParsedFlag): ToBeIssue {
    const statusLabel = flag.status === 'resolved' ? '[즉시개선] ' : '[향후과제] ';
    return createIssue({
        source_comment_id: flag.commentId,
        source_element_id: flag.elementId,
        source_element_name: flag.elementName,
        title: flag.description ? flag.description.slice(0, 80) : `${statusLabel}${flag.elementName || '개선 이슈'}`,
        description: flag.description,
        flag_type: flag.type,
        created_by: flag.authorName,
        status: 'confirmed'
    });
}

/** tobe_bpmn_versions / applied_history 보존 상한 — ProcessHierarchy 의 To-Be 이력 캡과 동일. */
const TOBE_HISTORY_LIMIT = 50;

/** 다음 To-Be 도면 버전(major.minor) 계산 — ProcessHierarchy.computeNextToBeVersion 과 동일 규칙. */
function nextToBeVersion(entries: any[]): string {
    let maxMajor = 1;
    let maxMinor = 0;
    for (const e of entries || []) {
        const [major = 0, minor = 0] = String(e?.version || '')
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
        if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
            maxMajor = major;
            maxMinor = minor;
        }
    }
    return `${maxMajor}.${maxMinor + 1}`;
}

/** BPMN XML 의 노드/링크 수 계산 (DOM 기반, 라벨 제외). */
function countBpmn(xml: string): { node_count: number; link_count: number } {
    if (!xml) return { node_count: 0, link_count: 0 };
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return { node_count: 0, link_count: 0 };
        const all = Array.from(doc.getElementsByTagName('*'));
        let nodes = 0;
        let links = 0;
        for (const el of all) {
            if (!isBpmnModelElement(el)) continue;
            const ln = el.localName || '';
            if (/Task$|^task$|callActivity|subProcess|Event$|Gateway$/.test(ln)) nodes++;
            else if (/SequenceFlow|MessageFlow/.test(ln)) links++;
        }
        return { node_count: nodes, link_count: links };
    } catch {
        return { node_count: 0, link_count: 0 };
    }
}

export function useBlueprintStudio(opts: StudioOptions) {
    const tobe: Ref<ToBeData> = ref(createEmptyToBe());
    const loading = ref(false);
    const saving = ref(false);
    const generatingBlueprint = ref(false);
    const generatingExecutable = ref(false);
    const applyingExecutable = ref(false);
    const proposingIssueId = ref<string | null>(null);
    const dirty = ref(false);
    const lastError = ref<string>('');
    const sessionId = `blueprint-studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let saveTimer: any = null;
    // 자동저장 범위: 'exec' 는 실행형 변환 작업본만 변경된 상태 → executable 컬럼 단독 UPDATE 로
    // 블루프린트/순서도 저장과의 definition 경합을 피한다. 'full' 이 항상 우선(상위집합).
    let pendingSaveScope: 'full' | 'exec' | null = null;

    const issues = computed<ToBeIssue[]>(() => tobe.value.issues);
    const roi = computed(() => tobe.value.roi);
    const blueprintXml = computed(() => tobe.value.blueprint_xml);
    const blueprintMeta = computed(() => tobe.value.blueprint_meta);
    const taskMap = computed(() => tobe.value.task_map);
    const hasBlueprint = computed(() => !!tobe.value.blueprint_xml);
    const confirmedCount = computed(() => issues.value.length);
    const selectedCount = computed(() => issues.value.filter((i) => !!i.selected_solution_id).length);

    // AN Transformation Studio 확장 상태
    const partitions = computed(() => tobe.value.partitions || []);
    const gaps = computed(() => tobe.value.gaps || []);
    const orchestrator = computed(() => tobe.value.orchestrator || null);
    const roadmap = computed(() => tobe.value.roadmap || null);
    const skillShift = computed(() => tobe.value.skill_shift || null);
    const modularized = computed(() => tobe.value.modularized || []);
    const modularizedBpmn = computed(() => tobe.value.modularized_bpmn || '');
    const publishStatus = computed(() => tobe.value.publish_status || 'draft');
    const executable = computed(() => tobe.value.executable || null);

    function markDirty() {
        dirty.value = true;
        pendingSaveScope = 'full';
        scheduleSave();
    }

    /** 실행형 변환 작업본만 변경됐을 때 — executable 컬럼 단독 저장 예약. */
    function markExecDirty() {
        dirty.value = true;
        if (pendingSaveScope !== 'full') pendingSaveScope = 'exec';
        scheduleSave();
    }

    function findIssue(id: string): ToBeIssue | undefined {
        return tobe.value.issues.find((i) => i.id === id);
    }

    /* -------------------- load / seed / baseline -------------------- */

    function recomputeBaseline() {
        const def = opts.getProcessDefinition()?.definition;
        const baseline = computeBaselineFromDefinition(def, tobe.value.roi.annual_cost_per_fte);
        tobe.value.roi.baseline = baseline;
    }

    function seedIssuesFromFlags() {
        if (tobe.value.issues.length > 0) return; // 사용자 편집 보존
        const flags = parseFlagsFromBpmn(opts.getAsIsXml());
        if (!flags.length) return;
        tobe.value.issues = flags.map(flagToIssue);
    }

    function load() {
        loading.value = true;
        try {
            const def = opts.getProcessDefinition()?.definition || {};
            tobe.value = normalizeToBe(def.tobe, def.tobe_bpmn);
            seedIssuesFromFlags();
            recomputeBaseline();
            dirty.value = false;
        } finally {
            loading.value = false;
        }
    }

    /* -------------------- issue / solution CRUD -------------------- */

    function addIssue(partial: Partial<ToBeIssue> = {}) {
        const issue = createIssue({ created_by: opts.getActor?.(), ...partial });
        tobe.value.issues.push(issue);
        markDirty();
        return issue;
    }

    function removeIssue(issueId: string) {
        tobe.value.issues = tobe.value.issues.filter((i) => i.id !== issueId);
        markDirty();
    }

    function updateIssue(issueId: string, patch: Partial<ToBeIssue>) {
        const issue = findIssue(issueId);
        if (!issue) return;
        Object.assign(issue, patch, { updated_at: nowIso() });
        markDirty();
    }

    function addSolution(issueId: string, partial: Partial<SolutionOption> = {}) {
        const issue = findIssue(issueId);
        if (!issue) return;
        const sol = createSolution(partial);
        issue.solutions.push(sol);
        issue.updated_at = nowIso();
        markDirty();
        return sol;
    }

    function updateSolution(issueId: string, solId: string, patch: Partial<SolutionOption>) {
        const issue = findIssue(issueId);
        const sol = issue?.solutions.find((s) => s.id === solId);
        if (!sol) return;
        Object.assign(sol, patch, { updated_at: nowIso() });
        // 사용자가 AI 제안을 수정하면 표식 갱신
        if (patch && Object.keys(patch).some((k) => k !== 'updated_at')) sol.ai_generated = sol.ai_generated && false;
        if (issue) issue.updated_at = nowIso();
        markDirty();
    }

    function removeSolution(issueId: string, solId: string) {
        const issue = findIssue(issueId);
        if (!issue) return;
        issue.solutions = issue.solutions.filter((s) => s.id !== solId);
        if (issue.selected_solution_id === solId) {
            issue.selected_solution_id = null;
            issue.status = 'confirmed';
        }
        issue.updated_at = nowIso();
        markDirty();
    }

    /** 솔루션 선택/해제 — ROI 누적에 즉시 반영. */
    function selectSolution(issueId: string, solId: string | null) {
        const issue = findIssue(issueId);
        if (!issue) return;
        const next = issue.selected_solution_id === solId ? null : solId;
        issue.selected_solution_id = next;
        issue.status = next ? 'solution_selected' : 'confirmed';
        issue.updated_at = nowIso();
        markDirty();
    }

    /* -------------------- AI proposal / generation -------------------- */

    async function proposeForIssue(issueId: string, { replace = false } = {}) {
        const issue = findIssue(issueId);
        if (!issue) return;
        proposingIssueId.value = issueId;
        lastError.value = '';
        try {
            const solutions = await proposeSolutions(opts.backend, {
                issue,
                processName: opts.getProcessDefinition()?.name || '',
                bpmnXml: opts.getAsIsXml(),
                sessionId
            });
            if (replace) {
                // AI 제안만 교체, 사용자가 직접 만든 옵션은 유지
                issue.solutions = issue.solutions.filter((s) => !s.ai_generated).concat(solutions);
            } else {
                issue.solutions.push(...solutions);
            }
            issue.updated_at = nowIso();
            markDirty();
            return solutions;
        } catch (e: any) {
            lastError.value = e?.message || 'AI 솔루션 제안에 실패했습니다.';
            throw e;
        } finally {
            proposingIssueId.value = null;
        }
    }

    /** 선택된 솔루션을 모두 갖췄지만 아직 제안이 없는 이슈에 일괄 AI 제안. */
    async function proposeForAllEmpty() {
        const targets = tobe.value.issues.filter((i) => i.solutions.length === 0);
        for (const issue of targets) {
            // 순차 실행 (백엔드 부담/세션 일관성)
            // eslint-disable-next-line no-await-in-loop
            await proposeForIssue(issue.id).catch(() => null);
        }
    }

    function applyBlueprintXml(xml: string, summary: string, fromSolutionIds: string[]) {
        const counts = countBpmn(xml);
        tobe.value.blueprint_xml = xml;
        tobe.value.blueprint_meta = {
            generated_at: nowIso(),
            generated_from_solution_ids: fromSolutionIds,
            xml_hash: hashString(xml),
            node_count: counts.node_count,
            link_count: counts.link_count,
            status: 'current',
            summary
        };
        deriveMapping();
        markDirty();
    }

    /** As-Is ↔ To-Be element 매핑 자동 재도출 (수동 보정 entry 보존). */
    function deriveMapping() {
        const asIs = opts.getAsIsXml();
        const toBe = tobe.value.blueprint_xml;
        if (!toBe) {
            tobe.value.task_map = [];
            return;
        }
        // tobe element → issue/solution 부가정보 (대상 As-Is task 이름 일치 기준 best-effort)
        const annotations: Record<string, { issue_id?: string | null; solution_id?: string | null }> = {};
        tobe.value.task_map = deriveTaskMap(asIs, toBe, {
            existing: tobe.value.task_map,
            annotations
        });
    }

    function updateMapping(id: string, patch: Partial<TaskMapEntry>) {
        const entry = tobe.value.task_map.find((m) => m.id === id);
        if (!entry) return;
        Object.assign(entry, patch);
        markDirty();
    }

    function selectedDirectives() {
        const directives: any[] = [];
        for (const issue of tobe.value.issues) {
            if (!issue.selected_solution_id) continue;
            const sol = issue.solutions.find((s) => s.id === issue.selected_solution_id);
            if (!sol) continue;
            directives.push({
                issueTitle: issue.title,
                solutionTitle: sol.title,
                solutionType: sol.solution_type,
                description: sol.description,
                targetTask: issue.source_element_name
            });
        }
        return directives;
    }

    /** "Blueprint 생성하기" / "재생성하기" — 선택 솔루션 반영 To-Be 생성. */
    async function generateBlueprint() {
        generatingBlueprint.value = true;
        lastError.value = '';
        try {
            const asIsXml = opts.getAsIsXml();
            const directives = selectedDirectives();
            const fromIds = directives.length
                ? tobe.value.issues.filter((i) => i.selected_solution_id).map((i) => i.selected_solution_id as string)
                : [];
            const { xml, summary } = await generateToBeBpmn(opts.backend, {
                asIsXml,
                processName: opts.getProcessDefinition()?.name || '',
                directives,
                sessionId
            });
            applyBlueprintXml(xml, summary, fromIds);
            // 생성에 사용된 이슈 상태 갱신
            for (const issue of tobe.value.issues) {
                if (issue.selected_solution_id) issue.status = 'in_blueprint';
            }
            return { xml, summary };
        } catch (e: any) {
            lastError.value = e?.message || 'To-Be 블루프린트 생성에 실패했습니다.';
            throw e;
        } finally {
            generatingBlueprint.value = false;
        }
    }

    /** As-Is 를 그대로 복사해 To-Be 시작점으로 사용 (AI 미사용 fallback). */
    function seedBlueprintFromAsIs() {
        const xml = opts.getAsIsXml();
        if (!xml) return;
        applyBlueprintXml(xml, 'As-Is 복사본', []);
        tobe.value.blueprint_meta.status = 'draft';
    }

    /**
     * 외부(순서도 To-Be 캔버스 수동 편집 등)에서 확정된 To-Be XML 을 청사진으로 반영.
     * persist 의 tobe_bpmn = blueprint_xml 동기화가 수동 편집을 덮어쓰지 않게 하고,
     * Exec 뷰·실행형 변환(executableSource)이 캔버스 최신본을 원본으로 삼게 한다.
     * markDirty 를 걸지 않는다 — 호출측(persistToBeBpmn/persistToBeVersion)이 tobe_bpmn 을
     * 이미 영속화했고, definition.tobe.blueprint_xml 은 다음 full 저장과 로드 시
     * normalizeToBe 의 tobe_bpmn 우선 흡수로 수렴한다.
     */
    function setBlueprintXml(xml: string, summary = '수동 편집 반영') {
        if (typeof xml !== 'string' || !xml.trim()) return;
        if (xml === tobe.value.blueprint_xml) return;
        const counts = countBpmn(xml);
        tobe.value.blueprint_xml = xml;
        tobe.value.blueprint_meta = {
            ...tobe.value.blueprint_meta,
            xml_hash: hashString(xml),
            node_count: counts.node_count,
            link_count: counts.link_count,
            status: 'current',
            summary
        };
        deriveMapping();
    }

    /* -------------------- 실행형 변환 (AI) -------------------- */

    /**
     * 실행형 변환의 원본 도면: To-Be(모듈화판 우선) > As-Is.
     * 단, 액티비티가 실제로 존재하는 도면만 후보로 삼는다 — As-Is↔To-Be 토글만 해도
     * 빈 To-Be 캔버스가 tobe_bpmn 으로 자동 저장되므로(Designer persistToBeBpmn),
     * 빈 To-Be 를 원본으로 잡으면 As-Is 가 멀쩡한데도 "액티비티 없음" 오류가 난다.
     */
    function executableSource(): { xml: string; source: 'asis' | 'tobe' | 'modularized' } {
        const candidates: Array<{ xml: string; source: 'asis' | 'tobe' | 'modularized' }> = [
            { xml: tobe.value.modularized_bpmn || '', source: 'modularized' },
            { xml: tobe.value.blueprint_xml || '', source: 'tobe' },
            { xml: opts.getAsIsXml() || '', source: 'asis' }
        ];
        for (const c of candidates) {
            if (c.xml && hasBpmnActivities(c.xml)) return c;
        }
        return { xml: opts.getAsIsXml() || '', source: 'asis' };
    }

    /**
     * "실행형 변환" — 순서도 BPMN 을 엔진 definition JSON 으로 AI 변환.
     * 이전 변환의 검증 실패 항목이 있으면 재변환 피드백으로 전달한다.
     * @param sourceOverride 'asis' 를 주면 To-Be 가 있어도 As-Is 기준으로 변환.
     */
    async function generateExecutable(sourceOverride?: 'asis' | 'tobe' | 'modularized') {
        generatingExecutable.value = true;
        lastError.value = '';
        try {
            let src = executableSource();
            if (sourceOverride === 'asis') src = { xml: opts.getAsIsXml(), source: 'asis' };
            else if (sourceOverride === 'tobe' && tobe.value.blueprint_xml) {
                src = { xml: tobe.value.blueprint_xml, source: 'tobe' };
            }
            if (!src.xml) throw new Error('변환할 BPMN 이 없습니다.');
            if (!hasBpmnActivities(src.xml)) {
                const label = src.source === 'asis' ? 'As-Is' : src.source === 'tobe' ? 'To-Be' : 'To-Be(모듈화)';
                throw new Error(`${label} 도면에 액티비티가 없어 변환할 수 없습니다. 순서도 내용을 확인해 주세요.`);
            }

            const prev = tobe.value.executable;
            const feedback =
                prev && prev.source_xml_hash === hashString(src.xml) ? validationFeedback(prev.validation) : '';

            const { definition, summary, validation } = await generateExecutableDefinition(opts.backend, {
                bpmnXml: src.xml,
                defId: opts.defId(),
                processName: opts.getProcessDefinition()?.name || '',
                feedback,
                sessionId,
                execPoolIds: (prev?.exec_pools || []).map((p) => p.id)
            });

            const next: ExecutableData = {
                ...createEmptyExecutable(),
                definition,
                source: src.source,
                source_xml_hash: hashString(src.xml),
                // 실행형 Pool 지정은 재변환을 넘어 유지
                exec_pools: (prev?.exec_pools || []).map((p) => ({ ...p })),
                exec_pool_id: prev?.exec_pool_id,
                exec_pool_name: prev?.exec_pool_name,
                summary,
                generated_at: nowIso(),
                validation
            };
            tobe.value.executable = next;
            markExecDirty();
            return next;
        } catch (e: any) {
            lastError.value = e?.message || '실행형 변환에 실패했습니다.';
            throw e;
        } finally {
            generatingExecutable.value = false;
        }
    }

    /**
     * Exec 뷰에서 직접 수정한 실행 정의 반영 — 재검증 후 tobe.executable 에 저장(autosave).
     * proc_def.definition 실행 필드에는 반영되지 않으므로, 실행에 적용하려면
     * applyExecutable("실행 정의로 등록")을 다시 호출해야 한다.
     */
    function updateExecutableDefinition(definition: ExecutableDefinition) {
        const exec = tobe.value.executable;
        if (!exec) throw new Error('수정할 실행형 변환 결과가 없습니다. 먼저 실행형 변환을 실행하세요.');
        exec.definition = definition;
        exec.validation = validateExecutableDefinition(definition);
        exec.edited_at = nowIso();
        markExecDirty();
        return exec.validation;
    }

    /**
     * 실행형 Pool 지정 토글 — 풀 2개 이상 도면에서 시작이벤트·실행 흐름의 기준 풀(다중 지정 가능).
     * As-Is/To-Be 캔버스의 Pool 속성 패널에서 호출하며, 변환 전에도 지정할 수 있도록
     * executable 이 없으면 빈 작업본을 만든다. @returns 토글 후 지정 여부.
     */
    function toggleExecutablePool(poolId: string, poolName?: string): boolean {
        const id = String(poolId || '').trim();
        if (!id) return false;
        if (!tobe.value.executable) tobe.value.executable = createEmptyExecutable();
        const exec = tobe.value.executable;
        const pools = Array.isArray(exec.exec_pools) ? exec.exec_pools : (exec.exec_pools = []);
        const idx = pools.findIndex((p) => p.id === id);
        const designated = idx < 0;
        if (designated) pools.push({ id, name: poolName || undefined });
        else pools.splice(idx, 1);
        // 구버전 단일 필드 미러 (첫 지정 풀)
        exec.exec_pool_id = pools[0]?.id;
        exec.exec_pool_name = pools[0]?.name;
        markExecDirty();
        return designated;
    }

    /**
     * "실행 정의로 등록" (관리자 전용 액션 — 호출측에서 권한 확인).
     * 변환된 definition 의 실행 필드를 proc_def.definition 에 병합해
     * 순서도 실행 버튼(getExecutionDefinition 4순위 폴백)이 실제로 작동하게 한다.
     * userTask 별 폼(form_def)도 함께 생성·연결한다 (tool=formHandler:<form id>).
     * tobe 등 기존 메타 필드는 보존한다.
     */
    async function applyExecutable(actor?: string) {
        const exec = tobe.value.executable;
        if (!exec?.definition) throw new Error('등록할 실행 정의가 없습니다. 먼저 실행형 변환을 실행하세요.');
        const validation = validateExecutableDefinition(exec.definition);
        exec.validation = validation;
        if (validation.errors.length) {
            throw new Error(`검증 오류 ${validation.errors.length}건을 해결한 뒤 등록할 수 있습니다. (첫 항목: ${validation.errors[0]})`);
        }
        applyingExecutable.value = true;
        lastError.value = '';
        const prevApplied = { at: exec.applied_at, by: exec.applied_by };
        try {
            // userTask 폼 생성 + tool/conditionData 배선 (기존 사용자 지정 폼은 보존)
            const { forms, definition: wired } = buildExecutableForms(exec.definition, opts.defId());
            for (const form of forms) {
                await opts.backend.putRawDefinition(form.html, form.id, {
                    type: 'form',
                    proc_def_id: form.proc_def_id,
                    activity_id: form.activity_id
                });
            }
            exec.definition = wired;

            exec.applied_at = nowIso();
            exec.applied_by = actor || opts.getActor?.() || undefined;
            tobe.value.updated_at = nowIso();
            const current = opts.getProcessDefinition()?.definition || {};

            // 등록 시점 To-Be 도면을 tobe_bpmn_versions 에 고정하고 그 버전을 exec 에 스탬프한다.
            // 인스턴스 진행 표시가 "실행 당시" 도면(등록분)을 복원하는 유일한 근거 — XML 본문은
            // tobe_bpmn_versions(50건 캡)에, 시각→버전 매핑은 exec.applied_history 에 남는다.
            const appliedXml = tobe.value.blueprint_xml || current.tobe_bpmn || '';
            let appliedTobeVersion: string | undefined = current.tobe_version || undefined;
            let tobeVersionEntries: any[] = Array.isArray(current.tobe_bpmn_versions)
                ? current.tobe_bpmn_versions.slice()
                : [];
            if (appliedXml) {
                const existing = [...tobeVersionEntries].reverse().find((v) => v && v.xml === appliedXml);
                if (existing?.version) {
                    appliedTobeVersion = String(existing.version);
                } else {
                    appliedTobeVersion = nextToBeVersion(tobeVersionEntries);
                    tobeVersionEntries.push({
                        version: appliedTobeVersion,
                        xml: appliedXml,
                        message: '실행 정의 등록 시점 스냅샷',
                        created_at: exec.applied_at,
                        created_by: exec.applied_by || ''
                    });
                    if (tobeVersionEntries.length > TOBE_HISTORY_LIMIT) {
                        tobeVersionEntries = tobeVersionEntries.slice(tobeVersionEntries.length - TOBE_HISTORY_LIMIT);
                    }
                }
            }
            exec.applied_tobe_version = appliedTobeVersion;
            exec.applied_history = [
                ...(exec.applied_history || []),
                { applied_at: exec.applied_at, applied_by: exec.applied_by, tobe_version: appliedTobeVersion }
            ].slice(-TOBE_HISTORY_LIMIT);

            const definition = {
                ...current,
                ...exec.definition,
                // 실행형 Pool 스탬프 — 실행 시작(다중 시작 필터)이 이 풀들의 startEvent 를 기준으로 삼는다.
                // 엔진(pydantic)은 미지 키를 무시하므로 안전. execPoolId 는 구버전 판독 호환 미러.
                execPoolIds: exec.exec_pools?.length ? exec.exec_pools.map((p) => p.id) : undefined,
                execPoolId: exec.exec_pools?.[0]?.id || exec.exec_pool_id || undefined,
                // 등록 마커 — 버전 스냅샷(proc_def_version.definition)에도 남아 exec 등록 여부·기준 도면을 알린다.
                execAppliedAt: exec.applied_at,
                execTobeVersion: appliedTobeVersion,
                tobe: tobe.value,
                tobe_bpmn: appliedXml || current.tobe_bpmn || '',
                tobe_version: appliedTobeVersion || current.tobe_version,
                tobe_bpmn_versions: tobeVersionEntries.length ? tobeVersionEntries : current.tobe_bpmn_versions
            };
            await opts.backend.updateProcessDefinitionMetadata(opts.defId(), { definition }, '실행 정의 등록');
            syncLocalDefinition(definition);
            dirty.value = false;
            return { ...exec, generatedFormCount: forms.length } as ExecutableData & { generatedFormCount: number };
        } catch (e: any) {
            exec.applied_at = prevApplied.at;
            exec.applied_by = prevApplied.by;
            lastError.value = e?.message || '실행 정의 등록에 실패했습니다.';
            throw e;
        } finally {
            applyingExecutable.value = false;
        }
    }

    /* -------------------- AN Studio field setters -------------------- */

    function setPartitions(list: any[]) {
        tobe.value.partitions = Array.isArray(list) ? list : [];
        markDirty();
    }
    function setGaps(list: any[]) {
        tobe.value.gaps = Array.isArray(list) ? list : [];
        markDirty();
    }
    function setOrchestrator(model: any) {
        tobe.value.orchestrator = model || null;
        markDirty();
    }
    function setRoadmap(model: any) {
        tobe.value.roadmap = model || null;
        markDirty();
    }
    function setSkillShift(model: any) {
        tobe.value.skill_shift = model || null;
        markDirty();
    }
    function setModularized(list: any[]) {
        tobe.value.modularized = Array.isArray(list) ? list : [];
        markDirty();
    }
    function setModularizedBpmn(xml: string) {
        tobe.value.modularized_bpmn = typeof xml === 'string' ? xml : '';
        markDirty();
    }
    function setPublishStatus(status: 'draft' | 'published') {
        tobe.value.publish_status = status;
        if (status === 'published') tobe.value.published_at = nowIso();
        markDirty();
    }

    /* -------------------- persistence -------------------- */

    function buildDefinitionPayload() {
        const current = opts.getProcessDefinition()?.definition || {};
        tobe.value.updated_at = nowIso();
        return {
            ...current,
            tobe: tobe.value,
            // 기존 디자이너 호환: tobe_bpmn 동기화
            tobe_bpmn: tobe.value.blueprint_xml || current.tobe_bpmn || ''
        };
    }

    /**
     * 저장한 definition 을 로컬 processDefinition 에도 반영.
     * 페이지(ProcessHierarchy)와 AN studio 가 definition 객체를 참조 공유하므로,
     * 포인터 교체가 아니라 제자리 병합(Object.assign)으로 양쪽 모두 최신 상태를 보게 한다
     * (교체하면 페이지 쪽 참조가 낡은 채 남아 다음 순서도 저장이 studio 저장분을 되돌린다).
     */
    function syncLocalDefinition(definition: any) {
        const pd = opts.getProcessDefinition();
        if (!pd) return;
        if (pd.definition && typeof pd.definition === 'object') {
            Object.assign(pd.definition, definition);
        } else {
            pd.definition = definition;
        }
    }

    async function persist(scope: 'full' | 'exec' = 'full') {
        const defId = opts.defId();
        if (!defId) return;
        saving.value = true;
        lastError.value = '';
        try {
            if (scope === 'exec') {
                // 실행형 변환 작업본만 변경 — executable 컬럼 단독 UPDATE (definition/tobe 미접촉)
                tobe.value.updated_at = nowIso();
                await opts.backend.updateProcessDefinitionMetadata(
                    defId,
                    { executable: tobe.value.executable ?? null },
                    '실행 정의 저장'
                );
                const pd = opts.getProcessDefinition();
                if (pd?.definition?.tobe && typeof pd.definition.tobe === 'object' && pd.definition.tobe !== tobe.value) {
                    pd.definition.tobe.executable = tobe.value.executable ?? null;
                }
            } else {
                const definition = buildDefinitionPayload();
                await opts.backend.updateProcessDefinitionMetadata(defId, { definition }, 'To-Be 저장');
                // 로컬 동기화
                syncLocalDefinition(definition);
            }
            pendingSaveScope = null;
            dirty.value = false;
        } catch (e: any) {
            lastError.value = e?.message || 'To-Be 저장에 실패했습니다.';
            throw e;
        } finally {
            saving.value = false;
        }
    }

    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const scope = pendingSaveScope || 'full';
            persist(scope).catch((e) => console.warn('[BlueprintStudio] autosave failed:', e));
        }, 1000);
    }

    function dispose() {
        if (saveTimer) clearTimeout(saveTimer);
    }

    return {
        // state
        tobe,
        issues,
        roi,
        blueprintXml,
        blueprintMeta,
        taskMap,
        hasBlueprint,
        confirmedCount,
        selectedCount,
        // AN Studio 확장 상태
        partitions,
        gaps,
        orchestrator,
        roadmap,
        skillShift,
        modularized,
        modularizedBpmn,
        publishStatus,
        executable,
        loading,
        saving,
        generatingBlueprint,
        generatingExecutable,
        applyingExecutable,
        proposingIssueId,
        dirty,
        lastError,
        // lifecycle
        load,
        persist,
        dispose,
        markDirty,
        recomputeBaseline,
        // AN Studio setters
        setBlueprintXml,
        setPartitions,
        setGaps,
        setOrchestrator,
        setRoadmap,
        setSkillShift,
        setModularized,
        setModularizedBpmn,
        setPublishStatus,
        // CRUD
        addIssue,
        removeIssue,
        updateIssue,
        addSolution,
        updateSolution,
        removeSolution,
        selectSolution,
        // AI
        proposeForIssue,
        proposeForAllEmpty,
        generateBlueprint,
        seedBlueprintFromAsIs,
        applyBlueprintXml,
        // 실행형 변환
        executableSource,
        generateExecutable,
        updateExecutableDefinition,
        toggleExecutablePool,
        applyExecutable,
        // mapping
        deriveMapping,
        updateMapping
    };
}

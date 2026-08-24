/**
 * useAnStudio — AN Transformation Studio 4단계 오케스트레이션.
 *
 * 기존 To-Be Blueprint 엔진(useBlueprintStudio + useToBeRoi)을 코어로 재사용하고,
 * As-Is Partitioning → Gap Triage → To-Be Orchestrator → Roadmap 4단계의 상태/AI 호출을
 * 한 곳에서 관리한다. 모든 데이터는 proc_def.definition.tobe(JSON)에 저장된다.
 *
 * 진입 방식
 *  - 기존 프로세스 개선: loadProcess(item)  (DB 저장 활성)
 *  - 신규 시나리오 생성: startNewFromScenario(text)  (임시 — DB 저장 비활성, 등록은 후속 단계)
 *
 * AI: 실시간 qdrantChat 전용 (실패 시 error 노출, mock fallback 없음).
 */
import { ref, computed, type Ref, type InjectionKey } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { useBlueprintStudio } from '@/composables/blueprint/useBlueprintStudio';
import { useToBeRoi } from '@/composables/blueprint/useToBeRoi';
import {
    createGapCard,
    splitTmfCodes,
    type PartitionBlock,
    type GapCard,
    type GapTriageAction,
    type SkillShiftModel,
    type ModularizedChild
} from '@/composables/blueprint/blueprintModel';
import { extractTasksFromXml } from './bpmnTaskExtractor';
import { buildChildBpmn, validateBpmn, makeChildDefId, rewireOriginalBpmn } from './callActivityModularizer';
import { generateBpmn } from '@/services/bpmnGenerationService';
import { partitionAsIs } from '@/components/ai/AnPartitionGenerator';
import { analyzeGaps } from '@/components/ai/AnGapGenerator';
import { designToBe } from '@/components/ai/AnOrchestratorGenerator';
import { generateRoadmap } from '@/components/ai/AnRoadmapGenerator';

export type StageKey = 'partition' | 'gap' | 'orchestrator' | 'roadmap';
export const STAGE_KEYS: StageKey[] = ['partition', 'gap', 'orchestrator', 'roadmap'];

/** Call Activity 모듈화 대상 1건 (블록 → 자식 프로세스). */
export interface ModularizationPlanItem {
    partition_id: string;
    name: string;
    etom_process_id: string;
    element_ids: string[];
}

/** Gap 진단 컨텍스트로 전달되는 PI Flag(현업 코멘트) 1건. */
export interface AnPiFlagContext {
    elementId: string;
    elementName: string;
    type?: string;
    status?: string;
    description?: string;
}

/** 브리지된(블록 솔루션 → ROI) 이슈 식별자. 재생성 시 정리에 사용. */
const BRIDGE_FLAG = 'an_block';

function currentActor() {
    try {
        return {
            id: localStorage.getItem('uid') || '',
            name: localStorage.getItem('userName') || '',
            email: localStorage.getItem('email') || ''
        };
    } catch {
        return { id: '', name: '', email: '' };
    }
}

export function useAnStudio() {
    const backend = BackendFactory.createBackend() as any;
    const sessionId = `an-studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const actor = currentActor();

    const processDefinition = ref<any>(null);
    const asIsXml = ref<string>('');
    const isEphemeral = ref(false);

    const stageIndex = ref(0);
    const busyStage = ref<StageKey | 'modularize' | ''>('');
    const error = ref('');
    const loadingProcess = ref(false);
    // 신규 시나리오 → BPMN 생성 중 누적되는 실시간 미리보기 텍스트 (스트리밍)
    const genProgress = ref('');
    let genAbortController: AbortController | null = null;
    const selectedBlockId = ref<string | null>(null);

    // 임시(신규 생성) 모드에서는 defId 를 비워 서버 persist 를 no-op 으로 만든다.
    const defId = computed(() => (isEphemeral.value ? '' : processDefinition.value?.id || ''));
    const processName = computed(() => processDefinition.value?.name || '');

    const studio = useBlueprintStudio({
        backend,
        defId: () => defId.value,
        getProcessDefinition: () => processDefinition.value,
        getAsIsXml: () => asIsXml.value,
        getActor: () => actor.name || actor.email || undefined
    });

    const roi = useToBeRoi({ issues: studio.issues as Ref<any>, roi: studio.roi as Ref<any> });

    /* ----------------------------- selectors ----------------------------- */

    const partitions = studio.partitions;
    const gaps = studio.gaps;
    const orchestrator = studio.orchestrator;
    const roadmap = studio.roadmap;
    const skillShift = studio.skillShift;
    const modularized = studio.modularized;
    const modularizedBpmn = studio.modularizedBpmn;
    const publishStatus = studio.publishStatus;

    const confirmedPartitions = computed(() => (partitions.value || []).filter((p) => p.confirmed));
    const lockedGaps = computed(() => (gaps.value || []).filter((g) => g.locked));
    const selectedBlock = computed<PartitionBlock | null>(
        () => (partitions.value || []).find((p) => p.id === selectedBlockId.value) || null
    );

    const hasPartitions = computed(() => (partitions.value || []).length > 0);
    const hasGaps = computed(() => (gaps.value || []).length > 0);
    const hasOrchestrator = computed(() => !!orchestrator.value);
    const hasRoadmap = computed(() => !!roadmap.value);

    /* ----------------------------- loading ------------------------------ */

    async function loadProcess(item: any, opts: { xml?: string } = {}) {
        loadingProcess.value = true;
        error.value = '';
        try {
            const id = item?.proc_def_id || item?.id || '';
            let xml = opts.xml || '';
            if (!xml) {
                try {
                    const raw = await backend.getRawDefinition(id, { type: 'bpmn' });
                    xml = typeof raw === 'string' ? raw : raw?.bpmn || '';
                } catch (e) {
                    xml = '';
                }
            }
            // 목록/피커 아이템의 definition에는 To-Be 작업본이 없다(tobe/executable 컬럼 분리).
            // 단건 상세를 조회해 재조립된 definition(definition.tobe 포함)을 사용한다.
            let definition = item?.definition || {};
            if (id && typeof backend.getDefinitionDetailLite === 'function') {
                try {
                    const detail = await backend.getDefinitionDetailLite(id);
                    if (detail?.definition && typeof detail.definition === 'object') {
                        definition = detail.definition;
                    }
                } catch (e) {
                    /* 상세 조회 실패 시 아이템 definition 으로 진행 */
                }
            }
            processDefinition.value = {
                id,
                name: item?.process_name || item?.name || id,
                owner: item?.owner || null,
                definition
            };
            asIsXml.value = xml;
            isEphemeral.value = false;
            selectedBlockId.value = null;
            studio.load();
            stageIndex.value = 0;
        } finally {
            loadingProcess.value = false;
        }
    }

    async function startNewFromScenario(scenarioText: string, name?: string) {
        loadingProcess.value = true;
        error.value = '';
        genProgress.value = '';
        genAbortController = new AbortController();
        try {
            // SSE 스트리밍 + 실시간 미리보기(genProgress) + 취소(cancelGenerate)
            const resp = await generateBpmn({ sourceType: 'text', inputText: scenarioText }, genAbortController.signal, (text) => {
                genProgress.value = text;
            });
            processDefinition.value = {
                id: `an-draft-${Date.now().toString(36)}`,
                name: name || '신규 프로세스 (임시)',
                owner: null,
                definition: {}
            };
            asIsXml.value = resp?.xml || '';
            isEphemeral.value = true;
            selectedBlockId.value = null;
            studio.load();
            stageIndex.value = 0;
        } catch (e: any) {
            // 사용자가 취소(AbortError)한 경우는 조용히 종료
            if (e?.name !== 'AbortError') {
                error.value = e?.message || 'BPMN 생성에 실패했습니다.';
                throw e;
            }
        } finally {
            loadingProcess.value = false;
            genProgress.value = '';
            genAbortController = null;
        }
    }

    /** 진행 중인 신규 시나리오 BPMN 생성을 취소한다. */
    function cancelGenerate() {
        genAbortController?.abort();
    }

    function reset() {
        processDefinition.value = null;
        asIsXml.value = '';
        isEphemeral.value = false;
        stageIndex.value = 0;
        selectedBlockId.value = null;
        error.value = '';
    }

    /** 호스트 페이지(순서도)가 캔버스의 최신 As-Is XML 을 주입할 때 사용. */
    function setAsIsXml(xml: string) {
        if (typeof xml === 'string' && xml.trim()) asIsXml.value = xml;
    }

    /* ---------------------------- navigation ---------------------------- */

    function goToStage(i: number) {
        stageIndex.value = Math.min(STAGE_KEYS.length - 1, Math.max(0, i));
    }
    function nextStage() {
        goToStage(stageIndex.value + 1);
    }
    function selectBlock(id: string | null) {
        selectedBlockId.value = id;
    }

    /* --------------------------- stage AI ops --------------------------- */

    async function runPartition() {
        if (!asIsXml.value) {
            error.value = 'As-Is 도면이 없어 파티셔닝을 수행할 수 없습니다.';
            return;
        }
        busyStage.value = 'partition';
        error.value = '';
        try {
            const result = await partitionAsIs(backend, {
                asIsXml: asIsXml.value,
                processName: processName.value,
                activities: extractTasksFromXml(asIsXml.value),
                sessionId
            });
            studio.setPartitions(result);
            selectedBlockId.value = result[0]?.id || null;
        } catch (e: any) {
            error.value = e?.message || 'AI 블록 파티셔닝에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    function confirmPartitions() {
        const list = (partitions.value || []).map((p) => ({ ...p, confirmed: true }));
        studio.setPartitions(list);
    }

    /**
     * 캔버스에서 그룹 박스를 이동/리사이즈하거나 노드를 박스 안팎으로 옮긴 결과(기하학적 멤버십)를
     * 각 파티션의 element_ids 에 반영하고 tasks 를 동기화한다. (Task 2-1)
     * updates 에 포함된(박스가 있는) 파티션만 갱신하고, 박스가 없는 파티션은 그대로 둔다.
     * 기존 task 의 tmf 는 보존하고, 새로 들어온 노드는 캔버스 이름으로 task 를 추가한다.
     */
    function applyMembership(updates: { partitionId: string; members: { id: string; name: string }[] }[]) {
        if (!Array.isArray(updates) || !updates.length) return;
        const byId = new Map(updates.map((u) => [u.partitionId, Array.isArray(u.members) ? u.members : []]));
        let changed = false;
        const next = (partitions.value || []).map((p) => {
            if (!byId.has(p.id)) return p;
            const members = byId.get(p.id) || [];
            const memberIds = members.map((m) => m.id);
            const existing = new Map((p.tasks || []).map((t: any) => [t.id, t]));
            const tasks = members.map((m) => {
                const prev = existing.get(m.id);
                // 캔버스의 현재 이름(m.name)을 우선 반영하고, 비어 있을 때만 기존 이름 유지.
                return prev ? { ...prev, name: m.name || prev.name } : { id: m.id, name: m.name, tmf: 'TMF XXX' };
            });
            const prevIds = (p.element_ids || []).join('|');
            if (prevIds !== memberIds.join('|')) changed = true;
            return { ...p, element_ids: memberIds, tasks };
        });
        if (changed) studio.setPartitions(next);
    }

    /**
     * "…call activity 로 저장해줘" 트리거로 실행되는 모듈화 오케스트레이션. (Task 3-1/3-2)
     * 박스(element_ids)가 있는 블록을 각각 독립 BPMN 자식 프로세스로 추출(callActivityModularizer)하고,
     * 헤드리스 검증을 통과한 것만 신규 proc_def(type:'call-activity-sub')로 생성한다(결정 #6).
     * 원본의 Call Activity 치환·flow 재연결(3-3)은 다음 단계(P5)에서 definition.tobe 에 기록한다(결정 #5).
     */
    async function runModularization(): Promise<{ ok: boolean; message: string; plan: ModularizationPlanItem[] }> {
        const blocks = confirmedPartitions.value.length ? confirmedPartitions.value : partitions.value || [];
        const eligible = blocks.filter((b) => (b.element_ids || []).length > 0);
        if (!eligible.length) {
            const msg =
                '모듈화할 블록이 없습니다. 먼저 AI 블록 파티셔닝을 실행하고, 캔버스의 eTOM 블록 박스가 노드를 포함하도록 구획·조정하세요.';
            error.value = msg;
            return { ok: false, message: msg, plan: [] };
        }
        if (isEphemeral.value || !processDefinition.value?.id) {
            const msg = '신규(임시) 프로세스는 먼저 등록·저장한 뒤 모듈화할 수 있습니다.';
            error.value = msg;
            return { ok: false, message: msg, plan: [] };
        }
        busyStage.value = 'modularize';
        error.value = '';
        try {
            const plan: ModularizationPlanItem[] = eligible.map((b) => ({
                partition_id: b.id,
                name: b.name,
                etom_process_id: b.etom_process_id || '',
                element_ids: [...(b.element_ids || [])]
            }));

            const created: ModularizedChild[] = [];
            const okLines: string[] = [];
            const failed: string[] = [];
            const warnings: string[] = [];

            for (const item of plan) {
                const block = eligible.find((b) => b.id === item.partition_id);
                // 파티셔닝이 태스크별로 추정한 TMF Open API 코드 수집 (다중 허용, placeholder "TMF XXX" 제외).
                const taskTmf: Record<string, string[]> = {};
                const tmfApis: string[] = [];
                (block?.tasks || []).forEach((t) => {
                    const codes = splitTmfCodes(t?.tmf);
                    if (!codes.length) return;
                    if (t.id) taskTmf[t.id] = codes;
                    codes.forEach((code) => {
                        if (!tmfApis.includes(code)) tmfApis.push(code);
                    });
                });
                const built = buildChildBpmn(asIsXml.value, item.element_ids, {
                    name: item.name,
                    etomProcessId: item.etom_process_id || '',
                    etomL3: block?.etom_l3 || '',
                    taskTmf
                });
                if (!built) {
                    failed.push(`${item.name} (BPMN 추출 실패)`);
                    continue;
                }
                const valid = await validateBpmn(built.xml);
                if (!valid.ok) {
                    failed.push(`${item.name} (검증 실패: ${valid.error || 'invalid'})`);
                    continue;
                }
                const defId = makeChildDefId(item.name, item.etom_process_id);
                try {
                    await backend.putRawDefinition(built.xml, defId, {
                        name: item.name,
                        // 자식(Call Activity) 프로세스 소유자(PI팀담당자) = 모듈화 명령 실행자 이름
                        owner: actor.name || actor.id || actor.email || null,
                        definition: {
                            type: 'call-activity-sub',
                            etom_process_id: item.etom_process_id || '',
                            etom_l3: block?.etom_l3 || '',
                            tmf_apis: tmfApis
                        },
                        version: '0.1',
                        arcv_id: `${defId}_0.1`
                    });
                } catch (e: any) {
                    failed.push(`${item.name} (저장 실패: ${e?.message || 'error'})`);
                    continue;
                }
                created.push({
                    partition_id: item.partition_id,
                    def_id: defId,
                    name: item.name,
                    etom_process_id: item.etom_process_id,
                    tmf_apis: tmfApis,
                    element_ids: item.element_ids,
                    created_at: new Date().toISOString()
                });
                okLines.push(`${item.name}${item.etom_process_id ? ` (${item.etom_process_id})` : ''} → ${defId}`);
                if (built.warnings.length) warnings.push(`${item.name}: ${built.warnings.join(' ')}`);
            }

            let rewireNote = '';
            if (created.length) {
                // 같은 파티션의 기존 기록은 교체.
                const replacedPids = new Set(created.map((c) => c.partition_id));
                const merged = [...(modularized.value || []).filter((m) => !replacedPids.has(m.partition_id)), ...created];
                studio.setModularized(merged);

                // P5: 원본을 Call Activity 로 치환한 To-Be 미리보기 생성 → definition.tobe 에만 저장(결정 #5).
                const replacements = created.map((c) => ({
                    element_ids: c.element_ids,
                    name: c.name,
                    called_def_id: c.def_id,
                    etom_process_id: c.etom_process_id,
                    tmf_apis: c.tmf_apis
                }));
                const rewired = rewireOriginalBpmn(asIsXml.value, replacements);
                if (rewired) {
                    const valid = await validateBpmn(rewired.xml);
                    if (valid.ok) {
                        studio.setModularizedBpmn(rewired.xml);
                        if (rewired.warnings.length) warnings.push(...rewired.warnings);
                        rewireNote = `원본을 ${rewired.replaced}개 Call Activity 로 치환한 To-Be 미리보기를 저장했습니다(원본 도면은 변경하지 않음).`;
                    } else {
                        rewireNote = `원본 치환 미리보기 생성 실패(검증: ${valid.error || 'invalid'}). 자식 프로세스는 생성되었습니다.`;
                    }
                } else {
                    rewireNote = '원본 치환 대상이 없어 미리보기를 생성하지 않았습니다.';
                }

                try {
                    await save();
                } catch {
                    /* 추적정보 저장 실패는 무시 — 자식 proc_def 는 이미 생성됨 */
                }
            }

            const parts: string[] = [];
            if (okLines.length) {
                parts.push(
                    `${okLines.length}개 자식 프로세스를 생성했습니다 (type: call-activity-sub):\n${okLines
                        .map((s) => `· ${s}`)
                        .join('\n')}`
                );
            }
            if (warnings.length) parts.push(`경고:\n${warnings.map((s) => `· ${s}`).join('\n')}`);
            if (failed.length) parts.push(`생성 실패:\n${failed.map((s) => `· ${s}`).join('\n')}`);
            if (!okLines.length && !failed.length) parts.push('처리할 대상이 없습니다.');
            if (rewireNote) parts.push(rewireNote);
            return { ok: created.length > 0, message: parts.join('\n\n'), plan };
        } catch (e: any) {
            error.value = e?.message || '모듈화에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    async function runGapAnalysis(opts: { piFlags?: AnPiFlagContext[] } = {}) {
        const blocks = confirmedPartitions.value.length ? confirmedPartitions.value : partitions.value || [];
        if (!blocks.length) {
            error.value = '먼저 블록을 확정하세요.';
            return;
        }
        busyStage.value = 'gap';
        error.value = '';
        try {
            const result = await analyzeGaps(backend, {
                asIsXml: asIsXml.value,
                processName: processName.value,
                partitions: blocks,
                piFlags: opts.piFlags || [],
                sessionId
            });
            // 현업이 직접 등록한 커스텀 Gap 은 보존, AI 진단 결과로 교체
            const custom = (gaps.value || []).filter((g) => g.custom);
            studio.setGaps([...result, ...custom]);
        } catch (e: any) {
            error.value = e?.message || 'AI Gap 진단에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    /* ------------------------- gap triage CRUD -------------------------- */

    function patchGap(id: string, patch: Partial<GapCard>) {
        const list = (gaps.value || []).map((g) => (g.id === id ? { ...g, ...patch } : g));
        studio.setGaps(list);
    }

    function setTriage(id: string, action: GapTriageAction) {
        patchGap(id, { triage: action });
    }

    function updateGap(id: string, patch: Partial<GapCard>) {
        patchGap(id, patch);
    }

    function toggleTollgate(id: string, role: 'pi' | 'field' | 'hq') {
        const g = (gaps.value || []).find((x) => x.id === id);
        if (!g) return;
        const tollgate = { ...g.tollgate, [role]: !g.tollgate[role] };
        const locked = tollgate.pi && tollgate.field && tollgate.hq;
        patchGap(id, { tollgate, locked });
    }

    function addCustomGap(partial: Partial<GapCard> = {}) {
        const card = createGapCard({
            ...partial,
            custom: true,
            created_by: actor.name || actor.email,
            triage: 'accepted'
        });
        studio.setGaps([...(gaps.value || []), card]);
        return card;
    }

    function removeGap(id: string) {
        studio.setGaps((gaps.value || []).filter((g) => g.id !== id));
    }

    /* ----------------------- ROI bridge (blocks) ----------------------- */

    function bridgeBlockSolutions(blockSolutions: any[]) {
        // 이전 브리지 이슈 제거 (재생성 멱등성)
        const prior = (studio.issues.value || []).filter((i: any) => i.flag_type === BRIDGE_FLAG);
        prior.forEach((i: any) => studio.removeIssue(i.id));
        for (const bs of blockSolutions || []) {
            const issue = studio.addIssue({
                title: bs.partition_name ? `${bs.partition_name} — ${bs.title}` : bs.title,
                description: bs.description,
                flag_type: BRIDGE_FLAG,
                source_element_name: bs.partition_name,
                status: 'confirmed'
            });
            const sol = studio.addSolution(issue.id, {
                solution_type: bs.solution_type,
                title: bs.title,
                description: bs.description,
                implementation_effort: bs.implementation_effort,
                expected_impact: bs.expected_impact,
                ai_generated: true
            });
            if (sol) studio.selectSolution(issue.id, sol.id);
        }
    }

    async function runOrchestrator() {
        const blocks = confirmedPartitions.value.length ? confirmedPartitions.value : partitions.value || [];
        if (!blocks.length) {
            error.value = '먼저 블록을 확정하세요.';
            return;
        }
        busyStage.value = 'orchestrator';
        error.value = '';
        try {
            const res = await designToBe(backend, {
                asIsXml: asIsXml.value,
                processName: processName.value,
                partitions: blocks,
                gaps: lockedGaps.value.length ? lockedGaps.value : gaps.value || [],
                sessionId
            });
            studio.setOrchestrator(res.orchestrator);
            const skill: SkillShiftModel = { items: res.skill_shift || [], generated_at: new Date().toISOString() };
            studio.setSkillShift(skill);
            bridgeBlockSolutions(res.block_solutions || []);
        } catch (e: any) {
            error.value = e?.message || 'AI To-Be 오케스트레이터 설계에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    /** To-Be BPMN 도면 생성 (선택 솔루션 directive 반영) — 블록 상세 뷰용. 선택적. */
    async function generateToBeBpmn() {
        busyStage.value = 'orchestrator';
        error.value = '';
        try {
            await studio.generateBlueprint();
        } catch (e: any) {
            error.value = e?.message || 'To-Be 도면 생성에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    async function runRoadmap() {
        if (!hasOrchestrator.value) {
            error.value = '먼저 To-Be 오케스트레이터를 생성하세요.';
            return;
        }
        busyStage.value = 'roadmap';
        error.value = '';
        try {
            const blockSolutions = (studio.issues.value || [])
                .filter((i: any) => i.flag_type === BRIDGE_FLAG && i.selected_solution_id)
                .map((i: any) => {
                    const sol = i.solutions.find((s: any) => s.id === i.selected_solution_id);
                    if (!sol) return null;
                    return {
                        partition_name: i.source_element_name,
                        solution_type: sol.solution_type,
                        expected_impact: sol.expected_impact
                    };
                })
                .filter(Boolean);
            const result = await generateRoadmap(backend, {
                processName: processName.value,
                baseYear: new Date().getFullYear(),
                partitions: confirmedPartitions.value.length ? confirmedPartitions.value : partitions.value || [],
                blockSolutions,
                orchestrator: orchestrator.value,
                sessionId
            });
            studio.setRoadmap(result);
        } catch (e: any) {
            error.value = e?.message || 'AI 로드맵 생성에 실패했습니다.';
            throw e;
        } finally {
            busyStage.value = '';
        }
    }

    /* ----------------------------- publish ------------------------------ */

    const canPersist = computed(() => !isEphemeral.value && !!defId.value);

    async function publish() {
        if (!canPersist.value) {
            error.value = '임시(신규 생성) 청사진은 프로세스로 등록한 후 Publish 할 수 있습니다.';
            return false;
        }
        error.value = '';
        try {
            studio.setPublishStatus('published');
            await studio.persist();
            return true;
        } catch (e: any) {
            error.value = e?.message || 'Publish 에 실패했습니다.';
            throw e;
        }
    }

    async function save() {
        if (!canPersist.value) return false;
        try {
            await studio.persist();
            return true;
        } catch (e: any) {
            error.value = e?.message || '저장에 실패했습니다.';
            return false;
        }
    }

    function dispose() {
        studio.dispose();
    }

    /* --------------------------- copilot ctx ---------------------------- */

    const studioContext = computed(() => ({
        process: processName.value,
        stage: STAGE_KEYS[stageIndex.value],
        partitions: (partitions.value || []).map((p) => ({
            name: p.name,
            etom_l3: p.etom_l3,
            etom_process_id: p.etom_process_id || '',
            element_ids: p.element_ids || [],
            tasks: (p.tasks || []).map((t) => t.name)
        })),
        gaps: (gaps.value || []).map((g) => ({ category: g.category, title: g.title, locked: g.locked })),
        roi: { total_savings_krw: roi.totalSavingsKrw.value, fte_saved: roi.savings.value.fte }
    }));

    return {
        backend,
        sessionId,
        actor,
        // state
        processDefinition,
        asIsXml,
        isEphemeral,
        stageIndex,
        busyStage,
        error,
        loadingProcess,
        genProgress,
        selectedBlockId,
        selectedBlock,
        // blueprint passthrough
        studio,
        roi,
        partitions,
        gaps,
        orchestrator,
        roadmap,
        skillShift,
        modularized,
        modularizedBpmn,
        publishStatus,
        // derived
        processName,
        confirmedPartitions,
        lockedGaps,
        hasPartitions,
        hasGaps,
        hasOrchestrator,
        hasRoadmap,
        canPersist,
        studioContext,
        // lifecycle
        loadProcess,
        startNewFromScenario,
        cancelGenerate,
        reset,
        setAsIsXml,
        dispose,
        save,
        publish,
        goToStage,
        nextStage,
        selectBlock,
        // stage ops
        runPartition,
        confirmPartitions,
        applyMembership,
        runModularization,
        runGapAnalysis,
        runOrchestrator,
        generateToBeBpmn,
        runRoadmap,
        // gap triage
        setTriage,
        updateGap,
        toggleTollgate,
        addCustomGap,
        removeGap
    };
}

export type AnStudio = ReturnType<typeof useAnStudio>;

/** 셸에서 provide, 하위 스테이지/패널에서 inject 하는 키. */
export const AN_STUDIO_KEY: InjectionKey<AnStudio> = Symbol('anStudio');

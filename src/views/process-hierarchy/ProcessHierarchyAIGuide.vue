<template>
    <div class="ai-guide-panel">
        <div v-if="!embedded" class="ai-guide-header">
            <div>
                <div class="ai-guide-title">AI Copilot</div>
                <div class="ai-guide-subtitle">
                    {{ selectedTaskLabel }}
                </div>
            </div>
            <v-chip size="x-small" variant="tonal" color="primary">
                {{ isViewMode ? 'Viewer Context' : 'Editor Context' }}
            </v-chip>
        </div>

        <v-alert
            density="comfortable"
            variant="tonal"
            :color="element ? 'info' : 'primary'"
            class="mb-4"
            :icon="element ? 'mdi-cursor-default-click-outline' : 'mdi-file-tree-outline'"
        >
            {{ guideNotice }}
        </v-alert>

        <div class="context-grid">
            <div v-for="card in contextCards" :key="card.label" class="context-card">
                <div class="context-card__label">{{ card.label }}</div>
                <div v-if="card.rows" class="context-card__rows">
                    <div v-for="row in card.rows" :key="row.label" class="context-card__row">
                        <div class="context-card__row-label">{{ row.label }}</div>
                        <div class="context-card__row-chips">
                            <v-chip v-for="chip in row.chips" :key="chip.key" size="x-small" variant="tonal" color="grey-darken-3">
                                {{ chip.text }}
                            </v-chip>
                        </div>
                    </div>
                </div>
                <div v-else class="context-card__value">{{ card.value }}</div>
                <div v-if="card.meta" class="context-card__meta">
                    {{ card.meta }}
                </div>
                <a v-if="card.link" :href="card.link" target="_blank" rel="noreferrer" class="context-card__link">매뉴얼 열기</a>
            </div>
        </div>

        <div v-if="contextSummary.warnings.length > 0" class="warning-card mt-4">
            <div class="warning-card__title">체크 포인트</div>
            <ul class="warning-card__list">
                <li v-for="warning in contextSummary.warnings" :key="warning">{{ warning }}</li>
            </ul>
        </div>

        <div v-if="contextSummary.nextTasks.length > 0" class="section-title mt-5">다음 단계 이동</div>
        <div v-if="contextSummary.nextTasks.length > 0" class="next-task-list">
            <button v-for="task in contextSummary.nextTasks" :key="task.id" class="next-task-item" @click="emit('focusElement', task.id)">
                <div class="next-task-item__name">{{ task.name }}</div>
                <div class="next-task-item__meta">{{ task.lane || task.id }}</div>
            </button>
        </div>

        <div class="answer-section-head mt-5">
            <div class="section-title" style="margin-bottom: 0">AI 답변</div>
            <button v-if="logs.length > 1" type="button" class="bulk-toggle-btn" @click="toggleAllLogs">
                {{ allExpanded ? '모두 접기' : '모두 펼치기' }}
            </button>
        </div>

        <div v-if="!loading && logs.length === 0 && !errorMessage" class="answer-card answer-card--placeholder">
            질문을 입력하거나 추천 질문을 선택하세요.
        </div>

        <div
            v-for="entry in logs"
            :key="entry.id"
            class="answer-card copilot-log-entry"
            :class="{ 'copilot-log-entry--expanded': isExpanded(entry.id) }"
        >
            <div class="copilot-log-entry__head" @click="toggleLog(entry.id)">
                <v-icon size="14" class="copilot-log-entry__chevron">
                    {{ isExpanded(entry.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                </v-icon>
                <div class="copilot-log-entry__meta">
                    <div class="copilot-log-entry__question">Q. {{ entry.question }}</div>
                    <div class="copilot-log-entry__time">{{ formatLogTime(entry.created_at) }}</div>
                </div>
                <button type="button" class="copilot-log-entry__delete-btn" title="삭제" @click.stop="deleteEntry(entry)">
                    <v-icon size="14">mdi-close</v-icon>
                </button>
            </div>
            <div v-show="isExpanded(entry.id)" class="copilot-log-entry__answer">
                <!-- 스트리밍 중: 부분 OpenUI는 렌더 불가하므로 원문 텍스트 + 타이핑 커서로 실시간 표시 -->
                <template v-if="entry.streaming">
                    <div class="answer-card__text answer-card__text--streaming" v-html="formatAnswerText(entry.answer)"></div>
                    <span class="stream-caret" aria-hidden="true"></span>
                </template>
                <template v-else v-for="(segment, index) in splitOpenUiAnswer(entry.answer)" :key="`${entry.id}-${segment.type}-${index}`">
                    <OpenUiRenderer
                        v-if="segment.type === 'openui'"
                        class="answer-card__openui"
                        :response="segment.content"
                        @action="handleOpenUiAction"
                    />
                    <div v-else-if="segment.content" class="answer-card__text" v-html="formatAnswerText(segment.content)"></div>
                </template>
            </div>
        </div>

        <div v-if="loading" class="answer-card answer-card--loading">현재 BPMN 정의와 선택 단계를 분석 중입니다.</div>

        <div v-if="errorMessage" class="answer-card answer-card--error">{{ errorMessage }}</div>

        <!-- 자연어가 Copilot 명령 의도로 보일 때의 슬래시 명령 안내 -->
        <v-alert v-if="commandHint" density="compact" variant="tonal" color="indigo" class="mt-2 slash-hint">
            <div class="d-flex align-center" style="gap: 6px">
                <v-icon size="14">mdi-slash-forward-box</v-icon>
                <span class="text-caption">
                    '{{ commandHint.label }}' 작업은 <strong>{{ commandHint.command }}</strong> 명령으로 실행할 수 있어요.
                </span>
                <v-spacer />
                <v-btn size="x-small" variant="flat" color="indigo" @click="runCommandFromHint">바로 실행</v-btn>
            </div>
        </v-alert>

        <div v-if="savedResults.length" class="saved-result-section mt-5">
            <div class="answer-section-head">
                <div class="section-title" style="margin-bottom: 0">저장된 결과</div>
            </div>
            <div class="saved-result-list">
                <div
                    v-for="result in savedResults"
                    :key="result.id"
                    class="saved-result-item"
                    role="button"
                    tabindex="0"
                    @click="restoreSavedResult(result)"
                    @keydown.enter.prevent="restoreSavedResult(result)"
                    @keydown.space.prevent="restoreSavedResult(result)"
                >
                    <v-icon size="17" color="indigo">{{ iconForSavedResult(result.kind) }}</v-icon>
                    <span class="saved-result-item__body">
                        <span class="saved-result-item__title">{{ result.title }}</span>
                        <span class="saved-result-item__meta">{{ result.summary }}</span>
                        <span class="saved-result-item__time">{{ formatLogTime(result.created_at) }}</span>
                    </span>
                    <span class="saved-result-item__command">{{ result.command }}</span>
                    <button type="button" class="saved-result-item__delete" title="저장 결과 삭제" @click.stop="deleteSavedResult(result)">
                        <v-icon size="15">mdi-trash-can-outline</v-icon>
                    </button>
                </div>
            </div>
        </div>

        <div class="section-title mt-5">{{ anCommandsEnabled ? 'AI Copilot 명령' : '추천 질문' }}</div>
        <div class="suggestion-chips">
            <v-chip
                v-for="suggestedQuestion in suggestedQuestions"
                :key="suggestedQuestion"
                size="small"
                variant="outlined"
                color="primary"
                class="mr-2 mb-2"
                @click="applySuggestedQuestion(suggestedQuestion)"
            >
                {{ suggestedQuestion }}
            </v-chip>
        </div>

        <div class="d-flex align-center mt-2">
            <div class="section-title" style="margin-bottom: 0">질문</div>
            <DetailComponent class="ml-1" :title="answerHint" />
        </div>

        <!-- '/' 입력 시 명령 자동완성 메뉴 (↑↓ 이동 · Tab/Enter 자동완성 · Esc 닫기) -->
        <v-card v-if="slashMenuCommands.length" variant="outlined" class="slash-menu mb-1">
            <v-list density="compact" nav class="py-0">
                <v-list-item
                    v-for="(cmd, index) in slashMenuCommands"
                    :key="cmd.command"
                    class="slash-menu__item"
                    :class="{ 'slash-menu__item--active': index === activeSlashIndex }"
                    @click="applySlashCommand(cmd)"
                    @mouseenter="activeSlashIndex = index"
                >
                    <template #prepend>
                        <v-icon size="16" color="indigo">{{ cmd.icon }}</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">
                        <strong>{{ cmd.command }}</strong>
                        <span class="text-caption text-medium-emphasis ml-2">{{ cmd.label }}</span>
                        <kbd v-if="index === activeSlashIndex" class="slash-menu__kbd">Tab</kbd>
                    </v-list-item-title>
                    <v-list-item-subtitle class="text-caption">{{ cmd.description }}</v-list-item-subtitle>
                </v-list-item>
            </v-list>
        </v-card>

        <v-textarea
            ref="questionInput"
            v-model="question"
            rows="3"
            auto-grow
            density="compact"
            variant="outlined"
            hide-details
            :placeholder="questionPlaceholder"
            class="mb-3"
            @keydown.enter.exact.prevent="handleCopilotEnter"
            @keydown.tab="handleSlashTab"
            @keydown.up="handleSlashNav($event, -1)"
            @keydown.down="handleSlashNav($event, 1)"
            @keydown.esc="dismissSlashMenu"
        />

        <div class="d-flex justify-end">
            <v-btn color="primary" variant="flat" size="small" :loading="loading" :disabled="loading" @click="generateAnswer">
                답변 생성
            </v-btn>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import BackendFactory from '@/components/api/BackendFactory';
import OpenUiRenderer from '@/components/openui/OpenUiRenderer.vue';
import { formatKST } from '@/utils/datetime';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { buildCopilotProcessDefinitionPayload } from '@/utils/bpmnCopilotPayload';
import { fetchTmfKbContext } from '@/utils/tmfKb';
import { formatIdentityWithTeam } from '@/utils/userIdentity';
import {
    AN_SLASH_COMMANDS,
    visibleSlashCommands,
    detectAnIntent,
    filterSlashCommands,
    parseSlashCommand,
    type AnIntentKind,
    type AnSlashCommand
} from '@/composables/anStudio/anIntentRouter';
import { parseFlagsFromBpmn } from '@/composables/blueprint/piFlagParser';
import { extractIssueElementsFromXml, extractTasksFromXml } from '@/composables/anStudio/bpmnTaskExtractor';
import { analyzeGapsToPiFlags } from '@/components/ai/AnGapToPiFlagGenerator';
import { generateToBeFromFlags } from '@/components/ai/AnToBeFromFlagsGenerator';
import { partitionAsIs } from '@/components/ai/AnPartitionGenerator';
import { generateRoadmap } from '@/components/ai/AnRoadmapGenerator';
import type { PartitionBlock } from '@/composables/blueprint/blueprintModel';
import type { ActionEvent } from '@openuidev/vue-lang';

const backend = BackendFactory.createBackend() as any;

type GuideElement = Record<string, any> | null;
type GuideProcessDefinition = Record<string, any> | null;
type AnswerSegment = {
    type: 'text' | 'openui';
    content: string;
};
type CopilotLogEntry = {
    id: string;
    proc_def_id: string;
    question: string;
    answer: string;
    created_at: string;
    created_by: string;
    /** 스트리밍 수신 중인 임시 엔트리(저장 전). 완료 시 저장된 엔트리로 교체된다. */
    streaming?: boolean;
};
type AiCopilotResultKind = 'partition' | 'gap' | 'tobe' | 'roadmap' | 'modularize';
type AiCopilotSavedResult = {
    id: string;
    kind: AiCopilotResultKind;
    command: string;
    title: string;
    summary: string;
    created_at: string;
    data?: Record<string, any>;
};
type AnIntentStructuredData = { kind: string; blocks?: PartitionBlock[]; [key: string]: any };

const props = defineProps<{
    element: GuideElement;
    processDefinition: GuideProcessDefinition;
    bpmnXml?: string;
    isViewMode: boolean;
    embedded?: boolean;
    /** 순서도 To-Be 모드 활성 여부 — true 일 때 To-Be 전용 챗 명령을 라우팅한다. */
    toBeActive?: boolean;
}>();

const emit = defineEmits<{
    (e: 'focusElement', id: string): void;
    (e: 'openToBeDialog', view: 'partition' | 'tobe' | 'executable'): void;
    (e: 'openOrchestratorDialog'): void;
    (e: 'openRoadmapDialog'): void;
    (e: 'focusPiFlagAgent'): void;
    (e: 'renderPartitionBlocks', blocks: PartitionBlock[]): void;
    (e: 'applyPartitionApis', payload: { partitions: PartitionBlock[] }): void;
    (e: 'applyGapFlags', payload: { drafts: any[] }): void;
    (e: 'applyToBeBlueprint', payload: { xml: string }): void;
    (e: 'aiCopilotStateChanged', state: AiCopilotDefinitionState): void;
}>();

/** 마지막 슬래시 명령이 채팅에 인라인으로 돌려줄 구조화 결과(있을 때만). */
const lastResultData = ref<AnIntentStructuredData | null>(null);

const question = ref('');
const logs = ref<CopilotLogEntry[]>([]);
const expandedIds = ref<Set<string>>(new Set());
const loading = ref(false);
const errorMessage = ref('');
let requestSequence = 0;
const copilotSessionId = ref(createCopilotSessionId());
const asIsXmlSnapshot = ref('');
const aiCopilotStateOverride = ref<AiCopilotDefinitionState | null>(null);
const RESULT_HISTORY_LIMIT = 20;

function createCopilotSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `process-hierarchy-copilot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseUengineProps(businessObject: Record<string, any> | null | undefined) {
    const extensionValues = businessObject?.extensionElements?.values || [];
    const propNode = extensionValues.find((item: any) => item?.$type === 'uengine:Properties' || item?.json);
    if (!propNode?.json) return {};
    try {
        return JSON.parse(propNode.json || '{}');
    } catch {
        return {};
    }
}

function resolveLaneName(businessObject: Record<string, any> | null | undefined): string {
    let current = businessObject;
    while (current) {
        if (current.$type === 'bpmn:Lane') {
            return current.name || current.id || '';
        }
        current = current.$parent;
    }
    return '';
}

function resolveOwners(definition: GuideProcessDefinition) {
    const metaOwners = definition?.definition?.meta?.owners || {};
    return {
        primaryOwner: metaOwners.primaryOwner || definition?.owner || '',
        fieldOwners: metaOwners.fieldOwners || definition?.field_owners || [],
        hqOwners: metaOwners.hqOwners || definition?.hq_owners || [],
        masterOwner: metaOwners.masterOwner || definition?.master_owner || definition?.master || ''
    };
}

const contextSummary = computed(() => {
    const businessObject = props.element?.businessObject;
    const taskProps = parseUengineProps(businessObject);
    const processProps = props.processDefinition || {};
    const processMeta = processProps?.definition?.meta || {};
    const processOwners = resolveOwners(processProps);
    const outgoing = businessObject?.outgoing || [];
    const systems = [...new Set([...(taskProps.systems || []), ...(processProps.systems || [])])];
    const firstLink =
        (Array.isArray(taskProps.manualLinks) && taskProps.manualLinks[0]) ||
        (Array.isArray(processProps.manualLinks) && processProps.manualLinks[0]) ||
        (Array.isArray(processProps.manual_links) && processProps.manual_links[0]) ||
        null;
    const manualLink =
        (firstLink && (typeof firstLink === 'string' ? firstLink : firstLink.url || '')) ||
        taskProps.manualLink ||
        processProps.manualLink ||
        processProps.manual_link ||
        '';
    const baseWarnings = [];

    if (taskProps.hitlRequired || processProps.hitlRequired || processProps.hitl_required) {
        baseWarnings.push('AI 결과물 통제(HITL)가 필요한 단계입니다.');
    }
    if ((taskProps.futureStatus || '').toLowerCase() === 'sunset') {
        baseWarnings.push('향후 폐지 예정 단계로 표시되어 있습니다.');
    }
    if (systems.length === 0) {
        baseWarnings.push('연결된 시스템 메타데이터가 없습니다.');
    }

    if (!businessObject) {
        if ((processMeta.process_mode || '').toLowerCase() === 'tobe') {
            baseWarnings.push('현재 선택된 프로세스는 To-Be 문맥으로 분류되어 있습니다.');
        }

        return {
            isProcessLevel: true,
            currentTask: processProps?.name || '프로세스 전체',
            currentLane: '',
            nextTasks: [],
            systems,
            manualLink,
            warnings: baseWarnings,
            owners: processOwners,
            processMode: processMeta.process_mode || 'asis'
        };
    }

    const nextTasks = outgoing
        .map((flow: Record<string, any>) => flow?.targetRef)
        .filter(Boolean)
        .map((target: Record<string, any>) => ({
            id: target.id,
            name: target.name || target.id,
            lane: resolveLaneName(target)
        }));

    return {
        isProcessLevel: false,
        currentTask: businessObject?.name || props.element?.id || '선택된 태스크',
        currentLane: resolveLaneName(businessObject),
        nextTasks,
        systems,
        manualLink,
        warnings: baseWarnings,
        owners: processOwners,
        processMode: processMeta.process_mode || 'asis'
    };
});

const selectedTaskLabel = computed(() => {
    if (!props.element) {
        return `${props.processDefinition?.name || '프로세스'} · 전체 문맥`;
    }
    return `${contextSummary.value.currentTask}${contextSummary.value.currentLane ? ` · ${contextSummary.value.currentLane}` : ''}`;
});

const guideNotice = computed(() => {
    if (contextSummary.value.isProcessLevel) {
        return '태스크를 선택하지 않아도 프로세스 전체 기준으로 담당자, 시스템, 매뉴얼, 운영 주의사항을 요약합니다.';
    }
    return '태스크를 선택하면 현재 단계 기준으로 다음 액션, 관련 시스템, 매뉴얼, 주의사항을 안내합니다.';
});

const questionPlaceholder = computed(() => {
    if (anEnvReady.value) {
        return '"/" 를 입력하면 AI Copilot 명령 목록이 표시됩니다 (예: /partition) — 일반 질문도 가능';
    }
    if (contextSummary.value.isProcessLevel) {
        return '이 프로세스의 목적이 뭐야? 주요 담당자는 누구야?';
    }
    return '이 단계에서 주의할 점이 뭐야? 다음 결재 부서는 어디야?';
});

const answerHint = computed(() => {
    if (contextSummary.value.isProcessLevel) {
        return '현재 BPMN 정의 전체를 기준으로 흐름, 역할, 데이터, 체크포인트를 분석해 답변합니다.';
    }
    return '선택한 BPMN activity와 이전/다음 흐름, 역할, 데이터 문맥을 기준으로 답변합니다.';
});

// owner ID(사번/email) → "이름 (팀)" 매핑. 통합 lookup 으로 채워짐.
const ownerLabels = ref<Record<string, string>>({});

const allOwnerIds = computed(() => {
    const owners = (contextSummary.value.owners || {}) as Record<string, any>;
    const ids: string[] = [];
    if (owners.primaryOwner) ids.push(owners.primaryOwner);
    if (owners.masterOwner) ids.push(owners.masterOwner);
    (owners.fieldOwners || []).forEach((id: string) => ids.push(id));
    (owners.hqOwners || []).forEach((id: string) => ids.push(id));
    return Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
});

// 늦게 출발한 호출이 먼저 응답해 빠른 호출의 결과를 덮어쓰는 race 방어용 sequence guard.
let ownerLookupSeq = 0;
watch(
    allOwnerIds,
    async (ids) => {
        const seq = ++ownerLookupSeq;
        if (!ids.length) {
            ownerLabels.value = {};
            return;
        }
        try {
            const map = await backend.resolveUserIdentities(ids);
            // 응답 받은 사이 더 새로운 호출이 있었으면 결과 무시
            if (seq !== ownerLookupSeq) return;
            const next: Record<string, string> = {};
            for (const id of ids) {
                next[id] = formatIdentityWithTeam(map[id], id);
            }
            ownerLabels.value = next;
        } catch (e) {
            if (seq !== ownerLookupSeq) return;
            console.warn('[ProcessHierarchyAIGuide] owner lookup 실패:', e);
        }
    },
    { immediate: true }
);

const ownerRows = computed(() => {
    const owners = (contextSummary.value.owners || {}) as Record<string, any>;
    const labelFor = (id: string) => ownerLabels.value[id] || id;
    const rows: Array<{ label: string; chips: Array<{ key: string; text: string }> }> = [];
    const pushRow = (label: string, ids: string[]) => {
        const chips = ids
            .filter((id) => typeof id === 'string' && id.trim())
            .map((id, idx) => ({ key: `${label}-${id}-${idx}`, text: labelFor(id) }));
        if (chips.length > 0) rows.push({ label, chips });
    };
    if (owners.primaryOwner) pushRow('PI팀 담당자', [owners.primaryOwner]);
    if (owners.fieldOwners?.length) pushRow('현업담당자', owners.fieldOwners);
    if (owners.hqOwners?.length) pushRow('검토담당자', owners.hqOwners);
    if (owners.masterOwner) pushRow('최종검토자', [owners.masterOwner]);
    return rows;
});

const contextCards = computed<any[]>(() => {
    if (contextSummary.value.isProcessLevel) {
        return [
            {
                label: '프로세스',
                value: contextSummary.value.currentTask,
                meta: contextSummary.value.processMode === 'tobe' ? 'To-Be Process' : 'As-Is Process'
            },
            {
                label: '주요 담당',
                value: ownerRows.value.length === 0 ? '담당자 미등록' : '',
                rows: ownerRows.value.length > 0 ? ownerRows.value : undefined
            },
            {
                label: '관련 시스템',
                value: contextSummary.value.systems.length > 0 ? contextSummary.value.systems.join(', ') : '등록된 시스템 없음',
                meta: contextSummary.value.systems.length > 0 ? `${contextSummary.value.systems.length}개 연결됨` : ''
            },
            {
                label: '매뉴얼',
                value: contextSummary.value.manualLink ? '연결됨' : '등록된 매뉴얼 없음',
                meta: contextSummary.value.manualLink || '',
                link: contextSummary.value.manualLink || ''
            }
        ];
    }

    return [
        {
            label: '현재 단계',
            value: contextSummary.value.currentTask,
            meta: contextSummary.value.currentLane
        },
        {
            label: '다음 단계',
            value: contextSummary.value.nextTasks.length > 0 ? contextSummary.value.nextTasks[0].name : '다음 단계 없음',
            meta:
                contextSummary.value.nextTasks.length > 0
                    ? contextSummary.value.nextTasks.map((task) => task.lane || task.name).join(', ')
                    : ''
        },
        {
            label: '관련 시스템',
            value: contextSummary.value.systems.length > 0 ? contextSummary.value.systems.join(', ') : '등록된 시스템 없음',
            meta: contextSummary.value.systems.length > 0 ? `${contextSummary.value.systems.length}개 연결됨` : ''
        },
        {
            label: '매뉴얼',
            value: contextSummary.value.manualLink ? '연결됨' : '등록된 매뉴얼 없음',
            meta: contextSummary.value.manualLink || '',
            link: contextSummary.value.manualLink || ''
        }
    ];
});

type AiCopilotDefinitionState = {
    partitions?: PartitionBlock[];
    orchestrator?: any;
    roadmap?: any;
    gap_drafts?: any[];
    tobe?: any;
    modularized?: any[];
    modularized_bpmn?: string;
    results?: AiCopilotSavedResult[];
    updated_at?: string;
};

function readAiCopilotState(): AiCopilotDefinitionState {
    const state = props.processDefinition?.definition?.ai_copilot;
    return {
        ...(state && typeof state === 'object' ? state : {}),
        ...(aiCopilotStateOverride.value || {})
    };
}

function currentPartitions(): PartitionBlock[] {
    const partitions = readAiCopilotState().partitions;
    return Array.isArray(partitions) ? partitions : [];
}

function currentOrchestrator() {
    return readAiCopilotState().orchestrator || null;
}

function currentRoadmap() {
    return readAiCopilotState().roadmap || null;
}

async function patchAiCopilotState(patch: Partial<AiCopilotDefinitionState>, label = 'AI Copilot 상태 저장') {
    const procDefId = props.processDefinition?.id || '';
    if (!procDefId || !props.processDefinition) return;

    const currentDef = props.processDefinition.definition || {};
    const nextState = {
        ...readAiCopilotState(),
        ...patch,
        updated_at: new Date().toISOString()
    };
    const nextDef = { ...currentDef, ai_copilot: nextState };
    aiCopilotStateOverride.value = nextState;
    emit('aiCopilotStateChanged', nextState);
    await backend.updateProcessDefinitionMetadata(procDefId, { definition: nextDef }, label);
}

function savedResultCommand(kind: AiCopilotResultKind): string {
    const map: Record<AiCopilotResultKind, string> = {
        partition: '/partition',
        gap: '/gap',
        tobe: '/tobe',
        roadmap: '/roadmap',
        modularize: '/modularize'
    };
    return map[kind] || '';
}

function savedResultTitle(kind: AiCopilotResultKind): string {
    const map: Record<AiCopilotResultKind, string> = {
        partition: 'As-Is 파티셔닝',
        gap: 'Gap 진단',
        tobe: 'To-Be 설계',
        roadmap: '전환 로드맵',
        modularize: 'Call Activity 모듈화'
    };
    return map[kind] || 'AI Copilot 결과';
}

function createSavedResultId(kind: AiCopilotResultKind): string {
    return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDerivedResults(state: AiCopilotDefinitionState, existing: AiCopilotSavedResult[]): AiCopilotSavedResult[] {
    const hasKind = (kind: AiCopilotResultKind) => existing.some((r) => r.kind === kind);
    const createdAt = state.updated_at || new Date().toISOString();
    const derived: AiCopilotSavedResult[] = [];
    if (!hasKind('partition') && Array.isArray(state.partitions) && state.partitions.length) {
        derived.push({
            id: 'derived-partition',
            kind: 'partition',
            command: '/partition',
            title: savedResultTitle('partition'),
            summary: `${state.partitions.length}개 블록`,
            created_at: createdAt,
            data: { partitions: state.partitions }
        });
    }
    if (!hasKind('gap') && Array.isArray(state.gap_drafts) && state.gap_drafts.length) {
        derived.push({
            id: 'derived-gap',
            kind: 'gap',
            command: '/gap',
            title: savedResultTitle('gap'),
            summary: `${state.gap_drafts.length}건 PI Flag 초안`,
            created_at: createdAt,
            data: { drafts: state.gap_drafts }
        });
    }
    const tobeXml = state.tobe?.xml || props.processDefinition?.definition?.tobe_bpmn || '';
    if (!hasKind('tobe') && (state.tobe || state.orchestrator) && tobeXml) {
        derived.push({
            id: 'derived-tobe',
            kind: 'tobe',
            command: '/tobe',
            title: savedResultTitle('tobe'),
            summary: `${state.tobe?.flagCount || state.tobe?.flag_count || '저장된'} PI Flag 반영`,
            created_at: createdAt,
            data: { ...(state.tobe || {}), xml: tobeXml, orchestrator: state.orchestrator }
        });
    }
    if (!hasKind('roadmap') && state.roadmap?.quarters?.length && state.roadmap?.initiatives?.length) {
        derived.push({
            id: 'derived-roadmap',
            kind: 'roadmap',
            command: '/roadmap',
            title: savedResultTitle('roadmap'),
            summary: `${state.roadmap.initiatives.length}개 이니셔티브`,
            created_at: state.roadmap.generated_at || createdAt,
            data: { roadmap: state.roadmap }
        });
    }
    if (!hasKind('modularize') && Array.isArray(state.modularized) && state.modularized.length) {
        derived.push({
            id: 'derived-modularize',
            kind: 'modularize',
            command: '/modularize',
            title: savedResultTitle('modularize'),
            summary: `${state.modularized.length}개 Call Activity`,
            created_at: createdAt,
            data: { modularized: state.modularized, xml: state.modularized_bpmn }
        });
    }
    return derived;
}

function currentResults(): AiCopilotSavedResult[] {
    const state = readAiCopilotState();
    const stored = Array.isArray(state.results) ? state.results.filter((r) => r?.kind && r?.id) : [];
    return [...stored, ...buildDerivedResults(state, stored)];
}

const savedResults = computed(() =>
    currentResults()
        .slice()
        .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
);

function latestResultByKind(kind: AiCopilotResultKind): AiCopilotSavedResult | null {
    return savedResults.value.find((result) => result.kind === kind) || null;
}

function latestStoredResultByKind(results: AiCopilotSavedResult[], kind: AiCopilotResultKind): AiCopilotSavedResult | null {
    return (
        results
            .filter((result) => result.kind === kind)
            .slice()
            .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0] || null
    );
}

async function appendAiCopilotResult(
    result: Omit<AiCopilotSavedResult, 'id' | 'created_at'> & { id?: string; created_at?: string },
    statePatch: Partial<AiCopilotDefinitionState> = {},
    label = 'AI Copilot 결과 저장'
): Promise<AiCopilotSavedResult> {
    const saved: AiCopilotSavedResult = {
        id: result.id || createSavedResultId(result.kind),
        kind: result.kind,
        command: result.command || savedResultCommand(result.kind),
        title: result.title || savedResultTitle(result.kind),
        summary: result.summary || '',
        created_at: result.created_at || new Date().toISOString(),
        data: result.data || {}
    };
    const stored = Array.isArray(readAiCopilotState().results) ? readAiCopilotState().results || [] : [];
    const nextResults = [...stored.filter((item) => item.id !== saved.id), saved].slice(-RESULT_HISTORY_LIMIT);
    await patchAiCopilotState({ ...statePatch, results: nextResults }, label);
    return saved;
}

function iconForSavedResult(kind: AiCopilotResultKind): string {
    const map: Record<AiCopilotResultKind, string> = {
        partition: 'mdi-vector-rectangle',
        gap: 'mdi-magnify-scan',
        tobe: 'mdi-sitemap-outline',
        roadmap: 'mdi-layers-triple-outline',
        modularize: 'mdi-puzzle-outline'
    };
    return map[kind] || 'mdi-history';
}

const anCommandsEnabled = computed(() => !!props.toBeActive && !props.isViewMode);

// As-Is 편집 모드에서도 실행 가능한 명령(파티셔닝 계열). 그 외 명령은 To-Be 모드 전용.
const AS_IS_ALLOWED_KINDS = new Set<AnIntentKind>([
    'partition',
    'show-partition',
    'gap',
    'show-gap',
    'orchestrator',
    'executable',
    'show-executable'
]);
// 명령 사용 가능한 기본 환경(편집 가능). 모드별 노출은 명령 단위로 제한.
const anEnvReady = computed(() => !props.isViewMode);

/** 현재 모드(As-Is/To-Be)에서 실행 가능한 명령인지 */
function isCommandAllowedNow(cmd: AnSlashCommand): boolean {
    if (props.toBeActive) return true;
    return AS_IS_ALLOWED_KINDS.has(cmd.kind) || (!!cmd.showKind && AS_IS_ALLOWED_KINDS.has(cmd.showKind));
}

/** 자연어가 Copilot 명령 의도로 보일 때 노출하는 슬래시 명령 안내 (자동 실행하지 않음) */
const commandHint = ref<{ command: string; label: string } | null>(null);

// 슬래시 명령 자동완성 메뉴 상태 (채팅 입력 UX 와 동일)
const questionInput = ref<any>(null);
const activeSlashIndex = ref(0);
const slashMenuDismissed = ref(false);

// 입력을 새로 고치기 시작하면 이전 안내는 정리
watch(question, () => {
    if (commandHint.value) commandHint.value = null;
    slashMenuDismissed.value = false;
    if (activeSlashIndex.value >= slashMenuCommands.value.length) {
        activeSlashIndex.value = 0;
    }
});

/** '/' 로 시작하는 입력에 대한 명령 자동완성 후보 */
const slashMenuCommands = computed<AnSlashCommand[]>(() => {
    if (slashMenuDismissed.value) return [];
    if (!anEnvReady.value || loading.value) return [];
    // As-Is 편집 모드에서는 파티셔닝 계열만, To-Be 모드에서는 전체 명령 노출
    return filterSlashCommands(question.value).filter(isCommandAllowedNow);
});

/** 현재 입력의 슬래시 토큰 파싱 (prefix 공백 · 토큰 · 나머지) */
function currentSlashToken(): { prefix: string; token: string; suffix: string } | null {
    const match = (question.value || '').match(/^(\s*)(\/[^\s]*)/);
    if (!match) return null;
    return {
        prefix: match[1],
        token: match[2],
        suffix: question.value.slice(match[1].length + match[2].length)
    };
}

/** 활성(또는 지정) 명령으로 입력을 자동완성 */
function completeSlashCommand(cmd?: AnSlashCommand): boolean {
    const menu = slashMenuCommands.value;
    const target = cmd || menu[activeSlashIndex.value] || menu[0];
    if (!target) return false;
    const parsed = currentSlashToken();
    const prefix = parsed?.prefix || '';
    const suffix = parsed?.suffix || '';
    const needsSpace = !suffix.startsWith(' ');
    question.value = `${prefix}${target.command}${needsSpace ? ' ' : ''}${suffix}`;
    focusQuestionInput();
    return true;
}

function focusQuestionInput() {
    void nextTick(() => {
        try {
            questionInput.value?.focus?.();
        } catch {
            /* noop */
        }
    });
}

function handleSlashNav(event: KeyboardEvent, delta: number) {
    const total = slashMenuCommands.value.length;
    if (total < 2) return;
    event.preventDefault();
    activeSlashIndex.value = (activeSlashIndex.value + delta + total) % total;
}

function handleSlashTab(event: KeyboardEvent) {
    if (!slashMenuCommands.value.length) return;
    if (!completeSlashCommand()) return;
    event.preventDefault();
    event.stopPropagation();
}

function dismissSlashMenu() {
    if (slashMenuCommands.value.length) slashMenuDismissed.value = true;
}

/** 메뉴가 열려 있고 명령이 미완성이면 Enter 로 자동완성, 완성 상태면 답변 생성 */
function handleCopilotEnter() {
    const menu = slashMenuCommands.value;
    if (menu.length) {
        const active = menu[activeSlashIndex.value] || menu[0];
        const parsed = currentSlashToken();
        if (active && parsed && parsed.token.toLowerCase() !== active.command.toLowerCase()) {
            completeSlashCommand(active);
            return;
        }
    }
    void generateAnswer();
}

const suggestedQuestions = computed(() => {
    if (anCommandsEnabled.value) {
        return visibleSlashCommands().map((c) => c.command);
    }
    return contextSummary.value.isProcessLevel
        ? ['이 프로세스의 목적이 뭐야?', '주요 담당자는 누구야?', '어떤 시스템을 써?', '운영 시 주의할 점은?']
        : ['이 단계에서 주의할 점이 뭐야?', '다음 결재 부서는 어디야?', '관련 매뉴얼 찾아줘', '어떤 시스템을 봐야 해?'];
});

const selectedElementPayload = computed(() => {
    const businessObject = props.element?.businessObject;
    if (!businessObject) return null;

    const taskProps = parseUengineProps(businessObject);
    return {
        id: businessObject.id || props.element?.id || '',
        name: businessObject.name || props.element?.id || '',
        type: businessObject.$type || '',
        lane: resolveLaneName(businessObject),
        systems: Array.isArray(taskProps.systems) ? taskProps.systems : [],
        checkpoints: Array.isArray(taskProps.checkpoints) ? taskProps.checkpoints : [],
        manualLink: taskProps.manualLink || '',
        instruction: typeof taskProps.instruction === 'string' ? taskProps.instruction : ''
    };
});

function cloneDefinitionPayload() {
    const bpmnStore = useBpmnStore();
    return buildCopilotProcessDefinitionPayload({
        storedDefinition: props.processDefinition?.definition,
        processDefinitionId: props.processDefinition?.id || '',
        processName: props.processDefinition?.name || '',
        bpmnXml: props.bpmnXml || props.processDefinition?.bpmn || '',
        modeler: bpmnStore.getModeler
    });
}

async function resolveCurrentBpmnXml() {
    const bpmnStore = useBpmnStore();
    const modeler = bpmnStore.getModeler;
    if (modeler && typeof modeler.saveXML === 'function') {
        try {
            const result = await modeler.saveXML({ format: true, preamble: true });
            if (typeof result === 'string') return result;
            if (result?.xml) return result.xml;
        } catch (error) {
            console.warn('[ProcessHierarchyAIGuide] Failed to export current BPMN XML:', error);
        }
    }

    return props.bpmnXml || props.processDefinition?.bpmn || '';
}

function rememberAsIsXml(xml: string) {
    if (typeof xml === 'string' && xml.trim()) {
        asIsXmlSnapshot.value = xml;
    }
}

async function resolveAsIsBpmnXml() {
    if (!props.toBeActive) {
        const liveXml = await resolveCurrentBpmnXml();
        rememberAsIsXml(liveXml);
        return liveXml;
    }
    return asIsXmlSnapshot.value || props.processDefinition?.bpmn || props.bpmnXml || '';
}

function stringifyJson(value: any) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '{}';
    }
}

function buildQdrantCopilotMessage(nextQuestion: string, processDefinitionPayload: any, hasBpmnXml: boolean, tmfContext = '') {
    const context: Record<string, any> = {
        process: {
            id: props.processDefinition?.id || processDefinitionPayload?.processDefinitionId || '',
            name: props.processDefinition?.name || processDefinitionPayload?.processDefinitionName || '',
            mode: contextSummary.value.processMode,
            owners: contextSummary.value.owners,
            systems: contextSummary.value.systems,
            manualLink: contextSummary.value.manualLink
        },
        focus: contextSummary.value.isProcessLevel ? 'process' : 'activity',
        selectedElement: selectedElementPayload.value,
        nextTasks: contextSummary.value.nextTasks,
        warnings: contextSummary.value.warnings,
        locale: ((window as any).countryCode || 'ko').toLowerCase()
    };

    if (!hasBpmnXml && processDefinitionPayload) {
        context.processDefinition = processDefinitionPayload;
    }

    const tmfContextLines = tmfContext
        ? [
              '',
              '아래 [TMF MCP 검색 결과]는 사내 TM Forum 공식 지식베이스(MCP)에서 검색한 결과입니다.',
              'eTOM 프로세스·TMF Open API 등 TM Forum 표준 관련 판단은 이 검색 결과를 최우선 근거로 사용해 주세요.',
              '',
              '[TMF MCP 검색 결과]',
              tmfContext
          ]
        : [];

    return [
        '프로세스 순서도 Copilot 요청입니다.',
        'eTOM 25 RAG 지식과 BPMN XML을 함께 참고해 한국어로 답변해 주세요.',
        '선택 단계가 있으면 해당 단계 중심으로, 없으면 프로세스 전체 기준으로 답변해 주세요.',
        '',
        `질문: ${nextQuestion}`,
        ...tmfContextLines,
        '',
        '화면 컨텍스트(JSON):',
        stringifyJson(context)
    ].join('\n');
}

function looksLikeOpenUiLang(input: string) {
    const trimmed = input.trim();
    return /^root\s*=/.test(trimmed) && /^[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(trimmed);
}

function splitOpenUiAnswer(input: string): AnswerSegment[] {
    const source = input || '';
    const openUiFencePattern = /```openui\s*([\s\S]*?)```/gi;
    const segments: AnswerSegment[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = openUiFencePattern.exec(source)) !== null) {
        const textBefore = source.slice(cursor, match.index).trim();
        const openUiCode = (match[1] || '').trim();
        if (textBefore) {
            segments.push({ type: 'text', content: textBefore });
        }
        if (openUiCode) {
            segments.push({ type: 'openui', content: openUiCode });
        }
        cursor = match.index + match[0].length;
    }

    const tail = source.slice(cursor).trim();
    if (tail) {
        segments.push({ type: 'text', content: tail });
    }

    if (segments.length === 0 && looksLikeOpenUiLang(source)) {
        return [{ type: 'openui', content: source.trim() }];
    }

    return segments;
}

function formatAnswerText(input: string) {
    const html = marked(input || '', { breaks: true, gfm: true }) as string;
    return DOMPurify.sanitize(html);
}

function formatLogTime(iso: string): string {
    if (!iso) return '';
    return formatKST(iso, 'YYYY-MM-DD HH:mm');
}

function summarizePartitionBlocks(blocks: PartitionBlock[] = []): string {
    return blocks
        .slice(0, 8)
        .map((block, index) => {
            const candidates = (block.etom_candidates || []).filter((c) => c && (c.etom_l3 || c.etom_process_id));
            const fallback = block.etom_l3 || block.etom_process_id ? [{ etom_l3: block.etom_l3 || '', etom_process_id: block.etom_process_id || '' }] : [];
            const list = candidates.length ? candidates : fallback;
            const etomText = list.length
                ? ` — eTOM 후보: ${list.map((c) => [c.etom_process_id, c.etom_l3].filter(Boolean).join(' ')).join(' / ')}`
                : '';
            return `${index + 1}. ${block.name || block.id} (${(block.element_ids || []).length}개 요소)${etomText}`;
        })
        .join('\n');
}

function summarizeGapDrafts(drafts: any[] = []): string {
    return drafts
        .slice(0, 8)
        .map((draft, index) => {
            const names: string[] =
                Array.isArray(draft.elementNames) && draft.elementNames.length
                    ? draft.elementNames
                    : draft.elementName
                    ? [draft.elementName]
                    : [];
            const target =
                names.length > 1
                    ? ` [요소 ${names.length}개: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' 외' : ''}]`
                    : names.length === 1
                    ? ` [${names[0]}]`
                    : '';
            return `${index + 1}. ${draft.title || draft.elementName || draft.elementId || 'PI Flag'}${target}${
                draft.problem ? ` - ${draft.problem}` : ''
            }`;
        })
        .join('\n');
}

function summarizeRoadmap(roadmap: any): string {
    const initiatives = Array.isArray(roadmap?.initiatives) ? roadmap.initiatives : [];
    return initiatives
        .slice(0, 8)
        .map((item: any, index: number) => `${index + 1}. ${item.name || 'Initiative'} (${item.label || 'Implement'})`)
        .join('\n');
}

function buildSavedResultAnswer(result: AiCopilotSavedResult, restored = false): string {
    const prefix = restored ? '저장된 결과를 다시 열었습니다.' : result.summary;
    if (result.kind === 'partition') {
        const blocks = (result.data?.partitions || currentPartitions()) as PartitionBlock[];
        return [`${prefix}`, '', `블록 ${blocks.length}개`, summarizePartitionBlocks(blocks)].filter(Boolean).join('\n');
    }
    if (result.kind === 'gap') {
        const drafts = Array.isArray(result.data?.drafts) ? result.data?.drafts : readAiCopilotState().gap_drafts || [];
        return [`${prefix}`, '', `PI Flag 초안 ${drafts.length}건`, summarizeGapDrafts(drafts)].filter(Boolean).join('\n');
    }
    if (result.kind === 'tobe') {
        const flagCount = result.data?.flagCount || result.data?.flag_count || result.data?.reflected_count || '';
        return [
            `${prefix}`,
            '',
            flagCount ? `반영 PI Flag: ${flagCount}건` : '',
            result.data?.xml ? '저장된 To-Be BPMN XML을 캔버스에 다시 적용할 수 있습니다.' : '저장된 To-Be 설계 메타데이터를 확인했습니다.'
        ]
            .filter(Boolean)
            .join('\n');
    }
    if (result.kind === 'roadmap') {
        const roadmap = result.data?.roadmap || currentRoadmap();
        return [`${prefix}`, '', `분기: ${(roadmap?.quarters || []).join(', ')}`, summarizeRoadmap(roadmap)].filter(Boolean).join('\n');
    }
    if (result.kind === 'modularize') {
        const items = Array.isArray(result.data?.modularized) ? result.data?.modularized : readAiCopilotState().modularized || [];
        return [
            `${prefix}`,
            '',
            `Call Activity ${items.length}개`,
            items
                .slice(0, 8)
                .map((item: any, index: number) => `${index + 1}. ${item.name || item.def_id || 'Child Process'}`)
                .join('\n')
        ]
            .filter(Boolean)
            .join('\n');
    }
    return prefix || '저장된 결과를 확인했습니다.';
}

function appendLocalLog(questionText: string, answer: string) {
    const entry: CopilotLogEntry = {
        id: `restored-${createCopilotSessionId()}`,
        proc_def_id: props.processDefinition?.id || '',
        question: questionText,
        answer,
        created_at: new Date().toISOString(),
        created_by: ''
    };
    logs.value = [...logs.value, entry];
    expandedIds.value = new Set([...expandedIds.value, entry.id]);
}

async function restoreSavedResult(result: AiCopilotSavedResult) {
    errorMessage.value = '';
    lastResultData.value = null;
    const answer = buildSavedResultAnswer(result, true);

    if (result.kind === 'partition') {
        const blocks = (result.data?.partitions || currentPartitions()) as PartitionBlock[];
        emit('renderPartitionBlocks', blocks);
        lastResultData.value = { kind: 'partition', blocks };
    } else if (result.kind === 'gap') {
        emit('focusPiFlagAgent');
    } else if (result.kind === 'tobe') {
        const xml = result.data?.xml || readAiCopilotState().tobe?.xml || props.processDefinition?.definition?.tobe_bpmn || '';
        if (xml) emit('applyToBeBlueprint', { xml });
    } else if (result.kind === 'roadmap') {
        const roadmap = result.data?.roadmap;
        if (roadmap) await patchAiCopilotState({ roadmap }, 'AI Copilot 로드맵 열람');
        emit('openRoadmapDialog');
    } else if (result.kind === 'modularize') {
        const xml = result.data?.xml || readAiCopilotState().modularized_bpmn || '';
        if (xml) emit('applyToBeBlueprint', { xml });
    }

    appendLocalLog(`${result.command} 결과 보기`, answer);
}

async function deleteSavedResult(result: AiCopilotSavedResult) {
    if (props.isViewMode) {
        errorMessage.value = '읽기 전용 상태에서는 저장된 결과를 삭제할 수 없습니다.';
        return;
    }
    if (!window.confirm(`'${result.title}' 저장 결과를 삭제할까요?`)) return;

    try {
        const state = readAiCopilotState();
        const stored = Array.isArray(state.results) ? state.results : [];
        const nextResults = stored.filter((item) => item.id !== result.id);
        const patch: Partial<AiCopilotDefinitionState> = { results: nextResults };

        if (result.kind === 'partition') {
            const fallback = latestStoredResultByKind(nextResults, 'partition');
            const fallbackBlocks = Array.isArray(fallback?.data?.partitions) ? (fallback?.data?.partitions as PartitionBlock[]) : [];
            patch.partitions = fallbackBlocks;
            emit('renderPartitionBlocks', fallbackBlocks);
            lastResultData.value = fallbackBlocks.length ? { kind: 'partition', blocks: fallbackBlocks } : null;
        } else if (result.kind === 'gap') {
            const fallback = latestStoredResultByKind(nextResults, 'gap');
            patch.gap_drafts = Array.isArray(fallback?.data?.drafts) ? fallback?.data?.drafts : [];
        } else if (result.kind === 'tobe') {
            const fallback = latestStoredResultByKind(nextResults, 'tobe');
            patch.tobe = fallback?.data
                ? { xml: fallback.data.xml || '', flagCount: fallback.data.flagCount || fallback.data.flag_count || 0 }
                : null;
            patch.orchestrator = fallback?.data?.orchestrator || null;
        } else if (result.kind === 'roadmap') {
            const fallback = latestStoredResultByKind(nextResults, 'roadmap');
            patch.roadmap = fallback?.data?.roadmap || null;
        } else if (result.kind === 'modularize') {
            const fallback = latestStoredResultByKind(nextResults, 'modularize');
            patch.modularized = Array.isArray(fallback?.data?.modularized) ? fallback?.data?.modularized : [];
            patch.modularized_bpmn = fallback?.data?.xml || '';
        }

        await patchAiCopilotState(patch, 'AI Copilot 저장 결과 삭제');
        appendLocalLog(`${result.command} 결과 삭제`, `${result.title} 저장 결과를 삭제했습니다.`);
    } catch (e: any) {
        errorMessage.value = e?.detail || e?.message || '저장 결과 삭제에 실패했습니다.';
    }
}

function handleOpenUiAction(event: ActionEvent) {
    const params = (event?.params || {}) as Record<string, any>;
    const nextQuestion = String(params.question || params.prompt || params.text || event?.humanFriendlyMessage || '').trim();
    if (!nextQuestion) return;
    question.value = nextQuestion;
    void generateAnswer();
}

async function loadLogs() {
    const procDefId = props.processDefinition?.id || '';
    if (!procDefId) {
        logs.value = [];
        expandedIds.value = new Set();
        return;
    }
    try {
        const fetched = await backend.listCopilotLogs(procDefId);
        logs.value = Array.isArray(fetched) ? fetched : [];
    } catch (e) {
        console.error('[ProcessHierarchyAIGuide] loadLogs error:', e);
        logs.value = [];
    }
    expandedIds.value = new Set();
}

function isExpanded(id: string): boolean {
    return expandedIds.value.has(id);
}

function toggleLog(id: string) {
    const next = new Set(expandedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds.value = next;
}

const allExpanded = computed(() => logs.value.length > 0 && expandedIds.value.size === logs.value.length);

function toggleAllLogs() {
    if (allExpanded.value) {
        expandedIds.value = new Set();
    } else {
        expandedIds.value = new Set(logs.value.map((l) => l.id));
    }
}

/** As-Is XML 에 기록된 PI Flag(현업 코멘트)를 Gap 진단 컨텍스트로 수집. */
function collectPiFlagsForGap(xml = asIsXmlSnapshot.value || props.processDefinition?.bpmn || props.bpmnXml || '') {
    return parseFlagsFromBpmn(xml).map((f) => ({
        elementId: f.elementId,
        elementName: f.elementName,
        type: f.type,
        status: f.status,
        description: f.description
    }));
}

/** "반영" 태그된 PI Flag 만 수집 (To-Be 생성 근거). */
function collectReflectedPiFlags(xml = asIsXmlSnapshot.value || props.processDefinition?.bpmn || props.bpmnXml || '') {
    return parseFlagsFromBpmn(xml)
        .filter((f) => f.reflected)
        .map((f) => ({
            elementId: f.elementId,
            elementName: f.elementName,
            category: f.category || f.type,
            title: f.title,
            problem: f.problem,
            improvement: f.improvement
        }));
}

type ReflectedPiFlag = ReturnType<typeof collectReflectedPiFlags>[number];
type CopilotOrchestratorStep = { name: string; automated: boolean; tmf: string };
type CopilotOrchestratorBlock = {
    partition_id: string | null;
    name: string;
    tmf: string;
    to_be_steps: CopilotOrchestratorStep[];
};

function looksAutomated(flag: ReflectedPiFlag): boolean {
    const text = [flag.title, flag.category, flag.problem, flag.improvement].filter(Boolean).join(' ');
    return /자동|무인|시스템|연계|api|rpa|ai|bot|service/i.test(text);
}

function toBeStepFromFlag(flag: ReflectedPiFlag): CopilotOrchestratorStep {
    return {
        name: String(flag.improvement || flag.title || flag.problem || flag.elementName || 'To-Be 개선').slice(0, 200),
        automated: looksAutomated(flag),
        tmf: /^TMF/i.test(String(flag.category || '')) ? String(flag.category) : ''
    };
}

function buildCopilotOrchestrator(reflectedFlags: ReflectedPiFlag[], partitions: PartitionBlock[] = []) {
    const processName = props.processDefinition?.name || 'To-Be';
    const fallbackStep: CopilotOrchestratorStep = { name: 'To-Be 개선 반영', automated: true, tmf: '' };
    let blocks: CopilotOrchestratorBlock[] = [];

    if (partitions.length) {
        blocks = partitions.map((p) => {
            const elementIds = new Set(p.element_ids || []);
            const taskNames = new Set((p.tasks || []).map((t) => String(t?.name || '')));
            const flags = reflectedFlags.filter(
                (f) => elementIds.has(f.elementId) || taskNames.has(f.elementName) || f.elementName === p.name
            );
            const steps = flags.length
                ? flags.map(toBeStepFromFlag)
                : (p.tasks || []).slice(0, 5).map((t) => ({
                      name: String(t?.name || p.name),
                      automated: false,
                      tmf: p.etom_process_id || p.etom_l3 || ''
                  }));
            return {
                partition_id: p.id,
                name: p.name,
                tmf: p.etom_process_id || p.etom_l3 || 'TMF XXX',
                to_be_steps: steps.length ? steps : [fallbackStep]
            };
        });
    } else {
        const byTarget = new Map<string, ReflectedPiFlag[]>();
        reflectedFlags.forEach((flag) => {
            const key = flag.elementId || flag.elementName || flag.title || flag.category || 'To-Be 전환';
            byTarget.set(key, [...(byTarget.get(key) || []), flag]);
        });
        blocks = Array.from(byTarget.values()).map((flags) => {
            const first = flags[0];
            return {
                partition_id: null,
                name: String(first?.elementName || first?.title || first?.category || 'To-Be 전환').slice(0, 120),
                tmf: /^TMF/i.test(String(first?.category || '')) ? String(first?.category) : 'TMF XXX',
                to_be_steps: flags.map(toBeStepFromFlag)
            };
        });
    }

    if (!blocks.length) {
        blocks = [{ partition_id: null, name: 'To-Be 전환', tmf: 'TMF XXX', to_be_steps: [fallbackStep] }];
    }

    return {
        master_name: `${processName} To-Be Master Orchestrator`,
        gateway: { name: 'To-Be Orchestrator', subtitle: 'PI Flag 기반 전환 로드맵 제어' },
        blocks,
        generated_at: new Date().toISOString()
    };
}

async function ensureRoadmapOrchestrator(): Promise<boolean> {
    if (currentOrchestrator()) return true;
    const asIsXml = await resolveAsIsBpmnXml();
    const reflected = collectReflectedPiFlags(asIsXml);
    const hasToBeXml = !!props.processDefinition?.definition?.tobe_bpmn;
    if (!reflected.length && !hasToBeXml) return false;
    await patchAiCopilotState({ orchestrator: buildCopilotOrchestrator(reflected, currentPartitions()) });
    return true;
}

interface AnIntentResult {
    message: string;
    data?: AnIntentStructuredData;
}

/** 파티셔닝 블록을 에디터 캔버스에 그리도록 신호하고, 채팅 인라인 표시용 데이터를 만든다. */
function emitPartitionBlocks(blocks = currentPartitions()): AnIntentResult['data'] {
    emit('renderPartitionBlocks', blocks);
    return { kind: 'partition', blocks };
}

/** AI Copilot 명령 1건을 실행하고 사용자에게 보여줄 요약 텍스트(+구조화 데이터)를 반환. */
async function executeAnIntent(kind: AnIntentKind): Promise<AnIntentResult> {
    const asIsXml = await resolveAsIsBpmnXml();
    switch (kind) {
        case 'partition': {
            if (!asIsXml) return { message: 'As-Is 도면이 없어 파티셔닝을 수행할 수 없습니다.' };
            const partitions = await partitionAsIs(backend, {
                asIsXml,
                processName: props.processDefinition?.name || '',
                activities: extractTasksFromXml(asIsXml),
                sessionId: copilotSessionId.value
            });
            const n = partitions.length;
            const summary = `${n}개 eTOM 블록`;
            await appendAiCopilotResult(
                {
                    kind: 'partition',
                    command: '/partition',
                    title: savedResultTitle('partition'),
                    summary,
                    data: { partitions }
                },
                { partitions },
                'AI Copilot 파티셔닝 저장'
            );
            // 태스크별 추정 TMF Open API 코드를 각 태스크의 API 연동 속성(uengine json)으로 채운다.
            emit('applyPartitionApis', { partitions });
            return {
                message: [
                    `As-Is 파티셔닝 완료 — ${n}개의 eTOM 블록을 생성했습니다.`,
                    '결과를 저장했습니다. 이후 "저장된 결과" 또는 /partition view 로 다시 열 수 있습니다.',
                    '각 태스크의 추정 TMF Open API 코드는 태스크 속성의 "API 연동" 목록으로 채워집니다 (여러 개 가능).',
                    '아래 블록 목록에서 항목을 클릭하면 에디터에서 해당 영역으로 이동합니다.'
                ].join('\n'),
                data: emitPartitionBlocks(partitions)
            };
        }
        case 'show-partition': {
            const stored = latestResultByKind('partition');
            const blocks = ((stored?.data?.partitions as PartitionBlock[]) || currentPartitions()).filter(Boolean);
            if (!blocks.length) {
                return { message: '아직 파티셔닝 결과가 없습니다. /partition 으로 시작하세요.' };
            }
            return {
                message: buildSavedResultAnswer(
                    stored ||
                        latestResultByKind('partition') || {
                            id: 'current-partition',
                            kind: 'partition',
                            command: '/partition',
                            title: savedResultTitle('partition'),
                            summary: `${blocks.length}개 블록`,
                            created_at: new Date().toISOString(),
                            data: { partitions: blocks }
                        }
                ),
                data: emitPartitionBlocks(blocks)
            };
        }
        case 'gap': {
            const elements = extractIssueElementsFromXml(asIsXml);
            if (!elements.length) {
                return { message: '진단할 요소가 없습니다. As-Is 도면을 확인하세요.' };
            }
            const drafts = await analyzeGapsToPiFlags(backend, {
                asIsXml,
                processName: props.processDefinition?.name || '',
                elements,
                existingFlags: collectPiFlagsForGap(asIsXml),
                sessionId: copilotSessionId.value
            });
            // 속성 패널을 통해 BPMN 요소에 PI Flag 로 기록하도록 요청
            emit('applyGapFlags', { drafts });
            emit('focusPiFlagAgent');
            const onEl = drafts.filter((d) => (Array.isArray(d.elementIds) && d.elementIds.length) || d.elementId).length;
            const onProc = drafts.length - onEl;
            await appendAiCopilotResult(
                {
                    kind: 'gap',
                    command: '/gap',
                    title: savedResultTitle('gap'),
                    summary: `${drafts.length}건 PI Flag 초안`,
                    data: { drafts }
                },
                { gap_drafts: drafts },
                'AI Copilot Gap 진단 저장'
            );
            return {
                message: [
                    `Gap 진단 완료 — ${drafts.length}건의 PI Flag 을 생성했습니다 (요소 ${onEl}건${
                        onProc ? `, 프로세스 전반 ${onProc}건` : ''
                    }).`,
                    '결과를 저장했습니다. 이후 "저장된 결과" 또는 /gap view 로 다시 열 수 있습니다.',
                    '속성 패널 > PI Flag 탭에서 제목/문제점/개선방향을 확인·수정하세요.'
                ].join('\n')
            };
        }
        case 'show-gap': {
            emit('focusPiFlagAgent');
            const stored = latestResultByKind('gap');
            return {
                message: stored
                    ? buildSavedResultAnswer(stored)
                    : '저장된 Gap 진단 결과가 없습니다. 속성 패널의 PI Flag 탭으로 이동했습니다.'
            };
        }
        case 'orchestrator': {
            const reflected = collectReflectedPiFlags(asIsXml);
            if (!reflected.length) {
                return {
                    message: '반영된 PI Flag 이 없습니다. PI Flag 카드에서 To-Be 에 반영할 항목을 "반영"으로 표시한 뒤 다시 실행하세요.'
                };
            }
            const result = await generateToBeFromFlags(backend, {
                asIsXml,
                processName: props.processDefinition?.name || '',
                reflectedFlags: reflected,
                sessionId: copilotSessionId.value
            });
            const orchestrator = buildCopilotOrchestrator(reflected, currentPartitions());
            await appendAiCopilotResult(
                {
                    kind: 'tobe',
                    command: '/tobe',
                    title: savedResultTitle('tobe'),
                    summary: `${result.flagCount}건 PI Flag 반영`,
                    data: {
                        xml: result.xml,
                        flagCount: result.flagCount,
                        repaired: result.repaired,
                        repairWarnings: result.repairWarnings,
                        orchestrator
                    }
                },
                { orchestrator, tobe: { xml: result.xml, flagCount: result.flagCount, generated_at: new Date().toISOString() } },
                'AI Copilot To-Be 설계 저장'
            );
            emit('applyToBeBlueprint', { xml: result.xml });
            return {
                message: [
                    `To-Be 설계 완료 — 반영 PI Flag ${result.flagCount}건을 적용한 To-Be 도면을 생성했습니다.`,
                    '결과를 저장했습니다. 이후 "저장된 결과" 또는 /tobe view 로 다시 적용할 수 있습니다.',
                    'To-Be 캔버스에 도면을 반영했습니다. 필요 시 캔버스에서 직접 수정하세요.'
                ].join('\n')
            };
        }
        case 'show-orchestrator': {
            const stored = latestResultByKind('tobe');
            const xml = stored?.data?.xml || readAiCopilotState().tobe?.xml || props.processDefinition?.definition?.tobe_bpmn || '';
            if (xml) emit('applyToBeBlueprint', { xml });
            return {
                message: stored
                    ? buildSavedResultAnswer(stored, true)
                    : xml
                    ? '저장된 To-Be 도면을 캔버스에 다시 적용했습니다.'
                    : '저장된 To-Be 설계 결과가 없습니다. /tobe 로 먼저 생성하세요.'
            };
        }
        case 'roadmap': {
            if (!(await ensureRoadmapOrchestrator())) {
                return { message: 'To-Be 설계(Orchestrator)가 먼저 필요합니다. /tobe 를 먼저 실행하세요.' };
            }
            const roadmap = await generateRoadmap(backend, {
                processName: props.processDefinition?.name || '',
                baseYear: new Date().getFullYear(),
                partitions: currentPartitions(),
                blockSolutions: [],
                orchestrator: currentOrchestrator(),
                sessionId: copilotSessionId.value
            });
            await appendAiCopilotResult(
                {
                    kind: 'roadmap',
                    command: '/roadmap',
                    title: savedResultTitle('roadmap'),
                    summary: `${roadmap.initiatives?.length || 0}개 이니셔티브`,
                    data: { roadmap }
                },
                { roadmap },
                'AI Copilot 로드맵 저장'
            );
            emit('openRoadmapDialog');
            return {
                message:
                    '전환 로드맵 생성 완료 — 결과를 저장했고 로드맵 다이얼로그를 열었습니다. 이후 "저장된 결과" 또는 /roadmap view 로 다시 열 수 있습니다.'
            };
        }
        case 'show-roadmap': {
            const stored = latestResultByKind('roadmap');
            const roadmap = currentRoadmap() || stored?.data?.roadmap || null;
            if (roadmap && !currentRoadmap()) {
                await patchAiCopilotState({ roadmap }, 'AI Copilot 로드맵 열람');
            }
            emit('openRoadmapDialog');
            return {
                message: roadmap
                    ? buildSavedResultAnswer(
                          stored || {
                              id: 'current-roadmap',
                              kind: 'roadmap',
                              command: '/roadmap',
                              title: savedResultTitle('roadmap'),
                              summary: `${roadmap.initiatives?.length || 0}개 이니셔티브`,
                              created_at: roadmap.generated_at || new Date().toISOString(),
                              data: { roadmap }
                          },
                          true
                      )
                    : '아직 로드맵이 없습니다. /roadmap 으로 실행하세요.'
            };
        }
        case 'modularize': {
            return {
                message:
                    'Call Activity 모듈화는 현재 그룹 편집 확정 동작에서 처리합니다. 먼저 /partition 후 캔버스의 그룹 편집 기능을 사용하세요.'
            };
        }
        case 'executable':
        case 'show-executable': {
            emit('openToBeDialog', 'executable');
            const applied = !!props.processDefinition?.definition?.tobe?.executable?.applied_at;
            const hasExec = !!props.processDefinition?.definition?.tobe?.executable?.definition;
            return {
                message: [
                    '캔버스를 Exec(실행형) 뷰로 전환했습니다.',
                    hasExec
                        ? applied
                            ? '변환된 실행 정의가 이미 등록되어 있습니다. 재변환하거나 상세를 확인하세요.'
                            : '변환 결과가 있습니다. 검증을 확인한 뒤 관리자가 "실행 정의로 등록"할 수 있습니다.'
                        : '아직 변환 결과가 없습니다. "AI 실행형 변환" 버튼으로 순서도를 실행 가능한 정의(역할·분기 조건·자동화 태스크)로 변환하세요.'
                ].join('\n')
            };
        }
        default:
            return { message: '지원하지 않는 명령입니다.' };
    }
}

/** 슬래시 명령 실행 + 기존 Copilot 로그 파이프라인 재사용 (Q&A 로 저장/표시). */
async function runAnCommand(kind: AnIntentKind, nextQuestion: string, procDefId: string) {
    const requestId = ++requestSequence;
    loading.value = true;
    errorMessage.value = '';
    try {
        const { message: answer, data } = await executeAnIntent(kind);
        lastResultData.value = data || null;
        const saved = await backend.saveCopilotLog({ procDefId, question: nextQuestion, answer });
        if (requestId !== requestSequence) return;
        const savedEntry = saved as CopilotLogEntry;
        logs.value = [...logs.value, savedEntry];
        expandedIds.value = new Set([...expandedIds.value, savedEntry.id]);
        question.value = '';
    } catch (e: any) {
        if (requestId !== requestSequence) return;
        errorMessage.value = e?.detail || e?.message || 'AI Copilot 명령 실행에 실패했습니다.';
    } finally {
        if (requestId === requestSequence) {
            loading.value = false;
        }
    }
}

async function generateAnswer() {
    commandHint.value = null;
    // To-Be 명령 모드에서는 제안 문구가 실행 명령이므로, 빈 입력을 제안으로 자동 대체하지 않는다
    const fallbackQuestion = anCommandsEnabled.value ? '' : suggestedQuestions.value[0] || '';
    const nextQuestion = (question.value || fallbackQuestion).trim();
    question.value = nextQuestion;

    if (!nextQuestion) {
        errorMessage.value = '질문을 입력해 주세요.';
        return;
    }

    const procDefId = props.processDefinition?.id || '';
    if (!procDefId) {
        errorMessage.value = '저장에 필요한 프로세스 ID 가 없습니다.';
        return;
    }

    // 슬래시 명령(AI Copilot): /partition · /gap · /tobe · /roadmap · /modularize · /executable
    if (nextQuestion.startsWith('/')) {
        if (props.isViewMode) {
            errorMessage.value = '읽기 전용 상태에서는 AI Copilot 명령을 실행할 수 없습니다.';
            return;
        }
        let slash = parseSlashCommand(nextQuestion);
        if (!slash) {
            // 부분 입력(예: "/par")이라도 후보가 유일하면 그 명령으로 실행
            const candidates = filterSlashCommands(nextQuestion);
            if (candidates.length === 1) slash = { kind: candidates[0].kind };
        }
        if (!slash) {
            const available = visibleSlashCommands().map((c) => c.command).join(' · ');
            errorMessage.value = `알 수 없는 명령입니다. 사용 가능: ${available} (열람은 "명령 view")`;
            return;
        }
        // 파티셔닝 계열만 As-Is 편집 모드에서 허용, 그 외 명령은 To-Be 모드 전용
        if (!props.toBeActive && !AS_IS_ALLOWED_KINDS.has(slash.kind)) {
            errorMessage.value =
                '이 명령은 To-Be 모드에서만 사용할 수 있습니다. (/partition 은 As-Is 편집 모드에서도 가능) 캔버스 상단 토글에서 To-Be 를 켜 주세요.';
            return;
        }
        await runAnCommand(slash.kind, nextQuestion, procDefId);
        return;
    }

    // 자연어가 Copilot 명령 의도로 보이면 자동 실행하지 않고 해당 슬래시 명령만 안내 (일반 질의는 계속 진행)
    if (anCommandsEnabled.value) {
        const intent = detectAnIntent(nextQuestion);
        if (intent) {
            const meta = AN_SLASH_COMMANDS.find((c) => c.kind === intent.kind || c.showKind === intent.kind);
            if (meta) {
                commandHint.value = {
                    command: intent.kind.startsWith('show-') ? `${meta.command} view` : meta.command,
                    label: meta.label
                };
            }
        }
    }

    const requestId = ++requestSequence;
    loading.value = true;
    errorMessage.value = '';

    // 스트리밍 표시용 임시 엔트리 id (첫 토큰 도착 시 logs 에 추가)
    const pendingId = `pending-${createCopilotSessionId()}`;
    const removePending = () => {
        logs.value = logs.value.filter((e) => e.id !== pendingId);
        expandedIds.value = new Set([...expandedIds.value].filter((id) => id !== pendingId));
    };

    try {
        const processDefinitionPayload = cloneDefinitionPayload();
        const bpmnXml = await resolveCurrentBpmnXml();
        if (!processDefinitionPayload && !bpmnXml) {
            errorMessage.value = '현재 BPMN definition 또는 XML을 찾을 수 없습니다.';
            return;
        }

        let accumulated = '';
        const onDelta = (text: string) => {
            if (requestId !== requestSequence) return;
            accumulated = text;
            // 첫 토큰에 임시 스트리밍 엔트리를 만들어 실시간으로 갱신 (그 전까지는 로딩 표시)
            if (!logs.value.some((e) => e.id === pendingId)) {
                logs.value = [
                    ...logs.value,
                    {
                        id: pendingId,
                        proc_def_id: procDefId,
                        question: nextQuestion,
                        answer: '',
                        created_at: new Date().toISOString(),
                        created_by: '',
                        streaming: true
                    }
                ];
                expandedIds.value = new Set([...expandedIds.value, pendingId]);
                loading.value = false;
                question.value = '';
            }
            // reactive 배열에서 다시 찾아 갱신해야 재렌더가 트리거된다.
            const entry = logs.value.find((e) => e.id === pendingId);
            if (entry) entry.answer = text;
        };

        // TM Forum 표준 판단 근거: 사내 TMF MCP 검색 결과(미설정/실패 시 '' → 기존 RAG 지식만 사용)
        const tmfContext = await fetchTmfKbContext(backend, nextQuestion, { topK: 5 });

        const response = await backend.qdrantChat(
            {
                message: buildQdrantCopilotMessage(nextQuestion, processDefinitionPayload, !!bpmnXml, tmfContext),
                xml: bpmnXml || undefined,
                sessionId: copilotSessionId.value
            },
            { onDelta }
        );

        if (requestId !== requestSequence) return;

        const answerText = (response?.answer || accumulated || '').trim();
        if (!answerText) {
            removePending();
            errorMessage.value = 'BPMN 기반 답변을 생성하지 못했습니다.';
            return;
        }

        const saved = await backend.saveCopilotLog({
            procDefId,
            question: nextQuestion,
            answer: answerText
        });
        if (requestId !== requestSequence) return;

        // 임시 스트리밍 엔트리를 저장된 엔트리로 교체 (OpenUI 렌더 + 실제 id 부여)
        const savedEntry = saved as CopilotLogEntry;
        const hadPending = logs.value.some((e) => e.id === pendingId);
        logs.value = hadPending ? logs.value.map((e) => (e.id === pendingId ? savedEntry : e)) : [...logs.value, savedEntry];
        expandedIds.value = new Set([...[...expandedIds.value].filter((id) => id !== pendingId), savedEntry.id]);
        question.value = '';
    } catch (e: any) {
        if (requestId !== requestSequence) return;
        removePending();
        errorMessage.value = e?.detail || e?.message || 'BPMN Copilot 요청에 실패했습니다.';
    } finally {
        if (requestId === requestSequence) {
            loading.value = false;
        }
    }
}

function applySuggestedQuestion(nextQuestion: string) {
    question.value = nextQuestion;
    void generateAnswer();
}

/** 자동완성 메뉴에서 명령 클릭 → 입력창에 자동완성 (채팅 입력 UX 와 동일) */
function applySlashCommand(cmd: AnSlashCommand) {
    completeSlashCommand(cmd);
}

/** 자연어 의도 힌트의 "바로 실행" → 안내된 슬래시 명령 실행 */
function runCommandFromHint() {
    if (!commandHint.value) return;
    question.value = commandHint.value.command;
    void generateAnswer();
}

async function ask(nextQuestion: string): Promise<{ ok: boolean; message: string; data?: AnIntentResult['data'] }> {
    question.value = nextQuestion;
    errorMessage.value = '';
    lastResultData.value = null;
    const beforeLen = logs.value.length;
    await generateAnswer();
    if (errorMessage.value) {
        return { ok: false, message: errorMessage.value };
    }
    // 성공 시 새로 추가된 마지막 로그의 답변 텍스트를 반환 (채팅에서 그대로 표출)
    const appended = logs.value.length > beforeLen ? logs.value[logs.value.length - 1] : null;
    return { ok: true, message: appended?.answer || '요청을 처리했습니다.', data: lastResultData.value || undefined };
}

defineExpose({
    ask
});

async function deleteEntry(entry: CopilotLogEntry) {
    if (!window.confirm('이 답변을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
        await backend.deleteCopilotLog(entry.id);
        logs.value = logs.value.filter((item) => item.id !== entry.id);
    } catch (e: any) {
        errorMessage.value = e?.detail || e?.message || '삭제에 실패했습니다.';
    }
}

watch(
    () => props.processDefinition?.id || '',
    () => {
        copilotSessionId.value = createCopilotSessionId();
        aiCopilotStateOverride.value = null;
        question.value = '';
        errorMessage.value = '';
        rememberAsIsXml(props.processDefinition?.bpmn || props.bpmnXml || '');
        void loadLogs();
    },
    { immediate: true }
);

watch(
    () => props.bpmnXml || '',
    (xml) => {
        if (!props.toBeActive) rememberAsIsXml(xml);
    },
    { immediate: true }
);

watch(
    () => props.element?.businessObject?.id || props.element?.id || '',
    () => {
        errorMessage.value = '';
    }
);
</script>

<style scoped>
.ai-guide-panel {
    padding: 16px;
}

.slash-menu {
    border-radius: 10px;
    overflow: hidden;
}

.slash-menu__item {
    cursor: pointer;
}

.slash-menu__item--active {
    background: rgba(63, 81, 181, 0.08);
}

.slash-menu__kbd {
    float: right;
    padding: 1px 5px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 4px;
    background: #ffffff;
    color: rgba(0, 0, 0, 0.55);
    font-size: 11px;
    line-height: 1.4;
    font-family: inherit;
}

.slash-hint :deep(.v-alert__content) {
    width: 100%;
}

.saved-result-section {
    min-width: 0;
}

.saved-result-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.saved-result-item {
    width: 100%;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto 28px;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border: 1px solid #d9e2f3;
    border-radius: 8px;
    background: #ffffff;
    color: #24324b;
    text-align: left;
    cursor: pointer;
}

.saved-result-item:hover {
    border-color: #7aa7e9;
    background: #f7fbff;
}

.saved-result-item__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.saved-result-item__title {
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.25;
}

.saved-result-item__meta,
.saved-result-item__time {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.72rem;
    color: #68758b;
    line-height: 1.2;
}

.saved-result-item__command {
    align-self: start;
    border: 1px solid #c9d9f6;
    border-radius: 6px;
    padding: 2px 6px;
    color: #2563eb;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.4;
}

.saved-result-item__delete {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: #7b8797;
    cursor: pointer;
}

.saved-result-item__delete:hover {
    border-color: #fecaca;
    background: #fff1f2;
    color: #dc2626;
}

.ai-guide-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
}

.ai-guide-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
}

.ai-guide-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
}

.context-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.context-card {
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #fafafa;
}

.context-card__label {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 6px;
}

.context-card__value {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    line-height: 1.4;
    white-space: pre-line;
}

.context-card__rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.context-card__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.context-card__row-label {
    font-size: 11px;
    color: #6b7280;
}

.context-card__row-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.context-card__meta,
.context-card__link {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: #4b5563;
}

.warning-card {
    padding: 12px 14px;
    border-radius: 12px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
}

.warning-card__title {
    font-size: 12px;
    font-weight: 700;
    color: #9a3412;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.warning-card__list {
    margin: 0;
    padding-left: 16px;
    color: #7c2d12;
    font-size: 13px;
    line-height: 1.6;
}

.section-title {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.suggestion-chips {
    display: flex;
    flex-wrap: wrap;
}

.answer-card {
    padding: 14px;
    border-radius: 12px;
    background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
    border: 1px solid #dbeafe;
}

.answer-card__text {
    font-size: 13px;
    line-height: 1.7;
    color: #1f2937;
}
.answer-card__text--streaming {
    display: inline;
}
/* 스트리밍 타이핑 커서 */
.stream-caret {
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: #6366f1;
    border-radius: 1px;
    animation: aiguide-stream-caret 1s steps(2, start) infinite;
}
@keyframes aiguide-stream-caret {
    0%,
    50% {
        opacity: 1;
    }
    50.01%,
    100% {
        opacity: 0;
    }
}

.answer-card__text :deep(p) {
    margin: 0 0 10px;
}

.answer-card__text :deep(p:last-child) {
    margin-bottom: 0;
}

.answer-card__text :deep(h1),
.answer-card__text :deep(h2),
.answer-card__text :deep(h3) {
    margin: 12px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    font-weight: 700;
}

.answer-card__text :deep(ul),
.answer-card__text :deep(ol) {
    margin: 8px 0 10px;
    padding-left: 18px;
}

.answer-card__text :deep(table) {
    width: 100%;
    margin: 10px 0;
    border-collapse: collapse;
    font-size: 12px;
}

.answer-card__text :deep(th),
.answer-card__text :deep(td) {
    padding: 6px 8px;
    border: 1px solid #dbeafe;
    text-align: left;
    vertical-align: top;
}

.answer-card__text :deep(th) {
    background: #eff6ff;
    font-weight: 700;
}

.answer-card__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.answer-section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.bulk-toggle-btn {
    padding: 3px 10px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 11px;
    color: #4b5563;
    cursor: pointer;
    transition: background 0.15s ease;
}

.bulk-toggle-btn:hover {
    background: #f3f4f6;
}

.copilot-log-entry {
    margin-bottom: 8px;
    padding: 0;
    overflow: hidden;
    background: #ffffff;
}

.copilot-log-entry:last-child {
    margin-bottom: 0;
}

.copilot-log-entry__head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    cursor: pointer;
    transition: background 0.15s ease;
}

.copilot-log-entry__head:hover {
    background: #f8fafc;
}

.copilot-log-entry--expanded .copilot-log-entry__head {
    background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
}

.copilot-log-entry--expanded .copilot-log-entry__head:hover {
    background: linear-gradient(180deg, #eef5ff 0%, #dbeafe 100%);
}

.copilot-log-entry__chevron {
    flex-shrink: 0;
    margin-top: 2px;
    color: #6b7280;
}

.copilot-log-entry__meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.copilot-log-entry__question {
    font-size: 13px;
    font-weight: 600;
    color: #1e3a8a;
    word-break: break-word;
}

.copilot-log-entry__time {
    font-size: 11px;
    color: #6b7280;
}

.copilot-log-entry__delete-btn {
    flex-shrink: 0;
    padding: 2px 4px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    line-height: 1;
    transition: color 0.15s ease, background 0.15s ease;
}

.copilot-log-entry__delete-btn:hover {
    color: #ef4444;
    background: #fee2e2;
}

.copilot-log-entry__answer {
    padding: 12px 14px;
    border-top: 1px solid #dbeafe;
    background: #ffffff;
    font-size: 13px;
    line-height: 1.7;
    color: #1f2937;
}

.answer-card--placeholder,
.answer-card--loading {
    color: #475569;
    font-size: 13px;
    line-height: 1.7;
}

.answer-card--error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
    font-size: 13px;
    line-height: 1.7;
}

.copilot-log-loading {
    padding: 8px 0;
    font-size: 13px;
    color: #475569;
}

.answer-card__openui {
    min-width: 0;
}

.answer-card__placeholder,
.answer-card__error {
    font-size: 13px;
    line-height: 1.7;
}

.answer-card__placeholder {
    color: #475569;
}

.answer-card__error {
    color: #b91c1c;
}

.next-task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.next-task-item {
    width: 100%;
    text-align: left;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #ffffff;
    transition: border-color 0.15s ease, background 0.15s ease;
}

.next-task-item:hover {
    border-color: #93c5fd;
    background: #f8fbff;
}

.next-task-item__name {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
}

.next-task-item__meta {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
}
</style>

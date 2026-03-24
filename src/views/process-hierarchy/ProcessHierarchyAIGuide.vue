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
                <div class="context-card__value">{{ card.value }}</div>
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

        <div class="section-title mt-5">추천 질문</div>
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

        <div class="section-title mt-2">질문</div>
        <v-textarea
            v-model="question"
            rows="3"
            auto-grow
            density="compact"
            variant="outlined"
            hide-details
            :placeholder="questionPlaceholder"
            class="mb-3"
            @keydown.enter.exact.prevent="generateAnswer"
        />

        <div class="d-flex align-center justify-space-between mb-4">
            <div class="text-caption text-medium-emphasis">
                {{ answerHint }}
            </div>
            <v-btn color="primary" variant="flat" size="small" :loading="loading" :disabled="loading" @click="generateAnswer">
                답변 생성
            </v-btn>
        </div>

        <div class="section-title">AI 답변</div>
        <div class="answer-card">
            <div v-if="loading" class="answer-card__placeholder">현재 BPMN 정의와 선택 단계를 분석 중입니다.</div>
            <div v-else-if="errorMessage" class="answer-card__error">{{ errorMessage }}</div>
            <div v-else-if="answer" class="answer-card__text" v-html="formattedAnswer"></div>
            <div v-else class="answer-card__placeholder">질문을 입력하거나 추천 질문을 선택하세요.</div>
        </div>

        <div v-if="contextSummary.nextTasks.length > 0" class="section-title mt-5">다음 단계 이동</div>
        <div v-if="contextSummary.nextTasks.length > 0" class="next-task-list">
            <button v-for="task in contextSummary.nextTasks" :key="task.id" class="next-task-item" @click="emit('focusElement', task.id)">
                <div class="next-task-item__name">{{ task.name }}</div>
                <div class="next-task-item__meta">{{ task.lane || task.id }}</div>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';

type GuideElement = Record<string, any> | null;
type GuideProcessDefinition = Record<string, any> | null;

const props = defineProps<{
    element: GuideElement;
    processDefinition: GuideProcessDefinition;
    isViewMode: boolean;
    embedded?: boolean;
}>();

const emit = defineEmits<{
    (e: 'focusElement', id: string): void;
}>();

const question = ref('');
const answer = ref('');
const loading = ref(false);
const errorMessage = ref('');
let requestSequence = 0;

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
    const manualLink = taskProps.manualLink || processProps.manualLink || processProps.manual_link || '';
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

const ownerSummary = computed(() => {
    const owners = contextSummary.value.owners || {};
    const labels = [];
    if (owners.primaryOwner) labels.push(`Primary ${owners.primaryOwner}`);
    if (owners.masterOwner) labels.push(`Master ${owners.masterOwner}`);
    if (owners.fieldOwners?.length) labels.push(`Field ${owners.fieldOwners.join(', ')}`);
    if (owners.hqOwners?.length) labels.push(`HQ ${owners.hqOwners.join(', ')}`);
    return labels.join(' / ');
});

const contextCards = computed(() => {
    if (contextSummary.value.isProcessLevel) {
        return [
            {
                label: '프로세스',
                value: contextSummary.value.currentTask,
                meta: contextSummary.value.processMode === 'tobe' ? 'To-Be Process' : 'As-Is Process'
            },
            {
                label: '주요 담당',
                value: ownerSummary.value || '담당자 미등록',
                meta: ownerSummary.value ? 'Owner Matrix' : ''
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

const suggestedQuestions = computed(() =>
    contextSummary.value.isProcessLevel
        ? ['이 프로세스의 목적이 뭐야?', '주요 담당자는 누구야?', '어떤 시스템을 써?', '운영 시 주의할 점은?']
        : ['이 단계에서 주의할 점이 뭐야?', '다음 결재 부서는 어디야?', '관련 매뉴얼 찾아줘', '어떤 시스템을 봐야 해?']
);

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
    const rawDefinition = props.processDefinition?.definition;
    if (!rawDefinition) return null;

    try {
        return JSON.parse(JSON.stringify(rawDefinition));
    } catch {
        return rawDefinition;
    }
}

function escapeHtml(input: string) {
    return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function generateAnswer() {
    const nextQuestion = (question.value || suggestedQuestions.value[0] || '').trim();
    question.value = nextQuestion;

    const processDefinitionPayload = cloneDefinitionPayload();
    if (!nextQuestion) {
        answer.value = '';
        errorMessage.value = '질문을 입력해 주세요.';
        return;
    }
    if (!processDefinitionPayload) {
        answer.value = '';
        errorMessage.value = '현재 BPMN definition을 찾을 수 없습니다.';
        return;
    }

    const backend = BackendFactory.createBackend() as any;
    const requestId = ++requestSequence;
    loading.value = true;
    errorMessage.value = '';

    try {
        const response = await backend.generateProcessCopilotAnswer({
            question: nextQuestion,
            process_definition_id: props.processDefinition?.id || processDefinitionPayload.processDefinitionId || '',
            process_name: props.processDefinition?.name || processDefinitionPayload.processDefinitionName || '',
            process_definition: processDefinitionPayload,
            activity_id: props.element?.businessObject?.id || props.element?.id || '',
            activity_name: props.element?.businessObject?.name || '',
            selected_element: selectedElementPayload.value,
            locale: ((window as any).countryCode || 'ko').toLowerCase()
        });

        if (requestId !== requestSequence) return;
        answer.value = response?.answer || 'BPMN 기반 답변을 생성하지 못했습니다.';
    } catch (e: any) {
        if (requestId !== requestSequence) return;
        answer.value = '';
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

const formattedAnswer = computed(() => escapeHtml(answer.value).replace(/\n/g, '<br />'));

watch(
    () => [props.element?.businessObject?.id || props.element?.id || '', props.processDefinition?.id || ''],
    () => {
        question.value = suggestedQuestions.value[0];
        answer.value = '';
        errorMessage.value = '';
        if (props.processDefinition?.definition) {
            void generateAnswer();
        }
    },
    { immediate: true }
);
</script>

<style scoped>
.ai-guide-panel {
    padding: 16px;
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

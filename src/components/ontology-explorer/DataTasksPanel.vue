<template>
    <div class="data-tasks-panel">
        <div class="panel-title">데이터 태스크</div>

        <!-- 상태 요약 칩 3개 (specs/002 T069, FR-027) -->
        <div class="summary-chips">
            <span class="summary-chip summary-chip--open">열림 {{ counts.open }}</span>
            <span class="summary-chip summary-chip--progress">진행 {{ counts.inProgress }}</span>
            <span class="summary-chip summary-chip--done">완료 {{ counts.done }}</span>
        </div>

        <!-- 빈 상태 -->
        <div v-if="!tasks.length" class="panel-empty">
            보강 인사이트 카드에서 데이터 태스크를 생성하세요.
        </div>

        <!-- 태스크 카드 목록 -->
        <div v-else class="task-list">
            <div v-for="task in tasks" :key="task.id" class="task-card">
                <div class="task-head">
                    <span class="task-title">{{ task.title }}</span>
                    <span class="target-badge">{{ task.targetLabel }}</span>
                </div>

                <div class="task-meta">
                    <div class="meta-row">
                        <span class="meta-key">Target ID</span>
                        <span class="meta-val mono">{{ task.targetId }}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-key">권장 필드</span>
                        <span class="meta-val">{{ task.recommendedFields.length }}</span>
                        <span class="meta-key meta-key--inline">추천 소스</span>
                        <span class="meta-val">{{ task.suggestedSources.length }}</span>
                    </div>
                </div>

                <!-- 상태 변경 -->
                <div class="status-row">
                    <span class="status-label">상태</span>
                    <v-select
                        :items="STATUS_ITEMS"
                        :model-value="task.status"
                        item-title="title"
                        item-value="value"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="status-select"
                        @update:model-value="onStatusChange(task, $event)"
                    />
                </div>

                <!-- 접이식: 권장 필드 -->
                <button type="button" class="details-toggle" @click="toggle(task.id + ':fields')">
                    {{ isOpen(task.id + ':fields') ? '▴' : '▾' }} 권장 필드 ({{ task.recommendedFields.length }})
                </button>
                <ul v-if="isOpen(task.id + ':fields')" class="detail-list">
                    <li v-if="!task.recommendedFields.length" class="detail-empty">없음</li>
                    <li v-for="field in task.recommendedFields" :key="field">{{ field }}</li>
                </ul>

                <!-- 접이식: 추천 소스 -->
                <button type="button" class="details-toggle" @click="toggle(task.id + ':sources')">
                    {{ isOpen(task.id + ':sources') ? '▴' : '▾' }} 추천 소스 ({{ task.suggestedSources.length }})
                </button>
                <ul v-if="isOpen(task.id + ':sources')" class="detail-list">
                    <li v-if="!task.suggestedSources.length" class="detail-empty">없음</li>
                    <li v-for="source in task.suggestedSources" :key="source">{{ source }}</li>
                </ul>

                <!-- 접이식: 마크다운 내보내기 -->
                <button type="button" class="details-toggle" @click="toggle(task.id + ':markdown')">
                    {{ isOpen(task.id + ':markdown') ? '▴' : '▾' }} 마크다운
                </button>
                <div v-if="isOpen(task.id + ':markdown')" class="markdown-block">
                    <div class="markdown-actions">
                        <button type="button" class="copy-btn" @click="copyMarkdown(task)">
                            {{
                                copyStateById[task.id] === 'copied'
                                    ? '복사됨'
                                    : copyStateById[task.id] === 'failed'
                                      ? '복사 실패'
                                      : '마크다운 복사'
                            }}
                        </button>
                    </div>
                    <textarea
                        class="markdown-textarea"
                        readonly
                        rows="8"
                        :value="generateDataTaskMarkdown(task)"
                        @focus="selectAll"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DataTask } from '@/composables/ontology/useInsightWorkflow';
import { generateDataTaskMarkdown } from '@/composables/ontology/useInsightWorkflow';

type DataTaskStatus = 'open' | 'in_progress' | 'done';

const props = defineProps<{
    tasks: DataTask[];
}>();

const emit = defineEmits<{
    (e: 'update-task-status', payload: { taskId: string; status: DataTaskStatus }): void;
}>();

/** 상태 라벨 (샘플 DATA_TASK_STATUS_LABELS 한국어 번안) */
const STATUS_ITEMS: ReadonlyArray<{ title: string; value: DataTaskStatus }> = [
    { title: '열림', value: 'open' },
    { title: '진행 중', value: 'in_progress' },
    { title: '완료', value: 'done' },
];

const VALID_STATUSES: ReadonlyArray<DataTaskStatus> = ['open', 'in_progress', 'done'];

const counts = computed(() => ({
    open: props.tasks.filter((t) => t.status === 'open').length,
    inProgress: props.tasks.filter((t) => t.status === 'in_progress').length,
    done: props.tasks.filter((t) => t.status === 'done').length,
}));

/** 접이식 섹션 열림 상태: `${taskId}:fields|sources|markdown` */
const openSections = ref<Record<string, boolean>>({});

function toggle(key: string) {
    openSections.value[key] = !openSections.value[key];
}

function isOpen(key: string): boolean {
    return Boolean(openSections.value[key]);
}

function onStatusChange(task: DataTask, value: unknown) {
    if (
        typeof value === 'string' &&
        (VALID_STATUSES as readonly string[]).includes(value) &&
        value !== task.status
    ) {
        emit('update-task-status', { taskId: task.id, status: value as DataTaskStatus });
    }
}

/* 마크다운 복사 (태스크별 피드백) */
const copyStateById = ref<Record<string, 'idle' | 'copied' | 'failed'>>({});
const copyTimers: Record<string, ReturnType<typeof setTimeout>> = {};

async function copyMarkdown(task: DataTask) {
    try {
        await navigator.clipboard.writeText(generateDataTaskMarkdown(task));
        copyStateById.value[task.id] = 'copied';
    } catch {
        copyStateById.value[task.id] = 'failed';
    }
    if (copyTimers[task.id]) clearTimeout(copyTimers[task.id]);
    copyTimers[task.id] = setTimeout(() => {
        copyStateById.value[task.id] = 'idle';
    }, 1500);
}

function selectAll(event: FocusEvent) {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) target.select();
}
</script>

<style scoped>
.data-tasks-panel {
    height: 100%;
    overflow-y: auto;
    padding: 14px 16px;
    color: #1f2533;
    background: #ffffff;
}
.panel-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e7eaf3;
}
.panel-empty {
    color: #8a93a6;
    font-size: 12px;
    padding: 12px 0;
    text-align: center;
}

/* 상태 요약 칩 */
.summary-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}
.summary-chip {
    font-size: 11px;
    font-weight: 700;
    border-radius: 8px;
    padding: 2px 8px;
}
.summary-chip--open {
    color: #0085db;
    background: #e5f3fb;
}
.summary-chip--progress {
    color: #b7791f;
    background: #fdf3df;
}
.summary-chip--done {
    color: #2f855a;
    background: #e6f4ec;
}

/* 태스크 카드 */
.task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.task-card {
    padding: 10px 12px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #ffffff;
    font-size: 13px;
}
.task-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
}
.task-title {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: 700;
    line-height: 1.4;
    word-break: break-word;
}
.target-badge {
    flex: 0 0 auto;
    max-width: 45%;
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
    background: #f4f6fb;
    border-radius: 4px;
    padding: 2px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.task-meta {
    margin-bottom: 8px;
}
.meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.8;
    min-width: 0;
}
.meta-key {
    color: #8a93a6;
    flex: 0 0 auto;
}
.meta-key--inline {
    margin-left: 8px;
}
.meta-val {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
}

/* 상태 변경 */
.status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.status-label {
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
}
.status-select {
    flex: 1 1 auto;
    min-width: 0;
}

/* 접이식 */
.details-toggle {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 0;
    border: none;
    background: transparent;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.details-toggle:hover {
    text-decoration: underline;
}
.detail-list {
    margin: 0 0 6px;
    padding-left: 18px;
    font-size: 12px;
    color: #5a6478;
    line-height: 1.7;
}
.detail-empty {
    list-style: none;
    margin-left: -18px;
    color: #8a93a6;
}

/* 마크다운 내보내기 */
.markdown-block {
    margin-bottom: 6px;
}
.markdown-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}
.copy-btn {
    padding: 5px 10px;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    background: #fff;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.copy-btn:hover {
    background: #e5f3fb;
}
.markdown-textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    background: #f8fafd;
    color: #1f2533;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.5;
    resize: vertical;
}
.markdown-textarea:focus {
    outline: none;
    border-color: #0085db;
}
</style>

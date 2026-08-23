<template>
    <div class="compare">
        <div class="compare__viewers">
            <div class="compare__pane">
                <div class="compare__bar">
                    <v-chip size="x-small" variant="flat" color="grey-darken-1">As-Is</v-chip>
                    <span class="compare__bar-title">현재 프로세스</span>
                </div>
                <div class="compare__canvas">
                    <BpmnUengineViewer v-if="asIsXml" :key="'asis-' + renderKey" :bpmn="asIsXml" :diffActivities="diffOld" />
                    <div v-else class="compare__empty">As-Is BPMN 없음</div>
                </div>
            </div>
            <div class="compare__pane">
                <div class="compare__bar">
                    <v-chip size="x-small" variant="flat" color="purple">To-Be</v-chip>
                    <span class="compare__bar-title">차기 청사진</span>
                </div>
                <div class="compare__canvas">
                    <BpmnUengineViewer v-if="toBeXml" :key="'tobe-' + renderKey" :bpmn="toBeXml" :diffActivities="diffNew" />
                    <div v-else class="compare__empty">To-Be 블루프린트 없음</div>
                </div>
            </div>
            <div v-if="hasExecutable" class="compare__pane">
                <div class="compare__bar">
                    <v-chip size="x-small" variant="flat" color="teal">실행형</v-chip>
                    <span class="compare__bar-title">실행 가능 프로세스</span>
                    <v-chip v-if="executable?.applied_at" size="x-small" variant="flat" color="success">등록됨</v-chip>
                    <v-spacer />
                    <v-btn size="x-small" variant="text" color="teal" @click="$emit('open-executable')">
                        상세
                        <v-icon end size="13">mdi-arrow-right</v-icon>
                    </v-btn>
                </div>
                <div class="compare__canvas">
                    <BpmnUengineViewer
                        v-if="executableXml"
                        :key="'exec-' + renderKey + '-' + (executable?.generated_at || '')"
                        :bpmn="executableXml"
                        :diffActivities="executableMarkers"
                    />
                    <div v-else class="compare__empty">실행형 원본 BPMN 없음</div>
                </div>
            </div>
        </div>

        <!-- 범례 -->
        <div class="compare__legend">
            <span v-for="lg in legend" :key="lg.type" class="compare__legend-item">
                <span class="compare__legend-dot" :style="{ background: lg.color }"></span>{{ lg.label }}
            </span>
            <v-spacer />
            <v-btn v-if="!readonly" size="x-small" variant="tonal" color="primary" @click="$emit('rederive')">
                <v-icon start size="14">mdi-refresh</v-icon>
                매핑 자동 재도출
            </v-btn>
        </div>

        <!-- 변화 매핑 테이블 -->
        <div class="compare__map">
            <div class="compare__map-head" @click="showMap = !showMap">
                <v-icon size="16" class="mr-1">{{ showMap ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                변화 매핑 ({{ taskMap.length }})
                <span class="compare__map-summary">
                    {{ summaryText }}
                </span>
            </div>
            <v-expand-transition>
                <div v-show="showMap" class="compare__map-body">
                    <table class="compare__table">
                        <thead>
                            <tr>
                                <th>유형</th>
                                <th>To-Be 단계</th>
                                <th>← 출처 As-Is 단계</th>
                                <th>설명</th>
                                <th v-if="!readonly"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="entry in taskMap" :key="entry.id">
                                <td>
                                    <v-chip size="x-small" variant="flat" :color="typeMeta(entry.mapping_type).color">
                                        {{ typeMeta(entry.mapping_type).label }}
                                    </v-chip>
                                    <v-icon v-if="!entry.auto" size="12" color="primary" class="ml-1" title="수동 보정됨"
                                        >mdi-account-edit</v-icon
                                    >
                                </td>
                                <td>{{ entry.tobe_element_name || (entry.mapping_type === 'removed' ? '—' : entry.tobe_element_id) }}</td>
                                <td>
                                    <span v-if="entry.asis_element_ids.length" class="compare__asis-list">
                                        <span v-for="(name, idx) in asisNames(entry)" :key="idx" class="compare__asis-chip">{{
                                            name
                                        }}</span>
                                    </span>
                                    <span v-else class="text-disabled">—</span>
                                </td>
                                <td class="compare__desc">{{ entry.change_description }}</td>
                                <td v-if="!readonly">
                                    <v-btn size="x-small" variant="text" icon @click="openEdit(entry)">
                                        <v-icon size="15">mdi-pencil-outline</v-icon>
                                    </v-btn>
                                </td>
                            </tr>
                            <tr v-if="!taskMap.length">
                                <td :colspan="readonly ? 4 : 5" class="text-center text-disabled py-4">
                                    매핑 데이터가 없습니다. To-Be 생성 후 "매핑 자동 재도출"을 실행하세요.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </v-expand-transition>
        </div>

        <!-- 매핑 수동 보정 다이얼로그 -->
        <v-dialog v-model="editDialog" max-width="520">
            <v-card>
                <v-card-title class="text-subtitle-1">매핑 수동 보정</v-card-title>
                <v-card-text>
                    <div class="text-body-2 mb-2">
                        To-Be: <strong>{{ editForm.tobe_element_name || '—' }}</strong>
                    </div>
                    <v-select
                        v-model="editForm.mapping_type"
                        :items="typeItems"
                        item-title="label"
                        item-value="value"
                        label="변화 유형"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mb-3"
                    />
                    <v-select
                        v-model="editForm.asis_element_ids"
                        :items="asisTaskItems"
                        item-title="label"
                        item-value="id"
                        label="출처 As-Is 단계 (다중 선택 가능 → N:1)"
                        multiple
                        chips
                        closable-chips
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mb-3"
                    />
                    <v-textarea
                        v-model="editForm.change_description"
                        label="변경 설명"
                        rows="2"
                        density="compact"
                        variant="outlined"
                        auto-grow
                        hide-details
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="editDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" @click="saveEdit">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { extractTasks, toBeMarkers, asIsMarkers } from '@/utils/asisTobeTaskMap';
import { MAPPING_TYPE_META, type TaskMapEntry, type MappingType } from '@/composables/blueprint/blueprintModel';
import type { ExecutableData } from '@/composables/blueprint/executableModel';

const props = defineProps<{
    asIsXml: string;
    toBeXml: string;
    taskMap: TaskMapEntry[];
    /** AI 실행형 변환 결과 — 있으면 세 번째 패널로 표시. */
    executable?: ExecutableData | null;
    /** 실행형 변환의 원본 BPMN (마커 캔버스용). */
    executableXml?: string;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update-mapping', id: string, patch: Partial<TaskMapEntry>): void;
    (e: 'rederive'): void;
    (e: 'open-executable'): void;
}>();

const hasExecutable = computed(() => !!props.executable?.definition);

/** 실행 타입 마커: serviceTask=added(초록), scriptTask=split(파랑). */
const executableMarkers = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const a of props.executable?.definition?.activities || []) {
        if (a.type === 'serviceTask') out[a.id] = 'added';
        else if (a.type === 'scriptTask') out[a.id] = 'split';
    }
    return out;
});

const showMap = ref(true);
const renderKey = computed(() => `${(props.asIsXml || '').length}-${(props.toBeXml || '').length}`);

const diffOld = computed(() => asIsMarkers(props.taskMap));
const diffNew = computed(() => toBeMarkers(props.taskMap));

const asisTasks = computed(() => extractTasks(props.asIsXml));
const asisTaskItems = computed(() => asisTasks.value.map((t) => ({ id: t.id, label: t.name || t.id })));
const asisNameById = computed(() => {
    const m: Record<string, string> = {};
    for (const t of asisTasks.value) m[t.id] = t.name || t.id;
    return m;
});

function asisNames(entry: TaskMapEntry): string[] {
    return entry.asis_element_ids.map((id) => asisNameById.value[id] || id);
}

function typeMeta(t: MappingType) {
    return MAPPING_TYPE_META[t] || MAPPING_TYPE_META.modified;
}

const typeItems = (Object.keys(MAPPING_TYPE_META) as MappingType[]).map((k) => ({ value: k, label: MAPPING_TYPE_META[k].label }));

const legend = [
    { type: 'added', label: '신규', color: '#16a34a' },
    { type: 'modified', label: '변경', color: '#f59e0b' },
    { type: 'removed', label: '삭제', color: '#dc2626' },
    { type: 'consolidated', label: '통합(N:1)', color: '#9333ea' },
    { type: 'split', label: '분할(1:N)', color: '#2563eb' }
];

const summaryText = computed(() => {
    const counts: Record<string, number> = {};
    for (const e of props.taskMap) counts[e.mapping_type] = (counts[e.mapping_type] || 0) + 1;
    return (Object.keys(counts) as MappingType[]).map((k) => `${MAPPING_TYPE_META[k].label} ${counts[k]}`).join(' · ');
});

/* ---- edit ---- */
const editDialog = ref(false);
const editForm = reactive<{
    id: string;
    tobe_element_name: string;
    mapping_type: MappingType;
    asis_element_ids: string[];
    change_description: string;
}>({
    id: '',
    tobe_element_name: '',
    mapping_type: 'modified',
    asis_element_ids: [],
    change_description: ''
});
function openEdit(entry: TaskMapEntry) {
    editForm.id = entry.id;
    editForm.tobe_element_name = entry.tobe_element_name || '';
    editForm.mapping_type = entry.mapping_type;
    editForm.asis_element_ids = [...entry.asis_element_ids];
    editForm.change_description = entry.change_description || '';
    editDialog.value = true;
}
function saveEdit() {
    emit('update-mapping', editForm.id, {
        mapping_type: editForm.mapping_type,
        asis_element_ids: [...editForm.asis_element_ids],
        change_description: editForm.change_description,
        auto: false
    });
    editDialog.value = false;
}
</script>

<style scoped>
.compare {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
}
.compare__viewers {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
}
.compare__pane {
    flex: 1 1 50%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.08);
}
.compare__pane:last-child {
    border-right: none;
}
.compare__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f7f7f9;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.compare__bar-title {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
}
.compare__canvas {
    flex: 1 1 auto;
    position: relative;
    min-height: 0;
    overflow: hidden;
}
.compare__canvas :deep(.vue-bpmn-diagram-container) {
    height: 100%;
    width: 100%;
}
.compare__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(0, 0, 0, 0.4);
    font-size: 13px;
}
.compare__legend {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #fafafb;
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.6);
}
.compare__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.compare__legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
}
.compare__map {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
    max-height: 38%;
    display: flex;
    flex-direction: column;
}
.compare__map-head {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    background: #f7f7f9;
}
.compare__map-summary {
    font-size: 11px;
    font-weight: 400;
    color: rgba(0, 0, 0, 0.5);
    margin-left: 12px;
}
.compare__map-body {
    overflow-y: auto;
}
.compare__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.compare__table th {
    text-align: left;
    padding: 6px 10px;
    background: #fafafb;
    color: rgba(0, 0, 0, 0.5);
    font-weight: 600;
    position: sticky;
    top: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.compare__table td {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    vertical-align: top;
}
.compare__asis-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.compare__asis-chip {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 6px;
    padding: 1px 6px;
    font-size: 11px;
}
.compare__desc {
    color: rgba(0, 0, 0, 0.6);
    max-width: 240px;
}
</style>

<template>
    <div class="focus-panel">
        <div class="panel-title">엔터티 포커스</div>

        <!-- 1) 엔터티 유형 (7종) -->
        <div class="field-block">
            <div class="field-label">엔터티 유형</div>
            <v-select
                :model-value="focus.entityType || null"
                :items="entityTypeItems"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="유형 선택"
                @update:model-value="onEntityTypeChange"
            />
        </div>

        <!-- 2) 검색형 다중 선택 -->
        <div class="field-block">
            <div class="field-label">
                대상 엔터티
                <span v-if="focus.entityIds.length" class="field-count">{{ focus.entityIds.length }}</span>
            </div>
            <v-autocomplete
                :model-value="focus.entityIds"
                :items="entityOptions"
                item-title="label"
                item-value="id"
                multiple
                chips
                closable-chips
                clearable
                density="compact"
                variant="outlined"
                hide-details
                :disabled="!focus.entityType"
                :placeholder="focus.entityType ? '이름으로 검색' : '유형을 먼저 선택하세요'"
                :no-data-text="focus.entityType ? '일치하는 엔터티가 없습니다' : '유형을 먼저 선택하세요'"
                @update:model-value="onEntityIdsChange"
            >
                <template #item="{ props: itemProps, item }">
                    <v-list-item
                        v-bind="itemProps"
                        :title="item.raw.label"
                        :subtitle="item.raw.secondaryLabel"
                    />
                </template>
            </v-autocomplete>
        </div>

        <!-- 3) 탐색 깊이 (1|2) -->
        <div class="field-block">
            <div class="field-label">탐색 깊이</div>
            <v-btn-toggle
                :model-value="focus.depth"
                mandatory
                density="compact"
                color="primary"
                divided
                class="depth-toggle"
                @update:model-value="onDepthChange"
            >
                <v-btn :value="1" size="small" class="depth-btn">1 · 직접 컨텍스트</v-btn>
                <v-btn :value="2" size="small" class="depth-btn">2 · 확장 컨텍스트</v-btn>
            </v-btn-toggle>
        </div>

        <!-- 4) 활동 상세 포함 -->
        <v-checkbox
            :model-value="focus.includeActivityDetail"
            label="활동 상세 포함"
            density="compact"
            color="primary"
            hide-details
            class="detail-checkbox"
            @update:model-value="onIncludeActivityDetailChange"
        />

        <div class="apply-hint">변경 사항은 즉시 적용됩니다.</div>

        <!-- 5) 포커스 해제 -->
        <button type="button" class="clear-btn" :disabled="!isFocusSet" @click="emit('clear-focus')">
            포커스 해제
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
    FOCUS_ENTITY_TYPES,
    type EntityFocusState,
    type EntityOption,
    type FocusDepth,
    type FocusEntityType,
} from '@/composables/ontology/entityFocus';

const props = defineProps<{
    /** getEntityOptions(graph, focus.entityType) 결과 — 선택된 유형의 옵션 목록 */
    entityOptions: EntityOption[];
    focus: EntityFocusState;
}>();

const emit = defineEmits<{
    (e: 'update:focus', focus: EntityFocusState): void;
    (e: 'clear-focus'): void;
}>();

/** 유형 7종 한국어 라벨 (entityFocus.FOCUS_ENTITY_TYPES 순서 유지) */
const ENTITY_TYPE_LABELS: Record<FocusEntityType, string> = {
    Process: '프로세스',
    Organization: '조직',
    Supplier: '공급사',
    System: '시스템',
    DataStore: '데이터저장소',
    Project: '프로젝트',
    Manual: '매뉴얼',
};

const entityTypeItems = FOCUS_ENTITY_TYPES.map((type) => ({
    value: type,
    title: ENTITY_TYPE_LABELS[type],
}));

const isFocusSet = computed(() => props.focus.entityType !== '' || props.focus.entityIds.length > 0);

/** 유형 변경 → 선택 엔터티 초기화 후 즉시 emit */
function onEntityTypeChange(value: FocusEntityType | null) {
    emit('update:focus', {
        ...props.focus,
        entityType: value ?? '',
        entityIds: [],
    });
}

function onEntityIdsChange(value: unknown) {
    const entityIds = Array.isArray(value) ? (value as string[]) : [];
    emit('update:focus', { ...props.focus, entityIds });
}

function onDepthChange(value: unknown) {
    if (value !== 1 && value !== 2) return;
    emit('update:focus', { ...props.focus, depth: value as FocusDepth });
}

function onIncludeActivityDetailChange(value: boolean | null) {
    emit('update:focus', { ...props.focus, includeActivityDetail: Boolean(value) });
}
</script>

<style scoped>
.focus-panel {
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
.field-block {
    margin-bottom: 14px;
}
.field-label {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
    text-transform: uppercase;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.field-count {
    font-size: 10px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 8px;
    padding: 1px 6px;
}
.depth-toggle {
    width: 100%;
}
.depth-btn {
    flex: 1 1 0;
    font-size: 12px;
    text-transform: none;
}
.detail-checkbox {
    margin-bottom: 4px;
}
.detail-checkbox :deep(.v-label) {
    font-size: 13px;
    opacity: 1;
}
.apply-hint {
    font-size: 11px;
    color: #8a93a6;
    margin-bottom: 10px;
}
.clear-btn {
    width: 100%;
    padding: 7px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    font-weight: 600;
    cursor: pointer;
}
.clear-btn:hover:not(:disabled) {
    background: #e5f3fb;
}
.clear-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>

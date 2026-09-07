<template>
    <div class="tfp-root">
        <button class="tfp-trigger" :class="{ active: active || open }" @click.stop="open = !open">
            필터<span v-if="active" class="tfp-dot" />
        </button>

        <div v-if="open" class="tfp-backdrop" @click="open = false" />
        <div v-if="open" class="tfp-panel" @click.stop>
            <div class="tfp-head">
                <b>유형 필터</b>
                <button class="tfp-reset" @click="$emit('reset')">전체 선택</button>
            </div>

            <!-- 노드 라벨 — 레이어별 그룹 -->
            <div v-for="group in labelGroups" :key="group.layer" class="tfp-section">
                <div class="tfp-sec-title" :style="{ color: layerColor(group.layer) }">{{ layerLabelKo(group.layer) }}</div>
                <label v-for="label in group.labels" :key="label" class="tfp-item">
                    <input type="checkbox" :checked="visibleLabels.has(label)" @change="$emit('toggle-label', label)" />
                    <i class="dot" :style="{ background: colorForLabel(label) }" />
                    {{ labelKo(label) }}
                    <span class="tfp-count">{{ labelCounts[label] ?? 0 }}</span>
                </label>
            </div>

            <!-- 엣지 그룹 -->
            <div class="tfp-section">
                <div class="tfp-sec-title">관계(엣지) 유형</div>
                <label v-for="group in edgeGroups" :key="group" class="tfp-item" :title="edgeTypesOfGroup(group).join(', ')">
                    <input type="checkbox" :checked="visibleEdgeGroups.has(group)" @change="$emit('toggle-edge-group', group)" />
                    {{ edgeGroupKo[group] }}
                </label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { enabledLayerOrder } from '@/composables/ontologyNew/config';
import type { EdgeStyleClass } from '@/composables/ontologyNew/layerMapping';
import { LABEL_LAYER, LAYER_COLOR, LAYER_LABEL_KO, colorForLabel, labelKo } from '@/composables/ontologyNew/layerMapping';
import { ALL_EDGE_GROUPS, EDGE_GROUP_KO, edgeTypesOfGroup } from '@/composables/ontologyNew/typeFilters';
import type { BusinessLayer } from '@/composables/ontologyNew/types';

const props = defineProps<{
    visibleLabels: Set<string>;
    visibleEdgeGroups: Set<EdgeStyleClass>;
    labelCounts: Record<string, number>;
    active: boolean;
}>();

defineEmits<{
    (e: 'toggle-label', label: string): void;
    (e: 'toggle-edge-group', group: EdgeStyleClass): void;
    (e: 'reset'): void;
}>();

const open = ref(false);
const active = computed(() => props.active);

const edgeGroups = ALL_EDGE_GROUPS;
const edgeGroupKo = EDGE_GROUP_KO;

/** 활성 레이어별 라벨 그룹 (밴드 순서) */
const labelGroups = computed(() =>
    enabledLayerOrder().map((layer) => ({
        layer,
        labels: Object.keys(LABEL_LAYER).filter((l) => LABEL_LAYER[l] === layer)
    }))
);

const layerColor = (layer: BusinessLayer) => LAYER_COLOR[layer];
const layerLabelKo = (layer: BusinessLayer) => LAYER_LABEL_KO[layer];
</script>

<style scoped>
.tfp-root {
    position: relative;
}
.tfp-trigger {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    font-size: 12px;
    padding: 5px 12px;
    cursor: pointer;
}
.tfp-trigger.active {
    border-color: #f59e0b;
    color: #92400e;
    background: #fffbeb;
    font-weight: 600;
}
.tfp-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d97706;
    margin-left: 5px;
    vertical-align: middle;
}
.tfp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
}
.tfp-panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 21;
    width: 300px;
    max-height: 460px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    padding: 12px 14px;
    font-size: 12px;
    color: #1e293b;
}
.tfp-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}
.tfp-reset {
    border: none;
    background: none;
    color: #1d4ed8;
    cursor: pointer;
    font-size: 11px;
}
.tfp-section {
    border-top: 1px solid #f1f5f9;
    padding: 8px 0;
}
.tfp-sec-title {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 4px;
}
.tfp-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    cursor: pointer;
}
.tfp-item .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.tfp-count {
    margin-left: auto;
    color: #94a3b8;
    font-size: 11px;
}
</style>

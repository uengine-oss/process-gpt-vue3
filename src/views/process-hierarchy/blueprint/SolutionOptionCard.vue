<template>
    <div class="solution-card" :class="{ 'solution-card--selected': selected }" @click="$emit('select')">
        <div class="solution-card__bar" :style="{ background: `rgb(var(--v-theme-${meta.color}))` }"></div>
        <div class="solution-card__body">
            <div class="solution-card__head">
                <v-icon :color="meta.color" size="18" class="mr-1">{{ meta.icon }}</v-icon>
                <span class="solution-card__type" :style="{ color: `rgb(var(--v-theme-${meta.color}))` }">{{ meta.label }}</span>
                <v-chip v-if="solution.ai_generated" size="x-small" variant="tonal" color="primary" class="ml-1">AI</v-chip>
                <v-spacer />
                <v-icon v-if="selected" color="success" size="20">mdi-check-circle</v-icon>
                <v-icon v-else size="20" color="grey-lighten-1">mdi-circle-outline</v-icon>
            </div>

            <div class="solution-card__title">{{ solution.title }}</div>
            <div v-if="solution.description" class="solution-card__desc">{{ solution.description }}</div>

            <div class="solution-card__metrics">
                <div class="metric" :class="costClass">
                    <span class="metric__label">비용</span>
                    <span class="metric__value">{{ costText }}</span>
                </div>
                <div class="metric" :class="fteClass">
                    <span class="metric__label">FTE</span>
                    <span class="metric__value">{{ fteText }}</span>
                </div>
                <div class="metric">
                    <span class="metric__label">난이도</span>
                    <v-chip size="x-small" variant="tonal" :color="effortMeta.color">{{ effortMeta.label }}</v-chip>
                </div>
                <div v-if="solution.expected_impact?.timeline_months" class="metric">
                    <span class="metric__label">기간</span>
                    <span class="metric__value">{{ solution.expected_impact.timeline_months }}개월</span>
                </div>
            </div>

            <div v-if="solution.pros || solution.cons" class="solution-card__proscons">
                <div v-if="solution.pros" class="pc pc--pro">
                    <v-icon size="13" color="success">mdi-thumb-up-outline</v-icon>
                    <span>{{ solution.pros }}</span>
                </div>
                <div v-if="solution.cons" class="pc pc--con">
                    <v-icon size="13" color="error">mdi-alert-outline</v-icon>
                    <span>{{ solution.cons }}</span>
                </div>
            </div>

            <div v-if="!readonly" class="solution-card__actions" @click.stop>
                <v-btn
                    size="x-small"
                    :variant="selected ? 'flat' : 'tonal'"
                    :color="selected ? 'success' : 'primary'"
                    @click="$emit('select')"
                >
                    <v-icon start size="14">{{ selected ? 'mdi-check' : 'mdi-cursor-default-click-outline' }}</v-icon>
                    {{ selected ? '선택됨' : '이 솔루션 선택' }}
                </v-btn>
                <v-spacer />
                <v-btn size="x-small" variant="text" icon @click="$emit('edit')">
                    <v-icon size="16">mdi-pencil-outline</v-icon>
                </v-btn>
                <v-btn size="x-small" variant="text" icon color="error" @click="$emit('delete')">
                    <v-icon size="16">mdi-delete-outline</v-icon>
                </v-btn>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { solutionTypeMeta, EFFORT_META, type SolutionOption } from '@/composables/blueprint/blueprintModel';

const props = defineProps<{
    solution: SolutionOption;
    selected?: boolean;
    readonly?: boolean;
}>();

defineEmits<{
    (e: 'select'): void;
    (e: 'edit'): void;
    (e: 'delete'): void;
}>();

const meta = computed(() => solutionTypeMeta(props.solution.solution_type));
const effortMeta = computed(() => EFFORT_META[props.solution.implementation_effort] || EFFORT_META.medium);

function formatKrw(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억원`;
    if (abs >= 10_000) return `${Math.round(abs / 10_000).toLocaleString()}만원`;
    return `${abs.toLocaleString()}원`;
}

const costDelta = computed(() => Number(props.solution.expected_impact?.cost_delta) || 0);
const fteDelta = computed(() => Number(props.solution.expected_impact?.fte_delta) || 0);

const costText = computed(() => {
    if (costDelta.value === 0) return '변화 없음';
    return costDelta.value < 0 ? `▼ ${formatKrw(costDelta.value)}` : `▲ ${formatKrw(costDelta.value)}`;
});
const fteText = computed(() => {
    if (fteDelta.value === 0) return '변화 없음';
    const v = Math.abs(fteDelta.value).toFixed(2);
    return fteDelta.value < 0 ? `▼ ${v}` : `▲ ${v}`;
});
const costClass = computed(() => (costDelta.value < 0 ? 'metric--good' : costDelta.value > 0 ? 'metric--bad' : ''));
const fteClass = computed(() => (fteDelta.value < 0 ? 'metric--good' : fteDelta.value > 0 ? 'metric--bad' : ''));
</script>

<style scoped>
.solution-card {
    position: relative;
    display: flex;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.solution-card:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
}
.solution-card--selected {
    border-color: rgb(var(--v-theme-success));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-success), 0.25);
}
.solution-card__bar {
    width: 4px;
    flex: 0 0 4px;
}
.solution-card__body {
    flex: 1 1 auto;
    padding: 10px 12px;
    min-width: 0;
}
.solution-card__head {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
}
.solution-card__type {
    font-size: 12px;
    font-weight: 700;
}
.solution-card__title {
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.35;
    color: rgba(0, 0, 0, 0.85);
}
.solution-card__desc {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 3px;
    line-height: 1.4;
}
.solution-card__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    margin-top: 8px;
}
.metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.metric__label {
    font-size: 10px;
    color: rgba(0, 0, 0, 0.45);
}
.metric__value {
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.75);
}
.metric--good .metric__value {
    color: rgb(var(--v-theme-success));
}
.metric--bad .metric__value {
    color: rgb(var(--v-theme-error));
}
.solution-card__proscons {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.pc {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 11.5px;
    line-height: 1.4;
}
.pc--pro {
    color: rgba(0, 0, 0, 0.7);
}
.pc--con {
    color: rgba(0, 0, 0, 0.7);
}
.solution-card__actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 10px;
}
</style>

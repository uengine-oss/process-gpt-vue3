<template>
    <v-dialog :model-value="modelValue" max-width="1100" scrollable @update:model-value="emit('update:modelValue', $event)">
        <v-card rounded="lg" class="an-dialog">
            <v-card-title class="an-dialog__title">
                <v-icon color="indigo" size="20" class="mr-2">mdi-layers-triple-outline</v-icon>
                <span>Transformation Roadmap</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="emit('update:modelValue', false)">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="an-dialog__body">
                <div v-if="hasRoadmap" class="roadmap-stage">
                    <div class="roadmap-card">
                        <div class="roadmap-card__head">
                            <v-icon size="18" color="indigo">mdi-layers-triple-outline</v-icon>
                            <span>AI Generated Transformation Roadmap</span>
                        </div>
                        <div class="rm-grid" :style="({ '--qn': quarters.length } as any)">
                            <div class="rm-row rm-row--head">
                                <div class="rm-corner">Initiatives</div>
                                <div v-for="q in quarters" :key="q" class="rm-qhead">{{ q }}</div>
                            </div>
                            <div v-for="(init, i) in initiatives" :key="init.id || i" class="rm-row">
                                <div class="rm-label">
                                    <span class="rm-dot" :style="{ background: BAR_COLORS[i % BAR_COLORS.length] }" />
                                    <span class="rm-label__text">{{ init.name }}</span>
                                </div>
                                <div class="rm-track" :style="{ gridColumn: `2 / span ${quarters.length}` }">
                                    <span v-for="q in quarters" :key="q" class="rm-cell" />
                                </div>
                                <div class="rm-bar" :style="barStyle(init.start_index, init.span, i)">
                                    {{ init.label || 'Implement' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Legacy fallback for AN Studio screens. ProcessHierarchy Copilot passes roadmap directly. -->
                <RoadmapStage v-else />
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
/**
 * AnRoadmapDialog — 순서도(To-Be 모드)에서 챗 명령으로 생성한
 * 분기 기반 전환 로드맵(Gantt)을 보여주는 경량 다이얼로그.
 */
import { computed } from 'vue';
import RoadmapStage from '@/views/an-transformation-studio/stages/RoadmapStage.vue';

const props = defineProps<{ modelValue: boolean; roadmap?: any }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const BAR_COLORS = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];
const quarters = computed(() => (Array.isArray(props.roadmap?.quarters) ? props.roadmap.quarters : []));
const initiatives = computed(() => (Array.isArray(props.roadmap?.initiatives) ? props.roadmap.initiatives : []));
const hasRoadmap = computed(() => quarters.value.length > 0 && initiatives.value.length > 0);

function barStyle(start: number, span: number, idx: number) {
    return {
        gridColumn: `${2 + Math.max(0, Number(start) || 0)} / span ${Math.max(1, Number(span) || 1)}`,
        background: BAR_COLORS[idx % BAR_COLORS.length]
    };
}
</script>

<style scoped>
.an-dialog__title {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 700;
    padding: 10px 16px;
}
.an-dialog__body {
    padding: 0;
    background: #f7f7fb;
    max-height: calc(92vh - 64px);
}
.roadmap-stage {
    padding: 18px;
}
.roadmap-card {
    background: #fff;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    padding: 18px 20px;
}
.roadmap-card__head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 700;
    color: #2f3650;
    margin-bottom: 16px;
}
.rm-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.rm-row {
    display: grid;
    grid-template-columns: 200px repeat(var(--qn), 1fr);
    align-items: center;
    column-gap: 0;
    position: relative;
}
.rm-corner,
.rm-qhead {
    font-size: 0.74rem;
    font-weight: 700;
    color: #6b7488;
}
.rm-qhead {
    color: #97a0b5;
    padding-left: 12px;
}
.rm-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 12px;
    min-width: 0;
}
.rm-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: 0 0 auto;
}
.rm-label__text {
    font-size: 0.78rem;
    color: #3a4255;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.rm-track {
    grid-row: 1;
    display: grid;
    grid-template-columns: repeat(var(--qn), 1fr);
    height: 30px;
    background: #f4f6fb;
    border-radius: 16px;
    overflow: hidden;
}
.rm-cell {
    border-right: 1px solid #e9edf5;
}
.rm-cell:last-child {
    border-right: none;
}
.rm-bar {
    grid-row: 1;
    height: 30px;
    margin: 0 3px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
    z-index: 2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 8px;
}
</style>

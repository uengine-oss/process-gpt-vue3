<script setup lang="ts">
/** 4. Roadmap Generation — 분기 기반 자동화 전환 로드맵 (Gantt). */
import { computed, inject } from 'vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';

const an = inject(AN_STUDIO_KEY)!;

const busy = computed(() => an.busyStage.value === 'roadmap');
const hasRoadmap = computed(() => !!an.roadmap.value);
const quarters = computed(() => an.roadmap.value?.quarters || []);
const initiatives = computed(() => an.roadmap.value?.initiatives || []);

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#7c3aed', '#4f46e5', '#9333ea'];

function barStyle(start: number, span: number, idx: number) {
    return {
        gridColumn: `${2 + Math.max(0, start)} / span ${Math.max(1, span)}`,
        background: `linear-gradient(135deg, ${BAR_COLORS[idx % BAR_COLORS.length]} 0%, #8b5cf6 100%)`
    };
}

async function generate() {
    await an.runRoadmap().catch(() => undefined);
}
</script>

<template>
    <div class="stage">
        <div class="stage__topbar">
            <v-chip color="indigo" variant="tonal" size="small">
                <v-icon start size="15">mdi-layers-triple-outline</v-icon>AI Generated Transformation Roadmap
            </v-chip>
            <v-spacer />
            <v-btn v-if="hasRoadmap" size="small" variant="text" color="indigo" :loading="busy" prepend-icon="mdi-refresh" @click="generate"
                >재생성</v-btn
            >
        </div>

        <div v-if="!hasRoadmap" class="stage__cta">
            <v-icon size="44" color="indigo-lighten-2">mdi-map-marker-path</v-icon>
            <div class="text-subtitle-2 font-weight-bold mt-2">AI 전환 로드맵 생성</div>
            <div class="text-caption text-medium-emphasis mb-3" style="max-width: 460px">
                To-Be 블록과 솔루션 적용 기간을 기반으로 분기별 자동화 전환 로드맵(이니셔티브)을 자동 생성합니다.
            </div>
            <v-btn color="indigo" variant="flat" :loading="busy" prepend-icon="mdi-auto-fix" @click="generate">AI 로드맵 생성 실행</v-btn>
        </div>

        <div v-else class="roadmap-card">
            <div class="roadmap-card__head">
                <v-icon size="18" color="indigo">mdi-layers-triple-outline</v-icon>
                <span>AI Generated Transformation Roadmap</span>
            </div>

            <div class="rm-grid" :style="({ '--qn': quarters.length } as any)">
                <!-- header -->
                <div class="rm-row rm-row--head">
                    <div class="rm-corner">Initiatives</div>
                    <div v-for="q in quarters" :key="q" class="rm-qhead">{{ q }}</div>
                </div>
                <!-- rows -->
                <div v-for="(init, i) in initiatives" :key="init.id" class="rm-row">
                    <div class="rm-label">
                        <span class="rm-dot" :style="{ background: BAR_COLORS[i % BAR_COLORS.length] }" />
                        <span class="rm-label__text">{{ init.name }}</span>
                    </div>
                    <!-- background track -->
                    <div class="rm-track" :style="{ gridColumn: `2 / span ${quarters.length}` }">
                        <span v-for="q in quarters" :key="q" class="rm-cell" />
                    </div>
                    <!-- bar -->
                    <div class="rm-bar" :style="barStyle(init.start_index, init.span, i)">
                        {{ init.label || 'Implement' }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.stage {
    min-height: 100%;
    padding: 14px 18px 24px;
    display: flex;
    flex-direction: column;
}
.stage__topbar {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}
.stage__cta {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px dashed #d3d9e5;
    border-radius: 14px;
    background: #fafbff;
    padding: 36px;
    min-height: 320px;
}
.roadmap-card {
    background: #fff;
    border: 1px solid #e7eaf3;
    border-radius: 14px;
    padding: 18px 20px;
    max-width: 1100px;
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
.rm-row--head {
    margin-bottom: 2px;
}
.rm-corner {
    font-size: 0.78rem;
    font-weight: 700;
    color: #6b7488;
}
.rm-qhead {
    font-size: 0.74rem;
    font-weight: 600;
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

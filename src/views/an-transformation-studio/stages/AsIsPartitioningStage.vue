<script setup lang="ts">
/** 1. As-Is Partitioning — 읽기전용 As-Is 토폴로지 + AI 블록 파티셔닝 드래프트. */
import { computed, inject, ref } from 'vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';
import AnPartitionCanvas from '../components/AnPartitionCanvas.vue';

const an = inject(AN_STUDIO_KEY)!;
const { asIsXml, partitions, selectedBlockId } = an;

/** 스튜디오 셸 밖(순서도 To-Be Dialog 등)에 임베드될 때 true — 단계 이동을 노출하지 않는다. */
const props = defineProps<{ embedded?: boolean }>();

const partitioning = computed(() => an.busyStage.value === 'partition');
const hasParts = computed(() => (an.partitions.value || []).length > 0);

/* 토폴로지 캔버스 높이 드래그 조절 (bpmn 팔레트가 들어갈 만큼 기본값 확보) */
const topoHeight = ref(440);
function startTopoResize(e: MouseEvent) {
    const startY = e.clientY;
    const startH = topoHeight.value;
    const maxH = Math.max(320, Math.round(window.innerHeight * 0.75));
    const move = (ev: MouseEvent) => {
        topoHeight.value = Math.min(maxH, Math.max(240, startH + (ev.clientY - startY)));
    };
    const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
}

async function partition() {
    await an.runPartition().catch(() => undefined);
}
function confirm() {
    an.confirmPartitions();
    if (!props.embedded) an.nextStage();
}
</script>

<template>
    <div class="stage stage--partition">
        <!-- As-Is Topology + eTOM Block 그룹 (편집 가능) -->
        <section class="topo">
            <div class="stage__bar">
                <v-icon size="16" color="indigo">mdi-vector-rectangle</v-icon>
                <span>As-Is Topology · eTOM Block 그룹</span>
                <span v-if="hasParts" class="stage__bar-hint">— 박스를 드래그·리사이즈해 그룹 범위를 조정할 수 있습니다</span>
            </div>
            <div class="topo__canvas" :style="{ height: topoHeight + 'px' }">
                <AnPartitionCanvas
                    v-if="asIsXml"
                    :key="asIsXml.length"
                    :bpmn="asIsXml"
                    :partitions="partitions"
                    :selected-id="selectedBlockId"
                    @select="an.selectBlock($event)"
                    @membership-changed="an.applyMembership($event)"
                />
                <div v-else class="stage__empty">
                    <v-icon size="40" color="grey-lighten-1">mdi-sitemap-outline</v-icon>
                    <div class="text-caption mt-2">As-Is BPMN 도면이 없습니다.</div>
                </div>
            </div>
            <div class="topo__resize" title="드래그하여 캔버스 높이 조절" @mousedown.prevent="startTopoResize">
                <v-icon size="14" color="grey-lighten-1">mdi-drag-horizontal-variant</v-icon>
            </div>
        </section>

        <!-- AI Block Partitioning Draft -->
        <section class="draft">
            <div class="draft__head">
                <v-chip color="indigo" variant="tonal" size="small">
                    <v-icon start size="15">mdi-creation-outline</v-icon>AI Block Partitioning Draft
                </v-chip>
                <v-spacer />
                <v-btn
                    v-if="hasParts"
                    size="small"
                    variant="text"
                    color="indigo"
                    :loading="partitioning"
                    prepend-icon="mdi-refresh"
                    @click="partition"
                >
                    재분할
                </v-btn>
            </div>

            <!-- 블록 없음 → 실행 CTA -->
            <div v-if="!hasParts" class="draft__cta">
                <v-icon size="44" color="indigo-lighten-2">mdi-auto-fix</v-icon>
                <div class="text-subtitle-2 font-weight-bold mt-2">AI 블록 파티셔닝</div>
                <div class="text-caption text-medium-emphasis mb-3" style="max-width: 420px">
                    현행 수동 시나리오를 eTOM L3 기준 논리 Block 단위로 나누고, 관련 시스템 API 후보를 함께 제안합니다.
                </div>
                <v-btn color="indigo" variant="flat" :loading="partitioning" prepend-icon="mdi-auto-fix" @click="partition">
                    AI 블록 파티셔닝 실행
                </v-btn>
            </div>

            <!-- 블록 카드 -->
            <template v-else>
                <div class="blocks">
                    <div
                        v-for="block in partitions"
                        :key="block.id"
                        class="block"
                        :class="{ 'block--active': selectedBlockId === block.id }"
                        @click="an.selectBlock(block.id)"
                    >
                        <div class="block__title">
                            {{ block.name }}
                            <span v-if="block.name_en" class="block__title-en">({{ block.name_en }})</span>
                        </div>
                        <div class="block__node block__node--start"><span class="dot dot--start" /></div>
                        <div v-for="task in block.tasks" :key="task.id" class="task-card">
                            <v-icon size="14" color="indigo-lighten-1" class="task-card__icon">mdi-pulse</v-icon>
                            <span class="task-card__name">{{ task.name }}</span>
                            <v-chip size="x-small" variant="outlined" color="grey" class="task-card__tmf">{{
                                task.tmf || 'TMF XXX'
                            }}</v-chip>
                        </div>
                        <div class="block__node"><span class="dot dot--end" /></div>
                    </div>
                </div>

                <div class="draft__confirm">
                    <v-btn color="success" variant="flat" size="large" prepend-icon="mdi-check-circle-outline" @click="confirm">
                        {{ embedded ? 'Block 확정' : 'Block 확정 및 진단 넘어가기' }}
                    </v-btn>
                </div>
            </template>
        </section>
    </div>
</template>

<style scoped>
.stage {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 14px 18px 24px;
    gap: 14px;
}
.stage__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #5b6478;
    padding: 4px 2px 8px;
}
.stage__bar-hint {
    font-weight: 500;
    font-size: 0.74rem;
    color: #97a0b5;
}
.stage__empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #9aa3b6;
}

/* topology */
.topo {
    flex: 0 0 auto;
}
.topo__canvas {
    background: #ffffff;
    border: 1px solid #e7eaf3;
    border-radius: 12px;
    overflow: hidden;
}
.topo__resize {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 14px;
    margin-top: 2px;
    cursor: row-resize;
    border-radius: 7px;
    transition: background 0.15s ease;
}
.topo__resize:hover {
    background: #eef0fe;
}
.topo__canvas :deep(.bjs-container),
.topo__canvas :deep(.djs-container) {
    height: 100% !important;
}

/* draft */
.draft {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
}
.draft__head {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}
.draft__cta {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px dashed #d3d9e5;
    border-radius: 14px;
    background: #fafbff;
    padding: 32px;
    min-height: 260px;
}
.blocks {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
}
.block {
    flex: 1 1 240px;
    min-width: 240px;
    max-width: 360px;
    border: 1px dashed #c9d0e3;
    border-radius: 14px;
    background: #fafbff;
    padding: 14px 14px 18px;
    cursor: pointer;
    transition: all 0.16s ease;
}
.block:hover {
    border-color: #a9b3f0;
    background: #f6f7ff;
}
.block--active {
    border-color: #6366f1;
    border-style: solid;
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.16);
    background: #fff;
}
.block__title {
    text-align: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: #2f3650;
    margin-bottom: 10px;
}
.block__title-en {
    color: #97a0b5;
    font-weight: 500;
    font-size: 0.78rem;
}
.block__node {
    display: flex;
    justify-content: center;
    padding: 6px 0;
}
.dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
}
.dot--start {
    background: #fff;
    border: 3px solid #22c55e;
}
.dot--end {
    background: #fff;
    border: 3px solid #b8c0d4;
}
.task-card {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    border: 1px solid #e7eaf3;
    border-left: 3px solid #8b5cf6;
    border-radius: 9px;
    padding: 9px 10px;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(40, 50, 90, 0.05);
}
.task-card__name {
    flex: 1 1 auto;
    font-size: 0.78rem;
    color: #3a4255;
    line-height: 1.25;
}
.draft__confirm {
    display: flex;
    justify-content: center;
    margin-top: 22px;
}
</style>

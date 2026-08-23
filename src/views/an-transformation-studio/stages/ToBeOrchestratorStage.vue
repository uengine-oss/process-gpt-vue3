<script setup lang="ts">
/** 3. To-Be Orchestrator — Master Orchestrator 스윔레인 + ROI + Skill Shift + 블록 상세. */
import { ref, computed, inject } from 'vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';
import RoiWidget from '../components/RoiWidget.vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';

const an = inject(AN_STUDIO_KEY)!;
const { orchestrator } = an;

/** 스튜디오 셸 밖(순서도 경량 다이얼로그 등)에 임베드될 때 true — 단계 이동을 노출하지 않는다. */
defineProps<{ embedded?: boolean }>();
const studio = an.studio;
const { hasBlueprint, blueprintXml } = studio;

const busy = computed(() => an.busyStage.value === 'orchestrator');
const hasOrch = computed(() => !!an.orchestrator.value);
const blocks = computed(() => an.orchestrator.value?.blocks || []);
const skillItems = computed(() => an.skillShift.value?.items || []);

const showBpmn = ref(false);

async function design() {
    await an.runOrchestrator().catch(() => undefined);
}
async function genBpmn() {
    await an.generateToBeBpmn().catch(() => undefined);
    showBpmn.value = true;
}
</script>

<template>
    <div class="stage">
        <div class="stage__topbar">
            <v-chip color="indigo" variant="tonal" size="small">
                <v-icon start size="15">mdi-sitemap-outline</v-icon>To-Be Master Orchestrator
            </v-chip>
            <v-spacer />
            <template v-if="hasOrch">
                <v-btn
                    size="small"
                    variant="outlined"
                    color="indigo"
                    :loading="busy"
                    prepend-icon="mdi-file-tree-outline"
                    class="mr-2"
                    @click="genBpmn"
                >
                    To-Be 도면 생성
                </v-btn>
                <v-btn size="small" variant="text" color="indigo" :loading="busy" prepend-icon="mdi-refresh" @click="design">재설계</v-btn>
            </template>
        </div>

        <!-- no orchestrator → CTA -->
        <div v-if="!hasOrch" class="stage__cta">
            <v-icon size="44" color="indigo-lighten-2">mdi-robot-industrial-outline</v-icon>
            <div class="text-subtitle-2 font-weight-bold mt-2">AI To-Be 오케스트레이터 설계</div>
            <div class="text-caption text-medium-emphasis mb-3" style="max-width: 480px">
                확정된 Block별로 DT/AI 기술을 접목한 To-Be 모델을 설계하고, 전체 흐름을 제어하는 Master Orchestrator 를 생성합니다.
            </div>
            <v-btn color="indigo" variant="flat" :loading="busy" prepend-icon="mdi-auto-fix" @click="design">AI To-Be 설계 실행</v-btn>
        </div>

        <template v-else>
            <!-- Swimlane -->
            <div class="swimlane">
                <div class="lane lane--master">
                    <div class="lane__label">MASTER ORCHESTRATOR</div>
                    <div class="lane__content master-row">
                        <span class="start-dot" />
                        <span class="arrow" />
                        <div class="gateway">
                            <v-icon size="18" color="indigo">mdi-transit-connection-variant</v-icon>
                            <div>
                                <div class="gateway__name">{{ orchestrator?.gateway?.name }}</div>
                                <div v-if="orchestrator?.gateway?.subtitle" class="gateway__sub">{{ orchestrator?.gateway?.subtitle }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bus" />
                <div class="lane lane--sub">
                    <div class="lane__label">SUB-DOMAINS</div>
                    <div class="lane__content sub-row">
                        <div v-for="b in blocks" :key="b.name" class="sub-block">
                            <v-icon size="18" color="indigo-lighten-1">mdi-database-outline</v-icon>
                            <div class="sub-block__name">{{ b.name }}</div>
                            <v-chip size="x-small" variant="tonal" color="teal">{{ b.tmf || 'TMF XXX' }}</v-chip>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ROI + Skill Shift -->
            <div class="value-row">
                <div class="value-row__roi">
                    <RoiWidget />
                </div>
                <div class="value-row__skill">
                    <div class="section-title"><v-icon size="16" color="deep-purple">mdi-sync</v-icon> HR 역량 전환 (Skill Shift)</div>
                    <div v-if="!skillItems.length" class="text-caption text-medium-emphasis pa-3">설계 후 역량 전환 예측이 표시됩니다.</div>
                    <div v-for="(s, i) in skillItems" :key="i" class="skill-card">
                        <div class="skill-card__head">
                            <span class="skill-card__block">{{ s.partition_name || '전체' }}</span>
                            <v-chip v-if="s.reskill_count" size="x-small" color="deep-purple" variant="tonal"
                                >재교육 {{ s.reskill_count }}명</v-chip
                            >
                        </div>
                        <div class="skill-card__delta">
                            <span class="skill-card__as">{{ s.as_is }}</span>
                            <v-icon size="14" color="deep-purple">mdi-arrow-right</v-icon>
                            <span class="skill-card__to">{{ s.to_be }}</span>
                        </div>
                        <div v-if="s.insight" class="skill-card__insight">"{{ s.insight }}"</div>
                    </div>
                </div>
            </div>

            <!-- Block detail view -->
            <div class="detail">
                <div class="section-title">
                    <v-icon size="16" color="grey-darken-1">mdi-layers-outline</v-icon> To-Be Block Detail View
                    <v-spacer />
                    <v-btn v-if="hasBlueprint" size="x-small" variant="text" color="indigo" @click="showBpmn = !showBpmn">
                        {{ showBpmn ? '카드 보기' : '도면 보기' }}
                    </v-btn>
                </div>

                <div v-if="showBpmn && hasBlueprint" class="detail__bpmn">
                    <BpmnUengineViewer :bpmn="blueprintXml" :key="(blueprintXml || '').length" />
                </div>

                <div v-else class="detail__cards">
                    <div v-for="b in blocks" :key="b.name" class="detail-card">
                        <div class="detail-card__title">{{ b.name }}</div>
                        <div class="detail-card__flow">
                            <span class="start-dot start-dot--sm" />
                            <template v-for="(step, si) in b.to_be_steps" :key="si">
                                <span class="arrow arrow--sm" />
                                <div class="step-chip" :class="{ 'step-chip--auto': step.automated }">
                                    <v-icon v-if="step.automated" size="12" color="amber-darken-2">mdi-flash</v-icon>
                                    <span>{{ step.name }}</span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="!embedded" class="stage__confirm">
                <v-btn color="success" variant="flat" size="large" prepend-icon="mdi-arrow-right-circle-outline" @click="an.nextStage()">
                    로드맵 생성으로
                </v-btn>
            </div>
        </template>
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

/* swimlane */
.swimlane {
    background: #fff;
    border: 1px solid #e7eaf3;
    border-radius: 14px;
    padding: 12px 16px 18px;
    margin-bottom: 16px;
}
.lane {
    display: flex;
    align-items: center;
    gap: 14px;
}
.lane__label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #97a0b5;
    flex: 0 0 auto;
    padding: 6px 0;
}
.lane__content {
    flex: 1 1 auto;
}
.master-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 0;
}
.start-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid #b8c0d4;
    background: #fff;
    flex: 0 0 auto;
}
.start-dot--sm {
    width: 14px;
    height: 14px;
    border-color: #22c55e;
}
.arrow {
    width: 28px;
    height: 2px;
    background: #c9d0e3;
    position: relative;
    flex: 0 0 auto;
}
.arrow::after {
    content: '';
    position: absolute;
    right: -1px;
    top: -3px;
    border-left: 6px solid #c9d0e3;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
}
.arrow--sm {
    width: 18px;
}
.gateway {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1.5px solid #6366f1;
    background: #f6f7ff;
    border-radius: 12px;
    padding: 10px 16px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
}
.gateway__name {
    font-size: 0.85rem;
    font-weight: 700;
    color: #4338ca;
}
.gateway__sub {
    font-size: 0.68rem;
    color: #8a93a6;
}
.bus {
    border-top: 2px dashed #c9d0e3;
    margin: 4px 0 4px 34px;
}
.sub-row {
    display: flex;
    gap: 14px;
    padding-top: 10px;
}
.sub-block {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    border: 1px solid #e2e6f0;
    border-radius: 11px;
    background: #fff;
    padding: 12px 10px;
    position: relative;
}
.sub-block::before {
    content: '';
    position: absolute;
    top: -12px;
    left: 50%;
    width: 0;
    height: 12px;
    border-left: 2px dashed #c9d0e3;
}
.sub-block__name {
    font-size: 0.78rem;
    font-weight: 600;
    color: #3a4255;
    line-height: 1.25;
}

/* value row */
.value-row {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 16px;
    margin-bottom: 16px;
}
.section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    color: #3a4255;
    margin-bottom: 10px;
}
.value-row__skill {
    min-width: 0;
}
.skill-card {
    border: 1px solid #ece8fb;
    background: #faf9ff;
    border-radius: 10px;
    padding: 9px 11px;
    margin-bottom: 8px;
}
.skill-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
}
.skill-card__block {
    font-size: 0.76rem;
    font-weight: 700;
    color: #6d28d9;
}
.skill-card__delta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.74rem;
}
.skill-card__as {
    color: #8a93a6;
    text-decoration: line-through;
    flex: 1 1 0;
}
.skill-card__to {
    color: #3a4255;
    font-weight: 600;
    flex: 1 1 0;
}
.skill-card__insight {
    font-size: 0.7rem;
    color: #7c7596;
    font-style: italic;
    margin-top: 5px;
}

/* detail */
.detail {
    background: #fff;
    border: 1px solid #e7eaf3;
    border-radius: 14px;
    padding: 14px 16px;
}
.detail__bpmn {
    height: 360px;
    border: 1px solid #eef1f7;
    border-radius: 10px;
    overflow: hidden;
}
.detail__bpmn :deep(.bjs-container),
.detail__bpmn :deep(.djs-container) {
    height: 100% !important;
}
.detail__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
}
.detail-card {
    border: 1px solid #eef1f7;
    border-radius: 11px;
    padding: 12px;
    background: #fafbff;
}
.detail-card__title {
    font-size: 0.8rem;
    font-weight: 700;
    color: #2f3650;
    margin-bottom: 10px;
}
.detail-card__flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
}
.step-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    background: #fff;
    border: 1px solid #e2e6f0;
    border-radius: 8px;
    padding: 5px 8px;
    color: #3a4255;
}
.step-chip--auto {
    border-color: #fde68a;
    background: #fffbeb;
}
.stage__confirm {
    display: flex;
    justify-content: center;
    margin-top: 24px;
}
</style>

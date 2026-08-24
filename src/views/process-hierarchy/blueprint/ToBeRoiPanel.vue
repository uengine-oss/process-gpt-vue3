<template>
    <div class="roi-panel">
        <div class="roi-panel__header">
            <div class="roi-panel__title">
                <v-icon size="18" color="success" class="mr-1">mdi-chart-line-variant</v-icon>
                누적 예상 ROI
            </div>
            <v-chip size="x-small" variant="tonal" :color="selectedCount ? 'success' : 'grey'"> 솔루션 {{ selectedCount }}건 반영 </v-chip>
        </div>

        <div class="roi-panel__body">
            <!-- 총 절감 효과 -->
            <div class="roi-hero" :class="{ 'roi-hero--active': totalSavingsKrw > 0 }">
                <div class="roi-hero__label">예상 연간 총 절감 효과</div>
                <div class="roi-hero__value">
                    <AnimatedNumber :value="totalSavingsKrw" format="korean" :duration="800" suffix="원" />
                </div>
                <div class="roi-hero__sub">FTE 절감을 인건비로 환산 포함 · 단가 {{ ratePerFteText }}/FTE</div>
            </div>

            <!-- 비용 / FTE 절감 -->
            <div class="roi-tiles">
                <div class="roi-tile roi-tile--cost">
                    <div class="roi-tile__icon"><v-icon color="indigo">mdi-cash-multiple</v-icon></div>
                    <div class="roi-tile__label">비용 절감 (연)</div>
                    <div class="roi-tile__value">
                        <AnimatedNumber :value="savings.cost" format="korean" suffix="원" />
                    </div>
                    <div class="roi-tile__delta">
                        As-Is <AnimatedNumber :value="baseline.cost" format="korean" suffix="원" :duration="500" /> → To-Be
                        <AnimatedNumber :value="cumulative.cost" format="korean" suffix="원" />
                    </div>
                </div>
                <div class="roi-tile roi-tile--fte">
                    <div class="roi-tile__icon"><v-icon color="deep-purple">mdi-account-group-outline</v-icon></div>
                    <div class="roi-tile__label">인력 절감 (FTE)</div>
                    <div class="roi-tile__value">
                        <AnimatedNumber :value="savings.fte" :decimals="2" format="plain" suffix=" FTE" />
                    </div>
                    <div class="roi-tile__delta">
                        As-Is <AnimatedNumber :value="baseline.fte" :decimals="2" format="plain" :duration="500" /> → To-Be
                        <AnimatedNumber :value="cumulative.fte" :decimals="2" format="plain" />
                    </div>
                </div>
            </div>

            <!-- 절감률 -->
            <div v-if="baseline.cost > 0" class="roi-rate">
                <div class="roi-rate__head">
                    <span>비용 절감률</span>
                    <span class="roi-rate__pct"><AnimatedNumber :value="savingsRatePct" :decimals="1" format="plain" suffix="%" /></span>
                </div>
                <div class="roi-rate__bar">
                    <div class="roi-rate__fill" :style="{ width: Math.min(100, Math.max(0, savingsRatePct)) + '%' }"></div>
                </div>
            </div>

            <!-- 기여 솔루션 -->
            <div class="roi-section">
                <div class="roi-section__title">반영된 솔루션 ({{ contributions.length }})</div>
                <div v-if="!contributions.length" class="roi-section__empty">
                    이슈별 솔루션을 선택하면 누적 ROI가 실시간으로 반영됩니다.
                </div>
                <transition-group v-else name="roi-list" tag="div" class="roi-contribs">
                    <div v-for="c in contributions" :key="c.solutionId" class="roi-contrib">
                        <div class="roi-contrib__top">
                            <v-chip size="x-small" variant="tonal" :color="c.color">{{ c.solutionTypeLabel }}</v-chip>
                            <span class="roi-contrib__title">{{ c.solutionTitle }}</span>
                        </div>
                        <div class="roi-contrib__nums">
                            <span :class="c.cost_delta <= 0 ? 'good' : 'bad'">{{ formatKrw(-c.cost_delta) }}</span>
                            <span class="dot">·</span>
                            <span :class="c.fte_delta <= 0 ? 'good' : 'bad'">{{ (-c.fte_delta).toFixed(2) }} FTE</span>
                        </div>
                        <div class="roi-contrib__issue">{{ c.issueTitle }}</div>
                    </div>
                </transition-group>
            </div>

            <!-- 단가 설정 -->
            <div class="roi-section">
                <div class="roi-section__title">ROI 설정</div>
                <v-text-field
                    :model-value="annualCostPerFte"
                    @update:model-value="onRateInput"
                    type="number"
                    label="연간 인건비 단가 (원/FTE)"
                    density="compact"
                    variant="outlined"
                    hide-details
                    prepend-inner-icon="mdi-currency-krw"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { toRef, computed } from 'vue';
import AnimatedNumber from '@/components/common/AnimatedNumber.vue';
import { useToBeRoi } from '@/composables/blueprint/useToBeRoi';
import type { ToBeIssue, ToBeRoiConfig } from '@/composables/blueprint/blueprintModel';

const props = defineProps<{
    issues: ToBeIssue[];
    roi: ToBeRoiConfig;
}>();

const emit = defineEmits<{ (e: 'update-rate', value: number): void }>();

const { annualCostPerFte, baseline, savings, cumulative, totalSavingsKrw, savingsRatePct, selectedCount, contributions } = useToBeRoi({
    issues: toRef(props, 'issues'),
    roi: toRef(props, 'roi')
});

function formatKrw(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억원`;
    if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
    return `${sign}${abs.toLocaleString()}원`;
}

const ratePerFteText = computed(() => formatKrw(annualCostPerFte.value));

function onRateInput(val: any) {
    const num = Number(val);
    if (!isNaN(num) && num >= 0) emit('update-rate', num);
}
</script>

<style scoped>
.roi-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fafafb;
    border-left: 1px solid rgba(0, 0, 0, 0.08);
}
.roi-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
}
.roi-panel__title {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
}
.roi-panel__body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 12px;
}
.roi-hero {
    text-align: center;
    padding: 18px 12px;
    border-radius: 14px;
    background: linear-gradient(135deg, #eef2ff 0%, #e6fffb 100%);
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: box-shadow 0.3s ease;
}
.roi-hero--active {
    box-shadow: 0 6px 22px rgba(16, 185, 129, 0.18);
}
.roi-hero__label {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
}
.roi-hero__value {
    font-size: 30px;
    font-weight: 800;
    color: rgb(var(--v-theme-success));
    line-height: 1.2;
    margin: 4px 0;
}
.roi-hero__sub {
    font-size: 10.5px;
    color: rgba(0, 0, 0, 0.45);
}
.roi-tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
}
.roi-tile {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 12px;
    padding: 12px 10px;
    text-align: center;
}
.roi-tile__icon {
    margin-bottom: 4px;
}
.roi-tile__label {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
}
.roi-tile__value {
    font-size: 17px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.85);
    margin-top: 2px;
}
.roi-tile__delta {
    font-size: 9.5px;
    color: rgba(0, 0, 0, 0.4);
    margin-top: 6px;
    line-height: 1.4;
}
.roi-rate {
    margin-top: 14px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 12px;
    padding: 12px;
}
.roi-rate__head {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 8px;
}
.roi-rate__pct {
    font-weight: 800;
    color: rgb(var(--v-theme-success));
}
.roi-rate__bar {
    height: 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.06);
    overflow: hidden;
}
.roi-rate__fill {
    height: 100%;
    border-radius: 6px;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.roi-section {
    margin-top: 16px;
}
.roi-section__title {
    font-size: 11.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.55);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
}
.roi-section__empty {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.4);
    padding: 8px 0;
    line-height: 1.5;
}
.roi-contribs {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.roi-contrib {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 10px;
    padding: 9px 10px;
}
.roi-contrib__top {
    display: flex;
    align-items: center;
    gap: 6px;
}
.roi-contrib__title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.roi-contrib__nums {
    font-size: 12.5px;
    font-weight: 700;
    margin-top: 4px;
}
.roi-contrib__nums .good {
    color: rgb(var(--v-theme-success));
}
.roi-contrib__nums .bad {
    color: rgb(var(--v-theme-error));
}
.roi-contrib__nums .dot {
    margin: 0 6px;
    color: rgba(0, 0, 0, 0.3);
}
.roi-contrib__issue {
    font-size: 10.5px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* transition-group 애니메이션 */
.roi-list-enter-active,
.roi-list-leave-active {
    transition: all 0.4s ease;
}
.roi-list-enter-from {
    opacity: 0;
    transform: translateY(-8px);
}
.roi-list-leave-to {
    opacity: 0;
    transform: translateX(12px);
}
</style>

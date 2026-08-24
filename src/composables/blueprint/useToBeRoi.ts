/**
 * useToBeRoi — reactive cumulative ROI (cost + FTE) for the Blueprint Studio.
 *
 * Baseline은 As-Is 프로세스 정의(definition.fte)에서 1회 산출하여 tobe.roi.baseline 에
 * 저장하고, 누적값은 *선택된* 솔루션들의 expected_impact 합으로 실시간 계산한다.
 * (요구사항: 옵션 수용 시마다 누적 예상 ROI가 실시간 갱신 — 비용/FTE 모두 포함)
 */
import { computed, type Ref } from 'vue';
import { type ToBeIssue, type ToBeRoiConfig, sumSelectedImpact, totalSavings, solutionTypeMeta } from './blueprintModel';

const ANNUAL_WORKING_HOURS = 2080; // 52주 × 40시간 (ProcessHierarchyProperties와 동일)

/** ProcessHierarchyProperties.vue 의 calcFte 와 동일한 FTE 산식. */
export function calcFteValue(fte: any): number {
    if (!fte || typeof fte !== 'object') return 0;
    if (fte.inputMode === 'direct') {
        return (Number(fte.directPercent) || 0) / 100;
    }
    const time = Number(fte.timePerTask) || 0;
    const count = Number(fte.freqCount) || 0;
    const head = Number(fte.headcount) || 1;
    let annualFreq = count;
    switch (fte.freqCycle) {
        case 'Monthly':
            annualFreq = count * 12;
            break;
        case 'Weekly':
            annualFreq = count * 52;
            break;
        case 'Daily':
            annualFreq = count * 260;
            break;
    }
    const val = (time * annualFreq * head) / ANNUAL_WORKING_HOURS;
    return val > 0 ? val : 0;
}

/**
 * As-Is 정의로부터 baseline {cost, fte} 산출.
 * - FTE: process-level definition.fte → calcFte. 없으면 0.
 * - cost: baseline.fte × annual_cost_per_fte (노무비 환산 proxy).
 */
export function computeBaselineFromDefinition(definition: any, annualCostPerFte: number): { cost: number; fte: number } {
    const fteObj = definition?.fte;
    let fte = calcFteValue(fteObj);
    // direct % 가 0 이지만 fteHoursPerMonth 가 있으면 그것으로 환산
    if (!fte && definition?.fteHoursPerMonth) {
        fte = (Number(definition.fteHoursPerMonth) * 12) / ANNUAL_WORKING_HOURS;
    }
    const cost = fte * (annualCostPerFte || 0);
    return { cost: Math.round(cost), fte: Number(fte.toFixed(3)) };
}

export interface RoiContribution {
    issueId: string;
    issueTitle: string;
    solutionId: string;
    solutionTitle: string;
    solutionType: string;
    solutionTypeLabel: string;
    color: string;
    cost_delta: number;
    fte_delta: number;
}

export function useToBeRoi(opts: { issues: Ref<ToBeIssue[]>; roi: Ref<ToBeRoiConfig> }) {
    const { issues, roi } = opts;

    const annualCostPerFte = computed(() => Number(roi.value?.annual_cost_per_fte) || 0);
    const baseline = computed(() => roi.value?.baseline || { cost: 0, fte: 0 });

    /** 선택된 솔루션 delta 합 (음수 = 절감). */
    const selectedImpact = computed(() => sumSelectedImpact(issues.value || []));

    /** 화면용 절감량 (양수 = 절감). */
    const savings = computed(() => ({
        cost: -(selectedImpact.value.cost || 0),
        fte: -(selectedImpact.value.fte || 0)
    }));

    /** 누적 예상치 = baseline + delta. */
    const cumulative = computed(() => ({
        cost: Math.max(0, (baseline.value.cost || 0) + (selectedImpact.value.cost || 0)),
        fte: Math.max(0, (baseline.value.fte || 0) + (selectedImpact.value.fte || 0))
    }));

    /** FTE 절감까지 비용 환산한 총 절감 효과 (KRW, 양수=절감). */
    const totalSavingsKrw = computed(() => totalSavings(selectedImpact.value, annualCostPerFte.value));

    /** baseline 대비 절감률 (%). */
    const savingsRatePct = computed(() => {
        const base = baseline.value.cost || 0;
        if (base <= 0) return 0;
        return Math.round((savings.value.cost / base) * 1000) / 10;
    });

    const selectedCount = computed(() => selectedImpact.value.count);

    /** 선택된 각 솔루션의 기여도 (누적 기여 차트/리스트용). */
    const contributions = computed<RoiContribution[]>(() => {
        const out: RoiContribution[] = [];
        for (const issue of issues.value || []) {
            if (!issue.selected_solution_id) continue;
            const sol = issue.solutions.find((s) => s.id === issue.selected_solution_id);
            if (!sol) continue;
            const meta = solutionTypeMeta(sol.solution_type);
            out.push({
                issueId: issue.id,
                issueTitle: issue.title,
                solutionId: sol.id,
                solutionTitle: sol.title,
                solutionType: sol.solution_type,
                solutionTypeLabel: meta.label,
                color: meta.color,
                cost_delta: Number(sol.expected_impact?.cost_delta) || 0,
                fte_delta: Number(sol.expected_impact?.fte_delta) || 0
            });
        }
        return out;
    });

    return {
        annualCostPerFte,
        baseline,
        selectedImpact,
        savings,
        cumulative,
        totalSavingsKrw,
        savingsRatePct,
        selectedCount,
        contributions
    };
}

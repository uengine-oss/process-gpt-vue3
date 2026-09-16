/**
 * 병합 전 검증 결과를 "숫자 몇 개" 로 줄여 주는 곳.
 *
 * 검증은 Pass/Fail 한 글자로 끝날 일이 아니다 — 검토자가 병합 직전에 알아야 하는 것은
 * **몇 개 시나리오를 돌렸고, 그중 몇이 통과했고, 변경 전후로 결과가 달라진 것이 무엇인가** 다.
 * 목록 카드·탭 배지·상세 요약이 모두 같은 기준으로 말하도록 계산을 한 곳에 모은다.
 */

import { t } from '@/composables/i18nText';

/** 검증 회차 하나를 사람이 읽는 숫자로 줄인 것. */
export interface PrVerifyStats {
    /** 비교할 시나리오가 있는가. 없으면 검증 자체가 성립하지 않는다. */
    hasSuite: boolean;
    /** null = 아직 한 번도 돌리지 않음 */
    runStatus: string | null;
    /** 전체 시나리오 수 */
    total: number;
    /** 변경 전에도 지금도 통과하는 시나리오 수 (정상 유지) */
    passed: number;
    /** 변경 전에도 실패했고 지금도 실패하는 시나리오 수 (기존 실패 유지) */
    stillFailing: number;
    /** 변경 전에는 통과했는데 이 병합으로 실패하게 된 시나리오 수 (새로운 실패) */
    newlyFailed: number;
    /** 변경 전에는 통과하던 단계가 깨진 건수 */
    broken: number;
    /** 이 변경으로 통과하게 된 단계 수 */
    fixed: number;
    /** 판단할 수 없는(신호 없음 + 비교 불가) 시나리오 수 */
    inconclusive: number;
    backfillStatus: string | null;
}

export const EMPTY_VERIFY_STATS: PrVerifyStats = {
    hasSuite: false,
    runStatus: null,
    total: 0,
    passed: 0,
    stillFailing: 0,
    newlyFailed: 0,
    broken: 0,
    fixed: 0,
    inconclusive: 0,
    backfillStatus: null
};

/** 시나리오 한 건의 변경 전/후 비교 한 줄. */
export interface PrVerifyCaseDiff {
    name: string;
    baseLabel: string;
    headLabel: string;
    /** 통과 단계 수가 줄었는가 — 이쪽이 병합을 막을 이유가 된다. */
    worse: boolean;
    brokenCount: number;
}

function countLabel(value: any): string {
    return value ? `${value.passed}/${value.total}` : '—';
}

/** 검증 조회 응답 한 벌을 숫자로 줄인다. */
export function computeVerifyStats(payload: {
    has_suite?: boolean;
    hasSuite?: boolean;
    cases?: any[];
    run?: any;
    backfill?: any;
}): PrVerifyStats {
    const hasSuite = !!(payload?.has_suite ?? payload?.hasSuite);
    const cases = payload?.cases || [];
    const run = payload?.run || null;
    const summary = run?.summary || {};
    const perCase: Record<string, any> = summary.per_case || {};

    let passed = 0;
    let stillFailing = 0;
    let newlyFailed = 0;

    /*
     * 세 칸이 서로 겹치지 않게 나눈다.
     * "지금 실패한다" 는 사실만으로는 병합을 멈출 이유가 되지 않는다 — 변경 전에도 실패하던
     * 시나리오까지 같이 세면, 이 병합이 실제로 무엇을 망가뜨렸는지가 그 숫자에 묻힌다.
     */
    for (const value of Object.values(perCase)) {
        const head = value?.head;
        const base = value?.base;
        if (!head || !head.total) continue;

        const failsNow = head.passed < head.total;
        const regressed = !!value?.comparable && !!base && (head.passed < base.passed || (value.broken || []).length > 0);

        if (regressed) newlyFailed += 1;
        else if (failsNow) stillFailing += 1;
        else passed += 1;
    }

    return {
        hasSuite,
        runStatus: run?.status || null,
        total: cases.length || Object.keys(perCase).length,
        passed,
        stillFailing,
        newlyFailed,
        broken: (summary.broken || []).length,
        fixed: (summary.fixed || []).length,
        inconclusive: (summary.no_signal || []).length + (summary.incomparable || []).length,
        backfillStatus: payload?.backfill?.status || null
    };
}

/** 변경 전후 결과가 달라진 시나리오만 골라 좌우 비교 한 줄로 만든다. */
export function changedCases(run: any): PrVerifyCaseDiff[] {
    const perCase: Record<string, any> = run?.summary?.per_case || {};
    return (
        Object.entries(perCase)
            .filter(([, v]) => v?.comparable && v.base && v.head && (v.base.passed !== v.head.passed || (v.broken || []).length))
            .map(([name, v]) => ({
                name,
                baseLabel: countLabel(v.base),
                headLabel: countLabel(v.head),
                worse: v.head.passed < v.base.passed || (v.broken || []).length > 0,
                brokenCount: (v.broken || []).length
            }))
            // 나빠진 쪽을 먼저 — 병합을 멈출 이유가 있다면 그것부터 읽혀야 한다.
            .sort((a, b) => Number(b.worse) - Number(a.worse))
    );
}

export type VerifyTone = 'ok' | 'bad' | 'warn' | 'info' | 'idle';

/** 목록 카드·탭에 걸 한 마디. */
export function verifyBadge(stats: PrVerifyStats | null | undefined): { tone: VerifyTone; label: string } | null {
    if (!stats) return null;
    if (stats.backfillStatus === 'running') return { tone: 'info', label: t('pr.verify.badge.preparing') };
    if (!stats.hasSuite) return { tone: 'warn', label: t('pr.verify.badge.noSuite') };
    if (stats.runStatus === 'running') return { tone: 'info', label: t('pr.verify.badge.running') };
    if (stats.runStatus === 'failed') return { tone: 'bad', label: t('pr.verify.badge.failed') };
    if (stats.runStatus !== 'succeeded') return { tone: 'idle', label: t('pr.verify.badge.notRun') };
    if (stats.broken) return { tone: 'bad', label: t('pr.verify.badge.broken', { count: stats.broken }) };
    if (stats.inconclusive) return { tone: 'warn', label: t('pr.verify.badge.inconclusive', { count: stats.inconclusive }) };
    // 숫자는 검증 탭에서 온전히 읽는다. 여기서 `2/3` 같은 조각을 보이면
    // "통과인데 왜 2/3 인가" 를 다시 묻게 만든다.
    return { tone: 'ok', label: t('pr.verify.badge.passed') };
}

/** 이 병합 요청에 병합 전 검증을 걸 수 있는가. (스킬은 깃 PR 번호, 나머지는 요청 id) */
export function canVerifyPr(pr: any): boolean {
    if (!pr || !pr.resource_id) return false;
    const type = pr.resource_type || 'skill';
    if (type === 'skill') return !!pr.git_pr_number;
    return (type === 'bpmn' || type === 'dmn') && !!pr.id;
}

/**
 * 목록에 걸린 요청들의 검증 상태를 채운다.
 *
 * 요청 한 건마다 조회를 한 번 부르므로, 목록을 막지 않도록 동시 실행 수를 묶고
 * 한 건씩 끝나는 대로 흘려보낸다. 실패한 건은 조용히 건너뛴다 —
 * 상태 배지를 못 얻은 것이 목록을 못 쓰게 만들 이유는 없다.
 */
export async function loadPrVerifyStats(
    backend: any,
    prs: any[],
    onStats: (prId: string, stats: PrVerifyStats) => void,
    options: { concurrency?: number; signal?: { aborted: boolean } } = {}
): Promise<void> {
    const concurrency = options.concurrency ?? 4;
    const queue = prs.filter(canVerifyPr);

    const worker = async () => {
        while (queue.length) {
            if (options.signal?.aborted) return;
            const pr = queue.shift();
            if (!pr?.id) continue;
            try {
                const type = pr.resource_type || 'skill';
                const data =
                    type === 'skill'
                        ? await backend.getPrVerification(pr.resource_id, pr.git_pr_number)
                        : await backend.getResourceVerification(type, pr.resource_id, pr.id);
                if (options.signal?.aborted) return;
                if (data) onStats(pr.id, computeVerifyStats(data));
            } catch {
                // 한 건이 실패해도 나머지 배지는 계속 채운다.
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

import type { LocationQueryRaw, Router } from 'vue-router';
import { toSafeText } from '@/utils/safeText';

export const PROCESS_HIERARCHY_ENTRY = Object.freeze({
    DIRECT: 'direct',
    ARCHITECTURE: 'architecture',
    ANALYSIS: 'analysis',
    REVIEW_BOARD: 'review-board'
});

export const PROCESS_HIERARCHY_MODE = Object.freeze({
    EDIT: 'edit',
    VIEW: 'view',
    HISTORY: 'history'
});

export const PROCESS_HIERARCHY_PANEL_STATE = Object.freeze({
    OPEN: 'open',
    CLOSED: 'closed',
    COLLAPSED: 'collapsed',
    EXPANDED: 'expanded'
});

export const PROCESS_HIERARCHY_RIGHT_TAB = Object.freeze({
    PROPERTIES: 'properties',
    GOVERNANCE: 'governance',
    AI_GUIDE: 'ai-guide'
});

interface ProcessHierarchyQueryParams {
    id?: string;
    name?: string;
    entry?: string;
    mode?: string;
    left?: string;
    right?: string;
    rightTab?: string;
    reviewId?: string;
}

function pickString(value: unknown, allowed: string[], fallback: string): string {
    if (typeof value !== 'string') return fallback;
    return allowed.includes(value) ? value : fallback;
}

export function buildProcessHierarchyQuery({ id, name, entry, mode, left, right, rightTab, reviewId }: ProcessHierarchyQueryParams = {}): LocationQueryRaw {
    const query: Record<string, string> = {};
    const safeId = toSafeText(id).trim();
    const safeName = toSafeText(name).trim();
    const safeEntry = toSafeText(entry).trim();
    const safeMode = toSafeText(mode).trim();
    const safeLeft = toSafeText(left).trim();
    const safeRight = toSafeText(right).trim();
    const safeRightTab = toSafeText(rightTab).trim();
    const safeReviewId = toSafeText(reviewId).trim();

    if (safeId) query.id = safeId;
    if (safeName) query.name = safeName;
    if (safeEntry) query.entry = safeEntry;
    if (safeMode) query.mode = safeMode;
    if (safeLeft) query.left = safeLeft;
    if (safeRight) query.right = safeRight;
    if (safeRightTab) query.rightTab = safeRightTab;
    if (safeReviewId) query.reviewId = safeReviewId;

    return query;
}

interface NavigateProcessHierarchyOptions {
    openInNewTab?: boolean;
}

/**
 * Process Hierarchy 라우트로 이동하는 단일 진입점.
 * - 기본: 같은 탭에서 router.push
 * - openInNewTab: true → resolve 후 window.open (새 탭)
 */
export function navigateToProcessHierarchy(
    router: Router,
    params: ProcessHierarchyQueryParams = {},
    options: NavigateProcessHierarchyOptions = {}
) {
    const route = {
        name: 'Process Hierarchy',
        query: buildProcessHierarchyQuery(params)
    };
    if (options.openInNewTab) {
        const resolved = router.resolve(route);
        const href = resolved?.href || '';
        if (href) {
            window.open(href, '_blank', 'noopener');
        }
        return;
    }
    return router.push(route);
}

/**
 * 다이어그램 노드(Call Activity / Start·End 이벤트 / Collaboration)에 연결된 프로세스(definitionId)를
 * "새 창"으로 여는 표준 진입점.
 * - 좌측 트리(left)는 접고, 우측 속성 사이드바(right)는 열린 상태로 띄운다.
 */
export function openLinkedProcessInNewTab(
    router: Router,
    params: { id?: string; name?: string } = {}
) {
    return navigateToProcessHierarchy(
        router,
        {
            id: params.id,
            name: params.name,
            entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE,
            left: PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED,
            right: PROCESS_HIERARCHY_PANEL_STATE.OPEN
        },
        { openInNewTab: true }
    );
}

export function resolveProcessHierarchyEntryState(routeQuery: Record<string, unknown> = {}) {
    const entry = pickString(routeQuery.entry, Object.values(PROCESS_HIERARCHY_ENTRY), PROCESS_HIERARCHY_ENTRY.DIRECT);

    const mode = pickString(routeQuery.mode, Object.values(PROCESS_HIERARCHY_MODE), PROCESS_HIERARCHY_MODE.VIEW);

    const defaultLeft =
        entry === PROCESS_HIERARCHY_ENTRY.ARCHITECTURE ||
        entry === PROCESS_HIERARCHY_ENTRY.ANALYSIS ||
        entry === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD
            ? PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED
            : PROCESS_HIERARCHY_PANEL_STATE.EXPANDED;

    const defaultRight = PROCESS_HIERARCHY_PANEL_STATE.OPEN;

    const defaultRightTab = entry === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD ? PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE : PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES;

    const left = pickString(
        routeQuery.left,
        [PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED, PROCESS_HIERARCHY_PANEL_STATE.EXPANDED],
        defaultLeft
    );

    const right = pickString(routeQuery.right, [PROCESS_HIERARCHY_PANEL_STATE.OPEN, PROCESS_HIERARCHY_PANEL_STATE.CLOSED], defaultRight);

    const rightTab = pickString(routeQuery.rightTab, Object.values(PROCESS_HIERARCHY_RIGHT_TAB), defaultRightTab);
    const reviewId = typeof routeQuery.reviewId === 'string' ? routeQuery.reviewId : '';

    return {
        entry,
        mode,
        left,
        right,
        rightTab,
        reviewId
    };
}

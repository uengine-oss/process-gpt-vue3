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

function pickString(value, allowed, fallback) {
    if (typeof value !== 'string') return fallback;
    return allowed.includes(value) ? value : fallback;
}

export function buildProcessHierarchyQuery({ name, entry, mode, left, right, rightTab, reviewId } = {}) {
    const query = {};

    if (name) query.name = name;
    if (entry) query.entry = entry;
    if (mode) query.mode = mode;
    if (left) query.left = left;
    if (right) query.right = right;
    if (rightTab) query.rightTab = rightTab;
    if (reviewId) query.reviewId = reviewId;

    return query;
}

export function resolveProcessHierarchyEntryState(routeQuery = {}) {
    const entry = pickString(routeQuery.entry, Object.values(PROCESS_HIERARCHY_ENTRY), PROCESS_HIERARCHY_ENTRY.DIRECT);

    const mode = pickString(routeQuery.mode, Object.values(PROCESS_HIERARCHY_MODE), PROCESS_HIERARCHY_MODE.EDIT);

    const defaultLeft =
        entry === PROCESS_HIERARCHY_ENTRY.ARCHITECTURE || entry === PROCESS_HIERARCHY_ENTRY.ANALYSIS
            ? PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED
            : PROCESS_HIERARCHY_PANEL_STATE.EXPANDED;

    const defaultRight =
        entry === PROCESS_HIERARCHY_ENTRY.ARCHITECTURE || entry === PROCESS_HIERARCHY_ENTRY.ANALYSIS
            ? PROCESS_HIERARCHY_PANEL_STATE.CLOSED
            : PROCESS_HIERARCHY_PANEL_STATE.OPEN;

    let defaultRightTab = PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES;
    if (entry === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
        defaultRightTab = PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE;
    }

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

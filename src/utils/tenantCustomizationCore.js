/**
 * 테넌트 사용자화(용어·분류축·운영 정책·역할 라벨·사용자 정의 메뉴) 순수 로직.
 *
 * 화면/서비스(TS)가 아니라 여기(JS)에 두는 이유: `npm run test:unit` 이 node --test 로
 * *.test.js 만 돌리므로, 저장 포맷 정규화와 분류 판정 규칙을 프레임워크 없이 검증하기 위해서다.
 * 기본값이 곧 "설정이 없던 시절의 동작" 이라, 설정 행이 없는 테넌트와 비 PAL 모드는 그대로 동작한다.
 */

// ---------------------------------------------------------------------------
// 계층 용어 / 진행 단계 (terminology)
// ---------------------------------------------------------------------------

export const HIERARCHY_LEVELS = ['domain', 'mega', 'major', 'sub'];

export const DEFAULT_HIERARCHY_TERMS = Object.freeze({
    domain: '도메인',
    mega: '메가프로세스',
    major: '메이저프로세스',
    sub: '서브프로세스'
});

export const STAGE_KEYS = ['draft', 'in_review', 'public_feedback', 'final_edit', 'published', 'wip', 'sunset'];

export const DEFAULT_STAGE_TERMS = Object.freeze({
    draft: { label: '0단계', shortLabel: '초안', color: '#94a3b8' },
    in_review: { label: '1단계', shortLabel: '검토', color: '#3B82F6' },
    public_feedback: { label: '2단계', shortLabel: '공람', color: '#8B5CF6' },
    final_edit: { label: '3단계', shortLabel: '최종수정', color: '#F59E0B' },
    published: { label: '4단계', shortLabel: '배포완료', color: '#10B981' },
    wip: { label: '차세대 기획 중', shortLabel: '차세대 기획 중', color: '#7B1FA2' },
    sunset: { label: '폐기 예정', shortLabel: '폐기 예정', color: '#C62828' }
});

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value) {
    return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/** 저장된 terminology 값을 화면·런타임이 쓰는 완전한 형태로 만든다(누락은 기본값). */
export function normalizeTerminology(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const hierarchy = {};
    for (const level of HIERARCHY_LEVELS) {
        hierarchy[level] = text(src.hierarchy?.[level]) || DEFAULT_HIERARCHY_TERMS[level];
    }
    const stages = {};
    for (const key of STAGE_KEYS) {
        const def = DEFAULT_STAGE_TERMS[key];
        const entry = src.stages?.[key] || {};
        const color = text(entry.color);
        stages[key] = {
            label: text(entry.label) || def.label,
            shortLabel: text(entry.shortLabel) || def.shortLabel,
            color: isHexColor(color) ? color : def.color
        };
    }
    return { hierarchy, stages };
}

/** 기본값과 같은 값은 빼고 저장한다 — 설정 행이 "무엇을 바꿨는지" 만 담게. */
export function diffTerminologyFromDefault(value) {
    const full = normalizeTerminology(value);
    const out = { hierarchy: {}, stages: {} };
    for (const level of HIERARCHY_LEVELS) {
        if (full.hierarchy[level] !== DEFAULT_HIERARCHY_TERMS[level]) out.hierarchy[level] = full.hierarchy[level];
    }
    for (const key of STAGE_KEYS) {
        const def = DEFAULT_STAGE_TERMS[key];
        const cur = full.stages[key];
        const entry = {};
        if (cur.label !== def.label) entry.label = cur.label;
        if (cur.shortLabel !== def.shortLabel) entry.shortLabel = cur.shortLabel;
        if (cur.color.toLowerCase() !== def.color.toLowerCase()) entry.color = cur.color;
        if (Object.keys(entry).length) out.stages[key] = entry;
    }
    return out;
}

/** '#RRGGBB' → 'r, g, b' (CSS 변수 rgba() 용). 3자리도 허용. */
export function hexToRgbTriplet(hex) {
    const value = text(hex).replace('#', '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(value)) return '';
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// ---------------------------------------------------------------------------
// 프로세스 분류축 (카드 보기 열)
// ---------------------------------------------------------------------------

export const DEFAULT_CLASSIFICATION_COLUMNS = Object.freeze([
    { key: 'design', label: '설계', color: '#1976D2', icon: 'mdi-pencil-ruler', keywords: ['설계', 'design', '계획', 'plan', 'planning'] },
    { key: 'build', label: '구축', color: '#388E3C', icon: 'mdi-hammer-wrench', keywords: ['구축', 'build', '개발', 'develop', 'implement', 'implementation'] },
    { key: 'monitor', label: '감시', color: '#F57C00', icon: 'mdi-monitor-eye', keywords: ['감시', 'monitor', '모니터', '관제', 'surveillance'] },
    { key: 'control', label: '제어', color: '#7B1FA2', icon: 'mdi-tune', keywords: ['제어', 'control', '통제', '관리', 'manage', 'management'] },
    { key: 'shared', label: '공통', color: '#607D8B', icon: 'mdi-share-variant', keywords: ['공통', 'shared', 'common'] }
]);

export const DEFAULT_CLASSIFICATION = Object.freeze({
    columns: DEFAULT_CLASSIFICATION_COLUMNS,
    fallback_key: 'shared',
    infer_stage_from_code: true,
    infer_domain: true
});

const COLUMN_KEY = /^[a-z][a-z0-9_-]{0,31}$/;

/** 라벨에서 key 를 만든다(영문·숫자만 남김, 비면 'col'). 관리자가 key 를 비워 둘 때 사용. */
export function slugifyColumnKey(label, taken = []) {
    let base = text(label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/^[^a-z]+/, '');
    if (!base) base = 'col';
    base = base.slice(0, 24);
    let candidate = base;
    let n = 2;
    while (taken.includes(candidate)) candidate = `${base}-${n++}`;
    return candidate;
}

function normalizeKeywords(value) {
    const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/) : [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const kw = text(item);
        const lower = kw.toLowerCase();
        if (!kw || seen.has(lower)) continue;
        seen.add(lower);
        out.push(kw);
    }
    return out;
}

/**
 * 저장된 process_classification 을 정규화한다.
 * - 열이 하나도 없으면 기본 5열.
 * - key 중복/형식 위반은 라벨에서 재생성. 라벨이 비면 key 를 라벨로.
 * - fallback_key 가 목록에 없으면 마지막 열.
 */
export function normalizeClassification(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const rows = Array.isArray(src.columns) ? src.columns : [];
    const columns = [];
    const taken = [];
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const label = text(row.label);
        let key = text(row.key).toLowerCase();
        if (!COLUMN_KEY.test(key) || taken.includes(key)) key = slugifyColumnKey(label || key, taken);
        if (!label && !text(row.key)) continue;
        taken.push(key);
        const color = text(row.color);
        columns.push({
            key,
            label: label || key,
            color: isHexColor(color) ? color : '#607D8B',
            icon: text(row.icon) || 'mdi-view-column-outline',
            keywords: normalizeKeywords(row.keywords)
        });
    }
    const finalColumns = columns.length ? columns : DEFAULT_CLASSIFICATION_COLUMNS.map((c) => ({ ...c, keywords: [...c.keywords] }));
    const keys = finalColumns.map((c) => c.key);
    const fallbackRaw = text(src.fallback_key).toLowerCase();
    const fallback_key = keys.includes(fallbackRaw) ? fallbackRaw : keys.includes('shared') ? 'shared' : keys[keys.length - 1];
    return {
        columns: finalColumns,
        fallback_key,
        infer_stage_from_code: src.infer_stage_from_code !== false,
        infer_domain: src.infer_domain !== false
    };
}

export function isDefaultClassification(value) {
    const v = normalizeClassification(value);
    if (!v.infer_stage_from_code || !v.infer_domain || v.fallback_key !== 'shared') return false;
    if (v.columns.length !== DEFAULT_CLASSIFICATION_COLUMNS.length) return false;
    return v.columns.every((c, i) => {
        const d = DEFAULT_CLASSIFICATION_COLUMNS[i];
        return c.key === d.key && c.label === d.label && c.color === d.color && c.icon === d.icon && c.keywords.join('|') === d.keywords.join('|');
    });
}

function lower(value) {
    return text(value).toLowerCase();
}

/**
 * 텍스트 → 열 key. 정확 일치(키/라벨/키워드)를 먼저 보고, exactOnly 가 아니면 키워드 부분 일치까지 본다.
 * 저장된 값이 라벨('설계')이든 key('design')이든 같은 열로 읽힌다 — 마이그레이션 전 데이터 호환.
 */
export function matchStageColumn(value, columns, exactOnly = false) {
    const t = lower(value);
    if (!t) return null;
    for (const col of columns) {
        if (t === col.key || t === lower(col.label)) return col.key;
        if (col.keywords.some((kw) => t === lower(kw))) return col.key;
    }
    if (exactOnly) return null;
    for (const col of columns) {
        if (col.keywords.some((kw) => lower(kw) && t.includes(lower(kw)))) return col.key;
    }
    return null;
}

/** `X.3` 형태 ID 코드의 순번 → columns[순번-1]. 열 수를 넘으면 null. */
export function inferStageColumnFromCode(value, columns) {
    const t = text(value);
    if (!t) return null;
    const match = t.match(/(?:^|[^A-Za-z0-9])([A-Z])\.(\d+)(?=\.|[^0-9]|$)/i);
    if (!match) return null;
    const index = parseInt(match[2], 10) - 1;
    return index >= 0 && index < columns.length ? columns[index].key : null;
}

export const MAJOR_STAGE_FIELDS = ['category', 'process_category', 'processCategory', 'stage', 'process_stage', 'processStage', 'lifecycle_stage', 'lifecycleStage', 'phase'];

/**
 * proc_map 의 major/mega 에 라벨로 저장된 분류 값을 key 로 바꾼다(제자리 수정). 바뀐 필드 수 반환.
 * 이미 key 인 값·매칭되지 않는 값은 건드리지 않는다.
 */
export function migrateProcMapStageValues(map, columns) {
    let changed = 0;
    const keys = new Set(columns.map((c) => c.key));
    const convert = (node) => {
        if (!node || typeof node !== 'object') return;
        for (const field of MAJOR_STAGE_FIELDS) {
            const current = node[field];
            if (typeof current !== 'string' || !current.trim()) continue;
            if (keys.has(current.trim())) continue;
            const key = matchStageColumn(current, columns, true);
            if (key && key !== current) {
                node[field] = key;
                changed++;
            }
        }
    };
    for (const mega of map?.mega_proc_list || []) {
        convert(mega);
        for (const major of mega.major_proc_list || []) convert(major);
    }
    return changed;
}

// ---------------------------------------------------------------------------
// 운영 정책 (operation_policy)
// ---------------------------------------------------------------------------

export const DEFAULT_OPERATION_POLICY = Object.freeze({
    public_feedback_days: 30,
    feedback_alert_days: 7,
    stalled_days: 7,
    recycle_bin_retention_days: 30,
    annual_working_hours: 2080,
    cycle_factors: Object.freeze({ Monthly: 12, Weekly: 52, Daily: 260 }),
    annual_cost_per_fte: 80000000,
    currency: 'KRW'
});

/** 화면·DB 함수(purge_expired_recycle_bin)가 같은 범위로 clamp 해야 한다. */
export const OPERATION_POLICY_LIMITS = Object.freeze({
    public_feedback_days: { min: 1, max: 365 },
    feedback_alert_days: { min: 0, max: 365 },
    stalled_days: { min: 1, max: 365 },
    recycle_bin_retention_days: { min: 1, max: 365 },
    annual_working_hours: { min: 1, max: 8760 },
    cycle_Monthly: { min: 1, max: 366 },
    cycle_Weekly: { min: 1, max: 366 },
    cycle_Daily: { min: 1, max: 366 },
    annual_cost_per_fte: { min: 0, max: 1e12 }
});

export function clampNumber(value, min, max, fallback) {
    const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function clampInt(value, limit, fallback) {
    return Math.trunc(clampNumber(value, limit.min, limit.max, fallback));
}

export function normalizeOperationPolicy(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const L = OPERATION_POLICY_LIMITS;
    const D = DEFAULT_OPERATION_POLICY;
    const cycles = src.cycle_factors && typeof src.cycle_factors === 'object' ? src.cycle_factors : {};
    const currency = text(src.currency).toUpperCase().slice(0, 8);
    return {
        public_feedback_days: clampInt(src.public_feedback_days, L.public_feedback_days, D.public_feedback_days),
        feedback_alert_days: clampInt(src.feedback_alert_days, L.feedback_alert_days, D.feedback_alert_days),
        stalled_days: clampInt(src.stalled_days, L.stalled_days, D.stalled_days),
        recycle_bin_retention_days: clampInt(src.recycle_bin_retention_days, L.recycle_bin_retention_days, D.recycle_bin_retention_days),
        annual_working_hours: clampInt(src.annual_working_hours, L.annual_working_hours, D.annual_working_hours),
        cycle_factors: {
            Monthly: clampInt(cycles.Monthly, L.cycle_Monthly, D.cycle_factors.Monthly),
            Weekly: clampInt(cycles.Weekly, L.cycle_Weekly, D.cycle_factors.Weekly),
            Daily: clampInt(cycles.Daily, L.cycle_Daily, D.cycle_factors.Daily)
        },
        annual_cost_per_fte: Math.round(clampNumber(src.annual_cost_per_fte, L.annual_cost_per_fte.min, L.annual_cost_per_fte.max, D.annual_cost_per_fte)),
        currency: /^[A-Z]{3,8}$/.test(currency) ? currency : D.currency
    };
}

/** 휴지통 남은 일수 — 보존 일수에서 경과 일수를 뺀 값(0 이하는 0). deletedAt 이 없으면 보존 일수 전체. */
export function recycleBinRemainingDays(deletedAt, retentionDays, now = Date.now()) {
    const retention = clampInt(retentionDays, OPERATION_POLICY_LIMITS.recycle_bin_retention_days, DEFAULT_OPERATION_POLICY.recycle_bin_retention_days);
    if (!deletedAt) return retention;
    const ts = new Date(deletedAt).getTime();
    if (Number.isNaN(ts)) return retention;
    return Math.max(0, retention - Math.floor((now - ts) / 86400000));
}

/** 주기 → 연간 횟수 환산 계수. 알 수 없는 주기(Yearly 포함)는 1. */
export function annualFrequencyFactor(cycle, policy) {
    const factors = (policy && policy.cycle_factors) || DEFAULT_OPERATION_POLICY.cycle_factors;
    switch (cycle) {
        case 'Monthly':
            return factors.Monthly;
        case 'Weekly':
            return factors.Weekly;
        case 'Daily':
            return factors.Daily;
        default:
            return 1;
    }
}

// ---------------------------------------------------------------------------
// 역할 표시 라벨 (role_labels)
// ---------------------------------------------------------------------------

export const ROLE_KEYS = ['admin', 'owner', 'editor', 'reviewer', 'viewer'];

/** 저장 값 → { role: { label?, description? } } (빈 문자열은 "기본값 사용" 으로 보고 버린다) */
export function normalizeRoleLabels(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const role of ROLE_KEYS) {
        const entry = src[role];
        if (!entry || typeof entry !== 'object') continue;
        const label = text(entry.label).slice(0, 40);
        const description = text(entry.description).slice(0, 300);
        const next = {};
        if (label) next.label = label;
        if (description) next.description = description;
        if (Object.keys(next).length) out[role] = next;
    }
    return out;
}

// ---------------------------------------------------------------------------
// 사용자 정의 메뉴 (menu_settings.customItems)
// ---------------------------------------------------------------------------

export const CUSTOM_MENU_SECTIONS = ['process', 'org', 'analytics', 'admin'];

export function isExternalMenuTarget(target) {
    return /^https?:\/\//i.test(text(target));
}

/**
 * 사용자 정의 메뉴 항목 정규화.
 * - target 은 '/'로 시작하는 내부 경로 또는 http(s) URL 만 허용.
 * - id 는 없으면 생성. section 은 목록 밖이면 'process'.
 */
export function normalizeCustomMenuItems(raw, makeId = () => `cm-${Math.random().toString(36).slice(2, 10)}`) {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const label = text(item.label).slice(0, 60);
        let target = text(item.target || item.to || item.url);
        if (!label || !target) continue;
        const external = isExternalMenuTarget(target);
        if (!external) {
            if (!target.startsWith('/')) target = `/${target}`;
            if (/^\/\//.test(target) || /[\s<>"']/.test(target)) continue;
        }
        let id = text(item.id);
        if (!id || seen.has(id)) id = makeId();
        seen.add(id);
        const section = CUSTOM_MENU_SECTIONS.includes(item.section) ? item.section : 'process';
        const entry = { id, label, target, external, section };
        const icon = text(item.icon);
        if (icon) entry.icon = icon;
        if (typeof item.order === 'number' && Number.isFinite(item.order)) entry.order = item.order;
        const role = text(item.requiredRole).toLowerCase();
        if (ROLE_KEYS.includes(role)) entry.requiredRole = role;
        out.push(entry);
    }
    return out;
}

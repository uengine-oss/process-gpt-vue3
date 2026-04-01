import {
    getAllUsers,
    getKeycloakUserById,
    getKeycloakUserDisplayName,
    getKeycloakUserIdForSave
} from '@/utils/keycloak';

/**
 * definition-service 목록 API의 createdByName / updatedByName.
 * - 저장: uEngine BPMN PUT 시 본문 `updatedByName`에 Keycloak 사용자 **id**(UUID, Admin API users[].id, OIDC sub와 동일).
 * - 표시: 해당 문자열이 UUID면 Keycloak 조회 후 `성 이름 (로그인ID)` 등.
 */

/** Keycloak user id(UUID) 형태만 true (전체 문자열이 uid일 때) */
export function looksLikeKeycloakUid(s: string): boolean {
    const t = String(s || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

export function hasActorValue(v: unknown): boolean {
    if (v == null) return false;
    if (typeof v !== 'string') return false;
    return v.trim() !== '';
}

export function trimmedActorId(v: unknown): string {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : String(v);
    return s.trim();
}

/** PUT /definition/raw JSON 본문 `name`: trim 후 빈 값이면 undefined(키 생략), 최대 255자 */
export function normalizeRawDefinitionDisplayName(input: unknown): string | undefined {
    if (input == null) return undefined;
    const s = String(input).trim();
    if (!s) return undefined;
    return s.length > 255 ? s.slice(0, 255) : s;
}

/**
 * BPMN 저장 시 PUT 본문 `updatedByName` — Keycloak 사용자 id(UUID).
 * uEngine(+PAL)만: PalUengineBackend도 UEngineBackend.putRawDefinition 동일.
 */
export function buildActorUidForSave(): string | undefined {
    if (typeof window === 'undefined' || (window as any).$mode !== 'uEngine') return undefined;
    const userId = getKeycloakUserIdForSave();
    if (!userId) return undefined;
    return normalizeRawDefinitionDisplayName(userId);
}

/** `표시명 (괄호아이디)` — 괄호 쪽은 보통 로그인 username. 표시가 비었거나 동일하면 괄호값만. */
export function formatDisplayNameWithUid(displayName: string, idInParens: string): string {
    const u = String(idInParens || '').trim();
    if (!u) return String(displayName || '').trim();
    const d = String(displayName || '').trim();
    if (!d || d === u) return u;
    if (d.endsWith(` (${u})`) || d.endsWith(`(${u})`)) return d.length <= 255 ? d : d.slice(0, 252) + '...';
    let label = `${d} (${u})`;
    if (label.length > 255) label = label.slice(0, 252) + '...';
    return label;
}

/**
 * Keycloak UserRepresentation → `표시명 (username)`.
 * firstName + 공백 + lastName 순으로 붙임.
 * - 영어: First Last (given + family).
 * - 한국(이 IdP): 성이 firstName·이름이 lastName에 들어가는 경우가 많아 화면에 성 이름 순으로 보임.
 */
export function formatKeycloakUserAsNameAndLoginId(user: Record<string, any> | null | undefined): string {
    if (!user || typeof user !== 'object') return '';
    const loginId = String(user.username || user.preferred_username || '').trim();
    const last = String(user.lastName ?? '').trim();
    const first = String(user.firstName ?? '').trim();
    let fullName = [first, last].filter(Boolean).join(' ').trim();
    if (!fullName) fullName = String(user.email || '').trim();
    if (!fullName) fullName = loginId;
    if (!loginId) return fullName;
    return formatDisplayNameWithUid(fullName === loginId ? '' : fullName, loginId);
}

/** uEngine: Keycloak sub → `성 이름 (로그인ID)`. 사용자 조회 실패 시 이전 표시 로직 폴백. */
export async function resolveUidToNameWithIdLabel(uid: string): Promise<string> {
    const u = String(uid || '').trim();
    if (!u) return '';
    if (typeof window !== 'undefined' && (window as any).$mode !== 'uEngine') return u;
    if (!looksLikeKeycloakUid(u)) return u;

    const user = await getKeycloakUserById(u);
    if (user) {
        const label = formatKeycloakUserAsNameAndLoginId(user);
        if (label) return label;
    }

    const name = (await getKeycloakUserDisplayName(u)).trim();
    if (name && name !== u) return name;
    return u;
}

/** `표시명 (로그인ID)` 에서 괄호 앞 표시 부분만 */
function stripLoginIdParens(d: string): string {
    const t = String(d || '').trim();
    const open = t.lastIndexOf(' (');
    if (open > 0 && t.endsWith(')')) return t.slice(0, open).trim();
    return t;
}

function alreadyHasLoginParens(s: string): boolean {
    return /\s\([^)]+\)\s*$/.test(String(s || '').trim());
}

const enrichActorLabelCache = new Map<string, Promise<string>>();

/**
 * updatedByName 이 사람 이름만 있을 때 Keycloak 조회로 `이름 (username)` 통일.
 * (버전 API가 sub 대신 expose-actor-names 문자열만 줄 때)
 */
async function enrichActorLabelWithLoginId(raw: string): Promise<string> {
    const t = trimmedActorId(raw);
    if (!t) return '';
    if (typeof window === 'undefined' || (window as any).$mode !== 'uEngine') return t;
    if (alreadyHasLoginParens(t)) return t;

    const cached = enrichActorLabelCache.get(t);
    if (cached) return cached;

    const pending = (async () => {
        try {
            const searches = Array.from(new Set([t, ...String(t).split(/\s+/).filter((w) => w.length >= 1)]));
            const seenUserIds = new Set<string>();
            for (const q of searches) {
                if (!q) continue;
                const users = await getAllUsers({ search: q, max: 50, first: 0, briefRepresentation: false });
                for (const u of users) {
                    if (!u?.id || seenUserIds.has(u.id)) continue;
                    seenUserIds.add(u.id);
                    const label = formatKeycloakUserAsNameAndLoginId(u);
                    if (!label) continue;
                    const un = String(u.username || '').trim();
                    if (un === t) return label;
                    const core = stripLoginIdParens(label);
                    if (core === t || label === t) return label;
                }
            }
        } catch {
            /* Admin API 없으면 원문 유지 */
        }
        return t;
    })();

    enrichActorLabelCache.set(t, pending);
    try {
        return await pending;
    } finally {
        /* 캐시는 유지 — 동일 문자열 재호출 시 재사용 */
    }
}

/** 목록/버전의 updatedByName: uid면 `표시명 (로그인ID)`, 아니면 가능하면 동일 형태로 보강 */
export async function resolveUpdatedByForDisplay(raw: string): Promise<string> {
    const t = trimmedActorId(raw);
    if (!t) return '';
    if (typeof window !== 'undefined' && (window as any).$mode !== 'uEngine') return t;
    if (looksLikeKeycloakUid(t)) return resolveUidToNameWithIdLabel(t);
    return enrichActorLabelWithLoginId(t);
}

/**
 * 화면 URL 의 프로세스 식별자 변환 헬퍼 (uuid ↔ legacy id).
 *
 * 정책 (specs/009 — URL 식별자 전환):
 * - URL 표기(쿼리파라미터 id)는 영구 UUID(proc_def.uuid) 기준으로 쓴다.
 *   legacy id 는 이름 변경·재구성 시 바뀔 수 있지만 uuid 는 불변이라 공유 링크가 오래 산다.
 * - 과거 북마크/공유 링크의 legacy id(`?id=a_3_1_3`)도 계속 수용한다(하위 호환).
 * - 내부 로직(체계도 트리 키, 편집 잠금, 로컬 백업, 저장 경로)은 legacy id 를 그대로 쓴다 —
 *   변환은 라우트 경계에서만 일어난다.
 *
 * 실패 시 항상 fail-open: 조회가 안 되면 원본 값을 그대로 쓰도록 null 을 반환한다.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProcessUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

// 세션 단위 캐시 — 같은 정의를 오가는 트리 탐색에서 반복 조회를 막는다.
const uuidByDefId = new Map<string, string>();
const defIdByUuid = new Map<string, string>();

function prime(defId: string, defUuid: string): void {
    if (!defId || !defUuid) return;
    uuidByDefId.set(defId, defUuid.toLowerCase());
    defIdByUuid.set(defUuid.toLowerCase(), defId);
}

function getSupabase(): any | null {
    return (typeof window !== 'undefined' && (window as any).$supabase) || null;
}

function getTenantId(): string {
    return (typeof window !== 'undefined' && (window as any).$tenantName) || '';
}

/**
 * 라우트에서 읽은 식별자(uuid 또는 legacy id)를 내부용 legacy id 로 정규화한다.
 * - legacy id 면 그대로 반환 (조회 없음)
 * - uuid 면 proc_def 에서 legacy id 를 찾아 반환, 못 찾으면 null
 */
export async function resolveProcessRouteId(value: string | null | undefined): Promise<string | null> {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) return null;
    if (!isProcessUuid(trimmed)) return trimmed;

    const key = trimmed.toLowerCase();
    const cached = defIdByUuid.get(key);
    if (cached) return cached;

    const supabase = getSupabase();
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('proc_def')
            .select('id, uuid')
            .eq('uuid', key)
            .eq('tenant_id', getTenantId())
            .maybeSingle();
        if (error || !data?.id) return null;
        prime(data.id, data.uuid);
        return data.id;
    } catch (e) {
        console.warn('[processRouteId] uuid → id 조회 실패(원본 유지):', e);
        return null;
    }
}

/**
 * URL 에 쓸 프로세스 uuid 를 legacy id 로부터 얻는다. 못 찾으면 null (호출부는 legacy id 로 폴백).
 */
export async function processUuidForRoute(defId: string | null | undefined): Promise<string | null> {
    const trimmed = typeof defId === 'string' ? defId.trim() : '';
    if (!trimmed) return null;
    if (isProcessUuid(trimmed)) return trimmed.toLowerCase();

    const cached = uuidByDefId.get(trimmed);
    if (cached) return cached;

    const supabase = getSupabase();
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('proc_def')
            .select('id, uuid')
            .eq('id', trimmed)
            .eq('tenant_id', getTenantId())
            .maybeSingle();
        if (error || !data?.uuid) return null;
        prime(data.id, data.uuid);
        return String(data.uuid).toLowerCase();
    } catch (e) {
        console.warn('[processRouteId] id → uuid 조회 실패(legacy 유지):', e);
        return null;
    }
}

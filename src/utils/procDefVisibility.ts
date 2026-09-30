/**
 * 프로세스 공개 범위 (proc_def.visibility / proc_def.allowed_org_codes)
 *
 * docs/security.md "4-2. 프로세스 공개 범위" / 보안 확인표 항목 5.
 * DB 쪽 규약은 supabase/migrations/20260911_proc_def_visibility.sql 참고.
 *
 *   all     : 테넌트 전체 공개 (기본값 — 기존 동작)
 *   org     : allowed_org_codes 에 포함된 조직(및 그 하위 부서) 구성원만
 *   private : 담당자(proc_def.owner) 와 관리자만
 *
 * 조직 코드 = 조직도(configuration key='organization') 의 부서 노드 id.
 * RLS 는 소문자·trim 정규화된 값으로 비교하므로 저장 시에도 같은 정규화를 적용한다.
 *
 * ※ PAL 모드 전용 UI 에서만 쓰인다 (비 PAL 화면에는 노출하지 않는다).
 *   PalModeBackend 의 proc_def 조회 메서드는 컬럼을 명시적으로 나열하므로
 *   여기서 필요한 두 컬럼만 따로 읽는다.
 */

export const PROC_DEF_VISIBILITY_ALL = 'all';
export const PROC_DEF_VISIBILITY_ORG = 'org';
export const PROC_DEF_VISIBILITY_PRIVATE = 'private';

export type ProcDefVisibility = 'all' | 'org' | 'private';

const VALID_VISIBILITIES: ProcDefVisibility[] = [PROC_DEF_VISIBILITY_ALL, PROC_DEF_VISIBILITY_ORG, PROC_DEF_VISIBILITY_PRIVATE];

export interface ProcDefVisibilityState {
    visibility: ProcDefVisibility;
    allowedOrgCodes: string[];
}

export function normalizeVisibility(value: unknown): ProcDefVisibility {
    const normalized = String(value ?? '').trim().toLowerCase();
    return (VALID_VISIBILITIES as string[]).includes(normalized) ? (normalized as ProcDefVisibility) : PROC_DEF_VISIBILITY_ALL;
}

/** RLS 비교 규약과 동일하게 소문자·trim·중복 제거 */
export function normalizeOrgCodes(value: unknown): string[] {
    const list = Array.isArray(value) ? value : [];
    const out: string[] = [];
    for (const item of list) {
        const code = String((item && typeof item === 'object' ? (item as any).id ?? (item as any).code : item) ?? '')
            .trim()
            .toLowerCase();
        if (code && !out.includes(code)) out.push(code);
    }
    return out;
}

export function defaultVisibilityState(): ProcDefVisibilityState {
    return { visibility: PROC_DEF_VISIBILITY_ALL, allowedOrgCodes: [] };
}

/** proc_def 행(또는 definition) 에서 공개 범위를 읽어낸다 */
export function readVisibilityState(source: any): ProcDefVisibilityState {
    if (!source || typeof source !== 'object') return defaultVisibilityState();
    const visibility = normalizeVisibility(source.visibility ?? source.definition?.visibility);
    const allowedOrgCodes = normalizeOrgCodes(
        source.allowed_org_codes ?? source.allowedOrgCodes ?? source.definition?.allowedOrgCodes ?? source.definition?.allowed_org_codes
    );
    return { visibility, allowedOrgCodes };
}

/**
 * proc_def 업데이트 payload 조각.
 * visibility 가 기본값('all')이고 이전에도 기본값이었다면 **빈 객체**를 돌려준다.
 * (마이그레이션 미적용 환경에서 기존 저장 경로가 깨지지 않도록 하는 안전장치)
 */
export function buildVisibilityUpdatePayload(
    next: ProcDefVisibilityState | null | undefined,
    previous?: ProcDefVisibilityState | null
): Record<string, any> {
    const nextState = {
        visibility: normalizeVisibility(next?.visibility),
        allowedOrgCodes: normalizeOrgCodes(next?.allowedOrgCodes)
    };
    const prevVisibility = normalizeVisibility(previous?.visibility);
    const prevCodes = normalizeOrgCodes(previous?.allowedOrgCodes);

    const isDefault = nextState.visibility === PROC_DEF_VISIBILITY_ALL && nextState.allowedOrgCodes.length === 0;
    const wasDefault = prevVisibility === PROC_DEF_VISIBILITY_ALL && prevCodes.length === 0;
    if (isDefault && wasDefault) return {};

    return {
        visibility: nextState.visibility,
        // 'org' 이 아니면 조직 목록은 의미가 없으므로 비운다.
        allowed_org_codes: nextState.visibility === PROC_DEF_VISIBILITY_ORG ? nextState.allowedOrgCodes : []
    };
}

/** proc_def 에서 공개 범위 두 컬럼만 조회 (컬럼 미존재 환경에서는 기본값으로 폴백) */
export async function fetchProcDefVisibility(procDefId: string): Promise<ProcDefVisibilityState> {
    const defId = String(procDefId ?? '').trim();
    const supabase = (window as any).$supabase;
    if (!defId || !supabase) return defaultVisibilityState();

    try {
        const { data, error } = await supabase
            .from('proc_def')
            .select('id, visibility, allowed_org_codes')
            .eq('tenant_id', (window as any).$tenantName)
            .eq('id', defId)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return readVisibilityState(data);
    } catch (e) {
        // 마이그레이션 미적용(42703 undefined_column) 등 — 기본값(전체 공개)으로 동작
        console.warn('[procDefVisibility] fetch failed, falling back to default:', e);
        return defaultVisibilityState();
    }
}

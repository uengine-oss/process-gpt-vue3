/**
 * MFA(TOTP) 공용 헬퍼 (docs/security.md 2-3, 항목 3)
 *
 * GoTrue 의 MFA API(`supabase.auth.mfa.*`) 를 이 레포의 관례(`window.$supabase`)에 맞춰 감싼다.
 * 화면 두 곳이 이 모듈을 쓴다.
 *   - 등록/해제: src/components/pages/account-settings/MfaSection.vue
 *   - 로그인 후 챌린지: src/components/auth/TwoStepForm.vue
 * 라우터 가드 판정은 src/utils/mfaGate.ts 가 담당한다.
 *
 * 서버 선행 조건: GOTRUE_MFA_TOTP_ENROLL_ENABLED / _VERIFY_ENABLED = true
 * 배포·운영 절차는 docs/security-gotrue-mfa-policy.md 참고.
 */
import { getTenantId } from '@/utils/tenant';

/** configuration 테이블의 키 (테넌트별 key/value 설정) */
export const MFA_POLICY_CONFIG_KEY = 'mfa_policy';

/** 인증 보증 수준 — GoTrue 가 액세스 토큰의 `aal` 클레임으로 내려준다. */
export type AalLevel = 'aal1' | 'aal2' | null;

export interface AalState {
    /** 지금 세션이 도달한 수준 */
    currentLevel: AalLevel;
    /** 이 사용자가 도달할 수 있는 수준. 'aal2' 면 검증된 팩터가 하나 이상 있다는 뜻이다. */
    nextLevel: AalLevel;
}

export interface TotpFactor {
    id: string;
    friendlyName: string;
    status: string;
    createdAt: string | null;
}

export interface TotpEnrollment {
    factorId: string;
    /** SVG data URI — `<img :src="...">` 로 그대로 렌더한다. */
    qrCode: string;
    /** 인증 앱에 손으로 넣을 때 쓰는 base32 시크릿 */
    secret: string;
    /** otpauth:// URI (수동 등록·딥링크용) */
    uri: string;
}

function getSupabase(): any | null {
    const supabase = (window as any).$supabase;
    return supabase?.auth?.mfa ? supabase : null;
}

/** 이 배포에서 MFA API 를 쓸 수 있는지 (supabase 클라이언트 유무) */
export function isMfaSupported(): boolean {
    return getSupabase() !== null;
}

/** supabase 오류 객체에서 사람이 읽을 메시지를 뽑는다. */
export function mfaErrorMessage(error: any): string {
    return error?.message || error?.error_description || String(error ?? '');
}

/**
 * 현재 세션의 AAL 상태.
 *
 * 네트워크 호출 없이 저장된 세션의 JWT 를 읽으므로 라우터 가드에서 매번 불러도 싸다.
 * 세션이 없거나 조회에 실패하면 둘 다 null 을 돌려준다 — 호출부는 "판정 불가"로 보고
 * 통과시켜야 한다(로그인 여부는 다른 가드가 본다).
 */
export async function getAal(): Promise<AalState> {
    const supabase = getSupabase();
    if (!supabase) return { currentLevel: null, nextLevel: null };
    try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error || !data) return { currentLevel: null, nextLevel: null };
        return {
            currentLevel: (data.currentLevel as AalLevel) ?? null,
            nextLevel: (data.nextLevel as AalLevel) ?? null
        };
    } catch (_e) {
        return { currentLevel: null, nextLevel: null };
    }
}

/** 지금 세션이 챌린지를 통과해야 하는 상태인가 (검증된 팩터가 있는데 아직 aal1). */
export function needsChallenge(aal: AalState): boolean {
    return aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2';
}

/** 검증된 팩터가 하나도 없는 사용자인가 (nextLevel 이 aal2 로 올라가지 않는다). */
export function hasNoVerifiedFactor(aal: AalState): boolean {
    return aal.currentLevel === 'aal1' && aal.nextLevel === 'aal1';
}

interface RawFactor {
    id: string;
    friendly_name?: string;
    factor_type?: string;
    status?: string;
    created_at?: string;
}

/** 등록된 TOTP 팩터 목록. `all` 에는 아직 검증하지 않은(unverified) 팩터도 들어 있다. */
export async function listTotpFactors(): Promise<{ verified: TotpFactor[]; unverified: TotpFactor[] }> {
    const supabase = getSupabase();
    if (!supabase) return { verified: [], unverified: [] };

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;

    const all: RawFactor[] = (data?.all as RawFactor[]) ?? [];
    const totp = all
        .filter((f) => (f.factor_type ?? 'totp') === 'totp')
        .map((f) => ({
            id: f.id,
            friendlyName: f.friendly_name || 'Authenticator',
            status: f.status || 'unverified',
            createdAt: f.created_at ?? null
        }));

    return {
        verified: totp.filter((f) => f.status === 'verified'),
        unverified: totp.filter((f) => f.status !== 'verified')
    };
}

/**
 * 검증을 마치지 못하고 남은 팩터를 지운다.
 *
 * 등록 화면을 열었다가 코드를 넣지 않고 닫으면 unverified 팩터가 쌓이고,
 * 같은 friendly_name 으로 다시 등록하려 할 때 GoTrue 가 중복으로 거절한다.
 * 새 등록을 시작하기 전에 한 번 치운다.
 */
export async function cleanupUnverifiedFactors(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        const { unverified } = await listTotpFactors();
        for (const factor of unverified) {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
    } catch (_e) {
        // 정리는 best-effort — 실패해도 등록 시도는 그대로 진행한다.
    }
}

/** TOTP 팩터를 새로 만든다. 반환된 QR/secret 을 인증 앱에 넣은 뒤 verifyTotp() 로 확정한다. */
export async function enrollTotp(friendlyName: string): Promise<TotpEnrollment> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('supabase client unavailable');

    await cleanupUnverifiedFactors();

    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
    });
    if (error) throw error;

    return {
        factorId: data.id,
        qrCode: data.totp?.qr_code ?? '',
        secret: data.totp?.secret ?? '',
        uri: data.totp?.uri ?? ''
    };
}

/**
 * 6자리 코드로 팩터를 검증한다 (challenge → verify).
 *
 * 등록 확정과 로그인 챌린지가 같은 절차를 쓴다. 성공하면 세션이 aal2 로 올라간다.
 */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('supabase client unavailable');

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim()
    });
    if (verifyError) throw verifyError;
}

/**
 * 팩터를 해제한다.
 *
 * 호출 전에 반드시 현재 코드로 verifyTotp() 를 한 번 더 돌린다 — 잠깐 자리를 비운
 * 브라우저에서 2단계 인증이 소리 없이 꺼지는 일을 막는다. (화면에서 강제)
 */
export async function unenrollTotp(factorId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('supabase client unavailable');
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
}

export interface MfaPolicy {
    /** true 면 테넌트의 모든 사용자가 TOTP 를 등록해야 한다. */
    requireMfa: boolean;
}

export const DEFAULT_MFA_POLICY: MfaPolicy = { requireMfa: false };

/**
 * 테넌트별 MFA 정책을 읽는다.
 *
 * 저장 위치는 세션 타임아웃·잠금 정책과 같은 public.configuration (tenant_id + key 유일).
 *   key = 'mfa_policy', value = { "require_mfa": true }
 *
 * 행이 없거나 조회에 실패하면 require_mfa=false — 설정 조회 장애로 전 사용자가
 * 등록 화면에 갇히는 상황을 피한다(fail-open). 이미 등록한 사용자의 챌린지는
 * 이 값과 무관하게 AAL 만으로 판정하므로 영향받지 않는다.
 */
export async function loadMfaPolicy(): Promise<MfaPolicy> {
    try {
        const supabase = (window as any).$supabase;
        if (!supabase?.from) return DEFAULT_MFA_POLICY;

        const tenantId = getTenantId();
        if (!tenantId) return DEFAULT_MFA_POLICY;

        const { data, error } = await supabase
            .from('configuration')
            .select('value')
            .eq('tenant_id', tenantId)
            .eq('key', MFA_POLICY_CONFIG_KEY)
            .maybeSingle();

        if (error || data?.value == null) return DEFAULT_MFA_POLICY;

        const raw = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (raw == null || typeof raw !== 'object') return DEFAULT_MFA_POLICY;

        return { requireMfa: raw.require_mfa === true || raw.require_mfa === 'true' };
    } catch (_e) {
        return DEFAULT_MFA_POLICY;
    }
}

export default {
    isMfaSupported,
    getAal,
    needsChallenge,
    hasNoVerifiedFactor,
    listTotpFactors,
    enrollTotp,
    verifyTotp,
    unenrollTotp,
    loadMfaPolicy
};

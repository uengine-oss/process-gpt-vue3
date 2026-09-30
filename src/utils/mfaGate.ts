/**
 * MFA(TOTP) 라우터 게이트 (docs/security.md 2-3, 항목 3)
 *
 * 두 가지를 막는다.
 *   1. 챌린지 미통과 — TOTP 를 등록한 사용자가 비밀번호만 맞히고(aal1) 보호 화면에
 *      들어오는 경우. /auth/two-step 으로 보낸다.
 *   2. 미등록 — 테넌트가 "MFA 필수"(configuration.mfa_policy.require_mfa) 인데
 *      아직 팩터를 등록하지 않은 경우. 계정 설정 화면으로 보내 등록을 유도한다.
 *
 * 판정 재료는 GoTrue 가 액세스 토큰에 넣어 주는 AAL 이다.
 *   currentLevel=aal1, nextLevel=aal2 → 검증된 팩터가 있는데 아직 통과 못 함  → challenge
 *   currentLevel=aal1, nextLevel=aal1 → 검증된 팩터가 없음                    → (필수면) enroll
 *   currentLevel=aal2                 → 통과                                   → pass
 * AAL 은 저장된 세션의 JWT 를 읽는 로컬 연산이라 네비게이션마다 불러도 비용이 없다.
 * 네트워크를 타는 건 테넌트 정책 조회뿐이고, 이건 짧은 TTL 캐시를 둔다.
 *
 * 제외
 *   - SSO(헤더 교환) 세션: IdP 의 MFA 를 따르므로 이 게이트를 건너뛴다.
 *   - 인증 화면(/auth/*), 외부 폼, 디자인 시스템, 루트('/') : 로그인·복구 경로를 막으면 안 된다.
 *   - 정책 조회 실패: fail-open. 설정 조회 장애로 전 사용자가 등록 화면에 갇히지 않게 한다.
 *     (이미 등록한 사용자의 챌린지는 정책과 무관하게 AAL 만으로 판정하므로 영향이 없다.)
 */
import { getAal, hasNoVerifiedFactor, isMfaSupported, loadMfaPolicy, needsChallenge } from '@/utils/mfa';
import { isSsoAuthenticated } from '@/utils/ssoAuth';

/** 로그인 후 6자리 코드를 받는 화면 */
export const MFA_CHALLENGE_PATH = '/auth/two-step';

/** MFA 등록 섹션이 있는 화면 (계정 설정 > 계정 탭) */
export const MFA_ENROLL_PATH = '/account-settings';

/** 등록을 강제당해 온 것임을 화면에 알리는 쿼리 */
export const MFA_ENROLL_QUERY = { tab: 'Account', mfaRequired: '1' } as const;

const POLICY_CACHE_TTL_MS = 60 * 1000;

let cachedRequireMfa = false;
let cachedAt = 0;
let inflight: Promise<boolean> | null = null;

/** 테넌트가 MFA 를 필수로 두었는지 (TTL 캐시) */
export async function isMfaRequired(): Promise<boolean> {
    const now = Date.now();
    if (now - cachedAt < POLICY_CACHE_TTL_MS) return cachedRequireMfa;
    if (!inflight) {
        inflight = loadMfaPolicy()
            .then((policy) => {
                cachedRequireMfa = policy.requireMfa;
                cachedAt = Date.now();
                inflight = null;
                return cachedRequireMfa;
            })
            .catch(() => {
                inflight = null;
                return false;
            });
    }
    return inflight;
}

/** 관리자가 정책을 바꾼 직후 등 즉시 재조회가 필요할 때 */
export function invalidateMfaPolicyCache() {
    cachedAt = 0;
}

/** 게이트를 아예 적용하지 않는 경로 (로그인·복구·공개 화면) */
function isExemptPath(path: string): boolean {
    if (path === '/' || path === '') return true;
    return path.startsWith('/auth') || path.startsWith('/external-forms') || path.startsWith('/design-system');
}

export type MfaGateDecision = 'pass' | 'challenge' | 'enroll';

/**
 * 라우터 beforeEach 에서 호출되는 판정 함수.
 *  - 'challenge' : 챌린지 미통과 → MFA_CHALLENGE_PATH 로 리다이렉트
 *  - 'enroll'    : 테넌트 필수인데 미등록 → MFA_ENROLL_PATH 로 리다이렉트
 *  - 'pass'      : 그대로 통과
 */
export async function evaluateMfaGate(toPath: string): Promise<MfaGateDecision> {
    if (!isMfaSupported()) return 'pass';

    // SSO 연동 사용자는 IdP 의 MFA 정책을 따른다 (docs/security.md 2-3)
    try {
        if (isSsoAuthenticated()) return 'pass';
    } catch (_e) {
        /* SSO 판정 실패는 일반 세션으로 취급 */
    }

    if (isExemptPath(toPath)) return 'pass';

    const aal = await getAal();

    // 세션이 없거나 AAL 을 못 읽으면 판정하지 않는다 — 로그인 여부는 다른 가드가 본다.
    if (!aal.currentLevel) return 'pass';

    if (needsChallenge(aal)) return 'challenge';

    if (hasNoVerifiedFactor(aal)) {
        // 등록 화면 자체는 막으면 안 된다 (막으면 등록할 방법이 없다).
        if (toPath === MFA_ENROLL_PATH) return 'pass';

        // 테넌트 관리 서버(www)는 /account-settings 를 열지 않고 모든 경로를
        // /tenant/manage 로 되돌린다. 여기서 등록을 강제하면 두 리다이렉트가
        // 서로를 부르며 순환하므로, 이 서버에서는 등록 유도를 하지 않는다.
        // (챌린지는 /auth/two-step 이 열려 있어 정상 동작한다.)
        if ((window as any).$isTenantServer) return 'pass';

        return (await isMfaRequired()) ? 'enroll' : 'pass';
    }

    return 'pass';
}

/**
 * 챌린지 통과 후 돌아갈 경로를 정리한다.
 *
 * 쿼리로 실어 나르는 값이라 그대로 믿으면 오픈 리다이렉트가 된다.
 * 같은 출처의 절대경로("/..." 이되 "//" 로 시작하지 않는 것)만 허용한다.
 */
export function safeRedirectTarget(raw: unknown, fallback = '/'): string {
    if (typeof raw !== 'string' || raw.length === 0) return fallback;
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    // 챌린지 화면으로 되돌아오는 순환을 막는다.
    if (raw.startsWith(MFA_CHALLENGE_PATH)) return fallback;
    return raw;
}

export default { evaluateMfaGate, isMfaRequired, invalidateMfaPolicyCache, safeRedirectTarget };

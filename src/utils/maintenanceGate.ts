/**
 * 점검 모드(maintenance mode) 라우터 게이트 — PAL 전용.
 *
 * 관리자가 시스템 운영 화면에서 점검 모드를 켜면, admin 이 아닌 사용자는
 * 라우트 이동 시 /auth/maintenance 안내 화면으로 보내진다.
 * configuration 테이블의 maintenance_mode 값은 RLS 상 모든 인증 사용자가
 * SELECT 가능하므로 비관리자도 상태를 읽을 수 있다.
 *
 * 네비게이션마다 DB 를 치지 않도록 짧은 TTL 캐시를 두고,
 * 조회 실패 시에는 fail-open(차단 안 함) — 설정 조회 장애로 전 사용자가
 * 잠기는 상황을 피한다.
 */
import BackendFactory from '@/components/api/BackendFactory';
import { authClaimsState, refreshAuthClaims, hasRole } from '@/utils/authClaims';
import { ROLES } from '@/utils/roles';

export const MAINTENANCE_PATH = '/auth/maintenance';

const CACHE_TTL_MS = 30 * 1000;

let cachedEnabled = false;
let cachedAt = 0;
let inflight: Promise<boolean> | null = null;

async function fetchMaintenanceEnabled(): Promise<boolean> {
    try {
        const backend = BackendFactory.createBackend() as any;
        if (typeof backend?.getMaintenanceMode !== 'function') return false;
        const config = await backend.getMaintenanceMode();
        return !!config?.enabled;
    } catch (_e) {
        // 조회 실패 시 차단하지 않는다 (fail-open)
        return false;
    }
}

/** 점검 모드 활성화 여부 (TTL 캐시) */
export async function isMaintenanceEnabled(): Promise<boolean> {
    const now = Date.now();
    if (now - cachedAt < CACHE_TTL_MS) return cachedEnabled;
    if (!inflight) {
        inflight = fetchMaintenanceEnabled().then((enabled) => {
            cachedEnabled = enabled;
            cachedAt = Date.now();
            inflight = null;
            return enabled;
        });
    }
    return inflight;
}

/** 점검 모드 토글 직후 등 즉시 재조회가 필요할 때 캐시 무효화 */
export function invalidateMaintenanceCache() {
    cachedAt = 0;
}

export type MaintenanceGateDecision = 'pass' | 'block' | 'release';

/**
 * 라우터 beforeEach 에서 호출되는 판정 함수.
 *  - 'block'   : 점검 중 + 비관리자 → MAINTENANCE_PATH 로 리다이렉트
 *  - 'release' : 점검 해제 상태인데 점검 화면에 있음 → 시작 화면으로 복귀
 *  - 'pass'    : 그대로 통과
 */
export async function evaluateMaintenanceGate(toPath: string): Promise<MaintenanceGateDecision> {
    // PAL 모드에서만 동작
    if (!(window as any).$pal) return 'pass';

    // 로그인/비밀번호 재설정 등 인증 라우트와 외부 폼은 점검 중에도 열어둔다
    // (관리자가 로그인해서 점검을 해제할 수 있어야 한다)
    if (toPath !== MAINTENANCE_PATH && (toPath.startsWith('/auth') || toPath.startsWith('/external-forms'))) {
        return 'pass';
    }

    const enabled = await isMaintenanceEnabled();

    if (toPath === MAINTENANCE_PATH) {
        return enabled ? 'pass' : 'release';
    }

    if (!enabled) return 'pass';

    // 역할 클레임이 아직 로드 전이면 로드 후 판정
    if (!authClaimsState.loaded) {
        try {
            await refreshAuthClaims();
        } catch (_e) {
            /* 클레임 로드 실패 시 아래에서 비관리자로 취급되어 차단된다 */
        }
    }

    return hasRole(ROLES.ADMIN) ? 'pass' : 'block';
}

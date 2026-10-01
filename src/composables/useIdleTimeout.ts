/**
 * 유휴 세션 타임아웃 (docs/security.md 2-1, 항목 12)
 *
 * 자리를 비운 브라우저가 로그인된 채 남아 있는 시간을 제한한다.
 * GoTrue 의 GOTRUE_SESSIONS_INACTIVITY_TIMEOUT / _TIMEBOX 가 서버측 상한이고,
 * 여기는 사용자가 실제로 체감하는 화면측 타이머다 (서버 상한보다 짧게 잡는다).
 * 배포 설정은 docs/security-gotrue-session-policy.md 참고.
 *
 * 동작
 *   1. 사람이 조작할 때마다 "마지막 활동 시각"을 갱신한다.
 *   2. idleMinutes 동안 조작이 없으면 경고를 띄우고 warningSeconds 를 센다.
 *   3. 경고 중에는 조작만으로 타이머가 풀리지 않는다 — 마우스가 스쳤다는
 *      이유로 로그아웃 예고가 조용히 사라지면 사용자는 연장 여부를 알 수 없다.
 *      "연장" 을 눌러야(extend) 다시 처음부터 센다.
 *   4. 유예가 끝나면 로그아웃하고 로그인 화면으로 보낸다.
 *
 * 여러 탭을 띄워 둔 경우, 한 탭에서의 조작을 localStorage 로 나머지 탭에
 * 알린다. 그러지 않으면 옆 탭에서 계속 일하는 동안 이 탭이 혼자 만료된다.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { getTenantId } from '@/utils/tenant';
import { isSsoAuthenticated, redirectToSsoLogin } from '@/utils/ssoAuth';

/** 테넌트 설정이 없을 때 쓰는 기본값. 바꿀 때 문서도 같이 고친다. */
export const DEFAULT_IDLE_MINUTES = 30;
export const DEFAULT_WARNING_SECONDS = 60;

/** configuration 테이블의 키 (테넌트별 key/value 설정) */
export const SESSION_TIMEOUT_CONFIG_KEY = 'session_timeout';

/** 다른 탭에 활동을 알리는 localStorage 키 */
const LAST_ACTIVITY_KEY = 'sessionIdle:lastActivity';

/** 조작 이벤트는 초당 한 번만 처리한다 (mousemove 가 초당 수십 번 들어온다) */
const ACTIVITY_THROTTLE_MS = 1000;

/** 다른 탭에 알리는 주기. 매 조작마다 쓰면 localStorage 쓰기가 과해진다. */
const BROADCAST_INTERVAL_MS = 5000;

const TICK_MS = 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'click', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

export interface SessionTimeoutPolicy {
    /** 유휴 허용 시간(분). 0 이하면 타이머를 켜지 않는다. */
    idleMinutes: number;
    /** 경고 후 로그아웃까지의 유예(초) */
    warningSeconds: number;
}

function toPositiveNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    if (!Number.isFinite(n)) return fallback;
    return n;
}

/**
 * 테넌트별 세션 타임아웃 설정을 읽는다.
 *
 * 저장 위치는 이 레포에서 테넌트 설정에 쓰는 public.configuration 테이블
 * (tenant_id + key 유일). value 예:
 *   { "idle_timeout_minutes": 30, "warning_seconds": 60 }
 *
 * 설정 행이 없으면 기본값을 쓴다. idle_timeout_minutes 가 0 이하 / null 이면
 * 비활성으로 본다 — 기존 배포의 동작을 유지하고 싶은 테넌트를 위한 탈출구다.
 * 조회에 실패하면 기본값으로 진행한다(타이머를 끄지 않는다 — 보안 기능이
 * 조회 장애로 조용히 사라지면 안 된다).
 */
export async function loadSessionTimeoutPolicy(): Promise<SessionTimeoutPolicy> {
    const fallback: SessionTimeoutPolicy = {
        idleMinutes: DEFAULT_IDLE_MINUTES,
        warningSeconds: DEFAULT_WARNING_SECONDS
    };

    try {
        const supabase = (window as any).$supabase;
        if (!supabase?.from) return fallback;

        const tenantId = getTenantId();
        if (!tenantId) return fallback;

        const { data, error } = await supabase
            .from('configuration')
            .select('value')
            .eq('tenant_id', tenantId)
            .eq('key', SESSION_TIMEOUT_CONFIG_KEY)
            .maybeSingle();

        if (error || data?.value == null) return fallback;

        const raw = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (raw == null || typeof raw !== 'object') return fallback;

        return {
            idleMinutes: toPositiveNumber(raw.idle_timeout_minutes, DEFAULT_IDLE_MINUTES),
            warningSeconds: Math.max(5, toPositiveNumber(raw.warning_seconds, DEFAULT_WARNING_SECONDS))
        };
    } catch (_e) {
        return fallback;
    }
}

/**
 * 지금 로그인된 상태인가.
 *
 * 일반 로그인은 localStorage 의 email 이, SSO(헤더 교환)는 메모리의 토큰이
 * 기준이다. SSO 로그인도 exchangeSsoToken() 이 email 을 심으므로 결국
 * 같은 타이머가 적용되지만, 토큰만 살아있는 순간도 로그인으로 본다.
 */
function isLoggedIn(): boolean {
    try {
        if (isSsoAuthenticated()) return true;
        return !!window.localStorage?.getItem('email');
    } catch (_e) {
        return false;
    }
}

/** 인증 화면에서는 타이머를 돌리지 않는다 (로그인 중에 로그아웃시킬 이유가 없다). */
function isOnAuthScreen(): boolean {
    const path = window.location?.pathname || '';
    return path === '/' || path.startsWith('/auth');
}

export interface UseIdleTimeoutResult {
    /** 경고 모달을 띄울지 */
    warningVisible: Ref<boolean>;
    /** 로그아웃까지 남은 초 */
    remainingSeconds: Ref<number>;
    /** 적용 중인 유휴 허용 시간(분). 0 이면 비활성 */
    idleMinutes: Ref<number>;
    /** "연장" — 타이머를 처음부터 다시 센다 */
    extend: () => void;
    /** 즉시 로그아웃 */
    logoutNow: () => Promise<void>;
}

export function useIdleTimeout(overrides?: Partial<SessionTimeoutPolicy>): UseIdleTimeoutResult {
    const warningVisible = ref(false);
    const remainingSeconds = ref(0);
    const idleMinutes = ref(0);

    let warningSeconds = DEFAULT_WARNING_SECONDS;
    let lastActivity = Date.now();
    let lastThrottledAt = 0;
    let lastBroadcastAt = 0;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let loggingOut = false;

    const idleMs = () => idleMinutes.value * 60 * 1000;

    function markActivity(broadcast = true) {
        lastActivity = Date.now();
        if (!broadcast) return;
        if (lastActivity - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;
        lastBroadcastAt = lastActivity;
        try {
            window.localStorage?.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
        } catch (_e) {
            // 사생활 보호 모드 등에서 쓰기가 막혀도 이 탭의 타이머는 계속 돈다.
        }
    }

    function onActivity() {
        // 경고가 떠 있는 동안은 "연장" 버튼만 타이머를 되돌린다.
        if (warningVisible.value) return;
        const now = Date.now();
        if (now - lastThrottledAt < ACTIVITY_THROTTLE_MS) return;
        lastThrottledAt = now;
        markActivity();
    }

    function onStorage(event: StorageEvent) {
        if (event.key !== LAST_ACTIVITY_KEY || !event.newValue) return;
        if (warningVisible.value) return;
        const value = Number(event.newValue);
        if (Number.isFinite(value) && value > lastActivity) {
            lastActivity = value;
        }
    }

    function extend() {
        warningVisible.value = false;
        remainingSeconds.value = 0;
        lastBroadcastAt = 0;
        markActivity();
    }

    async function logoutNow() {
        if (loggingOut) return;
        loggingOut = true;
        stopTicking();
        warningVisible.value = false;

        // SSO(헤더 교환) 세션은 Supabase 세션과 정리 경로가 다르다.
        // 메모리 토큰과 localStorage 의 accessToken 을 지우고 SSO 게이트웨이로 보낸다.
        if (isSsoAuthenticated()) {
            try {
                redirectToSsoLogin('idle-timeout');
                return;
            } catch (e) {
                console.warn('[idle-timeout] SSO 로그아웃 실패:', e);
            }
        }

        try {
            // 기존 로그아웃 경로를 그대로 쓴다 (storage.signOut + 이동).
            //
            // 정적 import 를 쓰지 않는 이유: stores/auth 는 모듈 로드 시점에
            // BackendFactory.createBackend() 를 부르는데, 이 컴포저블은 App.vue 에서
            // 임포트되므로 정적으로 묶으면 main.ts 가 window.$mode 를 세우기 전에
            // 그 호출이 일어나 부팅이 깨진다.
            const { useAuthStore } = await import('@/stores/auth');
            await useAuthStore().logout();
        } catch (e) {
            console.warn('[idle-timeout] 로그아웃 실패:', e);
        }

        if (!window.location.pathname.startsWith('/auth')) {
            window.location.href = '/auth/login';
        }
    }

    function tick() {
        if (idleMinutes.value <= 0) return;

        if (!isLoggedIn() || isOnAuthScreen()) {
            // 로그아웃 상태나 인증 화면에서는 유휴 시간을 세지 않는다.
            warningVisible.value = false;
            markActivity(false);
            return;
        }

        const idleFor = Date.now() - lastActivity;
        if (idleFor < idleMs()) {
            warningVisible.value = false;
            return;
        }

        const graceLeftMs = idleMs() + warningSeconds * 1000 - idleFor;
        if (graceLeftMs <= 0) {
            void logoutNow();
            return;
        }

        warningVisible.value = true;
        remainingSeconds.value = Math.ceil(graceLeftMs / 1000);
    }

    function startTicking() {
        if (tickTimer !== null) return;
        tickTimer = setInterval(tick, TICK_MS);
    }

    function stopTicking() {
        if (tickTimer === null) return;
        clearInterval(tickTimer);
        tickTimer = null;
    }

    function attachListeners() {
        for (const name of ACTIVITY_EVENTS) {
            document.addEventListener(name, onActivity, { passive: true });
        }
        window.addEventListener('storage', onStorage);
    }

    function detachListeners() {
        for (const name of ACTIVITY_EVENTS) {
            document.removeEventListener(name, onActivity);
        }
        window.removeEventListener('storage', onStorage);
    }

    onMounted(async () => {
        const policy = overrides?.idleMinutes != null && overrides?.warningSeconds != null
            ? (overrides as SessionTimeoutPolicy)
            : { ...(await loadSessionTimeoutPolicy()), ...overrides };

        idleMinutes.value = policy.idleMinutes > 0 ? policy.idleMinutes : 0;
        warningSeconds = Math.max(5, policy.warningSeconds);

        if (idleMinutes.value <= 0) return; // 테넌트가 꺼 둔 경우

        markActivity(false);
        attachListeners();
        startTicking();
    });

    onBeforeUnmount(() => {
        detachListeners();
        stopTicking();
    });

    return { warningVisible, remainingSeconds, idleMinutes, extend, logoutNow };
}

export default useIdleTimeout;

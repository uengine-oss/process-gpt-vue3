/**
 * 휴대폰 폭에서 간소화 화면을 켰을 때의 '앱 틀' 상태.
 *
 * 왜 따로 두는가
 *   이 틀에서는 아래 탭 대신 위에 얇은 앱바를 두고, 목록은 왼쪽 위 단추로 여는
 *   전체 화면 사이드바에 담는다(클로드·ChatGPT 모바일과 같은 모양). 앱바의 제목은
 *   지금 보고 있는 화면이 정하므로, 레이아웃과 각 화면이 같은 상태를 봐야 한다.
 *   여기 하나만 두면 어느 쪽에서 읽어도 같은 값이 나온다.
 *
 * 켜지는 조건 — 셋 다 맞아야 한다
 *   - 폭 768px 이하(휴대폰). 노트북을 좁게 쓰는 사람까지 바꾸지 않는다.
 *   - 간소화 화면이 켜져 있음. 꺼 두면 예전 화면을 그대로 둔다.
 *   - 로그인해 있음. 로그인 화면에는 앱바를 올릴 까닭이 없다.
 */
import { computed, reactive } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';

export const PHONE_MAX_WIDTH = 768;

const state = reactive({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    signedIn: false,
    /** 앱바 가운데 제목. 화면이 정하지 않으면 레이아웃이 경로로 채운다. */
    title: '' as string,
    /**
     * 그 제목을 정한 화면의 경로. 다른 화면으로 넘어가면 지난 제목이 남지 않도록
     * 앱바는 경로가 같을 때만 이 제목을 쓴다 — 화면마다 지우는 일을 맡기지 않는다.
     */
    titlePath: '' as string
});

function readSignedIn(): boolean {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.includes('-auth-token')) return true;
        }
    } catch (e) {
        /* 저장소를 막아 둔 환경 */
    }
    return false;
}

let listening = false;
function listen() {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    const update = () => {
        state.width = window.innerWidth;
        state.signedIn = readSignedIn();
    };
    update();
    window.addEventListener('resize', update);
    // 로그인·로그아웃은 같은 탭에서 일어나므로 storage 이벤트로는 알 수 없다.
    // 경로가 바뀔 때마다 레이아웃이 refreshPhoneShell() 을 불러 다시 읽는다.
}

export function refreshPhoneShell() {
    state.width = typeof window !== 'undefined' ? window.innerWidth : state.width;
    state.signedIn = readSignedIn();
}

export function setPhoneShellTitle(title: string, path?: string) {
    state.title = title || '';
    state.titlePath = path || (typeof window !== 'undefined' ? window.location.pathname : '');
}

export function usePhoneShell() {
    listen();
    const customizer = useCustomizerStore();
    const active = computed(() => state.width <= PHONE_MAX_WIDTH && !!customizer.simpleUi && state.signedIn);
    return { state, active };
}

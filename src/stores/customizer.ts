import { defineStore } from 'pinia';
import config from '@/config';

const SIMPLE_UI_KEY = 'pg.simpleUi';

/** 휴대폰 폭. MobileTabBar 가 아래 탭을 깔기 시작하는 지점과 같은 줄이다. */
const PHONE = 768;

function readSimpleUi(): boolean {
    try {
        const saved = localStorage.getItem(SIMPLE_UI_KEY);
        // 한 번이라도 직접 고른 적이 있으면 그 뜻을 따른다.
        if (saved !== null) return saved === '1';
        // 처음 열었다면 화면 크기로 정한다. 휴대폰에는 상단바와 여러 칸이
        // 들어갈 자리가 없어, 간소화가 기본이 아니면 첫 화면부터 빡빡하다.
        return typeof window !== 'undefined' && window.innerWidth <= PHONE;
    } catch (e) {
        // 저장소를 막아 둔 환경. 끈 것으로 본다.
        return false;
    }
}

export const useCustomizerStore = defineStore({
    id: 'customizer',
    state: () => ({
        Sidebar_drawer: config.Sidebar_drawer,
        mini_sidebar: config.mini_sidebar,
        setHorizontalLayout: config.setHorizontalLayout, // Horizontal layout
        setRTLLayout: config.setRTLLayout, // RTL layout
        actTheme: config.actTheme,
        boxed: config.boxed,
        setBorderCard: config.setBorderCard,

        /**
         * 화면 간소화.
         *
         * 켜면 정의 체계도와 인스턴스 화면이 목록·대화·산출물 세 칸으로만
         * 나온다. 끄면 지금까지의 화면 그대로다 — 기존 화면을 없애지 않고
         * 나란히 두려는 것이라, 기본값은 꺼짐이다.
         *
         * 브라우저에 남겨 새로고침해도 유지한다. 서버에 두지 않는 이유는
         * 기기마다 다르게 쓰고 싶을 수 있어서다(PC 는 그대로, 휴대폰은 간소화).
         */
        simpleUi: readSimpleUi()
    }),

    getters: {},
    actions: {
        SET_SIDEBAR_DRAWER() {
            this.Sidebar_drawer = !this.Sidebar_drawer;
        },
        SET_MINI_SIDEBAR(payload: any) {
            this.mini_sidebar = payload;
        },

        SET_LAYOUT(payload: any) {
            this.setHorizontalLayout = payload;
        },
        SET_THEME(payload: any) {
            this.actTheme = payload;
        },
        SET_CARD_BORDER(payload: any) {
            this.setBorderCard = payload;
        },
        SET_SIMPLE_UI(payload: boolean) {
            this.simpleUi = !!payload;
            try {
                localStorage.setItem(SIMPLE_UI_KEY, this.simpleUi ? '1' : '0');
            } catch (e) {
                /* 저장하지 못해도 이번 세션에는 적용된다 */
            }
        }
    }
});

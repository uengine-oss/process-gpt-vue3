import { defineStore } from 'pinia';
import config from '@/config';

export const useCustomizerStore = defineStore({
    id: 'customizer',
    state: () => ({
        Sidebar_drawer: config.Sidebar_drawer,
        mini_sidebar: config.mini_sidebar,
        setHorizontalLayout: config.setHorizontalLayout, // Horizontal layout
        setRTLLayout: config.setRTLLayout, // RTL layout
        actTheme: config.actTheme,
        boxed: config.boxed,
        setBorderCard: config.setBorderCard
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
        }
    }
});

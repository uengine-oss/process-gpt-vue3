<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import VerticalSidebarVue from './vertical-sidebar/VerticalSidebar.vue';
import VerticalHeaderVue from './vertical-header/VerticalHeader.vue';
import HorizontalHeader from './horizontal-header/HorizontalHeader.vue';
import HorizontalSidebar from './horizontal-sidebar/HorizontalSidebar.vue';
import Customizer from './customizer/Customizer.vue';
import Footer from './Footer.vue';
import { useCustomizerStore } from '../../stores/customizer';
import { useAdminConsoleStore } from '../../stores/adminConsole';
import { pl, zhHans } from 'vuetify/locale';
import { ref, computed, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue';
const customizer = useCustomizerStore();
const adminStore = useAdminConsoleStore();

// ---- Global Notice Banner ----
const bannerDismissed = ref(false);
const bannerConfig = computed(() => adminStore.noticeBanner);
const showBanner = computed(() => {
    if (bannerDismissed.value || !bannerConfig.value?.enabled) return false;
    // 로컬 시간(KST) 기준 YYYY-MM-DD
    const d = new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (bannerConfig.value.start_date && now < bannerConfig.value.start_date) return false;
    if (bannerConfig.value.end_date && now > bannerConfig.value.end_date) return false;
    return !!bannerConfig.value.text;
});
const bannerColorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: 'mdi-information-outline' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: 'mdi-alert-outline' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: 'mdi-alert-circle-outline' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: 'mdi-check-circle-outline' }
};
const bannerStyle = computed(() => bannerColorMap[bannerConfig.value?.color] || bannerColorMap.info);

// globalIsMobile ref로 직접 관리
const globalIsMobile = ref(window.innerWidth <= 768);

// resize 이벤트 리스너 추가
const updateMobileState = () => {
    globalIsMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
    window.addEventListener('resize', updateMobileState);
    adminStore.fetchNoticeBanner();
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', updateMobileState);
});

// 캔버스 full 사이즈 관련 코드
const instance = getCurrentInstance();
const globalState = instance?.appContext.config.globalProperties.$globalState;
const canvasReSize = computed(() => {
    return globalState?.state.isZoomed || globalState?.state.isRightZoomed ? 'canvas-full-layout' : '';
});

const route = useRoute();
const isModelingTab = computed(() => {
    return route.query && route.query.modeling ? true : false;
});
</script>

<template>
    <!-- ===== Floating Global Notice Banner ===== -->
    <transition name="banner-slide">
        <div
            v-if="showBanner"
            class="global-notice-banner"
            :class="`global-notice-banner--${bannerConfig.color || 'info'}`"
        >
            <v-icon size="16" class="global-notice-banner-icon">{{ bannerStyle.icon }}</v-icon>
            <span class="global-notice-banner-text">{{ bannerConfig.text }}</span>
            <button class="global-notice-banner-close" @click="bannerDismissed = true">
                <v-icon size="14">mdi-close</v-icon>
            </button>
        </div>
    </transition>

    <!-----RTL LAYOUT------->
    <v-locale-provider v-if="customizer.setRTLLayout" rtl>
        <v-app
            :theme="customizer.actTheme"
            :class="[
                customizer.actTheme,
                customizer.mini_sidebar ? 'mini-sidebar' : '',
                !customizer.Sidebar_drawer ? 'sidebar-closed' : '',
                customizer.setHorizontalLayout ? 'horizontalLayout' : 'verticalLayout',
                customizer.setBorderCard ? 'cardBordered' : ''
            ]"
        >
            <!---Customizer location left side--->
            <v-navigation-drawer
                app
                temporary
                elevation="10"
                location="left"
                v-model="customizer.Customizer_drawer"
                width="320"
                class="left-customizer"
            >
                <Customizer />
            </v-navigation-drawer>
            <VerticalSidebarVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            <!-- <div v-if="!globalIsMobile" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <div :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <HorizontalHeader v-if="customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <HorizontalSidebar v-if="customizer.setHorizontalLayout && !isModelingTab" /> -->
            <v-main>
                <div class="rtl-lyt mb-3 hr-layout ltr-main-no-header">
                    <v-container
                        fluid
                        :class="globalIsMobile ? 'page-wrapper bg-background' : 'page-wrapper bg-background px-sm-5 px-4 pt-4 rounded-xl'"
                    >
                        <div class="">
                            <div :class="customizer.boxed ? 'maxWidth' : ''">
                                <RouterView v-slot="{ Component, route }">
                                    <transition name="slide-fade" mode="out-in">
                                        <component :is="Component" :key="route.name || route.path" />
                                    </transition>
                                </RouterView>
                            </div>
                        </div>
                    </v-container>
                </div>
            </v-main>
        </v-app>
    </v-locale-provider>

    <!-----LTR LAYOUT------->
    <v-locale-provider v-else>
        <v-app
            :theme="customizer.actTheme"
            :class="[
                customizer.actTheme,
                customizer.mini_sidebar ? 'mini-sidebar' : '',
                !customizer.Sidebar_drawer ? 'sidebar-closed' : '',
                customizer.setHorizontalLayout ? 'horizontalLayout' : 'verticalLayout',
                customizer.setBorderCard ? 'cardBordered' : ''
            ]"
        >
            <!---Customizer location right side--->
            <v-navigation-drawer app temporary elevation="10" location="right" v-model="customizer.Customizer_drawer" width="320">
                <Customizer />
            </v-navigation-drawer>
            <VerticalSidebarVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            <!-- <div v-if="!globalIsMobile" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <div :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <HorizontalHeader v-if="customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <HorizontalSidebar v-if="customizer.setHorizontalLayout && !isModelingTab" /> -->

            <v-main>
                <div class="hr-layout ltr-main-no-header">
                    <v-container
                        fluid
                        :class="globalIsMobile ? 'page-wrapper bg-background pa-0' : 'page-wrapper bg-background px-sm-4 pt-5 px-4 rounded-xl'"
                    >
                        <!-- 정의관련 maxWidth -->
                        <div :class="[customizer.boxed ? 'maxWidth' : '', canvasReSize]">
                            <RouterView v-slot="{ Component, route }">
                                <transition name="slide-fade" mode="out-in">
                                    <component :is="Component" :key="route.name || route.path" />
                                </transition>
                            </RouterView>
                        </div>
                    </v-container>
                </div>
            </v-main>
        </v-app>
    </v-locale-provider>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.25s ease;
}
.slide-fade-enter-from {
    opacity: 0;
    transform: translateX(30px);
}
.slide-fade-leave-to {
    opacity: 0;
    transform: translateX(-30px);
}

/* ── Global Notice Banner (Floating) ───────────────────── */
.global-notice-banner {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    max-width: min(720px, calc(100vw - 32px));
    pointer-events: auto;
}
.global-notice-banner-icon {
    flex-shrink: 0;
}
.global-notice-banner-text {
    flex: 1;
}
.global-notice-banner-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s, background 0.15s;
    margin-left: 4px;
}
.global-notice-banner-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.08);
}

/* Color variants */
.global-notice-banner--info {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
}
.global-notice-banner--warning {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
}
.global-notice-banner--error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
}
.global-notice-banner--success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
}

.ltr-main-no-header {
    padding-top: 0px !important;
    height: calc(100vh - 6px) !important;
}

/* Banner transition */
.banner-slide-enter-active {
    transition: all 0.3s ease;
}
.banner-slide-leave-active {
    transition: all 0.2s ease;
}
.banner-slide-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
}
.banner-slide-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
}
</style>

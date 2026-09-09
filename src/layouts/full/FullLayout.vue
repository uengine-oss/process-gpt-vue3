<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import VerticalSidebarVue from './vertical-sidebar/VerticalSidebar.vue';
import VerticalHeaderVue from './vertical-header/VerticalHeader.vue';
import HorizontalHeader from './horizontal-header/HorizontalHeader.vue';
import HorizontalSidebar from './horizontal-sidebar/HorizontalSidebar.vue';
import GlobalNoticeBanner from './GlobalNoticeBanner.vue';
import { useCustomizerStore } from '../../stores/customizer';
import { ref, computed, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue';
const customizer = useCustomizerStore();

// globalIsMobile ref로 직접 관리
const globalIsMobile = ref(window.innerWidth <= 768);

// resize 이벤트 리스너 추가
const updateMobileState = () => {
    globalIsMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
    window.addEventListener('resize', updateMobileState);
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
const isPalMode = computed(() => !!(window as any).$pal);

const showSidebarOpenButton = computed(() => {
    return (
        isPalMode.value &&
        !globalIsMobile.value &&
        !customizer.setHorizontalLayout &&
        !isModelingTab.value &&
        !customizer.Sidebar_drawer
    );
});

const openSidebar = () => {
    if (!customizer.Sidebar_drawer) {
        customizer.SET_SIDEBAR_DRAWER();
    }
};
</script>

<template>
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
            <VerticalSidebarVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            <div v-if="!isPalMode && !globalIsMobile" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <v-tooltip v-if="showSidebarOpenButton" text="사이드바 펼치기" location="right">
                <template #activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="mdi-chevron-right"
                        color="primary"
                        elevation="6"
                        class="sidebar-open-floating-button"
                        aria-label="사이드바 펼치기"
                        @click="openSidebar"
                    />
                </template>
            </v-tooltip>
            <div :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <HorizontalHeader v-if="customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <HorizontalSidebar v-if="customizer.setHorizontalLayout && !isModelingTab" />
            <v-main :class="{ 'pal-main-no-header': isPalMode }">
                <div class="rtl-lyt mb-3 hr-layout">
                    <v-container
                        fluid
                        :class="[
                            globalIsMobile
                                ? 'page-wrapper bg-background'
                                : `page-wrapper bg-background px-sm-5 px-4 ${isPalMode ? 'pt-5 pb-5' : 'pt-12'} rounded-xl`,
                            { 'pal-content-container': isPalMode }
                        ]"
                    >
                        <div :class="{ 'pal-page-shell': isPalMode }">
                            <div :class="[customizer.boxed ? 'maxWidth' : '', { 'pal-page-frame': isPalMode }]">
                                <GlobalNoticeBanner />
                                <RouterView />
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
            <VerticalSidebarVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            <div v-if="!isPalMode && !globalIsMobile" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <v-tooltip v-if="showSidebarOpenButton" text="사이드바 펼치기" location="right">
                <template #activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="mdi-chevron-right"
                        color="primary"
                        elevation="6"
                        class="sidebar-open-floating-button"
                        aria-label="사이드바 펼치기"
                        @click="openSidebar"
                    />
                </template>
            </v-tooltip>
            <div :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <HorizontalHeader v-if="customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <HorizontalSidebar v-if="customizer.setHorizontalLayout && !isModelingTab" />

            <v-main :class="{ 'pal-main-no-header': isPalMode }" :style="globalIsMobile ? 'padding-top: 0px;' : ''">
                <div class="hr-layout">
                    <v-container
                        fluid
                        :class="[
                            globalIsMobile
                                ? 'page-wrapper bg-background pa-0'
                                : `page-wrapper bg-background px-sm-4 ${isPalMode ? 'pt-5 pb-5' : 'pt-9'} px-4 rounded-xl`,
                            { 'pal-content-container': isPalMode }
                        ]"
                    >
                        <!-- 정의관련 maxWidth -->
                        <div :class="[customizer.boxed ? 'maxWidth' : '', canvasReSize, { 'pal-page-frame': isPalMode }]">
                            <GlobalNoticeBanner />
                            <RouterView />
                        </div>
                    </v-container>
                </div>
                <!-- <footer class="footer">
                    <Footer />
                </footer> -->
            </v-main>
        </v-app>
    </v-locale-provider>
</template>

<style scoped>
/* 사이드바 펼치기 — 좌측 가장자리 중앙의 드로어 핸들.
   이전에는 top:20/left:18 원형 FAB 였는데, 사이드바를 닫으면 모든 페이지의
   좌상단 컨트롤(예: 프로세스 순서도의 트리 패널 접기/펼치기 버튼, 페이지 제목)을
   정확히 덮었다. 콘텐츠가 없는 화면 좌측 중앙 가장자리에 붙여 충돌을 없앤다. */
.sidebar-open-floating-button {
    position: fixed !important;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    z-index: 1200;
    width: 22px !important;
    min-width: 0 !important;
    height: 64px !important;
    border-radius: 0 10px 10px 0 !important;
    opacity: 0.85;
    transition: width 0.15s ease, opacity 0.15s ease;
}

.sidebar-open-floating-button:hover {
    width: 30px !important;
    opacity: 1;
}

.pal-main-no-header {
    padding-top: 0 !important;
}

.pal-content-container {
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    max-height: 100vh;
    max-height: 100dvh;
    box-sizing: border-box;
    overflow: hidden;
}

.pal-page-shell,
.pal-page-frame {
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
    max-width: 100%;
    max-height: 100%;
}

.pal-page-shell {
    overflow: hidden;
}

.pal-page-frame {
    position: relative;
    overflow: auto;
}

.pal-page-frame > :deep(:not(.global-notice-banner)) {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 100%;
    max-width: 100%;
    max-height: 100%;
}

[dir='rtl'] .sidebar-open-floating-button {
    right: 0;
    left: auto;
    border-radius: 10px 0 0 10px !important;
}
</style>

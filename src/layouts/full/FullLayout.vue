<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import VerticalSidebarVue from './vertical-sidebar/VerticalSidebar.vue';
import VerticalHeaderVue from './vertical-header/VerticalHeader.vue';
import HorizontalHeader from './horizontal-header/HorizontalHeader.vue';
import HorizontalSidebar from './horizontal-sidebar/HorizontalSidebar.vue';
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
                        icon="mdi-menu-open"
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
                        :class="
                            globalIsMobile
                                ? 'page-wrapper bg-background'
                                : `page-wrapper bg-background px-sm-5 px-4 ${isPalMode ? 'pt-5 pb-5 pal-content-container' : 'pt-12'} rounded-xl`
                        "
                    >
                        <div class="">
                            <div :class="customizer.boxed ? 'maxWidth' : ''">
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
                        icon="mdi-menu-open"
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
                        :class="
                            globalIsMobile
                                ? 'page-wrapper bg-background pa-0'
                                : `page-wrapper bg-background px-sm-4 ${isPalMode ? 'pt-5 pb-5 pal-content-container' : 'pt-9'} px-4 rounded-xl`
                        "
                    >
                        <!-- 정의관련 maxWidth -->
                        <div :class="[customizer.boxed ? 'maxWidth' : '', canvasReSize]">
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
.sidebar-open-floating-button {
    position: fixed !important;
    top: 20px;
    left: 18px;
    z-index: 1200;
    width: 44px;
    height: 44px;
}

.pal-main-no-header {
    padding-top: 0 !important;
}

.pal-content-container {
    min-height: 100vh;
    box-sizing: border-box;
}

[dir='rtl'] .sidebar-open-floating-button {
    right: 18px;
    left: auto;
}
</style>

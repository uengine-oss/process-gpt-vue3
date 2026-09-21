<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import VerticalSidebarVue from './vertical-sidebar/VerticalSidebar.vue';
import VerticalHeaderVue from './vertical-header/VerticalHeader.vue';
import HorizontalHeader from './horizontal-header/HorizontalHeader.vue';
import HorizontalSidebar from './horizontal-sidebar/HorizontalSidebar.vue';
import GlobalNoticeBanner from './GlobalNoticeBanner.vue';
import MobileTabBar from './MobileTabBar.vue';
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

/**
 * 간소화 화면에서 사이드바를 여는 단추.
 *
 * 상단바를 걷어내면서 거기 있던 메뉴 단추도 같이 사라졌다. 1280px 아래에서는
 * 사이드바가 서랍이라 닫히면 여는 방법이 없어진다 — 폰은 아래 탭이 대신하지만
 * 그 사이 폭(769~1279)은 갈 곳이 없었다. 클로드처럼 왼쪽 위에 둔다.
 */
const showSimpleSidebarButton = computed(() => {
    return customizer.simpleUi && !globalIsMobile.value && !isModelingTab.value && !customizer.Sidebar_drawer;
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
            <!--
                간소화 화면에는 상단바가 없다. 거기 있던 단추들은 사이드바로 옮겼다
                (SimpleSidebarTools) — 갈 곳이 한 군데면 찾으러 다닐 일이 없다.
            -->
            <div v-if="!isPalMode && !globalIsMobile && !customizer.simpleUi" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <v-btn
                v-if="showSimpleSidebarButton"
                icon="mdi-menu"
                variant="text"
                density="comfortable"
                class="pg-open-sidebar-btn"
                aria-label="사이드바 열기"
                @click="openSidebar"
            />
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
            <v-main :class="{ 'pal-main-no-header': isPalMode, 'pg-no-header': customizer.simpleUi && !globalIsMobile }">
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
                        <GlobalNoticeBanner />
                        <div :class="{ 'pal-page-shell': isPalMode }">
                            <div :class="[customizer.boxed ? 'maxWidth' : '', { 'pal-page-frame': isPalMode }]">
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
            <!--
                간소화 화면에는 상단바가 없다. 거기 있던 단추들은 사이드바로 옮겼다
                (SimpleSidebarTools) — 갈 곳이 한 군데면 찾으러 다닐 일이 없다.
            -->
            <div v-if="!isPalMode && !globalIsMobile && !customizer.simpleUi" :class="customizer.boxed ? 'maxWidth' : 'full-header'">
                <VerticalHeaderVue v-if="!customizer.setHorizontalLayout && !isModelingTab" />
            </div>
            <v-btn
                v-if="showSimpleSidebarButton"
                icon="mdi-menu"
                variant="text"
                density="comfortable"
                class="pg-open-sidebar-btn"
                aria-label="사이드바 열기"
                @click="openSidebar"
            />
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

            <v-main
                :class="{ 'pal-main-no-header': isPalMode, 'pg-no-header': customizer.simpleUi && !globalIsMobile }"
                :style="globalIsMobile ? 'padding-top: 0px;' : ''"
            >
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
                        <GlobalNoticeBanner />
                        <!-- 정의관련 maxWidth -->
                        <div :class="[customizer.boxed ? 'maxWidth' : '', canvasReSize, { 'pal-page-frame': isPalMode }]">
                            <RouterView />
                        </div>
                    </v-container>
                </div>
                <!-- <footer class="footer">
                    <Footer />
                </footer> -->
            </v-main>
            <!-- 작은 화면의 아래 탭. 스스로 폭과 로그인 여부를 보고 필요할 때만 나온다. -->
            <MobileTabBar />
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
    /* 공지 배너가 있으면 flex 로 세로 공간을 나눠, 배너가 페이지 콘텐츠를
       덮지 않고 아래 프레임이 남은 높이를 차지하게 한다. */
    display: flex;
    flex-direction: column;
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

.pal-content-container > .pal-page-shell,
.pal-content-container > .pal-page-frame {
    flex: 1 1 auto;
    height: auto;
}

.pal-page-shell {
    overflow: hidden;
}

.pal-page-frame {
    position: relative;
    overflow: auto;
}

.pal-page-frame > :deep(*) {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 100%;
    max-width: 100%;
    max-height: 100%;
}

/*
 * 왼쪽 위 모서리. 본문 카드가 시작되기 전 여백에 얹는다.
 * 카드가 화면 가장자리에서 20px 떨어져 있으므로 단추도 같은 만큼 띄운다 —
 * 모서리에 딱 붙여 두면 화면에 눌러 붙은 것처럼 보인다.
 */
.pg-open-sidebar-btn {
    position: fixed !important;
    top: 6px;
    left: 10px;
    z-index: 1210;
}

/*
 * 단추가 본문 위에 얹히면 제목과 붙어 보인다. 사이드바가 서랍으로 바뀌는
 * 구간에서는 그 높이만큼 본문을 내려, 단추가 제 줄을 갖게 한다.
 * 서랍을 여닫아도 이 여백은 그대로라 화면이 튀지 않는다.
 */
@media only screen and (max-width: 1279px) {
    /*
     * 본문 컨테이너가 이미 36px 쯤 띄워 놓는다. 단추(6~42px) 아래로 10px 만
     * 더 벌어지면 충분하다 — 그래서 여기서 보태는 것은 16px 이다.
     */
    .pg-no-header {
        padding-top: 16px !important;
    }
}

[dir='rtl'] .pg-open-sidebar-btn {
    left: auto;
    right: 20px;
}

[dir='rtl'] .sidebar-open-floating-button {
    right: 0;
    left: auto;
    border-radius: 10px 0 0 10px !important;
}
</style>

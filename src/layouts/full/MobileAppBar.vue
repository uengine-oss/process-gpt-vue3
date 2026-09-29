<template>
    <!--
        휴대폰 간소화 화면의 윗줄. 클로드 모바일과 같은 자리 배치다 —
        왼쪽 사이드바 단추, 그 옆 제목, 오른쪽 끝 새 대화.
        화면마다 붙일 단추(산출물·설정 등)는 #pg-m-appbar-actions 로 옮겨 온다.
    -->
    <header class="pg-m-appbar" data-testid="mobile-appbar">
        <button type="button" class="pg-m-appbar__btn" aria-label="사이드바 열기" data-testid="mobile-sidebar-open" @click="openSidebar">
            <!-- 둥근 네모 안에 왼쪽 칸 — '옆 목록을 연다' 는 뜻. 채운 아이콘은 너무 무겁다. -->
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" stroke="currentColor" stroke-width="1.5" />
                <path d="M7.5 4v12" stroke="currentColor" stroke-width="1.5" />
            </svg>
        </button>
        <div class="pg-m-appbar__title" :title="title">{{ title }}</div>
        <div id="pg-m-appbar-actions" class="pg-m-appbar__actions"></div>
        <!-- 알림은 아래 탭에 있던 것을 그대로 옮겨 온다. 상태를 알리는 것이라 서랍 안에 접어 두지 않는다. -->
        <div class="pg-m-appbar__noti" data-testid="mobile-notifications">
            <NotificationDD menu-location="bottom end" />
        </div>
        <button type="button" class="pg-m-appbar__btn" aria-label="새 채팅" data-testid="mobile-new-chat" @click="newChat">
            <v-icon size="20">mdi-square-edit-outline</v-icon>
        </button>
    </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCustomizerStore } from '@/stores/customizer';
import { usePhoneShell } from '@/shared/phoneShell';
import NotificationDD from './vertical-header/NotificationDD.vue';

const route = useRoute();
const router = useRouter();
const customizer = useCustomizerStore();
const { state } = usePhoneShell();

/**
 * 화면이 제목을 정하지 않았을 때 쓰는 이름. 새 대화 화면과 목록 화면은 비워 둔다 —
 * 클로드도 그 두 곳에서는 앱바에 제목이 없고, 목록은 본문에 큰 제목을 단다.
 */
const FALLBACK: Array<[string, string]> = [
    ['/definition-map', ''],
    ['/todolist', ''],
    ['/instancelist', '할 일'],
    ['/account-settings', '설정'],
    ['/knowledge', '지식베이스'],
    ['/my-feedback', '내 피드백'],
    ['/strategy-board', '전략 보드']
];

const title = computed(() => {
    if (state.titlePath === route.path && state.title) return state.title;
    const hit = FALLBACK.find(([p]) => route.path === p || route.path.startsWith(p + '/'));
    return hit ? hit[1] : '';
});

function openSidebar() {
    if (!customizer.Sidebar_drawer) customizer.SET_SIDEBAR_DRAWER();
}

function newChat() {
    if (route.path !== '/definition-map') router.push('/definition-map');
}
</script>

<style scoped>
.pg-m-appbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    /* 본문보다 위, 전체 화면 사이드바(1010)보다 아래. */
    z-index: 1004;
    display: flex;
    align-items: center;
    gap: 4px;
    height: calc(48px + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) 8px 0;
    background: var(--pg-m-page);
}

.pg-m-appbar__btn {
    position: relative;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--pg-m-text);
    -webkit-tap-highlight-color: transparent;
}

.pg-m-appbar__btn:active {
    background: var(--pg-m-hover);
}

/* 알림 단추는 상단바용이라 크기가 다르다. 옆 단추들과 같은 32px 칸에 맞춘다. */
.pg-m-appbar__noti :deep(.v-btn) {
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px;
    background: transparent !important;
    color: var(--pg-m-text);
}

/* 종 아이콘은 기본 24px 로 그려져 옆의 20px 아이콘들보다 커 보였다. 같은 20px 로 맞춘다
   (Icons 가 크기를 인라인 스타일로 넣으므로 !important 로 덮는다). */
.pg-m-appbar__noti :deep([icon]),
.pg-m-appbar__noti :deep([icon] svg) {
    width: 20px !important;
    height: 20px !important;
}

.pg-m-appbar__title {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 6px;
    font-size: 14px;
    line-height: 20px;
    color: var(--pg-m-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-m-appbar__actions {
    display: flex;
    align-items: center;
    gap: 2px;
}
</style>

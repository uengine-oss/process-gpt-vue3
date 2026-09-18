<template>
    <nav v-if="show" class="pg-tabbar" aria-label="주요 화면">
        <RouterLink v-for="tab in tabs" :key="tab.name" :to="tab.to" class="pg-tabbar__item" :class="{ 'pg-tabbar__item--on': isOn(tab) }">
            <v-icon size="22">{{ isOn(tab) ? tab.iconOn : tab.icon }}</v-icon>
            <span>{{ tab.label }}</span>
        </RouterLink>
    </nav>
</template>

<script setup lang="ts">
/**
 * 작은 화면의 아래 탭.
 *
 * 왜 포털에 두는가
 *   앱 껍데기가 주입하던 것을 옮겨 왔다. 껍데기가 넣으면 두 가지가 어긋난다 —
 *   웹을 좁게 열면 탭이 없어 화면이 서로 다르고, 탭이 가리는 만큼의 여백을
 *   포털 CSS 가 알지 못해 채팅 입력창이 탭 밑으로 들어갔다.
 *   같은 코드 안에 두면 그 여백을 여기서 함께 정한다.
 *
 * 왜 768px 인가
 *   휴대폰 폭이다. 노트북을 조금 좁게 쓰는 사람에게까지 아래 탭을 붙이면
 *   어색하다. 포털은 1280px 아래를 이미 '모바일'로 보지만, 그 구간은 서랍만
 *   바뀌는 정도라 탭까지 넣지는 않는다.
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';

const PHONE = 768;

const route = useRoute();
const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const signedIn = ref(false);

const tabs = [
    // 첫 탭은 정의 체계도로 보낸다. 간소화 화면에서 그곳이 이미 빈 입력창 하나라,
    // 똑같은 시작 화면을 /chats 에 따로 두고 있을 까닭이 없다.
    // 지난 대화는 그 화면 오른쪽 위 히스토리 단추로 열린다.
    {
        name: 'chat',
        label: '채팅',
        to: '/definition-map',
        icon: 'mdi-message-outline',
        iconOn: 'mdi-message',
        match: ['/definition-map', '/chats', '/chat']
    },
    {
        name: 'tasks',
        label: '할 일',
        to: '/todolist',
        icon: 'mdi-checkbox-marked-outline',
        iconOn: 'mdi-checkbox-marked',
        // 인스턴스의 대화는 할 일에서 카드를 눌러 들어간다. 그 안에서 탭이 꺼지면
        // 어느 갈래에 있는지를 놓친다.
        match: ['/todolist', '/instancelist', '/instance-viewer']
    },
    { name: 'me', label: '내 정보', to: '/account-settings', icon: 'mdi-account-outline', iconOn: 'mdi-account', match: ['/account-settings'] }
];

/** 로그인 전에는 탭을 두지 않는다. 누를 수 있는 곳이 없기 때문이다. */
function readSignedIn() {
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

function onResize() {
    width.value = window.innerWidth;
    signedIn.value = readSignedIn();
}

onMounted(() => {
    onResize();
    window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

const show = computed(() => width.value <= PHONE && signedIn.value);

function isOn(tab: { match: string[] }) {
    const p = route.path;
    return tab.match.some((m) => p === m || p.startsWith(m + '/'));
}
</script>

<style>
/*
 * 전역이다(scoped 아님). 탭이 가리는 만큼 본문 아래를 비워 주어야 하는데,
 * 그 대상이 이 컴포넌트 밖(v-main, 채팅 입력창)에 있기 때문이다.
 */
:root {
    --pg-tabbar-h: 56px;
}

@media (max-width: 768px) {
    body:has(.pg-tabbar) .v-main {
        padding-bottom: calc(var(--pg-tabbar-h) + env(safe-area-inset-bottom, 0px)) !important;
    }

    /* 포털의 메뉴 단추. 탭이 그 일을 대신하므로 감춘다 — 남겨 두면 채팅
       입력창 위에 떠서 보내기 버튼을 가린다. */
    body:has(.pg-tabbar) .mobile-side-bar-btn {
        display: none !important;
    }

    /* 대화 목록 서랍을 여는 단추. 작은 화면에서는 목록이 오른쪽 위 히스토리
       버튼으로 열리므로 쓸 곳이 없는데, 화면 왼쪽 위에 반투명하게 떠서
       제목을 덮는다. */
    body:has(.pg-tabbar) .mobile-menu-toggle-btn {
        display: none !important;
    }
}
</style>

<style scoped>
.pg-tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1100;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: stretch;
    min-height: var(--pg-tabbar-h);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--cds-surface-1, #fff);
    border-top: 1px solid var(--cds-border, rgba(0, 0, 0, 0.08));
}

.pg-tabbar__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-decoration: none;
    color: var(--cds-text-muted, #6b7280);
    -webkit-tap-highlight-color: transparent;
}

.pg-tabbar__item--on {
    color: rgb(var(--v-theme-primary));
}
</style>

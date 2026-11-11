<template>
    <div class="m-screen">
        <InstallBar />
        <slot />

        <nav class="m-tabs" aria-label="주요 화면">
            <RouterLink
                v-for="tab in TABS"
                :key="tab.name"
                class="m-tab"
                :class="{ 'm-tab--on': current === tab.name }"
                :to="tab.to"
                :aria-current="current === tab.name ? 'page' : undefined"
                :aria-label="countOf(tab.name) ? `${tab.label} ${countOf(tab.name)}건` : tab.label"
            >
                <span class="m-tab__icon">
                    <Icon :name="tab.icon" :size="24" />
                    <span v-if="countOf(tab.name)" class="m-tab__badge">{{ countText(tab.name) }}</span>
                </span>
                <span>{{ tab.label }}</span>
            </RouterLink>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import Icon from '../components/Icon.vue';
import InstallBar from '../components/InstallBar.vue';
import { badges, refreshBadges, watchBadges } from '../lib/badges.js';

/**
 * 아래 탭 다섯 칸 — 할 일 · 진행 · AI · 알림 · 나.
 *
 * 휴대폰에서는 일하는 사람의 일만 남긴다(관리 · 설계 · 분석은 PC). 서랍 메뉴 대신 늘 보이는 다섯 칸이라
 * 어느 화면에서든 한 번에 옮겨 간다. 할 일 · 알림에는 지금 손댈 것의 수를 붙인다.
 */
const TABS = [
    { name: 'tasks', label: '할 일', to: '/tasks', icon: 'checkbox' },
    { name: 'progress', label: '진행', to: '/progress', icon: 'progress' },
    { name: 'chat', label: 'AI', to: '/chat', icon: 'sparkle' },
    { name: 'notifications', label: '알림', to: '/notifications', icon: 'bell' },
    { name: 'me', label: '나', to: '/me', icon: 'account' }
] as const;

const route = useRoute();
const current = computed(() => (route.meta?.tab as string) || '');

function countOf(name: string) {
    if (name === 'tasks') return badges.tasks;
    if (name === 'notifications') return badges.notifications;
    return 0;
}

function countText(name: string) {
    const n = countOf(name);
    return n > 99 ? '99+' : String(n);
}

onMounted(() => {
    void refreshBadges();
    watchBadges();
});

// 탭을 옮길 때마다 다시 센다 — 처리하고 돌아오면 숫자가 줄어 있어야 한다.
watch(() => route.fullPath, () => void refreshBadges());
</script>

<template>
    <div class="m-screen">
        <slot />

        <nav class="m-tabs" aria-label="주요 화면">
            <RouterLink
                v-for="tab in TABS"
                :key="tab.name"
                class="m-tab"
                :class="{ 'm-tab--on': current === tab.name }"
                :to="tab.to"
                :aria-current="current === tab.name ? 'page' : undefined"
            >
                <Icon :name="tab.icon" :size="22" />
                <span>{{ tab.label }}</span>
            </RouterLink>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import Icon from '../components/Icon.vue';

/**
 * 셋으로 줄인 이유
 *   손가락으로 누를 수 있는 크기를 지키면 한 줄에 넉넉히 들어가는 것은 서넛이다.
 *   진행 현황은 할 일과 같은 것을 다른 각도로 본 것이라(내 차례냐 아니냐), 별도
 *   탭보다 할 일 안의 필터가 맞다. 프로세스 시작도 할 일 화면의 버튼으로 둔다 —
 *   시작보다 처리가 훨씬 잦다.
 *
 * 채팅이 첫 번째인 이유
 *   물어보는 일이 가장 잦고, 앱을 열자마자 바로 쓰게 된다.
 */
const TABS = [
    { name: 'chat', label: '채팅', to: '/chat', icon: 'chat' },
    { name: 'tasks', label: '할 일', to: '/tasks', icon: 'tasks' },
    { name: 'me', label: '내 정보', to: '/me', icon: 'account' }
] as const;

const route = useRoute();
const current = computed(() => (route.meta?.tab as string) || '');
</script>

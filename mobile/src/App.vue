<template>
    <!--
      로그인 화면에는 하단 탭을 두지 않는다. 아직 들어갈 수 없는 곳들이라
      눌러도 다시 여기로 튕겨 나오고, 그러면 갇힌 것처럼 보인다.
    -->
    <!--
      첫 화면이 아직 정해지지 않았다.

      화면 컴포넌트는 따로 받아 오므로(코드 분할), 붙은 직후 잠깐은 그릴 것이
      없다. 그 동안 아래 RouterView 는 아무것도 그리지 않고, 하단 탭도
      route.meta 를 보고 정하므로 함께 사라진다 — 결과는 **빈 화면**이다.
      알림을 눌러 앱이 꺼진 상태에서 시작하면 그것이 몇 초씩 간다. 화면이 멈춘
      것과 구분되지 않아서 사용자는 앱을 다시 누른다.

      index.html 도 같은 것을 보여 준다. 거기는 이 코드가 오기 전까지,
      여기는 온 뒤부터 — 둘이 이어져야 빈 화면이 생기지 않는다.
    -->
    <div v-if="!routeResolved" class="boot" role="status" aria-live="polite">
        <span class="boot__spinner" aria-hidden="true"></span>
        <span>불러오는 중…</span>
    </div>

    <MobileShell v-else-if="showsTabs">
        <RouterView />
    </MobileShell>
    <RouterView v-else />

    <!-- 앱을 보고 있는 동안 온 알림. 화면 위에 잠깐 뜬다. -->
    <PushBanner ref="pushBanner" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import PushBanner from './components/PushBanner.vue';
import MobileShell from './layouts/MobileShell.vue';
import { setBannerHost } from './lib/pushBannerHost.js';

const route = useRoute();
const showsTabs = computed(() => Boolean(route.meta?.tab));

/**
 * 갈 곳이 정해졌는가.
 *
 * 첫 이동이 끝나기 전에는 vue-router 가 START_LOCATION 을 준다 — matched 가
 * 비어 있어서 RouterView 가 그릴 것이 없다. 그 상태를 빈 화면 대신 "불러오는
 * 중" 으로 보여 준다.
 */
const routeResolved = computed(() => (route.matched?.length ?? 0) > 0);

// 알림이 오면 이 배너를 통해 보여 준다. 시작점(main.ts)이 여기를 찾아 쓴다.
const pushBanner = ref<any>(null);
onMounted(() => setBannerHost(pushBanner.value));
onUnmounted(() => setBannerHost(null));
</script>

<style scoped>
/*
  index.html 의 것과 같은 모양이다. 앱이 붙는 순간 그것이 이것으로 바뀌는데,
  둘이 다르면 그 지점에서 화면이 덜컹인다.
*/
.boot {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: var(--ground);
    color: var(--ink-faint);
    font-size: 0.9rem;
}

.boot__spinner {
    width: 26px;
    height: 26px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    opacity: 0.55;
    animation: boot-spin 0.8s linear infinite;
}

@keyframes boot-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .boot__spinner {
        animation: none;
        border-top-color: currentColor;
        opacity: 0.35;
    }
}
</style>

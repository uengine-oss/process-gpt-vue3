<template>
    <!--
      로그인 화면에는 하단 탭을 두지 않는다. 아직 들어갈 수 없는 곳들이라
      눌러도 다시 여기로 튕겨 나오고, 그러면 갇힌 것처럼 보인다.
    -->
    <MobileShell v-if="showsTabs">
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

// 알림이 오면 이 배너를 통해 보여 준다. 시작점(main.ts)이 여기를 찾아 쓴다.
const pushBanner = ref<any>(null);
onMounted(() => setBannerHost(pushBanner.value));
onUnmounted(() => setBannerHost(null));
</script>

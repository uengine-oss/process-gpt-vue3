<template>
    <Transition name="banner">
        <button
            v-if="banner"
            type="button"
            class="banner"
            :aria-label="`${banner.title} 알림 열기`"
            @click="open"
        >
            <img class="banner__logo" src="/process-gpt-favicon.png" alt="" aria-hidden="true" />
            <span class="banner__text">
                <strong class="banner__title">{{ banner.title }}</strong>
                <span v-if="banner.body" class="banner__body">{{ banner.body }}</span>
            </span>
            <span class="banner__x" role="none" @click.stop="dismiss">
                <Icon name="close" :size="16" />
            </span>
        </button>
    </Transition>
</template>

<script setup lang="ts">
/**
 * 앱을 보고 있는 동안 온 알림.
 *
 * 기기 배너는 앱이 꺼져 있거나 뒤에 있을 때만 뜬다. 앱을 보고 있을 때 온 알림은
 * 아무 일도 일어나지 않은 것처럼 지나가므로, 여기서 같은 모양으로 띄운다.
 * 누르면 그 건으로 바로 간다 — 알림 서랍을 거치지 않아 오히려 빠르다.
 */

import { onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AUTO_DISMISS_MS, isSame } from '../lib/banner.js';
import Icon from './Icon.vue';

const router = useRouter();
const banner = ref<any>(null);
let timer: any = null;

function show(next: any) {
    if (!next || isSame(banner.value, next)) return;
    banner.value = next;

    // 화면을 오래 가리지 않는다. 새 알림이 오면 시간도 새로 센다.
    clearTimeout(timer);
    timer = setTimeout(() => (banner.value = null), AUTO_DISMISS_MS);
}

function dismiss() {
    clearTimeout(timer);
    banner.value = null;
}

function open() {
    const to = banner.value?.route;
    dismiss();
    if (to) void router.push(to);
}

onUnmounted(() => clearTimeout(timer));

defineExpose({ show, dismiss });
</script>

<style scoped>
.banner {
    position: fixed;
    top: calc(var(--safe-top) + 8px);
    left: 12px;
    right: 12px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 14px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--rule);
    /* 아래 화면과 확실히 떨어져 보이도록. 배너는 잠깐 떠 있는 것이다. */
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    text-align: left;
}

.banner__logo {
    width: 26px;
    height: 26px;
    flex: none;
}

.banner__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.banner__title {
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.3;
}

.banner__body {
    font-size: 0.84rem;
    color: var(--ink-soft);
    /* 두 줄까지만. 배너가 화면을 덮으면 알림이 아니라 방해가 된다. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.banner__x {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    flex: none;
    color: var(--ink-faint);
}

@media (prefers-reduced-motion: no-preference) {
    .banner-enter-active,
    .banner-leave-active {
        transition: transform 0.22s ease, opacity 0.22s ease;
    }
    .banner-enter-from,
    .banner-leave-to {
        transform: translateY(-12px);
        opacity: 0;
    }
}
</style>

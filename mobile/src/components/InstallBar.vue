<template>
    <div v-if="visible" class="install-bar" data-testid="install-bar">
        <div class="install-bar__row">
            <span class="install-bar__text">홈 화면에 추가하면 앱처럼 바로 열 수 있습니다</span>
            <button class="install-bar__add" type="button" data-testid="add-to-home-screen" @click="add">홈 화면에 추가</button>
            <button class="install-bar__hide" type="button" data-testid="install-bar-hide" @click="hide">다시 보지 않기</button>
        </div>
        <ol v-if="steps.length" class="install-bar__steps" data-testid="add-to-home-guide">
            <li v-for="s in steps" :key="s">{{ s }}</li>
        </ol>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { hideInstallBar, installGuide, shouldShowInstallBar } from '@/shared/mobileView';
import { promptInstall, webAppInstall } from '@/utils/webAppInstall';

/**
 * 맨 위 「홈 화면에 추가」 띠 — 포털 머리의 띠(InstallAppBar)와 같은 규칙 · 같은 저장값을 쓴다.
 *
 * 휴대폰 브라우저에서 아직 홈 화면에 앱으로 추가하지 않았을 때만 보인다. 브라우저가 설치 창을 띄울 수 있으면 띄우고,
 * 못 띄우면(iPhone 사파리 등) 누를 곳을 띠 아래에 펼쳐 보인다. 「다시 보지 않기」는 웹으로 계속 쓰겠다는 뜻이라
 * 그 기기에서는 다시 띄우지 않는다. 앱(Capacitor) 안에서는 보이지 않는다.
 */
const web = !(window as any).Capacitor?.isNativePlatform?.();
const phone = !!window.matchMedia?.('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 768;

const show = ref(web && shouldShowInstallBar(window, { phone }));
const visible = computed(() => show.value && !webAppInstall.installed);
const steps = ref<string[]>([]);

const GUIDE: Record<string, string[]> = {
    ios: [
        'Safari 아래쪽(iPad는 위쪽)의 공유 단추(네모 위로 화살표가 나온 모양)를 누릅니다.',
        '목록을 내려 「홈 화면에 추가」를 누릅니다.',
        '오른쪽 위의 「추가」를 누릅니다.'
    ],
    android: ['브라우저 오른쪽 위의 메뉴(⋮)를 누릅니다.', '「홈 화면에 추가」 또는 「앱 설치」를 누릅니다.'],
    desktop: ['주소창 오른쪽의 설치 아이콘을 누르거나 브라우저 메뉴를 엽니다.', '「앱 설치」 또는 「홈 화면에 추가」를 누릅니다.']
};

async function add() {
    if ((await promptInstall()) !== 'unavailable') return;
    const g = installGuide({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints });
    steps.value = GUIDE[g] || GUIDE.desktop;
}

function hide() {
    hideInstallBar(window);
    show.value = false;
}
</script>

<style scoped>
.install-bar {
    background: var(--brand-wash);
    color: var(--ink);
    padding: 8px 12px;
    font-size: 0.85rem;
}

.install-bar__row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.install-bar__text {
    flex: 1;
    min-width: 0;
}

.install-bar__add {
    flex: none;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 0;
    background: var(--brand);
    color: var(--brand-ink);
    font-weight: 600;
}

.install-bar__hide {
    flex: none;
    min-height: 34px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--ink-soft);
}

.install-bar__steps {
    margin: 8px 0 2px;
    padding-left: 1.3em;
    line-height: 1.6;
}
</style>

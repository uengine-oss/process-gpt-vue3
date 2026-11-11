<script setup lang="ts">
/**
 * 맨 위 「홈 화면에 추가」 띠 — 휴대폰 브라우저에서 아직 홈 화면에 앱으로 추가하지 않았을 때만 보인다(shared/mobileView).
 * 단추는 설정 › 테마 설정의 「홈 화면에 추가」와 같다(브라우저 설치 창, 못 띄우면 기기별 안내).
 * 「다시 보지 않기」는 웹으로 계속 쓰겠다는 뜻이라 그 기기에서는 다시 띄우지 않는다.
 *
 * v-system-bar 라서 위쪽 막대(v-app-bar)와 본문이 띠 높이만큼 내려간다 — 머리의 단추를 가리지 않는다.
 * 데스크톱 화면(1280px 를 줄여 그림)에서도 휴대폰 글자 크기로 보이게 처음 열 때의 phoneZoom 만큼 키운다.
 * 손가락으로 확대할 때마다 높이를 바꾸면 화면이 출렁여서 처음 값만 쓴다.
 */
import { computed, ref } from 'vue';
import AddToHomeScreen from '@/components/mobile/AddToHomeScreen.vue';
import { hideInstallBar, phoneZoom, shouldShowInstallBar } from '@/shared/mobileView';
import { webAppInstall } from '@/utils/webAppInstall';

const BAR_HEIGHT = 44;

const show = ref(shouldShowInstallBar(window));
const zoom = phoneZoom(window);
const visible = computed(() => show.value && webAppInstall.enabled && !webAppInstall.installed);

function hide() {
    hideInstallBar(window);
    show.value = false;
}
</script>

<template>
    <v-system-bar v-if="visible" :height="Math.round(BAR_HEIGHT * zoom)" class="install-bar" data-testid="install-bar">
        <div class="install-bar__inner" :style="{ zoom, width: `${100 / zoom}%` }">
            <v-icon size="18" class="install-bar__icon">mdi-cellphone-arrow-down</v-icon>
            <span class="install-bar__text">{{ $t('mobileView.installBarText') }}</span>
            <AddToHomeScreen variant="flat" size="small" />
            <v-btn variant="text" size="small" class="text-none" data-testid="install-bar-hide" @click="hide">
                {{ $t('mobileView.installBarHide') }}
            </v-btn>
        </div>
    </v-system-bar>
</template>

<style scoped>
.install-bar {
    background: rgba(var(--v-theme-primary), 0.1) !important;
    color: rgb(var(--v-theme-on-surface)) !important;
    padding: 0 !important;
}
.install-bar__inner {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 8px;
    font-size: 13px;
}
.install-bar__icon {
    color: rgb(var(--v-theme-primary));
}
.install-bar__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>

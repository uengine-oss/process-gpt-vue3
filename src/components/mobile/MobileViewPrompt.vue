<script setup lang="ts">
/**
 * 휴대폰 브라우저로 앱 화면에 처음 들어온 사람에게 한 번 묻는다 — 데스크톱 화면 그대로 쓸까, 라이트 버전으로 볼까.
 * 한 번 답하면 그 기기에 남겨 다시 묻지 않는다. 바꾸는 곳은 설정 › 테마 설정 「휴대폰 화면」.
 *
 * 화면은 데스크톱 폭(1280px)으로 그려 휴대폰에 맞춰 줄여 보이므로, 창은 줄어든 만큼 키워 휴대폰 글자 크기로 보인다.
 */
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { shouldAskMobileView, saveMobileView, phoneZoom } from '@/shared/mobileView';
import { webAppInstall } from '@/utils/webAppInstall';
import AddToHomeScreen from './AddToHomeScreen.vue';

const route = useRoute();
const open = ref(false);
const zoom = ref(1);
const width = ref(420);

function check() {
    if (open.value || !shouldAskMobileView(route.path)) return;
    zoom.value = phoneZoom(window);
    width.value = Math.min(420, Math.floor((window.innerWidth * 0.92) / zoom.value));
    open.value = true;
}

function choose(view: 'desktop' | 'light') {
    const { reload } = saveMobileView(view);
    open.value = false;
    if (reload) window.location.reload();
}

// 처음 그린 뒤 휴대폰 배율(visualViewport.scale)이 자리 잡을 때까지 잠깐 기다린다.
onMounted(() => setTimeout(check, 800));
watch(() => route.path, check);
</script>

<template>
    <v-dialog v-model="open" persistent :width="width">
        <v-card class="phone-sized-card" :style="{ transform: `scale(${zoom})` }" data-testid="mobile-view-prompt">
            <v-card-title class="text-h6 text-wrap pt-4">{{ $t('mobileView.promptTitle') }}</v-card-title>
            <v-card-text class="pb-2">
                <p class="mb-3">{{ $t('mobileView.promptBody') }}</p>
                <p class="text-caption text-medium-emphasis mb-0">{{ $t('mobileView.promptSettingsHint') }}</p>
            </v-card-text>
            <div class="d-flex flex-column ga-2 px-4 pb-4 pt-2">
                <v-btn color="primary" variant="flat" block class="text-none" data-testid="mobile-view-light" @click="choose('light')">
                    {{ $t('mobileView.useLight') }}
                </v-btn>
                <v-btn variant="outlined" block class="text-none" data-testid="mobile-view-desktop" @click="choose('desktop')">
                    {{ $t('mobileView.keepDesktop') }}
                </v-btn>
            </div>
            <template v-if="webAppInstall.enabled && !webAppInstall.installed">
                <v-divider />
                <div class="px-4 py-3">
                    <p class="text-body-2 mb-2">{{ $t('mobileView.addToHomeHint') }}</p>
                    <AddToHomeScreen block variant="tonal" />
                </div>
            </template>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.phone-sized-card {
    transform-origin: center center;
}
</style>

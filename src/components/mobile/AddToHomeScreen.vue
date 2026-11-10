<script setup lang="ts">
/**
 * 「홈 화면에 추가」 단추 — 휴대폰 화면 질문 창과 설정 › 테마 설정에서 쓴다.
 * 브라우저가 설치 창을 띄울 수 있으면 띄우고, 아니면(iOS 사파리 등) 기기별로 누를 곳을 안내한다.
 * 이미 홈 화면에서 연 앱이면 보이지 않는다.
 */
import { ref } from 'vue';
import { installGuide, phoneZoom } from '@/shared/mobileView';
import { webAppInstall, promptInstall } from '@/utils/webAppInstall';

withDefaults(defineProps<{ variant?: 'flat' | 'tonal' | 'outlined' | 'text'; block?: boolean }>(), {
    variant: 'tonal',
    block: false
});

const guideOpen = ref(false);
const guide = ref<'ios' | 'android' | 'desktop'>('desktop');
const zoom = ref(1);
const width = ref(420);

async function add() {
    if ((await promptInstall()) !== 'unavailable') return;
    const g = installGuide({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints });
    guide.value = g === 'prompt' ? 'desktop' : g;
    zoom.value = phoneZoom(window);
    width.value = Math.min(420, Math.floor((window.innerWidth * 0.92) / zoom.value));
    guideOpen.value = true;
}
</script>

<template>
    <template v-if="webAppInstall.enabled && !webAppInstall.installed">
        <v-btn
            :variant="variant"
            :block="block"
            color="primary"
            prepend-icon="mdi-cellphone-arrow-down"
            class="text-none"
            data-testid="add-to-home-screen"
            @click="add"
        >
            {{ $t('mobileView.addToHome') }}
        </v-btn>
        <v-dialog v-model="guideOpen" :width="width">
            <v-card class="phone-sized-card" :style="{ transform: `scale(${zoom})` }" data-testid="add-to-home-guide">
                <v-card-title class="text-h6 text-wrap">{{ $t('mobileView.addToHome') }}</v-card-title>
                <v-card-text>
                    <ol class="add-to-home__steps">
                        <li v-for="n in guide === 'ios' ? 3 : 2" :key="n">{{ $t(`mobileView.guide.${guide}${n}`) }}</li>
                    </ol>
                    <p class="text-caption text-medium-emphasis mt-3">{{ $t('mobileView.guide.after') }}</p>
                </v-card-text>
                <div class="d-flex justify-end px-4 pb-4">
                    <v-btn variant="text" @click="guideOpen = false">{{ $t('mobileView.close') }}</v-btn>
                </div>
            </v-card>
        </v-dialog>
    </template>
</template>

<style scoped>
.add-to-home__steps {
    padding-left: 1.2em;
    line-height: 1.7;
}
.phone-sized-card {
    transform-origin: center center;
}
</style>

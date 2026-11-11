<script setup lang="ts">
/**
 * 좁은 화면(폭 768px 이하)에서 관리 · 설계 · 분석 화면을 열면 여기로 온다(shared/phoneScope).
 * 휴대폰은 보통 휴대폰 웹(/m/)으로 가므로 여기에는 거의 오지 않는다. 휴대폰이면 「PC 화면으로 보기」로 이 기기를
 * 데스크톱 버전으로 바꾸고 원래 주소를 연다. 컴퓨터의 좁은 창이면 창을 넓힌 뒤 다시 연다.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { saveMobileView, isPhoneBrowser } from '@/shared/mobileView';

const route = useRoute();
const router = useRouter();
const from = computed(() => {
    const f = route.query.from;
    return typeof f === 'string' && f.startsWith('/') && !f.startsWith('//') ? f : '/definition-map';
});

function goTodo() {
    router.push('/todolist');
}

// 휴대폰이면 이 기기를 데스크톱 화면으로 바꿔 연다. 컴퓨터의 좁은 창이면 창을 넓힌 뒤 다시 연다(폭이 넓으면 그대로 열린다).
const phone = isPhoneBrowser();

function openOnDesktop() {
    if (phone) {
        saveMobileView('desktop');
        window.location.assign(from.value);
    } else {
        router.push(from.value);
    }
}
</script>

<template>
    <div class="desktop-only" data-testid="desktop-only">
        <v-icon size="44" color="primary" class="mb-3">mdi-monitor</v-icon>
        <h1 class="desktop-only__title">{{ $t('desktopOnly.title') }}</h1>
        <p class="desktop-only__body">{{ $t('desktopOnly.body') }}</p>
        <div class="desktop-only__actions">
            <v-btn color="primary" variant="flat" block size="large" class="text-none" @click="goTodo">
                {{ $t('desktopOnly.goTodo') }}
            </v-btn>
            <v-btn variant="outlined" block size="large" class="text-none" data-testid="desktop-only-open" @click="openOnDesktop">
                {{ phone ? $t('desktopOnly.openOnDesktop') : $t('desktopOnly.reopenWide') }}
            </v-btn>
        </div>
        <p class="desktop-only__hint">{{ phone ? $t('desktopOnly.hint') : $t('desktopOnly.hintWide') }}</p>
    </div>
</template>

<style scoped>
.desktop-only {
    max-width: 420px;
    margin: 48px auto 0;
    padding: 0 20px;
    text-align: center;
}
.desktop-only__title {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--cds-text-primary);
}
.desktop-only__body {
    font-size: 15px;
    line-height: 1.6;
    margin: 0 0 24px;
    color: var(--cds-text-muted);
}
.desktop-only__actions {
    display: grid;
    gap: 10px;
}
.desktop-only__hint {
    font-size: 12px;
    margin-top: 16px;
    color: var(--cds-text-muted);
}
</style>

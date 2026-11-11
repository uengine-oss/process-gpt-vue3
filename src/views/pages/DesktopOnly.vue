<script setup lang="ts">
/**
 * 휴대폰에서 관리 · 설계 · 분석 화면을 열면 여기로 온다(shared/phoneScope).
 * 휴대폰에서는 내 일을 처리하는 화면만 쓴다. 꼭 열어야 하면 「PC 화면으로 보기」로 이 기기를
 * 데스크톱 버전으로 바꾸고 원래 주소를 연다(설정 › 테마 설정 「휴대폰 화면」과 같은 값).
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { saveMobileView } from '@/shared/mobileView';

const route = useRoute();
const router = useRouter();
const from = computed(() => {
    const f = route.query.from;
    return typeof f === 'string' && f.startsWith('/') && !f.startsWith('//') ? f : '/definition-map';
});

function goTodo() {
    router.push('/todolist');
}

function openOnDesktop() {
    saveMobileView('desktop');
    window.location.assign(from.value);
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
                {{ $t('desktopOnly.openOnDesktop') }}
            </v-btn>
        </div>
        <p class="desktop-only__hint">{{ $t('desktopOnly.hint') }}</p>
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

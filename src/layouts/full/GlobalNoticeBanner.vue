<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';

const store = useAdminConsoleStore();
const sessionDismissedSignature = ref('');

const iconByColor = {
    info: 'mdi-information-outline',
    warning: 'mdi-alert-outline',
    error: 'mdi-alert-circle-outline',
    success: 'mdi-check-circle-outline'
} as const;

const today = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const bannerSignature = computed(() => {
    const banner = store.noticeBanner;
    return JSON.stringify([banner.text, banner.color, banner.start_date, banner.end_date]);
});

const dismissalStorageKey = computed(() => {
    const tenant = (window as any).$tenantName || 'default';
    return `notice-banner-dismissal:${tenant}`;
});

const isDismissedForToday = computed(() => {
    try {
        const value = JSON.parse(localStorage.getItem(dismissalStorageKey.value) || 'null');
        return value?.date === today() && value?.signature === bannerSignature.value;
    } catch {
        return false;
    }
});

const isVisible = computed(() => {
    const banner = store.noticeBanner;
    const currentDate = today();

    if (!banner.enabled || !banner.text?.trim()) return false;
    if (banner.start_date && currentDate < banner.start_date) return false;
    if (banner.end_date && currentDate > banner.end_date) return false;
    if (sessionDismissedSignature.value === bannerSignature.value) return false;
    if (isDismissedForToday.value) return false;
    return true;
});

const bannerIcon = computed(() => iconByColor[store.noticeBanner.color] || iconByColor.info);

const dismiss = () => {
    sessionDismissedSignature.value = bannerSignature.value;
};

const dismissForToday = () => {
    localStorage.setItem(
        dismissalStorageKey.value,
        JSON.stringify({ date: today(), signature: bannerSignature.value })
    );
    sessionDismissedSignature.value = bannerSignature.value;
};

onMounted(() => store.fetchNoticeBanner());
</script>

<template>
    <div
        v-if="isVisible"
        class="global-notice-banner"
        :class="`global-notice-banner--${store.noticeBanner.color}`"
        role="status"
    >
        <div class="global-notice-banner__message">
            <v-icon size="18" class="global-notice-banner__icon">{{ bannerIcon }}</v-icon>
            <span class="global-notice-banner__text">{{ store.noticeBanner.text }}</span>
        </div>
        <div class="global-notice-banner__actions">
            <button type="button" class="global-notice-banner__today" @click="dismissForToday">
                오늘 하루 다시 보지 않기
            </button>
            <button type="button" class="global-notice-banner__close" aria-label="공지 배너 닫기" @click="dismiss">
                <v-icon size="18">mdi-close</v-icon>
            </button>
        </div>
    </div>
</template>

<style scoped>
.global-notice-banner {
    position: fixed;
    z-index: 1100;
    top: 94px;
    right: 20px;
    left: calc(var(--v-layout-left) + 40px);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    width: auto;
    max-width: 1100px;
    min-height: 42px;
    margin: 0 auto;
    padding: 9px 12px 9px 16px;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}

:global(.sidebar-closed) .global-notice-banner,
:global(.horizontalLayout) .global-notice-banner {
    left: 20px;
}

:global(.pal-main-no-header) .global-notice-banner {
    top: 20px;
}

.global-notice-banner__message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
}

.global-notice-banner--info {
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
}

.global-notice-banner--warning {
    color: #92400e;
    background: #fffbeb;
    border-color: #fde68a;
}

.global-notice-banner--error {
    color: #991b1b;
    background: #fff5f5;
    border-color: #fecaca;
}

.global-notice-banner--success {
    color: #166534;
    background: #f0fdf4;
    border-color: #bbf7d0;
}

.global-notice-banner__icon {
    flex: 0 0 auto;
}

.global-notice-banner__text {
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.global-notice-banner__actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.global-notice-banner__today,
.global-notice-banner__close {
    color: inherit;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.global-notice-banner__today {
    padding: 5px 7px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    text-decoration: underline;
    text-underline-offset: 2px;
}

.global-notice-banner__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
}

.global-notice-banner__today:hover,
.global-notice-banner__close:hover {
    background: currentColor;
    background: color-mix(in srgb, currentColor 10%, transparent);
}

@media (max-width: 600px) {
    .global-notice-banner {
        top: 12px;
        right: 8px;
        left: 8px;
        grid-template-columns: minmax(0, 1fr);
        gap: 4px;
        width: auto;
        margin: 0;
    }

    .global-notice-banner__message {
        justify-content: flex-start;
    }

    .global-notice-banner__actions {
        justify-content: flex-end;
    }
}
</style>

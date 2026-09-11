<template>
    <div class="maintenance-page">
        <div class="maintenance-card">
            <div class="maintenance-icon-wrap">
                <v-icon size="44" color="#dc2626">mdi-wrench-clock</v-icon>
            </div>
            <h1 class="maintenance-title">{{ $t('maintenancePage.title') }}</h1>
            <p class="maintenance-description">{{ $t('maintenancePage.description') }}</p>

            <div v-if="config.message" class="maintenance-reason">
                <span class="maintenance-reason__label">{{ $t('maintenancePage.reasonLabel') }}</span>
                <span class="maintenance-reason__text">{{ config.message }}</span>
            </div>
            <div v-if="config.activated_at" class="maintenance-since">
                {{ $t('maintenancePage.sinceLabel') }} · {{ formatDateTime(config.activated_at) }}
            </div>

            <v-btn class="maintenance-retry" color="primary" variant="flat" rounded="lg" :loading="checking" @click="checkAgain">
                <v-icon size="18" class="mr-1">mdi-refresh</v-icon>
                {{ $t('maintenancePage.retry') }}
            </v-btn>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import { invalidateMaintenanceCache, isMaintenanceEnabled } from '@/utils/maintenanceGate';

const router = useRouter();
const checking = ref(false);
const config = reactive({ message: '', activated_at: '' });

let pollTimer: ReturnType<typeof setInterval> | null = null;

function formatDateTime(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

async function loadConfig() {
    try {
        const backend = BackendFactory.createBackend() as any;
        const loaded = await backend?.getMaintenanceMode?.();
        config.message = loaded?.message || '';
        config.activated_at = loaded?.activated_at || '';
        // 점검이 이미 해제되었으면 시작 화면으로 복귀
        if (loaded && !loaded.enabled) {
            invalidateMaintenanceCache();
            router.replace('/');
        }
    } catch (_e) {
        /* 조회 실패 시 안내 문구만 기본값으로 표시 */
    }
}

async function checkAgain() {
    checking.value = true;
    try {
        invalidateMaintenanceCache();
        const enabled = await isMaintenanceEnabled();
        if (!enabled) {
            router.replace('/');
            return;
        }
        await loadConfig();
    } finally {
        checking.value = false;
    }
}

onMounted(() => {
    loadConfig();
    // 점검 해제 시 자동 복귀
    pollTimer = setInterval(async () => {
        invalidateMaintenanceCache();
        const enabled = await isMaintenanceEnabled();
        if (!enabled) router.replace('/');
    }, 30 * 1000);
});

onBeforeUnmount(() => {
    if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.maintenance-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #f8fafc;
}

.maintenance-card {
    max-width: 480px;
    width: 100%;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    padding: 48px 40px;
    text-align: center;
}

.maintenance-icon-wrap {
    width: 88px;
    height: 88px;
    margin: 0 auto 24px;
    border-radius: 50%;
    background: #fef2f2;
    display: flex;
    align-items: center;
    justify-content: center;
}

.maintenance-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 12px;
}

.maintenance-description {
    font-size: 14px;
    line-height: 1.6;
    color: #6b7280;
    margin-bottom: 24px;
    white-space: pre-line;
}

.maintenance-reason {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: #f9fafb;
    border: 1px solid #f3f4f6;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 12px;
    text-align: left;
}

.maintenance-reason__label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
}

.maintenance-reason__text {
    font-size: 14px;
    color: #374151;
    white-space: pre-line;
}

.maintenance-since {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 24px;
}

.maintenance-retry {
    min-width: 140px;
}
</style>

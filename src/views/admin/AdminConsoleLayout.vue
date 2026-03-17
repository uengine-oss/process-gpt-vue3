<template>
    <v-card class="admin-console-layout rounded-xl" elevation="10">
        <div v-if="!claimsLoaded" class="loading-state">
            <v-progress-circular indeterminate color="primary" size="42" width="4" />
            <p>{{ $t('common.loading') || '로딩 중...' }}</p>
        </div>

        <div v-else-if="!isAdmin" class="no-access">
            <v-icon size="64" color="grey">mdi-shield-lock-outline</v-icon>
            <h3>{{ $t('adminConsole.noAccess') }}</h3>
            <p>{{ $t('adminConsole.noAccessDesc') }}</p>
        </div>

        <div v-else class="admin-container">
            <div class="admin-content">
                <router-view />
            </div>
        </div>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { authClaimsState } from '@/utils/authClaims';

const claimsLoaded = computed(() => authClaimsState.loaded);
const isAdmin = computed(() => authClaimsState.isAdmin);
</script>

<style scoped>
.admin-console-layout {
    height: calc(100vh - 140px);
    overflow: hidden;
    position: relative;
    background: #fafafa;
}

.loading-state,
.no-access {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    gap: 16px;
    color: #6b7280;
}

.loading-state p,
.no-access h3 {
    font-size: 18px;
}

.loading-state p {
    color: #4b5563;
    margin: 0;
}

.no-access h3 {
    color: #374151;
}

.admin-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.admin-content {
    flex: 1;
    overflow: auto;
    background: #fafafa;
}
</style>

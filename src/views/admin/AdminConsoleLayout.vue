<template>
    <v-card :class="['admin-console-layout', 'rounded-xl', { 'admin-console-layout--pal': isPalMode }]" elevation="10">
        <div v-if="!claimsLoaded" class="loading-state">
            <v-progress-circular indeterminate color="primary" size="42" width="4" />
            <p>{{ $t('common.loading') || '로딩 중...' }}</p>
        </div>

        <NoAccessView v-else-if="!canEnter" :required-role="requiredRoleForRoute" />

        <div v-else class="admin-container">
            <div class="admin-content">
                <router-view />
            </div>
        </div>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { authClaimsState, canEnterAdminConsole } from '@/utils/authClaims';
import { canAccess, customPermissionState } from '@/utils/customPermissions';
import { lookupRequiredRole } from '@/utils/routePermissions';
import NoAccessView from '@/views/authentication/NoAccessView.vue';

const route = useRoute();
const isPalMode = !!(window as any).$pal;

const claimsLoaded = computed(() => authClaimsState.loaded && customPermissionState.loaded);

const canEnter = computed(() => {
    // admin 또는 admin_viewer 는 무조건 통과
    if (canEnterAdminConsole()) return true;
    // 그 외 사용자는 현재 라우트(자식 path) 에 대한 custom permission 보유 시 통과
    return canAccess({ apiPath: route.path, verb: 'GET' });
});

const requiredRoleForRoute = computed(() => lookupRequiredRole(route.path));
</script>

<style scoped>
.admin-console-layout {
    height: calc(100vh - 140px);
    overflow: hidden;
    position: relative;
}

.admin-console-layout--pal {
    height: calc(100vh - 40px);
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
}
</style>

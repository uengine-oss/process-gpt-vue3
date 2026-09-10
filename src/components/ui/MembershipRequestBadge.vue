<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { getIsAdminClaim } from '@/utils/authClaims';
import { useMembershipRequestsStore } from '@/stores/membershipRequests';
const store = useMembershipRequestsStore();
const admin = computed(() => getIsAdminClaim());
let timer: ReturnType<typeof setInterval> | undefined;
const refresh = () => { if (admin.value && document.visibilityState === 'visible') void store.refresh(); };
watch(admin, value => {
    clearInterval(timer);
    if (value) { void store.refresh(); timer = setInterval(refresh, 15000); }
    else store.reset();
}, { immediate: true });
document.addEventListener('visibilitychange', refresh);
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); });
</script>
<template>
    <v-chip v-if="admin && store.counts.total" size="x-small" color="error" variant="flat"
        :title="`권한 신청 ${store.counts.role}건 + 가입 신청 ${store.counts.signup}건`"
        :aria-label="`승인 대기 ${store.counts.total}건`">{{ store.counts.total }}</v-chip>
    <v-icon v-else-if="admin && store.error" size="16" color="warning" :title="store.error">mdi-alert-circle-outline</v-icon>
</template>

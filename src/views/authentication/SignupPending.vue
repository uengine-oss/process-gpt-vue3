<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getMembership } from '@/services/membershipService';
import { refreshAuthClaims } from '@/utils/authClaims';
import { useAuthStore } from '@/stores/auth';
const router = useRouter();
const auth = useAuthStore();
const status = ref('pending');
const rejectReason = ref('');
const error = ref('');
const loading = ref(false);
async function refresh() {
    loading.value = true; error.value = '';
    try {
        const { data } = await window.$supabase.auth.getSession();
        if (!data.session) { await router.replace('/auth/login'); return; }
        const membership = await getMembership();
        status.value = membership.status; rejectReason.value = membership.reject_reason || '';
        if (status.value === 'approved') {
            await window.$supabase.auth.refreshSession();
            await refreshAuthClaims();
            await router.replace('/admin-request');
        }
    } catch (e: any) { error.value = e.message || '가입 상태를 확인하지 못했습니다.'; }
    finally { loading.value = false; }
}
onMounted(refresh);
</script>
<template>
    <v-container class="d-flex align-center justify-center" style="min-height:100vh">
        <v-card width="520" class="pa-8 rounded-xl">
            <h1 class="text-h5 mb-4">{{ status === 'rejected' ? '가입 신청이 반려되었습니다' : '가입 승인 대기' }}</h1>
            <p class="mb-4">{{ status === 'rejected' ? '아래 사유를 확인하고 관리자에게 문의해 주세요.' : '가입 신청이 접수되었습니다. 관리자가 조직도에서 승인하면 서비스를 이용할 수 있습니다.' }}</p>
            <v-alert v-if="rejectReason" type="warning" variant="tonal" class="mb-4">{{ rejectReason }}</v-alert>
            <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
            <v-btn color="primary" :loading="loading" @click="refresh">승인 상태 확인</v-btn>
            <v-btn variant="text" class="ml-2" @click="auth.logout()">로그아웃</v-btn>
        </v-card>
    </v-container>
</template>

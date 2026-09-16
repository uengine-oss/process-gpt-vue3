<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
import { applyMembershipClaims } from '@/utils/authClaims';
import { getMembership, listMembershipRequests, requestRole, type MembershipRequest } from '@/services/membershipService';

const rows = ref<MembershipRequest[]>([]);
const currentRole = ref('');
const requestedRole = ref('reviewer');
const reason = ref('');
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const success = ref('');
const hasPending = computed(() => rows.value.some(row => row.status === 'pending'));
const items = computed(() => ROLE_HIERARCHY.filter(role => role !== currentRole.value)
    .map(role => ({ value: role, title: `${ROLE_META[role].label} (${ROLE_META[role].labelEn})` })));
const labels = { pending: '승인 대기', approved: '승인', rejected: '반려' };
const roleLabel = (role?: string) => ROLE_META[role as keyof typeof ROLE_META]?.label || role;
async function load() {
    loading.value = true; error.value = '';
    try {
        const [membership, requests] = await Promise.all([getMembership(), listMembershipRequests('role', undefined, true)]);
        currentRole.value = membership.role || 'viewer'; rows.value = requests;
        applyMembershipClaims(membership);
        if (requestedRole.value === currentRole.value) requestedRole.value = items.value[0]?.value || '';
    } catch (e: any) { error.value = e.message; }
    finally { loading.value = false; }
}
async function submit() {
    submitting.value = true; error.value = ''; success.value = '';
    try {
        await requestRole(requestedRole.value, reason.value.trim());
        reason.value = ''; success.value = '권한 변경 신청이 접수되었습니다. 관리자 승인 후 적용됩니다.';
        await load();
    } catch (e: any) { error.value = e.message; }
    finally { submitting.value = false; }
}
onMounted(load);
</script>

<template>
    <v-card class="pa-6 rounded-xl">
        <div class="d-flex justify-space-between align-center mb-4">
            <div><h1 class="text-h5">권한 변경 신청</h1><p class="text-medium-emphasis mt-2">현재 권한: {{ roleLabel(currentRole) }} · 승인 전까지 현재 권한이 유지됩니다.</p></div>
            <v-btn variant="text" :loading="loading" @click="load">새로고침</v-btn>
        </div>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>
        <v-alert v-if="hasPending" type="info" variant="tonal" class="mb-4">승인 대기 중인 신청이 있습니다. 처리 완료 후 다시 신청할 수 있습니다.</v-alert>
        <v-form @submit.prevent="submit">
            <v-select v-model="requestedRole" :items="items" label="신청 권한" variant="outlined" :disabled="hasPending || loading || submitting" />
            <p v-if="requestedRole" class="text-body-2 text-medium-emphasis mb-4">{{ ROLE_META[requestedRole]?.description }}</p>
            <v-textarea v-model="reason" label="신청 사유" variant="outlined" counter="2000" maxlength="2000" :disabled="hasPending || loading || submitting" />
            <v-btn type="submit" color="primary" :loading="submitting" :disabled="hasPending || loading || !reason.trim() || !requestedRole">권한 변경 신청</v-btn>
        </v-form>
        <h2 class="text-h6 mt-8 mb-3">내 신청 이력</h2>
        <v-table><thead><tr><th>신청일</th><th>신청 권한</th><th>사유</th><th>상태</th><th>처리일 / 반려 사유</th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.id">
                <td>{{ new Date(row.created_at).toLocaleString() }}</td><td>{{ roleLabel(row.requested_role) }}</td>
                <td>{{ row.reason }}</td><td>{{ labels[row.status] }}</td>
                <td>{{ row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : '—' }}<div>{{ row.reject_reason }}</div></td>
            </tr></tbody>
        </v-table>
        <p v-if="!loading && !rows.length" class="pa-4 text-medium-emphasis">신청 이력이 없습니다.</p>
    </v-card>
</template>

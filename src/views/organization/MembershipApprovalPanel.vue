<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { listMembershipRequests, reviewRequest, type MembershipRequest, type RequestKind, type RequestStatus } from '@/services/membershipService';
import { useMembershipRequestsStore } from '@/stores/membershipRequests';
import { ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
const emit = defineEmits<{ (event: 'reviewed'): void }>();
const store = useMembershipRequestsStore();
const kind = ref<RequestKind>('role');
const status = ref<RequestStatus | 'all'>('pending');
const rows = ref<MembershipRequest[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const selected = ref<MembershipRequest | null>(null);
const decision = ref<'approved' | 'rejected'>('approved');
const reason = ref('');
const signupRole = ref('viewer');
const dialog = computed({ get: () => !!selected.value, set: value => { if (!value && !saving.value) selected.value = null; } });
const roleItems = ROLE_HIERARCHY.map(role => ({ title: ROLE_META[role].label, value: role }));
const labels = { pending: '승인 대기', approved: '승인', rejected: '반려' };
let generation = 0;
async function load() {
    const request = ++generation;
    loading.value = true; error.value = '';
    try {
        const result = await listMembershipRequests(kind.value, status.value === 'all' ? undefined : status.value);
        if (request === generation) rows.value = result;
        await store.refresh();
    } catch (e: any) { if (request === generation) error.value = e.message; }
    finally { if (request === generation) loading.value = false; }
}
function open(row: MembershipRequest, action: 'approved' | 'rejected') {
    selected.value = row; decision.value = action; reason.value = ''; signupRole.value = 'viewer'; error.value = '';
}
async function review() {
    if (!selected.value) return;
    saving.value = true; error.value = '';
    try {
        await reviewRequest(kind.value, selected.value.id, decision.value, reason.value, signupRole.value);
        selected.value = null;
        await load(); emit('reviewed');
    } catch (e: any) { error.value = e.message; }
    finally { saving.value = false; }
}
watch([kind, status], load);
onMounted(load);
</script>

<template>
    <section class="pa-5">
        <div class="d-flex justify-space-between align-center mb-3">
            <h2 class="text-h6">가입 및 권한 승인</h2><v-btn variant="text" :loading="loading" @click="load">새로고침</v-btn>
        </div>
        <v-tabs v-model="kind" color="primary">
            <v-tab value="role">권한 신청 <v-chip size="x-small" class="ml-2">{{ store.counts.role }}</v-chip></v-tab>
            <v-tab value="signup">가입 신청 <v-chip size="x-small" class="ml-2">{{ store.counts.signup }}</v-chip></v-tab>
        </v-tabs>
        <v-select v-model="status" :items="[{title:'승인 대기',value:'pending'},{title:'승인',value:'approved'},{title:'반려',value:'rejected'},{title:'전체',value:'all'}]" label="처리 상태" variant="outlined" density="compact" hide-details class="my-4" style="max-width:220px" />
        <v-alert v-if="error && !selected" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate />
        <v-table><thead><tr><th>신청자</th><th>신청일</th><th>{{ kind === 'role' ? '신청 권한 / 사유' : '가입 상태' }}</th><th>처리 결과</th><th>승인 / 반려</th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.id">
                <td>{{ row.username }}<div class="text-caption">{{ row.email }}</div></td>
                <td>{{ new Date(row.created_at).toLocaleString() }}</td>
                <td>{{ kind === 'role' ? (ROLE_META[row.requested_role || '']?.label || row.requested_role) : '가입 신청' }}<div>{{ row.reason }}</div></td>
                <td>{{ labels[row.status] }}<div class="text-caption">{{ row.reject_reason }}</div><div v-if="row.reviewed_at" class="text-caption">{{ new Date(row.reviewed_at).toLocaleString() }}</div></td>
                <td><template v-if="row.status === 'pending'"><v-btn size="small" color="primary" variant="tonal" class="mr-2" @click="open(row, 'approved')">승인</v-btn><v-btn size="small" color="error" variant="text" @click="open(row, 'rejected')">반려</v-btn></template></td>
            </tr></tbody>
        </v-table>
        <p v-if="!loading && !error && !rows.length" class="pa-5 text-center text-medium-emphasis">해당 상태의 신청이 없습니다.</p>
        <v-dialog v-model="dialog" max-width="500" :persistent="saving">
            <v-card class="pa-5">
                <h3 class="text-h6 mb-3">{{ decision === 'approved' ? '신청 승인' : '신청 반려' }}</h3>
                <p class="mb-4">{{ selected?.username }} ({{ selected?.email }})</p>
                <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
                <v-select v-if="kind === 'signup' && decision === 'approved'" v-model="signupRole" :items="roleItems" label="가입 승인 시 부여할 권한" variant="outlined" />
                <p v-if="kind === 'role' && decision === 'approved'" class="mb-4">승인하면 신청한 권한이 즉시 적용됩니다.</p>
                <v-textarea v-if="decision === 'rejected'" v-model="reason" label="반려 사유" variant="outlined" maxlength="2000" counter />
                <v-card-actions><v-spacer /><v-btn :disabled="saving" @click="selected = null">취소</v-btn><v-btn color="primary" :loading="saving" :disabled="decision === 'rejected' && !reason.trim()" @click="review">{{ decision === 'approved' ? '승인 확정' : '반려 확정' }}</v-btn></v-card-actions>
            </v-card>
        </v-dialog>
    </section>
</template>

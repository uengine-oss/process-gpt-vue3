<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import { canAccessApprovalInbox, canManageReopenRequest, isSelfReviewSubmission } from '@/utils/reviewPermissions';
import { getResolvedRole, refreshAuthClaims } from '@/utils/authClaims';

const LOCAL_BACKUP_KEY = 'review_board_debug_identity_backup';

const router = useRouter();
const backend = BackendFactory.createBackend() as any;

const loading = ref(false);
const users = ref<any[]>([]);
const reviewItems = ref<any[]>([]);
const selectedUserId = ref('');
const statusMessage = ref('');
const currentActor = ref({
    id: '',
    username: '',
    email: '',
    employee_no: '',
    role: 'viewer'
});

const userOptions = computed(() =>
    users.value.map((user) => ({
        title: `${user.username || user.email || user.id} · ${user.email || 'no-email'} · ${user.role}`,
        value: user.id
    }))
);

const selectedUser = computed(() => {
    if (selectedUserId.value) {
        return users.value.find((user) => user.id === selectedUserId.value) || null;
    }
    return currentActor.value.id ? currentActor.value : null;
});

const selectedActor = computed(() => ({
    userId: selectedUser.value?.id || '',
    userName: selectedUser.value?.username || selectedUser.value?.email || '',
    employeeNo: selectedUser.value?.employee_no || '',
    role: selectedUser.value?.role || 'viewer'
}));

const previewSubmissionItems = computed(() => reviewItems.value.filter((item) => isSelfReviewSubmission(item, selectedActor.value)));
const previewApprovalItems = computed(() =>
    reviewItems.value.filter((item) => item.state !== 'reopen_requested' && canAccessApprovalInbox(item, selectedActor.value))
);
const previewReopenItems = computed(() => reviewItems.value.filter((item) => canManageReopenRequest(item, selectedActor.value.role)));
const currentServerSubmissionItems = computed(() => reviewItems.value.filter((item) => !!item.is_my_submission));

function normalizeRole(isAdmin: boolean | undefined, role: string | null | undefined) {
    return isAdmin ? 'admin' : role || 'viewer';
}

async function loadCurrentActor() {
    const supabase = (window as any).$supabase;
    await refreshAuthClaims();

    currentActor.value = {
        id: localStorage.getItem('uid') || '',
        username: localStorage.getItem('userName') || localStorage.getItem('email') || '',
        email: localStorage.getItem('email') || '',
        employee_no: localStorage.getItem('employeeNo') || '',
        role: getResolvedRole()
    };

    if (!supabase?.auth) return;

    try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('id, username, email, employee_no, role, is_admin')
            .eq('id', user.id)
            .limit(1)
            .maybeSingle();

        currentActor.value = {
            id: user.id,
            username: userData?.username || userData?.email || user.email || currentActor.value.username,
            email: userData?.email || user.email || currentActor.value.email,
            employee_no: userData?.employee_no || currentActor.value.employee_no,
            role: normalizeRole(userData?.is_admin, userData?.role)
        };
    } catch (e) {
        console.warn('[ReviewBoardSubmissionDebug] current actor load failed:', e);
    }
}

async function loadUsersAndReviews() {
    loading.value = true;
    statusMessage.value = '';

    try {
        await loadCurrentActor();

        const supabase = (window as any).$supabase;
        const [reviewData, usersResponse] = await Promise.all([
            backend.getReviewBoardData(),
            supabase?.from('users').select('id, username, email, employee_no, role, is_admin').order('username', { ascending: true })
        ]);

        reviewItems.value = reviewData || [];
        users.value = (usersResponse?.data || []).map((user: any) => ({
            id: user.id,
            username: user.username || '',
            email: user.email || '',
            employee_no: user.employee_no || '',
            role: normalizeRole(user.is_admin, user.role)
        }));

        if (!selectedUserId.value) {
            selectedUserId.value = currentActor.value.id || users.value[0]?.id || '';
        }
    } catch (e) {
        console.error('[ReviewBoardSubmissionDebug] load failed:', e);
        statusMessage.value = '데이터를 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

function applySelectedAccountToLocal() {
    if (!selectedUser.value) return;

    const hasBackup = !!localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!hasBackup) {
        localStorage.setItem(
            LOCAL_BACKUP_KEY,
            JSON.stringify({
                uid: localStorage.getItem('uid') || '',
                userName: localStorage.getItem('userName') || '',
                email: localStorage.getItem('email') || '',
                employeeNo: localStorage.getItem('employeeNo') || '',
                role: localStorage.getItem('role') || '',
                isAdmin: localStorage.getItem('isAdmin') || ''
            })
        );
    }

    localStorage.setItem('uid', selectedUser.value.id || '');
    localStorage.setItem('userName', selectedUser.value.username || selectedUser.value.email || '');
    localStorage.setItem('email', selectedUser.value.email || '');
    localStorage.setItem('employeeNo', selectedUser.value.employee_no || '');
    localStorage.setItem('role', selectedUser.value.role || 'viewer');
    localStorage.setItem('isAdmin', ['admin', 'superAdmin'].includes(selectedUser.value.role || '') ? 'true' : 'false');

    statusMessage.value = `${selectedUser.value.username || selectedUser.value.email} 계정을 로컬 테스트 컨텍스트로 적용했습니다.`;
    void loadUsersAndReviews();
}

function restoreLocalAccount() {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!raw) {
        statusMessage.value = '복원할 로컬 백업이 없습니다.';
        return;
    }

    try {
        const backup = JSON.parse(raw);
        localStorage.setItem('uid', backup.uid || '');
        localStorage.setItem('userName', backup.userName || '');
        localStorage.setItem('email', backup.email || '');
        localStorage.setItem('employeeNo', backup.employeeNo || '');
        localStorage.setItem('role', backup.role || '');
        localStorage.setItem('isAdmin', backup.isAdmin || '');
        localStorage.removeItem(LOCAL_BACKUP_KEY);
        statusMessage.value = '로컬 테스트 컨텍스트를 이전 값으로 복원했습니다.';
        void loadUsersAndReviews();
    } catch (e) {
        console.error('[ReviewBoardSubmissionDebug] restore failed:', e);
        statusMessage.value = '백업 복원에 실패했습니다.';
    }
}

onMounted(() => {
    void loadUsersAndReviews();
});
</script>

<template>
    <div class="review-debug-page">
        <div class="review-debug-header">
            <div>
                <h1 class="review-debug-title">Review Board Submission Debug</h1>
                <p class="review-debug-subtitle">내 발의함/내 상신함 필터를 선택 계정 기준으로 확인합니다.</p>
            </div>
            <div class="review-debug-header-actions">
                <v-btn variant="outlined" color="primary" @click="router.push('/review-board')">리뷰 보드</v-btn>
                <v-btn variant="outlined" color="primary" @click="router.push('/my-inbox')">내 수신함</v-btn>
                <v-btn variant="tonal" color="primary" :loading="loading" @click="loadUsersAndReviews">새로고침</v-btn>
            </div>
        </div>

        <v-alert type="info" variant="tonal" class="mb-4">
            이 페이지는 현재 로그인으로 조회 가능한 리뷰 데이터에 대해, 선택한 계정으로 `내 발의함`/`내 상신함`이 어떻게 계산되는지 보여줍니다.
        </v-alert>

        <v-alert v-if="statusMessage" type="success" variant="tonal" class="mb-4">
            {{ statusMessage }}
        </v-alert>

        <div class="review-debug-grid">
            <v-card class="pa-4" rounded="lg">
                <div class="text-subtitle-1 font-weight-bold mb-3">현재 로그인 컨텍스트</div>
                <div class="debug-kv"><strong>ID</strong><span>{{ currentActor.id || '-' }}</span></div>
                <div class="debug-kv"><strong>이름</strong><span>{{ currentActor.username || '-' }}</span></div>
                <div class="debug-kv"><strong>Email</strong><span>{{ currentActor.email || '-' }}</span></div>
                <div class="debug-kv"><strong>사번</strong><span>{{ currentActor.employee_no || '-' }}</span></div>
                <div class="debug-kv"><strong>Role</strong><span>{{ currentActor.role }}</span></div>
                <div class="debug-kv"><strong>서버 기준 내 발의함</strong><span>{{ currentServerSubmissionItems.length }}건</span></div>
            </v-card>

            <v-card class="pa-4" rounded="lg">
                <div class="text-subtitle-1 font-weight-bold mb-3">테스트 계정 선택</div>
                <v-select
                    v-model="selectedUserId"
                    :items="userOptions"
                    label="계정"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="mb-3"
                />
                <div class="debug-kv"><strong>선택 사용자</strong><span>{{ selectedUser?.username || selectedUser?.email || '-' }}</span></div>
                <div class="debug-kv"><strong>선택 사번</strong><span>{{ selectedUser?.employee_no || '-' }}</span></div>
                <div class="debug-kv"><strong>선택 Role</strong><span>{{ selectedUser?.role || '-' }}</span></div>
                <div class="debug-actions">
                    <v-btn color="primary" variant="flat" @click="applySelectedAccountToLocal">로컬 계정값 적용</v-btn>
                    <v-btn color="default" variant="outlined" @click="restoreLocalAccount">로컬 값 복원</v-btn>
                </div>
            </v-card>
        </div>

        <div class="review-debug-summary">
            <v-card class="summary-card" rounded="lg">
                <div class="summary-label">선택 계정 기준 내 발의함</div>
                <div class="summary-value">{{ previewSubmissionItems.length }}</div>
            </v-card>
            <v-card class="summary-card" rounded="lg">
                <div class="summary-label">선택 계정 기준 승인함</div>
                <div class="summary-value">{{ previewApprovalItems.length }}</div>
            </v-card>
            <v-card class="summary-card" rounded="lg">
                <div class="summary-label">선택 계정 기준 개선요청함</div>
                <div class="summary-value">{{ previewReopenItems.length }}</div>
            </v-card>
            <v-card class="summary-card" rounded="lg">
                <div class="summary-label">전체 리뷰 건수</div>
                <div class="summary-value">{{ reviewItems.length }}</div>
            </v-card>
        </div>

        <v-card rounded="lg" class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">리뷰 데이터 판정 상세</div>
            <div class="review-debug-table-wrap">
                <table class="review-debug-table">
                    <thead>
                        <tr>
                            <th>프로세스</th>
                            <th>상태</th>
                            <th>submitted_by</th>
                            <th>owner</th>
                            <th>서버 기준</th>
                            <th>선택 계정 기준</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in reviewItems" :key="item.review_id || item.proc_def_id">
                            <td>
                                <div class="font-weight-medium">{{ item.process_name }}</div>
                                <div class="text-caption text-medium-emphasis">{{ item.review_id || item.proc_def_id }}</div>
                            </td>
                            <td>{{ item.state }}</td>
                            <td>
                                <div>{{ item.submitted_by || '-' }}</div>
                                <div class="text-caption text-medium-emphasis">{{ item.submitted_by_id || '-' }}</div>
                            </td>
                            <td>{{ item.owner || '-' }}</td>
                            <td>
                                <v-chip size="x-small" :color="item.is_my_submission ? 'success' : 'grey'" variant="tonal">
                                    {{ item.is_my_submission ? 'match' : 'no-match' }}
                                </v-chip>
                            </td>
                            <td>
                                <v-chip
                                    size="x-small"
                                    :color="isSelfReviewSubmission(item, selectedActor) ? 'primary' : 'grey'"
                                    variant="tonal"
                                >
                                    {{ isSelfReviewSubmission(item, selectedActor) ? 'match' : 'no-match' }}
                                </v-chip>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </v-card>
    </div>
</template>

<style scoped>
.review-debug-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
}
.review-debug-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}
.review-debug-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
}
.review-debug-subtitle {
    margin: 4px 0 0;
    color: #64748b;
}
.review-debug-header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.review-debug-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}
.debug-kv {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid #eef2f7;
    font-size: 13px;
}
.debug-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    flex-wrap: wrap;
}
.review-debug-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}
.summary-card {
    padding: 16px;
}
.summary-label {
    font-size: 12px;
    color: #64748b;
}
.summary-value {
    font-size: 28px;
    font-weight: 700;
    margin-top: 8px;
}
.review-debug-table-wrap {
    overflow-x: auto;
}
.review-debug-table {
    width: 100%;
    border-collapse: collapse;
}
.review-debug-table th,
.review-debug-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #eef2f7;
    text-align: left;
    font-size: 13px;
}
.review-debug-table th {
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
}

@media (max-width: 960px) {
    .review-debug-grid,
    .review-debug-summary {
        grid-template-columns: 1fr;
    }

    .review-debug-header {
        flex-direction: column;
    }
}
</style>

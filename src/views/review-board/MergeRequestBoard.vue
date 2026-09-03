<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import PrHeader from '@/components/pr/PrHeader.vue';
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrReviewForm from '@/components/pr/PrReviewForm.vue';
import PrMergeSection from '@/components/pr/PrMergeSection.vue';
import {
    prStatusLabel,
    prStatusColor,
    getInitial,
    getAvatarColor,
    shortBranch,
    formatRelativeTime,
    resourceTypeLabel,
    resourcePath
} from '@/composables/usePrUtils';

const backend = BackendFactory.createBackend() as any;
const router = useRouter();

const loading = ref(false);
const loadError = ref('');
const prs = ref<any[]>([]);
const reviewsByPr = ref<Record<string, any[]>>({});
const currentUserId = ref('');
const currentUserName = ref('');

const statusFilter = ref('all');
const typeFilter = ref('all');
const selectedPrId = ref<string | null>(null);

const reviewLoading = ref(false);
const reviewError = ref('');
const mergeLoading = ref(false);
const mergeError = ref('');
const snackbar = ref<{ show: boolean; message: string; color: string }>({ show: false, message: '', color: 'success' });

const ACTIVE_STATUSES = ['OPEN', 'CHANGES_REQUESTED', 'APPROVED'];

/** 내가 검토 담당인 요청만 모은다. 내가 올린 요청은 내 검토 대상이 아니므로 제외한다. */
const myReviewPrs = computed(() => prs.value.filter((pr) => pr.can_review && !pr.is_requester));

const typeOptions = computed(() => {
    const counts = new Map<string, number>();
    myReviewPrs.value.forEach((pr) => counts.set(pr.resource_type, (counts.get(pr.resource_type) || 0) + 1));
    return [
        { key: 'all', label: '전체', count: myReviewPrs.value.length },
        ...[...counts.entries()].map(([type, count]) => ({ key: type, label: resourceTypeLabel(type), count }))
    ];
});

const statusOptions = computed(() => {
    const scoped = myReviewPrs.value.filter((pr) => typeFilter.value === 'all' || pr.resource_type === typeFilter.value);
    const countOf = (statuses: string[]) => scoped.filter((pr) => statuses.includes(pr.status)).length;
    return [
        { key: 'all', label: '전체', count: scoped.length },
        { key: 'OPEN', label: '검토 대기', count: countOf(['OPEN']) },
        { key: 'CHANGES_REQUESTED', label: '변경 요청됨', count: countOf(['CHANGES_REQUESTED']) },
        { key: 'APPROVED', label: '승인됨', count: countOf(['APPROVED']) },
        { key: 'DONE', label: '병합·닫힘', count: countOf(['MERGED', 'CLOSED']) }
    ].filter((option) => option.key === 'all' || option.count > 0);
});

const filteredPrs = computed(() =>
    myReviewPrs.value.filter((pr) => {
        if (typeFilter.value !== 'all' && pr.resource_type !== typeFilter.value) return false;
        if (statusFilter.value === 'all') return true;
        if (statusFilter.value === 'DONE') return pr.status === 'MERGED' || pr.status === 'CLOSED';
        return pr.status === statusFilter.value;
    })
);

const pendingCount = computed(() => myReviewPrs.value.filter((pr) => pr.status === 'OPEN').length);

const selectedPr = computed(() => prs.value.find((pr) => pr.id === selectedPrId.value) || null);
const selectedReviews = computed(() => (selectedPr.value ? reviewsByPr.value[selectedPr.value.id] || [] : []));

const canReviewSelected = computed(
    () => !!selectedPr.value && selectedPr.value.can_review && ACTIVE_STATUSES.includes(selectedPr.value.status)
);
/** 병합 버튼은 승인된 요청에만, 그리고 앱에서 실제로 병합까지 할 수 있는 스킬에만 노출한다. */
const canMergeSelected = computed(
    () =>
        !!selectedPr.value &&
        canReviewSelected.value &&
        selectedPr.value.status === 'APPROVED' &&
        selectedPr.value.resource_type === 'skill'
);

// 종류를 바꾸면 상태 칩 목록도 다시 계산된다. 고른 값이 사라진 칩을 가리키면
// 아무 칩도 눌리지 않은 채 목록만 비어 보이므로 상태 필터를 초기화한다.
watch(typeFilter, () => {
    statusFilter.value = 'all';
});

function notify(message: string, color: 'success' | 'error' = 'success') {
    snackbar.value = { show: true, message, color };
}

function errorText(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    const data = error.response?.data ?? error.data ?? error;
    const picked = data?.error || data?.detail || data?.message || error.message;
    return typeof picked === 'string' && picked.trim() ? picked.trim() : String(error);
}

async function load() {
    loading.value = true;
    loadError.value = '';
    try {
        const user = await backend.getUserInfo();
        currentUserId.value = user?.uid || '';
        currentUserName.value = localStorage.getItem('userName') || user?.username || user?.name || '';

        const records = await backend.getResourcePrInbox(currentUserId.value);
        prs.value = Array.isArray(records) ? records : [];
        reviewsByPr.value = await backend.getResourcePrReviewsByPrIds(prs.value.map((pr) => pr.id));

        if (selectedPrId.value && !prs.value.some((pr) => pr.id === selectedPrId.value)) selectedPrId.value = null;
    } catch (error) {
        loadError.value = errorText(error) || '병합 요청을 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

function selectPr(pr: any) {
    selectedPrId.value = pr.id;
    reviewError.value = '';
    mergeError.value = '';
}

function openResource(pr: any) {
    router.push(resourcePath(pr.resource_type, pr.resource_id));
}

function latestActionText(pr: any): string {
    const reviews = reviewsByPr.value[pr.id] || [];
    if (pr.status === 'OPEN') return '검토 요청됨';
    if (pr.status === 'CHANGES_REQUESTED') {
        const last = [...reviews].reverse().find((r) => r.action === 'CHANGES_REQUESTED');
        return last?.reviewer_name ? `${last.reviewer_name}님이 변경 요청` : '변경 요청됨';
    }
    if (pr.status === 'APPROVED') {
        const last = [...reviews].reverse().find((r) => r.action === 'APPROVED');
        return last?.reviewer_name ? `${last.reviewer_name}님이 승인` : '승인됨';
    }
    if (pr.status === 'MERGED') return '병합 완료';
    if (pr.status === 'CLOSED') return '닫힘';
    return '';
}

async function submitReview(action: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENT', comment: string) {
    const pr = selectedPr.value;
    if (!pr) return;
    reviewLoading.value = true;
    reviewError.value = '';
    try {
        await backend.addResourcePrReview(pr.id, action, comment, currentUserId.value, currentUserName.value);
        if (action !== 'COMMENT') {
            await backend.updateResourcePrStatus(pr, action, { reviewerId: currentUserId.value });
        }
        notify(action === 'APPROVED' ? '승인했습니다.' : action === 'CHANGES_REQUESTED' ? '변경을 요청했습니다.' : '코멘트를 남겼습니다.');
        await load();
    } catch (error) {
        reviewError.value = errorText(error) || '리뷰 제출에 실패했습니다.';
    } finally {
        reviewLoading.value = false;
    }
}

async function mergePr() {
    const pr = selectedPr.value;
    if (!pr) return;
    mergeLoading.value = true;
    mergeError.value = '';
    try {
        if (pr.git_pr_number) await backend.mergeSkillPullRequest(pr.resource_id, pr.git_pr_number);
        await backend.updateResourcePrStatus(pr, 'MERGED', { mergedAt: new Date().toISOString() });
        notify('병합했습니다.');
        await load();
    } catch (error) {
        mergeError.value = errorText(error) || '병합에 실패했습니다.';
    } finally {
        mergeLoading.value = false;
    }
}

onMounted(load);
</script>

<template>
    <v-row class="justify-center ma-0 pa-0">
        <v-col cols="12" class="pa-3">
            <v-card elevation="10" class="mrb-card-root">
                <v-card-text class="pt-4 d-flex flex-column" style="min-height: 0; flex: 1">
                    <!-- 헤더 -->
                    <div class="d-flex align-center justify-space-between mb-4 flex-wrap ga-2">
                        <div>
                            <h2 class="text-h5 font-weight-bold">
                                병합 요청함
                                <v-chip v-if="pendingCount" size="small" color="warning" variant="tonal" class="ml-2">
                                    검토 대기 {{ pendingCount }}
                                </v-chip>
                            </h2>
                            <span class="text-caption text-medium-emphasis">내가 검토해야 할 스킬·프로세스·의사결정 병합 요청입니다.</span>
                        </div>
                        <v-btn variant="outlined" size="small" :loading="loading" @click="load">
                            <v-icon start size="16">mdi-refresh</v-icon>
                            새로고침
                        </v-btn>
                    </div>

                    <v-divider />

                    <!-- 필터 -->
                    <div class="d-flex align-center flex-wrap ga-4 py-1">
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis mr-2">종류</span>
                            <v-chip-group v-model="typeFilter" mandatory selected-class="text-primary">
                                <v-chip
                                    v-for="option in typeOptions"
                                    :key="`type-${option.key}`"
                                    :value="option.key"
                                    size="small"
                                    variant="outlined"
                                >
                                    {{ option.label }}
                                    <span class="text-medium-emphasis ml-1">{{ option.count }}</span>
                                </v-chip>
                            </v-chip-group>
                        </div>
                        <v-divider vertical class="my-2" />
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis mr-2">상태</span>
                            <v-chip-group v-model="statusFilter" mandatory selected-class="text-primary">
                                <v-chip
                                    v-for="option in statusOptions"
                                    :key="`status-${option.key}`"
                                    :value="option.key"
                                    size="small"
                                    variant="outlined"
                                >
                                    {{ option.label }}
                                    <span class="text-medium-emphasis ml-1">{{ option.count }}</span>
                                </v-chip>
                            </v-chip-group>
                        </div>
                    </div>

                    <v-divider class="mb-3" />

                    <!-- 본문 -->
                    <div class="mrb-body">
                        <!-- 목록 -->
                        <div class="mrb-list-pane">
                            <div v-if="loading" class="d-flex justify-center py-12">
                                <v-progress-circular indeterminate color="primary" />
                            </div>
                            <div v-else-if="loadError" class="mrb-empty">
                                <v-icon size="40" color="grey-lighten-1">mdi-alert-circle-outline</v-icon>
                                <div class="text-body-2 mt-3">{{ loadError }}</div>
                                <v-btn class="mt-3" size="small" color="primary" variant="flat" @click="load">다시 시도</v-btn>
                            </div>
                            <div v-else-if="!filteredPrs.length" class="mrb-empty">
                                <v-icon size="40" color="grey-lighten-2">mdi-source-pull</v-icon>
                                <div class="text-body-2 text-medium-emphasis mt-3">검토할 병합 요청이 없습니다</div>
                            </div>
                            <div v-else class="d-flex flex-column ga-2">
                                <v-card
                                    v-for="pr in filteredPrs"
                                    :key="pr.id"
                                    variant="outlined"
                                    :class="['mrb-item', { 'mrb-item--on': pr.id === selectedPrId }]"
                                    @click="selectPr(pr)"
                                >
                                    <v-card-text class="d-flex align-start ga-3 py-3">
                                        <v-avatar size="30" :color="pr.requester_profile ? undefined : getAvatarColor(pr.requester_name)">
                                            <v-img v-if="pr.requester_profile" :src="pr.requester_profile" />
                                            <span v-else class="text-white text-caption font-weight-bold">
                                                {{ getInitial(pr.requester_name) }}
                                            </span>
                                        </v-avatar>
                                        <div class="flex-grow-1" style="min-width: 0">
                                            <div class="d-flex align-center flex-wrap ga-2">
                                                <span class="text-body-2 font-weight-bold">{{ pr.title }}</span>
                                                <v-chip size="x-small" :color="prStatusColor(pr.status)" variant="tonal">
                                                    {{ prStatusLabel(pr.status) }}
                                                </v-chip>
                                            </div>
                                            <div class="d-flex align-center flex-wrap ga-1 mt-1 text-caption text-medium-emphasis">
                                                <v-chip size="x-small" variant="tonal" color="primary">
                                                    {{ resourceTypeLabel(pr.resource_type) }}
                                                </v-chip>
                                                <span class="mrb-resource">{{ pr.resource_name }}</span>
                                                <span>·</span>
                                                <span class="font-weight-medium">{{ pr.requester_name || '알 수 없음' }}</span>
                                                <span>·</span>
                                                <span>{{ formatRelativeTime(pr.updated_at || pr.created_at) }}</span>
                                                <template v-if="latestActionText(pr)">
                                                    <span>·</span>
                                                    <span>{{ latestActionText(pr) }}</span>
                                                </template>
                                            </div>
                                            <div class="d-flex align-center flex-wrap ga-1 mt-2 text-caption">
                                                <code class="mrb-branch">{{ shortBranch(pr.branch_name) }}</code>
                                                <v-icon size="12" color="grey">mdi-arrow-right</v-icon>
                                                <code class="mrb-branch">{{ pr.base_branch }}</code>
                                                <span v-if="pr.git_pr_number" class="text-medium-emphasis">#{{ pr.git_pr_number }}</span>
                                                <v-chip v-if="!pr.owner_id" size="x-small" color="warning" variant="tonal">
                                                    담당자 미지정
                                                </v-chip>
                                            </div>
                                        </div>
                                        <v-btn
                                            v-if="pr.status === 'OPEN'"
                                            size="small"
                                            color="primary"
                                            variant="flat"
                                            @click.stop="selectPr(pr)"
                                        >
                                            검토
                                        </v-btn>
                                        <v-icon v-else size="18" color="grey-lighten-1">mdi-chevron-right</v-icon>
                                    </v-card-text>
                                </v-card>
                            </div>
                        </div>

                        <!-- 상세 -->
                        <v-card variant="outlined" class="mrb-detail-pane">
                            <div v-if="!selectedPr" class="mrb-empty">
                                <v-icon size="36" color="grey-lighten-2">mdi-gesture-tap</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">요청을 선택하면 여기서 검토할 수 있습니다</div>
                            </div>
                            <template v-else>
                                <PrHeader
                                    :pr="selectedPr"
                                    :owner-name="selectedPr.owner_name"
                                    :requester-profile="selectedPr.requester_profile"
                                    class="flex-shrink-0"
                                >
                                    <template #meta-extra>
                                        <span>·</span>
                                        <a class="mrb-resource-link" @click="openResource(selectedPr)">
                                            {{ resourceTypeLabel(selectedPr.resource_type) }} · {{ selectedPr.resource_name }}
                                        </a>
                                    </template>
                                </PrHeader>

                                <div class="mrb-detail-scroll">
                                    <div v-if="selectedPr.description" class="mrb-desc text-body-2">{{ selectedPr.description }}</div>
                                    <div class="text-caption text-medium-emphasis font-weight-bold px-4 pt-3 pb-1">리뷰 이력</div>
                                    <PrReviewTimeline :reviews="selectedReviews" />
                                </div>

                                <div class="mrb-detail-foot">
                                    <div class="d-flex align-center ga-2 px-3 py-2">
                                        <v-btn size="small" variant="text" color="primary" @click="openResource(selectedPr)">
                                            <v-icon start size="14">mdi-open-in-app</v-icon>리소스 열기
                                        </v-btn>
                                        <v-btn
                                            v-if="selectedPr.git_pr_url"
                                            size="small"
                                            variant="text"
                                            color="primary"
                                            :href="selectedPr.git_pr_url"
                                            target="_blank"
                                        >
                                            <v-icon start size="14">mdi-open-in-new</v-icon>Git PR
                                        </v-btn>
                                    </div>

                                    <PrReviewForm
                                        v-if="canReviewSelected"
                                        :key="selectedPr.id"
                                        :is-owner="true"
                                        :loading="reviewLoading"
                                        :error="reviewError"
                                        @submit="submitReview"
                                    />

                                    <PrMergeSection
                                        :can-merge="canMergeSelected"
                                        :merge-loading="mergeLoading"
                                        :merge-error="mergeError"
                                        :base-branch="selectedPr.base_branch"
                                        merge-description="으로 병합하면 즉시 반영됩니다."
                                        @merge="mergePr"
                                    />
                                    <v-alert
                                        v-if="selectedPr.status === 'APPROVED' && !canMergeSelected"
                                        type="info"
                                        variant="tonal"
                                        density="compact"
                                        class="ma-3"
                                    >
                                        승인됨 — {{ resourceTypeLabel(selectedPr.resource_type) }} 병합은 리소스 화면의 버전 이력에서 진행합니다.
                                    </v-alert>
                                </div>
                            </template>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>

            <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" timeout="3000">
                {{ snackbar.message }}
            </v-snackbar>
        </v-col>
    </v-row>
</template>

<style scoped>
.mrb-card-root {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 110px);
}

.mrb-body {
    display: flex;
    gap: 14px;
    flex: 1;
    min-height: 0;
}
.mrb-list-pane {
    flex: 1 1 58%;
    min-width: 0;
    overflow-y: auto;
    padding-right: 4px;
}
.mrb-detail-pane {
    flex: 1 1 42%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.mrb-detail-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}
.mrb-detail-foot {
    flex-shrink: 0;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

@media (max-width: 1100px) {
    .mrb-body {
        flex-direction: column;
    }
    .mrb-detail-pane {
        min-height: 380px;
    }
}

.mrb-item {
    cursor: pointer;
}
.mrb-item:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}
.mrb-item--on {
    background: rgba(var(--v-theme-primary), 0.06);
}

.mrb-resource {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.mrb-branch {
    background: rgba(var(--v-theme-on-surface), 0.06);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 11px;
}
.mrb-resource-link {
    cursor: pointer;
    text-decoration: underline;
}
.mrb-desc {
    white-space: pre-wrap;
    padding: 12px 16px;
    color: rgba(var(--v-theme-on-surface), 0.75);
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.mrb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 16px;
    height: 100%;
}
</style>

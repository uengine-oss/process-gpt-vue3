<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import PrHeader from '@/components/pr/PrHeader.vue';
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrVerification from '@/components/pr/PrVerification.vue';
import PrChanges from '@/components/pr/PrChanges.vue';
import PrTypeChip from '@/components/pr/PrTypeChip.vue';
import PrActionBar from '@/components/pr/PrActionBar.vue';
import { formatRelativeTime, resourceTypeLabel, resourcePath } from '@/composables/usePrUtils';
import { prHeadline, meaningfulPrDescription, loadPrSummaries } from '@/composables/usePrChanges';
import { canVerifyPr, loadPrVerifyStats, type PrVerifyStats } from '@/composables/usePrVerification';
import { t } from '@/composables/i18nText';
import { mergeDefinitionPr } from '@/composables/usePrMerge';

const backend = BackendFactory.createBackend() as any;
const router = useRouter();

const loading = ref(false);
const loadError = ref('');
const prs = ref<any[]>([]);
const reviewsByPr = ref<Record<string, any[]>>({});
const currentUserId = ref('');
const currentUserName = ref('');

const searchText = ref('');
// 이 화면에 오는 이유는 대개 '지금 내가 봐야 할 것' 이다 — 검토 대기부터 보여준다.
const statusFilter = ref('OPEN');
const typeFilter = ref('all');
const selectedPrId = ref<string | null>(null);

const reviewLoading = ref(false);
const reviewError = ref('');
const mergeLoading = ref(false);
const mergeError = ref('');
const snackbar = ref<{ show: boolean; message: string; color: string }>({ show: false, message: '', color: 'success' });

const ACTIVE_STATUSES = ['OPEN', 'CHANGES_REQUESTED', 'APPROVED'];

/**
 * 내가 검토 담당인 요청만 모은다. 내가 올린 요청은 보통 내 검토 대상이 아니라 제외하지만,
 * **내가 그 리소스의 검토자(소유자·지정 리뷰어)이기도 하면 남긴다** — 채팅으로 내 스킬을
 * 고쳐 올린 요청이 그런 경우다. 나 말고 볼 사람이 없는데 여기서까지 숨기면 그 요청은
 * 아무 목록에도 뜨지 않고 묶인다.
 */
const myReviewPrs = computed(() => prs.value.filter((pr) => pr.can_review && (!pr.is_requester || pr.is_reviewer)));

/**
 * 필터는 접어 둔다. 종류·상태 칩을 모두 펼쳐 두면 좁은 화면에서 두 줄을 상시로 먹는데,
 * 정작 자주 쓰는 것은 "이 요청 어디 있지" 를 찾는 검색이다.
 */
const typeOptions = computed(() => {
    const counts = new Map<string, number>();
    myReviewPrs.value.forEach((pr) => counts.set(pr.resource_type, (counts.get(pr.resource_type) || 0) + 1));
    return [
        { title: t('mergeRequestBoard.filter.allTypes', { count: myReviewPrs.value.length }), value: 'all' },
        ...[...counts.entries()].map(([type, count]) => ({
            title: t('mergeRequestBoard.filter.type', { label: resourceTypeLabel(type), count }),
            value: type
        }))
    ];
});

const statusOptions = computed(() => {
    const scoped = myReviewPrs.value.filter((pr) => typeFilter.value === 'all' || pr.resource_type === typeFilter.value);
    const countOf = (statuses: string[]) => scoped.filter((pr) => statuses.includes(pr.status)).length;
    return [
        { title: t('mergeRequestBoard.filter.allStatuses', { count: scoped.length }), value: 'all', count: scoped.length },
        { title: t('mergeRequestBoard.filter.open', { count: countOf(['OPEN']) }), value: 'OPEN', count: countOf(['OPEN']) },
        {
            title: t('mergeRequestBoard.filter.changesRequested', { count: countOf(['CHANGES_REQUESTED']) }),
            value: 'CHANGES_REQUESTED',
            count: countOf(['CHANGES_REQUESTED'])
        },
        {
            title: t('mergeRequestBoard.filter.approved', { count: countOf(['APPROVED']) }),
            value: 'APPROVED',
            count: countOf(['APPROVED'])
        },
        {
            title: t('mergeRequestBoard.filter.done', { count: countOf(['MERGED', 'CLOSED']) }),
            value: 'DONE',
            count: countOf(['MERGED', 'CLOSED'])
        }
    ];
});

/**
 * 목록 카드에 걸 "무엇이 바뀌는가" 한 줄. 요청 id 로 찾는다.
 * 제목이 `feat: update nda-review` 로 똑같은 요청이 여러 건 나란히 서는 화면이라,
 * 이 줄이 없으면 목록에서 무엇을 먼저 볼지 고를 수가 없다.
 */
const summaryByPr = ref<Record<string, string>>({});
let summaryRun = { aborted: false };

/**
 * 검증 상태 캐시. 목록에는 걸지 않는다 — 카드는 "무엇을 먼저 볼지" 고르는 자리이고,
 * 병합해도 되는지는 그 요청을 열어 놓고 따지는 물음이다. 고른 요청 한 건만 미리 받아
 * 요약 줄과 액션 줄 위 판정에 쓴다.
 */
const verifyByPr = ref<Record<string, PrVerifyStats>>({});
let verifyRun = { aborted: false };

/** 검색은 제목·리소스·요청자·계산해 둔 변경 요약까지 훑는다. */
function matchesSearch(pr: any): boolean {
    // clearable 로 지우면 v-text-field 가 null 을 넣는다 — 그대로 trim 하면 터진다.
    const query = (searchText.value || '').trim().toLowerCase();
    if (!query) return true;
    const haystack = [pr.title, pr.resource_name, pr.requester_name, summaryByPr.value[pr.id], resourceTypeLabel(pr.resource_type)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(query);
}

const filteredPrs = computed(() =>
    myReviewPrs.value.filter((pr) => {
        if (typeFilter.value !== 'all' && pr.resource_type !== typeFilter.value) return false;
        if (!matchesSearch(pr)) return false;
        if (statusFilter.value === 'all') return true;
        if (statusFilter.value === 'DONE') return pr.status === 'MERGED' || pr.status === 'CLOSED';
        return pr.status === statusFilter.value;
    })
);

/** 제목 옆 배지 — 지금 내가 손대야 할 건수. */
const pendingCount = computed(() => myReviewPrs.value.filter((pr) => pr.status === 'OPEN').length);

const selectedPr = computed(() => prs.value.find((pr) => pr.id === selectedPrId.value) || null);
const selectedReviews = computed(() => (selectedPr.value ? reviewsByPr.value[selectedPr.value.id] || [] : []));

const canReviewSelected = computed(
    () => !!selectedPr.value && selectedPr.value.can_review && ACTIVE_STATUSES.includes(selectedPr.value.status)
);
const canVerifySelected = computed(() => canVerifyPr(selectedPr.value));

/**
 * 병합 버튼은 승인된 요청에 붙는다. 종류는 가리지 않는다 —
 * 검토를 여기서 끝냈는데 병합하러 다른 화면을 찾아가게 만들 이유가 없다.
 */
const canMergeSelected = computed(() => !!selectedPr.value && canReviewSelected.value && selectedPr.value.status === 'APPROVED');

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
        // 선택된 게 없으면 첫 요청을 펼쳐 둔다. 빈 상세 패널은 화면 절반을 차지하고도
        // 아무것도 알려주지 않아, 검토자가 한 번 더 클릭해야 할 이유가 없다.
        if (!selectedPrId.value && filteredPrs.value.length) selectPr(filteredPrs.value[0]);
    } catch (error) {
        loadError.value = errorText(error) || t('mergeRequestBoard.loadFailed');
    } finally {
        loading.value = false;
    }
}

/**
 * 지금 화면에 걸린 요청들의 요약·검증 상태만 채운다.
 * 전체를 한꺼번에 받으면 걸러 놓고 보지도 않을 요청까지 부르게 되므로,
 * 필터가 바뀔 때마다 이전 작업을 접고 보이는 것부터 다시 채운다.
 */
function refreshCardData() {
    summaryRun.aborted = true;
    const summarySignal = { aborted: false };
    summaryRun = summarySignal;

    const needSummary = filteredPrs.value.filter((pr) => !summaryByPr.value[pr.id]);
    if (!needSummary.length) return;
    loadPrSummaries(
        backend,
        needSummary,
        (prId, summary) => {
            summaryByPr.value = { ...summaryByPr.value, [prId]: summary };
        },
        { signal: summarySignal }
    );
}

/** 고른 요청의 검증 상태를 한 건만 받아 둔다. 검증 탭을 열면 그쪽이 다시 최신으로 덮는다. */
function refreshSelectedVerify() {
    verifyRun.aborted = true;
    const signal = { aborted: false };
    verifyRun = signal;
    const pr = selectedPr.value;
    if (!pr || verifyByPr.value[pr.id] || !canVerifyPr(pr)) return;
    loadPrVerifyStats(
        backend,
        [pr],
        (prId, stats) => {
            verifyByPr.value = { ...verifyByPr.value, [prId]: stats };
        },
        { signal, concurrency: 1 }
    );
}

watch(filteredPrs, (visible) => {
    refreshCardData();
    // 필터를 바꾸면 지금 골라 둔 요청이 목록에서 사라질 수 있다. 그대로 두면
    // 목록에는 프로세스만 남았는데 상세에는 스킬이 열려 있는 어긋난 화면이 된다.
    if (visible.length && !visible.some((pr) => pr.id === selectedPrId.value)) selectPr(visible[0]);
});

// 종류를 바꾸면 상태별 건수도 다시 계산된다. 고른 상태가 0건이 되면 목록만 비어 보이므로
// 그때만 전체로 되돌린다 — 멀쩡히 걸리는 필터까지 매번 풀면 고른 뜻이 사라진다.
watch(typeFilter, () => {
    const current = statusOptions.value.find((option) => option.value === statusFilter.value);
    if (current && current.count === 0) statusFilter.value = 'all';
});

const detailTab = ref<'changes' | 'verify' | 'reviews'>('changes');
/** 선택한 요청의 변경 내역 요약. PrChanges 가 계산해 올려 준다. */
const changeSummary = ref<{ summary: string; count: number; shape: 'files' | 'items'; unavailable: string }>({
    summary: '',
    count: 0,
    shape: 'files',
    unavailable: ''
});

const selectedVerify = computed<PrVerifyStats | null>(() => (selectedPr.value ? verifyByPr.value[selectedPr.value.id] || null : null));

/**
 * 액션 줄 위에 띄울 한 줄. 리소스 화면과 같은 기준으로, "아직 안 돌렸다" 도 알려준다 —
 * 침묵은 "이상 없음" 으로 오해된다.
 */
const verifyNotice = computed(() => {
    if (!canVerifySelected.value || !canReviewSelected.value) return null;
    const stats = selectedVerify.value;
    if (!stats) return null;
    if (stats.backfillStatus === 'running') return { tone: 'info', text: t('mergeRequestBoard.verifyNotice.backfilling') };
    if (!stats.hasSuite) return { tone: 'warn', text: t('mergeRequestBoard.verifyNotice.noSuite') };
    if (stats.runStatus === 'running') return { tone: 'info', text: t('mergeRequestBoard.verifyNotice.running') };
    if (stats.runStatus === 'failed') return { tone: 'bad', text: t('mergeRequestBoard.verifyNotice.failed') };
    if (stats.runStatus !== 'succeeded') return { tone: 'warn', text: t('mergeRequestBoard.verifyNotice.notRun', { total: stats.total }) };
    if (stats.broken) return { tone: 'bad', text: t('mergeRequestBoard.verifyNotice.broken', { count: stats.broken }) };
    if (stats.inconclusive) return { tone: 'warn', text: t('mergeRequestBoard.verifyNotice.inconclusive', { count: stats.inconclusive }) };
    // 깨진 '단계' 가 잡히지 않아도 시나리오가 새로 실패했다면 그게 곧 멈출 이유다.
    if (stats.newlyFailed) return { tone: 'bad', text: t('mergeRequestBoard.verifyNotice.newlyFailed', { count: stats.newlyFailed }) };
    return { tone: 'ok', text: t('mergeRequestBoard.verifyNotice.ok', { total: stats.total }) };
});

function selectPr(pr: any) {
    selectedPrId.value = pr.id;
    reviewError.value = '';
    mergeError.value = '';
    // 다른 요청의 판정이나 변경 내역이 잠깐이라도 남아 보이면 병합 직전 판단을 흐린다.
    detailTab.value = 'changes';
    changeSummary.value = { summary: '', count: 0, shape: 'files', unavailable: '' };
    refreshSelectedVerify();
}

function onChangeSummary(value: { summary: string; count: number; shape: 'files' | 'items'; unavailable: string }) {
    changeSummary.value = value;
}

/** 상세에서 검증을 돌리면 목록 카드의 배지도 같이 최신이 된다. */
function onVerificationStatus(stats: any) {
    if (!selectedPr.value) return;
    verifyByPr.value = { ...verifyByPr.value, [selectedPr.value.id]: stats };
}

/**
 * 상세 제목 자리에 세울 한 줄.
 * 목록에서 이미 받아 둔 요약이 있으면 먼저 쓰고, 없으면 상세가 계산한 것을 쓴다 —
 * 요청을 고르자마자 제목이 빈 채로 있다가 뒤늦게 바뀌는 일을 줄인다.
 */
const selectedHeadline = computed(() => {
    const pr = selectedPr.value;
    if (!pr) return '';
    const summary = summaryByPr.value[pr.id] || changeSummary.value.summary || meaningfulPrDescription(pr);
    return prHeadline(pr, summary);
});

/** 카드의 둘째 줄. 제목이 이미 요약이면 같은 말을 두 번 읽히지 않게 비운다. */
function cardChangeText(pr: any): string {
    const summary = summaryByPr.value[pr.id];
    if (!summary) return '';
    return prHeadline(pr, summary) === summary ? '' : summary;
}

function openResource(pr: any) {
    router.push(resourcePath(pr.resource_type, pr.resource_id));
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
        notify(
            t(
                action === 'APPROVED'
                    ? 'mergeRequestBoard.notify.approved'
                    : action === 'CHANGES_REQUESTED'
                    ? 'mergeRequestBoard.notify.changesRequested'
                    : 'mergeRequestBoard.notify.commented'
            )
        );
        await load();
    } catch (error) {
        reviewError.value = errorText(error) || t('mergeRequestBoard.error.review');
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
        if ((pr.resource_type || 'skill') === 'skill') {
            if (pr.git_pr_number) await backend.mergeSkillPullRequest(pr.resource_id, pr.git_pr_number);
            await backend.updateResourcePrStatus(pr, 'MERGED', { mergedAt: new Date().toISOString() });
            notify(t('mergeRequestBoard.notify.merged'));
        } else {
            const version = await mergeDefinitionPr(backend, pr);
            await backend.updateResourcePrStatus(pr, 'MERGED', {
                reviewerId: currentUserId.value,
                mergedAt: new Date().toISOString()
            });
            notify(t('mergeRequestBoard.notify.mergedVersion', { version }));
        }
        await load();
    } catch (error) {
        mergeError.value = errorText(error) || t('mergeRequestBoard.error.merge');
    } finally {
        mergeLoading.value = false;
    }
}

/* ── 좁은 화면 대응 ───────────────────────────────────────────────
 * 좌측 사이드바와 헤더를 이 화면에서 걷어낼 수는 없다. 대신 목록을 접거나 폭을 줄여
 * 상세에 폭을 몰아 줄 수 있게 하고, diff 를 읽는 동안에는 화면 전체를 쓰게 한다.
 */
const LIST_WIDTH_KEY = 'mrb-list-width';
const listCollapsed = ref(false);
const listWidth = ref(Number(localStorage.getItem(LIST_WIDTH_KEY)) || 320);
let dragFrom = 0;
let dragWidth = 0;

function onDragMove(event: MouseEvent) {
    listWidth.value = Math.min(560, Math.max(220, dragWidth + (event.clientX - dragFrom)));
}

function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    document.body.style.userSelect = '';
    localStorage.setItem(LIST_WIDTH_KEY, String(Math.round(listWidth.value)));
}

function startDrag(event: MouseEvent) {
    dragFrom = event.clientX;
    dragWidth = listWidth.value;
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
}

onMounted(load);

onBeforeUnmount(onDragEnd);
</script>

<template>
    <div>
        <v-card elevation="10" class="mrb-card-root">
            <v-card-text class="mrb-card-body d-flex flex-column">
                <!-- 제목 줄은 /todolist 의 업무 목록과 같은 크기·굵기로 맞춘다. -->
                <div class="d-flex align-center mb-3">
                    <h5 class="text-h5 font-weight-semibold">{{ $t('mergeRequestBoard.title') }}</h5>
                    <span v-if="pendingCount" class="mrb-pending ml-2">
                        {{ $t('mergeRequestBoard.pending', { count: pendingCount }) }}
                    </span>
                    <v-spacer></v-spacer>
                    <v-btn variant="outlined" size="small" :loading="loading" @click="load">
                        <v-icon start size="16">mdi-refresh</v-icon>
                        {{ $t('mergeRequestBoard.refresh') }}
                    </v-btn>
                </div>

                <!-- 본문 -->
                <div class="mrb-body">
                    <!-- 목록 -->
                    <div v-if="!listCollapsed" class="mrb-list-pane" :style="{ flexBasis: listWidth + 'px' }">
                        <!-- 필터는 이 목록을 거르는 장치다 — 목록 바로 위에 붙여 둔다. -->
                        <div class="mrb-list-head">
                            <button class="mrb-iconbtn" :title="$t('mergeRequestBoard.collapseList')" @click="listCollapsed = true">
                                <v-icon size="17">mdi-chevron-double-left</v-icon>
                            </button>
                            <label class="mrb-search">
                                <v-icon size="15" class="mrb-search-ico">mdi-magnify</v-icon>
                                <input v-model="searchText" type="search" :placeholder="$t('mergeRequestBoard.searchPlaceholder')" />
                            </label>
                            <div class="mrb-filter-row">
                                <select v-model="typeFilter" class="mrb-select">
                                    <option v-for="option in typeOptions" :key="option.value" :value="option.value">
                                        {{ option.title }}
                                    </option>
                                </select>
                                <select v-model="statusFilter" class="mrb-select">
                                    <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                                        {{ option.title }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div class="mrb-list-scroll">
                            <div v-if="loading" class="d-flex justify-center py-12">
                                <v-progress-circular indeterminate color="primary" />
                            </div>
                            <div v-else-if="loadError" class="mrb-empty">
                                <v-icon size="40" color="grey-lighten-1">mdi-alert-circle-outline</v-icon>
                                <div class="text-body-2 mt-3">{{ loadError }}</div>
                                <v-btn class="mt-3" size="small" color="primary" variant="flat" @click="load">
                                    {{ $t('mergeRequestBoard.retry') }}
                                </v-btn>
                            </div>
                            <div v-else-if="!filteredPrs.length" class="mrb-empty">
                                <v-icon size="40" color="grey-lighten-2">mdi-source-pull</v-icon>
                                <div class="text-body-2 text-medium-emphasis mt-3">{{ $t('mergeRequestBoard.empty') }}</div>
                            </div>
                            <div v-else class="d-flex flex-column ga-2">
                                <!--
                                    카드는 "무엇을 먼저 볼지" 고르는 자리다. 무엇이 바뀌는지를 맨 앞에 세우고,
                                    어느 리소스인지·언제인지는 그 아래 메타 줄이 받는다 —
                                    브랜치·PR 번호처럼 고르는 데 쓰이지 않는 것은 상세로 미룬다.
                                -->
                                <v-card
                                    v-for="pr in filteredPrs"
                                    :key="pr.id"
                                    variant="outlined"
                                    :class="['mrb-item', { 'mrb-item--on': pr.id === selectedPrId }]"
                                    @click="selectPr(pr)"
                                >
                                    <v-card-text class="mrb-item-body">
                                        <div class="mrb-item-title" :title="pr.title">
                                            {{ prHeadline(pr, summaryByPr[pr.id] || meaningfulPrDescription(pr)) }}
                                        </div>

                                        <div v-if="cardChangeText(pr)" class="mrb-item-change">{{ cardChangeText(pr) }}</div>

                                        <div class="mrb-item-meta">
                                            <PrTypeChip :type="pr.resource_type" />
                                            <span class="mrb-item-res" :title="pr.resource_name">{{ pr.resource_name }}</span>
                                            <span class="mrb-item-time">{{ formatRelativeTime(pr.updated_at || pr.created_at) }}</span>
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </div>
                        </div>
                    </div>

                    <!-- 접힌 목록을 다시 여는 자리. 목록이 있던 쪽에 그대로 둔다. -->
                    <button v-else class="mrb-list-rail" :title="$t('mergeRequestBoard.expandList')" @click="listCollapsed = false">
                        <v-icon size="17">mdi-chevron-double-right</v-icon>
                    </button>

                    <!-- 폭 조절 손잡이 — 좁은 화면에서 상세에 폭을 몰아 줄 수 있게 한다. -->
                    <div v-if="!listCollapsed" class="mrb-resizer" @mousedown.prevent="startDrag"></div>

                    <!-- 상세 -->
                    <v-card variant="outlined" class="mrb-detail-pane">
                        <div v-if="!selectedPr" class="mrb-empty">
                            <v-icon size="36" color="grey-lighten-2">mdi-gesture-tap</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">{{ $t('mergeRequestBoard.selectHint') }}</div>
                        </div>
                        <template v-else>
                            <PrHeader :pr="selectedPr" :headline="selectedHeadline" compact class="flex-shrink-0" />

                            <!-- 검토 단계 세 칸. 각 칸이 지금 어떤 상태인지 함께 말한다. -->
                            <div class="mrb-tabbar flex-shrink-0">
                                <button :class="['mrb-tab', { on: detailTab === 'changes' }]" @click="detailTab = 'changes'">
                                    {{ $t('mergeRequestBoard.tabs.changes') }}
                                    <span v-if="changeSummary.count" class="mrb-tab-cnt">{{ changeSummary.count }}</span>
                                </button>
                                <button
                                    v-if="canVerifySelected"
                                    :class="['mrb-tab', { on: detailTab === 'verify' }]"
                                    @click="detailTab = 'verify'"
                                >
                                    {{ $t('mergeRequestBoard.tabs.verify') }}
                                </button>
                                <button :class="['mrb-tab', { on: detailTab === 'reviews' }]" @click="detailTab = 'reviews'">
                                    {{ $t('mergeRequestBoard.tabs.reviews') }}
                                    <span v-if="selectedReviews.length" class="mrb-tab-tag tone-idle">
                                        {{ $t('mergeRequestBoard.tabs.reviewCount', { count: selectedReviews.length }) }}
                                    </span>
                                </button>
                            </div>

                            <div class="mrb-detail-scroll">
                                <template v-if="detailTab === 'verify' && canVerifySelected">
                                    <PrVerification
                                        :key="selectedPr.id"
                                        :skill-name="selectedPr.resource_id"
                                        :pr-number="selectedPr.git_pr_number"
                                        :resource-type="selectedPr.resource_type || 'skill'"
                                        :pr-id="selectedPr.id"
                                        :base-ref="selectedPr.base_branch"
                                        @status="onVerificationStatus"
                                    />
                                </template>
                                <template v-else-if="detailTab === 'changes'">
                                    <PrChanges :pr="selectedPr" :show-summary="false" business-view @summary="onChangeSummary" />
                                </template>
                                <template v-else>
                                    <PrReviewTimeline :reviews="selectedReviews" :pr="selectedPr" />
                                </template>
                            </div>

                            <!-- 승인·변경 요청·코멘트는 늘 같은 자리에 붙어 있다. -->
                            <PrActionBar
                                :pr="selectedPr"
                                :can-review="canReviewSelected"
                                :can-merge="canMergeSelected"
                                :loading="reviewLoading"
                                :error="reviewError"
                                :merge-loading="mergeLoading"
                                :merge-error="mergeError"
                                :notice="verifyNotice"
                                class="flex-shrink-0"
                                @submit="submitReview"
                                @merge="mergePr"
                                @open-resource="openResource(selectedPr)"
                                @show-verify="detailTab = 'verify'"
                            />
                        </template>
                    </v-card>
                </div>
            </v-card-text>
        </v-card>

        <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" timeout="3000">
            {{ snackbar.message }}
        </v-snackbar>
    </div>
</template>

<style scoped>
.mrb-card-root {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 110px);
}

/* ── 제목 줄 ── */
.mrb-card-body {
    min-height: 0;
    flex: 1;
    padding: 16px;
}
.mrb-pending {
    font-size: 11px;
    font-weight: 600;
    border-radius: 7px;
    padding: 2px 7px;
    background: #fbf0da;
    color: #92610a;
}

/* ── 목록 상단에 붙는 필터 ── */
.mrb-list-head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 0 4px 8px 0;
    flex: none;
}
.mrb-search {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 7px;
}
.mrb-search:focus-within {
    border-color: rgba(var(--v-theme-primary), 0.6);
}
.mrb-search-ico {
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.mrb-search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    font-family: inherit;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.mrb-filter-row {
    display: flex;
    gap: 6px;
    width: 100%;
}
.mrb-select {
    flex: 1 1 0;
    min-width: 0;
    height: 28px;
    padding: 0 22px 0 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 7px;
    font-family: inherit;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.75);
    background: transparent;
    /* 네이티브 화살표는 브라우저마다 크기가 널뛰어 폭이 들쭉날쭉해진다. */
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, rgba(120, 120, 120, 0.8) 50%),
        linear-gradient(135deg, rgba(120, 120, 120, 0.8) 50%, transparent 50%);
    background-position: calc(100% - 12px) 12px, calc(100% - 8px) 12px;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
    cursor: pointer;
}

.mrb-iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: none;
    color: rgba(var(--v-theme-on-surface), 0.5);
    cursor: pointer;
}
.mrb-iconbtn:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

/* 접힌 목록 자리 — 목록이 있던 쪽에 남아 무엇을 펴는 단추인지 드러난다. */
.mrb-list-rail {
    flex: none;
    width: 26px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    background: none;
    color: rgba(var(--v-theme-on-surface), 0.45);
    cursor: pointer;
    margin-right: 8px;
}
.mrb-list-rail:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.mrb-body {
    display: flex;
    gap: 0;
    flex: 1;
    min-height: 0;
}
/*
 * 검토는 오른쪽 상세에서 한다 — diff 를 읽고, 검증 결과를 보고, 리뷰를 남긴다.
 * 목록은 "어느 것을 볼지" 고르는 자리일 뿐이라, 폭을 검토자가 정하게 두고 나머지는 상세에 준다.
 */
.mrb-list-pane {
    flex-grow: 0;
    flex-shrink: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.mrb-list-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
}
.mrb-resizer {
    flex: none;
    width: 9px;
    cursor: col-resize;
    position: relative;
}
.mrb-resizer::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 1px;
    background: rgba(var(--v-border-color), var(--v-border-opacity));
}
.mrb-resizer:hover::after {
    background: rgb(var(--v-theme-primary));
    width: 2px;
}
.mrb-detail-pane {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* 폭이 좁으면 상세가 읽을 수 없게 눌리므로 위아래로 쌓는다. */
@media (max-width: 1100px) {
    .mrb-body {
        flex-direction: column;
        gap: 10px;
    }
    .mrb-list-pane {
        flex: 0 0 auto !important;
        max-height: 34vh;
        width: 100%;
    }
    .mrb-resizer {
        display: none;
    }
    .mrb-detail-pane {
        min-height: 420px;
    }
}

.mrb-detail-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* 변경사항 탭의 파일 목록 + diff 가 남은 높이를 채우도록 세로 흐름으로 둔다. */
    display: flex;
    flex-direction: column;
}

/* ── 검토 단계 탭 ── */
.mrb-tabbar {
    display: flex;
    /* 탭은 세 칸뿐이다 — 스크롤을 켜 두면 좁은 폭에서 탭 줄에 스크롤바가 끼어 높이를 먹는다. */
    flex-wrap: wrap;
    padding: 0 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mrb-tab {
    border: none;
    background: none;
    padding: 9px 4px;
    margin-right: 16px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    color: rgba(var(--v-theme-on-surface), 0.5);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.mrb-tab.on {
    color: rgba(var(--v-theme-on-surface), 0.87);
    border-bottom-color: rgb(var(--v-theme-primary));
}
.mrb-tab-cnt {
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.6);
    font-size: 11px;
    border-radius: 9px;
    padding: 0 7px;
    min-width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
/* 탭 옆 상태 한 마디 — 눌러 보기 전에 그 단계가 어떤 상태인지 알려 준다. */
.mrb-tab-tag {
    font-size: 10.5px;
    font-weight: 600;
    border-radius: 7px;
    padding: 1px 7px;
    white-space: nowrap;
}
.tone-ok {
    background: #e7f4df;
    color: #2e6b16;
}
.tone-bad {
    background: rgba(var(--v-theme-error), 0.12);
    color: rgb(var(--v-theme-error));
}
.tone-warn {
    background: #fbf0da;
    color: #92610a;
}
.tone-info {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}
.tone-idle {
    background: rgba(var(--v-theme-on-surface), 0.07);
    color: rgba(var(--v-theme-on-surface), 0.55);
}

/* ── 목록 카드 ── */
.mrb-item {
    cursor: pointer;
}
.mrb-item:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}
.mrb-item--on {
    background: rgba(var(--v-theme-primary), 0.06);
    border-color: rgb(var(--v-theme-primary));
}

.mrb-item-body {
    padding: 10px 12px;
}

/* 종류·리소스·시각 — 고르는 데 곁들이는 정보라 제목 아래로 내려간다. */
.mrb-item-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
}
.mrb-item-title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.87);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 핵심 변경 한 줄. 카드 높이가 들쭉날쭉해지지 않게 두 줄에서 자른다. */
.mrb-item-change {
    margin-top: 3px;
    font-size: 11.5px;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 이름이 길면 이름이 줄어든다 — 시각이 아랫줄로 떨어지면 카드가 한 줄씩 더 길어진다. */
.mrb-item-res {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.mrb-item-time {
    flex: none;
    margin-left: auto;
    padding-left: 6px;
    font-size: 11px;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.45);
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

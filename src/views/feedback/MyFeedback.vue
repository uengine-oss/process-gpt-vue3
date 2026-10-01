<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import { t } from '@/composables/i18nText';
import {
    formatDate,
    formatRelativeTime,
    getAvatarColor,
    getInitial,
    prStatusLabel,
    prBadgeClass,
    resourcePath
} from '@/composables/usePrUtils';

/**
 * 내 피드백 — 내가 피드백을 남긴 워크아이템마다, 그 피드백이 어떻게 처리됐는지 보여준다.
 *
 * 처리 단위는 워크아이템이다. 완료된 워크아이템에 남긴 피드백은 몇 건이든 한 단위로 수집되고,
 * 그 단위가 분류·승인·반영되는 것이 한 회차다. 처리된 뒤 같은 워크아이템에 남긴 피드백은
 * 다음 회차로 묶인다.
 *
 * 보이는 워크아이템은 scope 로 고른다 — 기본은 내가 참여 중인 인스턴스와 담당 워크아이템, 내가
 * 피드백을 남긴 워크아이템 전부이고, 거기 남겨진 피드백은 누가 남겼든 모두 댓글처럼 보인다.
 *
 * 틀은 병합 요청함(MergeRequestBoard.vue)과 같다 — 왼쪽 목록에서 워크아이템을 고르고,
 * 오른쪽 상세에서 그 워크아이템의 회차를 읽는다. 두 화면을 오가며 쓰므로 모양을 맞춘다.
 * 기획: openspec/changes/feedback-processing-status/planning.md
 */

const backend = BackendFactory.createBackend() as any;
const router = useRouter();

const loading = ref(false);
const loadError = ref('');
const workitems = ref<any[]>([]);
const searchText = ref('');
const filter = ref('all');
const scope = ref<'participating' | 'mine'>('participating');
const SCOPES = ['participating', 'mine'];
// 프로필 이미지를 못 불러온 작성자 — 이니셜 아바타로 바꿔 보여준다.
const brokenProfiles = ref<Record<string, boolean>>({});
const selectedTodoId = ref<string | null>(null);
const expanded = ref<Record<string, boolean>>({});

const FILTERS = ['all', 'progress', 'applied', 'closed'];
const STEPS = ['submit', 'collect', 'classify', 'review', 'apply', 'merge'];

// 단계마다 "어디까지 왔고, 그 자리에서 진행 중인지 멈췄는지".
const STAGE_POSITION: Record<string, { at: number; state: 'current' | 'stopped' }> = {
    WAITING_DONE: { at: 1, state: 'current' },
    WAITING: { at: 1, state: 'current' },
    COLLECTING: { at: 1, state: 'current' },
    NOT_ELIGIBLE: { at: 1, state: 'stopped' },
    UNTRACKED: { at: 1, state: 'stopped' },
    CLASSIFYING: { at: 2, state: 'current' },
    DISCARDED: { at: 2, state: 'stopped' },
    PENDING_REVIEW: { at: 3, state: 'current' },
    REJECTED: { at: 3, state: 'stopped' },
    APPROVED: { at: 4, state: 'current' },
    APPLYING: { at: 4, state: 'current' },
    APPLY_FAILED: { at: 4, state: 'stopped' },
    NO_CHANGE: { at: 4, state: 'stopped' },
    APPLIED: { at: 5, state: 'current' },
    MERGED: { at: 6, state: 'current' }
};

const STAGE_GROUP: Record<string, 'progress' | 'applied' | 'closed'> = {
    WAITING_DONE: 'progress',
    WAITING: 'progress',
    COLLECTING: 'progress',
    CLASSIFYING: 'progress',
    PENDING_REVIEW: 'progress',
    APPROVED: 'progress',
    APPLYING: 'progress',
    APPLIED: 'applied',
    MERGED: 'applied',
    DISCARDED: 'closed',
    REJECTED: 'closed',
    APPLY_FAILED: 'closed',
    NO_CHANGE: 'closed',
    NOT_ELIGIBLE: 'closed',
    UNTRACKED: 'closed'
};

function stageGroup(stage: string) {
    return STAGE_GROUP[stage] || 'progress';
}

/** 상태 배지 색 — 병합 요청함의 tone-* 를 그대로 쓴다. 누군가의 결정을 기다리는 단계는 검토 대기와 같은 색. */
function stageTone(stage: string) {
    if (stage === 'APPLY_FAILED') return 'tone-bad';
    if (stage === 'PENDING_REVIEW') return 'tone-warn';
    if (stage === 'MERGED') return 'tone-merged';
    const group = stageGroup(stage);
    if (group === 'applied') return 'tone-ok';
    if (group === 'closed') return 'tone-idle';
    return 'tone-info';
}

function stepState(stage: string, index: number) {
    const pos = STAGE_POSITION[stage] || { at: 0, state: 'current' };
    if (index < pos.at) return 'done';
    if (index === pos.at) return pos.state;
    return 'todo';
}

/**
 * 워크아이템이 어느 필터에 속하는지. 최근 회차의 결과를 따르되, 다음 회차로 수집을 기다리는
 * 피드백이 있으면 아직 진행 중인 워크아이템으로 본다.
 */
function workitemGroup(w: any) {
    if (w.pending && stageGroup(w.pending.stage) === 'progress') return 'progress';
    return stageGroup(w.stage);
}

/** 상세에는 최신 회차부터 보인다. 수집을 기다리는 피드백은 그 위에 "다음 회차"로 둔다. */
function roundsNewestFirst(w: any) {
    return [...(w.rounds || [])].reverse();
}

/**
 * 인스턴스 표시 이름. 인스턴스 이름은 "<프로세스 이름> · <제목>" 이나 "<이름>_<uuid>" 로 저장된 것이
 * 많다 — 프로세스 이름은 따로 보여주고, uuid 는 앞 8자리만 남긴다.
 */
function instanceLabel(w: any) {
    let name = String(w.proc_inst_name || '').trim();
    const prefix = `${w.proc_def_name || ''} · `;
    if (w.proc_def_name && name.startsWith(prefix)) name = name.slice(prefix.length);
    // uuid 전체는 읽을 수 없지만, 이름이 같은 인스턴스끼리는 앞 8자리로 구분한다.
    name = name.replace(/_([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, ' #$1');
    return name || t('myFeedback.noInstance');
}

const counts = computed(() => {
    const c: Record<string, number> = { all: workitems.value.length, progress: 0, applied: 0, closed: 0 };
    workitems.value.forEach((w) => (c[workitemGroup(w)] += 1));
    return c;
});

const filterOptions = computed(() =>
    FILTERS.map((key) => ({ value: key, title: `${t(`myFeedback.filter.${key}`)} (${counts.value[key]})` }))
);

/** 검색은 활동·프로세스·인스턴스 이름과 남긴 피드백 내용까지 훑는다. */
function matchesSearch(w: any) {
    // 입력을 지우면 null 이 들어올 수 있다.
    const query = (searchText.value || '').trim().toLowerCase();
    if (!query) return true;
    const feedbacks = [...(w.pending?.feedbacks || []), ...(w.rounds || []).flatMap((r: any) => r.feedbacks || [])];
    return [w.activity_name, w.proc_def_name, w.proc_inst_name, ...feedbacks.map((f: any) => f.content)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
}

const visibleWorkitems = computed(() =>
    workitems.value.filter((w) => (filter.value === 'all' || workitemGroup(w) === filter.value) && matchesSearch(w))
);

/** 제목 옆 배지 — 아직 결과가 나지 않은 워크아이템 수. */
const progressCount = computed(() => counts.value.progress);

const selected = computed(() => workitems.value.find((w) => w.todo_id === selectedTodoId.value) || null);

// 걸러서 선택한 항목이 목록에서 빠지면 보이는 첫 항목을 고른다 — 상세가 목록과 어긋나지 않게.
watch(visibleWorkitems, (visible) => {
    if (visible.length && !visible.some((w) => w.todo_id === selectedTodoId.value)) selectedTodoId.value = visible[0].todo_id;
});

watch(scope, load);

function authorName(f: any) {
    return f.author_name || t('myFeedback.unknownAuthor');
}

function showProfile(f: any) {
    return !!f.author_profile && !brokenProfiles.value[f.author_profile];
}

function roundKey(w: any, round: any) {
    return `${w.todo_id}:${round.round}`;
}

function targetTypeLabel(type: string) {
    return t(`myFeedback.targetType.${type}`);
}

function targetStageLabel(target: any) {
    return t(`myFeedback.targetStage.${target.stage}`);
}

function collectingHint(batch: any) {
    if (!batch) return '';
    if (batch.workitem_count >= batch.trigger_count) {
        return t('myFeedback.collectingReady', { count: batch.workitem_count });
    }
    return t('myFeedback.collectingHint', {
        count: batch.workitem_count,
        total: batch.trigger_count,
        deadline: formatDate(batch.trigger_deadline)
    });
}

function pendingHint(stage: string) {
    return t(`myFeedback.pendingHint.${stage}`);
}

function resultLine(result: any) {
    const parts: string[] = [];
    if (result.draft_version) parts.push(t('myFeedback.draftVersion', { version: result.draft_version }));
    if (result.branch) parts.push(t('myFeedback.branch', { branch: result.branch }));
    return parts.join(' · ');
}

function openResource(result: any) {
    if (!result.resource_id) return;
    router.push(resourcePath(result.resource_type, result.resource_id));
}

function openWorkItem(w: any) {
    router.push(`/todolist/${w.todo_id}`);
}

/** 인스턴스 화면 주소는 id 의 '.' 을 '_DOT_' 로 바꿔 쓴다(인스턴스 목록 링크와 같은 규칙). */
function openInstance(w: any) {
    if (!w.proc_inst_id) return;
    router.push(`/instancelist/${String(w.proc_inst_id).replace(/\./g, '_DOT_')}`);
}

async function load() {
    loading.value = true;
    loadError.value = '';
    try {
        const tenantId = (window as any).$tenantName;
        const userId = localStorage.getItem('uid') || '';
        workitems.value = await backend.getMyFeedback(tenantId, userId, scope.value);
        if (!selectedTodoId.value && visibleWorkitems.value.length) selectedTodoId.value = visibleWorkitems.value[0].todo_id;
    } catch (e) {
        console.error('내 피드백 조회 실패:', e);
        loadError.value = t('myFeedback.loadError');
    } finally {
        loading.value = false;
    }
}

// 배치가 분류되거나 승인·반영 결과가 기록되면 다시 읽는다.
let watchRef: any = null;
let reloadTimer: any = null;
async function subscribe() {
    try {
        watchRef = await backend.watchFeedbackProposals(() => {
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(load, 500);
        });
    } catch (e) {
        console.error('Failed to subscribe feedback_proposals realtime:', e);
    }
}

/* ── 목록 폭 조절·접기 — 병합 요청함과 같은 동작 ── */
const LIST_WIDTH_KEY = 'mf-list-width';
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

onMounted(() => {
    load();
    subscribe();
});

onBeforeUnmount(() => {
    onDragEnd();
    clearTimeout(reloadTimer);
    if (watchRef && typeof watchRef.unsubscribe === 'function') watchRef.unsubscribe();
});
</script>

<template>
    <div>
        <v-card elevation="10" class="mf-card-root">
            <v-card-text class="mf-card-body d-flex flex-column">
                <!-- 제목 줄은 병합 요청함·업무 목록과 같은 크기·굵기로 맞춘다. -->
                <div class="d-flex align-center mb-3">
                    <h5 class="text-h5 font-weight-semibold">{{ t('myFeedback.title') }}</h5>
                    <span v-if="progressCount" class="mf-pending ml-2">{{
                        t('myFeedback.inProgressBadge', { count: progressCount })
                    }}</span>
                    <v-spacer></v-spacer>
                    <v-btn variant="outlined" size="small" :loading="loading" @click="load">
                        <v-icon start size="16">mdi-refresh</v-icon>
                        {{ t('myFeedback.refresh') }}
                    </v-btn>
                </div>

                <div class="mf-body">
                    <!-- 목록 -->
                    <div v-if="!listCollapsed" class="mf-list-pane" :style="{ flexBasis: listWidth + 'px' }">
                        <div class="mf-list-head">
                            <button class="mf-iconbtn" :title="t('myFeedback.collapseList')" @click="listCollapsed = true">
                                <v-icon size="17">mdi-chevron-double-left</v-icon>
                            </button>
                            <label class="mf-search">
                                <v-icon size="15" class="mf-search-ico">mdi-magnify</v-icon>
                                <input v-model="searchText" type="search" :placeholder="t('myFeedback.searchPlaceholder')" />
                            </label>
                            <div class="mf-filter-row">
                                <select v-model="scope" class="mf-select">
                                    <option v-for="key in SCOPES" :key="key" :value="key">{{ t(`myFeedback.scope.${key}`) }}</option>
                                </select>
                                <select v-model="filter" class="mf-select">
                                    <option v-for="option in filterOptions" :key="option.value" :value="option.value">
                                        {{ option.title }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div class="mf-list-scroll">
                            <div v-if="loading && !workitems.length" class="d-flex justify-center py-12">
                                <v-progress-circular indeterminate color="primary" />
                            </div>
                            <div v-else-if="loadError" class="mf-empty">
                                <v-icon size="40" color="grey-lighten-1">mdi-alert-circle-outline</v-icon>
                                <div class="text-body-2 mt-3">{{ loadError }}</div>
                                <v-btn class="mt-3" size="small" color="primary" variant="flat" @click="load">
                                    {{ t('myFeedback.retry') }}
                                </v-btn>
                            </div>
                            <div v-else-if="!visibleWorkitems.length" class="mf-empty">
                                <v-icon size="40" color="grey-lighten-2">mdi-message-text-clock-outline</v-icon>
                                <div class="text-body-2 text-medium-emphasis mt-3">
                                    {{ workitems.length ? t('myFeedback.emptyFilter') : t('myFeedback.empty') }}
                                </div>
                            </div>
                            <div v-else class="d-flex flex-column ga-2">
                                <v-card
                                    v-for="w in visibleWorkitems"
                                    :key="w.todo_id"
                                    variant="outlined"
                                    :class="['mf-item', { 'mf-item--on': w.todo_id === selectedTodoId }]"
                                    :data-stage="w.stage"
                                    @click="selectedTodoId = w.todo_id"
                                >
                                    <v-card-text class="mf-item-body">
                                        <!-- 어느 인스턴스의 어느 워크아이템인지가 먼저다 — 피드백 내용은 상세에서 읽는다. -->
                                        <div class="mf-item-title" :title="w.proc_inst_name">{{ instanceLabel(w) }}</div>
                                        <div class="mf-item-change">
                                            <v-icon size="13" class="mf-item-ico">mdi-subdirectory-arrow-right</v-icon>
                                            {{ w.activity_name }}
                                            <span class="mf-item-count"
                                                >· {{ t('myFeedback.feedbackCount', { count: w.feedback_count }) }}</span
                                            >
                                        </div>
                                        <div class="mf-item-meta">
                                            <span :class="['mf-tag', stageTone(w.stage)]">{{ t(`myFeedback.stage.${w.stage}`) }}</span>
                                            <span class="mf-item-res" :title="w.proc_def_name">{{ w.proc_def_name }}</span>
                                            <span class="mf-item-time">{{ formatRelativeTime(w.last_feedback_at) }}</span>
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </div>
                        </div>
                    </div>

                    <button v-else class="mf-list-rail" :title="t('myFeedback.expandList')" @click="listCollapsed = false">
                        <v-icon size="17">mdi-chevron-double-right</v-icon>
                    </button>

                    <div v-if="!listCollapsed" class="mf-resizer" @mousedown.prevent="startDrag"></div>

                    <!-- 상세 -->
                    <v-card variant="outlined" class="mf-detail-pane">
                        <div v-if="!selected" class="mf-empty">
                            <v-icon size="36" color="grey-lighten-2">mdi-gesture-tap</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">{{ t('myFeedback.selectHint') }}</div>
                        </div>
                        <template v-else>
                            <!-- 머리 — 병합 요청함 상세(PrHeader compact)와 같은 모양. -->
                            <div class="mf-header flex-shrink-0">
                                <div class="mf-header-title-line">
                                    <!-- 상태는 목록 카드와 회차마다 이미 보인다 — 머리에는 다시 달지 않는다. -->
                                    <span class="mf-header-title">{{ selected.activity_name }}</span>
                                </div>
                                <div class="mf-header-meta">
                                    <span>{{ selected.proc_def_name }}</span>
                                    <span class="mf-dot-sep">›</span>
                                    <button
                                        v-if="selected.proc_inst_id"
                                        type="button"
                                        class="mf-link"
                                        :title="selected.proc_inst_name"
                                        @click="openInstance(selected)"
                                    >
                                        {{ instanceLabel(selected) }}
                                    </button>
                                    <span v-else>{{ instanceLabel(selected) }}</span>
                                    <span class="mf-dot-sep">·</span>
                                    <span>{{ t('myFeedback.feedbackCount', { count: selected.feedback_count }) }}</span>
                                    <span class="mf-dot-sep">·</span>
                                    <span>{{ t('myFeedback.lastFeedback', { at: formatDate(selected.last_feedback_at) }) }}</span>
                                    <button type="button" class="mf-link ml-auto" @click="openWorkItem(selected)">
                                        {{ t('myFeedback.openWorkItem') }}
                                    </button>
                                </div>
                            </div>

                            <div class="mf-detail-scroll">
                                <!-- 아직 수집되지 않은 피드백 — 다음 회차 -->
                                <section v-if="selected.pending" class="mf-round mf-round-pending">
                                    <div class="mf-round-head">
                                        <span class="mf-round-title">{{
                                            t('myFeedback.nextRound', { count: selected.pending.feedbacks.length })
                                        }}</span>
                                        <span :class="['mf-tag', stageTone(selected.pending.stage)]">
                                            {{ t(`myFeedback.stage.${selected.pending.stage}`) }}
                                        </span>
                                    </div>
                                    <!-- 피드백은 댓글처럼 — 병합 요청함 리뷰 이력(PrReviewTimeline)과 같은 한 줄 모양. -->
                                    <div class="mf-comments">
                                        <div
                                            v-for="(f, fi) in selected.pending.feedbacks"
                                            :key="fi"
                                            class="mf-comment"
                                            :class="{ 'mf-comment--mine': f.is_mine }"
                                        >
                                            <span
                                                class="mf-avatar"
                                                :style="{ background: showProfile(f) ? 'transparent' : getAvatarColor(authorName(f)) }"
                                            >
                                                <img
                                                    v-if="showProfile(f)"
                                                    :src="f.author_profile"
                                                    :alt="authorName(f)"
                                                    @error="brokenProfiles[f.author_profile] = true"
                                                />
                                                <template v-else>{{ f.author_name ? getInitial(f.author_name) : '?' }}</template>
                                            </span>
                                            <div class="mf-comment-body">
                                                <div class="mf-comment-head">
                                                    <span class="mf-comment-name">{{ authorName(f) }}</span>
                                                    <span v-if="f.is_mine" class="mf-me">{{ t('myFeedback.me') }}</span>
                                                    <span class="mf-comment-time">{{ formatDate(f.time) }}</span>
                                                </div>
                                                <div class="mf-comment-text">{{ f.content }}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="mf-note">{{ pendingHint(selected.pending.stage) }}</p>
                                </section>

                                <section
                                    v-for="round in roundsNewestFirst(selected)"
                                    :key="roundKey(selected, round)"
                                    class="mf-round"
                                    :data-round-stage="round.stage"
                                >
                                    <div class="mf-round-head">
                                        <span class="mf-round-title">{{
                                            t('myFeedback.round', { n: round.round, count: round.feedbacks.length })
                                        }}</span>
                                        <span :class="['mf-tag', stageTone(round.stage)]">{{ t(`myFeedback.stage.${round.stage}`) }}</span>
                                    </div>

                                    <ol class="mf-steps" :aria-label="t('myFeedback.stepsLabel')">
                                        <li
                                            v-for="(step, index) in STEPS"
                                            :key="step"
                                            class="mf-step"
                                            :class="stepState(round.stage, index)"
                                        >
                                            <span class="mf-dot"></span>
                                            <span class="mf-step-label">{{ t(`myFeedback.step.${step}`) }}</span>
                                        </li>
                                    </ol>

                                    <!-- 피드백은 댓글처럼 — 병합 요청함 리뷰 이력(PrReviewTimeline)과 같은 한 줄 모양. -->
                                    <div class="mf-comments">
                                        <div
                                            v-for="(f, fi) in round.feedbacks"
                                            :key="fi"
                                            class="mf-comment"
                                            :class="{ 'mf-comment--mine': f.is_mine }"
                                        >
                                            <span
                                                class="mf-avatar"
                                                :style="{ background: showProfile(f) ? 'transparent' : getAvatarColor(authorName(f)) }"
                                            >
                                                <img
                                                    v-if="showProfile(f)"
                                                    :src="f.author_profile"
                                                    :alt="authorName(f)"
                                                    @error="brokenProfiles[f.author_profile] = true"
                                                />
                                                <template v-else>{{ f.author_name ? getInitial(f.author_name) : '?' }}</template>
                                            </span>
                                            <div class="mf-comment-body">
                                                <div class="mf-comment-head">
                                                    <span class="mf-comment-name">{{ authorName(f) }}</span>
                                                    <span v-if="f.is_mine" class="mf-me">{{ t('myFeedback.me') }}</span>
                                                    <span class="mf-comment-time">{{ formatDate(f.time) }}</span>
                                                </div>
                                                <div class="mf-comment-text">{{ f.content }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <p v-if="round.stage === 'COLLECTING'" class="mf-note">{{ collectingHint(round.batch) }}</p>
                                    <p v-else-if="round.stage === 'CLASSIFYING'" class="mf-note">{{ t('myFeedback.classifyingHint') }}</p>
                                    <p v-else-if="round.stage === 'UNTRACKED'" class="mf-note">{{ t('myFeedback.untrackedHint') }}</p>
                                    <div v-if="round.stage === 'DISCARDED'" class="mf-discard">
                                        <div class="mf-discard-reason">
                                            {{ t('myFeedback.discardReason') }}:
                                            {{ round.batch?.discard_reason || t('myFeedback.discardReasonUnknown') }}
                                        </div>
                                        <ul v-if="round.batch?.dropped_targets?.length" class="mf-dropped">
                                            <li v-for="(d, i) in round.batch.dropped_targets" :key="i">
                                                <strong>{{ targetTypeLabel(d.type) }}</strong> — {{ d.drop_reason }}
                                                <div v-if="d.artifact_summary" class="mf-summary">{{ d.artifact_summary }}</div>
                                            </li>
                                        </ul>
                                    </div>

                                    <div v-if="round.targets.length" class="mf-targets">
                                        <button
                                            type="button"
                                            class="mf-toggle"
                                            :aria-expanded="!!expanded[roundKey(selected, round)]"
                                            @click="expanded[roundKey(selected, round)] = !expanded[roundKey(selected, round)]"
                                        >
                                            <v-icon size="16">{{
                                                expanded[roundKey(selected, round)] ? 'mdi-chevron-down' : 'mdi-chevron-right'
                                            }}</v-icon>
                                            {{
                                                t('myFeedback.classification', {
                                                    count: round.targets.length + (round.batch?.dropped_targets?.length || 0)
                                                })
                                            }}
                                        </button>
                                        <ul v-show="expanded[roundKey(selected, round)]" class="mf-target-list">
                                            <li v-for="(target, ti) in round.targets" :key="ti" class="mf-target">
                                                <div class="mf-target-head">
                                                    <span class="mf-type">{{ targetTypeLabel(target.type) }}</span>
                                                    <span class="mf-target-name">{{ target.name || target.id }}</span>
                                                    <span :class="['mf-tag', stageTone(target.stage)]">{{ targetStageLabel(target) }}</span>
                                                </div>
                                                <div v-if="target.artifact_summary" class="mf-summary">{{ target.artifact_summary }}</div>
                                                <div v-if="target.decided_by_name" class="mf-decision">
                                                    {{
                                                        t('myFeedback.decidedBy', {
                                                            name: target.decided_by_name,
                                                            at: formatDate(target.decided_at)
                                                        })
                                                    }}
                                                    <span v-if="target.decision_note"> — {{ target.decision_note }}</span>
                                                </div>
                                                <div v-if="target.apply_error" class="mf-error">{{ target.apply_error }}</div>
                                                <ul v-if="target.apply_results?.length" class="mf-results">
                                                    <li v-for="(r, ri) in target.apply_results" :key="ri" class="mf-result">
                                                        <template v-if="r.pull_request">
                                                            <span :class="['mf-pr-badge', prBadgeClass(r.pull_request.status)]">
                                                                {{ prStatusLabel(r.pull_request.status) }}
                                                            </span>
                                                            <button type="button" class="mf-link" @click="openResource(r)">
                                                                {{ r.pull_request.title }}
                                                            </button>
                                                        </template>
                                                        <span v-else-if="r.error" class="mf-error">{{ r.error }}</span>
                                                        <span v-if="resultLine(r)" class="mf-result-meta">{{ resultLine(r) }}</span>
                                                    </li>
                                                </ul>
                                            </li>
                                            <li
                                                v-for="(d, di) in round.batch?.dropped_targets || []"
                                                :key="`dropped-${di}`"
                                                class="mf-target mf-target-dropped"
                                            >
                                                <div class="mf-target-head">
                                                    <span class="mf-type">{{ targetTypeLabel(d.type) }}</span>
                                                    <span class="mf-target-name">{{ t('myFeedback.droppedTitle') }}</span>
                                                    <span class="mf-tag tone-idle">{{ t('myFeedback.dropped') }}</span>
                                                </div>
                                                <div class="mf-decision">{{ d.drop_reason }}</div>
                                                <div v-if="d.artifact_summary" class="mf-summary">{{ d.artifact_summary }}</div>
                                            </li>
                                        </ul>
                                    </div>
                                </section>
                            </div>
                        </template>
                    </v-card>
                </div>
            </v-card-text>
        </v-card>
    </div>
</template>

<style scoped>
/*
 * 틀·크기·색은 병합 요청함(MergeRequestBoard.vue)의 값을 그대로 따른다.
 * 두 화면은 "내 피드백 → 그것이 만든 병합 요청" 으로 이어서 보는 화면이라 모양이 같아야 한다.
 */
.mf-card-root {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 110px);
}

/* ── 제목 줄 ── */
.mf-card-body {
    min-height: 0;
    flex: 1;
    padding: 16px;
}
.mf-pending {
    font-size: 11px;
    font-weight: 600;
    border-radius: 7px;
    padding: 2px 7px;
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}

/* ── 목록 상단에 붙는 필터 ── */
.mf-list-head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 0 4px 8px 0;
    flex: none;
}
.mf-search {
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
.mf-search:focus-within {
    border-color: rgba(var(--v-theme-primary), 0.6);
}
.mf-search-ico {
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.mf-search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    font-family: inherit;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.mf-filter-row {
    display: flex;
    gap: 6px;
    width: 100%;
}
.mf-select {
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
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, rgba(120, 120, 120, 0.8) 50%),
        linear-gradient(135deg, rgba(120, 120, 120, 0.8) 50%, transparent 50%);
    background-position: calc(100% - 12px) 12px, calc(100% - 8px) 12px;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
    cursor: pointer;
}

.mf-iconbtn {
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
.mf-iconbtn:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

.mf-list-rail {
    flex: none;
    width: 26px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    background: none;
    color: rgba(var(--v-theme-on-surface), 0.45);
    cursor: pointer;
    margin-right: 8px;
}
.mf-list-rail:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.mf-body {
    display: flex;
    gap: 0;
    flex: 1;
    min-height: 0;
}
.mf-list-pane {
    flex-grow: 0;
    flex-shrink: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.mf-list-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
}
.mf-resizer {
    flex: none;
    width: 9px;
    cursor: col-resize;
    position: relative;
}
.mf-resizer::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 1px;
    background: rgba(var(--v-border-color), var(--v-border-opacity));
}
.mf-resizer:hover::after {
    background: rgb(var(--v-theme-primary));
    width: 2px;
}
.mf-detail-pane {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

@media (max-width: 1100px) {
    .mf-body {
        flex-direction: column;
        gap: 10px;
    }
    .mf-list-pane {
        flex: 0 0 auto !important;
        max-height: 34vh;
        width: 100%;
    }
    .mf-resizer {
        display: none;
    }
    .mf-detail-pane {
        min-height: 420px;
    }
}

.mf-detail-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px 16px;
}

.mf-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 16px;
    flex: 1;
}

/* ── 상태 배지 — 병합 요청함의 tone-* 와 같은 색 ── */
.mf-tag {
    flex: none;
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
.tone-merged {
    background: #efeafb;
    color: #5b46b8;
}

/* ── 목록 카드 ── */
.mf-item {
    cursor: pointer;
}
.mf-item:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}
.mf-item--on {
    background: rgba(var(--v-theme-primary), 0.06);
    border-color: rgb(var(--v-theme-primary));
}
.mf-item-body {
    padding: 10px 12px;
}
.mf-item-title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.87);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.mf-item-change {
    margin-top: 3px;
    font-size: 11.5px;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.mf-item-ico {
    color: rgba(var(--v-theme-on-surface), 0.4);
    vertical-align: -1px;
}
.mf-item-count {
    color: rgba(var(--v-theme-on-surface), 0.45);
}
.mf-item-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
}
.mf-item-res {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.mf-item-time {
    flex: none;
    margin-left: auto;
    padding-left: 6px;
    font-size: 11px;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ── 상세 머리 — PrHeader compact 와 같은 모양 ── */
.mf-header {
    padding: 11px 16px 10px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mf-header-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    line-height: 1.45;
    margin-bottom: 6px;
}
.mf-header-title {
    font-size: 14px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.mf-header-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.mf-dot-sep {
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.mf-link {
    background: none;
    border: none;
    padding: 0;
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    text-align: left;
}
.mf-link:hover {
    text-decoration: underline;
}

/* ── 회차 ── */
.mf-round {
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mf-round + .mf-round {
    margin-top: 10px;
}
.mf-round-pending {
    border-style: dashed;
}
.mf-round-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.mf-round-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
/* 피드백 댓글 — PrReviewTimeline(.rtl-*) 과 같은 크기·색 */
.mf-comments {
    margin: 10px 0 0;
}
.mf-comment {
    display: flex;
    gap: 10px;
    padding: 8px 0;
}
.mf-comment + .mf-comment {
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mf-avatar {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
}
.mf-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.mf-comment-body {
    flex: 1;
    min-width: 0;
}
.mf-comment-head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12.5px;
    line-height: 1.4;
}
.mf-comment-name {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.mf-me {
    font-size: 10px;
    font-weight: 600;
    border-radius: 6px;
    padding: 1px 6px;
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.mf-comment-time {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}
.mf-comment-text {
    margin-top: 4px;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}
.mf-note {
    margin: 8px 0 0;
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

/* 단계 표시줄 */
.mf-steps {
    list-style: none;
    display: flex;
    padding: 0;
    margin: 12px 0 4px;
}
.mf-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    min-width: 0;
}
.mf-step::before {
    content: '';
    position: absolute;
    top: 5px;
    left: -50%;
    width: 100%;
    height: 2px;
    background: rgba(var(--v-theme-on-surface), 0.12);
}
.mf-step:first-child::before {
    display: none;
}
.mf-step.done::before,
.mf-step.current::before,
.mf-step.stopped::before {
    background: rgb(var(--v-theme-primary));
}
.mf-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(var(--v-theme-on-surface), 0.25);
    background: rgb(var(--v-theme-surface));
    position: relative;
    z-index: 1;
}
.mf-step.done .mf-dot {
    background: rgb(var(--v-theme-primary));
    border-color: rgb(var(--v-theme-primary));
}
.mf-step.current .mf-dot {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.2);
}
.mf-step.current,
.mf-step.done {
    color: rgba(var(--v-theme-on-surface), 0.8);
}
.mf-step.stopped .mf-dot {
    background: rgba(var(--v-theme-on-surface), 0.35);
    border-color: rgba(var(--v-theme-on-surface), 0.35);
}
.mf-step.stopped {
    color: rgba(var(--v-theme-on-surface), 0.8);
    font-weight: 600;
}
.mf-step-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

/* 폐기 */
.mf-discard {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 7px;
    background: rgba(var(--v-theme-on-surface), 0.04);
    font-size: 12px;
}
.mf-discard-reason {
    font-weight: 600;
}
.mf-dropped {
    margin: 6px 0 0;
    padding-left: 18px;
}

/* 분류 결과 */
.mf-targets {
    margin-top: 10px;
}
.mf-toggle {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.mf-target-list {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
}
.mf-target {
    padding: 10px 12px;
    border-radius: 7px;
    background: rgba(var(--v-theme-on-surface), 0.03);
}
.mf-target + .mf-target {
    margin-top: 6px;
}
.mf-target-dropped {
    opacity: 0.8;
}
.mf-target-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.mf-type {
    font-size: 10.5px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 6px;
    background: rgba(var(--v-theme-on-surface), 0.07);
    color: rgba(var(--v-theme-on-surface), 0.65);
}
.mf-target-name {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
    min-width: 0;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.mf-summary {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.mf-decision {
    margin-top: 6px;
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.mf-error {
    margin-top: 6px;
    font-size: 11.5px;
    color: rgb(var(--v-theme-error));
}
.mf-results {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
}
.mf-result {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
}
.mf-result + .mf-result {
    margin-top: 4px;
}
.mf-result-meta {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

/* 병합 요청 상태 — PrHeader 의 st-* 와 같은 색 */
.mf-pr-badge {
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    padding: 2px 7px;
    white-space: nowrap;
}
.st-open {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.st-chg {
    background: #fbf0da;
    color: #92610a;
}
.st-app {
    background: #e7f4df;
    color: #2e6b16;
}
.st-merged {
    background: #efeafb;
    color: #5b46b8;
}
.st-closed {
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>

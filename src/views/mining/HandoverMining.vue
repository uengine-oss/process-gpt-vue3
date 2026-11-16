<template>
    <!-- 프로세스 식별 목록(/mining/handover) — 업무 하나가 한 줄, 누르면 상세(/mining/handover/:key) -->
    <v-card elevation="10" class="rounded-xl handover-mining mining-list">
        <div class="mining-list__body">
            <div class="d-flex align-center mb-3">
                <div class="flex-grow-1" style="min-width: 0">
                    <h1 class="text-h5 font-weight-bold text-textPrimary">프로세스 식별</h1>
                    <p class="text-body-2 text-grey100 mb-0 mt-1">
                        대화로 처리한 업무에서 반복되는 일을 찾아, 확인하고 프로세스로 만듭니다
                    </p>
                </div>
                <span v-if="store.judging" class="text-caption text-medium-emphasis mr-3">
                    <v-progress-circular indeterminate size="14" width="2" class="mr-1" />{{ store.judging }}건의 업무 범주를 판단하는 중
                </span>
                <v-tooltip text="다시 찾기" location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="small"
                            aria-label="다시 찾기"
                            :loading="store.loading || store.refreshing"
                            @click="reload"
                        >
                            <v-icon>mdi-refresh</v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>

            <!-- 처리할 일 필터 -->
            <div class="d-flex flex-wrap ga-2 mb-3" role="tablist" aria-label="보기">
                <button
                    v-for="f in filters"
                    :key="f.key"
                    type="button"
                    role="tab"
                    class="mining-filter"
                    :class="[`e2e-filter-${f.key}`, { 'is-on': filter === f.key }]"
                    :aria-selected="filter === f.key"
                    @click="filter = f.key"
                >
                    {{ f.label }} <span class="font-weight-regular">{{ f.n }}</span>
                </button>
            </div>

            <div v-if="!store.loaded && store.loading" class="pa-8 text-center">
                <v-progress-circular indeterminate color="primary" />
            </div>
            <v-alert v-else-if="store.error" type="error" variant="tonal">{{ store.error }}</v-alert>

            <!-- 업무 목록: 이 칸 안에서만 스크롤 -->
            <div v-else class="mining-list__rows">
                <router-link
                    v-for="w in rows"
                    :key="w.key"
                    :to="`/mining/handover/${w.key}`"
                    class="mining-work e2e-work"
                    :class="{ 'has-new': w.newN }"
                    :data-key="w.key"
                    :data-status="w.status"
                >
                    <span class="mining-work__status" :class="`is-${w.status}`">{{ w.statusLabel }}</span>
                    <span class="mining-work__name">{{ w.name }}</span>
                    <span class="mining-work__flow">{{ w.flow }}</span>
                    <span class="mining-work__n">{{ w.n }}건</span>
                    <span class="mining-work__new">
                        <v-tooltip v-if="w.newN" text="새로 들어온 건 — 관리자가 받아들이기 전" location="top">
                            <template v-slot:activator="{ props }">
                                <span v-bind="props" class="mining-new-badge e2e-work-new">+{{ w.newN }}</span>
                            </template>
                        </v-tooltip>
                    </span>
                    <span class="mining-work__at">{{ w.at }}</span>
                </router-link>
                <router-link
                    v-if="filter === 'all' && store.unclassified.length"
                    :to="`/mining/handover/${UNCLASSIFIED}`"
                    class="mining-work mining-work--unclassified e2e-work-unclassified"
                >
                    <span class="mining-work__status is-unclassified">확인 필요</span>
                    <span class="mining-work__flow">어느 업무인지 정하지 못한 건 — 업무 범주를 정해 주면 그 업무로 갑니다</span>
                    <span class="mining-work__n">{{ store.unclassified.length }}건</span>
                </router-link>
                <div v-if="!rows.length && !(filter === 'all' && store.unclassified.length)" class="pa-6 text-caption text-medium-emphasis">
                    —
                </div>
            </div>
        </div>
    </v-card>
</template>

<script>
/**
 * 프로세스 식별 목록 (identification-list-detail, 2026-11-12).
 * 업무마다 상태(추천·제안 중·정식 등록·보류) · 이름(업무 범주) · 주요 흐름 · 건수 · 새로 들어온 건 · 마지막 날짜.
 * 처리할 일 순으로 정렬한다. 묶음은 상세와 같은 useIdentification 에서 받는다.
 */
import * as Ident from '@/views/mining/useIdentification';

export default {
    name: 'HandoverMining',
    data() {
        return { store: Ident.state, filter: 'all', UNCLASSIFIED: Ident.UNCLASSIFIED };
    },
    computed: {
        all() {
            return Ident.sortedGroups().map((g) => {
                const status = Ident.statusOf(g);
                const latest = [...(g.cases || []), ...(g.new_case_ids || [])].map(Ident.lastAt).sort().pop() || '';
                return {
                    key: g.process_key,
                    name: g.name,
                    status,
                    statusLabel: Ident.STATUS_LABEL[status],
                    flow: Ident.flowLine(g),
                    n: g.case_count,
                    newN: (g.new_case_ids || []).length,
                    at: Ident.shortDate(latest)
                };
            });
        },
        filters() {
            const a = this.all;
            return [
                { key: 'all', label: '전체', n: a.length },
                { key: 'new', label: '새로 들어온 건', n: a.filter((w) => w.newN).length },
                { key: 'found', label: '추천', n: a.filter((w) => w.status === 'found').length },
                { key: 'registered', label: '정식 등록', n: a.filter((w) => w.status === 'registered').length },
                { key: 'held', label: '보류', n: a.filter((w) => w.status === 'held').length }
            ];
        },
        rows() {
            const f = this.filter;
            return this.all.filter((w) => f === 'all' || (f === 'new' && w.newN) || w.status === f);
        }
    },
    async created() {
        await Ident.ensureLoaded();
    },
    mounted() {
        this.stopRefresh = Ident.watchRefresh();
    },
    beforeUnmount() {
        if (this.stopRefresh) this.stopRefresh();
    },
    methods: {
        async reload() {
            await Ident.ensureLoaded(true);
        }
    }
};
</script>

<style scoped>
/* 앱 레이아웃(헤더·사이드바)이 남겨 준 칸을 채우고, 페이지 자체는 내려가지 않는다 */
.mining-list {
    height: calc(100vh - 132px);
    min-height: 480px;
    display: flex;
    flex-direction: column;
}
.mining-list__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
}
.mining-list__rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 2px;
}
.mining-filter {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
    color: rgba(var(--v-theme-on-surface), 0.8);
}
.mining-filter.is-on {
    background: rgb(var(--v-theme-primary));
    border-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
}
.mining-work {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    border-radius: 12px;
    color: rgb(var(--v-theme-on-surface));
    text-decoration: none;
}
.mining-work:hover,
.mining-work:focus-visible {
    background: rgba(var(--v-theme-primary), 0.04);
    outline: none;
}
.mining-work.has-new {
    border-color: rgba(var(--v-theme-warning), 0.6);
}
.mining-work--unclassified {
    border-style: dashed;
}
.mining-work__status {
    width: 74px;
    flex-shrink: 0;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    border-radius: 999px;
    padding: 3px 0;
}
.mining-work__status.is-found {
    background: rgba(var(--v-theme-warning), 0.14);
    color: rgb(var(--v-theme-warning));
}
.mining-work__status.is-held {
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.mining-work__status.is-proposed {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}
.mining-work__status.is-registered {
    background: rgb(var(--v-theme-success));
    color: rgb(var(--v-theme-on-success));
}
.mining-work__status.is-unclassified {
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.mining-work__name {
    width: 160px;
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mining-work__flow {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mining-work__n {
    width: 56px;
    text-align: right;
    font-size: 14px;
}
.mining-work__new {
    width: 40px;
}
.mining-work__at {
    width: 44px;
    text-align: right;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.mining-new-badge {
    font-size: 11px;
    font-weight: 700;
    color: rgb(var(--v-theme-warning));
    background: rgba(var(--v-theme-warning), 0.14);
    border-radius: 999px;
    padding: 1px 7px;
}
@media (max-width: 760px) {
    .mining-work__flow,
    .mining-work__at {
        display: none;
    }
}
</style>

<template>
    <div class="pr-review-timeline">
        <div v-if="!events.length" class="text-center text-caption text-medium-emphasis pa-6">{{ $t('pr.timeline.empty') }}</div>

        <!--
            의사결정의 흐름을 따라 읽는 자리다 — 요청 생성 → 변경 요청 → 수정 → 승인 → 병합.
            리뷰만 나열하면 "이 요청이 어디까지 왔는가" 는 각자 머릿속에서 재구성해야 한다.
        -->
        <div v-for="event in events" :key="event.key" class="rtl-item">
            <div class="rtl-rail">
                <div :class="['rtl-ico', event.iconClass]">
                    <svg
                        v-if="event.icon === 'check'"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                    >
                        <path d="m9 11 3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    <svg
                        v-else-if="event.icon === 'comment'"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <svg
                        v-else-if="event.icon === 'merge'"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <circle cx="6" cy="6" r="2.5" />
                        <circle cx="6" cy="18" r="2.5" />
                        <circle cx="18" cy="9" r="2.5" />
                        <path d="M6 8.5v7M8.4 7.4 15.6 7.6M18 11.5c0 3-3 4-6 4" />
                    </svg>
                    <svg
                        v-else-if="event.icon === 'open'"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                    <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                </div>
                <div class="rtl-line"></div>
            </div>

            <div class="rtl-body">
                <div class="rtl-header">
                    <span class="rtl-name">{{ event.name }}</span>
                    <span v-if="event.badge" :class="['rtl-badge', event.badgeClass]">{{ event.badge }}</span>
                    <span class="rtl-time">{{ formatRelativeTime(event.time) }}</span>
                </div>
                <div v-if="event.comment" class="rtl-comment">{{ event.comment }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import { formatRelativeTime } from '@/composables/usePrUtils';
import { meaningfulPrDescription } from '@/composables/usePrChanges';

export default {
    name: 'PrReviewTimeline',
    props: {
        reviews: { type: Array, default: () => [] },
        /** 넘기면 요청 생성·병합까지 한 줄기로 잇는다. 없으면 리뷰만 세운다. */
        pr: { type: Object, default: null }
    },
    computed: {
        events() {
            const list = [];

            if (this.pr) {
                list.push({
                    key: 'created',
                    name: this.$t('pr.timeline.created', { name: this.pr.requester_name || this.$t('pr.unknown') }),
                    time: this.pr.created_at,
                    icon: 'open',
                    iconClass: 'rtl-ico-open',
                    badge: this.$t('pr.timeline.createdBadge'),
                    badgeClass: 'rtl-badge-open',
                    comment: meaningfulPrDescription(this.pr)
                });
            }

            for (const review of this.reviews) {
                const approved = review.action === 'APPROVED';
                const comment = review.action === 'COMMENT';
                list.push({
                    key: `review-${review.id}`,
                    name: review.reviewer_name || this.$t('pr.unknown'),
                    time: review.created_at,
                    icon: approved ? 'check' : comment ? 'comment' : 'alert',
                    iconClass: approved ? 'rtl-ico-ok' : comment ? 'rtl-ico-cmt' : 'rtl-ico-chg',
                    badge: this.$t(comment ? 'pr.timeline.comment' : approved ? 'pr.timeline.approved' : 'pr.timeline.changesRequested'),
                    badgeClass: comment ? 'rtl-badge-cmt' : approved ? 'rtl-badge-ok' : 'rtl-badge-chg',
                    comment: review.comment || ''
                });
            }

            if (this.pr?.status === 'MERGED') {
                list.push({
                    key: 'merged',
                    name: this.$t('pr.timeline.merged'),
                    time: this.pr.merged_at || this.pr.updated_at,
                    icon: 'merge',
                    iconClass: 'rtl-ico-merged',
                    badge: '',
                    comment: ''
                });
            } else if (this.pr?.status === 'CLOSED') {
                list.push({
                    key: 'closed',
                    name: this.$t('pr.timeline.closed'),
                    time: this.pr.updated_at,
                    icon: 'alert',
                    iconClass: 'rtl-ico-cmt',
                    badge: '',
                    comment: ''
                });
            }

            return list;
        }
    },
    methods: { formatRelativeTime }
};
</script>

<style scoped>
.pr-review-timeline {
    padding: 6px 0 10px;
}

.rtl-item {
    display: flex;
    gap: 10px;
    padding: 0 16px;
}

/* 점과 점을 잇는 세로선 — 흐름으로 읽히게 한다. */
.rtl-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: none;
}
.rtl-line {
    flex: 1;
    width: 1.5px;
    background: rgba(var(--v-border-color), var(--v-border-opacity));
    margin: 2px 0;
}
.rtl-item:last-child .rtl-line {
    background: transparent;
}

.rtl-ico {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
}
.rtl-ico-ok {
    background: #e7f4df;
    color: #2e6b16;
}
.rtl-ico-cmt {
    background: rgba(var(--v-theme-on-surface), 0.07);
    color: rgba(var(--v-theme-on-surface), 0.5);
}
.rtl-ico-chg {
    background: #fbf0da;
    color: #92610a;
}
.rtl-ico-open {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}
.rtl-ico-merged {
    background: #efeafb;
    color: #5b46b8;
}

.rtl-body {
    flex: 1;
    min-width: 0;
    padding: 10px 0 4px;
}

.rtl-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12.5px;
    line-height: 1.4;
}
.rtl-name {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.87);
}
.rtl-time {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

.rtl-badge {
    font-size: 10px;
    font-weight: 600;
    border-radius: 6px;
    padding: 1px 6px;
    white-space: nowrap;
}
.rtl-badge-ok {
    background: #e7f4df;
    color: #2e6b16;
}
.rtl-badge-chg {
    background: #fbf0da;
    color: #92610a;
}
.rtl-badge-cmt {
    background: rgba(var(--v-theme-on-surface), 0.07);
    color: rgba(var(--v-theme-on-surface), 0.5);
}
.rtl-badge-open {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}

.rtl-comment {
    margin-top: 4px;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>

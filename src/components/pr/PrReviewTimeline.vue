<template>
    <div class="pr-review-timeline">
        <div v-if="!reviews.length" class="text-center text-caption text-medium-emphasis pa-6">
            아직 리뷰가 없습니다
        </div>
        <div v-for="r in reviews" :key="r.id" class="rtl-item">
            <div :class="['rtl-ico', actionIconClass(r.action)]">
                <svg v-if="r.action === 'APPROVED'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <svg v-else-if="r.action === 'COMMENT'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
            </div>
            <div class="rtl-body">
                <div class="rtl-header">
                    <span class="rtl-name">{{ r.reviewer_name || '알 수 없음' }}</span>
                    <span
                        v-if="r.action !== 'COMMENT'"
                        :class="['rtl-badge', r.action === 'APPROVED' ? 'rtl-badge-ok' : 'rtl-badge-chg']"
                    >
                        {{ r.action === 'APPROVED' ? '승인' : '변경 요청' }}
                    </span>
                    <span class="rtl-time">{{ formatRelativeTime(r.created_at) }}</span>
                </div>
                <div v-if="r.comment" class="rtl-comment">{{ r.comment }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import { formatRelativeTime } from '@/composables/usePrUtils';

export default {
    name: 'PrReviewTimeline',
    props: {
        reviews: { type: Array, default: () => [] }
    },
    methods: {
        formatRelativeTime,
        actionIconClass(action) {
            if (action === 'APPROVED') return 'rtl-ico-ok';
            if (action === 'COMMENT') return 'rtl-ico-cmt';
            return 'rtl-ico-chg';
        }
    }
};
</script>

<style scoped>
.pr-review-timeline { padding: 0; }

.rtl-item {
    display: flex;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.rtl-item:last-child { border-bottom: none; }

.rtl-ico {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
}
.rtl-ico-ok { background: #E7F4DF; color: #2E6B16; }
.rtl-ico-cmt { background: rgba(var(--v-theme-on-surface), 0.07); color: rgba(var(--v-theme-on-surface), 0.5); }
.rtl-ico-chg { background: #FBF0DA; color: #92610A; }

.rtl-body { flex: 1; min-width: 0; }

.rtl-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12.5px;
    line-height: 1.4;
}
.rtl-name { font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.87); }
.rtl-time { font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.45); }

.rtl-badge {
    font-size: 10px;
    font-weight: 600;
    border-radius: 6px;
    padding: 1px 6px;
    white-space: nowrap;
}
.rtl-badge-ok { background: #E7F4DF; color: #2E6B16; }
.rtl-badge-chg { background: #FBF0DA; color: #92610A; }

.rtl-comment {
    margin-top: 4px;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>

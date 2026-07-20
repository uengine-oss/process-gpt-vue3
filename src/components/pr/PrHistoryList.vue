<template>
    <div class="pr-history-list">
        <div v-if="!history.length" class="text-center text-caption text-medium-emphasis pa-6">병합 요청 이력이 없습니다</div>
        <div v-for="pr in history" :key="pr.id" class="prh-row">
            <div class="prh-badge">
                <v-chip size="x-small" :color="prStatusColor(pr.status)" variant="tonal">
                    {{ prStatusLabel(pr.status) }}
                </v-chip>
            </div>
            <div class="prh-meta">
                <div class="prh-title">{{ pr.title }}</div>
                <div class="prh-sub">
                    {{ pr.requester_name || '-' }} &middot; {{ formatRelativeTime(pr.created_at) }}
                    <template v-if="pr.merged_at"> &middot; 병합: {{ formatRelativeTime(pr.merged_at) }}</template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { prStatusLabel, prStatusColor, formatRelativeTime } from '@/composables/usePrUtils';

export default {
    name: 'PrHistoryList',
    props: {
        history: { type: Array, default: () => [] }
    },
    methods: {
        prStatusLabel,
        prStatusColor,
        formatRelativeTime
    }
};
</script>

<style scoped>
.prh-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.prh-row:last-child {
    border-bottom: none;
}

.prh-badge {
    flex: none;
    padding-top: 2px;
}

.prh-meta {
    flex: 1;
    min-width: 0;
}

.prh-title {
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--v-theme-on-surface), 0.87);
    line-height: 1.4;
}

.prh-sub {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    margin-top: 2px;
}
</style>

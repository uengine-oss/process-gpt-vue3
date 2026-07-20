<template>
    <div class="pr-header">
        <div class="prh-title-line">
            <span class="prh-title">{{ pr.title }}</span>
            <span :class="['prh-badge', prBadgeClass(pr.status)]">{{ statusLabelText }}</span>
        </div>
        <div class="prh-meta">
            <span
                v-if="pr.requester_name"
                class="prh-ava"
                :style="{ background: requesterProfile && !profileError ? 'transparent' : getAvatarColor(pr.requester_name) }"
            >
                <img v-if="requesterProfile && !profileError" :src="requesterProfile" class="prh-ava-img" @error="profileError = true" />
                <template v-else>{{ getInitial(pr.requester_name) }}</template>
            </span>
            <span
                ><b>{{ pr.requester_name || '알 수 없음' }}</b
                >님이 <b>{{ pr.base_branch }}</b
                >으로 병합 요청</span
            >
            <span class="prh-dot">&middot;</span>
            <span class="prh-branch">{{ shortBranch(pr.branch_name) }}</span>
            <span class="prh-arrow">&rarr;</span>
            <span class="prh-branch">{{ pr.base_branch }}</span>
            <template v-if="pr.git_pr_number">
                <span class="prh-dot">&middot;</span>
                <span class="prh-num">#{{ pr.git_pr_number }}</span>
            </template>
            <template v-if="ownerName">
                <span class="prh-dot">&middot;</span>
                <span>담당자</span>
                <span class="prh-ava prh-ava-sm" :style="{ background: getAvatarColor(ownerName) }" :title="ownerName">
                    {{ getInitial(ownerName) }}
                </span>
            </template>
            <slot name="meta-extra"></slot>
        </div>
        <slot name="actions"></slot>
    </div>
</template>

<script>
import { prBadgeClass, prStatusLabel, getInitial, getAvatarColor, shortBranch } from '@/composables/usePrUtils';

export default {
    name: 'PrHeader',
    props: {
        pr: { type: Object, required: true },
        ownerName: { type: String, default: '' },
        requesterProfile: { type: String, default: null },
        statusLabel: { type: String, default: '' }
    },
    data() {
        return { profileError: false };
    },
    computed: {
        statusLabelText() {
            return this.statusLabel || prStatusLabel(this.pr.status);
        }
    },
    watch: {
        pr() {
            this.profileError = false;
        }
    },
    methods: {
        prBadgeClass,
        getInitial,
        getAvatarColor,
        shortBranch
    }
};
</script>

<style scoped>
.pr-header {
    padding: 13px 16px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.prh-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    line-height: 1.45;
    margin-bottom: 9px;
}

.prh-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.87);
}

.prh-badge {
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

.prh-meta {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    flex-wrap: wrap;
}
.prh-meta b {
    color: rgba(var(--v-theme-on-surface), 0.87);
}

.prh-ava {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    flex: none;
    overflow: hidden;
}
.prh-ava-sm {
    width: 18px;
    height: 18px;
    font-size: 9px;
}
.prh-ava-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
}

.prh-dot {
    color: rgba(var(--v-theme-on-surface), 0.3);
}
.prh-arrow {
    color: rgba(var(--v-theme-on-surface), 0.35);
    font-size: 11px;
}
.prh-num {
    font-size: 11.5px;
    font-weight: 500;
}

.prh-branch {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    background: rgba(var(--v-theme-on-surface), 0.07);
    border-radius: 5px;
    padding: 1px 7px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>

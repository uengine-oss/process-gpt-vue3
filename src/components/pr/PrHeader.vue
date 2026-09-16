<template>
    <div :class="['pr-header', { 'pr-header--compact': compact }]">
        <!--
            compact: 제목 자리에는 '무엇을 고치는 요청인가'(리소스)를 세운다.
            무엇이 바뀌는지는 바로 아래 한 줄이 맡는다 — 검토자는 대상을 먼저 확인하고
            그 다음에 변경 내용을 읽는다.
        -->
        <div class="prh-title-line">
            <PrTypeChip v-if="compact" :type="pr.resource_type" />
            <span class="prh-title" :title="pr.title">{{ titleText }}</span>
            <span :class="['prh-badge', prBadgeClass(pr.status)]">{{ statusLabelText }}</span>
        </div>
        <!--
            compact: 무엇이 바뀌는가(왼쪽)와 누가·언제(오른쪽)를 한 줄에 나눠 세운다.
            줄을 따로 쓰면 정작 읽어야 할 변경 내용이 그만큼 아래로 밀린다.
        -->
        <div class="prh-sub">
            <div v-if="compact && headlineText" class="prh-headline">{{ headlineText }}</div>
            <div class="prh-meta">
                <span
                    v-if="pr.requester_name"
                    class="prh-ava"
                    :style="{ background: requesterProfile && !profileError ? 'transparent' : getAvatarColor(pr.requester_name) }"
                >
                    <img
                        v-if="requesterProfile && !profileError"
                        :src="requesterProfile"
                        class="prh-ava-img"
                        @error="profileError = true"
                    />
                    <template v-else>{{ getInitial(pr.requester_name) }}</template>
                </span>
                <!-- 병합 대상 브랜치는 바로 아래 화살표로 다시 보여 주므로 문장에서는 뺀다. -->
                <span v-html="requestedByText"></span>
                <!--
                    compact: 브랜치·PR 번호는 검토 판단에 쓰이지 않는다.
                    언제 올라온 요청인지만 남기고, 나머지는 Git PR 링크로 미룬다.
                -->
                <template v-if="compact">
                    <span class="prh-dot">&middot;</span>
                    <span>{{ formatRelativeTime(pr.updated_at || pr.created_at) }}</span>
                </template>
                <template v-else>
                    <span class="prh-dot">&middot;</span>
                    <span class="prh-branch">{{ shortBranch(pr.branch_name) }}</span>
                    <span class="prh-arrow">&rarr;</span>
                    <span class="prh-branch">{{ pr.base_branch }}</span>
                    <template v-if="pr.git_pr_number">
                        <span class="prh-dot">&middot;</span>
                        <span class="prh-num">#{{ pr.git_pr_number }}</span>
                    </template>
                </template>
                <template v-if="ownerName">
                    <span class="prh-dot">&middot;</span>
                    <span>{{ $t('pr.header.owner') }}</span>
                    <span class="prh-ava prh-ava-sm" :style="{ background: getAvatarColor(ownerName) }" :title="ownerName">
                        {{ getInitial(ownerName) }}
                    </span>
                </template>
                <slot name="meta-extra"></slot>
            </div>
        </div>
        <slot name="actions"></slot>
    </div>
</template>

<script>
import { prBadgeClass, prStatusLabel, getInitial, getAvatarColor, shortBranch, formatRelativeTime } from '@/composables/usePrUtils';
import { cleanPrTitle } from '@/composables/usePrChanges';
import PrTypeChip from '@/components/pr/PrTypeChip.vue';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export default {
    name: 'PrHeader',
    components: { PrTypeChip },
    props: {
        pr: { type: Object, required: true },
        ownerName: { type: String, default: '' },
        requesterProfile: { type: String, default: null },
        statusLabel: { type: String, default: '' },
        /** 제목 자리에 세울 한 줄. 비우면 요청 제목을 그대로 쓴다. */
        headline: { type: String, default: '' },
        /** 좁은 화면용. 브랜치·PR 번호 같은 기술 정보를 접고 시간만 남긴다. */
        compact: { type: Boolean, default: false }
    },
    data() {
        return { profileError: false };
    },
    computed: {
        statusLabelText() {
            return this.statusLabel || prStatusLabel(this.pr.status);
        },
        /** compact 에서는 리소스가 제목이다. 아니면 예전대로 요약(또는 요청 제목)이 제목이다. */
        titleText() {
            if (this.compact) return this.pr.resource_name || this.pr.resource_id || cleanPrTitle(this.pr.title);
            return this.headline || cleanPrTitle(this.pr.title);
        },
        headlineText() {
            return this.headline || cleanPrTitle(this.pr.title);
        },
        /**
         * "{이름}님의 요청" — 언어마다 이름이 놓이는 자리가 달라 문장 통째로 번역한다.
         * 이름만 굵게 세우려고 마크업을 끼워 넣으므로, 이름은 반드시 이스케이프한다.
         */
        requestedByText() {
            const name = this.pr.requester_name || this.$t('pr.unknown');
            const safe = String(name).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
            return this.$t('pr.header.requestedBy', { name: `<b>${safe}</b>` });
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
        shortBranch,
        formatRelativeTime,
        cleanPrTitle
    }
};
</script>

<style scoped>
.pr-header {
    padding: 11px 16px 10px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.prh-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    line-height: 1.45;
    margin-bottom: 6px;
}

/* compact: 상태는 줄 끝에 붙는다 — 제목 옆에 달면 리소스 이름이 어디서 끝나는지 흐려진다. */
.pr-header--compact .prh-badge {
    margin-left: auto;
}

.pr-header--compact .prh-sub {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
}
.pr-header--compact .prh-sub .prh-headline {
    flex: 1 1 240px;
    min-width: 0;
    margin: 0;
}
.pr-header--compact .prh-sub .prh-meta {
    flex: 0 0 auto;
}

.prh-title {
    font-size: 14px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.87);
}

/* 무엇이 바뀌는가 — 제목 아래 한 줄. */
.prh-headline {
    font-size: 12.5px;
    line-height: 1.5;
    color: rgba(var(--v-theme-on-surface), 0.75);
    margin: -3px 0 7px;
    overflow-wrap: anywhere;
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

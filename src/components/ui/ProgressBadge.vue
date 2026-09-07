<template>
    <v-tooltip v-if="type === 'status' && isPublicFeedbackStatus && tooltipText" :text="tooltipText" location="top" max-width="300">
        <template #activator="{ props: tooltipProps }">
            <v-chip
                v-bind="tooltipProps"
                :color="badgeColor"
                :variant="variant"
                :size="size"
                class="progress-badge"
                :class="[badgeStatusClass, { 'progress-badge-clickable': clickable }]"
                @click="handleClick"
            >
                <v-icon v-if="showIcon" :size="iconSize" start>{{ statusIcon }}</v-icon>
                <span v-if="customText">{{ customText }}</span>
                <span v-else-if="type === 'completion' && showPercentage">{{ value }}%</span>
                <span v-else-if="type === 'status'">{{ statusText }}</span>
                <span v-else>{{ displayText }}</span>
            </v-chip>
        </template>
    </v-tooltip>
    <v-chip
        v-else
        :color="badgeColor"
        :variant="variant"
        :size="size"
        class="progress-badge"
        :class="[badgeStatusClass, { 'progress-badge-clickable': clickable }]"
        @click="handleClick"
    >
        <v-icon v-if="showIcon" :size="iconSize" start>{{ statusIcon }}</v-icon>
        <span v-if="customText">{{ customText }}</span>
        <span v-else-if="type === 'completion' && showPercentage">{{ value }}%</span>
        <span v-else-if="type === 'status'">{{ statusText }}</span>
        <span v-else>{{ displayText }}</span>
    </v-chip>
</template>

<script>
import { getStageDef } from '@/utils/processStages';

export default {
    name: 'ProgressBadge',
    props: {
        // 뱃지 타입: 'completion' (완료율), 'status' (상태)
        type: {
            type: String,
            default: 'status',
            validator: (value) => ['completion', 'status'].includes(value)
        },
        // 완료율 값 (0-100, type='completion'일 때 사용)
        value: {
            type: Number,
            default: 0
        },
        // 상태 값 (type='status'일 때 사용)
        status: {
            type: String,
            default: 'draft',
            validator: (value) => {
                const statuses = [
                    'none',
                    'draft',
                    'review',
                    'in_review',
                    'published',
                    'public_review',
                    'public_feedback',
                    'final_edit',
                    'wip',
                    'sunset'
                ];
                return statuses.includes(value);
            }
        },
        // 아이콘 표시 여부
        showIcon: {
            type: Boolean,
            default: true
        },
        // 퍼센트 표시 여부 (type='completion'일 때)
        showPercentage: {
            type: Boolean,
            default: true
        },
        // 뱃지 크기
        size: {
            type: String,
            default: 'x-small'
        },
        // 뱃지 variant
        variant: {
            type: String,
            default: 'tonal'
        },
        // 클릭 가능 여부
        clickable: {
            type: Boolean,
            default: false
        },
        // 커스텀 텍스트
        customText: {
            type: String,
            default: ''
        },
        // D-day 카운트다운 (public_feedback 상태에서 사용)
        dDay: {
            type: Number,
            default: null
        },
        // 검토 종료일 (public_feedback 상태에서 툴팁에 표시, 예: "3월 15일")
        reviewEndDate: {
            type: String,
            default: ''
        }
    },
    emits: ['click'],
    computed: {
        statusConfig() {
            // 5단계 색·아이콘·라벨 모두 공유 STAGE_DEFS 참조 (대시보드/리뷰보드/체계도 일관)
            const draft = getStageDef('draft');
            const inReview = getStageDef('in_review');
            const publicFeedback = getStageDef('public_feedback');
            const finalEdit = getStageDef('final_edit');
            const published = getStageDef('published');
            return {
                none: {
                    color: 'grey',
                    icon: 'mdi-minus',
                    text: ''
                },
                draft: {
                    color: draft.vuetifyColor,
                    icon: draft.icon,
                    text: draft.label
                },
                review: {
                    color: inReview.vuetifyColor,
                    icon: inReview.icon,
                    text: inReview.label
                },
                in_review: {
                    color: inReview.vuetifyColor,
                    icon: inReview.icon,
                    text: inReview.label
                },
                published: {
                    color: published.vuetifyColor,
                    icon: published.icon,
                    text: published.label
                },
                public_review: {
                    color: publicFeedback.vuetifyColor,
                    icon: publicFeedback.icon,
                    text: this.publicReviewText
                },
                public_feedback: {
                    color: publicFeedback.vuetifyColor,
                    icon: publicFeedback.icon,
                    text: this.publicReviewText
                },
                final_edit: {
                    color: finalEdit.vuetifyColor,
                    icon: finalEdit.icon,
                    text: finalEdit.label
                },
                wip: {
                    color: '#7B1FA2',
                    icon: 'mdi-pencil-ruler',
                    text: this.$t('progressBadge.wip') || '차세대 기획 중'
                },
                sunset: {
                    color: '#C62828',
                    icon: 'mdi-archive-arrow-down-outline',
                    text: this.$t('progressBadge.sunset') || '폐기 예정'
                }
            };
        },
        publicReviewText() {
            const baseText = getStageDef('public_feedback').label;
            if (this.dDay !== null && this.dDay !== undefined) {
                if (this.dDay < 0) return `${baseText} · 만료`;
                return `${baseText} D-${this.dDay}`;
            }
            return baseText;
        },
        isPublicFeedbackStatus() {
            return this.status === 'public_feedback' || this.status === 'public_review';
        },
        tooltipText() {
            // 본사 + 현업 단계에서 사용하던 공람 칩 hover 툴팁 — 본사 제거 정책으로 비활성화
            // if (this.isPublicFeedbackStatus) {
            //     const endDate = this.reviewEndDate || '';
            //     if (endDate) {
            //         return (
            //             this.$t('progressBadge.publicReviewTooltipWithDate', { date: endDate }) ||
            //             `본사/현업 검토가 승인되었습니다. ${endDate}까지 자유롭게 의견을 남겨주세요.`
            //         );
            //     }
            //     return this.$t('progressBadge.publicReviewTooltip') || '본사/현업 검토가 승인되었습니다. 자유롭게 의견을 남겨주세요.';
            // }
            return '';
        },
        /**
         * 상태별 CSS 훅 클래스 (예: progress-badge--final-edit).
         * Vuetify tonal 칩은 글자색 = 배경색이라 amber/grey 계열에서 대비가 무너지는데,
         * 칩 색은 v-chip 이 .text-<color> 로 !important 를 걸어 scoped CSS 로는 못 덮는다.
         * 여기서는 훅 클래스만 붙이고 실제 글자색은 Pal 모드 전용 SKGlobalStyle.scss 에서
         * 지정한다 — 비 Pal 화면은 이 클래스가 정의되지 않아 기존 색 그대로다.
         */
        badgeStatusClass() {
            if (this.type !== 'status') return '';
            const status = String(this.status || 'none').replace(/_/g, '-');
            return `progress-badge--${status}`;
        },
        badgeColor() {
            if (this.type === 'status') {
                return this.statusConfig[this.status]?.color || 'grey';
            }
            // completion type: 색상은 값에 따라 결정
            if (this.value >= 80) return 'success';
            if (this.value >= 50) return 'warning';
            if (this.value >= 20) return 'orange';
            return 'grey';
        },
        statusIcon() {
            if (this.type === 'status') {
                return this.statusConfig[this.status]?.icon || 'mdi-help-circle';
            }
            // completion type
            if (this.value >= 80) return 'mdi-check-circle';
            if (this.value >= 50) return 'mdi-progress-check';
            return 'mdi-progress-clock';
        },
        statusText() {
            return this.statusConfig[this.status]?.text || this.status;
        },
        displayText() {
            if (this.customText) return this.customText;
            if (this.type === 'status') return this.statusText;
            return `${this.value}%`;
        },
        iconSize() {
            const sizeMap = {
                'x-small': 12,
                small: 14,
                default: 16,
                large: 18,
                'x-large': 20
            };
            return sizeMap[this.size] || 14;
        }
    },
    methods: {
        handleClick(event) {
            if (this.clickable) {
                this.$emit('click', event);
            }
        }
    }
};
</script>

<style scoped>
.progress-badge {
    font-weight: 500;
    letter-spacing: 0.02em;
}

.progress-badge-clickable {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.progress-badge-clickable:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>

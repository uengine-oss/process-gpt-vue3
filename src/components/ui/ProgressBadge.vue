<template>
    <v-tooltip
        v-if="type === 'status' && status === 'public_review' && tooltipText"
        :text="tooltipText"
        location="top"
        max-width="300"
    >
        <template #activator="{ props: tooltipProps }">
            <v-chip
                v-bind="tooltipProps"
                :color="badgeColor"
                :variant="variant"
                :size="size"
                class="progress-badge"
                :class="{ 'progress-badge-clickable': clickable }"
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
        :class="{ 'progress-badge-clickable': clickable }"
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
            validator: (value) => ['draft', 'review', 'published', 'public_review', 'wip', 'sunset'].includes(value)
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
        // D-day 카운트다운 (public_review 상태에서 사용)
        dDay: {
            type: Number,
            default: null
        },
        // 검토 종료일 (public_review 상태에서 툴팁에 표시, 예: "3월 15일")
        reviewEndDate: {
            type: String,
            default: ''
        }
    },
    emits: ['click'],
    computed: {
        statusConfig() {
            return {
                draft: {
                    color: 'grey',
                    icon: 'mdi-pencil-outline',
                    text: this.$t('progressBadge.draft') || '작성중'
                },
                review: {
                    color: 'orange',
                    icon: 'mdi-eye-outline',
                    text: this.$t('progressBadge.review') || '검토중'
                },
                published: {
                    color: 'success',
                    icon: 'mdi-check-circle',
                    text: this.$t('progressBadge.published') || '완료'
                },
                public_review: {
                    color: '#1976D2',
                    icon: 'mdi-bullhorn-outline',
                    text: this.publicReviewText
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
            const baseText = this.$t('progressBadge.public_review') || 'Public Review';
            if (this.dDay !== null && this.dDay !== undefined) {
                return `${baseText} D-${this.dDay}`;
            }
            return baseText;
        },
        tooltipText() {
            if (this.status === 'public_review') {
                const endDate = this.reviewEndDate || '';
                if (endDate) {
                    return this.$t('progressBadge.publicReviewTooltipWithDate', { date: endDate }) ||
                        `본사/현업 검토가 승인되었습니다. ${endDate}까지 자유롭게 의견을 남겨주세요.`;
                }
                return this.$t('progressBadge.publicReviewTooltip') ||
                    '본사/현업 검토가 승인되었습니다. 자유롭게 의견을 남겨주세요.';
            }
            return '';
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
                'small': 14,
                'default': 16,
                'large': 18,
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

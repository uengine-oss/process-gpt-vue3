<template>
    <v-tooltip
        :location="location"
        :max-width="maxWidth"
        :open-delay="openDelay"
        :close-delay="closeDelay"
        :disabled="disabled"
    >
        <template #activator="{ props }">
            <slot v-bind="props"></slot>
        </template>

        <template #default>
            <div class="process-tooltip" :style="{ minWidth: minWidth + 'px' }">
                <!-- 헤더: 프로세스 이름 -->
                <div class="process-tooltip-header">
                    <span class="font-weight-bold">{{ processInfo.name || $t('processTooltip.unnamed') }}</span>
                </div>

                <v-divider class="my-2" />

                <!-- 상세 정보 목록 -->
                <div class="process-tooltip-content">
                    <!-- 담당자 -->
                    <div v-if="showOwner" class="d-flex align-center mb-1">
                        <v-icon size="14" class="mr-2" color="grey-lighten-1">mdi-account</v-icon>
                        <span class="text-caption">
                            {{ $t('processTooltip.owner') }}: {{ processInfo.owner || $t('processTooltip.unassigned') }}
                        </span>
                    </div>

                    <!-- 상태 -->
                    <div v-if="showStatus" class="d-flex align-center mb-1">
                        <v-icon size="14" class="mr-2" color="grey-lighten-1">mdi-flag</v-icon>
                        <span class="text-caption">
                            {{ $t('processTooltip.status') }}: {{ statusText }}
                        </span>
                    </div>

                    <!-- 최종 수정일 -->
                    <div v-if="showUpdatedAt && processInfo.updatedAt" class="d-flex align-center mb-1">
                        <v-icon size="14" class="mr-2" color="grey-lighten-1">mdi-calendar</v-icon>
                        <span class="text-caption">
                            {{ $t('processTooltip.lastModified') }}: {{ formatDate(processInfo.updatedAt) }}
                        </span>
                    </div>

                    <!-- Task 수 -->
                    <div v-if="showTaskCount" class="d-flex align-center mb-1">
                        <v-icon size="14" class="mr-2" color="grey-lighten-1">mdi-format-list-bulleted</v-icon>
                        <span class="text-caption">
                            {{ $t('processTooltip.taskCount') }}: {{ processInfo.taskCount || 0 }}
                        </span>
                    </div>

                    <!-- 설명 -->
                    <div v-if="showDescription && processInfo.description" class="mt-2">
                        <v-divider class="mb-2" />
                        <div class="d-flex align-start">
                            <v-icon size="14" class="mr-2 mt-1" color="grey-lighten-1">mdi-text</v-icon>
                            <span class="text-caption">
                                {{ $t('processTooltip.description') }}: {{ truncateText(processInfo.description, descriptionLimit) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 로딩 상태 -->
                <div v-if="loading" class="d-flex align-center justify-center py-2">
                    <v-progress-circular size="16" width="2" indeterminate color="grey-lighten-1" />
                    <span class="text-caption ml-2">{{ $t('processTooltip.loading') }}</span>
                </div>
            </div>
        </template>
    </v-tooltip>
</template>

<script>
export default {
    name: 'ProcessTooltip',
    props: {
        // 프로세스 정보 객체
        processInfo: {
            type: Object,
            default: () => ({
                id: '',
                name: '',
                owner: '',
                status: 'draft',
                updatedAt: null,
                description: '',
                taskCount: 0,
                completionRate: 0
            })
        },
        // 툴팁 위치
        location: {
            type: String,
            default: 'right'
        },
        // 최대 너비
        maxWidth: {
            type: [String, Number],
            default: 300
        },
        // 최소 너비
        minWidth: {
            type: Number,
            default: 200
        },
        // 열림 지연
        openDelay: {
            type: Number,
            default: 300
        },
        // 닫힘 지연
        closeDelay: {
            type: Number,
            default: 100
        },
        // 비활성화
        disabled: {
            type: Boolean,
            default: false
        },
        // 로딩 상태
        loading: {
            type: Boolean,
            default: false
        },
        // 표시 항목 설정
        showOwner: {
            type: Boolean,
            default: true
        },
        showStatus: {
            type: Boolean,
            default: true
        },
        showUpdatedAt: {
            type: Boolean,
            default: true
        },
        showTaskCount: {
            type: Boolean,
            default: true
        },
        showCompletionRate: {
            type: Boolean,
            default: true
        },
        showDescription: {
            type: Boolean,
            default: true
        },
        // 설명 문자 제한
        descriptionLimit: {
            type: Number,
            default: 100
        }
    },
    computed: {
        statusConfig() {
            return {
                draft: this.$t('progressBadge.draft') || '작성중',
                review: this.$t('progressBadge.review') || '검토중',
                published: this.$t('progressBadge.published') || '게시됨'
            };
        },
        statusText() {
            return this.statusConfig[this.processInfo.status] || this.processInfo.status || '-';
        }
    },
    methods: {
        formatDate(dateString) {
            if (!dateString) return '-';

            try {
                const date = new Date(dateString);
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // 오늘
                if (diffDays === 0) {
                    return this.$t('processTooltip.today') || '오늘';
                }
                // 어제
                if (diffDays === 1) {
                    return this.$t('processTooltip.yesterday') || '어제';
                }
                // 7일 이내
                if (diffDays <= 7) {
                    return `${diffDays}${this.$t('processTooltip.daysAgo') || '일 전'}`;
                }
                // 그 외: 날짜 표시
                return date.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (e) {
                return dateString;
            }
        },
        truncateText(text, limit) {
            if (!text) return '';
            if (text.length <= limit) return text;
            return text.substring(0, limit) + '...';
        }
    }
};
</script>

<style scoped>
.process-tooltip {
    padding: 4px 0;
}

.process-tooltip-header {
    font-size: 0.875rem;
    line-height: 1.4;
}

.process-tooltip-content {
    font-size: 0.75rem;
    line-height: 1.5;
}

.process-tooltip-content .v-icon {
    opacity: 0.8;
}
</style>

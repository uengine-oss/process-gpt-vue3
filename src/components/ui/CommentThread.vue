<template>
    <div class="comment-thread" :class="{ 'is-resolved': comment.is_resolved }">
        <!-- 메인 댓글 -->
        <div class="comment-main pa-2 rounded" :class="reviewerTypeClass">
            <!-- Reviewer type indicator strip -->
            <div v-if="comment.reviewer_type && comment.reviewer_type !== 'general'" class="ct-reviewer-strip" :class="`ct-strip--${comment.reviewer_type}`"></div>

            <div class="d-flex align-start">
                <!-- 아바타 -->
                <v-avatar size="32" :color="avatarColor" class="mr-2 flex-shrink-0">
                    <span class="text-white text-caption">{{ getInitials(comment.author_name) }}</span>
                </v-avatar>

                <div class="flex-grow-1" style="min-width: 0;">
                    <!-- 헤더 -->
                    <div class="d-flex align-center flex-wrap gap-1">
                        <span class="text-subtitle-2 font-weight-medium mr-2">
                            {{ comment.author_name }}
                        </span>
                        <span
                            v-if="comment.reviewer_type && comment.reviewer_type !== 'general'"
                            class="ct-reviewer-badge"
                            :class="`ct-badge--${comment.reviewer_type}`"
                        >{{ getReviewerTypeLabel(comment.reviewer_type) }}</span>
                        <span class="text-caption text-grey">
                            {{ formatDate(comment.created_at) }}
                        </span>
                        <v-chip
                            v-if="comment.is_resolved"
                            size="x-small"
                            color="success"
                            variant="tonal"
                            class="ml-1"
                        >
                            <v-icon start size="12">mdi-check</v-icon>
                            {{ $t('elementComment.resolved') }}
                        </v-chip>
                    </div>

                    <!-- 내용 (수정 모드) -->
                    <div v-if="isEditing" class="mt-2">
                        <v-textarea
                            v-model="editContent"
                            variant="outlined"
                            density="compact"
                            rows="2"
                            auto-grow
                            hide-details
                        />
                        <div class="d-flex justify-end mt-1">
                            <v-btn size="small" variant="text" @click="cancelEdit">
                                {{ $t('elementComment.cancel') }}
                            </v-btn>
                            <v-btn size="small" color="primary" variant="text" @click="saveEdit">
                                {{ $t('elementComment.save') }}
                            </v-btn>
                        </div>
                    </div>

                    <!-- 내용 (보기 모드) -->
                    <div v-else class="text-body-2 mt-1 comment-content">
                        {{ comment.content }}
                    </div>

                    <!-- Resolve 조치 내용 표시 -->
                    <div v-if="comment.is_resolved && comment.resolve_action_text" class="ct-resolve-info">
                        <v-icon size="12" color="success">mdi-check-circle</v-icon>
                        <span class="ct-resolve-label">조치:</span>
                        {{ comment.resolve_action_text }}
                    </div>

                    <!-- 액션 버튼 -->
                    <div v-if="!isEditing" class="d-flex align-center mt-1">
                        <v-btn
                            size="x-small"
                            variant="text"
                            color="grey"
                            @click="showReplyInput = !showReplyInput"
                        >
                            <v-icon start size="14">mdi-reply</v-icon>
                            {{ $t('elementComment.reply') }}
                        </v-btn>

                        <v-btn
                            v-if="!comment.parent_comment_id"
                            size="x-small"
                            variant="text"
                            :color="comment.is_resolved ? 'grey' : 'success'"
                            @click="comment.is_resolved ? toggleReopen() : openResolveDialog()"
                        >
                            <v-icon start size="14">
                                {{ comment.is_resolved ? 'mdi-refresh' : 'mdi-check-circle-outline' }}
                            </v-icon>
                            {{ comment.is_resolved ? $t('elementComment.reopen') : $t('elementComment.resolve') }}
                        </v-btn>

                        <v-spacer />

                        <!-- 작성자만 수정/삭제 가능 -->
                        <template v-if="isOwner">
                            <v-btn
                                size="x-small"
                                variant="text"
                                color="grey"
                                icon
                                @click="startEdit"
                            >
                                <v-icon size="14">mdi-pencil</v-icon>
                            </v-btn>
                            <v-btn
                                size="x-small"
                                variant="text"
                                color="error"
                                icon
                                @click="confirmDelete"
                            >
                                <v-icon size="14">mdi-delete</v-icon>
                            </v-btn>
                        </template>
                    </div>
                </div>
            </div>

            <!-- 답글 입력 -->
            <div v-if="showReplyInput" class="mt-2 ml-10">
                <v-textarea
                    v-model="replyContent"
                    :placeholder="$t('elementComment.replyPlaceholder')"
                    variant="outlined"
                    density="compact"
                    rows="2"
                    auto-grow
                    hide-details
                />
                <div class="d-flex justify-end mt-1">
                    <v-btn size="small" variant="text" @click="showReplyInput = false">
                        {{ $t('elementComment.cancel') }}
                    </v-btn>
                    <v-btn
                        size="small"
                        color="primary"
                        variant="text"
                        :disabled="!replyContent.trim()"
                        @click="submitReply"
                    >
                        {{ $t('elementComment.submit') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- 답글 목록 -->
        <div v-if="replies && replies.length > 0" class="replies-container ml-6 mt-1">
            <div
                v-for="reply in replies"
                :key="(reply as any).id"
                class="reply-item pa-2 rounded"
            >
                <div class="d-flex align-start">
                    <v-avatar size="24" color="grey-lighten-1" class="mr-2 flex-shrink-0">
                        <span class="text-white text-caption" style="font-size: 10px;">
                            {{ getInitials((reply as any).author_name) }}
                        </span>
                    </v-avatar>

                    <div class="flex-grow-1" style="min-width: 0;">
                        <div class="d-flex align-center flex-wrap">
                            <span class="text-body-2 font-weight-medium mr-2">
                                {{ (reply as any).author_name }}
                            </span>
                            <span class="text-caption text-grey">
                                {{ formatDate((reply as any).created_at) }}
                            </span>
                        </div>
                        <div class="text-body-2 mt-1">{{ (reply as any).content }}</div>

                        <!-- 답글 작성자만 삭제 가능 -->
                        <div v-if="(reply as any).author_id === currentUserId" class="d-flex justify-end">
                            <v-btn
                                size="x-small"
                                variant="text"
                                color="error"
                                icon
                                @click="$emit('delete', (reply as any).id)"
                            >
                                <v-icon size="12">mdi-delete</v-icon>
                            </v-btn>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="320">
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ $t('elementComment.deleteConfirmTitle') }}
                </v-card-title>
                <v-card-text>
                    {{ $t('elementComment.deleteConfirmMessage') }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialog = false">
                        {{ $t('elementComment.cancel') }}
                    </v-btn>
                    <v-btn color="error" variant="text" @click="doDelete">
                        {{ $t('elementComment.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Resolve 다이얼로그 (조치 내용 필수) -->
        <v-dialog v-model="resolveDialog" max-width="460" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon size="20" color="success" class="mr-2">mdi-check-circle-outline</v-icon>
                    <span class="text-subtitle-1 font-weight-bold">피드백 Resolve</span>
                </v-card-title>
                <v-card-text class="pt-2">
                    <!-- 원본 피드백 -->
                    <div class="ct-resolve-original">
                        <div class="ct-resolve-original-label">원본 피드백</div>
                        <div class="ct-resolve-original-text">{{ comment.content }}</div>
                    </div>
                    <p class="text-body-2 text-medium-emphasis mt-3 mb-2">
                        조치 내용 (Action Taken) <span class="text-error">*</span>
                    </p>
                    <v-textarea
                        v-model="resolveActionText"
                        placeholder="어떻게 조치했는지 구체적으로 입력하세요 (필수)..."
                        rows="3"
                        variant="outlined"
                        density="compact"
                        hide-details
                        auto-grow
                    />
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer />
                    <v-btn variant="text" size="small" @click="resolveDialog = false">취소</v-btn>
                    <v-btn
                        color="success"
                        variant="flat"
                        size="small"
                        :disabled="!resolveActionText.trim()"
                        @click="submitResolve"
                    >
                        <v-icon start size="16">mdi-check</v-icon>
                        Resolve 완료
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

export default defineComponent({
    name: 'CommentThread',
    props: {
        comment: {
            type: Object,
            required: true
        },
        replies: {
            type: Array,
            default: () => []
        },
        currentUserId: {
            type: String,
            default: ''
        }
    },
    emits: ['reply', 'edit', 'delete', 'resolve'],
    setup(props, { emit }) {
        const isEditing = ref(false);
        const editContent = ref('');
        const showReplyInput = ref(false);
        const replyContent = ref('');
        const deleteDialog = ref(false);
        const resolveDialog = ref(false);
        const resolveActionText = ref('');

        const isOwner = computed(() => {
            return props.comment.author_id === props.currentUserId;
        });

        // reviewer_type에 따른 아바타 색상
        const avatarColor = computed(() => {
            const t = props.comment.reviewer_type;
            if (t === 'hq') return '#1d4ed8';
            if (t === 'field') return '#059669';
            if (t === 'public') return '#6b7280';
            return 'primary';
        });

        // reviewer_type에 따른 카드 배경 클래스
        const reviewerTypeClass = computed(() => {
            const t = props.comment.reviewer_type;
            if (t === 'hq') return 'ct-bg--hq';
            if (t === 'field') return 'ct-bg--field';
            if (t === 'public') return 'ct-bg--public';
            return '';
        });

        const getReviewerTypeLabel = (type: string): string => {
            if (type === 'hq') return '본사';
            if (type === 'field') return '현업';
            if (type === 'public') return '공람';
            return type;
        };

        const getInitials = (name: string): string => {
            if (!name) return '?';
            const firstChar = name.charAt(0);
            if (/[가-힣]/.test(firstChar)) return name.substring(0, 2);
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };

        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            try {
                const locale = (window as any).$lang === 'ko' ? ko : enUS;
                return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
            } catch {
                return dateStr;
            }
        };

        const startEdit = () => {
            editContent.value = props.comment.content;
            isEditing.value = true;
        };

        const cancelEdit = () => {
            isEditing.value = false;
            editContent.value = '';
        };

        const saveEdit = () => {
            if (editContent.value.trim()) {
                emit('edit', {
                    commentId: props.comment.id,
                    content: editContent.value.trim()
                });
            }
            isEditing.value = false;
        };

        const submitReply = () => {
            if (replyContent.value.trim()) {
                emit('reply', {
                    parentId: props.comment.id,
                    content: replyContent.value.trim()
                });
                replyContent.value = '';
                showReplyInput.value = false;
            }
        };

        // Resolve: 다이얼로그 열기 (조치 내용 필수)
        const openResolveDialog = () => {
            resolveActionText.value = '';
            resolveDialog.value = true;
        };

        // Resolve 제출 (resolve_action_text 포함)
        const submitResolve = () => {
            if (!resolveActionText.value.trim()) return;
            emit('resolve', {
                commentId: props.comment.id,
                resolved: true,
                resolveActionText: resolveActionText.value.trim()
            });
            resolveDialog.value = false;
            resolveActionText.value = '';
        };

        // Reopen (이미 resolved → unresolved)
        const toggleReopen = () => {
            emit('resolve', {
                commentId: props.comment.id,
                resolved: false,
                resolveActionText: ''
            });
        };

        const confirmDelete = () => {
            deleteDialog.value = true;
        };

        const doDelete = () => {
            emit('delete', props.comment.id);
            deleteDialog.value = false;
        };

        return {
            isEditing,
            editContent,
            showReplyInput,
            replyContent,
            deleteDialog,
            resolveDialog,
            resolveActionText,
            isOwner,
            avatarColor,
            reviewerTypeClass,
            getReviewerTypeLabel,
            getInitials,
            formatDate,
            startEdit,
            cancelEdit,
            saveEdit,
            submitReply,
            openResolveDialog,
            submitResolve,
            toggleReopen,
            confirmDelete,
            doDelete
        };
    }
});
</script>

<style scoped>
.comment-thread.is-resolved {
    opacity: 0.7;
}

.comment-main {
    background-color: rgba(var(--v-theme-surface-variant), 0.3);
    position: relative;
    overflow: hidden;
}

/* reviewer_type별 배경 색상 */
.ct-bg--hq {
    background-color: rgba(219, 234, 254, 0.4) !important; /* blue-100 */
}
.ct-bg--field {
    background-color: rgba(209, 250, 229, 0.4) !important; /* green-100 */
}
.ct-bg--public {
    background-color: rgba(241, 245, 249, 0.4) !important; /* slate-100 */
}

/* reviewer_type 좌측 세로 strip */
.ct-reviewer-strip {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px 0 0 2px;
}
.ct-strip--hq    { background: #1d4ed8; }
.ct-strip--field { background: #059669; }
.ct-strip--public{ background: #6b7280; }

/* reviewer_type 배지 */
.ct-reviewer-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
    white-space: nowrap;
}
.ct-badge--hq    { background: #dbeafe; color: #1d4ed8; }
.ct-badge--field { background: #d1fae5; color: #065f46; }
.ct-badge--public{ background: #f1f5f9; color: #475569; }

/* resolve 조치 내용 표시 */
.ct-resolve-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #059669;
    margin-top: 6px;
    padding: 4px 8px;
    background: #f0fdf4;
    border-radius: 6px;
    border-left: 2px solid #10b981;
}
.ct-resolve-label {
    font-weight: 600;
    white-space: nowrap;
}

/* resolve 다이얼로그 원본 피드백 */
.ct-resolve-original {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
}
.ct-resolve-original-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.ct-resolve-original-text {
    font-size: 13px;
    color: #334155;
    line-height: 1.5;
}

.comment-content {
    word-break: break-word;
    white-space: pre-wrap;
}

.reply-item {
    background-color: rgba(var(--v-theme-surface-variant), 0.15);
    border-left: 2px solid rgba(var(--v-theme-primary), 0.3);
}

.replies-container {
    border-left: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
    padding-left: 8px;
}
</style>

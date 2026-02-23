<template>
    <div class="comment-thread" :class="{ 'is-resolved': comment.is_resolved }">
        <!-- 메인 댓글 -->
        <div class="comment-main pa-2 rounded">
            <div class="d-flex align-start">
                <!-- 아바타 -->
                <v-avatar size="32" color="primary" class="mr-2 flex-shrink-0">
                    <span class="text-white text-caption">{{ getInitials(comment.author_name) }}</span>
                </v-avatar>

                <div class="flex-grow-1" style="min-width: 0;">
                    <!-- 헤더 -->
                    <div class="d-flex align-center flex-wrap">
                        <span class="text-subtitle-2 font-weight-medium mr-2">
                            {{ comment.author_name }}
                        </span>
                        <span class="text-caption text-grey">
                            {{ formatDate(comment.created_at) }}
                        </span>
                        <v-chip
                            v-if="comment.is_resolved"
                            size="x-small"
                            color="success"
                            variant="tonal"
                            class="ml-2"
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
                            @click="toggleResolve"
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
                :key="reply.id"
                class="reply-item pa-2 rounded"
            >
                <div class="d-flex align-start">
                    <v-avatar size="24" color="grey-lighten-1" class="mr-2 flex-shrink-0">
                        <span class="text-white text-caption" style="font-size: 10px;">
                            {{ getInitials(reply.author_name) }}
                        </span>
                    </v-avatar>

                    <div class="flex-grow-1" style="min-width: 0;">
                        <div class="d-flex align-center flex-wrap">
                            <span class="text-body-2 font-weight-medium mr-2">
                                {{ reply.author_name }}
                            </span>
                            <span class="text-caption text-grey">
                                {{ formatDate(reply.created_at) }}
                            </span>
                        </div>
                        <div class="text-body-2 mt-1">{{ reply.content }}</div>

                        <!-- 답글 작성자만 삭제 가능 -->
                        <div v-if="reply.author_id === currentUserId" class="d-flex justify-end">
                            <v-btn
                                size="x-small"
                                variant="text"
                                color="error"
                                icon
                                @click="$emit('delete', reply.id)"
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

        const isOwner = computed(() => {
            return props.comment.author_id === props.currentUserId;
        });

        const getInitials = (name: string): string => {
            if (!name) return '?';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };

        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            try {
                const locale = window.$lang === 'ko' ? ko : enUS;
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

        const toggleResolve = () => {
            emit('resolve', {
                commentId: props.comment.id,
                resolved: !props.comment.is_resolved
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
            isOwner,
            getInitials,
            formatDate,
            startEdit,
            cancelEdit,
            saveEdit,
            submitReply,
            toggleResolve,
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

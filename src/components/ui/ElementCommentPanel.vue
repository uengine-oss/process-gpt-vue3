<template>
    <v-card class="element-comment-panel" elevation="0">
        <!-- 헤더 -->
        <v-card-title class="d-flex align-center pa-3 pb-2">
            <v-icon class="mr-2" size="20">mdi-comment-text-multiple-outline</v-icon>
            <span class="text-subtitle-1 font-weight-medium">{{ $t('elementComment.title') }}</span>
            <v-spacer />
            <v-chip v-if="comments.length > 0" size="x-small" color="primary" variant="tonal">
                {{ comments.length }}
            </v-chip>
            <v-btn icon variant="text" size="small" @click="$emit('close')">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-card-title>

        <!-- 선택된 요소 정보 -->
        <div v-if="selectedElement && isTaskType(selectedElement.type)" class="px-3 pb-2">
            <v-chip size="small" :color="getElementColor(selectedElement.type)" variant="tonal">
                <v-icon start size="14">{{ getElementIcon(selectedElement.type) }}</v-icon>
                {{ selectedElement.name || selectedElement.id }}
            </v-chip>
        </div>

        <!-- Task가 아닌 경우 안내 -->
        <div v-else class="px-3 pb-2">
            <v-alert type="info" density="compact" variant="tonal">
                {{ $t('elementComment.selectTaskToComment') }}
            </v-alert>
        </div>

        <v-divider />

        <!-- 댓글 목록 -->
        <v-card-text class="pa-0 comment-list-container">
            <div v-if="loading" class="d-flex justify-center align-center pa-4">
                <v-progress-circular indeterminate size="24" />
            </div>

            <div v-else-if="comments.length === 0" class="text-center pa-4 text-grey">
                <v-icon size="48" color="grey-lighten-1">mdi-comment-off-outline</v-icon>
                <div class="mt-2 text-body-2">{{ $t('elementComment.noComments') }}</div>
            </div>

            <div v-else class="comment-list pa-2">
                <div
                    v-for="comment in rootComments"
                    :key="comment.id"
                    class="comment-item mb-2"
                >
                    <CommentThread
                        :comment="comment"
                        :replies="getReplies(comment.id)"
                        :currentUserId="currentUserId"
                        @reply="handleReply"
                        @edit="handleEdit"
                        @delete="handleDelete"
                        @resolve="handleResolve"
                    />
                </div>
            </div>
        </v-card-text>

        <v-divider />

        <!-- 댓글 입력 (Task 타입일 때만 활성화) -->
        <v-card-actions v-if="selectedElement && isTaskType(selectedElement.type)" class="pa-3">
            <v-textarea
                v-model="newComment"
                :placeholder="$t('elementComment.placeholder')"
                variant="outlined"
                density="compact"
                rows="2"
                hide-details
                auto-grow
                class="flex-grow-1"
                @keydown.ctrl.enter="submitComment"
            />
            <v-btn
                icon
                color="primary"
                class="ml-2"
                :disabled="!newComment.trim()"
                :loading="submitting"
                @click="submitComment"
            >
                <v-icon>mdi-send</v-icon>
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import CommentThread from './CommentThread.vue';

export default defineComponent({
    name: 'ElementCommentPanel',
    components: {
        CommentThread
    },
    props: {
        procDefId: {
            type: String,
            required: true
        },
        selectedElement: {
            type: Object,
            default: null
        }
    },
    emits: ['close', 'commentCountChanged'],
    setup(props, { emit }) {
        const backend = BackendFactory.createBackend();
        const comments = ref<any[]>([]);
        const loading = ref(false);
        const submitting = ref(false);
        const newComment = ref('');
        const currentUserId = ref('');

        // 루트 댓글 (부모가 없는 댓글)
        const rootComments = computed(() => {
            return comments.value.filter(c => !c.parent_comment_id);
        });

        // 특정 댓글의 답글 목록
        const getReplies = (parentId: string) => {
            return comments.value.filter(c => c.parent_comment_id === parentId);
        };

        // 댓글 목록 로드
        const loadComments = async () => {
            if (!props.procDefId || !props.selectedElement) return;

            loading.value = true;
            try {
                comments.value = await backend.getElementComments(
                    props.procDefId,
                    props.selectedElement.id
                );
            } catch (e) {
                console.error('댓글 로드 실패:', e);
            } finally {
                loading.value = false;
            }
        };

        // 댓글 작성
        const submitComment = async () => {
            if (!newComment.value.trim() || !props.selectedElement) return;

            submitting.value = true;
            try {
                await backend.addElementComment({
                    procDefId: props.procDefId,
                    elementId: props.selectedElement.id,
                    elementType: props.selectedElement.type,
                    elementName: props.selectedElement.name,
                    content: newComment.value.trim()
                });
                newComment.value = '';
                await loadComments();
                emit('commentCountChanged');
            } catch (e) {
                console.error('댓글 작성 실패:', e);
            } finally {
                submitting.value = false;
            }
        };

        // 답글 작성
        const handleReply = async (data: { parentId: string; content: string }) => {
            if (!props.selectedElement) return;

            try {
                await backend.addElementComment({
                    procDefId: props.procDefId,
                    elementId: props.selectedElement.id,
                    elementType: props.selectedElement.type,
                    elementName: props.selectedElement.name,
                    content: data.content,
                    parentCommentId: data.parentId
                });
                await loadComments();
                emit('commentCountChanged');
            } catch (e) {
                console.error('답글 작성 실패:', e);
            }
        };

        // 댓글 수정
        const handleEdit = async (data: { commentId: string; content: string }) => {
            try {
                await backend.updateElementComment(data.commentId, data.content);
                await loadComments();
            } catch (e) {
                console.error('댓글 수정 실패:', e);
            }
        };

        // 댓글 삭제
        const handleDelete = async (commentId: string) => {
            try {
                await backend.deleteElementComment(commentId);
                await loadComments();
                emit('commentCountChanged');
            } catch (e) {
                console.error('댓글 삭제 실패:', e);
            }
        };

        // 댓글 해결 처리
        const handleResolve = async (data: { commentId: string; resolved: boolean }) => {
            try {
                await backend.resolveElementComment(data.commentId, data.resolved);
                await loadComments();
            } catch (e) {
                console.error('댓글 해결 처리 실패:', e);
            }
        };

        // 요소 타입별 아이콘
        const getElementIcon = (type: string): string => {
            if (!type) return 'mdi-shape-outline';
            const iconMap: Record<string, string> = {
                'bpmn:UserTask': 'mdi-account',
                'bpmn:ManualTask': 'mdi-hand-back-right',
                'bpmn:ServiceTask': 'mdi-cog',
                'bpmn:ScriptTask': 'mdi-script-text',
                'bpmn:Task': 'mdi-checkbox-marked-outline',
                'bpmn:ExclusiveGateway': 'mdi-rhombus-outline',
                'bpmn:ParallelGateway': 'mdi-plus-box-outline',
                'bpmn:InclusiveGateway': 'mdi-circle-outline',
                'bpmn:StartEvent': 'mdi-play-circle-outline',
                'bpmn:EndEvent': 'mdi-stop-circle-outline',
                'bpmn:IntermediateThrowEvent': 'mdi-circle-double',
                'bpmn:SubProcess': 'mdi-folder-outline',
                'bpmn:CallActivity': 'mdi-arrow-right-bold-box-outline'
            };
            return iconMap[type] || 'mdi-shape-outline';
        };

        // 요소 타입별 색상
        const getElementColor = (type: string): string => {
            if (!type) return 'grey';
            if (type.includes('Task')) return 'blue';
            if (type.includes('Gateway')) return 'orange';
            if (type.includes('Event')) return 'green';
            if (type.includes('SubProcess') || type.includes('CallActivity')) return 'purple';
            return 'grey';
        };

        // Task 타입 여부 확인
        const isTaskType = (type: string): boolean => {
            if (!type) return false;
            return type.includes('Task') || type.includes('Activity');
        };

        // 현재 사용자 ID 설정
        onMounted(() => {
            currentUserId.value = window.$user?.id || '';
        });

        // 선택된 요소가 변경되면 댓글 로드
        watch(() => props.selectedElement, () => {
            if (props.selectedElement) {
                loadComments();
            } else {
                comments.value = [];
            }
        }, { immediate: true });

        return {
            comments,
            loading,
            submitting,
            newComment,
            currentUserId,
            rootComments,
            getReplies,
            submitComment,
            handleReply,
            handleEdit,
            handleDelete,
            handleResolve,
            getElementIcon,
            getElementColor,
            isTaskType
        };
    }
});
</script>

<style scoped>
.element-comment-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.comment-list-container {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
}

.comment-list {
    max-height: 100%;
}

.comment-item {
    border-radius: 8px;
}
</style>

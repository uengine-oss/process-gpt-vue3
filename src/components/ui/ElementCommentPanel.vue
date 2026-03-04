<template>
    <v-card class="element-comment-panel" elevation="0">
        <!-- 헤더 -->
        <v-card-title class="d-flex align-center pa-3 pb-2">
            <v-icon class="mr-2" size="20">mdi-comment-text-multiple-outline</v-icon>
            <span class="text-subtitle-1 font-weight-medium">{{ $t('elementComment.title') }}</span>
            <v-spacer />
            <v-chip v-if="commentViewMode === 'element' ? comments.length > 0 : processComments.length > 0" size="x-small" color="primary" variant="tonal">
                {{ commentViewMode === 'element' ? comments.length : processComments.length }}
            </v-chip>
            <v-btn icon variant="text" size="small" @click="$emit('close')">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-card-title>

        <!-- Tab toggle: Element vs Process-wide -->
        <div class="comment-tabs px-3 pb-1">
            <v-btn-toggle v-model="commentViewMode" mandatory density="compact" color="primary" class="w-100">
                <v-btn value="element" size="x-small" class="flex-grow-1">
                    <v-icon start size="12">mdi-cursor-default-click</v-icon>
                    요소 코멘트
                </v-btn>
                <v-btn value="process" size="x-small" class="flex-grow-1">
                    <v-icon start size="12">mdi-file-tree-outline</v-icon>
                    전체 피드백
                </v-btn>
            </v-btn-toggle>
        </div>

        <!-- 선택된 요소 정보 (element mode only) -->
        <template v-if="commentViewMode === 'element'">
            <div v-if="selectedElement && isTaskType(selectedElement.type)" class="px-3 pb-2">
                <v-chip size="small" :color="getElementColor(selectedElement.type)" variant="tonal"
                    style="cursor: pointer;"
                    @click="$emit('focusElement', selectedElement.id)"
                >
                    <v-icon start size="14">{{ getElementIcon(selectedElement.type) }}</v-icon>
                    {{ selectedElement.name || selectedElement.id }}
                    <v-icon end size="12">mdi-crosshairs-gps</v-icon>
                </v-chip>
            </div>

            <!-- Task가 아닌 경우 안내 -->
            <div v-else class="px-3 pb-2">
                <v-alert type="info" density="compact" variant="tonal">
                    {{ $t('elementComment.selectTaskToComment') }}
                </v-alert>
            </div>
        </template>

        <!-- [3.18] Round Tabs -->
        <div v-if="rounds.length > 1" class="round-tabs px-3 pb-1">
            <v-chip-group v-model="activeRound" selected-class="text-primary">
                <v-chip :value="null" size="x-small" variant="outlined" filter>
                    전체
                </v-chip>
                <v-chip
                    v-for="r in rounds"
                    :key="r"
                    :value="r"
                    size="x-small"
                    variant="outlined"
                    filter
                >
                    Round {{ r }}
                </v-chip>
            </v-chip-group>
        </div>

        <v-divider />

        <!-- 댓글 목록 -->
        <v-card-text class="pa-0 comment-list-container">
            <div v-if="loading" class="d-flex justify-center align-center pa-4">
                <v-progress-circular indeterminate size="24" />
            </div>

            <!-- Element comments (existing) -->
            <template v-else-if="commentViewMode === 'element'">
                <div v-if="comments.length === 0" class="text-center pa-4 text-grey">
                    <v-icon size="48" color="grey-lighten-1">mdi-comment-off-outline</v-icon>
                    <div class="mt-2 text-body-2">{{ $t('elementComment.noComments') }}</div>
                </div>

                <div v-else class="comment-list pa-2">
                    <div
                        v-for="comment in filteredRootComments"
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
            </template>

            <!-- Process-wide comments -->
            <div v-else-if="commentViewMode === 'process'" class="comment-list pa-2">
                <div v-if="processComments.length === 0" class="text-center pa-4 text-grey">
                    <v-icon size="48" color="grey-lighten-1">mdi-comment-off-outline</v-icon>
                    <div class="mt-2 text-body-2">프로세스 전체 피드백이 없습니다</div>
                </div>
                <div v-for="comment in filteredProcessRootComments" :key="comment.id" class="comment-item mb-2">
                    <div class="process-comment-card" :class="{ 'process-comment-card--resolved': comment.is_resolved }">
                        <div class="d-flex align-center justify-space-between mb-1">
                            <div class="d-flex align-center ga-1">
                                <v-chip size="x-small" variant="tonal" color="primary">
                                    {{ comment.author_name || '익명' }}
                                </v-chip>
                                <v-chip v-if="comment.element_id" size="x-small" variant="outlined"
                                    style="cursor: pointer;" @click="$emit('focusElement', comment.element_id)">
                                    <v-icon start size="10">mdi-target</v-icon>
                                    {{ comment.element_name || comment.element_id }}
                                </v-chip>
                                <v-chip v-else size="x-small" variant="tonal" color="grey">
                                    프로세스
                                </v-chip>
                            </div>
                            <v-icon v-if="comment.is_resolved" size="16" color="success">mdi-check-circle</v-icon>
                            <v-chip v-else size="x-small" color="warning" variant="flat">미해결</v-chip>
                        </div>
                        <div class="text-body-2 mt-1" :class="{ 'text-medium-emphasis': comment.is_resolved }">
                            {{ comment.comment || comment.content || '' }}
                        </div>
                        <div class="text-caption text-disabled mt-1">{{ formatRelativeTime(comment.created_at) }}</div>
                    </div>
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
    emits: ['close', 'commentCountChanged', 'focusElement'],
    setup(props, { emit }) {
        const backend = BackendFactory.createBackend() as any;
        const commentViewMode = ref<'element' | 'process'>('element');
        const comments = ref<any[]>([]);
        const processComments = ref<any[]>([]);
        const loading = ref(false);
        const submitting = ref(false);
        const newComment = ref('');
        const currentUserId = ref('');
        const activeRound = ref<number | null>(null); // null = 전체
        const rounds = ref<number[]>([]);

        // 루트 댓글 (부모가 없는 댓글)
        const rootComments = computed(() => {
            return comments.value.filter(c => !c.parent_comment_id);
        });

        // 프로세스 전체 루트 댓글
        const processRootComments = computed(() => {
            return processComments.value.filter(c => !c.parent_comment_id);
        });

        // 라운드 수 계산 (proc_def_approval_state 제출 횟수 기반)
        const loadRounds = async () => {
            if (!props.procDefId) return;
            try {
                const supabase = (window as any).$supabase;
                if (!supabase) return;
                const { data } = await supabase
                    .from('proc_def_approval_state')
                    .select('id')
                    .eq('proc_def_id', props.procDefId)
                    .eq('tenant_id', (window as any).$tenantName)
                    .order('created_at', { ascending: true });
                const count = data?.length || 1;
                rounds.value = Array.from({ length: count }, (_, i) => i + 1);
                activeRound.value = null; // 전체 보기가 기본
            } catch (e) {
                rounds.value = [1];
            }
        };

        const filteredComments = computed(() => {
            if (activeRound.value === null) return comments.value;
            return comments.value.filter(c => (c.submission_round || 1) === activeRound.value);
        });

        const filteredRootComments = computed(() => {
            return filteredComments.value.filter(c => !c.parent_comment_id);
        });

        const filteredProcessComments = computed(() => {
            if (activeRound.value === null) return processComments.value;
            return processComments.value.filter(c => (c.submission_round || 1) === activeRound.value);
        });

        const filteredProcessRootComments = computed(() => {
            return filteredProcessComments.value.filter(c => !c.parent_comment_id);
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

        // 프로세스 전체 댓글 로드
        const loadProcessComments = async () => {
            if (!props.procDefId) return;
            loading.value = true;
            try {
                const supabase = (window as any).$supabase;
                if (supabase) {
                    const { data } = await supabase
                        .from('proc_def_comments')
                        .select('*')
                        .eq('proc_def_id', props.procDefId)
                        .order('created_at', { ascending: false })
                        .limit(100);
                    processComments.value = data || [];
                }
            } catch (e) {
                console.error('전체 피드백 로드 실패:', e);
            } finally {
                loading.value = false;
            }
        };

        // 상대 시간 포맷
        const formatRelativeTime = (dateStr: string) => {
            if (!dateStr) return '';
            try {
                const d = new Date(dateStr);
                const now = new Date();
                const diffMs = now.getTime() - d.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                if (diffMin < 1) return '방금 전';
                if (diffMin < 60) return `${diffMin}분 전`;
                const diffHours = Math.floor(diffMin / 60);
                if (diffHours < 24) return `${diffHours}시간 전`;
                const diffDays = Math.floor(diffHours / 24);
                return `${diffDays}일 전`;
            } catch { return dateStr; }
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

        // 댓글 해결 처리 (resolve_action_text 포함)
        const handleResolve = async (data: { commentId: string; resolved: boolean; resolveActionText?: string }) => {
            try {
                await backend.resolveElementComment(data.commentId, data.resolved, data.resolveActionText);
                await loadComments();
                emit('commentCountChanged');
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
            currentUserId.value = (window as any).$user?.id || '';
            loadRounds();
        });

        // 선택된 요소가 변경되면 댓글 로드
        watch(() => props.selectedElement, () => {
            if (commentViewMode.value === 'element') {
                if (props.selectedElement) {
                    loadComments();
                    loadRounds();
                } else {
                    comments.value = [];
                }
            }
        }, { immediate: true });

        // 탭 모드 변경 시 댓글 로드
        watch(commentViewMode, (mode) => {
            if (mode === 'process') {
                loadProcessComments();
                loadRounds();
            } else if (props.selectedElement) {
                loadComments();
            }
        });

        return {
            commentViewMode,
            comments,
            processComments,
            loading,
            submitting,
            newComment,
            currentUserId,
            activeRound,
            rounds,
            rootComments,
            processRootComments,
            filteredRootComments,
            filteredProcessRootComments,
            getReplies,
            submitComment,
            handleReply,
            handleEdit,
            handleDelete,
            handleResolve,
            getElementIcon,
            getElementColor,
            isTaskType,
            formatRelativeTime
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

.comment-tabs {
    margin-top: 4px;
}
.comment-tabs .v-btn {
    font-size: 11px;
    text-transform: none;
    letter-spacing: 0;
}
.process-comment-card {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 10px 12px;
}
.process-comment-card--resolved {
    opacity: 0.6;
    background: #fafafa;
}
.round-tabs {
    margin-top: 2px;
}
.round-tabs .v-chip {
    font-size: 10px;
}
</style>

<template>
    <v-card elevation="10" class="pa-3" style="height: 100%; overflow: auto;">
        <v-row class="ma-0 pa-0 align-center">
            <v-card-title class="pa-0">
                재작업 요청 (Back To Here)
            </v-card-title>
            <v-spacer></v-spacer>
            <v-btn
                variant="text"
                density="compact"
                :loading="isLoading"
                :disabled="!resolvedInstId"
                @click="loadTree"
            >
                <v-icon class="mr-1">mdi-refresh</v-icon>
                새로고침
            </v-btn>
        </v-row>

        <v-divider class="my-3"></v-divider>

        <v-alert
            v-if="!resolvedInstId"
            type="info"
            variant="tonal"
            density="compact"
        >
            인스턴스 정보가 없습니다.
        </v-alert>

        <div v-else>
            <!-- 헤더(컬럼) -->
            <div class="bth-row bth-header text-caption font-weight-bold">
                <div class="bth-col-id">태스크ID</div>
                <div class="bth-col-name">태스크명</div>
                <div class="bth-col-status">상태</div>
            </div>

            <v-skeleton-loader
                v-if="isLoading"
                type="list-item-two-line, list-item-two-line, list-item-two-line"
                class="mt-2"
            ></v-skeleton-loader>

            <v-treeview
                v-else-if="Object.keys(nodes).length > 0"
                :config="config"
                :nodes="nodes"
                class="bth-tree mt-2"
            >
                <!-- ID 컬럼 -->
                <template #before-input="{ node }">
                    <div
                        class="bth-col-id bth-cell"
                        @click="handleNodeClick(node)"
                    >
                        <span v-if="node.data?.type === 'task'">{{ node.data.taskId }}</span>
                        <span v-else class="text-grey-darken-1">-</span>
                    </div>
                </template>

                <!-- 태스크명(기본 text 영역 대체) -->
                <template #text="{ node }">
                    <div
                        class="bth-col-name bth-cell"
                        :class="{ 'bth-selected': selectedNodeId === node.id }"
                        @click="handleNodeClick(node)"
                        style="width: 70% !important;"
                    >
                        <span class="text-truncate" style="display: inline-block; width: 80% !important;">
                            {{ node.text }}
                        </span>
                        <v-tooltip activator="parent" location="bottom">
                            {{ node.text }}
                        </v-tooltip>
                    </div>
                </template>

                <!-- 상태 컬럼 -->
                <template #after-input="{ node }">
                    <div
                        class="bth-col-status bth-cell"
                        @click="handleNodeClick(node)"
                    >
                        <v-chip
                            v-if="node.data?.type === 'task'"
                            size="x-small"
                            variant="outlined"
                        >
                            {{ node.data.status || '-' }}
                        </v-chip>
                        <span v-else class="text-grey-darken-1">-</span>
                    </div>
                </template>
            </v-treeview>

            <v-alert
                v-else
                type="info"
                variant="tonal"
                density="compact"
                class="mt-2"
            >
                표시할 태스크가 없습니다.
            </v-alert>

            <!-- 목록 하단 액션 버튼 (조건부 표시) -->
            <div v-if="shouldShowActionButton" class="d-flex justify-end mt-4">
                <v-btn
                    color="primary"
                    variant="flat"
                    rounded
                    :disabled="!selectedTaskNode || isLoading"
                    :loading="isLoading"
                    @click="requestBackToHere"
                >
                    Back To Here
                </v-btn>
            </div>
        </div>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import VTreeview from 'vue3-treeview';
import 'vue3-treeview/dist/style.css';

const backend = BackendFactory.createBackend();

export default {
    name: 'BackToHereView',
    components: {
        VTreeview,
    },
    props: {
        instance: {
            type: Object,
            required: false,
            default: null,
        },
    },
    data: () => ({
        isLoading: false,
        nodes: {},
        config: {
            roots: [],
        },
        selectedNodeId: null,
        // 안전장치(무한/과도한 조회 방지)
        maxFetchParents: 200,
        maxTotalTasks: 2000,
    }),
    computed: {
        resolvedInstId() {
            if (!this.instance) return null;
            return this.instance.instId || this.instance.instanceId || this.instance.id || null;
        },
        resolvedInstName() {
            if (!this.instance) return '';
            return this.instance.name || this.instance.instName || '';
        },
        shouldShowActionButton() {
            return true;
        },
        selectedTaskNode() {
            const node = this.selectedNodeId ? this.nodes[this.selectedNodeId] : null;
            if (!node) return null;
            if (node.data?.type !== 'task') return null;
            return node;
        },
    },
    watch: {
        instance: {
            deep: true,
            immediate: true,
            async handler(newVal, oldVal) {
                const newId = newVal && (newVal.instId || newVal.instanceId || newVal.id);
                const oldId = oldVal && (oldVal.instId || oldVal.instanceId || oldVal.id);
                if (newId && newId !== oldId) {
                    await this.loadTree();
                }
                if (!newId) {
                    this.resetTree();
                }
            },
        },
    },
    methods: {
        resetTree() {
            this.nodes = {};
            this.config.roots = [];
            this.selectedNodeId = null;
        },
        normalizeToNumber(value) {
            if (value == null) return null;
            if (typeof value === 'number') return Number.isNaN(value) ? null : value;
            const parsed = parseInt(String(value).replace(/_DOT_/g, '.'), 10);
            return Number.isNaN(parsed) ? null : parsed;
        },
        getTaskId(task) {
            return task?.taskId ?? task?.id ?? null;
        },
        getTaskName(task) {
            return task?.title || task?.name || task?.activityName || task?.activity_name || '(이름 없음)';
        },
        getTaskStatus(task) {
            return task?.status || task?.task?.status || null;
        },
        isCompletedStatus(status) {
            if (!status) return false;
            const s = String(status).toUpperCase();
            return s === 'DONE' || s === 'COMPLETED';
        },
        getTracingTag(task) {
            return (
                task?.tracingTag ||
                task?.trcTag ||
                task?.activityId ||
                task?.activity_id ||
                task?.task?.trcTag ||
                task?.task?.tracingTag ||
                null
            );
        },
        isTaskObject(v) {
            return v && typeof v === 'object' && (v.taskId != null || v.id != null || v.title != null || v.status != null);
        },
        async fetchTasksByParentId(parentId) {
            const parentNumber = this.normalizeToNumber(parentId);
            if (parentNumber == null) return [];

            try {
                // 완료된 태스크만 조회 (전체 조회 금지)
                if (typeof backend.getCompletedTaskId !== 'function') return [];

                const completedList = await backend.getCompletedTaskId(String(parentNumber));
                console.log(completedList);
                if (!Array.isArray(completedList) || completedList.length === 0) return [];

                // 1) completedList가 이미 worklist 객체 배열인 경우 그대로 사용
                if (this.isTaskObject(completedList[0])) {
                    return completedList;
                }

                // 2) completedList가 taskId 배열(string/number)인 경우:
                //    - 각 taskId를 개별 조회하여 화면에 필요한 필드를 구성한다.
                const ids = completedList
                    .map((v) => (typeof v === 'number' || typeof v === 'string' ? String(v) : null))
                    .filter(Boolean);

                const tasks = [];
                // 과도한 호출 방지 (UI 목적상 상한선)
                const limit = Math.min(ids.length, 200);
                for (let i = 0; i < limit; i++) {
                    const id = ids[i];
                    try {
                        const wi = await backend.getWorkItem(id);
                        if (!wi || !wi.worklist) continue;
                        tasks.push({
                            taskId: wi.worklist.taskId,
                            status: wi.worklist.status,
                            title: wi.worklist.title || wi.activity?.name || '',
                            tracingTag: wi.activity?.tracingTag || wi.worklist.tracingTag || wi.worklist.trcTag || null,
                            instId: wi.worklist.instId,
                            task: wi.worklist,
                        });
                    } catch (e) {
                        // ignore single item failure
                    }
                }

                return tasks;
            } catch (e) {
                return [];
            }
        },
        async loadTree() {
            const instId = this.resolvedInstId;
            if (!instId) {
                this.resetTree();
                return;
            }

            this.isLoading = true;
            this.resetTree();

            try {
                const rootId = `inst_${String(instId)}`;
                this.config.roots = [rootId];

                this.nodes[rootId] = {
                    id: rootId,
                    text: this.resolvedInstName ? `${this.resolvedInstName} (인스턴스)` : `인스턴스 ${instId}`,
                    children: [],
                    state: { opened: true }, // 트리 기본 펼침
                    data: { type: 'instance', instId },
                };

                const visitedParents = new Set();
                let fetchedParents = 0;
                let totalTasks = 0;

                const build = async (parentKey, parentNodeId) => {
                    if (visitedParents.has(String(parentKey))) return;
                    visitedParents.add(String(parentKey));
                    fetchedParents++;
                    if (fetchedParents > this.maxFetchParents) return;

                    const tasksRaw = await this.fetchTasksByParentId(parentKey);
                    const tasks = Array.isArray(tasksRaw) ? tasksRaw.filter((t) => this.isTaskObject(t)) : [];
                    for (const task of tasks) {
                        const taskId = this.getTaskId(task);
                        if (taskId == null) continue;

                        totalTasks++;
                        if (totalTasks > this.maxTotalTasks) break;

                        const nodeId = `task_${String(taskId)}`;
                        if (!this.nodes[nodeId]) {
                            this.nodes[nodeId] = {
                                id: nodeId,
                                text: this.getTaskName(task),
                                children: [],
                                state: { opened: true }, // 트리 기본 펼침
                                data: {
                                    type: 'task',
                                    taskId,
                                    status: this.getTaskStatus(task),
                                    tracingTag: this.getTracingTag(task),
                                    raw: task,
                                },
                            };
                        }
                        this.nodes[parentNodeId].children.push(nodeId);
                    }

                    const children = this.nodes[parentNodeId].children || [];
                    for (const childNodeId of children) {
                        const childTaskId = this.nodes[childNodeId]?.data?.taskId;
                        if (childTaskId == null) continue;
                        if (totalTasks > this.maxTotalTasks) break;
                        await build(childTaskId, childNodeId);
                    }
                };

                await build(instId, rootId);

                // 생성된 모든 노드를 기본으로 펼침 처리
                Object.keys(this.nodes).forEach((key) => {
                    const node = this.nodes[key];
                    if (!node) return;
                    if (!node.state) node.state = {};
                    node.state.opened = true;
                });

                // 아무 태스크도 없으면 roots만 남겨둠
                if (!this.nodes[rootId].children || this.nodes[rootId].children.length === 0) {
                    // keep root only
                }
            } finally {
                this.isLoading = false;
            }
        },
        handleNodeClick(node) {
            this.selectedNodeId = node.id;
            if (node?.data?.type === 'task') {
                this.$emit('selected', {
                    taskId: node.data.taskId,
                    name: node.text,
                    status: node.data.status,
                    tracingTag: node.data.tracingTag,
                    raw: node.data.raw,
                });
            }
        },
        requestBackToHere() {
            // 실제 실행은 부모에서 처리하도록 이벤트만 emit
            // (필요 시 여기서 backend.backToHere(...)를 직접 호출하도록 변경 가능)
            const node = this.selectedTaskNode;
            if (!node) return;

            this.$emit('requestBackToHere', {
                instanceId: this.resolvedInstId,
                taskId: node.data.taskId,
                tracingTag: node.data.tracingTag,
                name: node.text,
                status: node.data.status,
                raw: node.data.raw,
            });
        },
    },
};
</script>

<style scoped>
.bth-tree {
    user-select: none;
}

.bth-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 6px;
    border-radius: 6px;
}

.bth-header {
    background: rgba(0, 0, 0, 0.03);
}

.bth-node {
    cursor: pointer;
}

.bth-node:hover {
    background: rgba(0, 0, 0, 0.04);
}

.bth-selected {
    background: rgba(25, 118, 210, 0.10);
}

.bth-col-id {
    width: 100px;
    flex: 0 0 100px;
    font-variant-numeric: tabular-nums;
}

.bth-col-name {
    flex: 1 1 auto;
    min-width: 140px;
    overflow: hidden;
}

.bth-col-status {
    width: 120px;
    flex: 0 0 120px;
    display: flex;
    justify-content: flex-end;
}

.bth-cell {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
}
</style>
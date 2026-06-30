<template>
    <v-card elevation="10">
        <div class="pa-4" :class="this.globalIsMobile.value ? 'todolist-card-box-is-mobile' : 'todolist-card-box'">
            <div class="d-flex align-center justify-space-between ml-2 mt-1">
                <h5 class="text-h5 font-weight-semibold">{{ $t('todoList.title') }}</h5>
                <v-spacer></v-spacer>

                <!-- 정렬 옵션 -->
                <v-chip variant="outlined" color="gray" class="sort-chip-select-wrapper mr-3" size="small">
                    <v-select
                        v-model="sortOption"
                        :items="sortOptions"
                        item-title="label"
                        item-value="value"
                        variant="plain"
                        density="compact"
                        hide-details
                    >
                        <template v-slot:selection="{ item }">
                            <span style="font-size: 13px">{{ item.raw.label }}</span>
                        </template>
                    </v-select>
                </v-chip>
            </div>
            <KanbanBoard
                :columns="filteredTodolist"
                :hasMore="hasMore"
                :loading="loading"
                :pages="pages"
                :isNotAll="false"
                :showAddButton="false"
                :sortOption="sortOption"
                :pageSize="pageSize"
                @loadMore="handleLoadMore"
                @updateStatus="updateStatus"
            />
        </div>

        <v-dialog v-model="dialog" max-width="500" persistent :fullscreen="isMobile">
            <TodoDialog :todolist="todolist" @close="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import KanbanBoard from './KanbanBoard.vue';
import TodoDialog from './TodoDialog.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        KanbanBoard,
        TodoDialog
    },
    data() {
        return {
            todolist: [
                {
                    id: 'IN_PROGRESS',
                    title: 'todoList.inProgress',
                    cardbg: 'lightsecondary',
                    tasks: []
                },
                {
                    id: 'PENDING',
                    title: 'todoList.pending',
                    cardbg: 'lightinfo',
                    tasks: []
                },
                {
                    id: 'TODO',
                    title: 'todoList.todo',
                    cardbg: 'background',
                    tasks: []
                },
                {
                    id: 'DONE',
                    title: 'todoList.done',
                    cardbg: 'lightsuccess',
                    tasks: []
                }
            ],
            dialog: false,
            pages: {
                IN_PROGRESS: 0,
                PENDING: 0,
                TODO: 0,
                DONE: 0
            },
            hasMore: {
                IN_PROGRESS: true,
                PENDING: true,
                TODO: true,
                DONE: true
            },
            loading: {
                IN_PROGRESS: false,
                PENDING: false,
                TODO: false,
                DONE: false
            },
            deletedInstances: null,
            sortOption: 'updatedAt',
            pageSize: 10
        };
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        sortOptions() {
            return [
                { value: 'updatedAt', label: '최근 작업 순' },
                { value: 'startDate', label: this.$t('todoList.sortByStartDate') },
                { value: 'dueDate', label: this.$t('todoList.sortByDueDate') }
            ];
        },
        filteredTodolist() {
            // 삭제된 인스턴스들의 proc_inst_id 배열 생성
            const deletedInstanceIds = this.deletedInstances ? this.deletedInstances.map((instance) => instance.proc_inst_id) : [];

            return this.todolist
                .filter((column) => column.id !== 'TODO') // TODO 컬럼 제외
                .map((column) => ({
                    ...column,
                    tasks: column.tasks.filter((task) => {
                        // rootInstId와 instId 둘 다 삭제된 인스턴스 리스트에 없을 때만 표시
                        return !deletedInstanceIds.includes(task.rootInstId) && !deletedInstanceIds.includes(task.instId);
                    })
                }));
        }
    },
    async mounted() {
        await this.loadDeletedInstance();
        await Promise.all([
            this.loadWorkListByStatus('IN_PROGRESS'),
            this.loadWorkListByStatus('SUBMITTED'),
            this.loadWorkListByStatus('PENDING'),
            // this.loadWorkListByStatus('TODO'),
            this.loadWorkListByStatus('DONE')
        ]);

        this.EventBus.on('todolist-updated', this.handleTodolistUpdated);
    },
    unmounted() {
        this.EventBus.off('todolist-updated', this.handleTodolistUpdated);
    },
    methods: {
        async handleTodolistUpdated() {
            await this.reloadAllTodoList();
        },
        async reloadAllTodoList() {
            const userId = localStorage.getItem('uid');
            const mode = window.$mode;

            // 각 status별로 현재까지 로드된 데이터만 다시 불러오기
            const reloadPromises = this.todolist.map(async (column) => {
                const status = column.id;
                let requestOptions = {
                    page: 0,
                    size: (this.pages[status] + 1) * this.pageSize,
                    status: status,
                    userId: userId
                };

                let worklist = await backend.getWorkList(requestOptions);

                if (!worklist) worklist = [];

                // 컬럼 tasks 업데이트 (콤마로 구분된 user_id 필드에서 정확히 userId가 포함되는지 확인)
                column.tasks = worklist.filter((item) => {
                    // uEngine 모드에서는 Worklist 상태 'NEW'를 진행중으로 분류(InstanceTodo.vue와 동일)
                    if (
                        status === 'IN_PROGRESS' &&
                        (item.status === 'IN_PROGRESS' ||
                            item.status === 'SUBMITTED' ||
                            (mode === 'uEngine' && (item.status === 'NEW' || item.status === 'Running')))
                    ) {
                        return true;
                    } else if (status === 'TODO' && (item.status === 'TODO' || item.status === 'NEW' || item.status === 'DRAFT')) {
                        return true;
                    } else if (status === 'DONE' && (item.status === 'DONE' || item.status === 'COMPLETED')) {
                        return true;
                    } else if (item.status === status) {
                        return true;
                    }
                    return false;
                });
            });

            await Promise.all(reloadPromises);
        },
        async loadDeletedInstance() {
            try {
                this.deletedInstances = await backend.getDeletedInstances();
            } catch (error) {
                console.error('삭제된 인스턴스 로딩 중 오류 발생:', error);
            }
        },
        handleLoadMore(columnId) {
            if (this.loading[columnId]) {
                return;
            }

            if (!this.hasMore[columnId]) {
                return;
            }

            this.pages[columnId]++;
            this.loadWorkListByStatus(columnId);
        },
        async loadWorkListByStatus(status) {
            const me = this;
            const mode = window.$mode;

            // 로딩 시작
            me.loading[status] = true;

            try {
                const userId = localStorage.getItem('uid');
                let requestOptions = {
                    page: me.pages[status],
                    size: me.pageSize,
                    status: status,
                    userId: userId,
                    sort: 'desc'
                };

                if (me.sortOption === 'updatedAt') {
                    requestOptions.orderBy = 'updated_at';
                } else if (me.sortOption === 'startDate') {
                    requestOptions.orderBy = 'start_date';
                } else if (me.sortOption === 'dueDate') {
                    requestOptions.orderBy = 'due_date';
                }

                let worklist = await backend.getWorkList(requestOptions);
                if (!worklist) worklist = [];

                // 더 이상 데이터가 없는지 확인
                if (worklist.length < me.pageSize) {
                    me.hasMore[status] = false;
                }

                const column = me.todolist.find((x) => x.id === status);

                worklist.forEach(function (item) {
                    // 상태별 매칭 (IN_PROGRESS는 SUBMITTED도 포함)
                    let shouldAdd = false;
                    // uEngine 모드에서는 Worklist 상태 'NEW'를 진행중으로 분류(InstanceTodo.vue와 동일)
                    if (
                        status === 'IN_PROGRESS' &&
                        (item.status === 'IN_PROGRESS' ||
                            item.status === 'SUBMITTED' ||
                            (mode === 'uEngine' && (item.status === 'NEW' || item.status === 'Running')))
                    ) {
                        shouldAdd = true;
                    } else if (status === 'TODO' && (item.status === 'TODO' || item.status === 'NEW' || item.status === 'DRAFT')) {
                        shouldAdd = true;
                    } else if (status === 'DONE' && (item.status === 'DONE' || item.status === 'COMPLETED')) {
                        shouldAdd = true;
                    } else if (item.status === status) {
                        shouldAdd = true;
                    }

                    if (shouldAdd) {
                        const taskExist = column.tasks.find((task) => task.taskId === item.taskId);
                        if (!taskExist) {
                            column.tasks.push(item);
                        }
                    }
                });
            } catch (error) {
                console.error('워크리스트 로딩 중 오류 발생:', error);
            } finally {
                // 로딩 완료
                me.loading[status] = false;
            }
        },
        updateStatus(taskId, originColumnId) {
            let task;
            this.todolist.forEach((column) => {
                let foundTask = column.tasks.find((task) => task.taskId === taskId);
                if (foundTask) {
                    task = foundTask;
                    column.tasks = column.tasks.filter((task) => task.taskId !== taskId);
                }
            });
            if (task) {
                this.todolist.find((column) => column.id === originColumnId).tasks.push(task);
            }
        },
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        }
    }
};
</script>

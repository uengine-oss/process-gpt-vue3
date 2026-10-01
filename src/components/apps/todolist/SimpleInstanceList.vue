<template>
    <v-card class="pg-instance-inbox" elevation="0" data-testid="simple-instance-list">
        <div class="pg-instance-inbox__header">
            <div>
                <h1>할 일</h1>
                <p>진행 중인 인스턴스에서 내 업무를 확인하세요.</p>
            </div>
            <v-btn icon variant="text" :loading="loading" aria-label="새로고침" @click="load">
                <v-icon>mdi-refresh</v-icon>
            </v-btn>
        </div>

        <v-progress-linear v-if="loading && instances.length === 0" indeterminate color="primary" />
        <div v-else-if="instances.length === 0" class="pg-instance-inbox__empty">
            <v-icon size="34">mdi-checkbox-marked-circle-outline</v-icon>
            <strong>지금 처리할 일이 없습니다.</strong>
            <span>새 할 일이 배정되면 여기에 표시됩니다.</span>
        </div>

        <div v-else class="pg-instance-inbox__list">
            <button
                v-for="item in instances"
                :key="item.instId"
                type="button"
                class="pg-instance-row"
                :class="{ 'pg-instance-row--new': item.unreadCount > 0 }"
                :data-testid="`instance-row-${item.instId}`"
                @click="openInstance(item)"
            >
                <div class="pg-instance-row__icon">
                    <v-icon size="22">mdi-vector-polyline</v-icon>
                </div>
                <div class="pg-instance-row__body">
                    <div class="pg-instance-row__title-line">
                        <strong>{{ item.name || item.instId }}</strong>
                        <v-chip v-if="item.unreadCount > 0" color="primary" size="x-small" variant="flat" data-testid="new-todo-badge">
                            새 할 일<span v-if="item.unreadCount > 1"> {{ item.unreadCount }}</span>
                        </v-chip>
                    </div>
                    <div class="pg-instance-row__task">
                        {{ item.latestTask?.name || item.latestTask?.description || '진행 중인 업무' }}
                    </div>
                    <div class="pg-instance-row__meta">
                        <StatusChip :status="item.status" type="instance" />
                        <span>{{ formatRelativeTime(item.lastTodoAt) }}</span>
                        <span v-if="item.todoCount > 1">할 일 {{ item.todoCount }}개</span>
                    </div>
                </div>
                <v-icon size="20" class="pg-instance-row__chevron">mdi-chevron-right</v-icon>
            </button>
        </div>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StatusChip from '@/components/ui/common/StatusChip.vue';
import { buildSimpleInstanceRows, reconcileSimpleInboxReadState, SIMPLE_INBOX_ACTIONABLE_STATUSES } from '@/shared/simpleInstanceInbox';

const backend = BackendFactory.createBackend();

export default {
    name: 'SimpleInstanceList',
    components: { StatusChip },
    data: () => ({
        loading: true,
        instances: [],
        workWatchRef: null,
        instanceWatchRef: null,
        knownTaskIds: new Set(),
        unreadTaskIds: new Set(),
        hasStoredReadState: false
    }),
    async mounted() {
        this.readState();
        await this.load();
        this.workWatchRef = await backend.watchWorkList(() => this.load());
        // process_status 에 있는 값만 넘긴다. 없는 값을 섮으면 조회가 통째로 실패해
        // 목록이 통째로 비어 보인다 — 빈 목록과 구별되지 않아 알아차기 어렵다.
        this.instanceWatchRef = await backend.watchInstanceList(() => this.load(), {
            status: ['NEW', 'RUNNING', 'COMPLETED']
        });
        this.EventBus.on('todolist-updated', this.load);
        this.EventBus.on('instances-updated', this.load);
    },
    beforeUnmount() {
        this.EventBus.off('todolist-updated', this.load);
        this.EventBus.off('instances-updated', this.load);
        if (this.workWatchRef) backend.watchOff(this.workWatchRef);
        if (this.instanceWatchRef) backend.watchOff(this.instanceWatchRef);
    },
    methods: {
        storageKey() {
            return `pg.simpleTodoState.${localStorage.getItem('uid') || 'anonymous'}`;
        },
        readState() {
            try {
                const raw = localStorage.getItem(this.storageKey());
                this.hasStoredReadState = raw !== null;
                const saved = raw ? JSON.parse(raw) : {};
                this.knownTaskIds = new Set(Array.isArray(saved.known) ? saved.known : []);
                this.unreadTaskIds = new Set(Array.isArray(saved.unread) ? saved.unread : []);
            } catch (e) {
                this.knownTaskIds = new Set();
                this.unreadTaskIds = new Set();
            }
        },
        saveState() {
            try {
                localStorage.setItem(
                    this.storageKey(),
                    JSON.stringify({ known: [...this.knownTaskIds].slice(-1000), unread: [...this.unreadTaskIds].slice(-300) })
                );
                this.hasStoredReadState = true;
            } catch (e) {
                /* 읽음 상태 저장 실패는 목록 표시를 막지 않는다. */
            }
        },
        async load() {
            this.loading = true;
            try {
                const uid = localStorage.getItem('uid');
                const [allTasks, rootInstances] = await Promise.all([
                    backend.getWorkList({ userId: uid, orderBy: 'updated_at', sort: 'desc' }),
                    backend.getInstanceListByStatus(['NEW', 'RUNNING'])
                ]);
                const tasks = (Array.isArray(allTasks) ? allTasks : []).filter((task) => SIMPLE_INBOX_ACTIONABLE_STATUSES.has(task.status));
                const currentIds = new Set(tasks.map((task) => task.taskId).filter(Boolean));
                const readState = reconcileSimpleInboxReadState({
                    currentTaskIds: currentIds,
                    knownTaskIds: this.knownTaskIds,
                    unreadTaskIds: this.unreadTaskIds,
                    hasStoredReadState: this.hasStoredReadState
                });
                this.knownTaskIds = readState.knownTaskIds;
                this.unreadTaskIds = readState.unreadTaskIds;
                this.saveState();

                const byId = new Map((Array.isArray(rootInstances) ? rootInstances : []).map((instance) => [instance.instId, instance]));
                const missingIds = [...new Set(tasks.map((task) => task.rootInstId || task.instId).filter((id) => id && !byId.has(id)))];
                const missing = await Promise.all(missingIds.map((id) => backend.getInstance(id).catch(() => null)));
                missing.filter(Boolean).forEach((instance) => byId.set(instance.instId, instance));

                this.instances = buildSimpleInstanceRows({
                    tasks,
                    instances: [...byId.values()],
                    unreadTaskIds: this.unreadTaskIds
                });
            } catch (error) {
                console.error('[SimpleInstanceList] 인스턴스 목록을 불러오지 못했습니다.', error);
                this.instances = [];
            } finally {
                this.loading = false;
            }
        },
        openInstance(item) {
            const taskIds = new Set(Array.isArray(item.taskIds) ? item.taskIds : []);
            taskIds.forEach((taskId) => this.unreadTaskIds.delete(taskId));
            // 해당 인스턴스의 현재 업무는 모두 읽은 것으로 처리한다.
            this.instances = this.instances.map((instance) =>
                instance.instId === item.instId ? { ...instance, unreadCount: 0 } : instance
            );
            this.saveState();
            // 인스턴스를 모르는 줄은 열 대화가 없다. 업무 화면으로 보낸다.
            if (item.orphanTaskId) {
                this.$router.push(`/todolist/${item.orphanTaskId}`);
                return;
            }
            this.$router.push(`/instancelist/${String(item.instId).replace(/\./g, '_DOT_')}`);
        },
        formatRelativeTime(value) {
            const time = new Date(value || 0).getTime();
            if (!time) return '';
            const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
            if (minutes < 1) return '방금 전';
            if (minutes < 60) return `${minutes}분 전`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}시간 전`;
            return `${Math.floor(hours / 24)}일 전`;
        }
    }
};
</script>

<style scoped>
.pg-instance-inbox {
    min-height: calc(100vh - var(--pg-tabbar-h, 48px));
    background: rgb(var(--v-theme-background));
}

.pg-instance-inbox__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 20px 14px;
}

.pg-instance-inbox__header h1 {
    font-size: 1.45rem;
    line-height: 1.25;
}

.pg-instance-inbox__header p {
    margin-top: 4px;
    color: rgba(var(--v-theme-on-surface), 0.58);
    font-size: 0.82rem;
}

.pg-instance-inbox__list {
    display: grid;
    gap: 10px;
    padding: 6px 14px 20px;
}

.pg-instance-row {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 20px;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 15px 13px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
    border-radius: 15px;
    color: rgb(var(--v-theme-on-surface));
    background: rgb(var(--v-theme-surface));
    text-align: left;
    cursor: pointer;
}

.pg-instance-row--new {
    border-color: rgba(var(--v-theme-primary), 0.35);
    box-shadow: 0 5px 18px rgba(var(--v-theme-primary), 0.1);
}

.pg-instance-row__icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}

.pg-instance-row__body {
    min-width: 0;
}
.pg-instance-row__title-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.pg-instance-row__title-line strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pg-instance-row__task {
    margin-top: 5px;
    overflow: hidden;
    color: rgba(var(--v-theme-on-surface), 0.7);
    font-size: 0.84rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pg-instance-row__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    font-size: 0.72rem;
}
.pg-instance-row__chevron {
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.pg-instance-inbox__empty {
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 80px 20px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    text-align: center;
}
.pg-instance-inbox__empty strong {
    color: rgb(var(--v-theme-on-surface));
}
.pg-instance-inbox__empty span {
    font-size: 0.82rem;
}

@media (min-width: 769px) {
    .pg-instance-inbox {
        max-width: 860px;
        min-height: 0;
        margin: 0 auto;
    }
}
</style>

<template>
    <v-dialog v-model="open" max-width="900" scrollable>
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center pa-4 pb-2">
                <v-icon class="mr-2" color="success">mdi-identifier</v-icon>
                실행 인스턴스 / 태스크 ID
                <span v-if="defName" class="text-body-2 text-medium-emphasis ml-2 exec-panel__def-name" :title="defName">
                    {{ defName }}
                </span>
                <v-spacer />
                <v-btn icon variant="text" size="small" :loading="loading" @click="fetchData">
                    <v-icon>mdi-refresh</v-icon>
                </v-btn>
                <v-btn icon variant="text" size="small" @click="open = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="px-4 pb-4">
                <div class="d-flex align-center mb-2">
                    <span class="text-caption text-medium-emphasis">
                        proc_def_id:
                        <code class="exec-panel__code">{{ normalizedDefId }}</code>
                    </span>
                    <v-btn icon variant="text" size="x-small" class="ml-1" @click="copyText(normalizedDefId)">
                        <v-icon size="14">mdi-content-copy</v-icon>
                    </v-btn>
                    <v-spacer />
                    <span class="text-caption text-medium-emphasis">최근 {{ instances.length }}개 인스턴스 · 4초마다 자동 갱신</span>
                </div>

                <v-alert v-if="!loading && instances.length === 0" type="info" variant="tonal" density="compact">
                    이 프로세스의 실행 인스턴스가 아직 없습니다. 실행 버튼으로 인스턴스를 시작하세요.
                </v-alert>

                <v-expansion-panels v-model="expanded" multiple variant="accordion">
                    <v-expansion-panel v-for="inst in instances" :key="inst.proc_inst_id" :value="inst.proc_inst_id">
                        <v-expansion-panel-title>
                            <div class="exec-panel__inst-header">
                                <v-chip size="x-small" :color="statusColor(inst.status)" variant="flat" class="exec-panel__status-chip">
                                    {{ inst.status || '-' }}
                                </v-chip>
                                <code
                                    class="exec-panel__code exec-panel__inst-id"
                                    :class="{ 'exec-panel__inst-id--highlight': inst.proc_inst_id === highlightInstanceId }"
                                    :title="inst.proc_inst_id"
                                >
                                    {{ inst.proc_inst_id }}
                                </code>
                                <v-btn icon variant="text" size="x-small" @click.stop="copyText(inst.proc_inst_id)">
                                    <v-icon size="14">mdi-content-copy</v-icon>
                                </v-btn>
                                <v-tooltip text="인스턴스 화면 열기" location="bottom">
                                    <template #activator="{ props: tt }">
                                        <v-btn v-bind="tt" icon variant="text" size="x-small" @click.stop="openInstance(inst.proc_inst_id)">
                                            <v-icon size="14">mdi-open-in-new</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <span class="text-caption text-medium-emphasis ml-auto exec-panel__date">
                                    {{ formatDate(inst.start_date) }}
                                </span>
                            </div>
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <div v-if="currentActivityText(inst)" class="text-caption text-medium-emphasis mb-2">
                                현재 액티비티: <code class="exec-panel__code">{{ currentActivityText(inst) }}</code>
                            </div>
                            <v-table density="compact" class="exec-panel__task-table">
                                <thead>
                                    <tr>
                                        <th class="text-left">taskId (todolist.id)</th>
                                        <th class="text-left">액티비티</th>
                                        <th class="text-left">상태</th>
                                        <th class="text-left">담당자</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="tasksOf(inst.proc_inst_id).length === 0">
                                        <td colspan="4" class="text-caption text-medium-emphasis">
                                            태스크가 아직 생성되지 않았습니다 (polling 엔진 처리 대기 중일 수 있습니다).
                                        </td>
                                    </tr>
                                    <tr v-for="task in tasksOf(inst.proc_inst_id)" :key="task.id">
                                        <td>
                                            <div class="d-flex align-center">
                                                <code class="exec-panel__code exec-panel__task-id" :title="task.id">{{ task.id }}</code>
                                                <v-btn icon variant="text" size="x-small" @click="copyText(task.id)">
                                                    <v-icon size="13">mdi-content-copy</v-icon>
                                                </v-btn>
                                                <v-tooltip text="워크아이템 열기" location="bottom">
                                                    <template #activator="{ props: tt }">
                                                        <v-btn v-bind="tt" icon variant="text" size="x-small" @click="openTask(task.id)">
                                                            <v-icon size="13">mdi-open-in-new</v-icon>
                                                        </v-btn>
                                                    </template>
                                                </v-tooltip>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="text-body-2">{{ task.activity_name || task.activity_id }}</span>
                                            <span v-if="task.activity_name" class="text-caption text-medium-emphasis ml-1">
                                                ({{ task.activity_id }})
                                            </span>
                                        </td>
                                        <td>
                                            <v-chip size="x-small" :color="statusColor(task.status)" variant="tonal">
                                                {{ task.status || '-' }}
                                            </v-chip>
                                        </td>
                                        <td class="text-caption">{{ task.user_id || '-' }}</td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import { formatKST } from '@/utils/datetime';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

const storage = StorageBaseFactory.getStorage();
const REFRESH_INTERVAL_MS = 4000;

export default {
    name: 'ExecInstancePanel',
    props: {
        modelValue: { type: Boolean, default: false },
        defId: { type: String, default: '' },
        defName: { type: String, default: '' },
        /** 방금 실행 버튼으로 시작한 인스턴스 — 목록에서 강조하고 자동으로 펼친다. */
        highlightInstanceId: { type: String, default: '' }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            loading: false,
            instances: [],
            tasksByInstance: {},
            expanded: []
        };
    },
    computed: {
        open: {
            get() {
                return this.modelValue;
            },
            set(v) {
                this.$emit('update:modelValue', v);
            }
        },
        normalizedDefId() {
            return (this.defId || '').toLowerCase();
        }
    },
    watch: {
        modelValue(open) {
            if (open) {
                this.expanded = this.highlightInstanceId ? [this.highlightInstanceId] : [];
                this.fetchData();
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        },
        defId() {
            if (this.modelValue) this.fetchData();
        }
    },
    beforeUnmount() {
        this.stopAutoRefresh();
    },
    methods: {
        startAutoRefresh() {
            this.stopAutoRefresh();
            this._refreshTimer = setInterval(() => {
                if (!this.loading) this.fetchData(true);
            }, REFRESH_INTERVAL_MS);
        },
        stopAutoRefresh() {
            if (this._refreshTimer) {
                clearInterval(this._refreshTimer);
                this._refreshTimer = null;
            }
        },
        async fetchData(silent = false) {
            const supabase = window.$supabase;
            if (!supabase || !this.defId) return;
            if (!silent) this.loading = true;
            try {
                // SSO 모드에서는 RLS 통과를 위해 Authorization 헤더 갱신이 필요
                await storage.ensureSupabaseAuthHeader?.();
                // proc_def_id 는 엔진이 소문자로 기록하지만, 과거 데이터 대비 원본 표기도 함께 조회
                const defIds = [...new Set([this.defId, this.normalizedDefId])];
                const { data: instRows, error: instError } = await supabase
                    .from('bpm_proc_inst')
                    .select('proc_inst_id, proc_def_id, status, current_activity_ids, start_date, end_date')
                    .in('proc_def_id', defIds)
                    .order('start_date', { ascending: false, nullsFirst: false })
                    .limit(20);
                if (instError) throw instError;
                this.instances = instRows || [];

                const instIds = this.instances.map((i) => i.proc_inst_id);
                if (instIds.length === 0) {
                    this.tasksByInstance = {};
                    return;
                }
                const { data: todoRows, error: todoError } = await supabase
                    .from('todolist')
                    .select('id, proc_inst_id, activity_id, activity_name, status, user_id, start_date, end_date')
                    .in('proc_inst_id', instIds)
                    .order('start_date', { ascending: true });
                if (todoError) throw todoError;

                const grouped = {};
                (todoRows || []).forEach((row) => {
                    if (!grouped[row.proc_inst_id]) grouped[row.proc_inst_id] = [];
                    grouped[row.proc_inst_id].push(row);
                });
                this.tasksByInstance = grouped;

                if (this.expanded.length === 0 && this.instances.length > 0) {
                    const target =
                        this.highlightInstanceId && instIds.includes(this.highlightInstanceId)
                            ? this.highlightInstanceId
                            : this.instances[0].proc_inst_id;
                    this.expanded = [target];
                }
            } catch (e) {
                if (!silent) this.$toast?.error(e?.message || '실행 정보 조회에 실패했습니다.');
            } finally {
                if (!silent) this.loading = false;
            }
        },
        tasksOf(instId) {
            return this.tasksByInstance[instId] || [];
        },
        currentActivityText(inst) {
            const ids = inst?.current_activity_ids;
            if (!ids) return '';
            return Array.isArray(ids) ? ids.join(', ') : String(ids);
        },
        async copyText(text) {
            if (!text) return;
            try {
                await navigator.clipboard.writeText(String(text));
                this.$toast?.success(`복사됨: ${text}`);
            } catch (e) {
                this.$toast?.error('클립보드 복사에 실패했습니다.');
            }
        },
        openInstance(instId) {
            if (!instId) return;
            this.open = false;
            this.$router.push(`/instancelist/${String(instId).replace(/\./g, '_DOT_')}`);
        },
        openTask(taskId) {
            if (!taskId) return;
            const { href } = this.$router.resolve(`/todolist/${taskId}`);
            window.open(href, '_blank', 'noopener');
        },
        statusColor(status) {
            switch (String(status || '').toUpperCase()) {
                case 'RUNNING':
                case 'IN_PROGRESS':
                    return 'primary';
                case 'SUBMITTED':
                case 'PENDING':
                    return 'warning';
                case 'DONE':
                case 'COMPLETED':
                    return 'success';
                case 'CANCELLED':
                case 'FAILED':
                    return 'error';
                default:
                    return 'grey';
            }
        },
        formatDate(value) {
            if (!value) return '';
            try {
                return formatKST(value);
            } catch (e) {
                return String(value);
            }
        }
    }
};
</script>

<style scoped>
.exec-panel__def-name {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.exec-panel__code {
    font-family: 'JetBrains Mono', 'D2Coding', Menlo, monospace;
    font-size: 12px;
    background: rgba(var(--v-theme-on-surface), 0.06);
    border-radius: 4px;
    padding: 1px 5px;
    user-select: all;
}
.exec-panel__inst-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
}
.exec-panel__status-chip {
    flex-shrink: 0;
}
.exec-panel__inst-id {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}
.exec-panel__inst-id--highlight {
    outline: 2px solid rgb(var(--v-theme-success));
    outline-offset: 1px;
}
.exec-panel__date {
    flex-shrink: 0;
}
.exec-panel__task-id {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
}
.exec-panel__task-table :deep(th) {
    font-size: 11px;
    white-space: nowrap;
}
</style>

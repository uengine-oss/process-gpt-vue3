<template>
    <v-dialog v-model="dialogVisible" fullscreen transition="dialog-bottom-transition">
        <v-card>
            <v-toolbar color="primary" density="compact">
                <v-btn icon @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-toolbar-title>{{ $t('auditLog.title') }}</v-toolbar-title>
                <v-spacer />
                <v-btn variant="text" @click="exportCsv">
                    <v-icon start>mdi-download</v-icon>
                    {{ $t('auditLog.exportCsv') }}
                </v-btn>
            </v-toolbar>

            <!-- Filters -->
            <v-card-text class="pa-4">
                <v-row class="mb-4" dense>
                    <v-col cols="12" md="4">
                        <v-select
                            v-model="filterActions"
                            :items="availableActions"
                            :label="$t('auditLog.filterAction')"
                            multiple
                            chips
                            closable-chips
                            density="compact"
                            variant="outlined"
                            hide-details
                            clearable
                        />
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-text-field
                            v-model="filterActor"
                            :label="$t('auditLog.filterActor')"
                            density="compact"
                            variant="outlined"
                            hide-details
                            clearable
                            prepend-inner-icon="mdi-magnify"
                        />
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-text-field
                            v-model="filterDate"
                            :label="$t('auditLog.filterDate')"
                            type="date"
                            density="compact"
                            variant="outlined"
                            hide-details
                            clearable
                        />
                    </v-col>
                </v-row>

                <!-- Data Table -->
                <v-data-table
                    :headers="headers"
                    :items="filteredItems"
                    :items-per-page="20"
                    density="compact"
                    class="elevation-1"
                >
                    <template v-slot:item.created_at="{ item }">
                        {{ formatDateTime(item.created_at) }}
                    </template>
                    <template v-slot:item.action="{ item }">
                        <v-chip
                            size="small"
                            :color="getActionColor(item.action)"
                            variant="tonal"
                        >
                            {{ item.action }}
                        </v-chip>
                    </template>
                    <template v-slot:item.comment="{ item }">
                        <span class="text-body-2 text-truncate" style="max-width: 300px; display: inline-block;">
                            {{ item.comment || '—' }}
                        </span>
                    </template>
                    <template v-slot:no-data>
                        <div class="text-center pa-4 text-medium-emphasis">
                            {{ $t('auditLog.noLogs') }}
                        </div>
                    </template>
                </v-data-table>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BackendFactory from '@/components/api/BackendFactory';

export default defineComponent({
    name: 'AuditLogViewer',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        procDefId: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const { t } = useI18n();
        const backend: any = BackendFactory.createBackend();

        const dialogVisible = computed({
            get: () => props.modelValue,
            set: (val: boolean) => emit('update:modelValue', val)
        });

        const items = ref<any[]>([]);
        const filterActions = ref<string[]>([]);
        const filterActor = ref('');
        const filterDate = ref('');

        const headers = computed(() => [
            { title: t('auditLog.columnDate'), key: 'created_at', width: '180px' },
            { title: t('auditLog.columnAction'), key: 'action', width: '160px' },
            { title: t('auditLog.columnActor'), key: 'actor_name', width: '140px' },
            { title: t('auditLog.columnComment'), key: 'comment' },
            { title: t('auditLog.columnVersion'), key: 'version_label', width: '100px' },
        ]);

        const availableActions = computed(() => {
            const actions = new Set(items.value.map(i => i.action));
            return Array.from(actions).sort();
        });

        const filteredItems = computed(() => {
            return items.value.filter(item => {
                if (filterActions.value.length > 0 && !filterActions.value.includes(item.action)) return false;
                if (filterActor.value && !(item.actor_name || '').toLowerCase().includes(filterActor.value.toLowerCase())) return false;
                if (filterDate.value) {
                    const itemDate = (item.created_at || '').substring(0, 10);
                    if (itemDate !== filterDate.value) return false;
                }
                return true;
            });
        });

        const loadData = async () => {
            if (!props.procDefId) return;
            try {
                items.value = await backend.getApprovalHistory(props.procDefId);
            } catch (e) {
                console.error('Audit log load error:', e);
            }
        };

        const getActionColor = (action: string): string => {
            const colors: Record<string, string> = {
                submit: 'primary',
                approve_hq: 'blue',
                approve_field: 'green',
                reject_hq: 'error',
                reject_field: 'error',
                start_public_feedback: 'info',
                auto_transition_final_edit: 'purple',
                publish: 'success',
                reject: 'error',
                reopen: 'warning',
                request_reopen: 'orange',
                approve_reopen: 'success',
                reject_reopen: 'error',
                reset_approvals: 'warning',
            };
            return colors[action] || 'grey';
        };

        const formatDateTime = (dateStr: string): string => {
            if (!dateStr) return '';
            try {
                const d = new Date(dateStr);
                return d.toLocaleString();
            } catch {
                return dateStr;
            }
        };

        const close = () => {
            dialogVisible.value = false;
        };

        const exportCsv = () => {
            const rows = filteredItems.value.map(item => [
                item.created_at || '',
                item.action || '',
                item.actor_name || '',
                (item.comment || '').replace(/"/g, '""'),
                item.version_label || ''
            ]);
            const header = ['Date', 'Action', 'Actor', 'Comment', 'Version'];
            const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-log-${props.procDefId}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        };

        watch(() => props.modelValue, (val) => {
            if (val) loadData();
        });

        return {
            dialogVisible, items, filterActions, filterActor, filterDate,
            headers, availableActions, filteredItems,
            getActionColor, formatDateTime, close, exportCsv,
        };
    }
});
</script>

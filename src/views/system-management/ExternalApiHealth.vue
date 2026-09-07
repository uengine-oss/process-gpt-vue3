<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">외부 API 연동 상태</h1>
                </div>
            </div>
        </div>

        <v-card-text class="pa-4 sk-page-card-text">
            <v-data-table
                :headers="headers"
                :items="items"
                v-model:expanded="expanded"
                density="compact"
                hover
                show-expand
                item-value="key"
                class="sk-data-table"
                :items-per-page="-1"
                :loading="loading"
                no-data-text="등록된 외부 API 헬스체크 데이터가 없습니다."
            >
                <template v-slot:[`item.label`]="{ item }">
                    <span class="label-cell-text">{{ item.label }}</span>
                </template>
                <template v-slot:[`item.callAddress`]="{ item }">
                    <span class="cell-id call-address-text">{{ item.callAddress }}</span>
                </template>
                <template v-slot:[`item.status`]="{ item }">
                    <div class="status-chip-cell">
                        <v-chip size="small" variant="tonal" :color="item.status === '정상' ? 'success' : 'error'">
                            {{ item.status }}
                        </v-chip>
                    </div>
                </template>
                <template v-slot:[`item.lastCheckTime`]="{ item }">
                    <span class="cell-date last-check-time-text">{{ item.lastCheckTime }}</span>
                </template>
                <template v-slot:[`item.manualSync`]="{ item }">
                    <div class="manual-sync-cell">
                        <v-tooltip text="수동 동기화" location="top">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-refresh"
                                    color="primary"
                                    variant="text"
                                    size="x-small"
                                    density="compact"
                                    :disabled="syncingStateByItemKey[item.key] === true"
                                    @click.stop="handleManualSync(item)"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                </template>
                <template v-slot:[`item.data-table-expand`]="{ internalItem, isExpanded, toggleExpand }">
                    <div class="expand-toggle-cell">
                        <v-tooltip text="오류 메시지 로그" location="top">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon
                                    variant="text"
                                    density="compact"
                                    size="x-small"
                                    class="expand-toggle-button"
                                    @click.stop="toggleExpand(internalItem)"
                                >
                                    <v-icon size="16">
                                        {{ isExpanded(internalItem) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                                    </v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </div>
                </template>
                <template #expanded-row="{ columns, item }">
                    <tr class="expanded-detail-row">
                        <td :colspan="columns.length" class="expanded-detail-cell">
                            <div class="expanded-body">
                                <div class="health-log-title">오류 메시지 로그</div>
                                <pre class="health-log-content">{{ item.errorMessageLog }}</pre>
                            </div>
                        </td>
                    </tr>
                </template>
            </v-data-table>
        </v-card-text>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { formatKST } from '@/utils/datetime';

export default defineComponent({
    name: 'ExternalApiHealth',
    setup() {
        type ExternalApiHealthItem = {
            key: string;
            label: string;
            callAddress: string;
            status: string;
            lastCheckTime: string;
            errorMessageLog: string;
        };

        type ExternalApiHealthRow = {
            id: string;
            integration_target_name?: string | null;
            call_address?: string | null;
            health_status?: string | null;
            last_check_time?: string | null;
            error_message_log?: string | null;
        };

        const headers = [
            { title: '연동 대상', key: 'label', align: 'start' as const, sortable: false, width: 200 },
            { title: '호출주소', key: 'callAddress', align: 'start' as const, sortable: false, width: 260 },
            { title: '상태', key: 'status', align: 'center' as const, sortable: false, width: 120 },
            { title: '마지막 점검 시간', key: 'lastCheckTime', align: 'center' as const, sortable: false, width: 180 },
            { title: '수동 동기화', key: 'manualSync', align: 'center' as const, sortable: false, width: 120 },
            { title: '', key: 'data-table-expand', align: 'center' as const, width: 56 }
        ];

        const items = ref<ExternalApiHealthItem[]>([]);
        const loading = ref(false);
        const expanded = ref<string[]>([]);
        const syncingStateByItemKey = ref<Record<string, boolean>>({});

        const formatCheckTime = (value?: string | null) => {
            if (!value) {
                return '-';
            }
            return formatKST(value, 'YYYY-MM-DD HH:mm:ss', value);
        };

        const loadExternalApiHealthItems = async () => {
            loading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const rows = await backend.getExternalApiHealthList();
                const mappedItems = (Array.isArray(rows) ? rows : []).map((row: ExternalApiHealthRow) => ({
                    key: row.id,
                    label: row.integration_target_name || '-',
                    callAddress: row.call_address || '-',
                    status: row.health_status === '정상' ? '정상' : '비정상',
                    lastCheckTime: formatCheckTime(row.last_check_time),
                    errorMessageLog: row.error_message_log || '오류 메시지 로그가 없습니다.'
                }));
                items.value = mappedItems;
            } finally {
                loading.value = false;
            }
        };

        const handleManualSync = async (selectedExternalApiHealthItem: ExternalApiHealthItem) => {
            if (!selectedExternalApiHealthItem.key) {
                return;
            }
            syncingStateByItemKey.value = {
                ...syncingStateByItemKey.value,
                [selectedExternalApiHealthItem.key]: true
            };
            try {
                const backend = BackendFactory.createBackend();
                await backend.requestExternalApiManualSync(selectedExternalApiHealthItem.key);
                await loadExternalApiHealthItems();
            } finally {
                syncingStateByItemKey.value = {
                    ...syncingStateByItemKey.value,
                    [selectedExternalApiHealthItem.key]: false
                };
            }
        };

        onMounted(async () => {
            await loadExternalApiHealthItems();
        });

        return { headers, items, loading, expanded, syncingStateByItemKey, handleManualSync };
    }
});
</script>

<style scoped>
/* 펼침 행 — 정준 사례 AuditTrail.vue 와 동일 톤 */
.expanded-detail-row .expanded-detail-cell {
    padding: 0 !important;
}

.expanded-body {
    padding: 14px 24px;
    font-size: 12px;
    color: #374151;
}

.health-log-title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
}

.health-log-content {
    margin: 0;
    height: 150px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.5;
    color: #1f2937;
    white-space: pre-wrap;
    resize: vertical;
    overflow: auto;
}

.expand-toggle-button {
    min-width: 24px !important;
    width: 24px !important;
    height: 24px !important;
}

.label-cell-text {
    display: inline-block;
}

.status-chip-cell,
.manual-sync-cell,
.expand-toggle-cell {
    display: flex;
    align-items: center;
    justify-content: center;
}

.last-check-time-text {
    white-space: nowrap;
}

.call-address-text {
    white-space: nowrap;
}
</style>

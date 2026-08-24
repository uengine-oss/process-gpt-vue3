<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">휴지통</h1>
                </div>
            </div>
            <div class="page-header-right">
                <v-btn
                    v-if="selectedIds.length > 0"
                    variant="outlined"
                    size="small"
                    color="primary"
                    prepend-icon="mdi-restore"
                    :disabled="store.loading"
                    @click="handleBulkRestore"
                >
                    일괄 복원 ({{ selectedIds.length }})
                </v-btn>
                <v-btn
                    v-if="selectedIds.length > 0"
                    variant="flat"
                    size="small"
                    color="error"
                    prepend-icon="mdi-delete-forever"
                    :disabled="store.loading"
                    @click="openBulkDeleteDialog"
                >
                    일괄 삭제 ({{ selectedIds.length }})
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">
            <!-- Toolbar: Search + Filter Tabs -->
            <div class="toolbar">
                <div class="search-wrapper">
                    <v-icon class="search-icon" size="18">mdi-magnify</v-icon>
                    <input v-model="searchQuery" class="search-input" placeholder="항목 이름 검색" type="text" />
                </div>
                <div class="filter-pills">
                    <button
                        v-for="f in filterOptions"
                        :key="f.value"
                        class="pill"
                        :class="{ active: activeFilter === f.value }"
                        @click="setFilter(f.value)"
                    >
                        {{ getFilterLabel(f.value) }}
                    </button>
                </div>
            </div>

            <!-- Table -->
            <v-data-table
                v-model="selectedIds"
                :headers="tableHeaders"
                :items="filteredItems"
                :loading="store.loading"
                item-value="uid"
                show-select
                density="compact"
                hover
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                no-data-text="삭제된 항목이 없습니다."
                class="sk-data-table"
            >
                <template v-slot:[`item.name`]="{ item }">
                    <span class="item-name">{{ item.name }}</span>
                </template>
                <template v-slot:[`item.location`]="{ item }">
                    <span v-if="item.deleted_from"> {{ item.deleted_from.mega_name }} &rsaquo; {{ item.deleted_from.major_name }} </span>
                    <span v-else-if="item.type === 'schema' && item.schema_applies_to">
                        {{ formatAppliesTo(item.schema_applies_to) }}
                    </span>
                    <span v-else-if="item.type === 'kpiTarget' && item.kpi_location">{{ item.kpi_location }}</span>
                    <span v-else-if="item.type === 'process'" class="cell-muted">계층도 미등록 프로세스</span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.type`]="{ item }">
                    <span class="type-badge" :class="getTypeBadgeClass(item.type)">
                        {{ getTypeLabel(item.type) }}
                    </span>
                </template>
                <template v-slot:[`item.deleted_by`]="{ item }">
                    <div v-if="item.deleted_by" class="cell-deleted-by">
                        <span>{{ deletedByName(item.deleted_by) }}</span>
                        <span v-if="deletedByTeam(item.deleted_by)" class="cell-deleted-by-team"
                            >({{ deletedByTeam(item.deleted_by) }})</span
                        >
                    </div>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.deleted_at`]="{ item }">
                    <span class="cell-date">{{ formatDate(item.deleted_at) }}</span>
                </template>
                <template v-slot:[`item.remaining_days`]="{ item }">
                    <span class="days-badge" :class="getDaysBadgeClass(item.remaining_days)"> {{ item.remaining_days }}일 </span>
                </template>
                <template v-slot:[`item.actions`]="{ item }">
                    <v-tooltip text="복원" location="top">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-restore"
                                size="x-small"
                                variant="text"
                                color="primary"
                                :disabled="store.loading"
                                @click="handleRestore(item)"
                            />
                        </template>
                    </v-tooltip>
                    <v-tooltip text="영구 삭제" location="top">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-delete-forever-outline"
                                size="x-small"
                                variant="text"
                                color="error"
                                :disabled="store.loading"
                                @click="openDeleteDialog(item)"
                            />
                        </template>
                    </v-tooltip>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Permanent Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="480" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#ef4444" size="24">mdi-alert-circle-outline</v-icon>
                    <span class="dialog-title">{{ $t('adminConsole.recycleBin.confirmDelete') }}</span>
                    <button class="dialog-close" @click="closeDeleteDialog">
                        <v-icon size="20">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-body">
                    <p class="dialog-desc">{{ $t('adminConsole.recycleBin.confirmDeleteDesc') }}</p>
                    <div v-if="!deleteDialog.isBulk" class="target-info">
                        <strong>{{ deleteDialog.targetName }}</strong>
                    </div>
                    <div v-else class="target-info">
                        <strong>{{ selectedIds.length }}개 항목</strong>
                    </div>
                    <div class="confirm-input-wrapper">
                        <label class="confirm-label">{{ $t('adminConsole.recycleBin.typeDelete') }}</label>
                        <input
                            v-model="deleteConfirmText"
                            class="confirm-input"
                            type="text"
                            placeholder="DELETE"
                            @keydown.enter="submitDelete"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="closeDeleteDialog">취소</button>
                    <button
                        class="btn btn-danger"
                        :disabled="deleteConfirmText !== 'DELETE' || store.loading"
                        @click="submitDelete"
                    >
                        <v-progress-circular v-if="store.loading" indeterminate size="14" width="2" color="white" />
                        <span v-else>{{ $t('adminConsole.recycleBin.permanentDelete') }}</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import {
    loadDeletedPiFlagTypes,
    restorePiFlagType,
    hardDeletePiFlagType,
    PI_FLAG_TYPES_CHANGE_EVENT
} from '@/utils/piFlagTypes';

interface DisplayItem {
    uid: string;
    name: string;
    type: 'process' | 'instance' | 'schema' | 'piFlagType' | 'auditPolicy' | 'kpiTarget' | 'laneRoleGroup' | 'supplier' | 'system';
    deleted_by: string;
    deleted_at: string;
    remaining_days: number;
    raw_id: string;
    deleted_from?: { mega_name?: string; major_name?: string } | null;
    schema_applies_to?: string;
    // KPI 목표 휴지통 항목의 "원래 위치" — 본부(parent.name) / 팀(org_name) 결합 표시
    kpi_location?: string;
}

interface PiFlagTypeItem {
    code: string;
    label: string;
    description: string;
    sortOrder: number;
    active: boolean;
    deletedAt: string | null;
    deletedBy: string | null;
}

interface DeleteDialogState {
    visible: boolean;
    isBulk: boolean;
    targetId: string;
    targetName: string;
    targetType: 'process' | 'instance' | 'schema' | 'piFlagType' | 'auditPolicy' | 'kpiTarget' | 'laneRoleGroup' | 'supplier' | 'system';
}

const PI_FLAG_TYPE_RETENTION_DAYS = 30;

function piFlagTypeRemainingDays(deletedAt: string): number {
    if (!deletedAt) return PI_FLAG_TYPE_RETENTION_DAYS;
    const ts = new Date(deletedAt).getTime();
    if (Number.isNaN(ts)) return PI_FLAG_TYPE_RETENTION_DAYS;
    const elapsedDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(PI_FLAG_TYPE_RETENTION_DAYS - elapsedDays));
}

export default defineComponent({
    name: 'RecycleBin',

    setup() {
        const store = useAdminConsoleStore();

        const searchQuery = ref('');
        const activeFilter = ref<'all' | 'process' | 'instance' | 'schema' | 'piFlagType' | 'auditPolicy' | 'kpiTarget' | 'laneRoleGroup' | 'supplier' | 'system'>('all');
        const selectedIds = ref<string[]>([]);
        const deleteConfirmText = ref('');
        const deletedPiFlagTypesLocal = ref<PiFlagTypeItem[]>([]);

        async function resolveEmailsToUsernames(emails: string[]): Promise<Record<string, string>> {
            const map: Record<string, string> = {};
            const targets = [...new Set(emails.filter((e) => e && e.includes('@')))];
            if (targets.length === 0) return map;
            try {
                const supabase = (window as any).$supabase;
                const tenantId = (window as any).$tenantName;
                if (!supabase || !tenantId) return map;
                const { data } = await supabase.from('users').select('email, username').eq('tenant_id', tenantId).in('email', targets);
                (data || []).forEach((u: { email: string; username: string }) => {
                    if (u?.email && u?.username) map[u.email] = u.username;
                });
            } catch (err) {
                console.warn('[RecycleBin] resolveEmailsToUsernames failed', err);
            }
            return map;
        }

        const refreshDeletedPiFlagTypes = async () => {
            const items = (await loadDeletedPiFlagTypes()) as PiFlagTypeItem[];
            deletedPiFlagTypesLocal.value = items;
            const emailToName = await resolveEmailsToUsernames(items.map((i) => (i.deletedBy || '').trim()));
            if (Object.keys(emailToName).length === 0) return;
            deletedPiFlagTypesLocal.value = items.map((i) => {
                const key = (i.deletedBy || '').trim();
                return emailToName[key] ? { ...i, deletedBy: emailToName[key] } : i;
            });
        };

        const deleteDialog = ref<DeleteDialogState>({
            visible: false,
            isBulk: false,
            targetId: '',
            targetName: '',
            targetType: 'process'
        });

        type FilterValue = 'all' | 'process' | 'instance' | 'schema' | 'piFlagType' | 'auditPolicy' | 'kpiTarget' | 'laneRoleGroup' | 'supplier' | 'system';
        const filterOptions: { value: FilterValue; label: string }[] = [
            { value: 'all', label: '전체' },
            { value: 'process', label: '프로세스' },
            { value: 'schema', label: '속성 스키마' },
            { value: 'piFlagType', label: 'PI Flag 유형' },
            { value: 'auditPolicy', label: '정책문서' },
            { value: 'kpiTarget', label: 'KPI 목표' },
            { value: 'laneRoleGroup', label: '역할 그룹' },
            { value: 'supplier', label: '외부협력사' },
            { value: 'system', label: '시스템' }
        ];

        const tableHeaders = [
            { key: 'name', title: '항목 이름', sortable: false },
            { key: 'location', title: '원래 위치', sortable: false },
            { key: 'type', title: '유형', sortable: false, width: 110 },
            { key: 'deleted_by', title: '삭제한 사용자', sortable: false, width: 130, align: 'center' as const },
            { key: 'deleted_at', title: '삭제일', sortable: false, width: 90 },
            { key: 'remaining_days', title: '남은 일수', sortable: false, width: 100, align: 'center' as const },
            { key: 'actions', title: '액션', sortable: false, width: 220, align: 'end' as const }
        ];

        const APPLIES_TO_LABEL_MAP: Record<string, string> = {
            both: '프로세스 + Task',
            process: '프로세스만',
            task: '모든 Task',
            'bpmn:ManualTask': '수동 작업',
            'bpmn:ServiceTask': '서비스 작업',
            'bpmn:UserTask': '사용자 작업',
            'bpmn:ScriptTask': '스크립트 작업',
            'bpmn:BusinessRuleTask': '비즈니스 규칙 작업',
            'bpmn:SendTask': '전송 작업',
            'bpmn:ReceiveTask': '수신 작업'
        };

        function formatAppliesTo(appliesTo: string): string {
            return APPLIES_TO_LABEL_MAP[appliesTo] || appliesTo;
        }

        function deletedByName(value: string): string {
            if (!value) return '';
            const idx = value.indexOf('\n');
            return idx === -1 ? value : value.slice(0, idx);
        }

        function deletedByTeam(value: string): string {
            if (!value) return '';
            const idx = value.indexOf('\n');
            if (idx === -1) return '';
            const second = value.slice(idx + 1).trim();
            return second.replace(/^\(/, '').replace(/\)$/, '');
        }

        function piFlagTypeAuditValue(item: PiFlagTypeItem | undefined | null) {
            if (!item) return null;
            return {
                code: item.code,
                label: item.label,
                description: item.description || '',
                sort_order: Number(item.sortOrder ?? 0),
                active: item.active !== false,
                deleted_at: item.deletedAt || null,
                deleted_by: item.deletedBy || null
            };
        }

        function getTypeLabel(type: DisplayItem['type']): string {
            if (type === 'process') return '프로세스';
            if (type === 'instance') return '인스턴스';
            if (type === 'schema') return '속성 스키마';
            if (type === 'piFlagType') return 'PI Flag 유형';
            if (type === 'auditPolicy') return '정책문서';
            if (type === 'kpiTarget') return 'KPI 목표';
            if (type === 'laneRoleGroup') return '역할 그룹';
            if (type === 'supplier') return '외부협력사';
            if (type === 'system') return '시스템';
            return type;
        }

        function getFilterLabel(value: string): string {
            if (value === 'all') return '전체';
            if (value === 'process') return '프로세스';
            if (value === 'schema') return '속성 스키마';
            if (value === 'piFlagType') return 'PI Flag 유형';
            if (value === 'auditPolicy') return '정책문서';
            if (value === 'kpiTarget') return 'KPI 목표';
            if (value === 'laneRoleGroup') return '역할 그룹';
            if (value === 'supplier') return '외부협력사';
            if (value === 'system') return '시스템';
            return value;
        }

        function getTypeBadgeClass(type: DisplayItem['type']): string {
            if (type === 'process') return 'type-process';
            if (type === 'instance') return 'type-instance';
            if (type === 'schema') return 'type-schema';
            if (type === 'piFlagType') return 'type-piflag';
            if (type === 'auditPolicy') return 'type-policy';
            if (type === 'kpiTarget') return 'type-kpi';
            if (type === 'laneRoleGroup') return 'type-rolegroup';
            if (type === 'supplier') return 'type-supplier';
            if (type === 'system') return 'type-system';
            return '';
        }

        // Merge processes and instances into unified display items
        const allItems = computed<DisplayItem[]>(() => {
            const processes = (store.deletedProcesses || []).map(p => ({
                uid: `process::${p.id}`,
                name: p.name || p.id,
                type: 'process' as const,
                deleted_by: p.deleted_by || '',
                deleted_at: p.deleted_at,
                remaining_days: p.remaining_days,
                raw_id: p.id,
                deleted_from: p.deleted_from || null
            }));

            const instances = (store.deletedInstances || []).map(i => ({
                uid: `instance::${i.proc_inst_id}`,
                name: i.name || i.proc_inst_id,
                type: 'instance' as const,
                deleted_by: '',
                deleted_at: i.deleted_at,
                remaining_days: i.remaining_days,
                raw_id: i.proc_inst_id
            }));

            const schemas = (store.deletedSchemas || []).map(s => ({
                uid: `schema::${s.id}`,
                name: s.property_label || s.property_key || s.id,
                type: 'schema' as const,
                deleted_by: s.deleted_by || '',
                deleted_at: s.deleted_at,
                remaining_days: s.remaining_days,
                raw_id: s.id,
                schema_applies_to: s.applies_to
            }));

            const piFlagTypes = (deletedPiFlagTypesLocal.value || []).map((t) => ({
                uid: `piFlagType::${t.code}`,
                name: t.label || t.code,
                type: 'piFlagType' as const,
                deleted_by: t.deletedBy || '',
                deleted_at: t.deletedAt || '',
                remaining_days: piFlagTypeRemainingDays(t.deletedAt || ''),
                raw_id: t.code
            }));

            const auditPolicies = (((store as any).deletedAuditPolicies || []) as any[]).map((p: any) => ({
                uid: `auditPolicy::${p.id}`,
                name: p.name,
                type: 'auditPolicy' as const,
                deleted_by: p.deleted_by || '',
                deleted_at: p.deleted_at,
                remaining_days: p.remaining_days,
                raw_id: p.id
            }));

            const kpiTargets = (((store as any).deletedKpiTargets || []) as any[]).map((k: any) => {
                const division = k.parent?.name || '';
                const team = k.org_name || '';
                const location = division && team ? `${division} / ${team}` : team || division;
                return {
                    uid: `kpiTarget::${k.id}`,
                    name: `${k.year} · ${team || k.org_id}`,
                    type: 'kpiTarget' as const,
                    deleted_by: k.deleted_by || '',
                    deleted_at: k.deleted_at,
                    remaining_days: k.remaining_days,
                    raw_id: k.id,
                    kpi_location: location
                };
            });

            const laneRoleGroups = (((store as any).deletedLaneRoleGroups || []) as any[]).map((g: any) => ({
                uid: `laneRoleGroup::${g.id}`,
                name: g.name || g.id,
                type: 'laneRoleGroup' as const,
                deleted_by: g.deleted_by || '',
                deleted_at: g.deleted_at,
                remaining_days: g.deleted_at
                    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(g.deleted_at).getTime()) / 86400000))
                    : 30,
                raw_id: g.id
            }));

            const suppliers = (((store as any).deletedSuppliers || []) as any[]).map((s: any) => ({
                uid: `supplier::${s.id}`,
                name: s.name || s.id,
                type: 'supplier' as const,
                deleted_by: s.deleted_by || '',
                deleted_at: s.deleted_at,
                remaining_days: s.remaining_days,
                raw_id: s.id
            }));

            const systems = (((store as any).deletedSystems || []) as any[]).map((system: any) => ({
                uid: `system::${system.id}`,
                name: system.name || system.id,
                type: 'system' as const,
                deleted_by: system.deleted_by || '',
                deleted_at: system.deleted_at,
                remaining_days: system.remaining_days,
                raw_id: system.id
            }));

            const merged = [
                ...processes,
                ...instances,
                ...schemas,
                ...piFlagTypes,
                ...auditPolicies,
                ...kpiTargets,
                ...laneRoleGroups,
                ...suppliers,
                ...systems
            ];
            merged.sort((a, b) => {
                const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
                const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
                return tb - ta;
            });
            return merged;
        });

        const filteredItems = computed<DisplayItem[]>(() => {
            let items = allItems.value;

            if (activeFilter.value === 'process') {
                items = items.filter(i => i.type === 'process');
            } else if (activeFilter.value === 'instance') {
                items = items.filter(i => i.type === 'instance');
            } else if (activeFilter.value === 'schema') {
                items = items.filter(i => i.type === 'schema');
            } else if (activeFilter.value === 'piFlagType') {
                items = items.filter(i => i.type === 'piFlagType');
            } else if (activeFilter.value === 'auditPolicy') {
                items = items.filter(i => i.type === 'auditPolicy');
            } else if (activeFilter.value === 'kpiTarget') {
                items = items.filter(i => i.type === 'kpiTarget');
            } else if (activeFilter.value === 'laneRoleGroup') {
                items = items.filter(i => i.type === 'laneRoleGroup');
            } else if (activeFilter.value === 'supplier') {
                items = items.filter(i => i.type === 'supplier');
            } else if (activeFilter.value === 'system') {
                items = items.filter(i => i.type === 'system');
            }

            const q = searchQuery.value.trim().toLowerCase();
            if (q) {
                items = items.filter(i => i.name.toLowerCase().includes(q));
            }

            return items;
        });

        function setFilter(val: 'all' | 'process' | 'instance' | 'schema' | 'piFlagType' | 'auditPolicy' | 'kpiTarget' | 'laneRoleGroup' | 'supplier' | 'system') {
            activeFilter.value = val;
            selectedIds.value = [];
        }

        function formatDate(dateStr: string): string {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
            } catch {
                return dateStr;
            }
        }

        function getDaysBadgeClass(days: number): string {
            if (days <= 5) return 'days-critical';
            if (days <= 10) return 'days-warning';
            return 'days-normal';
        }

        async function hardDeleteItem(item: DisplayItem) {
            if (item.type === 'process') {
                await store.hardDeleteProcess(item.raw_id);
            } else if (item.type === 'instance') {
                await store.hardDeleteInstance(item.raw_id);
            } else if (item.type === 'schema') {
                await store.hardDeleteSchema(item.raw_id);
            } else if (item.type === 'piFlagType') {
                const matched = deletedPiFlagTypesLocal.value.find((t) => t.code === item.raw_id);
                const deleted = await hardDeletePiFlagType(item.raw_id);
                if (!deleted) throw new Error('영구 삭제할 PI Flag 유형을 찾지 못했습니다.');
                await store.writeAdminAuditLog({
                    action: 'pi_flag_type_hard_delete',
                    target_type: 'pi_flag_type',
                    target_id: item.raw_id,
                    target_name: matched?.label || item.name || item.raw_id,
                    before_value: piFlagTypeAuditValue(matched),
                    comment: '휴지통에서 영구 삭제'
                });
            } else if (item.type === 'auditPolicy') {
                await (store as any).hardDeleteAuditPolicy(item.raw_id);
            } else if (item.type === 'kpiTarget') {
                await (store as any).hardDeleteKpiTarget(item.raw_id);
            } else if (item.type === 'laneRoleGroup') {
                await (store as any).hardDeleteLaneRoleGroup(item.raw_id);
            } else if (item.type === 'supplier') {
                await (store as any).hardDeleteSupplier(item.raw_id);
            } else if (item.type === 'system') {
                await (store as any).hardDeleteSystem(item.raw_id);
            }
        }

        async function handleRestore(item: DisplayItem) {
            try {
                if (item.type === 'process') {
                    await store.restoreProcess(item.raw_id);
                } else if (item.type === 'instance') {
                    await store.restoreInstance(item.raw_id);
                } else if (item.type === 'schema') {
                    await store.restoreSchema(item.raw_id);
                } else if (item.type === 'piFlagType') {
                    await restorePiFlagType(item.raw_id);
                    await refreshDeletedPiFlagTypes();
                } else if (item.type === 'auditPolicy') {
                    await (store as any).restoreAuditPolicy(item.raw_id);
                } else if (item.type === 'kpiTarget') {
                    await (store as any).restoreKpiTarget(item.raw_id);
                } else if (item.type === 'laneRoleGroup') {
                    await (store as any).restoreLaneRoleGroup(item.raw_id);
                } else if (item.type === 'supplier') {
                    await (store as any).restoreSupplier(item.raw_id);
                } else if (item.type === 'system') {
                    await (store as any).restoreSystem(item.raw_id);
                }
                selectedIds.value = selectedIds.value.filter(id => id !== item.uid);
            } catch (e) {
                console.error('Restore failed:', e);
            }
        }

        async function handleBulkRestore() {
            const toRestore = filteredItems.value.filter(i => selectedIds.value.includes(i.uid));
            for (const item of toRestore) {
                try {
                    if (item.type === 'process') {
                        await store.restoreProcess(item.raw_id);
                    } else if (item.type === 'instance') {
                        await store.restoreInstance(item.raw_id);
                    } else if (item.type === 'schema') {
                        await store.restoreSchema(item.raw_id);
                    } else if (item.type === 'piFlagType') {
                        await restorePiFlagType(item.raw_id);
                    } else if (item.type === 'auditPolicy') {
                        await (store as any).restoreAuditPolicy(item.raw_id);
                    } else if (item.type === 'kpiTarget') {
                        await (store as any).restoreKpiTarget(item.raw_id);
                    } else if (item.type === 'laneRoleGroup') {
                        await (store as any).restoreLaneRoleGroup(item.raw_id);
                    } else if (item.type === 'supplier') {
                        await (store as any).restoreSupplier(item.raw_id);
                    } else if (item.type === 'system') {
                        await (store as any).restoreSystem(item.raw_id);
                    }
                } catch (e) {
                    console.error('Bulk restore failed for', item.raw_id, e);
                }
            }
            refreshDeletedPiFlagTypes();
            selectedIds.value = [];
        }

        function openDeleteDialog(item: DisplayItem) {
            deleteDialog.value = {
                visible: true,
                isBulk: false,
                targetId: item.uid,
                targetName: item.name,
                targetType: item.type
            };
            deleteConfirmText.value = '';
        }

        function openBulkDeleteDialog() {
            deleteDialog.value = {
                visible: true,
                isBulk: true,
                targetId: '',
                targetName: '',
                targetType: 'process'
            };
            deleteConfirmText.value = '';
        }

        function closeDeleteDialog() {
            deleteDialog.value.visible = false;
            deleteConfirmText.value = '';
        }

        async function purgeExpiredItems() {
            const expiredItems = allItems.value.filter((item) => item.remaining_days <= 0);
            if (expiredItems.length === 0) return;

            for (const item of expiredItems) {
                try {
                    await hardDeleteItem(item);
                } catch (e) {
                    console.error('Expired item cleanup failed for', item.raw_id, e);
                }
            }

            await refreshDeletedPiFlagTypes();
            const expiredIds = new Set(expiredItems.map((item) => item.uid));
            selectedIds.value = selectedIds.value.filter((id) => !expiredIds.has(id));
        }

        async function submitDelete() {
            if (deleteConfirmText.value !== 'DELETE') return;

            if (deleteDialog.value.isBulk) {
                const toDelete = filteredItems.value.filter(i => selectedIds.value.includes(i.uid));
                for (const item of toDelete) {
                    try {
                        await hardDeleteItem(item);
                    } catch (e) {
                        console.error('Hard delete failed for', item.raw_id, e);
                    }
                }
                refreshDeletedPiFlagTypes();
                selectedIds.value = [];
            } else {
                const uid = deleteDialog.value.targetId;
                const item = allItems.value.find(i => i.uid === uid);
                if (item) {
                    try {
                        await hardDeleteItem(item);
                        if (item.type === 'piFlagType') {
                            refreshDeletedPiFlagTypes();
                        }
                        selectedIds.value = selectedIds.value.filter(id => id !== uid);
                    } catch (e) {
                        console.error('Hard delete failed:', e);
                    }
                }
            }

            closeDeleteDialog();
        }

        const piFlagTypesChangeHandler = () => refreshDeletedPiFlagTypes();

        onMounted(async () => {
            await refreshDeletedPiFlagTypes();
            window.addEventListener(PI_FLAG_TYPES_CHANGE_EVENT, piFlagTypesChangeHandler);
            await Promise.all([
                store.fetchDeletedProcesses(),
                store.fetchDeletedInstances(),
                store.fetchDeletedSchemas(),
                (store as any).fetchDeletedAuditPolicies(),
                // KPI 목표 휴지통 — fetchKpiTargets 가 활성/휴지통 모두 채움 (연도 인자 없으면 전체)
                store.fetchKpiTargets(),
                (store as any).fetchDeletedLaneRoleGroups(),
                (store as any).fetchDeletedSuppliers(),
                (store as any).fetchDeletedSystems()
            ]);
            await purgeExpiredItems();
        });

        onBeforeUnmount(() => {
            window.removeEventListener(PI_FLAG_TYPES_CHANGE_EVENT, piFlagTypesChangeHandler);
        });

        return {
            store,
            searchQuery,
            activeFilter,
            filterOptions,
            tableHeaders,
            selectedIds,
            deleteDialog,
            deleteConfirmText,
            filteredItems,
            setFilter,
            formatDate,
            getDaysBadgeClass,
            formatAppliesTo,
            deletedByName,
            deletedByTeam,
            getTypeLabel,
            getTypeBadgeClass,
            getFilterLabel,
            handleRestore,
            handleBulkRestore,
            openDeleteDialog,
            openBulkDeleteDialog,
            closeDeleteDialog,
            submitDelete
        };
    }
});
</script>

<style scoped>
.recycle-bin {
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

.cell-deleted-by {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.3;
}

.cell-deleted-by-team {
    font-size: 11px;
    color: #6b7280;
}

/* ── Header ─────────────────────────────────────────── */

.section-icon {
    color: #3b82f6;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
}

.header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 0px;
    flex-wrap: wrap;
}

.search-wrapper {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 320px;
}

.search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
}

.search-input {
    width: 100%;
    height: 34px;
    padding: 0 12px 0 34px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #111827;
    background: #ffffff;
    outline: none;
    transition: border-color 0.15s;
}

.search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.filter-pills {
    display: flex;
    gap: 6px;
}

.pill {
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
}

.pill:hover {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
}

.pill.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
}

/* ── Loading ─────────────────────────────────────────── */
.loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 48px;
}

/* ── Table ───────────────────────────────────────────── */
.table-wrapper {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.data-table thead tr {
    background: #f9fafb;
}

.data-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}

.data-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: middle;
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

.data-table tbody tr:hover td {
    background: #f9fafb;
}

.data-table tbody tr.selected td {
    background: #eff6ff;
}

/* Column widths */
.col-check {
    width: 40px;
    text-align: center;
}

.col-name {
    min-width: 200px;
}

.col-location {
    min-width: 160px;
}

.location-path {
    font-size: 12px;
    color: #6b7280;
}

.location-unknown {
    color: #d1d5db;
}

.col-type {
    width: 100px;
}

.col-by {
    width: 120px;
}

.col-date {
    width: 80px;
}

.col-days {
    width: 80px;
    text-align: center;
}

.col-actions {
    width: 180px;
    white-space: nowrap;
}

/* Checkbox */
.row-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
}

/* Item name */
.item-name {
    font-weight: 500;
    color: #111827;
}

/* Type badge */
.type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}

.type-process {
    background: #dbeafe;
    color: #1d4ed8;
}

.type-instance {
    background: #f3e8ff;
    color: #7c3aed;
}

.type-schema {
    background: #fef3c7;
    color: #b45309;
}

.type-piflag {
    background: #fee2e2;
    color: #b91c1c;
}

.type-policy {
    background: #ccfbf1;
    color: #0f766e;
}

.type-kpi {
    background: #e0e7ff;
    color: #4338ca;
}

.type-rolegroup {
    background: #f3e8ff;
    color: #6b21a8;
}

.type-supplier {
    background: #ffedd5;
    color: #c2410c;
}

.type-system {
    background: #dcfce7;
    color: #166534;
}

/* Days badge */
.days-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
}

.days-normal {
    background: #dcfce7;
    color: #166534;
}

.days-warning {
    background: #fef9c3;
    color: #854d0e;
}

.days-critical {
    background: #fee2e2;
    color: #991b1b;
}

/* Action buttons */
.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 10px;
    border-radius: 5px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-right: 6px;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.restore-btn {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
}

.restore-btn:hover:not(:disabled) {
    background: #dbeafe;
    border-color: #93c5fd;
}

.delete-btn {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #e11d48;
}

.delete-btn:hover:not(:disabled) {
    background: #ffe4e6;
    border-color: #fda4af;
}

/* Empty state */
.empty-cell {
    padding: 0 !important;
    border-bottom: none !important;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 56px 24px;
    gap: 12px;
    color: #9ca3af;
    font-size: 14px;
}

/* ── Buttons ─────────────────────────────────────────── */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-sm {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
}

.btn-outline {
    background: #ffffff;
    border-color: #d1d5db;
    color: #374151;
}

.btn-outline:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
}

.btn-danger {
    background: #ef4444;
    border-color: #ef4444;
    color: #ffffff;
}

.btn-danger:hover:not(:disabled) {
    background: #dc2626;
    border-color: #dc2626;
}

/* ── Confirm Dialog ──────────────────────────────────── */
.confirm-dialog {
    border-radius: 10px !important;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 20px 0;
}

.dialog-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
}

.dialog-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 4px;
}

.dialog-close:hover {
    background: #f3f4f6;
    color: #374151;
}

.dialog-body {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dialog-desc {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
}

.target-info {
    background: #f3f4f6;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    color: #374151;
}

.confirm-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.confirm-label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
}

.confirm-input {
    height: 36px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #111827;
    outline: none;
    font-family: monospace;
    letter-spacing: 0.08em;
    transition: border-color 0.15s;
}

.confirm-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 20px 20px;
}
</style>

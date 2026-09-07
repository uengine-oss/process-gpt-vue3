<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header (공통 page-header 패턴) -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">프로세스 리스트</h1>
                    <v-chip v-if="!loading && totalCount > 0" size="small" variant="tonal" color="grey"> 총 {{ totalCount }}건 </v-chip>
                </div>
                <p class="page-subtitle">전체 프로세스와 프로세스 모듈을 조회하고 관리합니다.</p>
            </div>
            <div class="page-header-right">
                <v-btn variant="outlined" size="small" prepend-icon="mdi-refresh" :disabled="loading" @click="loadData"> 새로고침 </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">
            <!-- Filter Bar -->
            <v-row dense align="center" class="pt-4 pb-4">
                <v-col cols="12" sm="auto" style="min-width: 320px">
                    <v-text-field
                        v-model="searchInput"
                        placeholder="프로세스명, ID, PI/현업 담당자"
                        prepend-inner-icon="mdi-magnify"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        @keydown.enter.prevent="applySearch"
                        @click:clear="resetSearch"
                    />
                </v-col>
                <v-col cols="auto">
                    <v-checkbox
                        v-model="showProcesses"
                        :label="`프로세스 (${processCount})`"
                        density="compact"
                        color="primary"
                        hide-details
                    />
                </v-col>
                <v-col cols="auto">
                    <v-checkbox
                        v-model="showModules"
                        :label="`모듈 (${moduleCount})`"
                        density="compact"
                        color="secondary"
                        hide-details
                    />
                </v-col>
                <v-spacer />
                <v-col cols="12" sm="auto" style="min-width: 200px">
                    <v-select
                        v-model="sortOption"
                        :items="sortOptions"
                        label="정렬"
                        prepend-inner-icon="mdi-sort"
                        density="compact"
                        variant="outlined"
                        hide-details
                    />
                </v-col>
            </v-row>

            <!-- Data Table -->
            <v-data-table
                v-model:sort-by="sortBy"
                :headers="headers"
                :items="filteredList"
                :loading="loading"
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                density="compact"
                hover
                no-data-text="표시할 프로세스가 없습니다."
                item-value="id"
                class="sk-data-table"
            >
                <template v-slot:[`item.kind`]="{ item }">
                    <v-chip size="x-small" variant="tonal" :color="item.kind === 'module' ? 'secondary' : 'primary'">
                        {{ item.kind === 'module' ? '모듈' : '프로세스' }}
                    </v-chip>
                </template>
                <template v-slot:[`item.id`]="{ item }">
                    <span class="cell-id">{{ item.id }}</span>
                </template>
                <template v-slot:[`item.name`]="{ item }">
                    <span class="cell-link" @click="navigateToProcess(item)">{{ item.name }}</span>
                </template>
                <template v-slot:[`item.description`]="{ item }">
                    <span v-if="item.description" class="cell-description" :title="item.description">{{ item.description }}</span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.pi_owner_name`]="{ item }">
                    <UserIdentityText :value="item.pi_owner" :display-map="identityDisplayMap" />
                </template>
                <template v-slot:[`item.field_owner_names`]="{ item }">
                    <UserIdentityText :value="item.field_owners" :display-map="identityDisplayMap" />
                </template>
                <template v-slot:[`item.saved_at`]="{ item }">
                    <span class="cell-date">{{ formatDateTime(item.saved_at) }}</span>
                </template>
                <template v-slot:[`item.actions`]="{ item }">
                    <ProcessHierarchyOpenButton :id="item.id" :name="item.name" />
                    <v-btn
                        icon="mdi-trash-can-outline"
                        size="x-small"
                        variant="text"
                        color="error"
                        title="삭제"
                        @click="openDeleteDialog(item)"
                    />
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Delete Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="440" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#ef4444" size="24">mdi-alert-circle-outline</v-icon>
                    <span class="dialog-title">프로세스 삭제</span>
                    <button class="dialog-close" @click="deleteDialog.visible = false">
                        <v-icon size="20">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-body">
                    <p class="dialog-desc">이 프로세스를 삭제하시겠습니까?</p>
                    <div class="target-info">
                        <strong>{{ deleteDialog.target?.name }}</strong>
                        <span class="ml-2 text-muted">({{ deleteDialog.target?.id }})</span>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="deleteDialog.visible = false">취소</button>
                    <button class="btn btn-danger" :disabled="deleting" @click="confirmDelete">
                        <v-progress-circular v-if="deleting" indeterminate size="14" width="2" color="white" />
                        <span v-else>삭제</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { SupabaseClient } from '@supabase/supabase-js';
import BackendFactory from '@/components/api/BackendFactory';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';
import ProcessHierarchyOpenButton from '@/views/process-hierarchy/ProcessHierarchyOpenButton.vue';
import UserIdentityText from '@/components/ui/common/UserIdentityText.vue';
import { formatIdentityName } from '@/utils/userIdentity';
import { isCallActivitySubModule } from '@/utils/processStages';
import { formatDateTimeKST } from '@/utils/datetime';

type ProcessKind = 'process' | 'module';

interface CallActivityItem {
    id: string;
    name: string;
    kind: ProcessKind;
    description: string;
    pi_owner: string | null;
    pi_owner_name: string;
    field_owners: string[];
    field_owner_names: string;
    owner_search_text: string;
    saved_at: string | null;
}

interface ProcessOwnerMeta {
    primaryOwner?: unknown;
    fieldOwners?: unknown;
}

interface ProcDefRow {
    id: string;
    name?: string | null;
    type?: string | null;
    description?: unknown;
    owner?: unknown;
    definition?: {
        type?: unknown;
        description?: unknown;
        shortDescription?: unknown;
        meta?: {
            owners?: ProcessOwnerMeta;
        };
    } | null;
    saved_at?: string | null;
}

export default defineComponent({
    name: 'CallActivityManagement',
    components: { ProcessHierarchyOpenButton, UserIdentityText },
    setup() {
        const router = useRouter();
        const runtimeWindow = window as Window & { $supabase?: SupabaseClient; $tenantName?: string };
        const supabase = runtimeWindow.$supabase;
        const tenantId = runtimeWindow.$tenantName;
        const backend = BackendFactory.createBackend();

        const loading = ref(false);
        const deleting = ref(false);
        const items = ref<CallActivityItem[]>([]);
        const totalCount = ref(0);
        const searchInput = ref('');
        const searchQuery = ref('');
        const showProcesses = ref(true);
        const showModules = ref(true);
        const identityDisplayMap = ref<Record<string, string>>({});

        const deleteDialog = ref<{ visible: boolean; target: CallActivityItem | null }>({
            visible: false,
            target: null
        });

        const headers = computed(() => [
            { title: '구분', key: 'kind', align: 'start' as const, width: 100 },
            { title: 'ID', key: 'id', align: 'start' as const, width: 220 },
            { title: '프로세스명', key: 'name', align: 'start' as const, width: 240 },
            { title: '설명', key: 'description', align: 'start' as const, width: 300 },
            { title: 'PI팀담당자', key: 'pi_owner_name', align: 'start' as const, width: 160 },
            { title: '현업담당자', key: 'field_owner_names', align: 'start' as const, width: 220 },
            { title: '최종저장', key: 'saved_at', align: 'start' as const, width: 180 },
            { title: '', key: 'actions', align: 'end' as const, sortable: false, width: 120 }
        ]);

        const processCount = computed(() => items.value.filter((item) => item.kind === 'process').length);
        const moduleCount = computed(() => items.value.filter((item) => item.kind === 'module').length);

        // 정렬 — 셀렉트와 테이블 컬럼 클릭 양쪽에서 sortBy 를 공유
        const sortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'saved_at', order: 'desc' }]);
        const SORT_OPTION_DEFS = [
            { value: 'saved_desc', title: '최종저장 최신순', key: 'saved_at', order: 'desc' as const },
            { value: 'saved_asc', title: '최종저장 오래된순', key: 'saved_at', order: 'asc' as const },
            { value: 'name_asc', title: '프로세스명 (가나다순)', key: 'name', order: 'asc' as const },
            { value: 'id_asc', title: 'ID (오름차순)', key: 'id', order: 'asc' as const },
            { value: 'kind_asc', title: '구분 (모듈 우선)', key: 'kind', order: 'asc' as const }
        ];
        const sortOptions = SORT_OPTION_DEFS.map(({ value, title }) => ({ value, title }));
        const sortOption = computed<string | null>({
            get: () => {
                const cur = sortBy.value?.[0];
                if (!cur) return null;
                return SORT_OPTION_DEFS.find((o) => o.key === cur.key && o.order === cur.order)?.value ?? null;
            },
            set: (value) => {
                const opt = SORT_OPTION_DEFS.find((o) => o.value === value);
                if (opt) sortBy.value = [{ key: opt.key, order: opt.order }];
            }
        });

        const filteredList = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();

            return items.value.filter((item) => {
                if (item.kind === 'process' && !showProcesses.value) return false;
                if (item.kind === 'module' && !showModules.value) return false;
                if (!q) return true;
                return (
                    item.name.toLowerCase().includes(q) ||
                    item.id.toLowerCase().includes(q) ||
                    item.owner_search_text.toLowerCase().includes(q)
                );
            });
        });

        function formatDateTime(iso?: string | null) {
            if (!iso) return '-';
            return formatDateTimeKST(iso, iso);
        }

        function applySearch() {
            searchQuery.value = searchInput.value.trim();
        }

        function resetSearch() {
            searchInput.value = '';
            searchQuery.value = '';
        }

        function normalizeOwnerList(value: unknown): string[] {
            if (Array.isArray(value)) {
                return value.map((v) => String(v || '').trim()).filter(Boolean);
            }
            if (typeof value === 'string') {
                return value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean);
            }
            return [];
        }

        function normalizeSingleOwner(...values: unknown[]): string | null {
            for (const value of values) {
                const owner = normalizeOwnerList(value)[0] || String(value || '').trim();
                if (owner) return owner;
            }
            return null;
        }

        function getMetaOwners(row: ProcDefRow): ProcessOwnerMeta {
            return row?.definition?.meta?.owners || {};
        }

        function normalizeDescription(row: ProcDefRow) {
            const value = row?.description ?? row?.definition?.description ?? row?.definition?.shortDescription ?? '';
            if (typeof value === 'string') return value.trim();
            if (value && typeof value === 'object') {
                const record = value as Record<string, unknown>;
                return String(record.text || record.value || '').trim();
            }
            return String(value || '').trim();
        }

        async function resolveOwnerNames(owners: string[]): Promise<Record<string, string>> {
            const unique = [...new Set(owners.map((o) => String(o || '').trim()).filter(Boolean))];
            if (unique.length === 0) return {};
            try {
                const identityMap = await backend.resolveUserIdentities(unique);
                const map: Record<string, string> = {};
                unique.forEach((id) => {
                    map[id] = formatIdentityName(identityMap[id], id);
                });
                return map;
            } catch {
                return {};
            }
        }

        async function loadData() {
            if (!supabase) return;
            loading.value = true;
            try {
                // proc_def 전체 로드 — 일반 프로세스/모듈 구분은 kind 로 부여 후 체크박스 필터
                const defResult = await supabase
                    .from('proc_def')
                    .select('id,name,type,description,owner,definition,saved_at')
                    .eq('tenant_id', tenantId)
                    .is('deleted_at', null)
                    .order('saved_at', { ascending: false });

                if (defResult.error) throw defResult.error;

                const rows = (defResult.data || []) as ProcDefRow[];

                const mappedRows = rows.map((d) => {
                    const metaOwners = getMetaOwners(d);
                    const piOwner = normalizeSingleOwner(metaOwners.primaryOwner, d.owner);
                    const fieldOwners = normalizeOwnerList(metaOwners.fieldOwners);
                    return {
                        id: d.id,
                        name: d.name || d.id,
                        kind: (isCallActivitySubModule(d) ? 'module' : 'process') as ProcessKind,
                        description: normalizeDescription(d),
                        pi_owner: piOwner,
                        field_owners: fieldOwners,
                        saved_at: d.saved_at || null
                    };
                });

                const ownerNameMap = await resolveOwnerNames(mappedRows.flatMap((d) => [d.pi_owner, ...d.field_owners]));
                identityDisplayMap.value = ownerNameMap;

                items.value = mappedRows.map((d) => ({
                    ...d,
                    pi_owner_name: d.pi_owner ? ownerNameMap[d.pi_owner] || d.pi_owner : '',
                    field_owner_names: d.field_owners.map((owner: string) => ownerNameMap[owner] || owner).join(', '),
                    owner_search_text: [
                        d.pi_owner,
                        d.pi_owner ? ownerNameMap[d.pi_owner] : '',
                        ...d.field_owners,
                        ...d.field_owners.map((owner: string) => ownerNameMap[owner] || '')
                    ]
                        .filter(Boolean)
                        .join(' ')
                }));
                totalCount.value = items.value.length;
            } catch (e) {
                console.error('Failed to load call activity subprocesses:', e);
            } finally {
                loading.value = false;
            }
        }

        function navigateToProcess(item: CallActivityItem) {
            if (!item?.id) return;
            navigateToProcessHierarchy(
                router,
                {
                    id: String(item.id).trim(),
                    name: String(item.name || item.id).trim(),
                    entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE
                },
                { openInNewTab: true }
            );
        }

        function openDeleteDialog(item: CallActivityItem) {
            deleteDialog.value = { visible: true, target: item };
        }

        async function confirmDelete() {
            const target = deleteDialog.value.target;
            if (!target || !supabase) return;
            deleting.value = true;
            try {
                const { error } = await supabase
                    .from('proc_def')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', target.id)
                    .eq('tenant_id', tenantId);

                if (error) throw error;

                items.value = items.value.filter((i) => i.id !== target.id);
                totalCount.value = items.value.length;
                deleteDialog.value.visible = false;
            } catch (e) {
                console.error('Failed to delete:', e);
            } finally {
                deleting.value = false;
            }
        }

        onMounted(() => loadData());

        return {
            loading,
            deleting,
            items,
            totalCount,
            searchInput,
            searchQuery,
            showProcesses,
            showModules,
            processCount,
            moduleCount,
            sortBy,
            sortOption,
            sortOptions,
            identityDisplayMap,
            headers,
            filteredList,
            deleteDialog,
            formatDateTime,
            applySearch,
            resetSearch,
            loadData,
            navigateToProcess,
            openDeleteDialog,
            confirmDelete
        };
    }
});
</script>

<style scoped>
/* page-header / sk-page-card / sk-page-card-text / sk-data-table / cell-* 클래스는
   src/assets/css/SKGlobalStyle.scss 에 글로벌 정의되어 있음 */

.cell-description {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
}

/* Delete Dialog (사용자 지시 범위 밖 — 기존 디자인 유지) */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
}

.btn-outline {
    background: #fff;
    border: 1px solid #d1d5db;
    color: #374151;
}

.btn-outline:hover {
    background: #f9fafb;
}

.btn-danger {
    background: #ef4444;
    color: #fff;
}

.btn-danger:hover {
    background: #dc2626;
}

.confirm-dialog {
    border-radius: 12px !important;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

.dialog-title {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
}

.dialog-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 4px;
    border-radius: 6px;
}

.dialog-close:hover {
    background: #f3f4f6;
}

.dialog-body {
    padding: 20px;
}

.dialog-desc {
    color: #4b5563;
    margin: 0 0 12px 0;
}

.target-info {
    background: #f9fafb;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    color: #374151;
}

.text-muted {
    color: #9ca3af;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid #f3f4f6;
}
</style>

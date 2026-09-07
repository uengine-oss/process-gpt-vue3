<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">시스템 관리</h1>
                    <v-chip v-if="!loading && systems.length > 0" size="small" variant="tonal" color="grey">
                        총 {{ systems.length }}건
                    </v-chip>
                </div>
            </div>
            <div class="page-header-right">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openCreateDialog"> 신규 등록 </v-btn>
                <v-btn variant="outlined" size="small" prepend-icon="mdi-refresh" :disabled="loading" @click="refreshSystems">
                    새로고침
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">
            <!-- Toolbar -->
            <div class="toolbar pt-4 pb-4">
                <div class="search-wrapper">
                    <v-icon class="search-icon" size="18">mdi-magnify</v-icon>
                    <input v-model="searchQuery" class="search-input" :placeholder="$t('systemManagement.searchPlaceholder')" type="text" />
                </div>
                <div class="filter-pills">
                    <button
                        v-for="f in filterOptions"
                        :key="f.value"
                        class="pill"
                        :class="{ active: activeFilter === f.value }"
                        @click="activeFilter = f.value"
                    >
                        {{ f.label }}
                    </button>
                </div>
            </div>

            <!-- Table -->
            <v-data-table
                v-model:sort-by="sortBy"
                :headers="tableHeaders"
                :items="filteredSystems"
                :loading="loading"
                :no-data-text="searchQuery ? '검색 결과가 없습니다.' : '등록된 시스템이 없습니다.'"
                density="compact"
                hover
                fixed-header
                item-value="id"
                class="sk-data-table"
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
            >
                <template v-slot:[`item.id`]="{ item }">
                    <span class="cell-id">{{ item.id }}</span>
                </template>
                <template v-slot:[`item.name`]="{ item }">
                    <a
                        v-if="getShortcutHref(item.shortcut_link)"
                        :href="getShortcutHref(item.shortcut_link) || undefined"
                        class="sk-mapping-list__name sk-mapping-list__name--link"
                        target="_blank"
                        rel="noopener noreferrer"
                        :title="item.shortcut_link"
                    >
                        {{ item.name }}
                    </a>
                    <span v-else class="item-name">{{ item.name }}</span>
                </template>
                <template v-slot:[`item.system_type`]="{ item }">
                    <span v-if="item.system_type" class="type-badge">{{ item.system_type }}</span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.category`]="{ item }">
                    <span v-if="item.category" class="category-badge">{{ item.category }}</span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.responsible_person`]="{ item }">
                    <span v-if="item.responsible_person" class="cell-multiline" :title="item.responsible_person">
                        {{ item.responsible_person }}
                    </span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.description`]="{ item }">
                    <span v-if="item.description" class="cell-multiline" :title="item.description">
                        {{ item.description }}
                    </span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.registration_status`]="{ item }">
                    <span v-if="item.registration_status" class="status-badge" :class="'status-' + item.registration_status">
                        {{ item.registration_status }}
                    </span>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.created_at`]="{ item }">
                    <span class="cell-date">{{ formatDate(item.created_at) }}</span>
                </template>
                <template v-slot:[`item.actions`]="{ item }">
                    <v-tooltip text="수정" location="top">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon="mdi-pencil-outline" size="x-small" variant="text" @click="openEditDialog(item)" />
                        </template>
                    </v-tooltip>
                    <v-tooltip text="삭제" location="top">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-trash-can-outline"
                                size="x-small"
                                variant="text"
                                color="error"
                                @click="openDeleteDialog(item)"
                            />
                        </template>
                    </v-tooltip>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Create/Edit Dialog -->
        <v-dialog v-model="formDialog.visible" max-width="560" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#3b82f6" size="24">{{ formDialog.isEdit ? 'mdi-pencil' : 'mdi-plus-circle-outline' }}</v-icon>
                    <span class="dialog-title">{{
                        formDialog.isEdit ? $t('systemManagement.editSystem') : $t('systemManagement.addSystem')
                    }}</span>
                    <button class="dialog-close" @click="formDialog.visible = false">
                        <v-icon size="20">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-body">
                    <label class="form-label">시스템명 <span class="required">*</span></label>
                    <input v-model="formData.name" class="form-input" placeholder="시스템명을 입력하세요" />

                    <label class="form-label">구분</label>
                    <v-combobox
                        v-model="formData.category"
                        :items="categoryOptions"
                        placeholder="구분을 선택하거나 입력하세요"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="form-field"
                    />

                    <label class="form-label">담당자</label>
                    <v-autocomplete
                        v-model="formData.responsible_person"
                        :items="userSearchResults"
                        item-title="label"
                        item-value="label"
                        placeholder="이름을 검색하세요 (2글자 이상)"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        :loading="userSearchLoading"
                        class="form-field"
                        @update:search="onUserSearchInput"
                        @update:model-value="onUserSelected"
                    >
                        <template #no-data>
                            <v-list-item>
                                <v-list-item-title class="text-caption text-grey">
                                    {{ userSearchLoading ? '검색 중...' : '이름을 입력하세요 (2글자 이상)' }}
                                </v-list-item-title>
                            </v-list-item>
                        </template>
                    </v-autocomplete>

                    <label class="form-label">바로가기 링크</label>
                    <input v-model="formData.shortcut_link" class="form-input" type="url" placeholder="https://example.com" />

                    <label class="form-label">설명</label>
                    <textarea v-model="formData.description" class="form-input form-textarea" placeholder="설명을 입력하세요" rows="3" />
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="formDialog.visible = false">{{ $t('systemManagement.cancel') }}</button>
                    <button class="btn btn-primary" :disabled="saving || !formData.name.trim()" @click="saveSystem">
                        <v-progress-circular v-if="saving" indeterminate size="14" width="2" color="white" />
                        <span v-else>{{ $t('systemManagement.save') }}</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>

        <!-- Delete Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="440" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#ef4444" size="24">mdi-alert-circle-outline</v-icon>
                    <span class="dialog-title">{{ $t('systemManagement.confirmDelete') }}</span>
                    <button class="dialog-close" @click="deleteDialog.visible = false">
                        <v-icon size="20">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-body">
                    <p class="dialog-desc">{{ $t('systemManagement.deleteConfirmMessage') }}</p>
                    <div class="target-info">
                        <strong>{{ deleteDialog.target?.name }}</strong>
                        <span v-if="deleteDialog.target?.id" class="ml-2 text-muted">({{ deleteDialog.target.id }})</span>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="deleteDialog.visible = false">{{ $t('systemManagement.cancel') }}</button>
                    <button class="btn btn-danger" :disabled="deleting" @click="confirmDelete">
                        <v-progress-circular v-if="deleting" indeterminate size="14" width="2" color="white" />
                        <span v-else>{{ $t('systemManagement.delete') }}</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useSystemManagementStore, type System } from '@/stores/systemManagement';
import BackendFactory from '@/components/api/BackendFactory';
import { userIdentityFromSearchResult, formatIdentityWithTeam } from '@/utils/userIdentity';

type ColumnKey =
    | 'id'
    | 'name'
    | 'system_type'
    | 'category'
    | 'responsible_person'
    | 'description'
    | 'registration_status'
    | 'created_at'
    | 'actions';

type TableHeaderConfig = {
    title: string;
    key: ColumnKey;
    align: 'start' | 'end' | 'center';
    sortable: boolean;
    width: number;
    minWidth: number;
};

type UserSearchResponse = {
    users?: any[];
};

type UserSearchOption = {
    email: string;
    label: string;
    name: string;
};

export default defineComponent({
    name: 'SystemManagement',
    setup() {
        const store = useSystemManagementStore();

        const headerConfigs: TableHeaderConfig[] = [
            { title: 'ID', key: 'id', align: 'start', sortable: true, width: 140, minWidth: 110 },
            { title: '이름', key: 'name', align: 'start', sortable: true, width: 180, minWidth: 140 },
            { title: '유형', key: 'system_type', align: 'start', sortable: true, width: 100, minWidth: 90 },
            { title: '구분', key: 'category', align: 'start', sortable: true, width: 110, minWidth: 100 },
            { title: '담당자', key: 'responsible_person', align: 'start', sortable: true, width: 160, minWidth: 140 },
            { title: '설명', key: 'description', align: 'start', sortable: true, width: 320, minWidth: 180 },
            { title: '상태', key: 'registration_status', align: 'start', sortable: true, width: 100, minWidth: 90 },
            { title: '등록일', key: 'created_at', align: 'start', sortable: true, width: 120, minWidth: 110 },
            { title: '관리', key: 'actions', align: 'end', sortable: false, width: 110, minWidth: 110 }
        ];

        const searchQuery = ref('');
        const activeFilter = ref('all');
        const saving = ref(false);
        const deleting = ref(false);
        const sortBy = ref([{ key: 'created_at', order: 'desc' as const }]);

        const filterOptions = computed(() => {
            const categories = new Set<string>();
            systems.value.forEach((sys) => {
                if (sys.category) categories.add(sys.category);
            });
            return [
                { value: 'all', label: '전체' },
                ...Array.from(categories)
                    .sort()
                    .map((c) => ({ value: c, label: c }))
            ];
        });

        const tableHeaders = computed(() =>
            headerConfigs.map((header) => ({
                title: header.title,
                key: header.key,
                align: header.align,
                sortable: header.sortable,
                width: header.width,
                minWidth: header.minWidth
            }))
        );

        // Dialog state
        const formDialog = ref<{ visible: boolean; isEdit: boolean; editId?: string }>({
            visible: false,
            isEdit: false
        });

        const formData = ref({
            name: '',
            category: '',
            responsible_person: '',
            shortcut_link: '',
            description: ''
        });

        // ── 담당자 유저 검색 ──
        const userSearchResults = ref<UserSearchOption[]>([]);
        const userSearchLoading = ref(false);
        let userSearchTimer: ReturnType<typeof setTimeout> | null = null;

        function onUserSearchInput(keyword: string) {
            if (userSearchTimer) clearTimeout(userSearchTimer);
            if (!keyword || keyword.trim().length < 2) {
                userSearchResults.value = [];
                return;
            }
            userSearchTimer = setTimeout(() => searchUsers(keyword.trim()), 300);
        }

        async function searchUsers(keyword: string) {
            userSearchLoading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = (await backend.searchUsersByName(keyword, 0, 20)) as UserSearchResponse;
                userSearchResults.value = (result.users || []).map((user) => {
                    const identity = userIdentityFromSearchResult(user);
                    const value = identity.email || identity.id || identity.employee_no || '';
                    return {
                        email: value,
                        label: formatIdentityWithTeam(identity, value),
                        name: identity.username || ''
                    };
                });
            } catch (e) {
                console.warn('User search failed:', e);
                userSearchResults.value = [];
            } finally {
                userSearchLoading.value = false;
            }
        }

        function onUserSelected(value: string) {
            if (!value) return;
            const found = userSearchResults.value.find((u) => u.label === value);
            formData.value.responsible_person = found ? found.label : value;
        }

        // ── 구분 combobox ──
        const categoryOptions = computed(() => {
            const cats = new Set<string>();
            systems.value.forEach((sys) => {
                if (sys.category) cats.add(sys.category);
            });
            return Array.from(cats).sort();
        });

        const deleteDialog = ref<{ visible: boolean; target: System | null }>({
            visible: false,
            target: null
        });

        // Computed
        const loading = computed(() => store.loading);
        const systems = computed(() => store.sortedSystems);

        const filteredSystems = computed(() => {
            let list = systems.value;

            // Filter by category
            if (activeFilter.value !== 'all') {
                list = list.filter((sys) => sys.category === activeFilter.value);
            }

            // Search
            const query = searchQuery.value.trim().toLowerCase();
            if (query) {
                list = list.filter((sys) => {
                    if (sys.id?.toLowerCase().includes(query)) return true;
                    if (sys.name?.toLowerCase().includes(query)) return true;
                    if (sys.category?.toLowerCase().includes(query)) return true;
                    if (sys.responsible_person?.toLowerCase().includes(query)) return true;
                    if (sys.shortcut_link?.toLowerCase().includes(query)) return true;
                    if (sys.description?.toLowerCase().includes(query)) return true;
                    return false;
                });
            }

            return list;
        });

        // Helpers
        function formatDate(iso?: string | null) {
            if (!iso) return '-';
            return iso.substring(0, 10);
        }

        function getShortcutHref(link?: string | null) {
            const value = link?.trim();
            if (!value) return null;

            const normalized = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) ? value : `https://${value}`;

            try {
                const url = new URL(normalized);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    return null;
                }
                return url.toString();
            } catch {
                return null;
            }
        }

        // Methods
        function openCreateDialog() {
            formData.value = { name: '', category: '', responsible_person: '', shortcut_link: '', description: '' };
            userSearchResults.value = [];
            formDialog.value = { visible: true, isEdit: false };
        }

        function openEditDialog(sys: System) {
            formData.value = {
                name: sys.name || '',
                category: sys.category || '',
                responsible_person: sys.responsible_person || '',
                shortcut_link: sys.shortcut_link || '',
                description: sys.description || ''
            };
            userSearchResults.value = [];
            formDialog.value = { visible: true, isEdit: true, editId: sys.id };
        }

        async function saveSystem() {
            if (!formData.value.name.trim()) return;

            saving.value = true;
            try {
                const system: Partial<System> = {
                    name: formData.value.name.trim(),
                    category: formData.value.category.trim() || undefined,
                    responsible_person: formData.value.responsible_person.trim() || undefined,
                    shortcut_link: formData.value.shortcut_link.trim() || undefined,
                    description: formData.value.description.trim() || undefined
                };

                if (formDialog.value.isEdit && formDialog.value.editId) {
                    system.id = formDialog.value.editId;
                }

                await store.saveSystem(system);
                formDialog.value.visible = false;
            } catch (e) {
                console.error('Failed to save system:', e);
            } finally {
                saving.value = false;
            }
        }

        function openDeleteDialog(sys: System) {
            deleteDialog.value = { visible: true, target: sys };
        }

        async function confirmDelete() {
            const target = deleteDialog.value.target;
            if (!target) return;

            deleting.value = true;
            try {
                await store.deleteSystem(target);
                deleteDialog.value.visible = false;
                deleteDialog.value.target = null;
            } catch (e) {
                console.error('Failed to delete system:', e);
            } finally {
                deleting.value = false;
            }
        }

        async function refreshSystems() {
            await store.refreshSystems();
        }

        onMounted(async () => {
            await store.refreshSystems();
        });

        return {
            searchQuery,
            activeFilter,
            filterOptions,
            tableHeaders,
            loading,
            saving,
            deleting,
            sortBy,
            systems,
            filteredSystems,
            formDialog,
            formData,
            deleteDialog,
            formatDate,
            getShortcutHref,
            openCreateDialog,
            openEditDialog,
            saveSystem,
            openDeleteDialog,
            confirmDelete,
            refreshSystems,
            userSearchResults,
            userSearchLoading,
            onUserSearchInput,
            onUserSelected,
            categoryOptions
        };
    }
});
</script>

<style scoped>
/* ── Header ─────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.section-icon {
    color: #3b82f6;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
}

.header-count {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 10px;
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
    flex-wrap: wrap;
}

.search-wrapper {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 360px;
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

.col-category {
    width: 100px;
}
.col-name {
    min-width: 140px;
}
.col-person {
    width: 120px;
}
.col-link {
    width: 80px;
    text-align: center;
}
.col-desc {
    min-width: 200px;
    max-width: 320px;
}
.col-actions {
    width: 140px;
    white-space: nowrap;
}

.id-text {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 11px;
    color: #6b7280;
}

.item-name {
    font-weight: 500;
    color: #111827;
}

.category-badge {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #374151;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
}

.text-desc {
    color: #4b5563;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 320px;
}

.text-muted {
    color: #d1d5db;
}

.link-btn {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #16a34a;
    text-decoration: none;
}

.link-btn:hover {
    background: #dcfce7;
    border-color: #86efac;
}

.type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: #dbeafe;
    color: #1e40af;
}

.status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}

.status-active {
    background: #dcfce7;
    color: #166534;
}

.status-inactive {
    background: #f3f4f6;
    color: #6b7280;
}

/* ── Action Buttons ─────────────────────────────────── */
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
    transition: background 0.15s;
    margin-right: 4px;
}

.edit-btn {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
}

.edit-btn:hover {
    background: #dbeafe;
    border-color: #93c5fd;
}

.delete-btn {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #e11d48;
}

.delete-btn:hover {
    background: #ffe4e6;
    border-color: #fda4af;
}

/* ── Empty ───────────────────────────────────────────── */
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

.btn-primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
    background: #2563eb;
}

.btn-danger {
    background: #ef4444;
    border-color: #ef4444;
    color: #ffffff;
}

.btn-danger:hover:not(:disabled) {
    background: #dc2626;
}

/* ── Dialog ──────────────────────────────────────────── */
.confirm-dialog {
    border-radius: 12px !important;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 24px 12px;
}

.dialog-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    flex: 1;
}

.dialog-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
}

.dialog-close:hover {
    background: #f3f4f6;
    color: #6b7280;
}

.dialog-body {
    padding: 0 24px 20px;
    max-height: 70vh;
    overflow-y: auto;
}

.dialog-desc {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 12px;
}

.target-info {
    padding: 10px 14px;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 14px;
    color: #374151;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
}

/* ── Form ────────────────────────────────────────────── */
.form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
    margin-top: 12px;
}

.form-label:first-child {
    margin-top: 0;
}

.form-label .required {
    color: #ef4444;
}

.form-input {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #111827;
    background: #ffffff;
    outline: none;
    transition: border-color 0.15s;
}

.form-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.form-textarea {
    height: auto;
    padding: 8px 12px;
    resize: vertical;
    font-family: inherit;
}

.form-select {
    cursor: pointer;
    appearance: auto;
}

.form-field {
    margin-bottom: 2px;
}

.form-field :deep(.v-field) {
    font-size: 13px;
    min-height: 36px;
}

.form-field :deep(.v-field__input) {
    padding: 4px 12px;
    min-height: 36px;
}

.form-field :deep(.v-field--variant-outlined .v-field__outline__start),
.form-field :deep(.v-field--variant-outlined .v-field__outline__end) {
    border-color: #e5e7eb;
}

.form-field :deep(.v-field--focused .v-field__outline__start),
.form-field :deep(.v-field--focused .v-field__outline__end) {
    border-color: #3b82f6;
}
</style>

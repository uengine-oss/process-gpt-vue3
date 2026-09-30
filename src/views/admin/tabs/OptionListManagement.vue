<template>
    <v-card flat class="sk-page-card">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">목록 관리</h1>
                <p class="page-subtitle">주제별 선택지 목록을 만들어 두면, 속성 스키마의 선택형 필드가 Options Source = "목록"으로 참조합니다.</p>
            </div>
            <div class="page-header-right">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAddForm"> 목록 추가 </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-2 sk-page-card-text">
            <!-- 툴바 -->
            <div class="filter-row">
                <div class="filter-search-wrap">
                    <v-icon size="15" class="filter-search-icon">mdi-magnify</v-icon>
                    <input v-model="searchText" class="form-input filter-search" placeholder="주제 · 키 · 설명 검색" />
                </div>
                <label class="checkbox-label">
                    <input type="checkbox" v-model="showInactive" />
                    <span>비활성 목록 보기</span>
                </label>
            </div>

            <div class="list-scroll">
                <div v-if="loading" class="text-center pa-8">
                    <v-progress-circular indeterminate size="24" color="primary" />
                </div>

                <template v-else>
                    <div v-if="filteredLists.length === 0" class="empty-note">
                        등록된 목록이 없습니다. "목록 추가"로 주제별 선택지 목록을 만들어 보세요.
                    </div>
                    <div v-for="list in filteredLists" :key="list.id" class="list-card" :class="{ 'list-card--inactive': list.is_active === false }">
                        <div class="list-card-main">
                            <div class="list-card-top">
                                <v-icon size="15" color="primary">mdi-format-list-bulleted</v-icon>
                                <span class="list-name">{{ list.name }}</span>
                                <code class="list-key">{{ list.list_key }}</code>
                                <span class="summary-chip">항목 {{ (list.items || []).length }}개</span>
                                <span v-if="usageBySchemas(list.list_key).length" class="summary-chip usage-chip">
                                    속성 {{ usageBySchemas(list.list_key).length }}개에서 사용
                                </span>
                                <span v-if="list.is_active === false" class="inactive-badge">비활성</span>
                            </div>
                            <div class="list-card-summary">
                                <span class="items-preview">{{ itemsPreview(list) }}</span>
                                <span v-if="list.description" class="description-text" :title="list.description">{{ truncate(list.description, 60) }}</span>
                            </div>
                        </div>
                        <div class="actions-cell">
                            <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEditForm(list)" />
                            <v-btn icon="mdi-delete-outline" size="x-small" variant="text" class="action-delete" @click="confirmDelete(list)" />
                        </div>
                    </div>
                </template>
            </div>
        </v-card-text>

        <!-- ───────────── 추가 / 수정 다이얼로그 ───────────── -->
        <v-dialog v-model="showForm" max-width="640" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6 d-flex align-center">
                    <span>{{ editingList ? '목록 수정' : '목록 추가' }}</span>
                    <v-spacer />
                    <v-btn icon="mdi-close" size="x-small" variant="text" @click="cancelForm" />
                </v-card-title>
                <v-card-text class="px-6 pb-2">
                    <div class="form-row">
                        <div class="form-group" style="flex: 1.4;">
                            <label class="form-label">주제 (이름) <span class="required-mark">*</span></label>
                            <input v-model="formData.name" class="form-input" placeholder="예: 부서, 시스템 유형" />
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">키 <span class="required-mark">*</span></label>
                            <input
                                v-model="formData.list_key"
                                class="form-input"
                                :class="{ 'input-disabled': !!editingList }"
                                :disabled="!!editingList"
                                placeholder="e.g. departments"
                            />
                            <div v-if="editingList" class="field-hint field-hint-warning">
                                <v-icon size="12" color="warning">mdi-lock-outline</v-icon>
                                속성 스키마가 이 키로 참조하므로 변경할 수 없습니다.
                            </div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">설명</label>
                            <input v-model="formData.description" class="form-input" placeholder="이 목록의 용도" />
                        </div>
                    </div>
                    <div class="form-row-checkboxes">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="formData.is_active" />
                            <span>사용 (해제 시 속성 필드에 선택지가 비어 보일 수 있음)</span>
                        </label>
                    </div>

                    <label class="form-label section-label">항목 (위→아래 순서대로 표시)</label>
                    <div v-for="(item, index) in formData.items" :key="index" class="option-row">
                        <input v-model="item.value" class="form-input" placeholder="값 (저장되는 값)" />
                        <input v-model="item.label" class="form-input" placeholder="라벨 (표시 이름, 비우면 값)" />
                        <button class="option-move-btn" :disabled="index === 0" @click="moveItem(index, -1)">
                            <v-icon size="14">mdi-arrow-up</v-icon>
                        </button>
                        <button class="option-move-btn" :disabled="index === formData.items.length - 1" @click="moveItem(index, 1)">
                            <v-icon size="14">mdi-arrow-down</v-icon>
                        </button>
                        <button class="option-remove-btn" @click="formData.items.splice(index, 1)">
                            <v-icon size="14">mdi-minus</v-icon>
                        </button>
                    </div>
                    <button class="option-add-btn" @click="formData.items.push({ value: '', label: '' })">
                        <v-icon size="14">mdi-plus</v-icon> 항목 추가
                    </button>

                    <!-- 수정 시 사용처·값 호환 경고 -->
                    <div v-if="editingList && usageBySchemas(editingList.list_key).length" class="data-loss-warning-banner mt-4">
                        <div class="data-loss-warning-header">
                            <v-icon size="18" color="error">mdi-alert-outline</v-icon>
                            <span class="data-loss-warning-title">사용 중인 목록</span>
                        </div>
                        <ul class="data-loss-warning-list">
                            <li>
                                이 목록을 참조하는 속성:
                                <strong>{{ usageBySchemas(editingList.list_key).map((s) => s.property_label || s.property_key).join(', ') }}</strong>
                            </li>
                            <li>항목의 <strong>값(value)을 바꾸거나 지우면</strong> 그 값을 저장한 기존 데이터가 빈 값으로 표시될 수 있습니다. 라벨 변경은 안전합니다.</li>
                        </ul>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelForm">취소</v-btn>
                    <v-btn color="primary" variant="tonal" :disabled="!canSave" :loading="saving" @click="saveList">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── 삭제 확인 ───────────── -->
        <v-dialog v-model="deleteDialogOpen" max-width="460">
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">목록 삭제</v-card-title>
                <v-card-text class="px-6 pb-2">
                    <p>목록 <strong>{{ deleteTarget?.name }}</strong> ({{ deleteTarget?.list_key }}) 을(를) 삭제합니다.</p>
                    <div v-if="deleteTarget && usageBySchemas(deleteTarget.list_key).length" class="data-loss-warning-banner mt-3">
                        <div class="data-loss-warning-header">
                            <v-icon size="18" color="error">mdi-alert-outline</v-icon>
                            <span class="data-loss-warning-title">사용 중인 목록</span>
                        </div>
                        <ul class="data-loss-warning-list">
                            <li>
                                참조 중인 속성:
                                <strong>{{ usageBySchemas(deleteTarget.list_key).map((s) => s.property_label || s.property_key).join(', ') }}</strong>
                            </li>
                            <li>삭제하면 해당 속성의 선택지가 <strong>빈 목록</strong>이 됩니다. 기존에 저장된 값은 값 그대로 표시됩니다.</li>
                        </ul>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialogOpen = false">취소</v-btn>
                    <v-btn color="error" variant="tonal" :loading="deleting" @click="executeDelete">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted, getCurrentInstance } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { useAdminConsoleStore } from '@/stores/adminConsole';

const defaultFormData = () => ({
    name: '',
    list_key: '',
    description: '',
    is_active: true,
    items: [{ value: '', label: '' }]
});

export default defineComponent({
    name: 'OptionListManagement',

    setup() {
        const { proxy } = getCurrentInstance();
        const lists = ref([]);
        const propertySchemas = ref([]);
        const loading = ref(false);
        const saving = ref(false);
        const deleting = ref(false);
        const searchText = ref('');
        const showInactive = ref(false);

        const showForm = ref(false);
        const editingList = ref(null);
        const formData = ref(defaultFormData());

        const deleteDialogOpen = ref(false);
        const deleteTarget = ref(null);

        const adminStore = useAdminConsoleStore();

        const truncate = (text, len) => {
            const s = String(text || '');
            return s.length > len ? s.slice(0, len) + '…' : s;
        };

        const load = async ({ silent = false } = {}) => {
            if (!silent) loading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const [listRows, schemaRows] = await Promise.all([
                    backend.getOptionLists ? backend.getOptionLists() : [],
                    // 사용처 표시용 — config.list.list_key 로 이 목록을 참조하는 속성 스키마
                    backend.getPropertySchemas ? backend.getPropertySchemas() : []
                ]);
                lists.value = listRows || [];
                propertySchemas.value = schemaRows || [];
            } catch (e) {
                console.error('[OptionListManagement] load error:', e);
            } finally {
                if (!silent) loading.value = false;
            }
        };

        const filteredLists = computed(() => {
            const q = searchText.value.trim().toLowerCase();
            return (lists.value || [])
                .filter((l) => showInactive.value || l.is_active !== false)
                .filter((l) => {
                    if (!q) return true;
                    return `${l.name || ''} ${l.list_key || ''} ${l.description || ''}`.toLowerCase().includes(q);
                });
        });

        const usageBySchemas = (listKey) => {
            if (!listKey) return [];
            return (propertySchemas.value || []).filter(
                (s) => !s.deleted_at && s.select_source_type === 'list' && s.config?.list?.list_key === listKey
            );
        };

        const itemsPreview = (list) => {
            const items = Array.isArray(list.items) ? list.items : [];
            const labels = items.map((it) => it.label || it.value).filter(Boolean);
            return labels.slice(0, 6).join(' · ') + (labels.length > 6 ? ` 외 ${labels.length - 6}개` : '');
        };

        // ---- 추가/수정 ----
        const openAddForm = () => {
            editingList.value = null;
            formData.value = defaultFormData();
            showForm.value = true;
        };

        const openEditForm = (list) => {
            editingList.value = list;
            formData.value = {
                name: list.name || '',
                list_key: list.list_key || '',
                description: list.description || '',
                is_active: list.is_active !== false,
                items: Array.isArray(list.items) && list.items.length ? list.items.map((it) => ({ ...it })) : [{ value: '', label: '' }]
            };
            showForm.value = true;
        };

        const cancelForm = () => {
            showForm.value = false;
            editingList.value = null;
            formData.value = defaultFormData();
        };

        const moveItem = (index, delta) => {
            const items = formData.value.items;
            const next = index + delta;
            if (next < 0 || next >= items.length) return;
            const [row] = items.splice(index, 1);
            items.splice(next, 0, row);
        };

        const generateKey = (label) =>
            String(label || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');

        const canSave = computed(() => {
            const fd = formData.value;
            if (!String(fd.name || '').trim() || !String(fd.list_key || '').trim()) return false;
            return fd.items.some((it) => String(it.value || '').trim() || String(it.label || '').trim());
        });

        const saveList = async () => {
            if (!canSave.value || saving.value) return;
            const fd = formData.value;
            const key = String(fd.list_key).trim();
            if (!editingList.value) {
                const duplicate = (lists.value || []).find((l) => l.list_key === key);
                if (duplicate) {
                    proxy.$try({ action: async () => {}, warningMsg: `키 "${key}" 는 이미 사용 중입니다.` });
                    return;
                }
            }
            saving.value = true;
            try {
                const backend = BackendFactory.createBackend();
                // 빈 행 제거 · 라벨 없으면 값으로 채움 (static options 와 동일 형태 유지)
                const items = fd.items
                    .map((it) => ({ value: String(it.value || '').trim() || String(it.label || '').trim(), label: String(it.label || '').trim() }))
                    .filter((it) => it.value)
                    .map((it) => ({ value: it.value, label: it.label || it.value }));
                const beforeSnapshot = editingList.value ? { ...editingList.value } : null;
                const payload = {
                    id: editingList.value?.id,
                    list_key: editingList.value ? editingList.value.list_key : key,
                    name: String(fd.name).trim(),
                    description: String(fd.description || '').trim() || null,
                    items,
                    is_active: fd.is_active !== false
                };
                await backend.saveOptionList(payload);
                adminStore.writeAdminAuditLog({
                    action: editingList.value ? 'option_list_update' : 'option_list_create',
                    target_type: 'option_list',
                    target_id: payload.list_key,
                    target_name: payload.name,
                    before_value: beforeSnapshot,
                    after_value: payload
                });
                cancelForm();
                await load({ silent: true });
            } catch (e) {
                console.error('[OptionListManagement] save error:', e);
            } finally {
                saving.value = false;
            }
        };

        // ---- 삭제 ----
        const confirmDelete = (list) => {
            deleteTarget.value = list;
            deleteDialogOpen.value = true;
        };

        const executeDelete = async () => {
            if (!deleteTarget.value || deleting.value) return;
            deleting.value = true;
            try {
                const backend = BackendFactory.createBackend();
                await backend.deleteOptionList(deleteTarget.value.id);
                adminStore.writeAdminAuditLog({
                    action: 'option_list_delete',
                    target_type: 'option_list',
                    target_id: deleteTarget.value.list_key,
                    target_name: deleteTarget.value.name,
                    before_value: { ...deleteTarget.value }
                });
                deleteDialogOpen.value = false;
                deleteTarget.value = null;
                await load({ silent: true });
            } catch (e) {
                console.error('[OptionListManagement] delete error:', e);
            } finally {
                deleting.value = false;
            }
        };

        onMounted(load);

        return {
            lists,
            loading,
            saving,
            deleting,
            searchText,
            showInactive,
            showForm,
            editingList,
            formData,
            deleteDialogOpen,
            deleteTarget,
            filteredLists,
            usageBySchemas,
            itemsPreview,
            truncate,
            openAddForm,
            openEditForm,
            cancelForm,
            moveItem,
            generateKey,
            canSave,
            saveList,
            confirmDelete,
            executeDelete
        };
    },

    watch: {
        'formData.name'(newName) {
            if (!this.editingList && !this.formData.list_key) {
                this.formData.list_key = this.generateKey(newName);
            }
        }
    }
});
</script>

<style scoped>
/* sk-page-card / page-header 계열은 SKGlobalStyle.scss 전역 정의 */

.filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
    margin-bottom: 12px;
}

.filter-search-wrap {
    position: relative;
    flex: 1;
    max-width: 320px;
    min-width: 0;
}

.filter-search-icon {
    position: absolute;
    left: 9px;
    top: 50%;
    transform: translateY(-50%);
    color: rgb(var(--v-theme-textSecondary));
    pointer-events: none;
}

.filter-row .filter-search {
    width: 100%;
    padding-left: 30px;
}

.list-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.list-card {
    /* .list-scroll 이 flex 컬럼이라 flex-shrink 기본값이면 목록이 길어질 때
       카드가 눌리고 스크롤이 생기지 않는다. 자연 높이를 유지한다. */
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 8px;
    padding: 10px 12px;
    background: rgb(var(--v-theme-surface));
}

.list-card--inactive {
    opacity: 0.55;
}

.list-card-main {
    flex: 1;
    min-width: 0;
}

.list-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.list-name {
    font-size: 13px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.list-key {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.summary-chip {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.usage-chip {
    color: rgb(var(--v-theme-primary));
}

.inactive-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(var(--v-theme-error), 0.1);
    color: rgb(var(--v-theme-error));
}

.list-card-summary {
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.items-preview {
    font-size: 12px;
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.description-text {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.actions-cell {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.action-delete {
    color: rgb(var(--v-theme-error));
}

.empty-note {
    padding: 32px;
    text-align: center;
    font-size: 13px;
    color: rgb(var(--v-theme-textSecondary));
}

/* ── 폼 공통 (스튜디오와 동일 룩) ── */
.form-input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    font-size: 13px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textPrimary));
    outline: none;
    transition: border-color 0.15s ease;
}

.form-input:focus {
    border-color: rgb(var(--v-theme-primary));
}

.input-disabled {
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.form-label {
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.section-label {
    display: block;
    margin: 8px 0 6px;
}

.required-mark {
    color: rgb(var(--v-theme-error));
}

.field-hint {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
    display: flex;
    align-items: center;
    gap: 3px;
}

.field-hint-warning {
    color: rgb(var(--v-theme-warning));
}

.form-row-checkboxes {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: rgb(var(--v-theme-textPrimary));
    cursor: pointer;
    white-space: nowrap;
}

.option-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
    align-items: center;
}

.option-move-btn,
.option-remove-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textSecondary));
    cursor: pointer;
}

.option-move-btn:disabled {
    opacity: 0.35;
    cursor: default;
}

.option-remove-btn:hover {
    color: rgb(var(--v-theme-error));
    border-color: rgb(var(--v-theme-error));
}

.option-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    padding: 5px 10px;
    border: 1px dashed rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
}

/* 데이터 유실 경고 배너 — 스튜디오와 동일 룩 */
.data-loss-warning-banner {
    border: 1px solid rgba(var(--v-theme-error), 0.4);
    background: rgba(var(--v-theme-error), 0.05);
    border-radius: 8px;
    padding: 10px 12px;
}

.data-loss-warning-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}

.data-loss-warning-title {
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-error));
}

.data-loss-warning-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: rgb(var(--v-theme-textPrimary));
}

.data-loss-warning-list li {
    margin-bottom: 2px;
}
</style>

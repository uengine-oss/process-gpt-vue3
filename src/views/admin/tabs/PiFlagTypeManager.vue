<template>
    <div class="pi-flag-type-manager">
        <div class="section-header">
            <div class="section-title-group">
                <v-chip class="ml-2" size="small" variant="tonal" color="default">전체 {{ items.length }}건</v-chip>
            </div>
            <div class="section-actions">
                <v-btn variant="flat" color="default" :disabled="loading" prepend-icon="mdi-refresh" @click="reload"> 새로고침 </v-btn>
                <v-btn variant="flat" color="primary" prepend-icon="mdi-plus" @click="openCreate"> 유형 추가 </v-btn>
            </div>
        </div>

        <div v-if="loading" class="state-area">
            <v-progress-circular indeterminate color="primary" size="28" />
            <span class="state-text">유형 데이터를 불러오는 중입니다…</span>
        </div>
        <div v-else-if="loadError" class="state-area state-area--error">
            <v-icon color="error">mdi-alert-circle-outline</v-icon>
            <span class="state-text">{{ loadError }}</span>
            <button class="action-btn" @click="reload">다시 시도</button>
        </div>
        <div v-else-if="items.length === 0" class="state-area">
            <v-icon color="grey">mdi-tag-off-outline</v-icon>
            <span class="state-text">등록된 PI Flag 유형이 없습니다. 우측 상단의 "유형 추가" 버튼을 눌러 시작하세요.</span>
        </div>

        <v-data-table
            v-else
            :headers="tableHeaders"
            :items="items"
            :items-per-page="25"
            :items-per-page-options="[25, 50, 100, 200]"
            density="compact"
            class="sk-data-table pi-flag-type-table"
            hover
        >
            <template v-slot:[`item.code`]="{ item }">
                <span class="cell-code">{{ item.code }}</span>
            </template>
            <template v-slot:[`item.label`]="{ item }">
                <span class="cell-label">{{ item.label }}</span>
            </template>
            <template v-slot:[`item.description`]="{ item }">
                <span class="cell-description">{{ item.description || '-' }}</span>
            </template>
            <template v-slot:[`item.sortOrder`]="{ item }">
                <span class="cell-order">{{ item.sortOrder ?? 0 }}</span>
            </template>
            <template v-slot:[`item.active`]="{ item }">
                <v-chip size="small" variant="tonal" :color="item.active ? 'success' : 'default'">
                    {{ item.active ? '사용' : '미사용' }}
                </v-chip>
            </template>
            <template v-slot:[`item.actions`]="{ item }">
                <v-btn size="x-small" variant="text" icon @click.stop="openEdit(item)">
                    <v-icon size="18">mdi-pencil-outline</v-icon>
                </v-btn>
                <v-btn size="x-small" variant="text" icon color="error" @click.stop="confirmDelete(item)">
                    <v-icon size="18">mdi-trash-can-outline</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <v-dialog v-model="dialogOpen" max-width="520" persistent>
            <v-card>
                <v-card-title class="dialog-title">
                    {{ dialogMode === 'create' ? '유형 추가' : '유형 수정' }}
                </v-card-title>
                <v-card-text>
                    <v-form ref="formRef" v-model="formValid" @submit.prevent>
                        <v-text-field
                            v-model="form.code"
                            label="키"
                            placeholder="예: BUSINESS_INTEGRATION"
                            :disabled="dialogMode === 'edit'"
                            :rules="[rules.required, rules.code]"
                            density="compact"
                            variant="outlined"
                        />
                        <v-text-field
                            v-model="form.label"
                            label="이름"
                            placeholder="예: 업무 통합"
                            :rules="[rules.required]"
                            density="compact"
                            variant="outlined"
                        />
                        <v-textarea
                            v-model="form.description"
                            label="설명 (선택)"
                            placeholder="유형에 대한 부가 설명"
                            rows="2"
                            density="compact"
                            variant="outlined"
                            auto-grow
                        />
                        <div class="form-row">
                            <v-text-field
                                v-model.number="form.sortOrder"
                                label="정렬 순서"
                                type="number"
                                density="compact"
                                variant="outlined"
                                class="form-row__order"
                            />
                            <v-switch v-model="form.active" label="사용" color="primary" hide-details inset class="form-row__active" />
                        </div>
                    </v-form>
                </v-card-text>
                <v-card-actions class="dialog-actions">
                    <v-spacer />
                    <v-btn variant="text" :disabled="saving" @click="closeDialog">취소</v-btn>
                    <v-btn color="primary" variant="flat" :loading="saving" :disabled="!formValid" @click="save">
                        {{ dialogMode === 'create' ? '추가' : '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteOpen" max-width="420">
            <v-card>
                <v-card-title class="dialog-title">유형 삭제</v-card-title>
                <v-card-text>
                    <span>"{{ deletingItem?.label }}" 유형을 삭제하시겠습니까?</span>
                </v-card-text>
                <v-card-actions class="dialog-actions">
                    <v-spacer />
                    <v-btn variant="text" :disabled="saving" @click="deleteOpen = false">취소</v-btn>
                    <v-btn color="error" variant="flat" :loading="saving" @click="executeDelete">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </div>
</template>

<script>
import { defineComponent } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { loadDeletedPiFlagTypes, loadPiFlagTypes, savePiFlagTypes, softDeletePiFlagType } from '@/utils/piFlagTypes';
import { getCurrentUserForSoftDelete } from '@/utils/softDeleteUser';

export default defineComponent({
    name: 'PiFlagTypeManager',
    data() {
        return {
            loading: false,
            saving: false,
            loadError: '',
            items: [],
            dialogOpen: false,
            dialogMode: 'create',
            form: this.emptyForm(),
            formValid: false,
            editingOriginalCode: '',
            deleteOpen: false,
            deletingItem: null,
            rules: {
                required: (v) => (v !== null && v !== undefined && String(v).trim() !== '') || '필수 입력 항목입니다.',
                code: (v) => /^[A-Za-z0-9_\-]+$/.test(String(v || '')) || '영문/숫자/_/- 만 사용할 수 있습니다.'
            },
            tableHeaders: [
                { title: '키', key: 'code', sortable: true, width: 200 },
                { title: '이름', key: 'label', sortable: true, width: 200 },
                { title: '설명', key: 'description', sortable: false, minWidth: 240 },
                { title: '정렬', key: 'sortOrder', sortable: true, width: 90, align: 'end' },
                { title: '상태', key: 'active', sortable: true, width: 100 },
                { title: '', key: 'actions', sortable: false, width: 96, align: 'end' }
            ]
        };
    },
    mounted() {
        this.reload();
    },
    methods: {
        emptyForm() {
            return { code: '', label: '', description: '', sortOrder: 0, active: true };
        },

        toAuditValue(item) {
            if (!item) return null;
            return {
                code: item.code,
                label: item.label,
                description: item.description || '',
                sort_order: Number(item.sortOrder ?? 0),
                active: item.active !== false
            };
        },

        async reload() {
            this.loading = true;
            this.loadError = '';
            try {
                this.items = await this.fetchItems();
            } catch (err) {
                console.warn('[PiFlagTypeManager] reload failed', err);
                this.loadError = err?.message || '유형을 불러오지 못했습니다.';
                this.items = [];
            } finally {
                this.loading = false;
            }
        },

        async fetchItems() {
            const stored = await loadPiFlagTypes();
            return stored.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.label).localeCompare(String(b.label), 'ko'));
        },

        openCreate() {
            this.dialogMode = 'create';
            this.form = this.emptyForm();
            this.editingOriginalCode = '';
            this.dialogOpen = true;
            this.$nextTick(() => this.$refs.formRef?.resetValidation?.());
        },

        openEdit(item) {
            this.dialogMode = 'edit';
            this.form = {
                code: item.code,
                label: item.label,
                description: item.description || '',
                sortOrder: Number(item.sortOrder ?? 0),
                active: item.active !== false
            };
            this.editingOriginalCode = item.code;
            this.dialogOpen = true;
            this.$nextTick(() => this.$refs.formRef?.resetValidation?.());
        },

        closeDialog() {
            this.dialogOpen = false;
            this.form = this.emptyForm();
            this.editingOriginalCode = '';
        },

        async save() {
            const valid = await this.$refs.formRef?.validate?.();
            if (valid && valid.valid === false) return;

            const isCreate = this.dialogMode === 'create';
            this.saving = true;
            await this.$try({
                action: async () => {
                    const list = await loadPiFlagTypes();
                    const next = {
                        code: String(this.form.code).trim(),
                        label: String(this.form.label).trim(),
                        description: String(this.form.description || '').trim(),
                        sortOrder: Number(this.form.sortOrder ?? 0),
                        active: this.form.active !== false
                    };

                    if (isCreate) {
                        if (list.some((it) => it.code === next.code)) {
                            throw new Error('이미 존재하는 키입니다.');
                        }
                        list.push(next);
                    } else {
                        const idx = list.findIndex((it) => it.code === this.editingOriginalCode);
                        if (idx === -1) {
                            throw new Error('수정할 유형을 찾지 못했습니다.');
                        }
                        list[idx] = { ...list[idx], ...next, code: this.editingOriginalCode };
                    }

                    await savePiFlagTypes(list);
                    if (isCreate) {
                        await useAdminConsoleStore().writeAdminAuditLog({
                            action: 'pi_flag_type_create',
                            target_type: 'pi_flag_type',
                            target_id: next.code,
                            target_name: next.label || next.code,
                            after_value: this.toAuditValue(next)
                        });
                    }
                    await this.reload();
                    this.closeDialog();
                },
                successMsg: isCreate ? '추가되었습니다.' : '저장되었습니다.'
            });
            this.saving = false;
        },

        confirmDelete(item) {
            this.deletingItem = item;
            this.deleteOpen = true;
        },

        async executeDelete() {
            if (!this.deletingItem) return;
            const target = { ...this.deletingItem };
            const targetCode = target.code;
            this.saving = true;
            await this.$try({
                action: async () => {
                    const deletedBy = getCurrentUserForSoftDelete();
                    const deleted = await softDeletePiFlagType(targetCode, deletedBy);
                    if (!deleted) throw new Error('삭제할 유형을 찾지 못했습니다.');
                    const deletedRecord = (await loadDeletedPiFlagTypes()).find((it) => it.code === targetCode);
                    await useAdminConsoleStore().writeAdminAuditLog({
                        action: 'pi_flag_type_delete',
                        target_type: 'pi_flag_type',
                        target_id: targetCode,
                        target_name: target.label || targetCode,
                        before_value: this.toAuditValue(target),
                        after_value: {
                            ...this.toAuditValue(target),
                            deleted_at: deletedRecord?.deletedAt || new Date().toISOString(),
                            deleted_by: deletedRecord?.deletedBy || deletedBy
                        },
                        comment: '휴지통 이동'
                    });
                    await this.reload();
                    this.deleteOpen = false;
                    this.deletingItem = null;
                },
                successMsg: '휴지통으로 이동되었습니다. (휴지통에서 복구/영구삭제 가능)'
            });
            this.saving = false;
        }
    }
});
</script>

<style scoped>
.pi-flag-type-manager {
    padding: 16px;
    background: #ffffff;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.pi-flag-type-manager > .section-header,
.pi-flag-type-manager > .state-area {
    flex: 0 0 auto;
}

.pi-flag-type-manager > .sk-data-table {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 16px;
}

.section-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.section-icon {
    color: #6366f1;
    font-size: 22px;
}

.section-title {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
}

.section-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.action-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.action-btn--primary {
    background: #6366f1;
    border-color: #6366f1;
    color: #ffffff;
}

.action-btn--primary:hover:not(:disabled) {
    background: #4f46e5;
    border-color: #4f46e5;
}

.state-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 24px;
    color: #6b7280;
    font-size: 13px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px dashed #e5e7eb;
}

.state-area--error {
    color: #b91c1c;
    background: #fef2f2;
    border-color: #fecaca;
}

.state-text {
    font-size: 13px;
}

.pi-flag-type-table :deep(th) {
    background: #f8fafc;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
}

.pi-flag-type-table :deep(td) {
    font-size: 12px;
    color: #1f2937;
    height: auto !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    white-space: normal;
    vertical-align: top;
}

.pi-flag-type-table :deep(tr.v-data-table__tr) {
    height: auto !important;
}

.cell-code {
    font-family: 'Roboto Mono', monospace;
    color: #4338ca;
    font-weight: 500;
}

.cell-label {
    color: #1f2937;
    font-weight: 500;
}

.cell-description {
    color: #475569;
    line-height: 1.5;
}

.cell-order {
    color: #6b7280;
    font-family: 'Roboto Mono', monospace;
}

.dialog-title {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
}

.dialog-actions {
    padding: 8px 16px 16px;
}

.form-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.form-row__order {
    flex: 0 0 140px;
}

.form-row__active {
    flex: 0 0 auto;
    margin-left: 8px;
}
</style>

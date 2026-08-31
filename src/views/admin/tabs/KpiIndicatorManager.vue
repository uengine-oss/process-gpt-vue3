<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">KPI 목표 - 신규</h1>
                </div>
                <div class="page-subtitle text-medium-emphasis">
                    지표명 · 단위 · 측정주기 · 운영정의 · 산출식 기반의 KPI 성과지표 목표를 관리합니다.
                </div>
            </div>
        </div>

        <v-card-text class="pa-4 sk-page-card-text">
            <!-- Filter Bar -->
            <v-row class="mb-4" dense align="center">
                <v-col cols="12" sm="auto" style="min-width: 320px;">
                    <v-text-field
                        v-model="searchKeyword"
                        label="검색"
                        placeholder="지표명 / 관련 프로세스로 필터"
                        prepend-inner-icon="mdi-magnify"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                    />
                </v-col>
                <v-spacer />
                <v-col v-if="isAdmin" cols="12" sm="auto">
                    <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDialog">지표 추가</v-btn>
                </v-col>
            </v-row>

            <!-- Error Alert -->
            <v-alert v-if="errorMessage" type="error" density="compact" variant="tonal" class="mb-3" closable @click:close="errorMessage = ''">
                {{ errorMessage }}
            </v-alert>

            <!-- Data Table -->
            <v-data-table
                :headers="headers"
                :items="filteredIndicators"
                :loading="loading"
                no-data-text="등록된 KPI 지표가 없습니다."
                density="compact"
                hover
                fixed-header
                :items-per-page="25"
            >
                <template v-slot:item.name="{ item }">
                    <span class="font-weight-medium">{{ item.name }}</span>
                </template>
                <template v-slot:item.definition="{ item }">
                    <div class="kpi-cell-text">{{ item.definition }}</div>
                </template>
                <template v-slot:item.formula="{ item }">
                    <div class="kpi-cell-text">{{ item.formula }}</div>
                </template>
                <template v-slot:item.target_value="{ item }">
                    {{ item.target_value != null && item.target_value !== '' ? `${item.target_value}${item.unit ? ` ${item.unit}` : ''}` : '-' }}
                </template>
                <template v-slot:item.actions="{ item }">
                    <v-btn icon variant="text" size="small" @click="openEditDialog(item)">
                        <v-icon size="18">mdi-pencil-outline</v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small" @click="confirmDelete(item)">
                        <v-icon size="18">mdi-delete-outline</v-icon>
                    </v-btn>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="dialog" max-width="640px" persistent>
            <v-card>
                <v-card-title class="pt-4 px-4">{{ editingId ? 'KPI 지표 수정' : 'KPI 지표 추가' }}</v-card-title>
                <v-card-text class="px-4">
                    <v-row dense>
                        <v-col cols="12" sm="8">
                            <v-text-field v-model="form.name" label="지표명 *" density="compact" variant="outlined" hide-details="auto" />
                        </v-col>
                        <v-col cols="6" sm="2">
                            <v-text-field v-model="form.unit" label="단위" placeholder="%" density="compact" variant="outlined" hide-details="auto" />
                        </v-col>
                        <v-col cols="6" sm="2">
                            <v-combobox
                                v-model="form.cycle"
                                :items="cycleOptions"
                                label="측정주기"
                                density="compact"
                                variant="outlined"
                                hide-details="auto"
                            />
                        </v-col>
                        <v-col cols="12">
                            <v-textarea
                                v-model="form.definition"
                                label="운영정의"
                                rows="2"
                                auto-grow
                                density="compact"
                                variant="outlined"
                                hide-details="auto"
                            />
                        </v-col>
                        <v-col cols="12">
                            <v-textarea
                                v-model="form.formula"
                                label="산출식"
                                rows="2"
                                auto-grow
                                density="compact"
                                variant="outlined"
                                hide-details="auto"
                            />
                        </v-col>
                        <v-col cols="6">
                            <v-text-field
                                v-model="form.target_value"
                                label="목표값"
                                type="number"
                                density="compact"
                                variant="outlined"
                                hide-details="auto"
                            />
                        </v-col>
                        <v-col cols="6">
                            <v-text-field
                                v-model="form.proc_name"
                                label="관련 프로세스"
                                placeholder="예: P5.4.3 내부심사 프로세스"
                                density="compact"
                                variant="outlined"
                                hide-details="auto"
                            />
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer />
                    <v-btn variant="text" @click="closeDialog">취소</v-btn>
                    <v-btn color="primary" variant="flat" :loading="saving" :disabled="!form.name || !form.name.trim()" @click="save">
                        저장
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirm Dialog -->
        <v-dialog v-model="deleteDialog" max-width="420px">
            <v-card>
                <v-card-title class="pt-4 px-4">지표 삭제</v-card-title>
                <v-card-text class="px-4">
                    <strong>{{ deleteTarget?.name }}</strong> 지표를 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialog = false">취소</v-btn>
                    <v-btn color="error" variant="flat" :loading="saving" @click="remove">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { authClaimsState } from '@/utils/authClaims';

export default defineComponent({
    name: 'KpiIndicatorManager',

    setup() {
        const backend = BackendFactory.createBackend();

        // 권한: isAdmin 만 추가/수정/삭제 가능 (그 외 조회 전용)
        const isAdmin = computed(() => authClaimsState.isAdmin === true);

        const indicators = ref([]);
        const loading = ref(false);
        const saving = ref(false);
        const errorMessage = ref('');
        const searchKeyword = ref('');

        const dialog = ref(false);
        const editingId = ref(null);
        const emptyForm = () => ({
            name: '',
            unit: '',
            cycle: '',
            definition: '',
            formula: '',
            target_value: null,
            proc_name: ''
        });
        const form = ref(emptyForm());

        const deleteDialog = ref(false);
        const deleteTarget = ref(null);

        const cycleOptions = ['1회/월', '1회/분기', '1회/반기', '1회/년'];

        const headers = computed(() => {
            const base = [
                { title: '지표명', key: 'name', width: '18%' },
                { title: '단위', key: 'unit', width: '7%' },
                { title: '측정주기', key: 'cycle', width: '9%' },
                { title: '운영정의', key: 'definition', width: '24%' },
                { title: '산출식', key: 'formula', width: '24%' },
                { title: '목표값', key: 'target_value', width: '9%' },
                { title: '관련 프로세스', key: 'proc_name', width: '12%' }
            ];
            if (isAdmin.value) {
                base.push({ title: '', key: 'actions', sortable: false, width: '96px', align: 'end' });
            }
            return base;
        });

        const filteredIndicators = computed(() => {
            const keyword = (searchKeyword.value || '').trim().toLowerCase();
            if (!keyword) return indicators.value;
            return indicators.value.filter((item) =>
                [item.name, item.proc_name].some((v) => (v || '').toString().toLowerCase().includes(keyword))
            );
        });

        async function load() {
            loading.value = true;
            try {
                indicators.value = await backend.getKpiIndicators();
            } catch (e) {
                console.error('[KpiIndicatorManager] load error:', e);
                errorMessage.value = 'KPI 지표를 불러오지 못했습니다.';
            } finally {
                loading.value = false;
            }
        }

        function openAddDialog() {
            editingId.value = null;
            form.value = emptyForm();
            dialog.value = true;
        }

        function openEditDialog(item) {
            editingId.value = item.id;
            form.value = {
                name: item.name || '',
                unit: item.unit || '',
                cycle: item.cycle || '',
                definition: item.definition || '',
                formula: item.formula || '',
                target_value: item.target_value,
                proc_name: item.proc_name || ''
            };
            dialog.value = true;
        }

        function closeDialog() {
            dialog.value = false;
            editingId.value = null;
        }

        async function save() {
            if (!form.value.name || !form.value.name.trim()) return;
            saving.value = true;
            errorMessage.value = '';
            try {
                await backend.upsertKpiIndicator({
                    id: editingId.value || undefined,
                    category: 'KPI',
                    name: form.value.name.trim(),
                    unit: (form.value.unit || '').trim(),
                    cycle: (form.value.cycle || '').trim(),
                    definition: (form.value.definition || '').trim(),
                    formula: (form.value.formula || '').trim(),
                    target_value: form.value.target_value === '' || form.value.target_value == null ? null : Number(form.value.target_value),
                    proc_name: (form.value.proc_name || '').trim(),
                    created_by: localStorage.getItem('uid') || ''
                });
                closeDialog();
                await load();
            } catch (e) {
                console.error('[KpiIndicatorManager] save error:', e);
                errorMessage.value = 'KPI 지표 저장에 실패했습니다.';
            } finally {
                saving.value = false;
            }
        }

        function confirmDelete(item) {
            deleteTarget.value = item;
            deleteDialog.value = true;
        }

        async function remove() {
            if (!deleteTarget.value?.id) return;
            saving.value = true;
            errorMessage.value = '';
            try {
                await backend.deleteKpiIndicator(deleteTarget.value.id);
                deleteDialog.value = false;
                deleteTarget.value = null;
                await load();
            } catch (e) {
                console.error('[KpiIndicatorManager] delete error:', e);
                errorMessage.value = 'KPI 지표 삭제에 실패했습니다.';
            } finally {
                saving.value = false;
            }
        }

        onMounted(load);

        return {
            isAdmin,
            indicators,
            loading,
            saving,
            errorMessage,
            searchKeyword,
            dialog,
            editingId,
            form,
            deleteDialog,
            deleteTarget,
            cycleOptions,
            headers,
            filteredIndicators,
            openAddDialog,
            openEditDialog,
            closeDialog,
            save,
            confirmDelete,
            remove
        };
    }
});
</script>

<style scoped>
.page-subtitle {
    font-size: 13px;
    margin-top: 2px;
}

.kpi-cell-text {
    font-size: 12px;
    white-space: pre-line;
    padding: 4px 0;
}
</style>

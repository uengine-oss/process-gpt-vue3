<template>
    <v-dialog v-model="dialogOpen" max-width="700" persistent>
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-folder-plus</v-icon>
                {{ $t('taskCatalog.saveToCatalog') || 'Save to Catalog' }}
            </v-card-title>

            <v-card-text>
                <v-alert v-if="existingItem" type="warning" variant="tonal" class="mb-4" density="compact">
                    {{ $t('taskCatalog.taskExistsWarning') || '동일한 이름과 시스템의 Task가 이미 존재합니다. 저장하면 업데이트됩니다.' }}
                </v-alert>

                <v-form ref="formRef" v-model="formValid">
                    <!-- Task Name - readonly, from element -->
                    <v-text-field
                        v-model="formData.name"
                        :label="$t('taskCatalog.taskName') || 'Task Name'"
                        readonly
                        disabled
                        class="mb-2"
                        variant="outlined"
                        bg-color="grey-lighten-4"
                    />

                    <!-- Task Type - readonly, from element -->
                    <v-text-field
                        v-model="formData.task_type"
                        :label="$t('taskCatalog.taskType') || 'Task Type'"
                        readonly
                        disabled
                        class="mb-2"
                        variant="outlined"
                        bg-color="grey-lighten-4"
                    />

                    <v-select
                        v-model="formData.system_name"
                        :items="systems"
                        :label="$t('taskCatalog.system') || 'System (OSS)'"
                        item-title="name"
                        item-value="name"
                        :rules="[v => !!v || 'Required']"
                        required
                        class="mb-2"
                    >
                        <template v-slot:append>
                            <v-btn
                                icon
                                size="x-small"
                                variant="text"
                                @click="showNewSystemDialog = true"
                            >
                                <v-icon>mdi-plus</v-icon>
                            </v-btn>
                        </template>
                    </v-select>

                    <v-select
                        v-model="formData.level"
                        :items="['L2', 'L3', 'L4', 'L5']"
                        :label="$t('taskCatalog.level') || 'Level'"
                        clearable
                        class="mb-2"
                    />

                    <!-- FTE Input Section -->
                    <v-expansion-panels v-model="ftePanel" class="mb-2 fte-panel">
                        <v-expansion-panel value="fte" elevation="0">
                            <v-expansion-panel-title class="fte-panel-title">
                                <div class="d-flex align-center">
                                    <v-icon class="mr-2" size="small" color="primary">mdi-calculator-variant</v-icon>
                                    <span class="font-weight-medium">{{ $t('fteInput.title') || 'FTE 입력' }}</span>
                                    <v-chip v-if="formData.fte" size="small" class="ml-3" color="primary" variant="flat">
                                        {{ formData.fte.toFixed(3) }} FTE
                                    </v-chip>
                                </div>
                            </v-expansion-panel-title>
                            <v-expansion-panel-text class="fte-panel-content">
                                <!-- 가이드 버튼 & 설명 -->
                                <div class="d-flex align-center mb-4">
                                    <v-btn
                                        variant="tonal"
                                        size="small"
                                        color="info"
                                        @click="showFteGuide = true"
                                    >
                                        <v-icon start size="16">mdi-help-circle-outline</v-icon>
                                        {{ $t('fteInput.guide') || 'FTE 입력 가이드' }}
                                    </v-btn>
                                    <span class="text-caption text-medium-emphasis ml-3">
                                        {{ $t('fteInput.description') || '※ 개인 판단 비중 또는 시간×반복×인원으로 입력하세요.' }}
                                    </span>
                                </div>

                                <!-- 적용 기간 & 저장 주체 -->
                                <v-card variant="outlined" class="mb-4 pa-3">
                                    <v-row dense>
                                        <v-col cols="4">
                                            <v-menu
                                                v-model="showPeriodPicker"
                                                :close-on-content-click="false"
                                                location="bottom start"
                                            >
                                                <template v-slot:activator="{ props }">
                                                    <v-text-field
                                                        v-bind="props"
                                                        :model-value="fteData.period"
                                                        :label="$t('fteInput.period') || '적용 기간'"
                                                        density="compact"
                                                        variant="outlined"
                                                        hide-details
                                                        readonly
                                                        append-inner-icon="mdi-calendar"
                                                    />
                                                </template>
                                                <v-date-picker
                                                    v-model="selectedMonth"
                                                    view-mode="months"
                                                    hide-header
                                                    @update:model-value="onMonthSelect"
                                                />
                                            </v-menu>
                                        </v-col>
                                        <v-col cols="3">
                                            <v-select
                                                v-model="fteData.subjectType"
                                                :items="subjectTypes"
                                                item-title="label"
                                                item-value="value"
                                                :label="$t('fteInput.subjectType') || '주체 타입'"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                            />
                                        </v-col>
                                        <v-col cols="5">
                                            <v-text-field
                                                v-model="fteData.subjectId"
                                                :label="$t('fteInput.subjectId') || '주체 ID'"
                                                :placeholder="subjectIdPlaceholder"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                            />
                                        </v-col>
                                    </v-row>
                                </v-card>

                                <!-- 입력 모드 -->
                                <div class="d-flex align-center mb-3">
                                    <span class="text-subtitle-2 mr-4">{{ $t('fteInput.inputMode') || '입력 모드' }}</span>
                                    <v-btn-toggle v-model="fteData.inputMode" mandatory density="compact" color="primary">
                                        <v-btn value="direct" size="small">
                                            {{ $t('fteInput.directPercent') || '직접 비중(%)' }}
                                        </v-btn>
                                        <v-btn value="calculation" size="small">
                                            {{ $t('fteInput.timeCalculation') || '시간×반복×인원' }}
                                        </v-btn>
                                    </v-btn-toggle>
                                </div>

                                <!-- 직접 비중 입력 -->
                                <v-card v-if="fteData.inputMode === 'direct'" variant="outlined" class="mb-4 pa-3">
                                    <div class="d-flex align-center">
                                        <v-text-field
                                            v-model.number="fteData.directPercent"
                                            :label="$t('fteInput.percentLabel') || '비중'"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            style="max-width: 200px;"
                                            @update:model-value="calculateFte"
                                        >
                                            <template v-slot:append-inner>
                                                <span class="text-medium-emphasis">%</span>
                                            </template>
                                        </v-text-field>
                                        <v-icon class="mx-3" color="grey">mdi-arrow-right</v-icon>
                                        <div class="fte-result-box">
                                            <span class="text-h6 font-weight-bold text-primary">{{ formData.fte?.toFixed(3) || '0.000' }}</span>
                                            <span class="text-caption ml-1">FTE</span>
                                        </div>
                                    </div>
                                </v-card>

                                <!-- 시간×반복×인원 입력 -->
                                <v-card v-if="fteData.inputMode === 'calculation'" variant="outlined" class="mb-4 pa-3">
                                    <v-row dense class="mb-3" align="end">
                                        <v-col cols="6" sm="3">
                                            <div class="fte-number-input">
                                                <label class="fte-input-label">{{ $t('fteInput.repeatCycle') || '반복 주기' }}</label>
                                                <v-select
                                                    v-model="fteData.repeatCycle"
                                                    :items="repeatCycleOptions"
                                                    item-title="label"
                                                    item-value="value"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    class="fte-select"
                                                    @update:model-value="calculateFte"
                                                />
                                            </div>
                                        </v-col>
                                        <v-col cols="6" sm="3">
                                            <div class="fte-number-input">
                                                <label class="fte-input-label">{{ $t('fteInput.repeatCount') || '주기 내 반복' }}</label>
                                                <div class="fte-stepper">
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.repeatCount = Math.max(1, fteData.repeatCount - 1); calculateFte()">
                                                        <v-icon size="18">mdi-minus</v-icon>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        v-model.number="fteData.repeatCount"
                                                        min="1"
                                                        class="fte-stepper-input"
                                                        @input="calculateFte"
                                                    />
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.repeatCount++; calculateFte()">
                                                        <v-icon size="18">mdi-plus</v-icon>
                                                    </button>
                                                </div>
                                            </div>
                                        </v-col>
                                        <v-col cols="6" sm="3">
                                            <div class="fte-number-input">
                                                <label class="fte-input-label">{{ $t('fteInput.hoursPerTime') || '1회 소요시간' }}</label>
                                                <div class="fte-stepper">
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.hoursPerTime = Math.max(0, parseFloat(fteData.hoursPerTime) - 0.5); calculateFte()">
                                                        <v-icon size="18">mdi-minus</v-icon>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        v-model.number="fteData.hoursPerTime"
                                                        min="0"
                                                        step="0.5"
                                                        class="fte-stepper-input"
                                                        @input="calculateFte"
                                                    />
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.hoursPerTime = parseFloat(fteData.hoursPerTime) + 0.5; calculateFte()">
                                                        <v-icon size="18">mdi-plus</v-icon>
                                                    </button>
                                                </div>
                                            </div>
                                        </v-col>
                                        <v-col cols="6" sm="3">
                                            <div class="fte-number-input">
                                                <label class="fte-input-label">{{ $t('fteInput.peopleCount') || '동시 인원' }}</label>
                                                <div class="fte-stepper">
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.peopleCount = Math.max(0, parseFloat(fteData.peopleCount) - 0.5); calculateFte()">
                                                        <v-icon size="18">mdi-minus</v-icon>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        v-model.number="fteData.peopleCount"
                                                        min="0"
                                                        step="0.5"
                                                        class="fte-stepper-input"
                                                        @input="calculateFte"
                                                    />
                                                    <button type="button" class="fte-stepper-btn" @click="fteData.peopleCount = parseFloat(fteData.peopleCount) + 0.5; calculateFte()">
                                                        <v-icon size="18">mdi-plus</v-icon>
                                                    </button>
                                                </div>
                                            </div>
                                        </v-col>
                                    </v-row>

                                    <!-- 계산 결과 -->
                                    <div class="fte-calculation-result">
                                        <div class="fte-formula">
                                            <span class="text-primary">→</span>
                                            <span>{{ fteData.hoursPerTime }}h</span>
                                            <span class="text-grey mx-1">×</span>
                                            <span>{{ annualRepeatCount }}{{ $t('fteInput.timesPerYear') || '회/년' }}</span>
                                            <span class="text-grey mx-1">×</span>
                                            <span>{{ fteData.peopleCount }}{{ $t('fteInput.people') || '명' }}</span>
                                            <span class="text-grey mx-1">÷</span>
                                            <span>2080h</span>
                                            <span class="text-grey mx-2">=</span>
                                        </div>
                                        <div class="fte-result-box">
                                            <span class="text-h5 font-weight-bold text-primary">{{ formData.fte?.toFixed(3) || '0.000' }}</span>
                                            <span class="text-body-2 ml-1">FTE</span>
                                        </div>
                                    </div>
                                </v-card>

                                <!-- 메모 -->
                                <v-textarea
                                    v-model="fteData.memo"
                                    :label="$t('fteInput.memo') || '메모(선택)'"
                                    :placeholder="$t('fteInput.memoPlaceholder') || '예: 23년 평균 기준, 상반기 2회 증가 예상 등'"
                                    rows="2"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="close">
                    {{ $t('taskCatalog.cancel') || 'Cancel' }}
                </v-btn>
                <v-btn
                    color="primary"
                    :loading="saving"
                    :disabled="!formValid || !formData.name"
                    @click="save"
                >
                    {{ $t('taskCatalog.save') || 'Save' }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- New System Dialog -->
        <v-dialog v-model="showNewSystemDialog" max-width="400">
            <v-card>
                <v-card-title>{{ $t('taskCatalog.addSystem') || 'Add System' }}</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="newSystemName"
                        :label="$t('taskCatalog.systemName') || 'System Name'"
                        autofocus
                    />
                    <v-textarea
                        v-model="newSystemDescription"
                        :label="$t('taskCatalog.description') || 'Description'"
                        rows="2"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="showNewSystemDialog = false">
                        {{ $t('taskCatalog.cancel') || 'Cancel' }}
                    </v-btn>
                    <v-btn color="primary" @click="addNewSystem" :disabled="!newSystemName">
                        {{ $t('taskCatalog.add') || 'Add' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'SaveToCatalogDialog',
    props: {
        modelValue: Boolean,
        element: Object  // BPMN element to save
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const store = useTaskCatalogStore();

        const dialogOpen = computed({
            get: () => props.modelValue,
            set: (val) => emit('update:modelValue', val)
        });

        const formRef = ref(null);
        const formValid = ref(false);
        const saving = ref(false);
        const showNewSystemDialog = ref(false);
        const showFteGuide = ref(false);
        const showPeriodPicker = ref(false);
        const selectedMonth = ref(null);
        const newSystemName = ref('');
        const newSystemDescription = ref('');
        const ftePanel = ref(null);

        const systems = computed(() => store.systems);

        const formData = ref({
            name: '',
            system_name: '',
            level: null,
            fte: null,
            task_type: ''
        });

        // FTE 입력 데이터
        const fteData = ref({
            period: '',
            subjectType: 'person',
            subjectId: '',
            inputMode: 'calculation',
            directPercent: 0,
            repeatCycle: 'monthly',
            repeatCount: 1,
            hoursPerTime: 0,
            peopleCount: 1,
            memo: ''
        });

        // 적용 기간 옵션 생성 (최근 12개월)
        const periodOptions = computed(() => {
            const options = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const value = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
                options.push(value);
            }
            return options;
        });

        // 주체 타입 옵션
        const subjectTypes = [
            { value: 'person', label: 'person' },
            { value: 'team', label: 'team' },
            { value: 'domain', label: 'domain' }
        ];

        // 주체 ID placeholder
        const subjectIdPlaceholder = computed(() => {
            switch (fteData.value.subjectType) {
                case 'person': return 'user: 사번/ID, team: 팀코드, domain: 도메인ID (미입력시 기본값)';
                case 'team': return '팀코드';
                case 'domain': return '도메인ID';
                default: return '';
            }
        });

        // 반복 주기 옵션
        const repeatCycleOptions = [
            { value: 'daily', label: '일간' },
            { value: 'weekly', label: '주간' },
            { value: 'monthly', label: '월간' },
            { value: 'yearly', label: '연간' }
        ];

        // 연간 반복 횟수 계산
        const annualRepeatCount = computed(() => {
            const count = fteData.value.repeatCount || 0;
            switch (fteData.value.repeatCycle) {
                case 'daily': return count * 365;
                case 'weekly': return count * 52;
                case 'monthly': return count * 12;
                case 'yearly': return count;
                default: return count * 12;
            }
        });

        // FTE 계산
        const calculateFte = () => {
            if (fteData.value.inputMode === 'direct') {
                formData.value.fte = (fteData.value.directPercent || 0) / 100;
            } else {
                const hours = fteData.value.hoursPerTime || 0;
                const annual = annualRepeatCount.value;
                const people = fteData.value.peopleCount || 0;
                const fte = (hours * annual * people) / 2080;
                formData.value.fte = parseFloat(fte.toFixed(3));
            }
        };

        // 적용 기간 초기값 설정
        const initPeriod = () => {
            const now = new Date();
            fteData.value.period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            selectedMonth.value = now;
        };

        // 월 선택 처리
        const onMonthSelect = (date) => {
            if (date) {
                const d = new Date(date);
                fteData.value.period = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            showPeriodPicker.value = false;
        };

        // Store full task properties from extension elements
        const taskProperties = ref({});

        // Check if task with same name and system already exists
        const existingItem = computed(() => {
            if (!formData.value.name || !formData.value.system_name) return null;
            return store.catalogItems.find(item =>
                item.name === formData.value.name &&
                item.system_name === formData.value.system_name
            );
        });

        // Initialize form data from BPMN element
        watch(() => props.modelValue, async (open) => {
            if (open && props.element) {
                // Load systems if not loaded
                if (!store.systemsLoaded) {
                    await store.loadSystems();
                }
                if (!store.catalogLoaded) {
                    await store.loadCatalog();
                }

                // element might be a shape (has businessObject) or the businessObject itself
                const bo = props.element.businessObject || props.element;
                // Use $type for BPMN elements (not type)
                const elementType = props.element.$type || props.element.type || bo?.$type || 'bpmn:ManualTask';

                console.log('SaveToCatalog - Element:', props.element);
                console.log('SaveToCatalog - BusinessObject:', bo);
                console.log('SaveToCatalog - ElementType:', elementType);
                console.log('SaveToCatalog - BO Name:', bo?.name);
                console.log('SaveToCatalog - BO ExtensionElements:', bo?.extensionElements);

                // Extract properties from extension elements
                taskProperties.value = {};
                let existingSystemName = '';
                let existingLevel = null;
                let existingFte = null;

                if (bo?.extensionElements?.values) {
                    const uengineProps = bo.extensionElements.values.find(v => v.$type === 'uengine:Properties');
                    if (uengineProps?.json) {
                        try {
                            const parsedProps = JSON.parse(uengineProps.json);
                            console.log('SaveToCatalog - ParsedProps:', parsedProps);
                            // Store ALL task properties for saving
                            taskProperties.value = { ...parsedProps };
                            // Extract catalog-specific fields
                            existingSystemName = parsedProps._systemName || '';
                            existingLevel = parsedProps.level || null;
                            existingFte = parsedProps.fte || null;
                        } catch (e) {
                            console.error('Failed to parse extension properties:', e);
                        }
                    }
                }

                // Set form data - name comes from element and is readonly
                formData.value = {
                    name: bo?.name || '',
                    system_name: existingSystemName,
                    level: existingLevel,
                    fte: existingFte,
                    task_type: elementType
                };

                // Initialize FTE data
                initPeriod();
                fteData.value = {
                    period: fteData.value.period,
                    subjectType: 'person',
                    subjectId: '',
                    inputMode: 'calculation',
                    directPercent: existingFte ? existingFte * 100 : 0,
                    repeatCycle: 'monthly',
                    repeatCount: 1,
                    hoursPerTime: 0,
                    peopleCount: 1,
                    memo: ''
                };

                console.log('SaveToCatalog - FormData:', formData.value);
                console.log('SaveToCatalog - TaskProperties:', taskProperties.value);
            }
        });

        const close = () => {
            dialogOpen.value = false;
        };

        const save = async () => {
            saving.value = true;
            try {
                const system = systems.value.find(s => s.name === formData.value.system_name);

                // Merge all task properties with form data
                // This preserves ALL settings from the original task
                const allProperties = {
                    ...taskProperties.value,
                    fte: formData.value.fte,
                    level: formData.value.level,
                    _systemName: formData.value.system_name
                };
                // Remove internal catalog references to avoid circular data
                delete allProperties._catalogId;

                const catalogItem = {
                    id: existingItem.value?.id,  // Update if exists
                    name: formData.value.name,
                    system_name: formData.value.system_name,
                    system_id: system?.id,
                    display_name: formData.value.name,
                    task_type: formData.value.task_type,
                    level: formData.value.level,
                    properties: allProperties
                };

                console.log('SaveToCatalog - Saving:', catalogItem);

                await store.saveCatalogItem(catalogItem);
                emit('saved', catalogItem);
                close();
            } catch (error) {
                console.error('Failed to save to catalog:', error);
            } finally {
                saving.value = false;
            }
        };

        const addNewSystem = async () => {
            if (!newSystemName.value) return;

            try {
                await store.saveSystem({
                    name: newSystemName.value,
                    description: newSystemDescription.value
                });
                formData.value.system_name = newSystemName.value;
                newSystemName.value = '';
                newSystemDescription.value = '';
                showNewSystemDialog.value = false;
            } catch (error) {
                console.error('Failed to add system:', error);
            }
        };

        return {
            dialogOpen,
            formRef,
            formValid,
            saving,
            formData,
            systems,
            existingItem,
            showNewSystemDialog,
            showFteGuide,
            showPeriodPicker,
            selectedMonth,
            newSystemName,
            newSystemDescription,
            ftePanel,
            fteData,
            periodOptions,
            subjectTypes,
            subjectIdPlaceholder,
            repeatCycleOptions,
            annualRepeatCount,
            calculateFte,
            onMonthSelect,
            close,
            save,
            addNewSystem
        };
    }
});
</script>

<style scoped>
.fte-panel {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
}

.fte-panel-title {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    min-height: 48px !important;
}

.fte-panel-content {
    background-color: #fafafa;
}

.fte-number-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.fte-input-label {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 4px;
}

.fte-select :deep(.v-field) {
    height: 40px;
}

.fte-select :deep(.v-field__input) {
    padding-top: 8px;
    padding-bottom: 8px;
    min-height: 40px;
}

.fte-stepper {
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
    height: 40px;
}

.fte-stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 100%;
    border: none;
    background: #f5f5f5;
    cursor: pointer;
    transition: background-color 0.15s;
    flex-shrink: 0;
}

.fte-stepper-btn:hover {
    background: #e0e0e0;
}

.fte-stepper-btn:active {
    background: #bdbdbd;
}

.fte-stepper-input {
    flex: 1;
    min-width: 40px;
    text-align: center;
    border: none;
    border-left: 1px solid rgba(0, 0, 0, 0.12);
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    outline: none;
    font-size: 15px;
    font-weight: 500;
    background: transparent;
    height: 100%;
    -moz-appearance: textfield;
}

.fte-stepper-input::-webkit-outer-spin-button,
.fte-stepper-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.fte-calculation-result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    border-radius: 8px;
}

.fte-formula {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 14px;
}

.fte-result-box {
    display: flex;
    align-items: baseline;
    padding: 8px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>

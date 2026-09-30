<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        :fullscreen="isMobile"
        :max-width="isMobile ? '100%' : '700px'"
        persistent
    >
        <v-card>
            <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                <!-- id 없는 item 은 프리필 신규 등록 (예: 속성패널의 '카탈로그에 저장') -->
                {{ item?.id ? $t('taskCatalog.editTask') : $t('taskCatalog.addTask') }}
                <v-btn variant="text" density="compact" icon @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pa-4 pb-0" style="overflow: auto; max-height: 70vh">
                <v-form ref="formRef" v-model="formValid">
                    <!-- Task 유형 — 아래 패널 구성(섹션·필드)이 이 유형 기준으로 바뀐다 -->
                    <v-select
                        v-model="formData.task_type"
                        :items="availableTaskTypes"
                        :label="$t('taskCatalog.taskType')"
                        item-title="label"
                        item-value="value"
                        :rules="[(v) => !!v || $t('taskCatalog.required')]"
                        density="compact"
                        variant="outlined"
                        required
                    />
                    <div class="text-caption text-medium-emphasis mb-3">
                        {{ $t('taskCatalog.panelPreviewHint') }}
                    </div>

                    <!-- 순서도 속성패널(Task 탭)과 같은 섹션 구성·순서(display_order)·스타일로 렌더한다
                         (속성 스키마 스튜디오의 미리보기와 동일한 규칙). 여기 입력한 값은 properties 에
                         저장돼 순서도에 적용할 때 태스크 속성으로 그대로 들어간다. -->
                    <div class="catalog-panel-preview">
                        <template v-for="sec in panelSections" :key="'catalog-sec-' + sec.id">
                            <!-- 전용 위젯 섹션(폼 연결·API 연동 등)은 순서도에서 설정 — 자리표시로만 노출 -->
                            <div v-if="sec.kind === 'placeholder'" class="section-placeholder">
                                <v-icon size="14" :color="sec.color">{{ sec.icon }}</v-icon>
                                <span class="section-placeholder__label">{{ sec.label }}</span>
                                <span class="section-placeholder__badge">{{ $t('taskCatalog.setInDiagram') }}</span>
                            </div>

                            <div v-else class="section-group">
                                <div class="section-title" @click="toggleSection(sec.id)">
                                    <v-icon size="14" class="mr-1">
                                        {{ isSectionOpen(sec.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                    </v-icon>
                                    <v-icon size="14" class="mr-1" :color="sec.color">{{ sec.icon }}</v-icon>
                                    {{ sec.label }}
                                </div>
                                <div v-show="isSectionOpen(sec.id)" class="section-body">
                                    <!-- 일반: 이름·설명(내장)과 무그룹 커스텀 필드를 display_order 로 통합 정렬 (패널과 동일) -->
                                    <template v-if="sec.kind === 'general'">
                                        <template v-for="entry in generalItems" :key="'general-' + entry.id">
                                            <template v-if="entry.kind === 'name'">
                                                <label class="field-label">
                                                    {{ store.builtinPropLabel('task', 'name', $t('taskCatalog.taskName')) }} *
                                                </label>
                                                <v-text-field
                                                    v-model="formData.name"
                                                    :rules="[(v) => !!v || $t('taskCatalog.required')]"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details="auto"
                                                    class="mb-2"
                                                />
                                            </template>
                                            <template v-else-if="entry.kind === 'description'">
                                                <label class="field-label">
                                                    {{ store.builtinPropLabel('task', 'description', $t('taskCatalog.description')) }}
                                                </label>
                                                <v-textarea
                                                    v-model="formData.description"
                                                    rows="2"
                                                    auto-grow
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    class="mb-2"
                                                />
                                            </template>
                                            <SchemaFieldInput v-else :field="entry.field" :model="formData.properties" />
                                        </template>
                                    </template>

                                    <!-- 사용자 정의 그룹(묶음) — 속성 스키마 스튜디오에서 정의 -->
                                    <template v-else-if="sec.kind === 'group'">
                                        <SchemaFieldInput
                                            v-for="field in sec.group.fields"
                                            :key="field.id"
                                            :field="field"
                                            :model="formData.properties"
                                        />
                                    </template>

                                    <!-- 내장 전용 위젯 — 패널과 같은 컴포넌트를 그대로 사용 -->
                                    <RaciField
                                        v-else-if="sec.kind === 'raci'"
                                        v-model="formData.properties.raci"
                                        :suggestions="[]"
                                        :dialog-mode="true"
                                    />
                                    <TaskIoField
                                        v-else-if="sec.kind === 'task_io'"
                                        :procedure="formData.properties.procedure"
                                        :dialog-mode="true"
                                        @update:procedure="formData.properties.procedure = $event"
                                    />
                                    <ManualLinkField v-else-if="sec.kind === 'manual_links'" v-model="formData.properties.manualLinks" />
                                </div>
                            </div>
                        </template>
                    </div>

                    <!-- 필수 속성 미입력 안내 -->
                    <v-alert v-if="missingRequiredLabels.length" type="warning" variant="tonal" density="compact" class="mt-1 mb-3">
                        {{ $t('taskCatalog.required') }}: {{ missingRequiredLabels.join(', ') }}
                    </v-alert>
                </v-form>
            </v-card-text>

            <v-card-actions class="d-flex justify-end align-center pa-4">
                <!-- 저장 가능 여부는 클릭 시 검증한다 — v-form 의 초기 검증 전(null) 상태로 버튼이 잠기지 않게 -->
                <v-btn color="primary" rounded variant="flat" :loading="loading" :disabled="missingRequiredLabels.length > 0" @click="save">
                    {{ $t('taskCatalog.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, watch, computed, getCurrentInstance } from 'vue';
import { useTaskCatalogStore, AVAILABLE_TASK_TYPES, groupSchemaFields } from '@/stores/taskCatalog';
import SchemaFieldInput from '@/components/ui/SchemaFieldInput.vue';
import RaciField from '@/components/designer/RaciField.vue';
import TaskIoField from '@/components/designer/TaskIoField.vue';
import ManualLinkField from '@/components/ui/ManualLinkField.vue';

// 패널(ProcessHierarchyProperties)·스튜디오 미리보기와 같은 섹션 아이콘
const SECTION_ICONS = {
    general: { icon: 'mdi-information-outline', color: 'blue-grey' },
    group: { icon: 'mdi-shape-outline', color: 'blue-grey' },
    form_link: { icon: 'mdi-form-select', color: 'primary' },
    raci: { icon: 'mdi-table-account', color: 'deep-purple' },
    task_io: { icon: 'mdi-swap-horizontal', color: 'blue' },
    manual_links: { icon: 'mdi-link-variant', color: 'indigo' },
    api_integrations: { icon: 'mdi-api', color: 'teal' },
    data_io: { icon: 'mdi-database-import-outline', color: 'teal' },
    costing: { icon: 'mdi-clock-outline', color: 'teal' },
    system_mapping: { icon: 'mdi-server-network', color: 'blue' },
    related_projects: { icon: 'mdi-clipboard-list-outline', color: 'purple' },
    pi_flag: { icon: 'mdi-flag-outline', color: 'red' }
};

// 패널의 Task 탭 섹션 정의(TASK_PANEL_SECTION_DEFS)와 같은 기본 순서.
// kind 가 편집 가능한 섹션은 전용 컴포넌트로, placeholder 는 순서도에서만 설정하는 항목의 자리표시.
const PANEL_SECTION_DEFS = [
    { id: 'form_link', key: 'form_link', kind: 'placeholder', fallbackOrder: 40, taskLikeOnly: false },
    { id: 'raci', key: 'raci', kind: 'raci', fallbackOrder: 50, taskLikeOnly: true },
    { id: 'task_io', key: 'task_io', kind: 'task_io', fallbackOrder: 60, taskLikeOnly: true },
    { id: 'manual_links', key: 'manual_links', kind: 'manual_links', fallbackOrder: 70, taskLikeOnly: false },
    { id: 'api_integrations', key: 'api_integrations', kind: 'placeholder', fallbackOrder: 80, taskLikeOnly: false },
    { id: 'data_io', key: 'data_io', kind: 'placeholder', fallbackOrder: 90, taskLikeOnly: false },
    { id: 'costing', key: 'fte_calculator', kind: 'placeholder', fallbackOrder: 100, taskLikeOnly: false },
    { id: 'system_mapping', key: 'system_mapping', kind: 'placeholder', fallbackOrder: 120, taskLikeOnly: false },
    { id: 'related_projects', key: 'related_project_mapping', kind: 'placeholder', fallbackOrder: 130, taskLikeOnly: false },
    { id: 'pi_flag', key: 'pi_flag', kind: 'placeholder', fallbackOrder: 140, taskLikeOnly: false }
];

const SECTION_FALLBACK_LABELS = {
    form_link: '폼 연결',
    raci: 'RACI',
    task_io: '세부 업무 수행 절차',
    manual_links: '관련자료 링크',
    api_integrations: 'API 연동',
    data_io: '입출력 데이터',
    fte_calculator: 'FTE / OPEX',
    system_mapping: '시스템 매핑',
    related_project_mapping: '연관 과제 매핑',
    pi_flag: 'PI Flag'
};

export default defineComponent({
    name: 'TaskCatalogDialog',
    components: {
        SchemaFieldInput,
        RaciField,
        TaskIoField,
        ManualLinkField
    },
    props: {
        modelValue: Boolean,
        item: Object
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const isMobile = computed(() => window.innerWidth <= 768);
        const formRef = ref(null);
        const formValid = ref(false);
        const loading = ref(false);

        const availableTaskTypes = computed(() => {
            return AVAILABLE_TASK_TYPES.map((item) => ({
                ...item,
                label: locale.value === 'ko' ? item.labelKo : item.label
            }));
        });

        const defaultFormData = () => ({
            name: '',
            task_type: 'bpmn:ManualTask',
            description: '',
            properties: {}
        });

        const formData = ref(defaultFormData());

        // 현행 스키마 소스: applies_to(task/BPMN 타입) 기준 — 패널 연결 내장 속성·비활성·삭제 행은 제외된다.
        // 순서도 속성패널(Task 탭)과 같은 필드 집합을 보여준다.
        const propertySchemas = computed(() => {
            if (!formData.value.task_type) return [];
            return store.schemasByAppliesTo('task', formData.value.task_type);
        });

        // 내장(panel) 속성 — 순서도 Task 탭과 동일하게 노출 설정(속성 스키마 스튜디오)을 따른다.
        // RACI/세부절차는 Task 계열 요소에만 의미가 있다 (패널의 isRaciTaskElement 판정과 동일).
        const isTaskLikeType = computed(() => String(formData.value.task_type || '').includes('Task'));

        // 그룹(묶음) 뷰 — 무그룹은 일반 영역, 그룹은 별도 섹션 (속성패널과 동일 규칙)
        const fieldGroups = computed(() => groupSchemaFields(propertySchemas.value));
        const defaultGroupFields = computed(() => fieldGroups.value.find((g) => !g.key)?.fields || []);
        const namedGroups = computed(() => fieldGroups.value.filter((g) => g.key));

        // 내장 행의 display_order — 관리자가 스튜디오에서 순서를 바꾸면 패널·이 다이얼로그가 함께 움직인다
        const builtinOrder = (key, fallback) => {
            const n = Number(store.builtinProp('task', key)?.display_order);
            return Number.isFinite(n) && n !== 0 ? n : fallback;
        };

        // 일반 섹션: 이름·설명(내장)과 무그룹 커스텀 필드를 display_order 로 통합 정렬 (패널의 taskGeneralFields 와 동일)
        const generalItems = computed(() => {
            const items = [{ kind: 'name', id: 'builtin-name', order: builtinOrder('name', 20) }];
            if (store.isBuiltinPropVisible('task', 'description')) {
                items.push({ kind: 'description', id: 'builtin-description', order: builtinOrder('description', 30) });
            }
            for (const field of defaultGroupFields.value) {
                const order = Number(field.display_order);
                items.push({ kind: 'field', id: field.id, field, order: Number.isFinite(order) && order > 0 ? order : 500 });
            }
            return items.sort((a, b) => a.order - b.order);
        });

        // 패널과 동일한 섹션 구성·순서 — 일반 → 사용자 정의 그룹 → 내장 섹션(display_order 순)
        const panelSections = computed(() => {
            const sections = [];
            const generalOrder = builtinOrder('name', 20);
            sections.push({ id: 'general', kind: 'general', label: '일반', ...SECTION_ICONS.general, order: generalOrder });
            namedGroups.value.forEach((group, index) => {
                sections.push({
                    id: 'group-' + group.key,
                    kind: 'group',
                    label: group.label || group.key,
                    ...SECTION_ICONS.group,
                    group,
                    // 패널 규칙: 사용자 정의 그룹은 일반 바로 뒤에 고정
                    order: generalOrder + 0.01 * (index + 1)
                });
            });
            for (const def of PANEL_SECTION_DEFS) {
                if (def.taskLikeOnly && !isTaskLikeType.value) continue;
                if (!store.isBuiltinPropVisible('task', def.key)) continue;
                const row = store.builtinProp('task', def.key);
                sections.push({
                    id: def.id,
                    kind: def.kind,
                    label: row?.property_label || SECTION_FALLBACK_LABELS[def.key] || def.key,
                    ...(SECTION_ICONS[def.id] || SECTION_ICONS.general),
                    order: builtinOrder(def.key, def.fallbackOrder)
                });
            }
            return sections.sort((a, b) => a.order - b.order);
        });

        // 접이식 상태 — 패널과 같은 기본 열림, 열 때마다 초기화
        const closedSections = ref(new Set());
        const toggleSection = (id) => {
            const next = new Set(closedSections.value);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            closedSections.value = next;
        };
        const isSectionOpen = (id) => !closedSections.value.has(id);

        // config.visible_when — SchemaFieldInput 의 조건부 표시와 같은 판정.
        // 숨겨진 필드는 필수 검사에서 제외해 저장이 막히지 않게 한다.
        const isFieldVisible = (field) => {
            const cond = field?.config?.visible_when;
            if (!cond || typeof cond !== 'object') return true;
            const targetKey = String(cond.field || '').trim();
            if (!targetKey) return true;
            const current = formData.value.properties?.[targetKey];
            const currentText = current === null || current === undefined ? '' : String(current).trim();
            const expected = String(cond.value ?? '').trim();
            switch (String(cond.op || 'eq').trim()) {
                case 'eq':
                    return currentText === expected;
                case 'ne':
                    return currentText !== expected;
                case 'contains':
                    if (Array.isArray(current)) return current.map((v) => String(v)).includes(expected);
                    return currentText.includes(expected);
                case 'not_empty':
                    return Array.isArray(current) ? current.length > 0 : currentText !== '' && current !== false;
                case 'empty':
                    return Array.isArray(current) ? current.length === 0 : currentText === '' || current === null || current === undefined;
                default:
                    return true;
            }
        };

        const isFieldValueEmpty = (field) => {
            const key = String(field?.property_key || '').trim();
            const props = formData.value.properties || {};
            const type = String(field?.property_type || 'string').trim();
            if (type === 'boolean') return false; // on/off 모두 유효한 값
            if (type === 'daterange') {
                return !String(props[key + '_start'] || '').trim() && !String(props[key + '_end'] || '').trim();
            }
            const value = props[key];
            if (Array.isArray(value)) return value.length === 0;
            if (value && typeof value === 'object') return !(value.path || value.fileName);
            return value === null || value === undefined || String(value).trim() === '';
        };

        // 필수(is_required) 미입력 필드 라벨 — 읽기전용/조건부 숨김 필드는 제외
        const missingRequiredLabels = computed(() => {
            return propertySchemas.value
                .filter((f) => f.is_required && !f.is_readonly && isFieldVisible(f) && isFieldValueEmpty(f))
                .map((f) => f.property_label || f.property_key);
        });

        watch(
            () => props.modelValue,
            async (open) => {
                if (open) {
                    closedSections.value = new Set();

                    // 전체 스키마를 다시 로드한다 — 다른 화면이 loadSchemas(taskType)로 목록을
                    // 부분집합으로 덮어썼을 수 있어, ensure(1회 로드)만으로는 유형별 속성이 빠질 수 있다.
                    await store.loadSchemas();

                    if (props.item) {
                        formData.value = {
                            ...props.item,
                            // 옛 항목은 설명이 properties 에만 있을 수 있다
                            description: props.item.description || props.item.properties?.description || '',
                            properties: props.item.properties ? { ...props.item.properties } : {}
                        };
                    } else {
                        formData.value = defaultFormData();
                    }
                }
            }
        );

        const save = async () => {
            // 이름/유형 필수 검증은 클릭 시점에 수행 (검증 전 상태로 버튼이 잠기지 않게)
            const validation = await formRef.value?.validate?.();
            if (validation && validation.valid === false) return;
            if (missingRequiredLabels.value.length > 0) return;
            loading.value = true;
            try {
                const saved = await store.saveCatalogItem({
                    ...formData.value,
                    id: props.item?.id,
                    display_name: formData.value.name,
                    // 설명도 properties 에 함께 저장 — 순서도 드롭 시 태스크 설명으로 적용된다
                    properties: {
                        ...formData.value.properties,
                        description: formData.value.description || ''
                    }
                });
                // 저장 결과를 함께 넘긴다 — 속성패널이 요소에 _catalogId 를 남길 때 사용
                emit('saved', saved);
            } catch (error) {
                console.error('Failed to save catalog item:', error);
            } finally {
                loading.value = false;
            }
        };

        return {
            store,
            isMobile,
            formRef,
            formValid,
            loading,
            formData,
            availableTaskTypes,
            generalItems,
            panelSections,
            toggleSection,
            isSectionOpen,
            missingRequiredLabels,
            save
        };
    }
});
</script>

<style scoped>
/* ── 순서도 속성패널(ProcessHierarchyProperties)의 섹션 스타일과 동일 ── */
.catalog-panel-preview {
    display: flex;
    flex-direction: column;
}

.catalog-panel-preview .section-group {
    flex-shrink: 0;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    background: rgb(var(--v-theme-surface));
}

.catalog-panel-preview .section-title {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(var(--v-theme-on-surface), 0.03);
    user-select: none;
    transition: background-color 0.15s;
    color: rgb(var(--v-theme-textPrimary));
}

.catalog-panel-preview .section-title:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

.catalog-panel-preview .section-body {
    padding: 12px;
    border-top: 1px solid rgb(var(--v-theme-borderColor));
}

.catalog-panel-preview .field-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 4px;
    color: rgb(var(--v-theme-textSecondary));
}

/* 순서도에서만 설정하는 전용 위젯 섹션의 자리표시 (스튜디오 미리보기와 동일한 표현) */
.section-placeholder {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    border: 1px dashed rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-background));
}

.section-placeholder__label {
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.section-placeholder__badge {
    margin-left: auto;
    font-size: 10px;
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
}
</style>

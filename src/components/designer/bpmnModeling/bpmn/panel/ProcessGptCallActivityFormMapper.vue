<template>
    <div class="call-activity-form-mapper">
        <v-alert v-if="!definitionId" type="info" variant="tonal" density="compact" class="mb-4">
            호출할 자식 프로세스를 먼저 선택하세요.
        </v-alert>

        <v-alert v-else-if="loadError" type="warning" variant="tonal" density="compact" class="mb-4">
            {{ loadError }}
        </v-alert>

        <div class="d-flex align-center justify-space-between mb-2">
            <div class="section-title">부모 참조정보</div>
            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-refresh" :disabled="loading" @click="loadForms">
                새로고침
            </v-btn>
        </div>
        <v-select
            v-model="selectedParentForms"
            :items="parentForms"
            item-title="title"
            item-value="formId"
            label="참조할 부모 폼 선택"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            :disabled="isViewMode"
            class="mb-4"
            data-testid="callactivity-parent-form-select"
        />
        <div v-if="selectedParentForms.length > 0">
            <v-card v-for="formId in selectedParentForms" :key="formId" class="mb-4" variant="outlined">
                <v-card-text class="pa-4">
                    <div class="form-title mb-3">{{ getFormTitle('parent', formId) }}</div>
                    <v-row dense>
                        <v-col v-for="field in getFormFields('parent', formId)" :key="`${formId}-${field.fieldId}`" cols="12" md="6">
                            <v-checkbox v-model="field.selected" :label="field.fieldName" density="compact" hide-details :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                    <div v-if="getFormFields('parent', formId).length === 0" class="text-caption text-medium-emphasis">
                        이 폼에 저장된 필드 정보가 없습니다.
                    </div>
                </v-card-text>
            </v-card>
        </div>
        <div v-else class="empty-state">부모 프로세스 참조정보를 선택하면 parentForm에 표시됩니다.</div>
        <!--
        <FormReferenceSelector
            v-if="false"
            v-model:selected-forms="selectedParentForms"
            :forms="parentForms"
            :form-fields="parentFormFields"
            :disabled="isViewMode"
            label="매핑에 사용할 부모 폼"
            empty-text="부모 프로세스 참조정보를 선택하면 parentForm에 표시됩니다."
        />

        -->
        <v-divider class="my-5" />

        <div class="section-title mb-2">자식 참조정보</div>
        <v-select
            v-model="selectedChildForms"
            :items="childForms"
            item-title="title"
            item-value="formId"
            label="참조할 자식 폼 선택"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            :loading="loading"
            :disabled="!definitionId || isViewMode"
            class="mb-4"
            data-testid="callactivity-child-form-select"
        />
        <div v-if="selectedChildForms.length > 0">
            <v-card v-for="formId in selectedChildForms" :key="formId" class="mb-4" variant="outlined">
                <v-card-text class="pa-4">
                    <div class="form-title mb-3">{{ getFormTitle('child', formId) }}</div>
                    <v-row dense>
                        <v-col v-for="field in getFormFields('child', formId)" :key="`${formId}-${field.fieldId}`" cols="12" md="6">
                            <v-checkbox v-model="field.selected" :label="field.fieldName" density="compact" hide-details :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                    <div v-if="getFormFields('child', formId).length === 0" class="text-caption text-medium-emphasis">
                        이 폼에 저장된 필드 정보가 없습니다.
                    </div>
                </v-card-text>
            </v-card>
        </div>
        <div v-else class="empty-state">자식 프로세스 참조정보를 선택하면 childForm에 표시됩니다.</div>
        <!--
        <FormReferenceSelector
            v-if="false"
            v-model:selected-forms="selectedChildForms"
            :forms="childForms"
            :form-fields="childFormFields"
            :disabled="!definitionId || isViewMode"
            :loading="loading"
            label="매핑에 사용할 자식 폼"
            empty-text="자식 프로세스 참조정보를 선택하면 childForm에 표시됩니다."
        />

        -->
        <v-divider class="my-4" />

        <div class="mapping-actions">
            <v-btn
                variant="tonal"
                color="primary"
                :disabled="!canOpenMapper || isViewMode"
                @click="openMapper('in')"
            >
                부모 → 자식 매핑
            </v-btn>
            <v-btn
                variant="tonal"
                color="primary"
                :disabled="!canOpenMapper || isViewMode"
                @click="openMapper('out')"
            >
                자식 → 부모 매핑
            </v-btn>
        </div>

        <v-dialog
            v-model="isOpenMapper"
            class="mapper-dialog"
            max-width="80%"
            max-height="80%"
            @afterLeave="$refs.mapper && $refs.mapper.saveFormMapperJson()"
        >
            <mapper
                ref="mapper"
                :name="mapperTitle"
                :definition="definition"
                :formMapperJson="formMapperJson"
                :expandableTrees="mapperTrees"
                :leftExpandableTrees="null"
                :rightExpandableTrees="null"
                :replaceFromExpandableNode="normalizeMapperPath"
                :replaceToExpandableNode="normalizeMapperPath"
                :preferredRootOrder="preferredRootOrder"
                @saveFormMapperJson="saveMapperJson"
                @closeFormMapper="isOpenMapper = false"
            />
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Mapper from '@/components/designer/mapper/Mapper.vue';

const FormReferenceSelector = {
    name: 'form-reference-selector',
    props: {
        selectedForms: {
            type: Array,
            default: () => []
        },
        forms: {
            type: Array,
            default: () => []
        },
        formFields: {
            type: Object,
            default: () => ({})
        },
        label: String,
        emptyText: String,
        disabled: Boolean,
        loading: Boolean
    },
    emits: ['update:selectedForms'],
    methods: {
        getFormTitle(formId) {
            const form = this.forms.find((item) => item.formId === formId);
            return form ? form.title : formId;
        },
        getFormFields(formId) {
            return this.formFields[formId] || [];
        }
    },
    template: `
        <div>
            <v-select
                :model-value="selectedForms"
                :items="forms"
                item-title="title"
                item-value="formId"
                :label="label"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
                :loading="loading"
                :disabled="disabled"
                class="mb-4"
                @update:model-value="$emit('update:selectedForms', $event)"
            />
            <div v-if="selectedForms.length > 0">
                <v-card v-for="formId in selectedForms" :key="formId" class="mb-4" variant="outlined">
                    <v-card-text class="pa-4">
                        <div class="form-title mb-3">{{ getFormTitle(formId) }}</div>
                        <v-row dense>
                            <v-col v-for="field in getFormFields(formId)" :key="\`\${formId}-\${field.fieldId}\`" cols="12" md="6">
                                <v-checkbox v-model="field.selected" :label="field.fieldName" density="compact" hide-details :disabled="disabled" />
                            </v-col>
                        </v-row>
                        <div v-if="getFormFields(formId).length === 0" class="text-caption text-medium-emphasis">
                            이 폼에 저장된 필드 정보가 없습니다.
                        </div>
                    </v-card-text>
                </v-card>
            </div>
            <div v-else class="empty-state">{{ emptyText }}</div>
        </div>
    `
};

export default {
    name: 'process-gpt-call-activity-form-mapper',
    components: { Mapper },
    props: {
        uengineProperties: {
            type: Object,
            default: () => ({})
        },
        definitionId: {
            type: String,
            default: ''
        },
        definition: {
            type: Object,
            required: true
        },
        processDefinition: {
            type: Object,
            default: null
        },
        element: {
            type: Object,
            default: null
        },
        name: {
            type: String,
            default: ''
        },
        isViewMode: Boolean,
        backendOverride: {
            type: Object,
            default: null
        },
        parentDefinitionOverride: {
            type: Object,
            default: null
        },
        childDefinitionOverride: {
            type: Object,
            default: null
        }
    },
    emits: ['update:uengineProperties'],
    data() {
        return {
            backend: null,
            loading: false,
            loadError: '',
            parentForms: [],
            childForms: [],
            selectedParentForms: [],
            selectedChildForms: [],
            parentFormFields: {},
            childFormFields: {},
            mapperDirection: 'in',
            formMapperJson: '',
            isOpenMapper: false,
            isSyncingSelection: false
        };
    },
    computed: {
        selectedParentFieldRefs() {
            return Array.isArray(this.uengineProperties?.parentFormFields) ? this.uengineProperties.parentFormFields : [];
        },
        selectedChildFieldRefs() {
            return Array.isArray(this.uengineProperties?.childFormFields) ? this.uengineProperties.childFormFields : [];
        },
        parentFormTrees() {
            return this.buildFormTrees('parentForm', this.parentForms, this.getSelectedFieldRefs('parent'));
        },
        childFormTrees() {
            return this.buildFormTrees('childForm', this.childForms, this.getSelectedFieldRefs('child'));
        },
        mapperTrees() {
            return {
                ...this.parentFormTrees,
                ...this.childFormTrees
            };
        },
        canOpenMapper() {
            return Object.keys(this.parentFormTrees).length > 0 && Object.keys(this.childFormTrees).length > 0;
        },
        mapperTitle() {
            return this.mapperDirection === 'in' ? '부모 → 자식 폼 매퍼' : '자식 → 부모 폼 매퍼';
        },
        preferredRootOrder() {
            const formRoots = this.mapperDirection === 'in' ? ['parentForm', 'childForm'] : ['childForm', 'parentForm'];
            return ['Variables', 'lane', 'instance', 'activities', ...formRoots];
        }
    },
    watch: {
        definitionId: {
            immediate: true,
            async handler() {
                await this.loadForms();
            }
        },
        selectedParentFieldRefs: {
            immediate: true,
            handler() {
                this.syncSelectionFromProperties('parent');
            }
        },
        selectedChildFieldRefs: {
            immediate: true,
            handler() {
                this.syncSelectionFromProperties('child');
            }
        },
        parentForms() {
            this.rebuildFormFields('parent');
            this.syncSelectionFromProperties('parent');
        },
        childForms() {
            this.rebuildFormFields('child');
            this.syncSelectionFromProperties('child');
        },
        selectedParentForms(value, oldValue) {
            this.ensureSelectedFormDefaults('parent', value, oldValue);
            this.emitSelectedFields();
        },
        selectedChildForms(value, oldValue) {
            this.ensureSelectedFormDefaults('child', value, oldValue);
            this.emitSelectedFields();
        },
        parentFormFields: {
            deep: true,
            handler() {
                this.emitSelectedFields();
            }
        },
        childFormFields: {
            deep: true,
            handler() {
                this.emitSelectedFields();
            }
        }
    },
    mounted() {
        this.backend = this.backendOverride || BackendFactory.createBackend();
    },
    methods: {
        async loadForms() {
            this.loading = true;
            this.loadError = '';
            try {
                const [parentDefinition, childDefinition] = await Promise.all([
                    this.resolveParentDefinition(),
                    this.definitionId ? this.resolveChildDefinition() : Promise.resolve(null)
                ]);
                this.parentForms = await this.resolveForms(parentDefinition, this.element?.id);
                this.childForms = childDefinition ? await this.resolveForms(childDefinition) : [];
                if (this.definitionId && this.childForms.length === 0) {
                    this.loadError = '자식 프로세스에서 폼 참조정보를 찾지 못했습니다.';
                }
            } catch (e) {
                this.parentForms = [];
                this.childForms = [];
                this.loadError = e?.message || '참조정보를 불러오지 못했습니다.';
            } finally {
                this.loading = false;
            }
        },
        async resolveParentDefinition() {
            if (this.parentDefinitionOverride) return this.parentDefinitionOverride;
            return this.processDefinition?.definition || this.processDefinition || {};
        },
        async resolveChildDefinition() {
            if (this.childDefinitionOverride) return this.childDefinitionOverride;
            if (!this.backend) this.backend = this.backendOverride || BackendFactory.createBackend();
            const normalizedId = String(this.definitionId || '').replace(/\.bpmn$/i, '');
            const raw = await this.backend.getRawDefinition(normalizedId, null);
            return raw?.definition || raw || {};
        },
        async resolveForms(definition, beforeActivityId = '') {
            if (!definition) return [];
            if (beforeActivityId && this.backend?.getPreviousForms) {
                const previousForms = await this.backend.getPreviousForms(beforeActivityId, definition);
                if (Array.isArray(previousForms) && previousForms.length > 0) {
                    return previousForms
                        .map((form) => this.normalizeForm(form))
                        .filter((form) => form.formId);
                }
            }

            const activities = this.filterActivitiesBefore(definition, beforeActivityId);
            const formDrafts = Array.isArray(definition?.formDrafts) ? definition.formDrafts : [];
            const forms = [];
            const seen = new Set();

            for (const activity of activities) {
                const formId = this.getActivityFormId(activity);
                if (!formId) continue;
                const resolvedForm = await this.resolveForm(formId, activity, formDrafts, definition);
                if (!resolvedForm.formId || seen.has(resolvedForm.formId)) continue;
                seen.add(resolvedForm.formId);
                forms.push(resolvedForm);
            }

            formDrafts.forEach((draft) => {
                const formId = draft?.id || draft?.formId || draft?.form_id || (draft?.activity_id || draft?.activityId ? `${draft.activity_id || draft.activityId}_form` : '');
                if (!formId || seen.has(formId)) return;
                seen.add(formId);
                forms.push({
                    formId,
                    activityId: draft.activity_id || draft.activityId || '',
                    title: draft.name || draft.title || formId,
                    fields: this.normalizeFields(draft.fields_json || draft.fieldsJson || [])
                });
            });

            return forms;
        },
        filterActivitiesBefore(definition, beforeActivityId) {
            const activities = Array.isArray(definition?.activities) ? definition.activities : [];
            if (!beforeActivityId) return activities;
            const index = activities.findIndex((activity) => activity?.id === beforeActivityId);
            return index > 0 ? activities.slice(0, index) : activities;
        },
        getActivityFormId(activity) {
            const directFormId = activity?.formId || activity?.form_id || activity?.form?.id || activity?.form?.formId || activity?.form?.form_id;
            if (directFormId) return directFormId;
            const tool = activity?.tool || '';
            if (!tool.startsWith('formHandler:')) return '';
            return tool.split('formHandler:')[1];
        },
        async resolveForm(formId, activity, formDrafts, definition) {
            const draft = formDrafts.find((item) => {
                const draftFormId = item?.id || item?.formId || item?.form_id;
                return item && (draftFormId === formId || item.activity_id === activity.id || item.activityId === activity.id);
            });
            const resolvedFormId = draft?.id || draft?.formId || draft?.form_id || (formId === 'defaultform' ? `${activity.id}_form` : formId);
            if (draft) {
                return {
                    formId: resolvedFormId,
                    activityId: activity.id,
                    title: activity.name || draft.name || draft.title || resolvedFormId,
                    fields: this.normalizeFields(draft.fields_json || draft.fieldsJson || draft.fields || [])
                };
            }

            if (this.backend?.getFormFields) {
                const row = await this.backend.getFormFields(formId, activity.id, definition?.processDefinitionId);
                if (row) {
                    return {
                        formId: row.id || row.formId || row.form_id || resolvedFormId,
                        activityId: activity.id,
                        title: activity.name || row.name || row.title || resolvedFormId,
                        fields: this.normalizeFields(row.fields_json || row.fieldsJson || row.fields || [])
                    };
                }
            }

            return {
                formId: resolvedFormId,
                activityId: activity.id,
                title: activity.name || resolvedFormId,
                fields: []
            };
        },
        normalizeForm(form = {}) {
            const activityId = form.activityId || form.activity_id || '';
            const formId =
                form.id ||
                form.formId ||
                form.form_id ||
                form.definitionId ||
                form.definition_id ||
                form.key ||
                (activityId ? `${activityId}_form` : '');
            return {
                formId,
                activityId,
                title: form.title || form.name || form.label || formId,
                fields: this.normalizeFields(form.fields_json || form.fieldsJson || form.fields || [])
            };
        },
        normalizeFields(fields) {
            const fieldList = Array.isArray(fields)
                ? fields
                : Object.entries(fields || {}).map(([key, value]) => ({
                      key,
                      ...(value && typeof value === 'object' ? value : { text: String(value || key) })
                  }));
            return fieldList
                .map((field) => {
                    const fieldId = field?.key || field?.fieldId || field?.name || field?.id;
                    if (!fieldId) return null;
                    return {
                        fieldId,
                        fieldName: field.text || field.fieldName || field.label || field.name || field.key || fieldId,
                        type: field.type || field.inputType || ''
                    };
                })
                .filter(Boolean);
        },
        rebuildFormFields(type) {
            const forms = type === 'parent' ? this.parentForms : this.childForms;
            const selectedRefs = type === 'parent' ? this.selectedParentFieldRefs : this.selectedChildFieldRefs;
            const nextFields = {};
            forms.forEach((form) => {
                nextFields[form.formId] = (form.fields || []).map((field) => ({
                    ...field,
                    selected: selectedRefs.includes(`${form.formId}.${field.fieldId}`)
                }));
            });
            if (type === 'parent') this.parentFormFields = nextFields;
            else this.childFormFields = nextFields;
        },
        getFormTitle(type, formId) {
            const forms = type === 'parent' ? this.parentForms : this.childForms;
            const form = forms.find((item) => item.formId === formId);
            return form ? form.title : formId;
        },
        getFormFields(type, formId) {
            const formFields = type === 'parent' ? this.parentFormFields : this.childFormFields;
            return formFields[formId] || [];
        },
        ensureSelectedFormDefaults(type, selectedForms = [], oldSelectedForms = []) {
            if (this.loading || this.isSyncingSelection) return;
            const previous = new Set(Array.isArray(oldSelectedForms) ? oldSelectedForms : []);
            const formFields = type === 'parent' ? this.parentFormFields : this.childFormFields;
            (Array.isArray(selectedForms) ? selectedForms : []).forEach((formId) => {
                if (previous.has(formId)) return;
                const fields = Array.isArray(formFields[formId]) ? formFields[formId] : [];
                if (fields.length > 0 && !fields.some((field) => field.selected)) {
                    fields.forEach((field) => {
                        field.selected = true;
                    });
                }
            });
        },
        syncSelectionFromProperties(type) {
            this.isSyncingSelection = true;
            const refs = type === 'parent' ? this.selectedParentFieldRefs : this.selectedChildFieldRefs;
            const forms = type === 'parent' ? this.parentForms : this.childForms;
            const formFields = type === 'parent' ? this.parentFormFields : this.childFormFields;
            const formIds = [...new Set(refs.map((item) => String(item || '').split('.')[0]).filter(Boolean))];
            const validForms = new Set(forms.map((form) => form.formId));
            const selectedForms = formIds.filter((formId) => validForms.size === 0 || validForms.has(formId));
            const currentSelectedForms = type === 'parent' ? this.selectedParentForms : this.selectedChildForms;
            if (refs.length > 0 || currentSelectedForms.length === 0) {
                if (type === 'parent') this.selectedParentForms = selectedForms;
                else this.selectedChildForms = selectedForms;
            }
            Object.keys(formFields || {}).forEach((formId) => {
                formFields[formId].forEach((field) => {
                    field.selected = refs.includes(`${formId}.${field.fieldId}`);
                });
            });
            this.$nextTick(() => {
                this.isSyncingSelection = false;
            });
        },
        emitSelectedFields() {
            if (this.loading || this.isSyncingSelection) return;
            this.$emit('update:uengineProperties', {
                ...this.uengineProperties,
                parentFormFields: this.getSelectedFieldRefs('parent'),
                childFormFields: this.getSelectedFieldRefs('child'),
                mapperIn: this.uengineProperties?.mapperIn || { mappingElements: [] },
                mapperOut: this.uengineProperties?.mapperOut || { mappingElements: [] }
            });
        },
        openMapper(direction) {
            this.mapperDirection = direction;
            const mapper = direction === 'in' ? this.uengineProperties?.mapperIn : this.uengineProperties?.mapperOut;
            this.formMapperJson = JSON.stringify(mapper || { mappingElements: [] }, null, 2);
            this.isOpenMapper = true;
        },
        saveMapperJson(jsonString) {
            const parsed = JSON.parse(jsonString || '{"mappingElements":[]}');
            const next = {
                ...this.uengineProperties,
                parentFormFields: this.getSelectedFieldRefs('parent'),
                childFormFields: this.getSelectedFieldRefs('child'),
                mapperIn: this.uengineProperties?.mapperIn || { mappingElements: [] },
                mapperOut: this.uengineProperties?.mapperOut || { mappingElements: [] }
            };
            if (this.mapperDirection === 'in') next.mapperIn = parsed;
            else next.mapperOut = parsed;
            this.$emit('update:uengineProperties', next);
        },
        getSelectedFieldRefs(type) {
            const forms = type === 'parent' ? this.selectedParentForms : this.selectedChildForms;
            const formFields = type === 'parent' ? this.parentFormFields : this.childFormFields;
            const selected = [];
            forms.forEach((formId) => {
                (formFields[formId] || []).forEach((field) => {
                    if (field.selected) selected.push(`${formId}.${field.fieldId}`);
                });
            });
            return selected;
        },
        buildFormTrees(rootKey, forms, selectedRefs) {
            const selectedByForm = selectedRefs.reduce((acc, ref) => {
                const [formId, ...fieldParts] = String(ref || '').split('.');
                const fieldId = fieldParts.join('.');
                if (!formId || !fieldId) return acc;
                if (!acc[formId]) acc[formId] = new Set();
                acc[formId].add(fieldId);
                return acc;
            }, {});

            const formIds = Object.keys(selectedByForm);
            if (!formIds.length) return {};

            const nodes = {
                [rootKey]: {
                    text: rootKey,
                    children: [],
                    parent: null,
                    state: { opened: true }
                }
            };

            formIds.forEach((formId) => {
                const form = forms.find((item) => item.formId === formId);
                const formNodeId = `${rootKey}.${formId}`;
                nodes[rootKey].children.push(formNodeId);
                nodes[formNodeId] = {
                    text: form?.title || formId,
                    children: [],
                    parent: rootKey,
                    state: { opened: true }
                };

                selectedByForm[formId].forEach((fieldId) => {
                    const field = (form?.fields || []).find((item) => item.fieldId === fieldId);
                    const fieldNodeId = `${rootKey}.${formId}.${fieldId}`;
                    nodes[formNodeId].children.push(fieldNodeId);
                    nodes[fieldNodeId] = {
                        text: field?.fieldName || fieldId,
                        children: [],
                        parent: formNodeId
                    };
                });
            });

            return nodes;
        },
        normalizeMapperPath(nodeKey) {
            if (!nodeKey) return null;
            const key = String(nodeKey);
            if (key.startsWith('parentForm.') || key.startsWith('childForm.')) return key;

            const parentPath = this.resolveSelectedFormPath('parentForm', this.getSelectedFieldRefs('parent'), key);
            if (parentPath) return parentPath;

            const childPath = this.resolveSelectedFormPath('childForm', this.getSelectedFieldRefs('child'), key);
            if (childPath) return childPath;

            return null;
        },
        resolveSelectedFormPath(rootKey, selectedRefs, nodeKey) {
            if (!Array.isArray(selectedRefs)) return null;
            const exactMatch = selectedRefs.find((ref) => ref === nodeKey);
            if (exactMatch) return `${rootKey}.${exactMatch}`;

            const fieldMatch = selectedRefs.find((ref) => ref.split('.').slice(1).join('.') === nodeKey);
            if (fieldMatch) return `${rootKey}.${fieldMatch}`;

            return null;
        }
    }
};
</script>

<style scoped>
.section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.72);
}

.form-title {
    font-size: 0.9rem;
    font-weight: 600;
}

.empty-state {
    border: 1px dashed #d8dee8;
    border-radius: 8px;
    color: #6b7280;
    font-size: 13px;
    padding: 20px;
    text-align: center;
}

.mapping-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.mapping-actions :deep(.v-btn) {
    min-width: 0;
    text-transform: none;
    letter-spacing: 0;
}

@media (max-width: 480px) {
    .mapping-actions {
        grid-template-columns: 1fr;
    }
}
</style>

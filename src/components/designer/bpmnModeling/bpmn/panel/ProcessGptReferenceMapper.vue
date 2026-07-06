<template>
    <div>
        <div class="d-flex justify-end mb-2">
            <v-btn
                v-if="!isViewMode"
                variant="text"
                size="small"
                color="primary"
                prepend-icon="mdi-sitemap"
                @click="openFieldMapper"
            >
                {{ $t('EventSynchronizationForm.dataMapping') }}
            </v-btn>
        </div>

        <div class="my-4">
            <v-select
                v-model="selectedForms"
                :items="selectableForms"
                item-title="title"
                item-value="formId"
                :label="$t('BpmnPropertyPanel.selectForm')"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
            />
        </div>

        <div v-if="selectedForms.length > 0">
            <v-card v-for="formId in selectedForms" :key="formId" class="mb-4" variant="outlined">
                <v-card-text class="pa-4">
                    <div class="mb-3 text-subtitle-1">{{ getFormTitle(formId) }}</div>
                    <v-row>
                        <v-col
                            v-for="field in getFormFields(formId)"
                            :key="`${formId}-${field.fieldId}`"
                            cols="12"
                            lg="6"
                            md="6"
                            sm="12"
                        >
                            <v-checkbox v-model="field.selected" :label="field.fieldName" density="compact" hide-details />
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </div>
        <div v-else class="text-center text-grey-500 py-8">
            {{ $t('BpmnPropertyPanel.noFormSelected') }}
        </div>

        <v-dialog
            v-model="isOpenFieldMapper"
            class="mapper-dialog"
            max-width="80%"
            max-height="80%"
            @afterLeave="$refs.mapper && $refs.mapper.saveFormMapperJson()"
        >
            <mapper
                ref="mapper"
                :name="name"
                :definition="definition"
                :formMapperJson="formMapperJson"
                :expandableTrees="nodes"
                :replaceFromExpandableNode="replaceFromExpandableNode"
                :replaceToExpandableNode="replaceToExpandableNode"
                :preferredRootOrder="['Variables', 'lane', 'instance', 'activities', 'forms']"
                @saveFormMapperJson="saveMapperJson"
                @closeFormMapper="isOpenFieldMapper = false"
            />
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Mapper from '@/components/designer/mapper/Mapper.vue';

export default {
    name: 'process-gpt-reference-mapper',
    components: {
        Mapper
    },
    props: {
        inputData: {
            type: Array,
            default: () => []
        },
        mapperIn: {
            type: Object,
            default: () => ({ mappingElements: [] })
        },
        processDefinition: Object,
        definition: Object,
        element: Object,
        name: String,
        isViewMode: Boolean
    },
    emits: ['update:inputData', 'update:mapperIn'],
    data() {
        return {
            backend: null,
            selectedForms: [],
            availableForms: [],
            formFields: {},
            formMapperJson: '',
            isOpenFieldMapper: false,
            replaceFromExpandableNode: null,
            replaceToExpandableNode: null,
            nodes: {},
            currentActivityFormId: null
        };
    },
    watch: {
        inputData: {
            immediate: true,
            handler(value) {
                const formIds = [
                    ...new Set(
                        (Array.isArray(value) ? value : [])
                            .map((item) => String(item || '').split('.')[0])
                            .filter((formId) => formId)
                    )
                ];
                this.selectedForms = formIds.filter((formId) => formId !== this.currentActivityFormId);
                this.syncSelectedFlags();
            }
        },
        availableForms() {
            this.rebuildFormFields();
        },
        selectedForms() {
            this.updateInputData();
        },
        formFields: {
            deep: true,
            handler() {
                this.updateInputData();
            }
        }
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();
        await this.loadPreviousFormsForMapper();
    },
    methods: {
        async openFieldMapper() {
            if (!this.availableForms.length) await this.loadPreviousFormsForMapper();
            const inputData = this.syncReferenceFormInputData();
            this.nodes = this.buildReferenceFormMapperTrees(inputData);
            this.replaceFromExpandableNode = this.normalizeReferenceFormMapperPath;
            this.replaceToExpandableNode = this.expandReferenceFormMapperPath;
            const mapperIn = this.mapperIn && typeof this.mapperIn === 'object' ? this.mapperIn : { mappingElements: [] };
            this.formMapperJson = JSON.stringify(mapperIn, null, 2);
            this.isOpenFieldMapper = true;
        },
        saveMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            this.$emit('update:mapperIn', JSON.parse(jsonString));
        },
        async loadPreviousFormsForMapper() {
            let processDefinition = this.processDefinition;
            if ((!processDefinition || !processDefinition.activities) && this.EventBus) {
                processDefinition = await new Promise((resolve) => {
                    this.EventBus.emit('get-process-definition', (value) => resolve(value));
                });
            }
            if (!processDefinition || !processDefinition.activities || !this.element) return;

            const prevForms = await this.backend.getPreviousForms(this.element.id, processDefinition);
            const currentForm = await this.getCurrentActivityForm(processDefinition);
            this.currentActivityFormId = currentForm ? currentForm.id : null;
            const forms = currentForm ? [currentForm, ...prevForms.filter((form) => form.id !== currentForm.id)] : prevForms;
            this.availableForms = forms.map((form) => ({
                formId: form.id,
                activityId: form.activityId,
                title: form.title,
                fields: form.fields_json || [],
                html: form.html || ''
            }));
            if (this.currentActivityFormId) {
                this.selectedForms = this.selectedForms.filter((formId) => formId !== this.currentActivityFormId);
            }
        },
        async getCurrentActivityForm(processDefinition) {
            const activity = (processDefinition.activities || []).find((item) => item && item.id === this.element.id);
            if (!activity || !activity.tool || !activity.tool.startsWith('formHandler:')) return null;

            const formId = activity.tool.split('formHandler:')[1];
            const formDrafts = Array.isArray(processDefinition.formDrafts) ? processDefinition.formDrafts : [];
            const draft = formDrafts.find((item) => item && (item.id === formId || item.activity_id === activity.id));
            if (draft) {
                return {
                    id: draft.id || formId,
                    activityId: activity.id,
                    title: `${activity.name || activity.id} (현재)`,
                    html: draft.html || '',
                    fields_json: draft.fields_json || []
                };
            }

            const form = await this.backend.getFormFields(formId, activity.id, processDefinition.processDefinitionId);
            if (form) {
                return {
                    ...form,
                    id: form.id || formId,
                    activityId: activity.id,
                    title: `${activity.name || activity.id} (현재)`,
                    fields_json: form.fields_json || []
                };
            }

            const formHtml = localStorage.getItem(formId);
            if (formHtml && this.backend.extractFields) {
                return {
                    id: formId,
                    activityId: activity.id,
                    title: `${activity.name || activity.id} (현재)`,
                    html: formHtml,
                    fields_json: this.backend.extractFields(formHtml) || []
                };
            }

            return null;
        },
        rebuildFormFields() {
            const nextFields = {};
            this.availableForms.forEach((form) => {
                nextFields[form.formId] = (form.fields || []).map((field) => ({
                    fieldId: field.key || field.fieldId || field.name,
                    fieldName: field.text || field.fieldName || field.name || field.key,
                    selected:
                        form.formId === this.currentActivityFormId ||
                        (this.inputData || []).includes(`${form.formId}.${field.key || field.fieldId || field.name}`)
                }));
            });
            this.formFields = nextFields;
        },
        syncSelectedFlags() {
            Object.keys(this.formFields || {}).forEach((formId) => {
                this.formFields[formId].forEach((field) => {
                    field.selected = formId === this.currentActivityFormId || (this.inputData || []).includes(`${formId}.${field.fieldId}`);
                });
            });
        },
        updateInputData() {
            if (!this.availableForms.length) return Array.isArray(this.inputData) ? this.inputData : [];
            const inputData = [];
            this.selectedForms
                .filter((formId) => formId !== this.currentActivityFormId)
                .forEach((formId) => {
                    const fields = Array.isArray(this.formFields[formId]) ? this.formFields[formId] : [];
                    fields.forEach((field) => {
                        if (field.selected) inputData.push(`${formId}.${field.fieldId}`);
                    });
                });
            this.$emit('update:inputData', inputData);
            return inputData;
        },
        syncReferenceFormInputData() {
            return this.updateInputData();
        },
        buildReferenceFormMapperTrees(inputData = this.inputData) {
            const nodes = {};
            const selectedInputData = Array.isArray(inputData) ? inputData : [];
            const selectedByForm = selectedInputData.reduce((acc, item) => {
                const [formId, ...fieldParts] = String(item || '').split('.');
                const fieldId = fieldParts.join('.');
                if (!formId || !fieldId) return acc;
                if (!acc[formId]) acc[formId] = new Set();
                acc[formId].add(fieldId);
                return acc;
            }, {});
            if (this.currentActivityFormId) {
                const currentForm = this.availableForms.find((item) => item.formId === this.currentActivityFormId);
                const currentFields = Array.isArray(currentForm?.fields) ? currentForm.fields : [];
                if (currentFields.length > 0) {
                    if (!selectedByForm[this.currentActivityFormId]) selectedByForm[this.currentActivityFormId] = new Set();
                    currentFields.forEach((field) => {
                        const fieldId = field.key || field.fieldId || field.name;
                        if (fieldId) selectedByForm[this.currentActivityFormId].add(fieldId);
                    });
                }
            }
            const formIds = Object.keys(selectedByForm);
            if (!formIds.length) return nodes;

            nodes.forms = { text: 'forms', children: [], parent: null };
            formIds.forEach((formId) => {
                const form = this.availableForms.find((item) => item.formId === formId);
                const formNodeId = `forms.${formId}`;
                nodes.forms.children.push(formNodeId);
                nodes[formNodeId] = { text: form?.title || formId, children: [], parent: 'forms' };

                const fields = Array.isArray(form?.fields) ? form.fields : [];
                selectedByForm[formId].forEach((fieldId) => {
                    const field = fields.find((item) => item.key === fieldId || item.fieldId === fieldId || item.name === fieldId);
                    const fieldNodeId = `forms.${formId}.${fieldId}`;
                    nodes[formNodeId].children.push(fieldNodeId);
                    nodes[fieldNodeId] = {
                        text: field?.text || field?.fieldName || field?.name || fieldId,
                        children: [],
                        parent: formNodeId
                    };
                });
            });

            return nodes;
        },
        normalizeReferenceFormMapperPath(nodeKey) {
            if (!nodeKey) return null;
            if (String(nodeKey).startsWith('lane.lane.')) {
                const parts = String(nodeKey).split('.');
                if (parts.length === 4 && parts[3] === 'endpoint') return `lane.${parts[2]}.endpoint`;
                if (parts.length >= 5) return `lane.${parts[2]}.${parts.slice(4).join('.')}`;
            }
            if (String(nodeKey).startsWith('lane.')) return nodeKey;
            if (!String(nodeKey).startsWith('forms.')) return null;
            const parts = String(nodeKey).split('.');
            if (parts.length >= 5 && parts[0] === 'forms' && parts[1] === 'forms') {
                return `forms.${parts[2]}.${parts.slice(4).join('.')}`;
            }
            return nodeKey;
        },
        expandReferenceFormMapperPath(nodeKey) {
            if (!nodeKey) return null;
            if (String(nodeKey).startsWith('lane.')) {
                const parts = String(nodeKey).split('.');
                if (parts.length < 3 || parts[1] === 'lane') return nodeKey;
                if (parts[2] === 'endpoint') return `lane.lane.${parts[1]}.endpoint`;
                return `lane.lane.${parts[1]}.lane.${parts[1]}.${parts.slice(2).join('.')}`;
            }
            if (!String(nodeKey).startsWith('forms.')) return null;
            const parts = String(nodeKey).split('.');
            if (parts.length < 3 || parts[1] === 'forms') return nodeKey;
            return `forms.forms.${parts[1]}.forms.${parts[1]}.${parts.slice(2).join('.')}`;
        },
        getFormTitle(formId) {
            const form = this.availableForms.find((item) => item.formId === formId);
            return form ? form.title : formId;
        },
        getFormFields(formId) {
            return this.formFields[formId] || [];
        }
    },
    computed: {
        selectableForms() {
            return this.availableForms.filter((form) => form.formId !== this.currentActivityFormId);
        }
    }
};
</script>

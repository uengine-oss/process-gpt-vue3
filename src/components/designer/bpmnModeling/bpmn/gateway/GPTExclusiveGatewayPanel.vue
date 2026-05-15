<template>
    <div>
        <v-tabs v-model="activeTab" class="pl-4 pr-4">
            <v-tab value="setting">{{ $t('BpmnPropertyPanel.setting') }}</v-tab>
            <v-tab value="conditionData">{{ $t('BpmnPropertyPanel.referenceInfo') }}</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pa-4">
                <DetailComponent :title="$t('GatewayPanel.gatewayDescriptionTitle')" :details="gatewayDescription" />
            </v-window-item>

            <v-window-item value="conditionData" class="pa-4">
                <div class="text-caption text-grey-darken-1 mb-4">
                    {{
                        $t('BpmnPropertyPanel.gatewayConditionDataHelp') ||
                        '이 게이트웨이의 분기 판단에 사용할 참조 폼/필드를 선택합니다. 선택된 값만 우선 컨텍스트로 LLM/식 평가에 전달됩니다.'
                    }}
                </div>
                <div class="my-4">
                    <v-select
                        v-model="selectedForms"
                        :items="availableForms"
                        item-title="title"
                        item-value="formId"
                        :label="$t('BpmnPropertyPanel.selectForm')"
                        variant="outlined"
                        density="compact"
                        multiple
                        chips
                        closable-chips
                    ></v-select>
                </div>
                <div v-if="selectedForms.length > 0">
                    <v-card v-for="formId in selectedForms" :key="formId" class="mb-4" variant="outlined">
                        <v-card-text class="pa-4">
                            <div class="mb-3 text-subtitle-1">{{ getFormTitle(formId) }}</div>
                            <v-row>
                                <v-col
                                    cols="12"
                                    lg="6"
                                    md="6"
                                    sm="12"
                                    v-for="field in getFormFields(formId)"
                                    :key="`${formId}-${field.fieldId}`"
                                >
                                    <v-checkbox
                                        v-model="field.selected"
                                        :label="field.fieldName"
                                        density="compact"
                                        hide-details
                                    ></v-checkbox>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </div>
                <div v-else class="text-center text-grey-500 py-8">
                    {{ $t('BpmnPropertyPanel.noFormSelected') }}
                </div>
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';

export default {
    name: 'gpt-exclusive-gateway-panel',
    components: {
        DetailComponent
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        isPreviewMode: Boolean,
        roles: Array,
        definition: Object,
        name: String
    },
    data() {
        return {
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties || {})),
            backend: null,
            activeTab: 'setting',
            selectedForms: [],
            availableForms: [],
            formFields: {},
            conditionData: [],
            gatewayDescription: [
                { title: 'GatewayPanel.gatewayDescriptionSubTitle' },
                { title: 'GatewayPanel.gatewayDescriptionSubTitle1' },
                { title: 'GatewayPanel.gatewayDescriptionSubTitle2' },
                { title: 'GatewayPanel.gatewayDescriptionSubTitle3' },
                { title: 'GatewayPanel.gatewayDescriptionSubTitle4', image: 'gatewayChange.gif' }
            ]
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();

        // 1) processDefinition.gateways 에서 기존 conditionData 복원
        let initialConditionData = [];
        if (this.processDefinition && Array.isArray(this.processDefinition.gateways)) {
            const gw = this.processDefinition.gateways.find((g) => g.id === this.element.id);
            if (gw && Array.isArray(gw.conditionData)) {
                initialConditionData = [...gw.conditionData];
            }
        }
        // 2) uengineProperties.conditionData 가 있으면 우선 (XML에 직렬화된 최신 편집 상태)
        if (this.copyUengineProperties && Array.isArray(this.copyUengineProperties.conditionData)) {
            initialConditionData = [...this.copyUengineProperties.conditionData];
        }
        this.conditionData = initialConditionData;

        if (this.conditionData.length > 0) {
            const formIds = [...new Set(this.conditionData.map((item) => (item || '').split('.')[0]).filter(Boolean))];
            this.selectedForms = formIds;
        }
    },
    async mounted() {
        await this.loadPreviousForms();
    },
    watch: {
        availableForms(newVal) {
            if (newVal.length > 0) {
                this.formFields = {};
                newVal.forEach((form) => {
                    this.formFields[form.formId] = [];
                    (form.fields || []).forEach((field) => {
                        const selected = this.conditionData.includes(`${form.formId}.${field.key}`);
                        this.formFields[form.formId].push({
                            fieldId: field.key,
                            fieldName: field.text,
                            selected: selected
                        });
                    });
                });
            }
        },
        selectedForms: {
            deep: true,
            handler() {
                this.updateConditionData();
            }
        },
        formFields: {
            deep: true,
            handler() {
                this.updateConditionData();
            }
        }
    },
    methods: {
        async loadPreviousForms() {
            try {
                let pd = this.processDefinition;
                // 부모(BpmnPropertyPanel)가 최신 processDefinition 을 EventBus 로 제공하면 그것을 사용
                if (this.EventBus) {
                    await new Promise((resolve) => {
                        try {
                            this.EventBus.emit('get-process-definition', (def) => {
                                if (def && def.activities) pd = def;
                                resolve();
                            });
                        } catch (e) {
                            resolve();
                        }
                    });
                }
                if (!pd) {
                    this.availableForms = [];
                    return;
                }
                const prevForms = await this.backend.getPreviousForms(this.element.id, pd);
                this.availableForms = (prevForms || []).map((form) => ({
                    formId: form.id,
                    title: form.title,
                    fields: form.fields_json || []
                }));
            } catch (e) {
                console.error('[GPTExclusiveGatewayPanel] loadPreviousForms error:', e);
                this.availableForms = [];
            }
        },
        updateConditionData() {
            if (this.availableForms.length === 0) {
                return;
            }
            const next = [];
            this.selectedForms.forEach((formId) => {
                const fields = this.formFields[formId];
                if (!fields) return;
                fields.forEach((field) => {
                    if (field.selected) {
                        next.push(`${formId}.${field.fieldId}`);
                    }
                });
            });
            this.conditionData = next;
        },
        getFormTitle(formId) {
            const form = this.availableForms.find((f) => f.formId === formId);
            return form ? form.title : formId;
        },
        getFormFields(formId) {
            return this.formFields[formId] || [];
        },
        beforeSave() {
            // 1) uengineProperties.conditionData 동기화 (XML extensionElements 에 직렬화됨)
            this.copyUengineProperties = this.copyUengineProperties || {};
            this.copyUengineProperties.conditionData = Array.isArray(this.conditionData) ? [...this.conditionData] : [];
            this.$emit('update:uengineProperties', this.copyUengineProperties);

            // 2) processDefinition.gateways 트리에도 동기화 (백엔드 ProcessGateway.conditionData 매핑용)
            if (this.processDefinition && Array.isArray(this.processDefinition.gateways)) {
                const gw = this.processDefinition.gateways.find((g) => g.id === this.element.id);
                if (gw) {
                    gw.conditionData = Array.isArray(this.conditionData) ? [...this.conditionData] : [];
                }
            }
            this.$emit('update:processDefinition', this.processDefinition);
        }
    }
};
</script>

<style scoped lang="scss">
.gpt-exclusive-gateway-panel {
    margin: -16px;
}
</style>

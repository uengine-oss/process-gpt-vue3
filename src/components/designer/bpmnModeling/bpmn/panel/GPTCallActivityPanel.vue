<template>
    <div class="gpt-call-activity-panel">
        <v-tabs v-model="activeTab" class="px-4">
            <v-tab value="target">
                <v-icon start size="16">mdi-source-branch</v-icon>
                호출 프로세스
            </v-tab>
            <v-tab value="data">
                <v-icon start size="16">mdi-swap-horizontal</v-icon>
                파라미터 컨텍스트
            </v-tab>
            <v-tab value="roles">
                <v-icon start size="16">mdi-account-switch-outline</v-icon>
                역할 매핑
            </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
            <v-window-item value="target" class="pa-4">
                <div class="section-title mb-2">호출할 프로세스</div>
                <ProcessDefinitionDisplay
                    v-model="copyUengineProperties.definitionId"
                    :disabled="isViewMode"
                    :options="definitionSelectOptions"
                />

                <div class="d-flex align-center mt-2">
                    <v-chip v-if="copyUengineProperties.definitionId" size="small" variant="tonal" color="primary">
                        {{ copyUengineProperties.definitionId }}
                    </v-chip>
                    <v-spacer />
                    <v-btn
                        v-if="copyUengineProperties.definitionId"
                        size="small"
                        variant="text"
                        color="primary"
                        :disabled="isViewMode"
                        @click="moveDefinition"
                    >
                        <v-icon start size="16">mdi-open-in-new</v-icon>
                        열기
                    </v-btn>
                </div>

                <v-alert v-if="!copyUengineProperties.definitionId" class="mt-4" type="info" variant="tonal" density="compact">
                    호출할 프로세스를 선택하세요.
                </v-alert>

                <div class="mt-5">
                    <div class="section-title mb-2">반복 실행</div>
                    <v-autocomplete
                        v-model="selectedVariable"
                        :items="processVariables || []"
                        item-title="name"
                        item-value="name"
                        label="반복 변수"
                        density="compact"
                        variant="outlined"
                        clearable
                        hide-details
                        :disabled="isViewMode"
                    />
                </div>

                <v-divider class="my-5" />

                <div class="section-title mb-2">실행 옵션</div>
                <v-switch
                    v-model="copyUengineProperties.inheritParentReferenceInfo"
                    color="primary"
                    density="compact"
                    hide-details
                    :disabled="isViewMode"
                    label="부모 프로세스의 참조정보 사용"
                />
                <div class="text-caption text-medium-emphasis mt-1">
                    자식 프로세스의 첫 작업에서 부모 프로세스의 이전 산출물과 참조정보를 함께 사용할 수 있게 합니다.
                </div>
            </v-window-item>

            <v-window-item value="data" class="pa-4">
                <v-alert v-if="!copyUengineProperties.definitionId" type="info" variant="tonal" density="compact" class="mb-4">
                    먼저 호출할 프로세스를 선택하세요.
                </v-alert>
                <div class="d-flex justify-end mb-2">
                    <v-btn
                        v-if="!isViewMode && copyUengineProperties.definitionId"
                        variant="text"
                        size="small"
                        color="primary"
                        prepend-icon="mdi-sitemap"
                        @click="openCallActivityMapper"
                    >
                        {{ $t('EventSynchronizationForm.dataMapping') }}
                    </v-btn>
                </div>
                <bpmn-parameter-contexts
                    :for-sub-process="true"
                    :definition-variables="definitionVariables"
                    :is-view-mode="isViewMode"
                    :parameter-contexts="copyUengineProperties.variableBindings"
                />
            </v-window-item>

            <v-window-item value="roles" class="pa-4">
                <v-alert v-if="calleeDefinitionRoles.length === 0" type="info" variant="tonal" density="compact" class="mb-4">
                    호출 프로세스의 역할 정보가 없으면 부모 역할이 그대로 상속됩니다.
                </v-alert>
                <bpmn-role-parameter-contexts
                    :role-bindings="copyUengineProperties.roleBindings"
                    :is-view-mode="isViewMode"
                    :callee-definition-roles="calleeDefinitionRoles"
                    :definition-roles="definitionRoles"
                />
            </v-window-item>
        </v-window>

        <v-dialog
            v-model="isOpenCallActivityMapper"
            class="mapper-dialog"
            max-width="80%"
            max-height="80%"
            @afterLeave="$refs.callActivityMapper && $refs.callActivityMapper.saveFormMapperJson()"
        >
            <mapper
                ref="callActivityMapper"
                :name="name"
                :definition="definition"
                :formMapperJson="formMapperJson"
                :expandableTrees="{}"
                :rightExpandableTrees="callActivityTargetTrees"
                :replaceFromExpandableNode="replaceFromExpandableNode"
                :replaceToExpandableNode="replaceToExpandableNode"
                :preferredRootOrder="['callActivity', 'Variables', 'lane', 'instance', 'activities']"
                @saveFormMapperJson="saveMapperJson"
                @closeFormMapper="isOpenCallActivityMapper = false"
            />
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';
import BpmnParameterContexts from '@/components/designer/bpmnModeling/bpmn/variable/BpmnParameterContexts.vue';
import BpmnRoleParameterContexts from '@/components/designer/bpmnModeling/bpmn/role/BpmnRoleParameterContexts.vue';
import Mapper from '@/components/designer/mapper/Mapper.vue';
import { useBpmnStore } from '@/stores/bpmn';

export default {
    name: 'gpt-call-activity-panel',
    components: {
        ProcessDefinitionDisplay,
        BpmnParameterContexts,
        BpmnRoleParameterContexts,
        Mapper
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        processVariables: Array,
        element: Object,
        definition: Object,
        name: String
    },
    data() {
        const props = this.uengineProperties ? JSON.parse(JSON.stringify(this.uengineProperties)) : {};
        return {
            activeTab: 'target',
            backend: null,
            copyUengineProperties: {
                ...props,
                definitionId: props.definitionId || '',
                variableBindings: props.variableBindings || [],
                mapperIn: props.mapperIn || { mappingElements: [] },
                roleBindings: props.roleBindings || [],
                inheritParentReferenceInfo: props.inheritParentReferenceInfo !== false
            },
            definitionRoles: [],
            calleeDefinitionRoles: [],
            definitionVariables: [],
            formMapperJson: '',
            isOpenCallActivityMapper: false,
            callActivityTargetTrees: {},
            replaceFromExpandableNode: () => null,
            replaceToExpandableNode: () => null,
            selectedVariable: props.forEachVariable?.name || null,
            definitionSelectOptions: {
                label: '호출할 프로세스',
                hideDetails: true,
                itemTitle: 'name',
                itemValue: 'path',
                variant: 'outlined'
            }
        };
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();
        this.loadCallerRoles();
        if (this.copyUengineProperties.definitionId) {
            await this.setDefinitionInfo(this.copyUengineProperties.definitionId);
        }
    },
    watch: {
        'copyUengineProperties.definitionId'(definitionId) {
            this.setDefinitionInfo(definitionId);
            this.emitUpdate();
        },
        selectedVariable(value) {
            if (value) {
                const variable = (this.processVariables || []).find((item) => item.name === value);
                this.copyUengineProperties.forEachVariable = variable ? { ...variable, type: this.parseType(variable.type) } : { name: value };
            } else {
                delete this.copyUengineProperties.forEachVariable;
            }
            this.emitUpdate();
        },
        copyUengineProperties: {
            deep: true,
            handler() {
                this.emitUpdate();
            }
        }
    },
    methods: {
        emitUpdate() {
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        },
        moveDefinition() {
            if (!this.copyUengineProperties.definitionId) return;
            window.open(`/definitions/${this.copyUengineProperties.definitionId.replace('.bpmn', '')}`, '_blank');
        },
        openCallActivityMapper() {
            if (!this.copyUengineProperties.mapperIn) {
                this.copyUengineProperties.mapperIn = { mappingElements: [] };
            }
            this.callActivityTargetTrees = this.buildCallActivityTargetTrees();
            this.formMapperJson = JSON.stringify(this.copyUengineProperties.mapperIn, null, 2);
            this.isOpenCallActivityMapper = true;
        },
        saveMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            this.copyUengineProperties.mapperIn = JSON.parse(jsonString || '{"mappingElements":[]}');
            this.emitUpdate();
        },
        buildCallActivityTargetTrees() {
            const nodes = {
                callActivity: {
                    text: 'callActivity',
                    children: ['callActivity.variables', 'callActivity.lane'],
                    parent: null
                },
                'callActivity.variables': {
                    text: 'variables',
                    children: [],
                    parent: 'callActivity'
                },
                'callActivity.lane': {
                    text: 'lane',
                    children: [],
                    parent: 'callActivity'
                }
            };
            const seen = new Set();
            (this.definitionVariables || []).forEach((variable) => {
                const variableName = variable && variable.name;
                if (!variableName || seen.has(variableName)) return;
                seen.add(variableName);
                const nodeId = `callActivity.variables.${variableName}`;
                nodes['callActivity.variables'].children.push(nodeId);
                nodes[nodeId] = {
                    text: variableName,
                    children: [],
                    parent: 'callActivity.variables'
                };
            });
            const seenLane = new Set();
            (this.calleeDefinitionRoles || []).forEach((laneName) => {
                if (!laneName || seenLane.has(laneName)) return;
                seenLane.add(laneName);
                const laneNodeId = `callActivity.lane.${laneName}`;
                const endpointNodeId = `${laneNodeId}.endpoint`;
                nodes['callActivity.lane'].children.push(laneNodeId);
                nodes[laneNodeId] = {
                    text: laneName,
                    children: [endpointNodeId],
                    parent: 'callActivity.lane'
                };
                nodes[endpointNodeId] = {
                    text: 'endpoint',
                    children: [],
                    parent: laneNodeId
                };
            });
            return nodes;
        },
        async beforeSave() {
            if (this.copyUengineProperties.definitionId) {
                const versions = await this.backend.getDefinitionVersions(this.copyUengineProperties.definitionId.replace('.bpmn', ''), {
                    key: 'version, message',
                    sort: 'asc',
                    orderBy: 'timeStamp',
                    type: 'bpmn'
                });
                if (versions && versions.length > 0) {
                    this.copyUengineProperties.version = versions[versions.length - 1].version;
                } else {
                    delete this.copyUengineProperties.version;
                }
            }
            this.emitUpdate();
        },
        parseType(type) {
            switch (type) {
                case 'Text':
                    return 'java.lang.String';
                case 'Number':
                    return 'java.lang.Number';
                case 'Date':
                    return 'java.util.Date';
                case 'Form':
                    return 'org.uengine.kernel.FormActivity';
                default:
                    return type;
            }
        },
        loadCallerRoles() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;
            const definitions = modeler.getDefinitions();
            const processElements = definitions.rootElements.filter((element) => element.$type === 'bpmn:Process');
            const roles = [];
            processElements.forEach((process) => {
                (process.laneSets || []).forEach((laneSet) => {
                    (laneSet.lanes || []).forEach((lane) => {
                        if (lane?.name) roles.push({ id: lane.id, name: lane.name });
                    });
                });
            });
            this.definitionRoles = roles;
        },
        async setDefinitionInfo(definitionId) {
            if (!definitionId || !this.backend) return;
            const normalizedId = definitionId.includes('.bpmn') ? definitionId.split('.bpmn')[0] : definitionId;
            const xml = await this.backend.getRawDefinition(normalizedId, { type: 'bpmn' });
            if (!xml) return;
            this.calleeDefinitionRoles = this.extractLanesFromBpmnXml(xml).map((lane) => lane.name);
            this.definitionVariables = this.extractVariablesFromBpmnXml(xml);
        },
        extractVariablesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml, 'application/xml');
            return Array.from(xmlDoc.getElementsByTagName('uengine:variable'))
                .map((variable) => ({
                    type: variable.getAttribute('type'),
                    name: variable.getAttribute('name')
                }))
                .filter((variable) => variable.name);
        },
        extractLanesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml.replace(/\$type/g, '_type'), 'application/xml');
            return Array.from(xmlDoc.getElementsByTagName('bpmn:lane'))
                .map((lane) => ({
                    id: lane.getAttribute('id'),
                    name: lane.getAttribute('name')
                }))
                .filter((lane) => lane.name);
        }
    }
};
</script>

<style scoped>
.gpt-call-activity-panel {
    min-width: 370px;
}

.section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.72);
}
</style>

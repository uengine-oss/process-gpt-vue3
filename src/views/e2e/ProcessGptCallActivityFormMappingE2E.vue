<template>
    <v-app>
        <div class="call-activity-e2e">
            <div class="call-activity-e2e__header">
                <div>
                    <div class="call-activity-e2e__title">ProcessGPT CallActivity Form Mapping E2E</div>
                    <div class="call-activity-e2e__subtitle">
                        Child process forms are selected and mapped through the real CallActivity panel.
                    </div>
                </div>
            </div>

            <div class="call-activity-e2e__modeler" aria-hidden="true">
                <BpmnUengine :bpmn="diagramXml" :is-view-mode="true" @done="modelerReady = true" />
            </div>

            <div v-if="modelerReady" class="call-activity-e2e__body">
                <GPTCallActivityPanel
                    class="call-activity-e2e__panel"
                    :uengine-properties="callActivityProperties"
                    process-definition-id="parent-vendor-onboarding"
                    :is-view-mode="false"
                    :process-variables="definition.processVariables"
                    :definition="definition"
                    :process-definition="{ definition: parentDefinition }"
                    name="협력사 보안 심사 호출"
                    :backend-override="backend"
                    :parent-definition-override="parentDefinition"
                    :child-definition-override="childDefinition"
                    @update:uengineProperties="callActivityProperties = $event"
                />

                <div class="call-activity-e2e__json">
                    <div class="call-activity-e2e__json-title">Saved CallActivity Properties</div>
                    <pre data-testid="call-activity-properties">{{ prettyProperties }}</pre>
                </div>
            </div>
        </div>
    </v-app>
</template>

<script>
import BpmnUengine from '@/components/BpmnUengine.vue';
import GPTCallActivityPanel from '@/components/designer/bpmnModeling/bpmn/panel/GPTCallActivityPanel.vue';

const diagramXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine.org/schema/bpmn" id="Definitions_CallActivity_Form_Mapping_E2E" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_CallActivity_Form_Mapping_E2E" isExecutable="false">
    <bpmn:extensionElements>
      <uengine:variable name="vendorName" type="Text" />
      <uengine:variable name="securityReviewResult" type="Text" />
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_Mapper_E2E">
      <bpmn:lane id="Lane_Requester" name="requester"><bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef><bpmn:flowNodeRef>CallActivity_Review</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Lane_Security" name="securityReviewer"><bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:callActivity id="CallActivity_Review" name="협력사 보안 심사 호출"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:callActivity>
    <bpmn:endEvent id="EndEvent_1" name="End"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="CallActivity_Review" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="CallActivity_Review" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_CallActivity_Form_Mapping_E2E">
      <bpmndi:BPMNShape id="Lane_Requester_di" bpmnElement="Lane_Requester" isHorizontal="true"><dc:Bounds x="120" y="88" width="760" height="110" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Security_di" bpmnElement="Lane_Security" isHorizontal="true"><dc:Bounds x="120" y="198" width="760" height="110" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="125" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="CallActivity_Review_di" bpmnElement="CallActivity_Review"><dc:Bounds x="280" y="103" width="180" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="620" y="235" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="143" /><di:waypoint x="280" y="143" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="460" y="143" /><di:waypoint x="540" y="143" /><di:waypoint x="540" y="253" /><di:waypoint x="620" y="253" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const childBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uengine="http://uengine.org/schema/bpmn" id="Definitions_Child">
  <bpmn:process id="vendor-security-review" isExecutable="false">
    <bpmn:extensionElements>
      <uengine:variable name="reviewResult" type="Text" />
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_Child">
      <bpmn:lane id="Lane_Security" name="securityReviewer" />
    </bpmn:laneSet>
  </bpmn:process>
</bpmn:definitions>`;

export default {
    name: 'ProcessGptCallActivityFormMappingE2E',
    components: { BpmnUengine, GPTCallActivityPanel },
    data() {
        const childDefinition = {
            processDefinitionId: 'vendor-security-review',
            activities: [
                {
                    id: 'ReviewVendorSecurity',
                    name: '보안 심사 입력',
                    tool: 'formHandler:defaultform'
                }
            ],
            formDrafts: [
                {
                    activity_id: 'ReviewVendorSecurity',
                    fields_json: [
                        { key: 'vendorName', text: '협력사명', type: 'Text' },
                        { key: 'riskLevel', text: '위험 등급', type: 'Text' },
                        { key: 'reviewResult', text: '심사 결과', type: 'Text' }
                    ]
                }
            ]
        };
        const parentDefinition = {
            processDefinitionId: 'parent-vendor-onboarding',
            activities: [
                {
                    id: 'CollectVendorInfo',
                    name: '협력사 정보 입력',
                    tool: 'formHandler:vendorOnboardingForm'
                },
                {
                    id: 'CallActivity_Review',
                    name: '협력사 보안 심사 호출',
                    type: 'CallActivity'
                }
            ],
            formDrafts: [
                {
                    id: 'vendorOnboardingForm',
                    activity_id: 'CollectVendorInfo',
                    fields_json: [
                        { key: 'vendorName', text: '협력사명', type: 'Text' },
                        { key: 'riskLevel', text: '위험 등급', type: 'Text' },
                        { key: 'requesterEmail', text: '요청자 이메일', type: 'Text' }
                    ]
                }
            ]
        };

        return {
            modelerReady: false,
            diagramXml,
            parentDefinition,
            childDefinition,
            callActivityProperties: {
                definitionId: 'vendor-security-review',
                inheritParentReferenceInfo: true,
                variableBindings: [],
                roleBindings: [],
                parentFormFields: [],
                childFormFields: [],
                mapperIn: { mappingElements: [] },
                mapperOut: { mappingElements: [] }
            },
            definition: {
                processVariables: [
                    { name: 'vendorName', type: 'Text' },
                    { name: 'riskLevel', type: 'Text' },
                    { name: 'securityReviewResult', type: 'Text' }
                ]
            },
            backend: {
                async getPreviousForms() {
                    return [
                        {
                            form_id: 'vendorOnboardingForm',
                            activity_id: 'CollectVendorInfo',
                            title: '협력사 정보 입력',
                            fields_json: {
                                vendorName: { text: '협력사명', type: 'Text' },
                                riskLevel: { text: '위험 등급', type: 'Text' },
                                requesterEmail: { text: '요청자 이메일', type: 'Text' }
                            }
                        }
                    ];
                },
                async getRawDefinition(_id, options) {
                    if (options?.type === 'bpmn') return childBpmnXml;
                    return { definition: childDefinition };
                },
                async getDefinitionVersions() {
                    return [];
                },
                async getFormFields() {
                    return null;
                }
            }
        };
    },
    computed: {
        prettyProperties() {
            return JSON.stringify(this.callActivityProperties, null, 2);
        }
    }
};
</script>

<style scoped>
.call-activity-e2e {
    min-height: 100vh;
    background: #f5f7fb;
    padding: 16px;
}

.call-activity-e2e__header {
    align-items: center;
    background: #ffffff;
    border: 1px solid #d9e2ef;
    border-radius: 8px;
    display: flex;
    height: 64px;
    margin-bottom: 12px;
    padding: 0 16px;
}

.call-activity-e2e__title {
    color: #172033;
    font-size: 18px;
    font-weight: 700;
}

.call-activity-e2e__subtitle {
    color: #5f6f86;
    font-size: 13px;
    margin-top: 2px;
}

.call-activity-e2e__modeler {
    height: 1px;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    position: fixed;
    width: 1px;
}

.call-activity-e2e__body {
    align-items: flex-start;
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(420px, 520px) minmax(320px, 1fr);
}

.call-activity-e2e__panel,
.call-activity-e2e__json {
    background: #ffffff;
    border: 1px solid #d9e2ef;
    border-radius: 8px;
    overflow: hidden;
}

.call-activity-e2e__json {
    padding: 16px;
}

.call-activity-e2e__json-title {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 8px;
}

.call-activity-e2e__json pre {
    background: #111827;
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    max-height: 720px;
    overflow: auto;
    padding: 12px;
}
</style>

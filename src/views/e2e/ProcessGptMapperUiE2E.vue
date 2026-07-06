<template>
    <v-app>
        <div class="mapper-ui-e2e">
            <div class="mapper-ui-e2e__header">
                <div>
                    <div class="mapper-ui-e2e__title">ProcessGPT Mapper UI E2E</div>
                    <div class="mapper-ui-e2e__subtitle">ConcatTransformer mappingContext restored by the real Mapper.vue component</div>
                </div>
            </div>

            <div class="mapper-ui-e2e__modeler" aria-hidden="true">
                <BpmnUengine :bpmn="diagramXml" :is-view-mode="true" @done="modelerReady = true" />
            </div>

            <Mapper
                v-if="modelerReady"
                class="mapper-ui-e2e__mapper"
                :definition="definition"
                :formMapperJson="formMapperJson"
                name="ConcatTransformer Mapper Input"
                :expandableTrees="{}"
                :replaceFromExpandableNode="replaceExpandableNode"
                :replaceToExpandableNode="replaceExpandableNode"
            />
        </div>
    </v-app>
</template>

<script>
import BpmnUengine from '@/components/BpmnUengine.vue';
import Mapper from '@/components/designer/mapper/Mapper.vue';

const diagramXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_Mapper_E2E" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Mapper_E2E" isExecutable="false">
    <bpmn:laneSet id="LaneSet_Mapper_E2E">
      <bpmn:lane id="Lane_Requester" name="requester">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>A</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Approver" name="approver">
        <bpmn:flowNodeRef>B_APPROVED</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Finance" name="finance">
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="A" name="ConcatTransformer Mapper Input"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="B_APPROVED" name="Approved Task From JaneKim"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="End"><bpmn:incoming>Flow_3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="A" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="A" targetRef="B_APPROVED" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="B_APPROVED" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Mapper_E2E">
      <bpmndi:BPMNShape id="Lane_Requester_di" bpmnElement="Lane_Requester" isHorizontal="true"><dc:Bounds x="120" y="88" width="760" height="95" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Approver_di" bpmnElement="Lane_Approver" isHorizontal="true"><dc:Bounds x="120" y="183" width="760" height="95" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Finance_di" bpmnElement="Lane_Finance" isHorizontal="true"><dc:Bounds x="120" y="278" width="760" height="95" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="118" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="A_di" bpmnElement="A"><dc:Bounds x="260" y="96" width="180" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="B_APPROVED_di" bpmnElement="B_APPROVED"><dc:Bounds x="520" y="190" width="180" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="780" y="308" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="136" /><di:waypoint x="260" y="136" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="440" y="136" /><di:waypoint x="480" y="136" /><di:waypoint x="480" y="230" /><di:waypoint x="520" y="230" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="700" y="230" /><di:waypoint x="740" y="230" /><di:waypoint x="740" y="326" /><di:waypoint x="780" y="326" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default {
    name: 'ProcessGptMapperUiE2E',
    components: { BpmnUengine, Mapper },
    data() {
        return {
            modelerReady: false,
            diagramXml,
            definition: {
                processVariables: [
                    { name: 'firstName', type: 'Text' },
                    { name: 'lastName', type: 'Text' },
                    { name: 'fullName', type: 'Text' },
                    { name: 'customerName', type: 'Text' },
                    { name: 'approverEmail', type: 'Text' }
                ]
            },
            formMapperJson: JSON.stringify(
                {
                    mappingElements: [
                        {
                            argument: { text: 'fullName' },
                            direction: 'out',
                            transformerMapping: {
                                transformer: {
                                    _type: 'org.uengine.processdesigner.mapper.transformers.ConcatTransformer',
                                    name: 'ConcatTransformer',
                                    location: { x: 420, y: 180 },
                                    argumentSourceMap: {
                                        str1: 'firstName',
                                        str2: 'lastName'
                                    }
                                },
                                linkedArgumentName: 'fullName'
                            }
                        },
                        {
                            argument: { text: 'lane.approver.endpoint' },
                            direction: 'out',
                            variable: { name: 'approverEmail' }
                        }
                    ]
                },
                null,
                2
            )
        };
    },
    methods: {
        replaceExpandableNode() {
            return null;
        }
    }
};
</script>

<style scoped>
.mapper-ui-e2e {
    min-height: 100vh;
    background: #f5f7fb;
    padding: 16px;
}

.mapper-ui-e2e__header {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: #ffffff;
    border: 1px solid #d9e2ef;
    border-radius: 8px;
    margin-bottom: 12px;
}

.mapper-ui-e2e__title {
    font-size: 18px;
    font-weight: 700;
    color: #172033;
}

.mapper-ui-e2e__subtitle {
    font-size: 13px;
    color: #5f6f86;
    margin-top: 2px;
}

.mapper-ui-e2e__modeler {
    position: fixed;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
}

.mapper-ui-e2e__mapper {
    display: block;
    background: #ffffff;
    border: 1px solid #d9e2ef;
    border-radius: 8px;
    overflow: hidden;
}
</style>

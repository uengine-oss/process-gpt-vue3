/**
 * BpmnUengine.vue와 동일한 기본 BPMN XML 생성 (정의체계도에서 새 서브프로세스 추가 시 사용)
 * @param {string} [laneName='Lane 1'] - 레인 표시 이름
 * @param {boolean} [isUEngineMode] - true면 UserTask, false면 ManualTask. 미지정 시 window.$pal || window.$mode === 'uEngine'
 * @returns {string} BPMN XML 문자열
 */
export function getDefaultBpmnXml(laneName = 'Lane 1', isUEngineMode = null) {
    if (isUEngineMode == null && typeof window !== 'undefined') {
        isUEngineMode = !!(window.$pal || window.$mode === 'uEngine');
    }
    const taskId = isUEngineMode ? 'UserTask_1' : 'ManualTask_1';
    const taskTag = isUEngineMode ? 'userTask' : 'manualTask';
    const taskName = isUEngineMode ? 'User Task' : 'Manual Task';
    const taskShapeId = taskId + '_di';

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Process" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <uengine:ProcessVariables id="ProcessVariables_1">
      <uengine:ProcessVariable key="variable1" value="value1"/>
      <uengine:ProcessVariable key="variable2" value="value2"/>
    </uengine:ProcessVariables>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="${laneName}">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>${taskId}</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:${taskTag} id="${taskId}" name="${taskName}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:${taskTag}>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="${taskId}"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="${taskId}" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="190" y="80" width="570" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="232" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="238" y="225" width="24" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${taskShapeId}" bpmnElement="${taskId}">
        <dc:Bounds x="340" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="512" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="520" y="225" width="20" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="268" y="200"/>
        <di:waypoint x="340" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="440" y="200"/>
        <di:waypoint x="512" y="200"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

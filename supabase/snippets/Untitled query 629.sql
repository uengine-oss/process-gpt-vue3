INSERT INTO "public"."proc_def" ("id", "name", "definition", "bpmn", "uuid", "tenant_id", "isdeleted", "owner", "type", "prod_version") VALUES ('contract_management_process', '계약관리 프로세스', '{"data": [{"name": "customer_email", "type": "text", "description": "고객 이메일"}, {"name": "customer_email", "type": "text", "description": "고객 이메일"}, {"name": "계약요청서", "type": "form", "value": "", "options": {"description": "계약 요청을 위한 기본 정보"}}, {"name": "검토의견", "type": "text", "value": "", "options": {"description": "내부 검토 결과 의견"}}, {"name": "승인여부", "type": "text", "value": "", "options": {"description": "계약 요청 승인 결과"}}, {"name": "계약서", "type": "attachment", "value": "", "options": {"description": "작성 및 체결되는 계약서 원본"}}], "roles": [{"name": "계약요청자", "default": ["789ba0e9-9079-40df-9ee6-56c03583debe"], "endpoint": "", "resolutionRule": "계약 요청을 담당하는 부서 또는 개인"}, {"name": "검토자", "default": ["789ba0e9-9079-40df-9ee6-56c03583debe"], "endpoint": "", "resolutionRule": "계약 검토를 담당하는 부서 또는 개인"}, {"name": "계약담당자", "default": ["789ba0e9-9079-40df-9ee6-56c03583debe"], "endpoint": "", "resolutionRule": "계약서 작성 및 체결을 담당하는 부서 또는 개인"}, {"name": "관리자", "default": ["789ba0e9-9079-40df-9ee6-56c03583debe"], "endpoint": "", "resolutionRule": "계약 후 지속적 관리를 담당하는 부서 또는 개인"}], "events": [{"id": "start_event", "name": "계약관리 시작", "role": "계약요청자", "type": "startEvent", "process": "Process_1", "properties": "{\\"description\\":\\"계약관리가 필요한 상황 발생 시 시작\\",\\"role\\":\\"계약요청자\\"}", "description": "start event"}, {"id": "end_event", "name": "계약관리 종료", "role": "관리자", "type": "endEvent", "process": "Process_1", "properties": "{\\"description\\":\\"계약 관리 종료\\",\\"role\\":\\"관리자\\"}", "description": "start event"}, {"id": "end_event_reject", "name": "계약 반려 종료", "role": "검토자", "type": "endEvent", "process": "Process_1", "properties": "{\\"description\\":\\"계약 요청이 반려되어 종료\\",\\"role\\":\\"검토자\\"}", "description": "start event"}], "version": "1.0", "gateways": [{"id": "approve_gateway", "name": "승인 여부 결정", "role": "검토자", "type": "exclusiveGateway", "process": "Process_1", "condition": {}, "properties": "{\\"description\\":\\"계약 요청에 대한 승인 여부 결정\\",\\"role\\":\\"검토자\\"}", "description": "승인 여부 결정 description"}, {"id": "start_event", "name": "계약관리 시작", "role": "계약요청자", "type": "startEvent", "srcTrg": null, "process": "Process_1", "condition": {}, "properties": "{\\"description\\":\\"계약관리가 필요한 상황 발생 시 시작\\",\\"role\\":\\"계약요청자\\"}", "description": "start event"}, {"id": "end_event", "name": "계약관리 종료", "role": "관리자", "type": "endEvent", "srcTrg": null, "process": "Process_1", "condition": {}, "properties": "{\\"description\\":\\"계약 관리 종료\\",\\"role\\":\\"관리자\\"}", "description": "start event"}, {"id": "end_event_reject", "name": "계약 반려 종료", "role": "검토자", "type": "endEvent", "srcTrg": null, "process": "Process_1", "condition": {}, "properties": "{\\"description\\":\\"계약 요청이 반려되어 종료\\",\\"role\\":\\"검토자\\"}", "description": "start event"}], "sequences": [{"id": "SequenceFlow_start_event_request_activity", "source": "start_event", "target": "request_activity", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_request_activity_review_activity", "source": "request_activity", "target": "review_activity", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_review_activity_approve_gateway", "source": "review_activity", "target": "approve_gateway", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_approve_gateway_draft_activity", "name": "승인", "source": "approve_gateway", "target": "draft_activity", "condition": "", "properties": "{\\"condition\\":\\"계약 검토 결과 승인됨\\"}"}, {"id": "SequenceFlow_approve_gateway_end_event_reject", "name": "반려", "source": "approve_gateway", "target": "end_event_reject", "condition": "", "properties": "{\\"condition\\":\\"계약 검토 결과 반려됨\\"}"}, {"id": "SequenceFlow_draft_activity_sign_activity", "source": "draft_activity", "target": "sign_activity", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_sign_activity_manage_activity", "source": "sign_activity", "target": "manage_activity", "condition": "", "properties": "{}"}, {"id": "SequenceFlow_manage_activity_end_event", "source": "manage_activity", "target": "end_event", "condition": "", "properties": "{}"}], "activities": [{"id": "request_activity", "name": "계약 요청 등록", "role": "계약요청자", "tool": "formHandler:contract_management_process_request_activity_form", "type": "userTask", "agent": "", "process": "Process_1", "duration": "2", "agentMode": "none", "inputData": [], "attachments": [], "checkpoints": ["요청서 항목 작성", "관련 자료 첨부"], "description": "계약 요청서를 작성 및 제출", "instruction": "계약 요청서를 작성하여 제출하십시오.", "orchestration": "none", "attachedEvents": null}, {"id": "review_activity", "name": "계약 요청 검토", "role": "검토자", "tool": "formHandler:contract_management_process_review_activity_form", "type": "userTask", "agent": "", "process": "Process_1", "duration": "3", "agentMode": "none", "inputData": [], "attachments": [], "checkpoints": ["내용 적정성 확인", "법적 리스크 검토"], "description": "요청된 계약 내용을 내부적으로 검토", "instruction": "계약 요청서의 적정성, 위험성 등을 검토하십시오.", "orchestration": "none", "attachedEvents": null}, {"id": "draft_activity", "name": "계약서 작성", "role": "계약담당자", "tool": "formHandler:contract_management_process_draft_activity_form", "type": "userTask", "agent": "", "process": "Process_1", "duration": "3", "agentMode": "none", "inputData": [], "attachments": [], "checkpoints": ["계약서 주요 조항 확인", "필수 첨부서류 점검"], "description": "계약서 초안 작성", "instruction": "검토 의견을 반영하여 계약서를 작성하십시오.", "orchestration": "none", "attachedEvents": null}, {"id": "sign_activity", "name": "계약 체결", "role": "계약담당자", "tool": "formHandler:contract_management_process_sign_activity_form", "type": "userTask", "agent": "", "process": "Process_1", "duration": "2", "agentMode": "none", "inputData": [], "attachments": [], "checkpoints": ["서명/날인 확인", "계약서 보관"], "description": "당사자 간 계약서 서명 및 체결", "instruction": "계약 당사자 서명 및 날인 진행", "orchestration": "none", "attachedEvents": null}, {"id": "manage_activity", "name": "계약 관리", "role": "관리자", "tool": "formHandler:contract_management_process_manage_activity_form", "type": "userTask", "agent": "", "process": "Process_1", "duration": "0", "agentMode": "none", "inputData": [], "attachments": [], "checkpoints": ["이행사항 기록", "계약 종료 시점 체크"], "description": "계약 이행, 갱신, 종료 등 계약 관련 업무 지속적 관리", "instruction": "계약 이행사항 점검 및 이력 관리", "orchestration": "none", "attachedEvents": null}], "description": "process.description", "version_tag": "major", "participants": {"id": "Participant", "name": "계약관리 프로세스", "processRef": "Process_1"}, "subProcesses": [], "shortDescription": {"text": ""}, "instanceNamePattern": null, "processDefinitionId": "contract_management_process", "processDefinitionName": "계약관리 프로세스"}', '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:ns2="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:ns3="http://www.omg.org/spec/DD/20100524/DC" xmlns:ns4="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_contract_management_process" name="계약관리 프로세스" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Custom BPMN Modeler" exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant" name="계약관리 프로세스" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" name="계약관리 프로세스" isExecutable="true" megaProcessId="경영지원" majorProcessId="구매/계약관리">
    <bpmn:extensionElements>
      <uengine:properties>
        <uengine:json>{"definitionName":"계약관리 프로세스","version":"1.0","shortDescription":{"text":""}}</uengine:json>
        <uengine:variable name="계약요청서" type="form">
          <uengine:json>{"value":"","options":{"description":"계약 요청을 위한 기본 정보"}}</uengine:json>
        </uengine:variable>
        <uengine:variable name="검토의견" type="text">
          <uengine:json>{"value":"","options":{"description":"내부 검토 결과 의견"}}</uengine:json>
        </uengine:variable>
        <uengine:variable name="승인여부" type="text">
          <uengine:json>{"value":"","options":{"description":"계약 요청 승인 결과"}}</uengine:json>
        </uengine:variable>
        <uengine:variable name="계약서" type="attachment">
          <uengine:json>{"value":"","options":{"description":"작성 및 체결되는 계약서 원본"}}</uengine:json>
        </uengine:variable>
      </uengine:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_0" name="계약요청자" resolutionRule="계약 요청을 담당하는 부서 또는 개인">
        <bpmn:flowNodeRef>start_event</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>request_activity</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_1" name="검토자" resolutionRule="계약 검토를 담당하는 부서 또는 개인">
        <bpmn:flowNodeRef>approve_gateway</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>end_event_reject</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>review_activity</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_3" name="계약담당자" resolutionRule="계약서 작성 및 체결을 담당하는 부서 또는 개인">
        <bpmn:flowNodeRef>draft_activity</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>sign_activity</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_4" name="관리자" resolutionRule="계약 후 지속적 관리를 담당하는 부서 또는 개인">
        <bpmn:flowNodeRef>manage_activity</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>end_event</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:sequenceFlow id="SequenceFlow_start_event_request_activity" sourceRef="start_event" targetRef="request_activity" waypoints="[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:sequenceFlow id="SequenceFlow_request_activity_review_activity" sourceRef="request_activity" targetRef="review_activity" waypoints="[object Object],[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:sequenceFlow id="SequenceFlow_review_activity_approve_gateway" sourceRef="review_activity" targetRef="approve_gateway" waypoints="[object Object],[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:sequenceFlow id="SequenceFlow_approve_gateway_draft_activity" name="승인" sourceRef="approve_gateway" targetRef="draft_activity" waypoints="[object Object],[object Object],[object Object],[object Object],[object Object]">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"condition":"계약 검토 결과 승인됨"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_approve_gateway_end_event_reject" name="반려" sourceRef="approve_gateway" targetRef="end_event_reject" waypoints="[object Object],[object Object],[object Object],[object Object],[object Object]">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"condition":"계약 검토 결과 반려됨"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_draft_activity_sign_activity" sourceRef="draft_activity" targetRef="sign_activity" waypoints="[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:sequenceFlow id="SequenceFlow_sign_activity_manage_activity" sourceRef="sign_activity" targetRef="manage_activity" waypoints="[object Object],[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:sequenceFlow id="SequenceFlow_manage_activity_end_event" sourceRef="manage_activity" targetRef="end_event" waypoints="[object Object],[object Object],[object Object],[object Object]" />
    <bpmn:startEvent id="start_event" name="계약관리 시작">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"description":"계약관리가 필요한 상황 발생 시 시작","role":"계약요청자"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:outgoing>SequenceFlow_start_event_request_activity</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="request_activity" name="계약 요청 등록">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":"계약요청자","duration":"2","instruction":"계약 요청서를 작성하여 제출하십시오.","description":"계약 요청서를 작성 및 제출","checkpoints":["요청서 항목 작성","관련 자료 첨부"],"agentMode":"none","orchestration":"none","attachments":[],"inputData":[],"tool":"formHandler:contract_management_process_request_activity_form"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_start_event_request_activity</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_request_activity_review_activity</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="approve_gateway" name="승인 여부 결정">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"description":"계약 요청에 대한 승인 여부 결정","role":"검토자"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_review_activity_approve_gateway</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_approve_gateway_draft_activity</bpmn:outgoing>
      <bpmn:outgoing>SequenceFlow_approve_gateway_end_event_reject</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="draft_activity" name="계약서 작성">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":"계약담당자","duration":"3","instruction":"검토 의견을 반영하여 계약서를 작성하십시오.","description":"계약서 초안 작성","checkpoints":["계약서 주요 조항 확인","필수 첨부서류 점검"],"agentMode":"none","orchestration":"none","attachments":[],"inputData":[],"tool":"formHandler:contract_management_process_draft_activity_form"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_approve_gateway_draft_activity</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_draft_activity_sign_activity</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="sign_activity" name="계약 체결">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":"계약담당자","duration":"2","instruction":"계약 당사자 서명 및 날인 진행","description":"당사자 간 계약서 서명 및 체결","checkpoints":["서명/날인 확인","계약서 보관"],"agentMode":"none","orchestration":"none","attachments":[],"inputData":[],"tool":"formHandler:contract_management_process_sign_activity_form"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_draft_activity_sign_activity</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_sign_activity_manage_activity</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="manage_activity" name="계약 관리">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":"관리자","duration":"0","instruction":"계약 이행사항 점검 및 이력 관리","description":"계약 이행, 갱신, 종료 등 계약 관련 업무 지속적 관리","checkpoints":["이행사항 기록","계약 종료 시점 체크"],"agentMode":"none","orchestration":"none","attachments":[],"inputData":[],"tool":"formHandler:contract_management_process_manage_activity_form"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_sign_activity_manage_activity</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_manage_activity_end_event</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="end_event" name="계약관리 종료">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"description":"계약 관리 종료","role":"관리자"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_manage_activity_end_event</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="end_event_reject" name="계약 반려 종료">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"description":"계약 요청이 반려되어 종료","role":"검토자"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_approve_gateway_end_event_reject</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:userTask id="review_activity" name="계약 요청 검토">
      <bpmn:extensionElements>
        <uengine:properties>
          <uengine:json>{"role":"검토자","duration":"3","instruction":"계약 요청서의 적정성, 위험성 등을 검토하십시오.","description":"요청된 계약 내용을 내부적으로 검토","checkpoints":["내용 적정성 확인","법적 리스크 검토"],"agentMode":"none","orchestration":"none","attachments":[],"inputData":[],"tool":"formHandler:contract_management_process_review_activity_form"}</uengine:json>
        </uengine:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_request_activity_review_activity</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_review_activity_approve_gateway</bpmn:outgoing>
    </bpmn:userTask>
  </bpmn:process>
  <ns2:BPMNDiagram id="BPMNDiagram_1">
    <ns2:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <ns2:BPMNShape id="Participant_1" bpmnElement="Participant" isHorizontal="true">
        <ns3:Bounds x="-30" y="0" width="1230" height="520" />
      </ns2:BPMNShape>
      <ns2:BPMNShape id="BPMNShape_4" bpmnElement="Lane_4" ...', '1a4cdcce-d1e3-4df0-91c7-a95829993e56', 'uengine', 'false', null, 'bpmn', null);
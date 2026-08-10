<template>
    <v-app>
        <div class="instance-progress-e2e-page">
            <v-app-bar color="primary" density="compact">
                <v-app-bar-title>Instance Progress E2E</v-app-bar-title>
                <v-spacer />
                <v-btn
                    v-for="item in scenarios"
                    :key="item.key"
                    size="small"
                    variant="text"
                    :class="['e2e-scenario-button', `e2e-scenario-${item.key}`]"
                    @click="selectScenario(item.key)"
                >
                    {{ item.key }}
                </v-btn>
                <v-divider vertical class="mx-2" />
                <v-btn
                    size="small"
                    variant="tonal"
                    class="e2e-journal-toggle"
                    data-testid="journal-toggle"
                    @click="journalEnabled = !journalEnabled"
                >
                    {{ journalEnabled ? '판단 이력 ON' : '판단 이력 OFF' }}
                </v-btn>
            </v-app-bar>

            <v-main class="instance-progress-e2e-canvas">
                <div class="e2e-scenario-label" data-testid="scenario-label">
                    {{ scenario }} · {{ journalEnabled && hasJournal ? '이력(사실)' : '추론' }}
                </div>
                <!-- key 를 붙이지 않아야 시나리오 전환 시 재마운트 없이 강조가 다시 계산되는지(잔상 제거) 검증된다 -->
                <BpmnUengineViewer :bpmn="diagramXML" :taskStatus="taskStatus" :decisionJournal="decisionJournal" style="height: 100%" />
            </v-main>
        </div>
    </v-app>
</template>

<script>
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';

// 분기(배타 게이트웨이)와 병합을 모두 포함한 최소 진행 상태 검증용 정의.
// Start -> A -> XOR -> (B | C) -> XOR -> D -> End
const mainDiagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_progress" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_progress" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="시작"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_A" name="신청 접수"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="금액 구분"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_3</bpmn:outgoing><bpmn:outgoing>Flow_4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_B" name="팀장 승인"><bpmn:incoming>Flow_3</bpmn:incoming><bpmn:outgoing>Flow_5</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_C" name="임원 승인"><bpmn:incoming>Flow_4</bpmn:incoming><bpmn:outgoing>Flow_6</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_2" name="병합"><bpmn:incoming>Flow_5</bpmn:incoming><bpmn:incoming>Flow_6</bpmn:incoming><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_D" name="결과 통보"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="종료"><bpmn:incoming>Flow_8</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_A" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_A" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Task_B" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_C" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_B" targetRef="Gateway_2" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_C" targetRef="Gateway_2" />
    <bpmn:sequenceFlow id="Flow_7" sourceRef="Gateway_2" targetRef="Task_D" />
    <bpmn:sequenceFlow id="Flow_8" sourceRef="Task_D" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_progress">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="182" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A"><dc:Bounds x="250" y="160" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="400" y="175" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_B_di" bpmnElement="Task_B"><dc:Bounds x="510" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_C_di" bpmnElement="Task_C"><dc:Bounds x="510" y="250" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_2_di" bpmnElement="Gateway_2" isMarkerVisible="true"><dc:Bounds x="670" y="175" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_D_di" bpmnElement="Task_D"><dc:Bounds x="780" y="160" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="930" y="182" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="200" /><di:waypoint x="250" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="200" /><di:waypoint x="400" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="425" y="175" /><di:waypoint x="425" y="120" /><di:waypoint x="510" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="425" y="225" /><di:waypoint x="425" y="290" /><di:waypoint x="510" y="290" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5"><di:waypoint x="610" y="120" /><di:waypoint x="695" y="120" /><di:waypoint x="695" y="175" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6"><di:waypoint x="610" y="290" /><di:waypoint x="695" y="290" /><di:waypoint x="695" y="225" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7"><di:waypoint x="720" y="200" /><di:waypoint x="780" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8"><di:waypoint x="880" y="200" /><di:waypoint x="930" y="200" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// 두 번째 정의: 분기가 곧바로 서로 다른 종료 이벤트로 끝난다.
// 이 구조는 상태맵만으로는 어느 갈래로 갔는지 알 수 없다 — 양쪽 모두 실행 흔적이 없는
// 종료 이벤트로 향하므로, 추론은 아무 갈래도 표시하지 못한다. 판단 이력이 있어야 확정된다.
const terminalDiagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_terminal" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_terminal" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="시작"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_A" name="지출 심사"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="심사 결과"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_approve</bpmn:outgoing><bpmn:outgoing>Flow_reject</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:endEvent id="End_approved" name="승인 종료"><bpmn:incoming>Flow_approve</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_rejected" name="반려 종료"><bpmn:incoming>Flow_reject</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_A" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_A" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_approve" name="승인" sourceRef="Gateway_1" targetRef="End_approved" />
    <bpmn:sequenceFlow id="Flow_reject" name="반려" sourceRef="Gateway_1" targetRef="End_rejected" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_2">
    <bpmndi:BPMNPlane id="BPMNPlane_2" bpmnElement="Process_terminal">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="182" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A"><dc:Bounds x="250" y="160" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="410" y="175" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_approved_di" bpmnElement="End_approved"><dc:Bounds x="580" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_rejected_di" bpmnElement="End_rejected"><dc:Bounds x="580" y="262" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="200" /><di:waypoint x="250" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="200" /><di:waypoint x="410" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_approve_di" bpmnElement="Flow_approve"><di:waypoint x="435" y="175" /><di:waypoint x="435" y="120" /><di:waypoint x="580" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_reject_di" bpmnElement="Flow_reject"><di:waypoint x="435" y="225" /><di:waypoint x="435" y="280" /><di:waypoint x="580" y="280" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// 세 번째 정의: 두 갈래가 모두 통과 노드(게이트웨이)만 거쳐 다시 합류한다.
// 추론은 양쪽 모두 "실행 흔적에 닿는다"고 보아 두 갈래를 전부 표시한다(알려진 과잉 표시).
// 판단 이력이 있으면 분기 지점에서 갈래가 끊기므로, 선택되지 않은 갈래의 하위 구간까지 함께 사라진다.
const ambiguousDiagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_ambiguous" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_ambiguous" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="시작"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_A" name="신청 접수"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="경로 구분"><bpmn:incoming>Flow_2</bpmn:incoming><bpmn:outgoing>Flow_a</bpmn:outgoing><bpmn:outgoing>Flow_b</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:exclusiveGateway id="Gateway_3" name="상단 경유"><bpmn:incoming>Flow_a</bpmn:incoming><bpmn:outgoing>Flow_c</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:exclusiveGateway id="Gateway_4" name="하단 경유"><bpmn:incoming>Flow_b</bpmn:incoming><bpmn:outgoing>Flow_d</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:exclusiveGateway id="Gateway_2" name="병합"><bpmn:incoming>Flow_c</bpmn:incoming><bpmn:incoming>Flow_d</bpmn:incoming><bpmn:outgoing>Flow_7</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_D" name="결과 통보"><bpmn:incoming>Flow_7</bpmn:incoming><bpmn:outgoing>Flow_8</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="종료"><bpmn:incoming>Flow_8</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_A" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_A" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_a" name="상단" sourceRef="Gateway_1" targetRef="Gateway_3" />
    <bpmn:sequenceFlow id="Flow_b" name="하단" sourceRef="Gateway_1" targetRef="Gateway_4" />
    <bpmn:sequenceFlow id="Flow_c" sourceRef="Gateway_3" targetRef="Gateway_2" />
    <bpmn:sequenceFlow id="Flow_d" sourceRef="Gateway_4" targetRef="Gateway_2" />
    <bpmn:sequenceFlow id="Flow_7" sourceRef="Gateway_2" targetRef="Task_D" />
    <bpmn:sequenceFlow id="Flow_8" sourceRef="Task_D" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_3">
    <bpmndi:BPMNPlane id="BPMNPlane_3" bpmnElement="Process_ambiguous">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="140" y="182" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A"><dc:Bounds x="230" y="160" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="390" y="175" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_3_di" bpmnElement="Gateway_3" isMarkerVisible="true"><dc:Bounds x="530" y="85" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_4_di" bpmnElement="Gateway_4" isMarkerVisible="true"><dc:Bounds x="530" y="265" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_2_di" bpmnElement="Gateway_2" isMarkerVisible="true"><dc:Bounds x="680" y="175" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_D_di" bpmnElement="Task_D"><dc:Bounds x="800" y="160" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="960" y="182" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="176" y="200" /><di:waypoint x="230" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="330" y="200" /><di:waypoint x="390" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_a_di" bpmnElement="Flow_a"><di:waypoint x="415" y="175" /><di:waypoint x="415" y="110" /><di:waypoint x="530" y="110" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_b_di" bpmnElement="Flow_b"><di:waypoint x="415" y="225" /><di:waypoint x="415" y="290" /><di:waypoint x="530" y="290" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_c_di" bpmnElement="Flow_c"><di:waypoint x="580" y="110" /><di:waypoint x="705" y="110" /><di:waypoint x="705" y="175" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_d_di" bpmnElement="Flow_d"><di:waypoint x="580" y="290" /><di:waypoint x="705" y="290" /><di:waypoint x="705" y="225" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7"><di:waypoint x="730" y="200" /><di:waypoint x="800" y="200" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8"><di:waypoint x="900" y="200" /><di:waypoint x="960" y="200" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const SCENARIOS = [
    // 첫 액티비티만 실행중 — 시작 이벤트에서 들어오는 선만 흘러간 경로
    { key: 'started', status: { Task_A: 'Running' } },
    // A 완료 후 게이트웨이를 지나 B 실행중 — 선택되지 않은 분기는 강조되지 않아야
    { key: 'branch-b-running', status: { Task_A: 'Completed', Task_B: 'Running' } },
    // 게이트웨이 두 개를 관통해 D 실행중
    { key: 'through-gateways', status: { Task_A: 'Completed', Task_B: 'Completed', Task_D: 'Running' } },
    // 종료까지 완료
    { key: 'finished', status: { Task_A: 'Completed', Task_B: 'Completed', Task_D: 'Completed' } },
    // 판단 이력이 있으면 추론이 고른 갈래를 이력이 교정한다.
    // 상태만 보면 B 가 실행중이라 Flow_3 이 맞지만, 실제 엔진은 C 로 갔다가 반려되어 되돌아온 상황을 가정.
    {
        key: 'journal-corrects-branch',
        status: { Task_A: 'Completed', Task_B: 'Running' },
        journal: { confirmedSequenceIds: ['Flow_2', 'Flow_4'], rejectedSequenceIds: ['Flow_3'] }
    },
    // 통과 노드만 거쳐 합류하는 두 갈래 — 추론은 양쪽을 모두 표시하지만 이력이 한쪽으로 끊는다.
    {
        key: 'ambiguous-rejoin',
        fixture: 'ambiguous',
        status: { Task_A: 'Completed', Task_D: 'Running' },
        journal: { confirmedSequenceIds: ['Flow_2', 'Flow_a', 'Flow_c', 'Flow_7'], rejectedSequenceIds: ['Flow_b'] }
    },
    // 추론이 판정할 수 없는 구조(양쪽 갈래가 모두 종료 이벤트).
    // 이력 없으면 아무 갈래도 표시하지 못하고, 이력이 있으면 승인 갈래가 확정된다.
    {
        key: 'terminal-branches',
        fixture: 'terminal',
        status: { Task_A: 'Completed' },
        journal: { confirmedSequenceIds: ['Flow_2', 'Flow_approve'], rejectedSequenceIds: ['Flow_reject'] }
    }
];

export default {
    name: 'InstanceProgressE2E',
    components: { BpmnUengineViewer },
    data() {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('scenario');
        const initial = SCENARIOS.find((item) => item.key === requested) || SCENARIOS[0];
        return {
            scenarios: SCENARIOS,
            scenario: initial.key,
            // 같은 상태에서 "이력 있음/없음"을 나란히 비교할 수 있게 토글로 둔다.
            journalEnabled: params.get('journal') !== 'off'
        };
    },
    computed: {
        current() {
            return SCENARIOS.find((item) => item.key === this.scenario) || SCENARIOS[0];
        },
        diagramXML() {
            if (this.current.fixture === 'terminal') return terminalDiagramXML;
            if (this.current.fixture === 'ambiguous') return ambiguousDiagramXML;
            return mainDiagramXML;
        },
        taskStatus() {
            return this.current.status || {};
        },
        hasJournal() {
            return !!this.current.journal;
        },
        decisionJournal() {
            if (!this.journalEnabled) return null;
            return this.current.journal || null;
        }
    },
    methods: {
        selectScenario(key) {
            this.scenario = key;
        }
    }
};
</script>

<style scoped>
.instance-progress-e2e-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.instance-progress-e2e-canvas {
    flex: 1 1 auto;
    height: 100%;
}

.e2e-scenario-label {
    position: absolute;
    top: 4px;
    left: 8px;
    z-index: 20;
    font-size: 12px;
    opacity: 0.6;
}
</style>

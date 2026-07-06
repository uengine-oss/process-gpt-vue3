<template>
  <v-app>
    <div class="bpmn-auto-layout-e2e-page">
    <v-app-bar color="primary" density="compact">
      <v-app-bar-title>BPMN Auto Layout E2E</v-app-bar-title>
      <v-spacer />
      <v-btn icon="mdi-folder-open" variant="text" @click="showCaseDialog = true" title="Load case">
        <v-icon>mdi-folder-open</v-icon>
      </v-btn>
    </v-app-bar>

    <v-dialog v-model="showCaseDialog" max-width="460" persistent>
      <v-card>
        <v-card-title>Load BPMN case</v-card-title>
        <v-card-text>
          <v-list density="compact">
            <v-list-item
              v-for="item in caseItems"
              :key="item.path"
              :title="item.title"
              :subtitle="item.subtitle"
              @click="loadCase(item)"
              clickable
            >
              <template #prepend>
                <v-icon>mdi-file-document-outline</v-icon>
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-if="caseLoadError" type="error" density="compact" class="mt-2">
            {{ caseLoadError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCaseDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-main class="bpmn-e2e-canvas-wrap">
      <BpmnUengine
        ref="bpmn"
        :bpmn="diagramXML"
        :is-view-mode="isViewMode"
        :register-to-store="false"
        @done="onDiagramLoaded"
      >
        <template #extra-controls>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-icon v-bind="props" class="e2e-auto-layout-button" size="small" @click="applyAutoLayout">
                mdi-auto-fix
              </v-icon>
            </template>
            <span>Auto layout</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-icon v-bind="props" class="e2e-rotate-button" size="small" @click="rotateLayout">
                mdi-crop-rotate
              </v-icon>
            </template>
            <span>Rotate layout</span>
          </v-tooltip>
        </template>
      </BpmnUengine>
    </v-main>
    </div>
  </v-app>
</template>

<script>
import BpmnUengine from '@/components/BpmnUengine.vue';

const defaultBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Operations" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="Team">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="Review"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="End"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true"><dc:Bounds x="160" y="80" width="600" height="220" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true"><dc:Bounds x="190" y="80" width="570" height="220" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="240" y="172" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="350" y="150" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="530" y="172" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="276" y="190" /><di:waypoint x="350" y="190" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="450" y="190" /><di:waypoint x="530" y="190" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default {
  name: 'BpmnAutoLayoutE2E',
  components: { BpmnUengine },
  data() {
    return {
      diagramXML: defaultBpmn,
      showCaseDialog: false,
      caseLoadError: '',
      isViewMode: new URLSearchParams(window.location.search).get('viewMode') === 'true',
      caseItems: [
        { path: '/case/uengine6-definitions/01-purchase-request.bpmn', title: 'Purchase Request', subtitle: 'uEngine6 definitions #1' },
        { path: '/case/uengine6-definitions/02-srms.bpmn', title: 'SRMS', subtitle: 'uEngine6 definitions #2' },
        { path: '/case/uengine6-definitions/03-trouble-subprocess.bpmn', title: 'Trouble SubProcess', subtitle: 'uEngine6 definitions #3' },
        { path: '/case/uengine6-definitions/04-credit-rating.bpmn', title: 'Credit Rating', subtitle: 'uEngine6 definitions #4' },
        { path: '/case/uengine6-definitions/05-credit-rating-2.bpmn', title: 'Credit Rating 2', subtitle: 'uEngine6 definitions #5' },
        { path: '/case/uengine6-definitions/06-trouble-branch.bpmn', title: 'Trouble Branch', subtitle: 'uEngine6 definitions #6' },
        { path: '/case/uengine6-definitions/07-error-fix-process.bpmn', title: 'Error Fix Process', subtitle: 'uEngine6 definitions #7' },
        { path: '/case/uengine6-definitions/08-incident-reception.bpmn', title: 'Incident Reception', subtitle: 'uEngine6 definitions #8' },
        { path: '/case/uengine6-definitions/09-trouble-report-basic.bpmn', title: 'Trouble Report Basic', subtitle: 'uEngine6 definitions #9' },
        { path: '/case/uengine6-definitions/10-trouble-report-mapping.bpmn', title: 'Trouble Report Mapping', subtitle: 'uEngine6 definitions #10' },
        { path: '/case/uengine6-definitions/11-attached-contract-review.bpmn', title: 'Attached Contract Review', subtitle: 'uEngine6 definitions #11' },
        { path: '/case/uengine6-definitions/12-vendor-onboarding-improvement.bpmn', title: '협력사 온보딩 개선 프로세스', subtitle: '자동 방향 전환, CallActivity, 매퍼, 동적 역할 매핑' },
        { path: '/case/uengine6-definitions/13-vendor-security-review.bpmn', title: '협력사 보안 심사 프로세스', subtitle: 'CallActivity로 호출되는 보안 심사 프로세스' }
      ]
    };
  },
  mounted() {
    window.$bpmnAutoLayoutE2E = this;
  },
  methods: {
    onDiagramLoaded() {},
    applyAutoLayout() {
      this.$refs.bpmn?.applyAutoLayout?.();
    },
    rotateLayout(event) {
      window.event = event;
      this.$refs.bpmn?.changeOrientation?.();
    },
    async loadCase(item) {
      this.caseLoadError = '';
      try {
        const res = await fetch(item.path);
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const xml = await res.text();
        if (!xml.includes('bpmn:definitions') && !xml.includes('bpmn2:definitions')) {
          throw new Error('Invalid BPMN XML.');
        }
        this.diagramXML = xml;
        this.showCaseDialog = false;
      } catch (e) {
        this.caseLoadError = e.message || 'Failed to load BPMN case.';
      }
    }
  }
};
</script>

<style scoped>
.bpmn-auto-layout-e2e-page {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bpmn-e2e-canvas-wrap {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.bpmn-e2e-canvas-wrap :deep(.vue-bpmn-diagram-container) {
  position: absolute;
  inset: 0;
}

.e2e-auto-layout-button,
.e2e-rotate-button {
  color: #444;
  cursor: pointer;
}

.bpmn-e2e-canvas-wrap :deep(.font-size-controls) {
  top: 56px !important;
  z-index: 10 !important;
}
</style>

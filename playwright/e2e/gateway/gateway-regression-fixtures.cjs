const { parseStringPromise } = require('xml2js');

const splitGatewayTags = {
    exclusive: 'bpmn:exclusiveGateway',
    inclusive: 'bpmn:inclusiveGateway',
    parallel: 'bpmn:parallelGateway'
};

const executionGatewayTypes = {
    exclusive: 'exclusiveGateway',
    inclusive: 'inclusiveGateway',
    parallel: 'parallelGateway'
};

const branchConditions = {
    1: 'The customer request is about a refund.',
    2: 'The customer request is about an invoice.',
    3: 'The customer request is asking for a proposal.',
    4: 'The customer request is about a contract review.',
    5: 'The customer request is a technical support issue.',
    6: 'The customer request is asking about pricing.',
    7: 'The customer request is about partnership.',
    8: 'The customer request is a complaint.'
};

const scenarios = [
    {
        id: 'exclusive-explicit-join-4',
        name: 'Exclusive explicit join',
        splitType: 'exclusive',
        joinType: 'exclusive',
        branchCount: 4,
        selectedBranches: ['branch_3'],
        aiExpectedBranches: ['branch_3'],
        aiRequestDetail: 'The customer asks us to prepare a proposal for a new CRM workflow automation project.',
        expectedPass: true
    },
    {
        id: 'inclusive-explicit-join-4',
        name: 'Inclusive explicit join',
        splitType: 'inclusive',
        joinType: 'inclusive',
        branchCount: 4,
        selectedBranches: ['branch_2', 'branch_3'],
        aiExpectedBranches: ['branch_2', 'branch_3'],
        aiRequestDetail:
            'The customer asks about an invoice and also asks us to prepare a proposal for a new CRM workflow automation project.',
        expectedPass: true
    },
    {
        id: 'parallel-explicit-join-4',
        name: 'Parallel explicit join',
        splitType: 'parallel',
        joinType: 'parallel',
        branchCount: 4,
        selectedBranches: ['branch_1', 'branch_2', 'branch_3', 'branch_4'],
        expectedPass: true
    },
    {
        id: 'exclusive-direct-merge-8',
        name: 'Exclusive direct merge',
        splitType: 'exclusive',
        joinType: null,
        branchCount: 8,
        selectedBranches: ['branch_3'],
        aiExpectedBranches: ['branch_3'],
        aiRequestDetail: 'The customer asks us to prepare a proposal for a new CRM workflow automation project.',
        expectedPass: true,
        ai: true
    },
    {
        id: 'inclusive-direct-merge-4',
        name: 'Inclusive direct merge',
        splitType: 'inclusive',
        joinType: null,
        branchCount: 4,
        selectedBranches: ['branch_2', 'branch_3'],
        aiExpectedBranches: ['branch_2', 'branch_3'],
        aiRequestDetail:
            'The customer asks about an invoice and also asks us to prepare a proposal for a new CRM workflow automation project.',
        expectedPass: true
    },
    {
        id: 'parallel-direct-merge-4',
        name: 'Parallel direct merge',
        splitType: 'parallel',
        joinType: null,
        branchCount: 4,
        selectedBranches: ['branch_1', 'branch_2', 'branch_3', 'branch_4'],
        expectedPass: true
    },
    {
        id: 'parallel-direct-merge-waits-4',
        name: 'Parallel direct merge waits',
        splitType: 'parallel',
        joinType: null,
        branchCount: 4,
        selectedBranches: ['branch_1', 'branch_2', 'branch_3', 'branch_4'],
        doneBranches: ['branch_1'],
        expectedReachMerge: false,
        expectedPass: true
    },
    {
        id: 'exclusive-direct-merge-then-inclusive-split',
        name: 'Exclusive direct merge then inclusive split',
        splitType: 'exclusive',
        joinType: null,
        branchCount: 4,
        selectedBranches: ['branch_3'],
        aiExpectedBranches: ['branch_2'],
        aiRequestDetail:
            'The customer asks about an invoice and also asks us to prepare a proposal for a new CRM workflow automation project.',
        afterMerge: {
            splitType: 'inclusive',
            branchCount: 3,
            selectedBranches: ['follow_branch_2', 'follow_branch_3']
        },
        expectedPass: true
    },
    {
        id: 'inclusive-direct-merge-then-exclusive-split',
        name: 'Inclusive direct merge then exclusive split',
        splitType: 'inclusive',
        joinType: null,
        branchCount: 4,
        selectedBranches: ['branch_2', 'branch_3'],
        aiExpectedBranches: ['branch_3'],
        aiRequestDetail: 'The customer asks us to prepare a proposal for a new CRM workflow automation project.',
        afterMerge: {
            splitType: 'exclusive',
            branchCount: 3,
            selectedBranches: ['follow_branch_3']
        },
        expectedPass: true
    }
];

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function uengineJson(value) {
    return escapeXml(JSON.stringify(value));
}

function extensionJson(value) {
    return `<bpmn:extensionElements><uengine:properties><uengine:json>${uengineJson(
        value
    )}</uengine:json></uengine:properties></bpmn:extensionElements>`;
}

function createGatewayRegressionBpmnXml(scenario) {
    const branchIds = Array.from({ length: scenario.branchCount }, (_, index) => `branch_${index + 1}`);
    const processId = scenario.id.replace(/-/g, '_');
    const splitTag = splitGatewayTags[scenario.splitType];
    const joinTag = scenario.joinType ? splitGatewayTags[scenario.joinType] : null;
    const followIds = scenario.afterMerge
        ? Array.from({ length: scenario.afterMerge.branchCount }, (_, index) => `follow_branch_${index + 1}`)
        : [];
    const followTag = scenario.afterMerge ? splitGatewayTags[scenario.afterMerge.splitType] : null;
    const targetAfterBranch = scenario.joinType ? 'join_gateway' : 'merge_task';
    const branchY = (index) => 115 + index * 110;
    const centerY = branchY(Math.floor((scenario.branchCount - 1) / 2)) + 32;
    const height = Math.max(560, 190 + scenario.branchCount * 110);
    const nodeRefs = ['start', 'initial', 'split_gateway', ...branchIds];
    if (scenario.joinType) nodeRefs.push('join_gateway');
    nodeRefs.push('merge_task');
    if (scenario.afterMerge) nodeRefs.push('follow_split_gateway', ...followIds, 'final_task');
    nodeRefs.push('end');

    const splitOutgoing = branchIds.map((id) => `<bpmn:outgoing>flow_split_${id}</bpmn:outgoing>`).join('\n      ');
    const mergeIncoming = branchIds.map((id) => `<bpmn:incoming>flow_${id}_merge</bpmn:incoming>`).join('\n      ');
    const joinIncoming = branchIds.map((id) => `<bpmn:incoming>flow_${id}_join</bpmn:incoming>`).join('\n      ');

    const branchTasks = branchIds
        .map((id) => {
            const out = scenario.joinType ? `flow_${id}_join` : `flow_${id}_merge`;
            return `
    <bpmn:userTask id="${id}" name="${id}">
      ${extensionJson({ role: { name: 'tester' }, tool: `formHandler:${id}` })}
      <bpmn:incoming>flow_split_${id}</bpmn:incoming>
      <bpmn:outgoing>${out}</bpmn:outgoing>
    </bpmn:userTask>`;
        })
        .join('');

    const splitFlows = branchIds
        .map((id, index) => {
            const props =
                scenario.splitType === 'parallel'
                    ? {}
                    : { condition: branchConditions[index + 1], conditionMode: 'text', priority: index + 1 };
            return `
    <bpmn:sequenceFlow id="flow_split_${id}" sourceRef="split_gateway" targetRef="${id}">
      ${extensionJson(props)}
    </bpmn:sequenceFlow>`;
        })
        .join('');

    const branchOutFlows = branchIds
        .map(
            (id) => `
    <bpmn:sequenceFlow id="flow_${id}_${scenario.joinType ? 'join' : 'merge'}" sourceRef="${id}" targetRef="${targetAfterBranch}">
      ${extensionJson({})}
    </bpmn:sequenceFlow>`
        )
        .join('');

    const joinXml = scenario.joinType
        ? `
    <${joinTag} id="join_gateway" name="${scenario.joinType} join">
      ${extensionJson({ role: { name: 'tester' } })}
      ${joinIncoming}
      <bpmn:outgoing>flow_join_merge</bpmn:outgoing>
    </${joinTag}>`
        : '';

    const mergeIncomingXml = scenario.joinType ? '<bpmn:incoming>flow_join_merge</bpmn:incoming>' : mergeIncoming;
    const joinFlowXml = scenario.joinType
        ? `<bpmn:sequenceFlow id="flow_join_merge" sourceRef="join_gateway" targetRef="merge_task">${extensionJson({})}</bpmn:sequenceFlow>`
        : '';
    const mergeOutgoingXml = scenario.afterMerge
        ? '<bpmn:outgoing>flow_merge_follow_split</bpmn:outgoing>'
        : '<bpmn:outgoing>flow_merge_end</bpmn:outgoing>';
    const endIncomingXml = scenario.afterMerge
        ? '<bpmn:incoming>flow_final_end</bpmn:incoming>'
        : '<bpmn:incoming>flow_merge_end</bpmn:incoming>';
    const followOutgoing = followIds.map((id) => `<bpmn:outgoing>flow_follow_split_${id}</bpmn:outgoing>`).join('\n      ');
    const finalIncoming = followIds.map((id) => `<bpmn:incoming>flow_${id}_final</bpmn:incoming>`).join('\n      ');
    const afterMergeXml = scenario.afterMerge
        ? `
    <${followTag} id="follow_split_gateway" name="${scenario.afterMerge.splitType} follow split">
      ${extensionJson({ role: { name: 'tester' } })}
      <bpmn:incoming>flow_merge_follow_split</bpmn:incoming>
      ${followOutgoing}
    </${followTag}>
    ${followIds
        .map(
            (id) => `
    <bpmn:userTask id="${id}" name="${id}">
      ${extensionJson({ role: { name: 'tester' }, tool: `formHandler:${id}` })}
      <bpmn:incoming>flow_follow_split_${id}</bpmn:incoming>
      <bpmn:outgoing>flow_${id}_final</bpmn:outgoing>
    </bpmn:userTask>`
        )
        .join('')}
    <bpmn:userTask id="final_task" name="final task">
      ${extensionJson({ role: { name: 'tester' }, tool: 'formHandler:final' })}
      ${finalIncoming}
      <bpmn:outgoing>flow_final_end</bpmn:outgoing>
    </bpmn:userTask>`
        : '';
    const afterMergeFlowsXml = scenario.afterMerge
        ? `
    <bpmn:sequenceFlow id="flow_merge_follow_split" sourceRef="merge_task" targetRef="follow_split_gateway">${extensionJson(
        {}
    )}</bpmn:sequenceFlow>
    ${followIds
        .map((id, index) => {
            const props =
                scenario.afterMerge.splitType === 'parallel'
                    ? {}
                    : { condition: branchConditions[index + 1], conditionMode: 'text', priority: index + 1 };
            return `<bpmn:sequenceFlow id="flow_follow_split_${id}" sourceRef="follow_split_gateway" targetRef="${id}">${extensionJson(
                props
            )}</bpmn:sequenceFlow>`;
        })
        .join('\n    ')}
    ${followIds
        .map(
            (id) =>
                `<bpmn:sequenceFlow id="flow_${id}_final" sourceRef="${id}" targetRef="final_task">${extensionJson({})}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
    <bpmn:sequenceFlow id="flow_final_end" sourceRef="final_task" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>`
        : '';

    const branchShapes = branchIds
        .map(
            (id, index) => `
      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
        <dc:Bounds x="470" y="${branchY(index)}" width="110" height="64" />
      </bpmndi:BPMNShape>`
        )
        .join('');

    const splitEdges = branchIds
        .map(
            (id, index) => `
      <bpmndi:BPMNEdge id="flow_split_${id}_di" bpmnElement="flow_split_${id}">
        <di:waypoint x="382" y="${centerY}" />
        <di:waypoint x="425" y="${centerY}" />
        <di:waypoint x="425" y="${branchY(index) + 32}" />
        <di:waypoint x="470" y="${branchY(index) + 32}" />
      </bpmndi:BPMNEdge>`
        )
        .join('');

    const branchOutEdges = branchIds
        .map((id, index) => {
            const edgeId = `flow_${id}_${scenario.joinType ? 'join' : 'merge'}`;
            const targetX = scenario.joinType ? 670 : 780;
            const bendX = scenario.joinType ? 625 : 680;
            return `
      <bpmndi:BPMNEdge id="${edgeId}_di" bpmnElement="${edgeId}">
        <di:waypoint x="580" y="${branchY(index) + 32}" />
        <di:waypoint x="${bendX}" y="${branchY(index) + 32}" />
        <di:waypoint x="${bendX}" y="${centerY}" />
        <di:waypoint x="${targetX}" y="${centerY}" />
      </bpmndi:BPMNEdge>`;
        })
        .join('');

    const joinShape = scenario.joinType
        ? `
      <bpmndi:BPMNShape id="join_gateway_di" bpmnElement="join_gateway" isMarkerVisible="true">
        <dc:Bounds x="670" y="${centerY - 25}" width="50" height="50" />
      </bpmndi:BPMNShape>`
        : '';
    const joinEdge = scenario.joinType
        ? `
      <bpmndi:BPMNEdge id="flow_join_merge_di" bpmnElement="flow_join_merge">
        <di:waypoint x="720" y="${centerY}" />
        <di:waypoint x="780" y="${centerY}" />
      </bpmndi:BPMNEdge>`
        : '';
    const afterMergeShapes = scenario.afterMerge
        ? `
      <bpmndi:BPMNShape id="follow_split_gateway_di" bpmnElement="follow_split_gateway" isMarkerVisible="true"><dc:Bounds x="930" y="${
          centerY - 25
      }" width="50" height="50" /></bpmndi:BPMNShape>
      ${followIds
          .map(
              (id, index) =>
                  `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="1040" y="${branchY(
                      index
                  )}" width="120" height="64" /></bpmndi:BPMNShape>`
          )
          .join('\n      ')}
      <bpmndi:BPMNShape id="final_task_di" bpmnElement="final_task"><dc:Bounds x="1260" y="${
          centerY - 40
      }" width="120" height="80" /></bpmndi:BPMNShape>`
        : '';
    const afterMergeEdges = scenario.afterMerge
        ? `
      <bpmndi:BPMNEdge id="flow_merge_follow_split_di" bpmnElement="flow_merge_follow_split"><di:waypoint x="900" y="${centerY}" /><di:waypoint x="930" y="${centerY}" /></bpmndi:BPMNEdge>
      ${followIds
          .map(
              (id, index) =>
                  `<bpmndi:BPMNEdge id="flow_follow_split_${id}_di" bpmnElement="flow_follow_split_${id}"><di:waypoint x="980" y="${centerY}" /><di:waypoint x="1010" y="${centerY}" /><di:waypoint x="1010" y="${
                      branchY(index) + 32
                  }" /><di:waypoint x="1040" y="${branchY(index) + 32}" /></bpmndi:BPMNEdge>`
          )
          .join('\n      ')}
      ${followIds
          .map(
              (id, index) =>
                  `<bpmndi:BPMNEdge id="flow_${id}_final_di" bpmnElement="flow_${id}_final"><di:waypoint x="1160" y="${
                      branchY(index) + 32
                  }" /><di:waypoint x="1210" y="${
                      branchY(index) + 32
                  }" /><di:waypoint x="1210" y="${centerY}" /><di:waypoint x="1260" y="${centerY}" /></bpmndi:BPMNEdge>`
          )
          .join('\n      ')}
      <bpmndi:BPMNEdge id="flow_final_end_di" bpmnElement="flow_final_end"><di:waypoint x="1380" y="${centerY}" /><di:waypoint x="1440" y="${centerY}" /></bpmndi:BPMNEdge>`
        : '';
    const participantWidth = scenario.afterMerge ? 1480 : 1020;
    const laneWidth = scenario.afterMerge ? 1450 : 990;
    const endX = scenario.afterMerge ? 1440 : 960;

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.9.1">
  <bpmn:collaboration id="Collaboration_${processId}">
    <bpmn:participant id="Participant_tester" name="tester" processRef="${processId}">
      ${extensionJson({ role: { name: 'tester' } })}
    </bpmn:participant>
  </bpmn:collaboration>
  <bpmn:process id="${processId}" name="${escapeXml(scenario.name)}" isExecutable="true">
    <bpmn:extensionElements><uengine:properties><uengine:json>${uengineJson({
        definitionName: scenario.name,
        version: '0.1'
    })}</uengine:json></uengine:properties></bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_tester">
      <bpmn:lane id="Lane_tester" name="tester">
        ${extensionJson({ role: { name: 'tester' } })}
        ${nodeRefs.map((id) => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join('\n        ')}
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="start" name="start">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:outgoing>flow_start_initial</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="initial" name="initial">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:initial'
    })}<bpmn:incoming>flow_start_initial</bpmn:incoming><bpmn:outgoing>flow_initial_split</bpmn:outgoing></bpmn:userTask>
    <${splitTag} id="split_gateway" name="${scenario.splitType} split">
      ${extensionJson({ role: { name: 'tester' } })}
      <bpmn:incoming>flow_initial_split</bpmn:incoming>
      ${splitOutgoing}
    </${splitTag}>
    ${branchTasks}
    ${joinXml}
    <bpmn:userTask id="merge_task" name="merge task">
      ${extensionJson({ role: { name: 'tester' }, tool: 'formHandler:merge' })}
      ${mergeIncomingXml}
      ${mergeOutgoingXml}
    </bpmn:userTask>
    ${afterMergeXml}
    <bpmn:endEvent id="end" name="end">${extensionJson({ role: { name: 'tester' } })}${endIncomingXml}</bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_initial" sourceRef="start" targetRef="initial">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_initial_split" sourceRef="initial" targetRef="split_gateway">${extensionJson({})}</bpmn:sequenceFlow>
    ${splitFlows}
    ${branchOutFlows}
    ${joinFlowXml}
    ${
        scenario.afterMerge
            ? afterMergeFlowsXml
            : '<bpmn:sequenceFlow id="flow_merge_end" sourceRef="merge_task" targetRef="end">' + extensionJson({}) + '</bpmn:sequenceFlow>'
    }
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_${processId}">
      <bpmndi:BPMNShape id="Participant_tester_di" bpmnElement="Participant_tester" isHorizontal="true"><dc:Bounds x="40" y="40" width="${participantWidth}" height="${height}" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_tester_di" bpmnElement="Lane_tester" isHorizontal="true"><dc:Bounds x="70" y="40" width="${laneWidth}" height="${height}" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="130" y="${
          centerY - 18
      }" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="initial_di" bpmnElement="initial"><dc:Bounds x="210" y="${
          centerY - 40
      }" width="110" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="split_gateway_di" bpmnElement="split_gateway" isMarkerVisible="true"><dc:Bounds x="332" y="${
          centerY - 25
      }" width="50" height="50" /></bpmndi:BPMNShape>
      ${branchShapes}
      ${joinShape}
      <bpmndi:BPMNShape id="merge_task_di" bpmnElement="merge_task"><dc:Bounds x="780" y="${
          centerY - 40
      }" width="120" height="80" /></bpmndi:BPMNShape>
      ${afterMergeShapes}
      <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="${endX}" y="${
        centerY - 18
    }" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_start_initial_di" bpmnElement="flow_start_initial"><di:waypoint x="166" y="${centerY}" /><di:waypoint x="210" y="${centerY}" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_initial_split_di" bpmnElement="flow_initial_split"><di:waypoint x="320" y="${centerY}" /><di:waypoint x="332" y="${centerY}" /></bpmndi:BPMNEdge>
      ${splitEdges}
      ${branchOutEdges}
      ${joinEdge}
      ${
          scenario.afterMerge
              ? afterMergeEdges
              : `<bpmndi:BPMNEdge id="flow_merge_end_di" bpmnElement="flow_merge_end"><di:waypoint x="900" y="${centerY}" /><di:waypoint x="960" y="${centerY}" /></bpmndi:BPMNEdge>`
      }
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

const customScenarios = [
    {
        id: 'nested-branch-inclusive-direct-merge',
        name: 'Nested branch inclusive direct merge',
        branchCount: 4,
        splitType: 'exclusive',
        selectedBranches: ['branch_3'],
        nestedSelectedBranches: ['nested_branch_2', 'nested_branch_3'],
        aiExpectedBranches: ['branch_3'],
        aiNestedExpectedBranches: ['nested_branch_3'],
        aiRequestDetail: 'The customer asks us to prepare a proposal for a new CRM workflow automation project.'
    },
    {
        id: 'inclusive-split-without-merge',
        name: 'Inclusive split without merge',
        branchCount: 3,
        splitType: 'inclusive',
        selectedBranches: ['branch_2', 'branch_3'],
        aiExpectedBranches: ['branch_2', 'branch_3'],
        aiRequestDetail:
            'The customer asks about an invoice and also asks us to prepare a proposal for a new CRM workflow automation project.'
    },
    {
        id: 'exclusive-direct-merge-with-mid-task',
        name: 'Exclusive direct merge with mid task',
        branchCount: 4,
        splitType: 'exclusive',
        selectedBranches: ['branch_3'],
        aiExpectedBranches: ['branch_3'],
        aiRequestDetail: 'The customer asks us to prepare a proposal for a new CRM workflow automation project.'
    }
];

const coverageCases = [
    {
        id: 'exclusive-explicit-join-refund-path',
        baseScenarioId: 'exclusive-explicit-join-4',
        selectedBranches: ['branch_1'],
        aiExpectedBranches: ['branch_1'],
        aiRequestDetail: 'The customer asks for a refund for a failed subscription payment.'
    },
    {
        id: 'inclusive-explicit-join-contract-only',
        baseScenarioId: 'inclusive-explicit-join-4',
        selectedBranches: ['branch_4'],
        aiExpectedBranches: ['branch_4'],
        aiRequestDetail: 'The customer asks us to review a contract before signing.'
    },
    {
        id: 'exclusive-direct-merge-complaint-path',
        baseScenarioId: 'exclusive-direct-merge-8',
        selectedBranches: ['branch_8'],
        aiExpectedBranches: ['branch_8'],
        aiRequestDetail: 'The customer is making a complaint about poor service quality.'
    },
    {
        id: 'inclusive-direct-merge-single-path',
        baseScenarioId: 'inclusive-direct-merge-4',
        selectedBranches: ['branch_2'],
        aiExpectedBranches: ['branch_2'],
        aiRequestDetail: 'The customer asks about an invoice only.'
    },
    {
        id: 'inclusive-direct-merge-three-paths',
        baseScenarioId: 'inclusive-direct-merge-4',
        selectedBranches: ['branch_1', 'branch_2', 'branch_3'],
        aiExpectedBranches: ['branch_1', 'branch_2', 'branch_3'],
        aiRequestDetail: 'The customer asks for a refund, asks about an invoice, and asks us to prepare a proposal.'
    },
    {
        id: 'inclusive-split-without-merge-single-path',
        baseScenarioId: 'inclusive-split-without-merge',
        custom: true,
        selectedBranches: ['branch_2'],
        aiExpectedBranches: ['branch_2'],
        aiRequestDetail: 'The customer asks about an invoice only.'
    },
    {
        id: 'nested-inclusive-direct-merge-single-inner-path',
        baseScenarioId: 'nested-branch-inclusive-direct-merge',
        custom: true,
        modes: ['deterministic'],
        selectedBranches: ['branch_3'],
        nestedSelectedBranches: ['nested_branch_2']
    }
];

function createCustomGatewayBpmnXml(scenario) {
    if (scenario.id === 'nested-branch-inclusive-direct-merge') {
        return createNestedBranchInclusiveDirectMergeXml(scenario);
    }
    if (scenario.id === 'inclusive-split-without-merge') {
        return createInclusiveSplitWithoutMergeXml(scenario);
    }
    if (scenario.id === 'exclusive-direct-merge-with-mid-task') {
        return createExclusiveDirectMergeWithMidTaskXml(scenario);
    }
    throw new Error(`Unknown custom gateway scenario: ${scenario.id}`);
}

function createNestedBranchInclusiveDirectMergeXml(scenario) {
    const processId = scenario.id.replace(/-/g, '_');
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.9.1">
  <bpmn:collaboration id="Collaboration_${processId}"><bpmn:participant id="Participant_tester" name="tester" processRef="${processId}">${extensionJson(
        { role: { name: 'tester' } }
    )}</bpmn:participant></bpmn:collaboration>
  <bpmn:process id="${processId}" name="${escapeXml(scenario.name)}" isExecutable="true">
    <bpmn:extensionElements><uengine:properties><uengine:json>${uengineJson({
        definitionName: scenario.name,
        version: '0.1'
    })}</uengine:json></uengine:properties></bpmn:extensionElements>
    <bpmn:startEvent id="start" name="start">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:outgoing>flow_start_initial</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="initial" name="initial">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:initial'
    })}<bpmn:incoming>flow_start_initial</bpmn:incoming><bpmn:outgoing>flow_initial_split</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="split_gateway" name="exclusive split">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_initial_split</bpmn:incoming><bpmn:outgoing>flow_split_branch_1</bpmn:outgoing><bpmn:outgoing>flow_split_branch_2</bpmn:outgoing><bpmn:outgoing>flow_split_branch_3</bpmn:outgoing><bpmn:outgoing>flow_split_branch_4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="branch_1" name="branch_1">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_1'
    })}<bpmn:incoming>flow_split_branch_1</bpmn:incoming><bpmn:outgoing>flow_branch_1_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_2" name="branch_2">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_2'
    })}<bpmn:incoming>flow_split_branch_2</bpmn:incoming><bpmn:outgoing>flow_branch_2_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_3" name="branch_3">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_3'
    })}<bpmn:incoming>flow_split_branch_3</bpmn:incoming><bpmn:outgoing>flow_branch_3_nested_split</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_4" name="branch_4">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_4'
    })}<bpmn:incoming>flow_split_branch_4</bpmn:incoming><bpmn:outgoing>flow_branch_4_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:inclusiveGateway id="nested_split_gateway" name="nested inclusive split">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_branch_3_nested_split</bpmn:incoming><bpmn:outgoing>flow_nested_split_nested_branch_1</bpmn:outgoing><bpmn:outgoing>flow_nested_split_nested_branch_2</bpmn:outgoing><bpmn:outgoing>flow_nested_split_nested_branch_3</bpmn:outgoing></bpmn:inclusiveGateway>
    <bpmn:userTask id="nested_branch_1" name="nested_branch_1">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:nested_branch_1'
    })}<bpmn:incoming>flow_nested_split_nested_branch_1</bpmn:incoming><bpmn:outgoing>flow_nested_branch_1_nested_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="nested_branch_2" name="nested_branch_2">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:nested_branch_2'
    })}<bpmn:incoming>flow_nested_split_nested_branch_2</bpmn:incoming><bpmn:outgoing>flow_nested_branch_2_nested_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="nested_branch_3" name="nested_branch_3">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:nested_branch_3'
    })}<bpmn:incoming>flow_nested_split_nested_branch_3</bpmn:incoming><bpmn:outgoing>flow_nested_branch_3_nested_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="nested_merge_task" name="nested merge task">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:nested_merge'
    })}<bpmn:incoming>flow_nested_branch_1_nested_merge</bpmn:incoming><bpmn:incoming>flow_nested_branch_2_nested_merge</bpmn:incoming><bpmn:incoming>flow_nested_branch_3_nested_merge</bpmn:incoming><bpmn:outgoing>flow_nested_merge_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="end" name="end">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_branch_1_end</bpmn:incoming><bpmn:incoming>flow_branch_2_end</bpmn:incoming><bpmn:incoming>flow_branch_4_end</bpmn:incoming><bpmn:incoming>flow_nested_merge_end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_initial" sourceRef="start" targetRef="initial">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_initial_split" sourceRef="initial" targetRef="split_gateway">${extensionJson({})}</bpmn:sequenceFlow>
    ${[1, 2, 3, 4]
        .map(
            (i) =>
                `<bpmn:sequenceFlow id="flow_split_branch_${i}" sourceRef="split_gateway" targetRef="branch_${i}">${extensionJson({
                    condition: branchConditions[i],
                    conditionMode: 'text',
                    priority: i
                })}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
    <bpmn:sequenceFlow id="flow_branch_1_end" sourceRef="branch_1" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_2_end" sourceRef="branch_2" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_3_nested_split" sourceRef="branch_3" targetRef="nested_split_gateway">${extensionJson(
        {}
    )}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_4_end" sourceRef="branch_4" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmn:sequenceFlow id="flow_nested_split_nested_branch_${i}" sourceRef="nested_split_gateway" targetRef="nested_branch_${i}">${extensionJson(
                    { condition: branchConditions[i], conditionMode: 'text', priority: i }
                )}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmn:sequenceFlow id="flow_nested_branch_${i}_nested_merge" sourceRef="nested_branch_${i}" targetRef="nested_merge_task">${extensionJson(
                    {}
                )}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
    <bpmn:sequenceFlow id="flow_nested_merge_end" sourceRef="nested_merge_task" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_${processId}">
    <bpmndi:BPMNShape id="Participant_tester_di" bpmnElement="Participant_tester" isHorizontal="true"><dc:Bounds x="40" y="40" width="1420" height="680" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="110" y="332" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="initial_di" bpmnElement="initial"><dc:Bounds x="190" y="310" width="110" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="split_gateway_di" bpmnElement="split_gateway" isMarkerVisible="true"><dc:Bounds x="340" y="325" width="50" height="50" /></bpmndi:BPMNShape>
    ${[1, 2, 3, 4]
        .map(
            (i) =>
                `<bpmndi:BPMNShape id="branch_${i}_di" bpmnElement="branch_${i}"><dc:Bounds x="470" y="${
                    110 + i * 90
                }" width="110" height="64" /></bpmndi:BPMNShape>`
        )
        .join('\n    ')}
    <bpmndi:BPMNShape id="nested_split_gateway_di" bpmnElement="nested_split_gateway" isMarkerVisible="true"><dc:Bounds x="670" y="415" width="50" height="50" /></bpmndi:BPMNShape>
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmndi:BPMNShape id="nested_branch_${i}_di" bpmnElement="nested_branch_${i}"><dc:Bounds x="790" y="${
                    185 + i * 90
                }" width="130" height="64" /></bpmndi:BPMNShape>`
        )
        .join('\n    ')}
    <bpmndi:BPMNShape id="nested_merge_task_di" bpmnElement="nested_merge_task"><dc:Bounds x="1040" y="400" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="1260" y="422" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="flow_start_initial_di" bpmnElement="flow_start_initial"><di:waypoint x="146" y="350" /><di:waypoint x="190" y="350" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_initial_split_di" bpmnElement="flow_initial_split"><di:waypoint x="300" y="350" /><di:waypoint x="340" y="350" /></bpmndi:BPMNEdge>
    ${[1, 2, 3, 4]
        .map((i) => {
            const y = 110 + i * 90 + 32;
            return `<bpmndi:BPMNEdge id="flow_split_branch_${i}_di" bpmnElement="flow_split_branch_${i}"><di:waypoint x="390" y="350" /><di:waypoint x="430" y="350" /><di:waypoint x="430" y="${y}" /><di:waypoint x="470" y="${y}" /></bpmndi:BPMNEdge>`;
        })
        .join('\n    ')}
    <bpmndi:BPMNEdge id="flow_branch_1_end_di" bpmnElement="flow_branch_1_end"><di:waypoint x="580" y="232" /><di:waypoint x="620" y="232" /><di:waypoint x="620" y="140" /><di:waypoint x="1220" y="140" /><di:waypoint x="1220" y="440" /><di:waypoint x="1260" y="440" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_2_end_di" bpmnElement="flow_branch_2_end"><di:waypoint x="580" y="322" /><di:waypoint x="635" y="322" /><di:waypoint x="635" y="160" /><di:waypoint x="1200" y="160" /><di:waypoint x="1200" y="440" /><di:waypoint x="1260" y="440" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_3_nested_split_di" bpmnElement="flow_branch_3_nested_split"><di:waypoint x="580" y="412" /><di:waypoint x="625" y="412" /><di:waypoint x="625" y="440" /><di:waypoint x="670" y="440" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_4_end_di" bpmnElement="flow_branch_4_end"><di:waypoint x="580" y="502" /><di:waypoint x="620" y="502" /><di:waypoint x="620" y="600" /><di:waypoint x="1220" y="600" /><di:waypoint x="1220" y="440" /><di:waypoint x="1260" y="440" /></bpmndi:BPMNEdge>
    ${[1, 2, 3]
        .map((i) => {
            const y = 185 + i * 90 + 32;
            return `<bpmndi:BPMNEdge id="flow_nested_split_nested_branch_${i}_di" bpmnElement="flow_nested_split_nested_branch_${i}"><di:waypoint x="720" y="440" /><di:waypoint x="755" y="440" /><di:waypoint x="755" y="${y}" /><di:waypoint x="790" y="${y}" /></bpmndi:BPMNEdge>`;
        })
        .join('\n    ')}
    ${[1, 2, 3]
        .map((i) => {
            const y = 185 + i * 90 + 32;
            return `<bpmndi:BPMNEdge id="flow_nested_branch_${i}_nested_merge_di" bpmnElement="flow_nested_branch_${i}_nested_merge"><di:waypoint x="920" y="${y}" /><di:waypoint x="980" y="${y}" /><di:waypoint x="980" y="440" /><di:waypoint x="1040" y="440" /></bpmndi:BPMNEdge>`;
        })
        .join('\n    ')}
    <bpmndi:BPMNEdge id="flow_nested_merge_end_di" bpmnElement="flow_nested_merge_end"><di:waypoint x="1170" y="440" /><di:waypoint x="1260" y="440" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function createInclusiveSplitWithoutMergeXml(scenario) {
    const processId = scenario.id.replace(/-/g, '_');
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.9.1">
  <bpmn:collaboration id="Collaboration_${processId}"><bpmn:participant id="Participant_tester" name="tester" processRef="${processId}">${extensionJson(
        { role: { name: 'tester' } }
    )}</bpmn:participant></bpmn:collaboration>
  <bpmn:process id="${processId}" name="${escapeXml(scenario.name)}" isExecutable="true">
    <bpmn:startEvent id="start" name="start"><bpmn:outgoing>flow_start_initial</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="initial" name="initial">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:initial'
    })}<bpmn:incoming>flow_start_initial</bpmn:incoming><bpmn:outgoing>flow_initial_split</bpmn:outgoing></bpmn:userTask>
    <bpmn:inclusiveGateway id="split_gateway" name="inclusive split">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_initial_split</bpmn:incoming><bpmn:outgoing>flow_split_branch_1</bpmn:outgoing><bpmn:outgoing>flow_split_branch_2</bpmn:outgoing><bpmn:outgoing>flow_split_branch_3</bpmn:outgoing></bpmn:inclusiveGateway>
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmn:userTask id="branch_${i}" name="branch_${i}">${extensionJson({
                    role: { name: 'tester' },
                    tool: `formHandler:branch_${i}`
                })}<bpmn:incoming>flow_split_branch_${i}</bpmn:incoming><bpmn:outgoing>flow_branch_${i}_end</bpmn:outgoing></bpmn:userTask><bpmn:endEvent id="branch_${i}_end" name="branch_${i}_end"><bpmn:incoming>flow_branch_${i}_end</bpmn:incoming></bpmn:endEvent>`
        )
        .join('\n    ')}
    <bpmn:sequenceFlow id="flow_start_initial" sourceRef="start" targetRef="initial">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_initial_split" sourceRef="initial" targetRef="split_gateway">${extensionJson({})}</bpmn:sequenceFlow>
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmn:sequenceFlow id="flow_split_branch_${i}" sourceRef="split_gateway" targetRef="branch_${i}">${extensionJson({
                    condition: branchConditions[i],
                    conditionMode: 'text',
                    priority: i
                })}</bpmn:sequenceFlow><bpmn:sequenceFlow id="flow_branch_${i}_end" sourceRef="branch_${i}" targetRef="branch_${i}_end">${extensionJson(
                    {}
                )}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_${processId}">
    <bpmndi:BPMNShape id="Participant_tester_di" bpmnElement="Participant_tester" isHorizontal="true"><dc:Bounds x="40" y="40" width="920" height="500" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="110" y="252" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="initial_di" bpmnElement="initial"><dc:Bounds x="190" y="230" width="110" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="split_gateway_di" bpmnElement="split_gateway" isMarkerVisible="true"><dc:Bounds x="360" y="245" width="50" height="50" /></bpmndi:BPMNShape>
    ${[1, 2, 3]
        .map(
            (i) =>
                `<bpmndi:BPMNShape id="branch_${i}_di" bpmnElement="branch_${i}"><dc:Bounds x="510" y="${
                    100 + i * 90
                }" width="110" height="64" /></bpmndi:BPMNShape><bpmndi:BPMNShape id="branch_${i}_end_di" bpmnElement="branch_${i}_end"><dc:Bounds x="750" y="${
                    114 + i * 90
                }" width="36" height="36" /></bpmndi:BPMNShape>`
        )
        .join('\n    ')}
    <bpmndi:BPMNEdge id="flow_start_initial_di" bpmnElement="flow_start_initial"><di:waypoint x="146" y="270" /><di:waypoint x="190" y="270" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_initial_split_di" bpmnElement="flow_initial_split"><di:waypoint x="300" y="270" /><di:waypoint x="360" y="270" /></bpmndi:BPMNEdge>
    ${[1, 2, 3]
        .map((i) => {
            const taskY = 100 + i * 90 + 32;
            const endY = 114 + i * 90 + 18;
            return `<bpmndi:BPMNEdge id="flow_split_branch_${i}_di" bpmnElement="flow_split_branch_${i}"><di:waypoint x="410" y="270" /><di:waypoint x="460" y="270" /><di:waypoint x="460" y="${taskY}" /><di:waypoint x="510" y="${taskY}" /></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="flow_branch_${i}_end_di" bpmnElement="flow_branch_${i}_end"><di:waypoint x="620" y="${taskY}" /><di:waypoint x="685" y="${taskY}" /><di:waypoint x="685" y="${endY}" /><di:waypoint x="750" y="${endY}" /></bpmndi:BPMNEdge>`;
        })
        .join('\n    ')}
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function createExclusiveDirectMergeWithMidTaskXml(scenario) {
    const processId = scenario.id.replace(/-/g, '_');
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.9.1">
  <bpmn:collaboration id="Collaboration_${processId}"><bpmn:participant id="Participant_tester" name="tester" processRef="${processId}">${extensionJson(
        { role: { name: 'tester' } }
    )}</bpmn:participant></bpmn:collaboration>
  <bpmn:process id="${processId}" name="${escapeXml(scenario.name)}" isExecutable="true">
    <bpmn:extensionElements><uengine:properties><uengine:json>${uengineJson({
        definitionName: scenario.name,
        version: '0.1'
    })}</uengine:json></uengine:properties></bpmn:extensionElements>
    <bpmn:startEvent id="start" name="start">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:outgoing>flow_start_initial</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="initial" name="initial">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:initial'
    })}<bpmn:incoming>flow_start_initial</bpmn:incoming><bpmn:outgoing>flow_initial_split</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="split_gateway" name="exclusive split">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_initial_split</bpmn:incoming><bpmn:outgoing>flow_split_branch_1</bpmn:outgoing><bpmn:outgoing>flow_split_branch_2</bpmn:outgoing><bpmn:outgoing>flow_split_branch_3</bpmn:outgoing><bpmn:outgoing>flow_split_branch_4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="branch_1" name="branch_1">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_1'
    })}<bpmn:incoming>flow_split_branch_1</bpmn:incoming><bpmn:outgoing>flow_branch_1_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_2" name="branch_2">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_2'
    })}<bpmn:incoming>flow_split_branch_2</bpmn:incoming><bpmn:outgoing>flow_branch_2_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_3" name="branch_3">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_3'
    })}<bpmn:incoming>flow_split_branch_3</bpmn:incoming><bpmn:outgoing>flow_branch_3_mid</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_3_mid_task" name="branch_3 mid task">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_3_mid'
    })}<bpmn:incoming>flow_branch_3_mid</bpmn:incoming><bpmn:outgoing>flow_branch_3_mid_alert</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_3_alert_task" name="branch_3 alert task">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_3_alert'
    })}<bpmn:incoming>flow_branch_3_mid_alert</bpmn:incoming><bpmn:outgoing>flow_branch_3_alert_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="branch_4" name="branch_4">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:branch_4'
    })}<bpmn:incoming>flow_split_branch_4</bpmn:incoming><bpmn:outgoing>flow_branch_4_merge</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="merge_task" name="merge task">${extensionJson({
        role: { name: 'tester' },
        tool: 'formHandler:merge'
    })}<bpmn:incoming>flow_branch_1_merge</bpmn:incoming><bpmn:incoming>flow_branch_2_merge</bpmn:incoming><bpmn:incoming>flow_branch_3_alert_merge</bpmn:incoming><bpmn:incoming>flow_branch_4_merge</bpmn:incoming><bpmn:outgoing>flow_merge_end</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="end" name="end">${extensionJson({
        role: { name: 'tester' }
    })}<bpmn:incoming>flow_merge_end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_initial" sourceRef="start" targetRef="initial">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_initial_split" sourceRef="initial" targetRef="split_gateway">${extensionJson({})}</bpmn:sequenceFlow>
    ${[1, 2, 3, 4]
        .map(
            (i) =>
                `<bpmn:sequenceFlow id="flow_split_branch_${i}" sourceRef="split_gateway" targetRef="branch_${i}">${extensionJson({
                    condition: branchConditions[i],
                    conditionMode: 'text',
                    priority: i
                })}</bpmn:sequenceFlow>`
        )
        .join('\n    ')}
    <bpmn:sequenceFlow id="flow_branch_1_merge" sourceRef="branch_1" targetRef="merge_task">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_2_merge" sourceRef="branch_2" targetRef="merge_task">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_3_mid" sourceRef="branch_3" targetRef="branch_3_mid_task">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_3_mid_alert" sourceRef="branch_3_mid_task" targetRef="branch_3_alert_task">${extensionJson(
        {}
    )}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_3_alert_merge" sourceRef="branch_3_alert_task" targetRef="merge_task">${extensionJson(
        {}
    )}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_branch_4_merge" sourceRef="branch_4" targetRef="merge_task">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_merge_end" sourceRef="merge_task" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_${processId}">
    <bpmndi:BPMNShape id="Participant_tester_di" bpmnElement="Participant_tester" isHorizontal="true"><dc:Bounds x="40" y="40" width="1260" height="620" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="110" y="302" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="initial_di" bpmnElement="initial"><dc:Bounds x="190" y="280" width="110" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="split_gateway_di" bpmnElement="split_gateway" isMarkerVisible="true"><dc:Bounds x="340" y="295" width="50" height="50" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_1_di" bpmnElement="branch_1"><dc:Bounds x="470" y="120" width="110" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_2_di" bpmnElement="branch_2"><dc:Bounds x="470" y="220" width="110" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_3_di" bpmnElement="branch_3"><dc:Bounds x="470" y="320" width="110" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_3_mid_task_di" bpmnElement="branch_3_mid_task"><dc:Bounds x="650" y="320" width="130" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_3_alert_task_di" bpmnElement="branch_3_alert_task"><dc:Bounds x="850" y="320" width="130" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="branch_4_di" bpmnElement="branch_4"><dc:Bounds x="470" y="460" width="110" height="64" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="merge_task_di" bpmnElement="merge_task"><dc:Bounds x="1080" y="280" width="120" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="1240" y="302" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="flow_start_initial_di" bpmnElement="flow_start_initial"><di:waypoint x="146" y="320" /><di:waypoint x="190" y="320" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_initial_split_di" bpmnElement="flow_initial_split"><di:waypoint x="300" y="320" /><di:waypoint x="340" y="320" /></bpmndi:BPMNEdge>
    ${[
        [1, 152],
        [2, 252],
        [3, 352],
        [4, 492]
    ]
        .map(
            ([i, y]) =>
                `<bpmndi:BPMNEdge id="flow_split_branch_${i}_di" bpmnElement="flow_split_branch_${i}"><di:waypoint x="390" y="320" /><di:waypoint x="430" y="320" /><di:waypoint x="430" y="${y}" /><di:waypoint x="470" y="${y}" /></bpmndi:BPMNEdge>`
        )
        .join('\n    ')}
    <bpmndi:BPMNEdge id="flow_branch_1_merge_di" bpmnElement="flow_branch_1_merge"><di:waypoint x="580" y="152" /><di:waypoint x="1040" y="152" /><di:waypoint x="1040" y="320" /><di:waypoint x="1080" y="320" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_2_merge_di" bpmnElement="flow_branch_2_merge"><di:waypoint x="580" y="252" /><di:waypoint x="1040" y="252" /><di:waypoint x="1040" y="320" /><di:waypoint x="1080" y="320" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_3_mid_di" bpmnElement="flow_branch_3_mid"><di:waypoint x="580" y="352" /><di:waypoint x="650" y="352" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_3_mid_alert_di" bpmnElement="flow_branch_3_mid_alert"><di:waypoint x="780" y="352" /><di:waypoint x="850" y="352" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_3_alert_merge_di" bpmnElement="flow_branch_3_alert_merge"><di:waypoint x="980" y="352" /><di:waypoint x="1080" y="320" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_branch_4_merge_di" bpmnElement="flow_branch_4_merge"><di:waypoint x="580" y="492" /><di:waypoint x="1040" y="492" /><di:waypoint x="1040" y="320" /><di:waypoint x="1080" y="320" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="flow_merge_end_di" bpmnElement="flow_merge_end"><di:waypoint x="1200" y="320" /><di:waypoint x="1240" y="320" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function one(value) {
    return Array.isArray(value) ? value[0] : value;
}

function readUengineJson(element) {
    const raw = one(one(one(element?.['bpmn:extensionElements'])?.['uengine:properties'])?.['uengine:json']);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (_error) {
        return {};
    }
}

async function createExecutionDefinitionFromBpmnXml(xml) {
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
    const process = one(parsed['bpmn:definitions']['bpmn:process']);
    const nodesByType = [
        ['events', 'bpmn:startEvent', 'startEvent'],
        ['events', 'bpmn:endEvent', 'endEvent'],
        ['activities', 'bpmn:userTask', 'userTask'],
        ['activities', 'bpmn:callActivity', 'CallActivity'],
        ['gateways', 'bpmn:exclusiveGateway', 'exclusiveGateway'],
        ['gateways', 'bpmn:inclusiveGateway', 'inclusiveGateway'],
        ['gateways', 'bpmn:parallelGateway', 'parallelGateway']
    ];

    const definition = {
        data: [],
        roles: [{ name: 'tester', endpoint: 'tester@example.com' }],
        events: [],
        gateways: [],
        sequences: [],
        activities: [],
        subProcesses: [],
        description: '',
        processDefinitionId: process.$.id,
        processDefinitionName: process.$.name
    };

    for (const [collection, tag, type] of nodesByType) {
        const nodes = process[tag] ? [].concat(process[tag]) : [];
        for (const node of nodes) {
            const props = readUengineJson(node);
            const item = {
                id: node.$.id,
                name: node.$.name || node.$.id,
                role: props.role?.name || 'tester',
                type,
                process: process.$.id,
                properties: JSON.stringify(props),
                description: ''
            };
            if (collection === 'activities') {
                definition.activities.push({
                    ...item,
                    duration: 1,
                    instruction: '',
                    inputData: [],
                    checkpoints: [],
                    tool: props.tool || `formHandler:${node.$.id}`
                });
            } else {
                definition[collection].push(item);
            }
        }
    }

    for (const flow of [].concat(process['bpmn:sequenceFlow'] || [])) {
        const props = readUengineJson(flow);
        definition.sequences.push({
            id: flow.$.id,
            source: flow.$.sourceRef,
            target: flow.$.targetRef,
            condition: '',
            properties: JSON.stringify(props)
        });
    }

    return definition;
}

module.exports = {
    branchConditions,
    executionGatewayTypes,
    scenarios,
    customScenarios,
    coverageCases,
    createGatewayRegressionBpmnXml,
    createCustomGatewayBpmnXml,
    createExecutionDefinitionFromBpmnXml
};

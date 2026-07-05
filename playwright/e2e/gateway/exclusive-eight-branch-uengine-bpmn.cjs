const { parseStringPromise } = require('xml2js');

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
    return `<bpmn:extensionElements><uengine:properties><uengine:json>${uengineJson(value)}</uengine:json></uengine:properties></bpmn:extensionElements>`;
}

function createExclusiveEightBranchBpmnXml() {
    const branchIds = Array.from({ length: 8 }, (_, index) => `branch_${index + 1}`);
    const nodeRefs = [
        'start',
        'initial',
        'split_xor',
        ...branchIds,
        'merge_task',
        'end'
    ];

    const branchTasks = branchIds.map((id, index) => {
        const flowIn = `flow_split_${id}`;
        const flowOut = `flow_${id}_merge`;
        return `
    <bpmn:userTask id="${id}" name="${id}">
      ${extensionJson({ role: { name: 'tester' }, tool: `formHandler:${id}` })}
      <bpmn:incoming>${flowIn}</bpmn:incoming>
      <bpmn:outgoing>${flowOut}</bpmn:outgoing>
    </bpmn:userTask>`;
    }).join('');

    const splitFlows = branchIds.map((id, index) => `
    <bpmn:sequenceFlow id="flow_split_${id}" sourceRef="split_xor" targetRef="${id}">
      ${extensionJson({ condition: branchConditions[index + 1], conditionMode: 'text', priority: index + 1 })}
    </bpmn:sequenceFlow>`).join('');

    const mergeFlows = branchIds.map((id) => `
    <bpmn:sequenceFlow id="flow_${id}_merge" sourceRef="${id}" targetRef="merge_task">
      ${extensionJson({})}
    </bpmn:sequenceFlow>`).join('');

    const splitOutgoing = branchIds.map((id) => `<bpmn:outgoing>flow_split_${id}</bpmn:outgoing>`).join('\n      ');
    const mergeIncoming = branchIds.map((id) => `<bpmn:incoming>flow_${id}_merge</bpmn:incoming>`).join('\n      ');

    const branchShapes = branchIds.map((id, index) => {
        const y = 90 + index * 80;
        return `
      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
        <dc:Bounds x="470" y="${y}" width="110" height="64" />
      </bpmndi:BPMNShape>`;
    }).join('');

    const splitEdges = branchIds.map((id, index) => {
        const y = 122 + index * 80;
        return `
      <bpmndi:BPMNEdge id="flow_split_${id}_di" bpmnElement="flow_split_${id}">
        <di:waypoint x="382" y="380" />
        <di:waypoint x="425" y="380" />
        <di:waypoint x="425" y="${y}" />
        <di:waypoint x="470" y="${y}" />
      </bpmndi:BPMNEdge>`;
    }).join('');

    const mergeEdges = branchIds.map((id, index) => {
        const y = 122 + index * 80;
        return `
      <bpmndi:BPMNEdge id="flow_${id}_merge_di" bpmnElement="flow_${id}_merge">
        <di:waypoint x="580" y="${y}" />
        <di:waypoint x="680" y="${y}" />
        <di:waypoint x="680" y="380" />
        <di:waypoint x="780" y="380" />
      </bpmndi:BPMNEdge>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_exclusive_eight_branch_merge_ai" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="17.9.1">
  <bpmn:collaboration id="Collaboration_exclusive_eight_branch_merge_ai">
    <bpmn:participant id="Participant_tester" name="tester" processRef="exclusive_eight_branch_merge_ai">
      ${extensionJson({ role: { name: 'tester' } })}
    </bpmn:participant>
  </bpmn:collaboration>
  <bpmn:process id="exclusive_eight_branch_merge_ai" name="Exclusive eight branch merge AI" isExecutable="true">
    <bpmn:extensionElements>
      <uengine:properties>
        <uengine:json>${uengineJson({ definitionName: 'Exclusive eight branch merge AI', version: '0.1' })}</uengine:json>
      </uengine:properties>
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_tester">
      <bpmn:lane id="Lane_tester" name="tester">
        ${extensionJson({ role: { name: 'tester' } })}
        ${nodeRefs.map((id) => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join('\n        ')}
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="start" name="start">
      ${extensionJson({ role: { name: 'tester' } })}
      <bpmn:outgoing>flow_start_initial</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="initial" name="initial">
      ${extensionJson({ role: { name: 'tester' }, tool: 'formHandler:initial' })}
      <bpmn:incoming>flow_start_initial</bpmn:incoming>
      <bpmn:outgoing>flow_initial_split</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="split_xor" name="AI condition split">
      ${extensionJson({ role: { name: 'tester' } })}
      <bpmn:incoming>flow_initial_split</bpmn:incoming>
      ${splitOutgoing}
    </bpmn:exclusiveGateway>
    ${branchTasks}
    <bpmn:userTask id="merge_task" name="merge task">
      ${extensionJson({ role: { name: 'tester' }, tool: 'formHandler:merge' })}
      ${mergeIncoming}
      <bpmn:outgoing>flow_merge_end</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="end" name="end">
      ${extensionJson({ role: { name: 'tester' } })}
      <bpmn:incoming>flow_merge_end</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_initial" sourceRef="start" targetRef="initial">${extensionJson({})}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_initial_split" sourceRef="initial" targetRef="split_xor">${extensionJson({})}</bpmn:sequenceFlow>
    ${splitFlows}
    ${mergeFlows}
    <bpmn:sequenceFlow id="flow_merge_end" sourceRef="merge_task" targetRef="end">${extensionJson({})}</bpmn:sequenceFlow>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_exclusive_eight_branch_merge_ai">
      <bpmndi:BPMNShape id="Participant_tester_di" bpmnElement="Participant_tester" isHorizontal="true">
        <dc:Bounds x="40" y="40" width="1020" height="720" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_tester_di" bpmnElement="Lane_tester" isHorizontal="true">
        <dc:Bounds x="70" y="40" width="990" height="720" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="130" y="362" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="initial_di" bpmnElement="initial">
        <dc:Bounds x="210" y="340" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="split_xor_di" bpmnElement="split_xor" isMarkerVisible="true">
        <dc:Bounds x="332" y="355" width="50" height="50" />
      </bpmndi:BPMNShape>
      ${branchShapes}
      <bpmndi:BPMNShape id="merge_task_di" bpmnElement="merge_task">
        <dc:Bounds x="780" y="340" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="960" y="362" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_start_initial_di" bpmnElement="flow_start_initial">
        <di:waypoint x="166" y="380" />
        <di:waypoint x="210" y="380" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_initial_split_di" bpmnElement="flow_initial_split">
        <di:waypoint x="320" y="380" />
        <di:waypoint x="332" y="380" />
      </bpmndi:BPMNEdge>
      ${splitEdges}
      ${mergeEdges}
      <bpmndi:BPMNEdge id="flow_merge_end_di" bpmnElement="flow_merge_end">
        <di:waypoint x="900" y="380" />
        <di:waypoint x="960" y="380" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
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
        ['gateways', 'bpmn:exclusiveGateway', 'exclusiveGateway']
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
    createExclusiveEightBranchBpmnXml,
    createExecutionDefinitionFromBpmnXml
};

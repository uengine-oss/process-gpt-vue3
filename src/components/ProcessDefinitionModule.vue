<script>
import xml2js from 'xml2js';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    mixins: [],
    data: () => ({
        processDefinition: null,
        bpmn: null,
        definitionChangeCount: 0,
        projectName: null,
        disableChat: false,
        isViewMode: false,
        lock: false,
        loading: false,
        
    }),
    computed: {
        
    },
    mounted() {
        
    },
    beforeUnmount() {

    },
    async created() {
        
    },
    methods: {
        taskMapping(activity) {
            switch (activity) {
                case 'ScriptActivity':
                    return 'bpmn:scriptTask';
                case 'EmailActivity':
                    return 'bpmn:sendTask';
                default:
                    return 'bpmn:userTask';
            }
        },
        createBpmnXml(jsonModel) {
            // XML 문서 초기화
            let me = this;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"></bpmn:definitions>',
                'application/xml'
            );
            const bpmnDefinitions = xmlDoc.documentElement;

            bpmnDefinitions.setAttribute('id', 'Definitions_' + jsonModel.processDefinitionId);
            bpmnDefinitions.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            bpmnDefinitions.setAttribute('exporter', 'Custom BPMN Modeler');
            bpmnDefinitions.setAttribute('exporterVersion', '1.0');

            const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            collaboration.setAttribute('id', 'Collaboration_1');
            bpmnDefinitions.appendChild(collaboration);

            const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            process.setAttribute('id', jsonModel.processDefinitionId);
            process.setAttribute('isExecutable', 'true');
            bpmnDefinitions.appendChild(process);
            // Collaboration 추가
            const pc = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            pc.setAttribute('id', `Participant`);
            pc.setAttribute('name', `Participant`);
            pc.setAttribute('processRef', jsonModel.processDefinitionId);
            collaboration.appendChild(pc);

            // Data 매핑
            const extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
            const root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
            if (jsonModel.data) {
                jsonModel.data.forEach((data) => {
                    const variable = xmlDoc.createElementNS('http://uengine', 'uengine:variable');
                    variable.setAttribute('name', data.name);
                    variable.setAttribute('type', data.type);
                    root.appendChild(variable);
                });
            }

            extensionElements.appendChild(root);
            process.appendChild(extensionElements);
            // Lane 및 Activity 매핑
            const laneActivityMapping = {};
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity) => {
                    if (!laneActivityMapping[activity?.role]) {
                        laneActivityMapping[activity?.role] = [];
                    }
                    laneActivityMapping[activity.role].push(activity.id);
                });
            if (jsonModel.gateways)
                jsonModel.gateways.forEach((gateway) => {
                    if (!laneActivityMapping[gateway?.role]) {
                        laneActivityMapping[gateway?.role] = [];
                    }
                    laneActivityMapping[gateway.role].push(gateway.id);
                });

            // Lanes 생성
            if (jsonModel.roles) {
                const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
                laneSet.setAttribute('id', 'LaneSet_1');
                process.appendChild(laneSet);
                jsonModel.roles.forEach((role, idx) => {
                    const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
                    lane.setAttribute('id', 'Lane_' + idx);
                    lane.setAttribute('name', role.name);
                    laneSet.appendChild(lane);
                    // Activity를 Lane에 할당
                    if (laneActivityMapping[role.name]) {
                        laneActivityMapping[role.name].forEach((activityId) => {
                            const flowNodeRef = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:flowNodeRef');
                            flowNodeRef.textContent = activityId;
                            lane.appendChild(flowNodeRef);
                        });
                    }
                });
            }

            let inComing = {};
            let outGoing = {};

            let lastXPos = 140;
            let positionMapping = {};
            let rolePos = {};
            // Sequences(bpm 모델으 바깥쪽 box 크기) 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach((sequence, idx) => {
                    if (!positionMapping[sequence.source]) {
                        positionMapping[sequence.source] = lastXPos;
                        lastXPos += 120; 
                    }
                    if(idx === jsonModel.sequences.length - 1){
                        positionMapping[sequence.target] = lastXPos += 130
                    }   
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('name', sequence.name ? sequence.name : '');
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                    params.setAttribute('key', 'condition');
                    params.textContent = JSON.stringify({
                        condition: sequence.condition ? sequence.condition : ''
                    });
                    // }
                    root.appendChild(params);
                    extensionElements.appendChild(root);
                    sequenceFlow.appendChild(extensionElements);
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                });

            // Activities 생성
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity, idx) => {
                    const userTaskType = me.taskMapping(activity.type);

                    const userTask = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', userTaskType);
                    userTask.setAttribute('id', activity.id);
                    userTask.setAttribute('name', activity.name);
                    // let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:description');
                    if (outGoing[activity.id]) {
                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                        outGoingSeq.textContent = outGoing[activity.id];
                        userTask.appendChild(outGoingSeq);
                    }
                    if (inComing[activity.id]) {
                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                        inComingSeq.textContent = inComing[activity.id];
                        userTask.appendChild(inComingSeq);
                    }
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                    params.setAttribute('key', 'condition');
                    // {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction":
                    //     "OUT"}
                    let inputDataList = [];
                    let outputDataList = [];
                    activity?.inputData?.forEach((data) => {
                        inputDataList.push({
                            argument: { text: data },
                            variable: { name: data },
                            direction: 'OUT'
                        });
                    });
                    activity?.outputData?.forEach((data) => {
                        outputDataList.push({
                            argument: { text: data },
                            variable: { name: data },
                            direction: 'IN'
                        });
                    });

                    let activityData = {
                        role: { name: activity.role },
                        parameters: [...inputDataList, ...outputDataList]
                    };
                    params.textContent = JSON.stringify(activityData);
                    root.appendChild(params);
                    extensionElements.appendChild(root);
                    userTask.appendChild(extensionElements);

                    if (jsonModel.events) {
                        jsonModel.events.forEach((event, index) => {
                            const bpmnEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + event.type);
                            bpmnEvent.setAttribute('id', event.id);
                            bpmnEvent.setAttribute('name', event.name);
                            process.appendChild(bpmnEvent);
                        });
                    }
                    process.appendChild(userTask);
                });
                if (jsonModel.gateways) {
                    jsonModel.gateways.forEach((gateway) => {
                        const bpmnGateway = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + gateway.type);
                        bpmnGateway.setAttribute('id', gateway.id);
                        bpmnGateway.setAttribute('name', gateway.name);
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                        let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                        params.setAttribute('key', 'condition');
                        params.textContent = JSON.stringify({
                            condition: gateway.condition ? gateway.condition : ''
                        });
                        root.appendChild(params);
                        extensionElements.appendChild(root);
                        bpmnGateway.appendChild(extensionElements);

                        if (outGoing[gateway.id]) {
                            let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                            outGoingSeq.textContent = outGoing[gateway.id];
                            bpmnGateway.appendChild(outGoingSeq);
                        }
                        if (inComing[gateway.id]) {
                            let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                            inComingSeq.textContent = inComing[gateway.id];
                            bpmnGateway.appendChild(inComingSeq);
                        }

                        process.appendChild(bpmnGateway);
                    });
                }

            // BPMN Diagram Draw
            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_1');
            bpmnDefinitions.appendChild(bpmnDiagram);

            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_1');
            bpmnPlane.setAttribute('bpmnElement', 'Collaboration_1');
            bpmnDiagram.appendChild(bpmnPlane);
            let participantHeight = jsonModel?.roles.length > 0 ? jsonModel?.roles.length * 100 : 100;
            const participantShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            participantShape.setAttribute('id', 'Participant_1');
            participantShape.setAttribute('bpmnElement', 'Participant');
            const dcBoundsParticipant = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            dcBoundsParticipant.setAttribute('x', '70');
            dcBoundsParticipant.setAttribute('y', `100`);
            // 스윔라인을 감싸고있는 가장 바깥 라인의 길이
            dcBoundsParticipant.setAttribute('width', `${lastXPos + 30}`);
            dcBoundsParticipant.setAttribute('height', participantHeight);
            participantShape.appendChild(dcBoundsParticipant);
            bpmnPlane.appendChild(participantShape);
            // if (jsonModel.roles) {

            // }

            //         <bpmndi:BPMNShape id="Participant_0r9od0v_di" bpmnElement="Participant_0r9od0v" isHorizontal="true">
            //     <dc:Bounds x="156" y="62" width="600" height="250" />
            //   </bpmndi:BPMNShape>
            let activityPos = {};

            // Lane 및 Activity에 대한 시각적 표현 추가
            if (jsonModel.roles) {
                jsonModel.roles.forEach((role, roleIndex) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', `BPMNShape_${roleIndex}`);
                    laneShape.setAttribute('bpmnElement', `Lane_${roleIndex}`);
                    laneShape.setAttribute('isHorizontal', true);
                    const dcBoundsLane = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLane.setAttribute('x', '100');
                    dcBoundsLane.setAttribute('y', `${100 + roleIndex * 100}`);
                    // 가장 바깥 라인 안쪽의 스윔라인 자체 길이
                    dcBoundsLane.setAttribute('width', `${lastXPos}`);
                    dcBoundsLane.setAttribute('height', '100');
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    };
                });
            }

            if (jsonModel.activities || jsonModel.gateways) {
                const elements = [...(jsonModel.activities || []), ...(jsonModel.gateways || [])];
                let lastXPos = 140; // 초기 X 좌표 설정
                let lastGatewayX = 0; // 마지막 게이트웨이의 X 좌표를 저장할 변수

                // 요소들을 순서대로 처리하기 위해 sequences를 기반으로 정렬
                const sortedElements = [];
                jsonModel.sequences.forEach((sequence) => {
                    const sourceElement = elements.find(el => el.id === sequence.source);
                    const targetElement = elements.find(el => el.id === sequence.target);
                    if (sourceElement && !sortedElements.includes(sourceElement)) {
                        sortedElements.push(sourceElement);
                    }
                    if (targetElement && !sortedElements.includes(targetElement)) {
                        sortedElements.push(targetElement);
                    }
                });

                sortedElements.forEach((element, elementIndex) => {
                    if (!element.role) {
                        return false;
                    }

                    // 기본 X 좌표 설정
                    let elementX = positionMapping[element.id] ? positionMapping[element.id] - 20 : lastXPos + 120;
                    let elementY = parseInt(rolePos[element.role].y);

                    // 레인을 넘어가는 요소에 대해서 위치를 더 오른쪽으로 이동
                    if (elementIndex > 0 && sortedElements[elementIndex - 1].role !== element.role) {
                        elementX = lastXPos + 40; // 원하는 만큼 오른쪽으로 이동
                    }

                    // 게이트웨이의 X 좌표 조정
                    if (element.type === 'ExclusiveGateway') {
                        elementX += 70;
                        elementY += 15;
                        lastGatewayX = elementX; // 마지막 게이트웨이의 X 좌표 저장
                    }

                    // 게이트웨이 이후의 task의 X 좌표 조정
                    if (elementIndex > 0 && sortedElements[elementIndex - 1].type === 'ExclusiveGateway') {
                        elementX = lastGatewayX + 100; // 게이트웨이 이후의 task의 X 좌표 조정
                    }

                    const elementShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    elementShape.setAttribute('id', `BPMNShape_${element.id}`);
                    elementShape.setAttribute('bpmnElement', element.id);

                    const dcBoundsElement = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsElement.setAttribute('x', elementX);
                    dcBoundsElement.setAttribute('y', elementY + 10);

                    // 활동과 게이트웨이의 width와 height 설정
                    if (element.type === 'ExclusiveGateway') {
                        dcBoundsElement.setAttribute('width', 50);
                        dcBoundsElement.setAttribute('height', 50);
                    } else {
                        dcBoundsElement.setAttribute('width', 100);
                        dcBoundsElement.setAttribute('height', 80);
                    }

                    elementShape.appendChild(dcBoundsElement);
                    bpmnPlane.appendChild(elementShape);

                    activityPos[element.id] = {
                        x: elementX,
                        y: elementY + 10,
                        width: parseInt(dcBoundsElement.getAttribute('width')),
                        height: parseInt(dcBoundsElement.getAttribute('height'))
                    };

                    // 요소의 X 좌표를 업데이트
                    rolePos[element.role].x = elementX;
                    lastXPos = elementX + 120;
                });
            }
            // start, end event(동그라미 스티커)
            if (jsonModel.events) {
                jsonModel.events.forEach((event) => {
                    let eventX;
                    let eventY;
                    if (event.type == 'StartEvent') {
                        // 시작 이벤트(동그라미 스티커에 대해서 동그라미 스티커가 생성되는 위치 )
                        eventX = 160;
                        eventY = parseInt(rolePos[jsonModel.activities[0].role].y) + 33;
                    } else if (event.type == 'EndEvent') {
                        eventX = positionMapping[event.id] ? positionMapping[event.id] : lastXPos + 120;
                        eventY = parseInt(rolePos[jsonModel.activities[jsonModel.activities.length - 1].role].y) + 33;
                    } else {
                        eventX = 200;
                        eventY = 200;
                    }
                    const eventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    eventShape.setAttribute('id', `Shape_${event.id}`);
                    eventShape.setAttribute('bpmnElement', event.id);
                    const dcBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBounds.setAttribute('x', eventX);
                    dcBounds.setAttribute('y', eventY);
                    dcBounds.setAttribute('width', '34');
                    dcBounds.setAttribute('height', '34');
                    eventShape.appendChild(dcBounds);

                    // 라벨 추가
                    const eventLabel = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNLabel');
                    const dcBoundsLabel = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLabel.setAttribute('x', eventX - 15); // 라벨의 x 좌표
                    dcBoundsLabel.setAttribute('y', eventY + 40); // 라벨의 y 좌표, 원하는 값으로 수정
                    dcBoundsLabel.setAttribute('width', '64');
                    dcBoundsLabel.setAttribute('height', '14');
                    eventLabel.appendChild(dcBoundsLabel);
                    eventShape.appendChild(eventLabel);

                    bpmnPlane.appendChild(eventShape);

                    activityPos[event.id] = {
                        x: eventX,
                        y: eventY,
                        width: 34,
                        height: 34
                    };
                });
            }

            // 서로간의 선위치를 설정하는 부분
            if (jsonModel.sequences) {
                jsonModel.sequences.forEach((sequence) => {
                    if (!activityPos[sequence.source] || !activityPos[sequence.target]) {
                        return false;
                    }

                    const bpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    bpmnEdge.setAttribute('id', `BPMNEdge_${sequence.source}_${sequence.target}`);
                    bpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    let startX, startY, endX, endY;
                    startX = parseInt(activityPos[sequence.source].x) + parseInt(activityPos[sequence.source].width);
                    startY = parseInt(activityPos[sequence.source].y) + parseInt(activityPos[sequence.source].height) / 2;

                    endX = parseInt(activityPos[sequence.target].x);
                    endY = parseInt(activityPos[sequence.target].y) + parseInt(activityPos[sequence.target].height) / 2;

                    // 게이트웨이에서 리턴되는 선의 끝점 좌표 조정
                    if (sequence.source.includes('gateway') && sequence.target.includes('leave')) {
                        endX = parseInt(activityPos[sequence.target].x) + parseInt(activityPos[sequence.target].width) / 2;
                        endY = parseInt(activityPos[sequence.target].y) - 20; // task의 상단 중앙을 가리키도록 조정
                    }

                    // 첫 번째 waypoint (시작점)
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint1.setAttribute('x', startX);
                    waypoint1.setAttribute('y', startY);
                    bpmnEdge.appendChild(waypoint1);

                    // 시작점과 끝점이 같은 레인에 있는 경우
                    if (startY === endY) {
                        // 두 번째 waypoint (끝점)
                        const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint2.setAttribute('x', endX);
                        waypoint2.setAttribute('y', endY);
                        bpmnEdge.appendChild(waypoint2);
                    } else {
                        // 시작점과 끝점이 다른 레인에 있는 경우
                        // 첫 번째 변곡점 (레인 변경 시작)
                        const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle1.setAttribute('x', startX + 25); // X 좌표를 조정하여 레인 변경 시작
                        waypointMiddle1.setAttribute('y', startY);
                        bpmnEdge.appendChild(waypointMiddle1);

                        // 두 번째 변곡점 (레인 변경 완료)
                        const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle2.setAttribute('x', startX + 25); // X 좌표를 유지
                        waypointMiddle2.setAttribute('y', endY); // Y 좌표를 끝점의 Y로 변경하여 레인 변경 완료
                        bpmnEdge.appendChild(waypointMiddle2);

                        // 세 번째 변곡점 (끝점으로 이동)
                        const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle3.setAttribute('x', endX); // X 좌표를 끝점의 X로 변경
                        waypointMiddle3.setAttribute('y', endY); // Y 좌표를 유지
                        bpmnEdge.appendChild(waypointMiddle3);

                        // 두 번째 waypoint (끝점)
                        const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint2.setAttribute('x', endX);
                        waypoint2.setAttribute('y', endY);
                        bpmnEdge.appendChild(waypoint2);
                    }

                    // 게이트웨이에서 리턴되는 선의 경우 마지막 변곡점 추가
                    if (sequence.source.includes('gateway') && sequence.target.includes('leave')) {
                        const extraWaypoint = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        extraWaypoint.setAttribute('x', endX);
                        extraWaypoint.setAttribute('y', endY + 20); // 원하는 위치로 조정
                        bpmnEdge.appendChild(extraWaypoint);
                    }

                    bpmnPlane.appendChild(bpmnEdge);
                });
            }
            
            const serializer = new XMLSerializer();
            const bpmnXml = serializer.serializeToString(xmlDoc);
            return bpmnXml;
        },
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {

                    const store = useBpmnStore();
                    const modeler = store.getModeler;
                    const xmlObj = await modeler.saveXML({ format: true, preamble: true });

                    if (xmlObj && xmlObj.xml && window.$mode != 'uEngine') {
                        me.processDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        if (info.name && info.name != '') {
                            me.processDefinition.processDefinitionName = info.name;
                        }
                        info.definition = me.processDefinition;
                    }

                    await me.saveModel(info, xmlObj.xml);
                    me.bpmn = xmlObj.xml;

                    me.disableChat = true;
                    me.isViewMode = true;
                    me.lock = true;
                    me.definitionChangeCount++;

                    me.loading = false;
                    await me.toggleVersionDialog(false);
                },
                onFail: (e) => {
                    console.log(e)
                }
            });
        },
        async convertXMLToJSON(xmlString) {
            try {
                xmlString = xmlString.replace(/\$type/g, '_type');//sanitizing for $type

                const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                const result = await parser.parseStringPromise(xmlString);
                const process = result['bpmn:definitions'] && result['bpmn:definitions']['bpmn:process'] ? result['bpmn:definitions']['bpmn:process'] : {};
                const startEvent = process['bpmn:startEvent'] || {};
                const endEvent = process['bpmn:endEvent'] || {};
                function ensureArray(item) {
                    return Array.isArray(item) ? item : (item ? [item] : []);
                }
                const lanes = ensureArray(process['bpmn:laneSet'] ? process['bpmn:laneSet']['bpmn:lane'] : []);
                const activities = ensureArray(process['bpmn:userTask'] || []);
                const scriptTasks = ensureArray(process['bpmn:scriptTask'] || []);
                const sequenceFlows = ensureArray(process['bpmn:sequenceFlow'] || []);
                const gateways = ensureArray(process['bpmn:exclusiveGateway'] || []);

                const data = process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'] ? (Array.isArray(process['bpmn:extensionElements']['uengine:properties']['uengine:variable']) ? process['bpmn:extensionElements']['uengine:properties']['uengine:variable'] : [process['bpmn:extensionElements']['uengine:properties']['uengine:variable']]).map(varData => ({
                        name: varData.name,
                        description: varData.name + ' description',
                        type: varData.type
                    })) : [];


                const jsonData = {
                    processDefinitionName: process.id || 'Unknown',
                    processDefinitionId: process.id || 'Unknown',
                    description: "process.description",
                    data: data,
                    roles: lanes.map(lane => ({
                        name: lane.name,
                        resolutionRule: lane.name === 'applicant' ? 'initiator' : 'system'
                    })),
                    events: [
                        {
                            name: startEvent.id || 'StartEvent',
                            id: startEvent.id || 'StartEvent',
                            type: 'StartEvent',
                            description: 'start event',
                            role: lanes[0] ? lanes[0].name : 'Unknown'
                        },
                        {
                            name: endEvent.id || 'EndEvent',
                            id: endEvent.id || 'EndEvent',
                            type: 'EndEvent',
                            description: 'end event',
                            role: lanes.length > 0 ? lanes[lanes.length - 1].name : 'Unknown'
                        }
                    ],
                    activities: [
                        ...activities.map(activity => {
                            try{
                                let task = {}
                                task.name = activity.name
                                task.id = activity.id
                                task.type = 'UserActivity'
                                task.description = `${activity.name} description`
                                task.instruction = `${activity.name} instruction`
                                task.role = lanes.find(lane => {
                                        const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                        return flowNodeRefs.includes(activity.id);
                                    }) ? 
                                    lanes.find(lane => {
                                        const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                        return flowNodeRefs.includes(activity.id);
                                    }).name : 'Unknown'

                                let isProperties = activity['bpmn:extensionElements'] && activity['bpmn:extensionElements']['uengine:properties']

                                if(isProperties){
                                    let parseProperties = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json'])
                                    task.inputData = parseProperties && parseProperties.parameters ? parseProperties.parameters.filter(param => param.direction === "IN") : []
                                    task.outputData = parseProperties && parseProperties.parameters ? parseProperties.parameters.filter(param => param.direction === "OUT") : []
                                } else {
                                    task.inputData = []
                                    task.outputData = []
                                }
                                const form = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json'])
                                if (form && form.variableForHtmlFormContext && form.variableForHtmlFormContext.name) {
                                    task.tool = "formHandler:" + form.variableForHtmlFormContext.name
                                } else {
                                    task.tool = "";
                                }
                                return task
                            }catch(e){
                                console.log(e)
                            }
                        }
                        
                        ),
                        ...scriptTasks.map(task => ({
                            name: task.name,
                            id: task.id,
                            type: 'ScriptActivity',
                            description: task.name + ' description',
                            instruction: task.name + ' instruction',
                            role: lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(task.id);
                            }) ? lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(task.id);
                            }).name : 'Unknown',
                            pythonCode: task['bpmn:extensionElements'] && task['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(task['bpmn:extensionElements']['uengine:properties']['uengine:json']).script : ''
                        }))
                    ],
                    gateways: [
                        ...gateways.map(gateway => ({
                            id: gateway.id || 'Gateway',
                            name: gateway.name || 'Gateway',
                            type: "ExclusiveGateway",
                            description: gateway.name + ' description',
                            role: lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(gateway.id);
                            }) ? lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(gateway.id);
                            }).name : 'Unknown',
                            condition: gateway['bpmn:extensionElements'] && gateway['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(gateway["bpmn:extensionElements"]["uengine:properties"]["uengine:json"]).condition || '' : ''
                        }))
                    ],
                    sequences: sequenceFlows.map(flow => ({
                        source: flow.sourceRef,
                        target: flow.targetRef,
                        condition: flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(flow["bpmn:extensionElements"]["uengine:properties"]["uengine:json"]).condition || '' : ''
                    }))
                };
                return jsonData;
            } catch (error) {
                console.error('Error parsing XML:', error);
                throw error;
            }
        },
        async saveModel(info, xml) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if(window.$mode == 'uEngine') {
                        // uEngine
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                    } else {
                        // GPT
                        if(!me.processDefinition) me.processDefinition = {}
                        if(!me.processDefinition.processDefinitionId) me.processDefinition.processDefinitionId = null
                        if(!me.processDefinition.processDefinitionName) me.processDefinition.processDefinitionName = null


                        me.processDefinition.processDefinitionId = info.proc_def_id ? info.proc_def_id : prompt('please give a ID for the process definition');

                        if (!me.processDefinition.processDefinitionName && info.name) {
                            me.processDefinition.processDefinitionName = info.name
                        } else if (!me.processDefinition.processDefinitionName && !info.name) {
                            me.processDefinition.processDefinitionName = prompt('please give a name for the process definition');
                        }

                        me.projectName = me.processDefinition.processDefinitionName;
                        if (!me.processDefinition.processDefinitionId || !me.processDefinition.processDefinitionName) {
                            throw new Error('processDefinitionId or processDefinitionName is missing');
                        }
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                        // await this.saveToVectorStore(me.processDefinition);
                    }
                    // 신규 프로세스 이동.
                    if (me.$route.fullPath == '/definitions/chat') {
                        me.$router.push(`/definitions/${info.proc_def_id}`);
                    }
                    me.EventBus.emit('definitions-updated');

                    // 새 탭으로 열린 프로세스 편집창
                    if (me.$route.query && me.$route.query.redirect) {
                        let bpmn;
                        if (me.$route.query.id) {
                            bpmn = await backend.getRawDefinition(me.$route.query.id, { type: 'bpmn' });
                        } else {
                            bpmn = await backend.getRawDefinition(info.proc_def_id, { type: 'bpmn' });
                        }
                        if (bpmn) {
                            window.close();
                        }
                    }
                },
                catch: (e) => {
                    console.log(e)
                }
            });
        },
    }
};
</script>

<template>
    <div>
        <Chat :messages="messages" :userInfo="userInfo" @sendMessage="beforeSendMessage">
            <template v-slot:alert>
                <v-alert icon="mdi-info" :title="alertInfo.title" :text="alertInfo.text"></v-alert>
            </template>
        </Chat>
    </div>
</template>

<script>
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";

import ChatGenerator from "./ai/ProcessDefinitionGenerator";
import ProcessDefinition from './ProcessDefinition.vue';
// import ChatButton from "./ui/ChatButton.vue";
import Chat from "./ui/Chat.vue";
import ChatModule from "./ChatModule.vue";
import { v4 as uuidv4 } from "uuid";
export default {
    mixins: [ChatModule],
    name: 'ProcessManagerChat',
    components: {
        ProcessDefinition,
        Chat,

    },
    data: () => ({
        processDefinition: null,
        bpmn: null,
        path: "definitions",
        alertInfo: {
            title: "프로세스 정의 관리",
            text: "대화형으로 프로세스를 관리하십시오. 예를 들어, '영업관리 프로세스를 다음과 같이 등록해줘: 1. 영업기회등 고객명, 예상사업규모, 키맨, 요구사항 2. 제안 작성: 제안 내용, 가격 3. 수주 혹은 실주 4. 수주한 경우, 계약진행' 와 같은 명령을 할 수 있습니다.",
        },
    }),
    async created() {
        await this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });
    },
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    this.processDefinition = null;
                    this.bpmn = null;

                    var path = this.$route.href.replace("#/", "");
                    this.loadData(path);

                    this.messages = await this.loadMessages(path);
                }
            }
        }
    },
    methods: {
        async loadData(path) {
            const value = await this.getData(path);
            if (value) {
                if (this.$route.params && this.$route.params.id) {
                    this.processDefinition = partialParse(value.model);
                    if (!this.processDefinition) {
                        this.processDefinition = []
                    } else {
                        this.createUEngine(this.processDefinition)
                        // this.bpmn = this.createBpmnXml(this.processDefinition);
                    }

                } else {
                    this.messages = [];

                    var list = Object.values(value);
                    list.forEach(item => {
                        const msg = JSON.parse(item.messages);
                        this.messages = [...this.messages, ...msg];

                        item.model = JSON.parse(item.model);
                        this.saveDefinition(item.model);
                    });

                    this.generator.previousMessages = [
                        ...this.generator.previousMessages,
                        ...this.messages
                    ];
                }
            }
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },

        afterModelCreated(response) {
            try {

                let messageWriting = this.messages[this.messages.length - 1];
                let jsonProcess = this.extractProcessJson(response);
                console.log(response)
                if (jsonProcess) {
                    this.processDefinition = partialParse(jsonProcess);
                    this.createUEngine(this.processDefinition)
                }

            } catch (error) {
                console.log(error)
            }
        },

        afterGenerationFinished(putObj) {
            let modelText = "";
            let path = this.path;

            if (this.processDefinition) {
                path = `${this.path}/${this.processDefinition.processDefinitionId}`;

                modelText = JSON.stringify(this.processDefinition);
                this.saveDefinition(this.processDefinition);

                putObj.model = modelText;
                this.saveMessages(path, putObj);
            }
        },
        // editSendMessage() {

        // },
        async saveDefinition(definition) {
            // Create an instance of VectorStorage
            const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

            // Add a text document to the store
            await vectorStore.addText(JSON.stringify(definition), {
                category: definition.processDefinitionId
            });
        },
        generateElement(name, x, y, width, height, id, canvas) {
            var me = this
            const component = me.getComponentByName(name);
            if (!component) return null;

            if (!id) id = me.uuid();
            if (!x) x = 500
            if (!y) x = 500
            if (!canvas) canvas = null

            return component.computed.createNew(canvas, id, x, y, width, height);
        },
        getComponentByName: function (name) {
            var componentByName;
            $.each(window.bpmnComponents, function (i, component) {
                if (component.default.name == name) {
                    componentByName = component;
                }
            });
            return componentByName;
        },
        createUEngine(process) {
            const elements = {};
            const relations = {};
            let tracingTag = 1;
            let currentY = 300; // 첫번째 role의 y 좌표
            let maxX = 0; // 가장 큰 x 좌표를 추적하기 위한 변수
            const roleIds = {}; // role 이름과 ID를 매핑하기 위한 객체
            // Add swimlane if there are more than one role
            let swimlaneId = null;
            if (process.roles.length > 1) {
                swimlaneId = uuidv4();
                const swimlaneHeight = process.roles.length * 80; // role의 height 합
                elements[swimlaneId] = {
                    _type: "org.uengine.kernel.Role",
                    name: "Swimlane",
                    displayName: "Swimlane",
                    roleResolutionContext: {
                        endpoint: "example@uengine.org",
                        _type: "org.uengine.kernel.DirectRoleResolutionContext"
                    },
                    selected: false,
                    elementView: {
                        _type: "org.uengine.kernel.view.DefaultActivityView",
                        id: swimlaneId,
                        x: 290, // role의 x보다 10 작음
                        y: currentY,
                        width: 400, // 예시 값
                        height: swimlaneHeight,
                        style: JSON.stringify({
                            stroke: "black",
                            "fill-r": ".5",
                            "fill-cx": ".5",
                            "fill-cy": ".5",
                            fill: "#ffffff",
                            "fill-opacity": 0,
                            "label-position": "center",
                            "label-direction": "vertical",
                            "vertical-align": "top",
                            cursor: "move"
                        }),
                        parent: null
                    },
                    _instanceInfo: [],
                    oldName: "Swimlane"
                };
                maxX = elements[swimlaneId].elementView.x + elements[swimlaneId].elementView.width / 2;
            }

            // Add roles and set their parent to swimlane if it exists
            process.roles.forEach(role => {
                const roleId = uuidv4();
                roleIds[role.name] = roleId;
                const roleHeight = 80; // 예시 값
                elements[roleId] = {
                    _type: "org.uengine.kernel.Role",
                    name: role.name,
                    displayName: role.name,
                    roleResolutionContext: {
                        endpoint: "example@uengine.org",
                        _type: "org.uengine.kernel.DirectRoleResolutionContext"
                    },
                    selected: false,
                    elementView: {
                        _type: "org.uengine.kernel.view.DefaultActivityView",
                        id: roleId,
                        x: 300, // 예시 값
                        y: currentY - 40,
                        width: 380, // swimlane width - 20
                        height: roleHeight,
                        style: JSON.stringify({
                            stroke: "black",
                            "fill-r": ".5",
                            "fill-cx": ".5",
                            "fill-cy": ".5",
                            fill: "#ffffff",
                            "fill-opacity": 0,
                            "label-position": "center",
                            "label-direction": "vertical",
                            "vertical-align": "top",
                            cursor: "move"
                        }),
                        parent: swimlaneId
                    },
                    _instanceInfo: [],
                    oldName: role.name
                };
                currentY += roleHeight; // 다음 role의 y 좌표 업데이트
            });

            // Add start event

            tracingTag++;
            let startEventId = null;
            let endEventId = null;
            // Add activities, connect them with sequence flows, and add end event
            process.activities.forEach((activity, index) => {
                const activityId = uuidv4();
                const activityType = activity.type === "UserActivity" ? "HumanActivity" : activity.type;
                const isRole = activityType === "Role";
                const role = roleIds[activity.role]; // Get the role ID
                // Set the position and size for roles, otherwise use default values for other activities and events
                const x = isRole ? 100 : 576; // 예시 값
                const y = isRole ? currentY : 463; // 예시 값
                const width = isRole ? 380 : 100; // 예시 값
                const height = isRole ? 80 : 70; // 예시 값
                if (index === 0) {
                    elements[startEventId] = {
                        _type: "org.uengine.kernel.bpmn.StartEvent",
                        name: "start-event",
                        role: role,
                        tracingTag: tracingTag.toString(),
                        selected: false,
                        elementView: {
                            _type: "org.uengine.kernel.view.DefaultActivityView",
                            id: startEventId,
                            x: 576, // 예시 값
                            y: 463, // 예시 값
                            width: 30,
                            height: 30,
                            style: JSON.stringify({
                                stroke: "black",
                                "fill-r": ".5",
                                "fill-cx": ".5",
                                "fill-cy": ".5",
                                fill: "white",
                                "fill-opacity": 0,
                                "label-position": "bottom",
                                "label-width": 120,
                                "stroke-width": 1.5,
                                cursor: "move"
                            }),
                        }
                    };
                    tracingTag++;
                }
                elements[activityId] = {
                    _type: "org.uengine.kernel." + activityType,
                    name: activity.name,
                    role: roleIds[activity.role],
                    tracingTag: tracingTag.toString(),
                    selected: false,
                    elementView: {
                        _type: "org.uengine.kernel.view.DefaultActivityView",
                        id: activityId,
                        x: x,
                        y: y,
                        width: width,
                        height: height,
                        style: JSON.stringify({
                            stroke: "black",
                            "fill-r": 1,
                            "fill-cx": 0.1,
                            "fill-cy": 0.1,
                            fill: "#FFFFFF",
                            "fill-opacity": 0,
                            "label-position": "center",
                            "stroke-width": 1.2,
                            r: "10",
                            cursor: "move"
                        }),
                        parent: isRole ? swimlaneId : roleIds[activity.role]
                    }
                };
                tracingTag++;
                if (index === process.activities.length - 1) {
                    endEventId = uuidv4();
                    elements[endEventId] = {
                        _type: "org.uengine.kernel.bpmn.EndEvent",
                        name: "end-event",
                        tracingTag: tracingTag.toString(),
                        selected: false,
                        role: role,
                        elementView: {
                            _type: "org.uengine.kernel.view.DefaultActivityView",
                            id: endEventId,
                            x: x + width + 20, // 예시 값
                            y: y, // 예시 값
                            width: 30,
                            height: 30,
                            style: JSON.stringify({
                                stroke: "black",
                                "fill-r": ".5",
                                "fill-cx": ".5",
                                "fill-cy": ".5",
                                fill: "white",
                                "fill-opacity": 0,
                                "label-position": "bottom",
                                "stroke-width": 3,
                                "label-width": 120,
                                cursor: "move"
                            }),
                            parent: null
                        }
                    };
                    tracingTag++;
                }
                if (isRole) {
                    // Update currentY for the next role
                    currentY += height;
                }

                // Connect previous activity to current activity with sequence flow
                if (!isRole) {
                    const sequenceId = uuidv4();
                    const sourceRef = index === 0 ? startEventId : process.activities[index - 1].id;
                    relations[sequenceId] = {
                        name: "",
                        _type: "org.uengine.kernel.bpmn.SequenceFlow",
                        selected: false,
                        sourceRef: sourceRef,
                        targetRef: activityId,
                        elementView: {
                            _type: "org.uengine.kernel.view.DefaultSequenceFlowView",
                            id: sequenceId,
                            points: JSON.stringify([[x, y + height / 2], [x + width, y + height / 2]]) // 예시 값
                        },
                        condition: {
                            _type: "org.uengine.kernel.Evaluate",
                            pv: {
                                _type: "org.uengine.kernel.ProcessVariable",
                                name: ""
                            },
                            condition: "==",
                            val: ""
                        }
                    };
                }

                // If it's the last activity and not a role, add an end event and connect it to the last activity
                if (index === process.activities.length - 1 && !isRole) {
                    const endEventId = uuidv4();

                    const elementRightEdge = x + width / 2;
                    if (elementRightEdge > maxX) {
                        maxX = elementRightEdge;
                    }
                    const endSequenceId = uuidv4();
                    relations[endSequenceId] = {
                        name: "",
                        _type: "org.uengine.kernel.bpmn.SequenceFlow",
                        selected: false,
                        sourceRef: activityId,
                        targetRef: endEventId,
                        elementView: {
                            _type: "org.uengine.kernel.view.DefaultSequenceFlowView",
                            id: endSequenceId,
                            points: JSON.stringify([[x + width, y + height / 2], [x + width + 20, y + height / 2]]) // 예시 값
                        },
                        condition: {
                            _type: "org.uengine.kernel.Evaluate",
                            pv: {
                                _type: "org.uengine.kernel.ProcessVariable",
                                name: ""
                            },
                            condition: "==",
                            val: ""
                        }
                    };
                }
            });

            let result = {}
            const finalJson = {
                elements: elements,
                relations: relations,
                version: 3,
                scm: {
                    tag: null,
                    org: null,
                    repo: null,
                    forkedOrg: null,
                    forkedRepo: null
                },
                processVariableDescriptors: process.data.map(data => ({
                    name: data.name,
                    displayName: {
                        text: data.name,
                        _type: "org.uengine.contexts.TextContext"
                    },
                    defaultValueInString: "",
                    global: false,
                    persistOption: "BPMS",
                    typeClassName: "java.lang.String",
                    _type: "org.uengine.kernel.ProcessVariable"
                })),
                _changedByLocaleSelector: false,
                name: {
                    _type: "org.uengine.contexts.TextContext",
                    text: process.processDefinitionName
                }
            };
            this.adjustElementsWithinRoles(process, elements, maxX);
            result['model'] = finalJson
            result['projectName'] = process.processDefinitionName
            console.log(result)
            this.$emit("update:model", result)
        },
        adjustElementsWithinRoles(process, elements) {
            let maxRoleWidth = 0;
            let maxRoleX = 0;

            // Find the maximum width and x of the roles
            Object.values(elements).forEach(element => {
                if (element._type === "org.uengine.kernel.Role") {
                    maxRoleWidth = Math.max(maxRoleWidth, element.elementView.width);
                    maxRoleX = Math.max(maxRoleX, element.elementView.x);
                }
            });

            // Adjust the width of all roles to the maximum width found
            Object.values(elements).forEach(element => {
                if (element._type === "org.uengine.kernel.Role") {
                    element.elementView.width = maxRoleWidth;
                }
            });

            // Adjust the width and x position of the swimlane
            Object.values(elements).forEach(element => {
                if (element.name === "Swimlane") {
                    element.elementView.width = maxRoleWidth + 20;
                    element.elementView.x = maxRoleX - 10; // Swimlane's x is 10 less than the largest role's x
                }
            });

            // Adjust the x position of activities and events to be within the role boundaries
            Object.values(elements).forEach(element => {
                if (element._type !== "org.uengine.kernel.Role" && element._type !== "org.uengine.kernel.bpmn.StartEvent" && element._type !== "org.uengine.kernel.bpmn.EndEvent") {
                    const role = elements[element.role];
                    const roleBoundary = {
                        minX: role.elementView.x - role.elementView.width / 2,
                        maxX: role.elementView.x + role.elementView.width / 2
                    };

                    // Check if the element is outside the horizontal boundaries of the role
                    if (element.elementView.x < roleBoundary.minX || element.elementView.x > roleBoundary.maxX) {
                        // Increase the width of the role and adjust the x position
                        Object.values(elements).filter(el => el._type === "org.uengine.kernel.Role" || el.name === "Swimlane").forEach(el => {
                            el.elementView.width += 100;
                            el.elementView.x += 50;
                        });

                        // Recalculate the role boundaries after adjustment
                        roleBoundary.minX = role.elementView.x - role.elementView.width / 2;
                        roleBoundary.maxX = role.elementView.x + role.elementView.width / 2;

                        // Adjust the element's x position to be within the new role boundary
                        element.elementView.x = Math.max(roleBoundary.minX, Math.min(element.elementView.x, roleBoundary.maxX));
                    }
                }
            });
        },
        createBpmnXml(jsonProcess) {
            // XML 문서 초기화
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\"></bpmn:definitions>', 'application/xml');
            const bpmn = xmlDoc.documentElement;

            // XML 네임스페이스 설정
            bpmn.setAttribute('xmlns:bpmn', 'http://www.omg.org/spec/BPMN/20100524/MODEL');
            bpmn.setAttribute('xmlns:bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI');
            bpmn.setAttribute('xmlns:dc', 'http://www.omg.org/spec/DD/20100524/DC');
            bpmn.setAttribute('xmlns:di', 'http://www.omg.org/spec/DD/20100524/DI');
            bpmn.setAttribute('id', 'Definitions_1');
            bpmn.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            bpmn.setAttribute('exporter', 'Custom BPMN Modeler');
            bpmn.setAttribute('exporterVersion', '1.0');


            // 콜라보레이션 및 참가자 요소 생성
            const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            collaboration.setAttribute('id', 'Collaboration_1');
            const participant = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            participant.setAttribute('id', 'Participant_' + jsonProcess.processDefinitionId);
            participant.setAttribute('name', jsonProcess.processDefinitionName);
            participant.setAttribute('processRef', 'Process_' + jsonProcess.processDefinitionId);
            collaboration.appendChild(participant);
            bpmn.appendChild(collaboration);

            // Process 요소 생성
            const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            process.setAttribute('id', jsonProcess.processDefinitionId)  //.replace(/\s+/g, '_'));
            process.setAttribute('isExecutable', 'true');

            bpmn.appendChild(process);

            // 레인셋 생성
            const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
            laneSet.setAttribute('id', 'LaneSet_' + jsonProcess.processDefinitionId);
            process.appendChild(laneSet);

            // 레인 생성 및 역할 할당
            if (jsonProcess.roles)
                jsonProcess.roles.forEach(role => {
                    const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
                    lane.setAttribute('id', 'Lane_' + role.name.replace(/\s+/g, '_'));
                    lane.setAttribute('name', role.name);
                    laneSet.appendChild(lane);

                    // 해당 역할에 매핑된 활동들을 레인에 할당
                    jsonProcess.activities.forEach(activity => {
                        if (activity.role === role.name) {
                            const flowNodeRef = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:flowNodeRef');
                            flowNodeRef.textContent = activity.id;
                            lane.appendChild(flowNodeRef);
                        }
                    });
                });

            // 각 활동 (Activity) 요소 생성
            if (jsonProcess.activities)
                jsonProcess.activities.forEach(activity => {
                    const task = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:userTask');
                    task.setAttribute('id', activity.id);
                    task.setAttribute('name', activity.name);
                    process.appendChild(task);
                });

            // 시퀀스 플로우 생성
            if (jsonProcess.sequences)
                jsonProcess.sequences.forEach(sequence => {
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    process.appendChild(sequenceFlow);
                });

            //            bpmn.appendChild(process);

            // BPMNDiagram 요소 추가
            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_' + jsonProcess.processDefinitionId);
            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_' + jsonProcess.processDefinitionId);
            bpmnPlane.setAttribute('bpmnElement', collaboration.getAttribute('id'));
            bpmnDiagram.appendChild(bpmnPlane);

            // 레인의 시각적 표현 추가
            if (jsonProcess.roles)
                jsonProcess.roles.forEach((role, index) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', 'BPMNShape_Lane_' + role.name.replace(/\s+/g, '_'));
                    laneShape.setAttribute('bpmnElement', 'Lane_' + role.name.replace(/\s+/g, '_'));

                    const laneBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    laneBounds.setAttribute('x', 100);
                    laneBounds.setAttribute('y', 100 + index * 100);
                    laneBounds.setAttribute('width', 600);
                    laneBounds.setAttribute('height', 100);

                    laneShape.appendChild(laneBounds);
                    bpmnPlane.appendChild(laneShape);
                });

            // 활동 및 시퀀스 플로우의 시각적 표현 추가
            if (jsonProcess.activities)
                jsonProcess.activities.forEach((activity, index) => {
                    const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    shape.setAttribute('id', 'BPMNShape_' + activity.id);
                    shape.setAttribute('bpmnElement', activity.id);

                    const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    bounds.setAttribute('x', 150 + index * 100); // 위치 예제
                    bounds.setAttribute('y', 120 + index * 60); // 위치 예제
                    bounds.setAttribute('width', 80);
                    bounds.setAttribute('height', 60);

                    shape.appendChild(bounds);
                    bpmnPlane.appendChild(shape);
                });

            if (jsonProcess.sequences)
                jsonProcess.sequences.forEach(sequence => {
                    const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
                    edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    // Waypoint 예제 (실제 좌표는 활동의 위치에 따라 조정되어야 함)
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint1.setAttribute('x', 200); // 예제 좌표
                    waypoint1.setAttribute('y', 150); // 예제 좌표
                    edge.appendChild(waypoint1);

                    const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint2.setAttribute('x', 300); // 예제 좌표
                    waypoint2.setAttribute('y', 150); // 예제 좌표
                    edge.appendChild(waypoint2);

                    bpmnPlane.appendChild(edge);
                });

            // // 시각적 요소 생성 (BPMNShape 및 BPMNEdge)
            // if(jsonProcess.activities)
            // jsonProcess.activities.forEach((activity, index) => {
            //     const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //     shape.setAttribute('id', 'BPMNShape_' + activity.id);
            //     shape.setAttribute('bpmnElement', activity.id);

            //     const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //     bounds.setAttribute('x', 100 + (index * 150)); // 예제 위치
            //     bounds.setAttribute('y', 100);
            //     bounds.setAttribute('width', 100);
            //     bounds.setAttribute('height', 80);

            //     shape.appendChild(bounds);
            //     bpmnPlane.appendChild(shape);
            // });

            // // 시퀀스 플로우 시각적 요소
            // if(jsonProcess.sequences)
            // jsonProcess.sequences.forEach(sequence => {
            //     const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            //     edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            //     edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            //     // 예제 waypoint
            //     const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //     waypoint1.setAttribute('x', 150);
            //     waypoint1.setAttribute('y', 140);

            //     const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //     waypoint2.setAttribute('x', 250);
            //     waypoint2.setAttribute('y', 140);

            //     edge.appendChild(waypoint1);
            //     edge.appendChild(waypoint2);

            //     bpmnPlane.appendChild(edge);
            // });

            bpmn.appendChild(bpmnDiagram);

            // XML 문자열로 변환
            const serializer = new XMLSerializer();
            const xmlString = serializer.serializeToString(xmlDoc);
            return xmlString;
        },
    }
}
</script>

<style scoped></style>
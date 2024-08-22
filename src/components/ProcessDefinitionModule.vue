<script>
import xml2js from 'xml2js';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import FormGenerator from './ai/FormDesignGenerator';
import partialParse from "partial-json-parser";

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
        isConsultingMode: false,
        isChanged: false,
    }),
    computed: {},
    mounted() {},
    beforeUnmount() {},
    async created() {},
    methods: {
        extractJSON(inputString, checkFunction) {
            try {
                JSON5.parse(inputString); // if no problem, just return the whole thing
                return inputString;
            } catch (e) {}

            if (this.hasUnclosedTripleBackticks(inputString)) {
                inputString = inputString + '\n```';
            }

            // 정규 표현식 정의
            //const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;
            const regex = /```(?:json)?\s*([\s\S]*?)\s*```/;


            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            const match = inputString.match(regex);

            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if (checkFunction)
                    match.forEach((shouldBeJson) => {
                        const lastIndex = shouldBeJson.lastIndexOf('}');
                        const result = shouldBeJson.slice(0, lastIndex + 1);
                        if (checkFunction(result)) return result;
                    });
                else return match[1];
            }

            // 매치된 결과가 없으면 null 반환
            return null;
        },
        checkedFormData() {
            if (this.processDefinition.data) {
                let formList = this.processDefinition.data.filter(data => data.type == 'Form');
                if (formList && formList.length > 0) {
                    formList.forEach(async (form) => {
                        await this.generateForm(form, false);
                    });
                }
            }
        },
        async generateForm(form, isGenStart) {
            let formHtml = await backend.getRawDefinition(form.name, { type: 'form' }) || null;
            if (formHtml == null) {
                const formGenerator = new FormGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean',
                });
                formGenerator.client.onModelCreated = null;
                formGenerator.client.onGenerationFinished = async (response) => {
                    let jsonData = this.extractJSON(response);
                    jsonData = jsonData.match(/\{[\s\S]*\}/)[0]
                        .replaceAll('\n', '')
                        .replaceAll('`', `"`);
                    jsonData = partialParse(jsonData);
                    if (jsonData.htmlOutput) {
                        await backend.putRawDefinition(jsonData.htmlOutput, form.name, { type: 'form' });
                    }
                }

                if (!isGenStart) {
                    let newMessage = `'${form.name}' 폼을 생성해줘.`;
                    formGenerator.previousMessages = [formGenerator.prevMessageFormat];
                    formGenerator.previousMessages.push({
                        role: 'user',
                        content: newMessage
                    });
                    await formGenerator.generate();
                    isGenStart = true;;
                }
                formHtml = await this.generateForm(form, isGenStart);
            } else {
                return formHtml;
            }
        },
        extractPropertyNameAndIndex(jsonPath) {
            let match;
            match = jsonPath.match(/^\$\.(\w+)\[(\d+)\]$/);
            if (!match) {
                match = jsonPath.match(/^\$\.(\w+)\[\?(.*)\]$/);
                return match ? { propertyName: match[1], index: match.index } : null;
            } else {
                return { propertyName: match[1], index: parseInt(match[2], 10) };
            }
        },
        extendUEngineProperties(businessObject, modification, modeler) {
            //let businessObject = element.businessObject

            if (businessObject.extensionElements?.values) {
                return;
            }

            const bpmnFactory = modeler.get('bpmnFactory');

            const uengineParams = bpmnFactory.create('uengine:Properties', {
                json: ''
            });

            uengineParams.json = JSON.stringify(modification.value.spec);
            const extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            extensionElements.get('values').push(uengineParams);

            businessObject.set('extensionElements', extensionElements);
        },
        modificationElement(modification, modeler) {
            console.log(modification);
            const moddle = modeler.get('bpmnFactory');
            const elementFactory = modeler.get('elementFactory');
            const canvas = modeler.get('canvas');
            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            if (modification.targetJsonPath.includes('components')) {
                // var newElementDi = moddle.create(`bpmn:${modification.value.componentType}`, { text: modification.value.name })
                // var newElementShape = moddle.create(`bpmndi:BPMNShape`, { text: '' })
                // newElementShape.bpmnElement = newElementDi
                // newElementShape.dc = moddle.create(`dc:Bounds`, { x: 0, y: 0, width: 100, height: 100 })
                // elementFactory
                var rootElement = canvas.getRootElement();
                var newElement = elementFactory.createShape({
                    type: `bpmn:${modification.value.componentType}`,
                    id: modification.value.id,
                    x: 0,
                    y: 0
                });
                newElement.businessObject.set('name', modification.value.name);
                newElement.businessObject.set('id', modification.value.id);
                modeling.createShape(
                    newElement,
                    {
                        id: modification.value.id,
                        x: modification.value.x ? modification.value.x : 0,
                        y: modification.value.y ? modification.value.y : 0
                    },
                    rootElement.children[0]
                );

                this.extendUEngineProperties(newElement.businessObject, modification, modeler);
            }
            if (modification.targetJsonPath.includes('sequences')) {
                var sourceElement = elementRegistry.get(modification.value.source);
                var targetElement = elementRegistry.get(modification.value.target);
                var sequenceFlow = elementFactory.createConnection({
                    type: 'bpmn:SequenceFlow',
                    source: sourceElement,
                    target: targetElement
                });
                modeling.connect(sourceElement, targetElement);
            }

            // let result = { element: null, di: null };
            // const parser = new DOMParser();
            // let elementXML = '<bpmn:userTask id="" name="" role=""></bpmn:userTask>';
            // let element = parser.parseFromString(elementXML, 'application/xml');
            // // const userTask = parser.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'userTask');
            // element.documentElement.setAttribute('id', modification.value.id);
            // element.documentElement.setAttribute('name', modification.value.name);
            // element.documentElement.setAttribute('role', modification.value.role);

            // let diXML =
            //     '<bpmndi:BPMNShape id="" bpmnElement=""><dc:Bounds x="790" y="140" width="100" height="80" /><bpmndi:BPMNLabel /></bpmndi:BPMNShape>';
            // result.element = tmp;
            // result.diagram = tmp.di;
            // return result;
        },
        modificationAdd(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            if (obj) {
                this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value);
            } else if (this.processDefinition[modification.targetJsonPath.replace('$.', '')]) {
                this.processDefinition[modification.targetJsonPath.replace('$.', '')].push(modification.value);
            }
        },
        modificationReplace(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            // const updateAtIndex = (array, index, newValue) => (array[index] = newValue, array);
            this.processDefinition[obj.propertyName][obj.index] = modification.value;
            // this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value)
        },
        modificationRemove(modification, modeler) {
            if (modification.value) {
                const modeling = modeler.get('modeling');
                const elementRegistry = modeler.get('elementRegistry');
                console.log('********');
                console.log(modification);
                console.log('********');
                // elementRegistry.get()
                // let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
                var sequence = elementRegistry.get(modification.value.id);
                modeling.removeElements([sequence]);
            }
        },
        toggleVersionDialog(open) {
            // Version Dialog
            this.versionDialog = open;
            this.loading = false
        },
        // createBpmnXml(jsonModel) {
        //     const bpmnDefinitions = {
        //         "$type": "bpmn:Definitions",
        //         "id": "Definitions_1",
        //         "targetNamespace": "http://bpmn.io/schema/bpmn",
        //         "exporter": "Custom BPMN Modeler",
        //         "exporterVersion": "1.0",
        //         "rootElements": [
        //             {
        //                 "$type": "bpmn:Collaboration",
        //                 "id": "Collaboration_1",
        //                 "participants": [
        //                     {
        //                         "$type": "bpmn:Participant",
        //                         "id": "Participant_" + jsonModel.processDefinitionId,
        //                         "name": jsonModel.processDefinitionName,
        //                         "$parent": "Collaboration_1"
        //                     }
        //                 ],
        //                 "$parent": "Definitions_1"
        //             },
        //             {
        //                 "$type": "bpmn:Process",
        //                 "id": jsonModel.processDefinitionId,
        //                 "isExecutable": true,
        //                 "laneSets": [
        //                     {
        //                         "$type": "bpmn:LaneSet",
        //                         "id": "LaneSet_" + jsonModel.processDefinitionId,
        //                         "$parent": jsonModel.processDefinitionId
        //                     }
        //                 ],
        //                 "flowElements": jsonModel.activities.map(activity => ({
        //                     "$type": "bpmn:UserTask",
        //                     "id": activity.id,
        //                     "name": activity.name,
        //                     "$parent": jsonModel.processDefinitionId
        //                 })).concat(jsonModel.sequences.map(sequence => ({
        //                     "$type": "bpmn:SequenceFlow",
        //                     "id": "SequenceFlow_" + sequence.source + "_" + sequence.target,
        //                     "$parent": jsonModel.processDefinitionId,
        //                     "sourceRef": sequence.source,
        //                     "targetRef": sequence.target
        //                 }))),
        //                 "$parent": "Definitions_1"
        //             }
        //         ],
        //         "diagrams": [
        //             {
        //                 "$type": "bpmndi:BPMNDiagram",
        //                 "id": "BPMNDiagram_" + jsonModel.processDefinitionId,
        //                 "plane": {
        //                     "$type": "bpmndi:BPMNPlane",
        //                     "id": "BPMNPlane_" + jsonModel.processDefinitionId,
        //                     "planeElement": jsonModel.activities.map((activity, index) => ({
        //                         "$type": "bpmndi:BPMNShape",
        //                         "id": "BPMNShape_" + activity.id,
        //                         "bounds": {
        //                             "$type": "dc:Bounds",
        //                             "x": 150 + (index * 100), // 간격 조정
        //                             "y": 120 + (index * 60), // 높이 조정
        //                             "width": 80,
        //                             "height": 60
        //                         },
        //                         "bpmnElement": activity.id,
        //                         "$parent": "BPMNPlane_" + jsonModel.processDefinitionId
        //                     })),
        //                     "bpmnElement": "Collaboration_1",
        //                     "$parent": "BPMNDiagram_" + jsonModel.processDefinitionId
        //                 },
        //                 "$parent": "Definitions_1"
        //             }
        //         ]
        //     };

        //     // SequenceFlow에 대한 BPMNEdge 추가
        //     jsonModel.sequences.forEach((sequence, index) => {
        //         const sourceIndex = jsonModel.activities.findIndex(activity => activity.id === sequence.source);
        //         const targetIndex = jsonModel.activities.findIndex(activity => activity.id === sequence.target);

        //         bpmnDefinitions.diagrams[0].plane.planeElement.push({
        //             "$type": "bpmndi:BPMNEdge",
        //             "id": "BPMNEdge_" + sequence.source + "_" + sequence.target,
        //             "waypoint": [
        //                 {
        //                     "$type": "dc:Point",
        //                     "x": 190 + (sourceIndex * 100),
        //                     "y": 150 + (sourceIndex * 60)
        //                 },
        //                 {
        //                     "$type": "dc:Point",
        //                     "x": 190 + (targetIndex * 100),
        //                     "y": 150 + (targetIndex * 60)
        //                 }
        //             ],
        //             "bpmnElement": "SequenceFlow_" + sequence.source + "_" + sequence.target,
        //             "$parent": "BPMNPlane_" + jsonModel.processDefinitionId
        //         });
        //     });

        //     return bpmnDefinitions;
        // },
        // absY(y, height) {
        //     return element.elementView.y - (element.elementView.height / 2)
        // }
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
        transformJsonModel(jsonModel) {
            const transformedModel = {
                megaProcessId: "미분류",
                majorProcessId: "미분류",
                processDefinitionName: jsonModel.processDefinitionName || "Unknown",
                processDefinitionId: jsonModel.processDefinitionId || "Unknown",
                description: jsonModel.description || "",
                roles: (jsonModel.roles || []).map(role => ({
                    name: role.name,
                    resolutionRule: "실제 " + role.name + "을(를) 매핑"
                })),
                components: [],
                data: jsonModel.data || [],
                sequences: (jsonModel.sequences || []).map(seq => ({
                    source: seq.source,
                    target: seq.target,
                    condition: {}
                })),
                participants: []
            };

            // Transform events and activities into components
            if (Array.isArray(jsonModel.events)) {
                jsonModel.events.forEach(event => {
                    transformedModel.components.push({
                        componentType: "Event",
                        id: event.id,
                        name: event.name,
                        role: event.role,
                        source: event.type === "startEvent" ? "none" : jsonModel.sequences?.find(seq => seq.target === event.id)?.source,
                        type: event.type === "startEvent" ? "StartEvent" : "EndEvent",
                        description: event.description
                    });
                });
            }

            if (Array.isArray(jsonModel.activities)) {
                jsonModel.activities.forEach(activity => {
                    transformedModel.components.push({
                        componentType: "Activity",
                        id: activity.id,
                        name: activity.name,
                        type: "UserActivity",
                        source: jsonModel.sequences?.find(seq => seq.target === activity.id)?.source,
                        description: activity.description,
                        instruction: activity.instruction,
                        role: activity.role,
                        inputData: activity.inputData,
                        outputData: activity.outputData,
                        checkpoints: []
                    });
                });
            }

            // Sort components based on the sequence
            if (transformedModel.components.length > 0 && transformedModel.sequences.length > 0) {
                transformedModel.components.sort((a, b) => {
                    const aIndex = transformedModel.sequences.findIndex(seq => seq.target === a.id);
                    const bIndex = transformedModel.sequences.findIndex(seq => seq.target === b.id);
                    return aIndex - bIndex;
                });
            }

            return transformedModel;
        },
        createBpmnXml(jsonModel) {
            if(jsonModel && !jsonModel.components){
                jsonModel = this.transformJsonModel(jsonModel)
            }
            let me = this;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"></bpmn:definitions>',
                'application/xml'
            );
            const bpmnDefinitions = xmlDoc.documentElement;
            var isHorizontal = jsonModel.isHorizontal;

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

            const properties = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
            pc.appendChild(properties);

            const json = xmlDoc.createElementNS('http://uengine', 'uengine:json');    
            json.textContent = JSON.stringify("{}");
            properties.appendChild(json);
            collaboration.appendChild(pc);

            // Data 매핑
            const extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
            const root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
            if (jsonModel.data) {
                jsonModel.data.forEach((data) => {
                    const variable = xmlDoc.createElementNS('http://uengine', 'uengine:variable');
                    variable.setAttribute('name', data.name);
                    variable.setAttribute('type', data.type);
                    const variableJson =  xmlDoc.createElementNS('http://uengine', 'uengine:json');
                    variableJson.textContent = JSON.stringify({"defaultValue":""})
                    
                    variable.appendChild(variableJson);
                    root.appendChild(variable);
                });
            }

            extensionElements.appendChild(root);
            process.appendChild(extensionElements);



            
            let inComing = {};
            let outGoing = {};
            let lastXPos = 140;
            let positionMapping = {};
            let rolePos = {};
            let activityPos = {};
            let offsetPos = {};

            // Sequences(bpm 모델으 바깥쪽 box 크기) 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach((sequence, idx) => {
                    if (!positionMapping[sequence.source]) {
                        positionMapping[sequence.source] = lastXPos;
                        lastXPos += 120;
                    }
                    if (idx === jsonModel.sequences.length - 1) {
                        positionMapping[sequence.target] = lastXPos += 130;
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
                    if(sequence.condition) {
                        if(sequence.condition.key && sequence.condition.condition && sequence.condition.value)  {
                            
                        const conditionJson = {
                            condition: {
                                _type:"org.uengine.kernel.Evaluate",
                                key: sequence.condition.key,
                                condition: sequence.condition.condition,
                                value: sequence.condition.value
                            }
                        }
                        if(!sequence.name || sequence.name == '') {
                            let sequenceName = sequence.condition.condition + '' + sequence.condition.value;
                            sequenceFlow.setAttribute('name', sequenceName);
                        }
                        params.textContent = JSON.stringify(conditionJson);
                        root.appendChild(params);
                        extensionElements.appendChild(root);
                        sequenceFlow.appendChild(extensionElements);
                        }

                    }
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                });



            const checkForm = function(variables, variable) {
                let formVars = Array.isArray(variables) ? variables.filter((data) => data && data.type === 'Form') : [];
                return formVars.some(form => form.name == variable);
            }

                
            const laneActivityMapping = {};
            const createActivity = function(activity, variables) {
                const role = activity.role ? activity.role : null;
                if(role) {
                    if (!laneActivityMapping[activity?.role]) {
                            laneActivityMapping[activity?.role] = [];
                    }
                    laneActivityMapping[activity.role].push(activity.id);
                }

                
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
                // {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction":
                //     "OUT"}
                let inputDataList = [];
                let outputDataList = [];
                let variableForHtmlFormContext = null;
                activity?.inputData?.forEach((data) => {
                    inputDataList.push({
                        argument: { text: data },
                        variable: { name: data },
                        direction: 'OUT'
                    });
                });
                activity?.outputData?.forEach((data) => {
                    if(checkForm(variables, data)) {
                        variableForHtmlFormContext = {
                            name: data
                        }
                    } else {
                        outputDataList.push({
                            argument: { text: data },
                            variable: { name: data },
                            direction: 'IN'
                        });
                    }
                });

                if(role) {
                    let activityData = {
                        parameters: [...inputDataList, ...outputDataList]
                    };
                    activityData['duration'] = activity?.duration ? activity?.duration : 5;
                    if (variableForHtmlFormContext) {
                        activityData['variableForHtmlFormContext'] = variableForHtmlFormContext;
                        activityData['_type'] = 'org.uengine.kernel.FormActivity';
                    }
                    params.textContent = JSON.stringify(activityData);
                    root.appendChild(params);
                }
                extensionElements.appendChild(root);
                userTask.appendChild(extensionElements);
                process.appendChild(userTask);
            };
            
            const createGateway = function(gateway) {
                const role = gateway.role ? gateway.role : null;
                if(role) {
                    if (!laneActivityMapping[gateway?.role]) {
                            laneActivityMapping[gateway?.role] = [];
                    }
                    laneActivityMapping[gateway.role].push(gateway.id);
                }


                
                const bpmnGateway = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + gateway.type);
                    bpmnGateway.setAttribute('id', gateway.id);
                    bpmnGateway.setAttribute('name', gateway.name);

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

            };

            const createEvent = function(event) {
                const bpmnEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + event.type);
                bpmnEvent.setAttribute('id', event.id);
                bpmnEvent.setAttribute('name', event.name);
                process.appendChild(bpmnEvent);
            };

            

            var roleX = 0;
            var roleY  = {};
            var roleWidth = 0;
            var roleHeight = {};
            var startX = 0;
            var startY = 0;

            if(jsonModel.components) {
                Object.keys(jsonModel.components).forEach((key) => {
                    const component = jsonModel.components[key];
                    if(component.componentType == 'Activity') {
                        createActivity(component, jsonModel.data);
                    } else if(component.componentType == 'Gateway') {
                        createGateway(component);
                    } else if(component.componentType == 'Event') {
                        createEvent(component);
                    }
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
            const participantShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            participantShape.setAttribute('id', 'Participant_1');
            participantShape.setAttribute('bpmnElement', 'Participant');
            participantShape.setAttribute('isHorizontal', isHorizontal);
            const dcBoundsParticipant = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
           
            participantShape.appendChild(dcBoundsParticipant);
            bpmnPlane.appendChild(participantShape);
            
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


            if(jsonModel.components) {

                var currentSource = "default";
                
                Object.keys(jsonModel.components).forEach((key) => {
                    const component = jsonModel.components[key];
                    let componentX = 100;
                    let componentY = 100;
                    if(component.source) {
                        let findLastSameSource = function(activityPos, component) {
                            if(activityPos) {
                                const keys = Object.keys(activityPos).reverse(); 
                                for (let i = 0; i < keys.length; i++) {
                                    const key = keys[i];
                                    if (activityPos[key].source === component.source) {
                                        return activityPos[key];
                                    }
                                }
                            }
                            return null; 
                        }
                        const lastSameSource = findLastSameSource(activityPos, component)
                        const source = activityPos[component.source?component.source:currentSource];
                        if (lastSameSource) {
                            componentX = lastSameSource.x + (isHorizontal ? 0 : 200);
                            componentY = lastSameSource.y + (isHorizontal ? 100 : 0);
                            if(lastSameSource.type.indexOf("Gateway") != -1) {
                                componentX += (isHorizontal ? 150 : 0);
                            } else if(lastSameSource.type.indexOf("Activity") != -1) {
                            } else if(lastSameSource.type.indexOf("Event") != -1) {
                            }
                        } else {
                            componentX = source? source.x + (isHorizontal ? 150 : 0) : isHorizontal ? 150 : 0;
                            componentY = source? source.y + (isHorizontal ? 0 : 100) : isHorizontal ? 0 : 150;
                            if(source) {
                                if (source.role != component.role) {
                                    componentX += isHorizontal ? 0 : 150;
                                    componentY += isHorizontal ? 100 : 0;
                                } else {
                                }
                            }
                        }
                        currentSource = component.source;
                    }


                    const componentShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    if(component.componentType == "Event") {
                        componentShape.setAttribute('id', `Shape_${component.id}`);
                    } else {
                        componentShape.setAttribute('id', `BPMNShape_${component.id}`);
                    }
                    componentShape.setAttribute('bpmnElement', component.id);

                    const dcBoundsComponent = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    // 활동과 게이트웨이의 width와 height 설정
                    let width = 50;
                    let height = 50;
                    if (component.componentType == "Gateway") {
                        width = 50;
                        height = 50;
                    } else if(component.componentType == "Activity"){
                        width = 100;
                        height = 80;
                    } else if(component.componentType == "Event") {
                        width = 34;
                        height = 34;
                    }

                    if(isHorizontal) {
                        if(component.componentType != 'Event') {
                            if(componentX > 1100) {
                                componentX = 100;
                                componentY += 150;
                            }
                        } else if(component.type == 'EndEvent') {
                            componentX = 1200;
                            if(startY > componentY) {
                                componentY = startY;
                            }
                        }
                    } else {
                        if(component.type == 'EndEvent') {
                            componentY = 900;
                            if(startX > componentX) {
                                componentX = startX;
                            }
                        }
                    }

                    dcBoundsComponent.setAttribute('width', width);
                    dcBoundsComponent.setAttribute('height', height);

                    const offsetX = width / 2;
                    const offsetY = height / 2;
                    
                    
                    dcBoundsComponent.setAttribute('x', componentX - offsetX);
                    dcBoundsComponent.setAttribute('y', componentY - offsetY);
                    componentShape.appendChild(dcBoundsComponent);

                    if(component.componentType == 'Event') {
                        // 라벨 추가
                        const eventLabel = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNLabel');
                        const dcBoundsLabel = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        dcBoundsLabel.setAttribute('x', componentX - offsetX - 15); // 라벨의 x 좌표
                        dcBoundsLabel.setAttribute('y', componentY - offsetY + 40); // 라벨의 y 좌표, 원하는 값으로 수정
                        dcBoundsLabel.setAttribute('width', '64');
                        dcBoundsLabel.setAttribute('height', '14');
                        eventLabel.appendChild(dcBoundsLabel);
                        componentShape.appendChild(eventLabel);
                    }

                    bpmnPlane.appendChild(componentShape);

                    activityPos[component.id] = {
                        x: componentX,
                        y: componentY,
                        width: parseInt(dcBoundsComponent.getAttribute('width')),
                        height: parseInt(dcBoundsComponent.getAttribute('height')),
                        role: component.role? component.role : currentSource,
                        type: component.type? component.type : "Activity",
                        source: component.source? component.source: currentSource
                    };

                    offsetPos[component.id] = {
                        x: componentX - offsetX,
                        y: componentY - offsetY,
                        width: parseInt(dcBoundsComponent.getAttribute('width')),
                        height: parseInt(dcBoundsComponent.getAttribute('height')),
                        role: component.role? component.role : currentSource,
                        type: component.type? component.type : "Activity",
                        source: component.source? component.source: currentSource
                    };

                    if(component.type == 'StartEvent') {
                        startX = componentX;
                        startY = componentY;
                    }


                    
                    if(isHorizontal) {
                        if(roleX > 0) {
                            roleX = componentX;
                        }
                    
                        if(roleWidth < componentX) {
                            roleWidth = componentX;
                        }
                        
                        if(!roleY[component.role]) {
                            roleY[component.role] = componentY;
                        } else {
                            if(roleY[component.role] > componentY) {
                                roleY[component.role] = componentY;
                            }
                        }
                
                        if(roleHeight[component.role]) {
                            if(roleHeight[component.role] < componentY) {
                                roleHeight[component.role] = componentY
                            }
                        } else {
                            roleHeight[component.role] = componentY;
                        }
                    } else {
                        if(roleX > 0) {
                            roleX = componentY;
                        }
                    
                        if(roleWidth < componentY) {
                            roleWidth = componentY;
                        }
                        
                        if(!roleY[component.role]) {
                            roleY[component.role] = componentX;
                        } else {
                            if(roleY[component.role] > componentX) {
                                roleY[component.role] = componentX;
                            }
                        }
                
                        if(roleHeight[component.role]) {
                            if(roleHeight[component.role] < componentX) {
                                roleHeight[component.role] = componentX
                            }
                        } else {
                            roleHeight[component.role] = componentX;
                        }
                    }
                });
                
            }

            
            let mainX = isHorizontal ? (roleX? roleX: 0) : 0; 
            let mainY = isHorizontal ? 0 : (roleX? roleX: 0);
            let mainWidth = isHorizontal ? (roleWidth + 115) : 300;
            let mainHeight = isHorizontal ? 300 : (roleWidth + 115);
            let lastKey = "default";
            if(Object.keys(roleHeight).length > 0) {
                mainY = Object.values(roleHeight)[0];
                if(jsonModel.roles) {
                    lastKey = Object.keys(jsonModel.roles).pop();
                    if(isHorizontal) {
                        mainHeight = roleHeight[jsonModel.roles[lastKey].name]? roleHeight[jsonModel.roles[lastKey].name] : 300;
                    } else {
                        mainWidth = roleHeight[jsonModel.roles[lastKey].name]? roleHeight[jsonModel.roles[lastKey].name] : 300;
                    }
                }
            }

            dcBoundsParticipant.setAttribute('x', mainX + (isHorizontal ? -30 : 25));
            dcBoundsParticipant.setAttribute('y', mainY + (isHorizontal ? -75 : -100));

            dcBoundsParticipant.setAttribute('width', mainWidth + (isHorizontal ? 0 : 50));
            dcBoundsParticipant.setAttribute('height', mainHeight + (isHorizontal ? 45 : 0));
            


            // Lane 및 Activity에 대한 시각적 표현 추가
            if (jsonModel.roles) {
                jsonModel.roles.forEach((role, roleIndex) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', `BPMNShape_${roleIndex}`);
                    laneShape.setAttribute('bpmnElement', `Lane_${roleIndex}`);
                    laneShape.setAttribute('isHorizontal', isHorizontal);
                    const dcBoundsLane = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    let roleYResult = roleY[role.name]? roleY[role.name] - 75: 0;
                    let roleHeightResult = roleHeight[role.name]?roleHeight[role.name] + 50 : 0;
                    
                    if(isHorizontal) {
                        dcBoundsLane.setAttribute('x', roleX ? roleX : 0);
                        dcBoundsLane.setAttribute('y', roleYResult);
                    } else {
                        dcBoundsLane.setAttribute('x', roleYResult);
                        dcBoundsLane.setAttribute('y', (roleX ? roleX : 0) + 30);
                    }

                    if (jsonModel.roles && jsonModel.roles[lastKey] && jsonModel.roles[lastKey].name === role.name) {
                        roleHeightResult += (isHorizontal ? -155 : 0);
                    }


                    // 가장 바깥 라인 안쪽의 스윔레인 자체 길이
                    
                    if(isHorizontal) {
                        dcBoundsLane.setAttribute('width', roleWidth + 85);
                        dcBoundsLane.setAttribute('height', roleHeightResult);
                    } else {
                        dcBoundsLane.setAttribute('width', roleHeightResult);
                        dcBoundsLane.setAttribute('height', roleWidth + 85);
                    }
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    };
                });
            }


            

             // 서로간의 선위치를 설정하는 부분
             if (jsonModel.sequences) {
                jsonModel.sequences.forEach((sequence) => {
                    if (!offsetPos[sequence.source] || !offsetPos[sequence.target]) {
                        return false;
                    }

                    const bpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    bpmnEdge.setAttribute('id', `BPMNEdge_${sequence.source}_${sequence.target}`);
                    bpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    const sourcePos = offsetPos[sequence.source] || {};
                    const targetPos = offsetPos[sequence.target] || {};

                    let startX = (parseInt(sourcePos.x) || 0) + (parseInt(sourcePos.width) || 0);
                    let startY = (parseInt(sourcePos.y) || 0) + (parseInt(sourcePos.height) || 0) / 2;

                    let endX = parseInt(targetPos.x) || 0;
                    let endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0) / 2;

                    let distanceX = endX - startX;
                    let distanceY = endY - startY;

                    if(distanceY > distanceX) {
                        startX = (parseInt(sourcePos.x) || 0) + (parseInt(sourcePos.width) || 0) / 2;
                        startY = (parseInt(sourcePos.y) || 0) + (parseInt(sourcePos.height) || 0);

                        endX = parseInt(targetPos.x) || 0;
                        endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0) / 2;
                    }

                    if(startX > endX) {
                        endX = parseInt(targetPos.x) || 0;
                        endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0) / 2;
                    }

                    if(distanceY < 0) {
                        endX = (parseInt(targetPos.x) || 0) + (parseInt(targetPos.width) || 0) / 2;
                        endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0);
                    }

                    if(!isHorizontal) {
                        startX = (parseInt(sourcePos.x) || 0) + (parseInt(sourcePos.width) || 0) / 2;
                        startY = (parseInt(sourcePos.y) || 0) + (parseInt(sourcePos.height) || 0);

                        endX = (parseInt(targetPos.x) || 0) + (parseInt(targetPos.width) || 0) / 2;
                        endY = parseInt(targetPos.y) || 0;

                        distanceX = endX - startX;
                        distanceY = endY - startY;

                        if(Math.abs(distanceX) > Math.abs(distanceY)) {
                            startX = (parseInt(sourcePos.x) || 0) + (parseInt(sourcePos.width) || 0);
                            startY = (parseInt(sourcePos.y) || 0) + (parseInt(sourcePos.height) || 0) / 2;

                            endX = parseInt(targetPos.x) || 0;
                            endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0) / 2;
                        }

                        if(startY > endY) {
                            endX = (parseInt(targetPos.x) || 0) + (parseInt(targetPos.width) || 0) / 2;
                            endY = (parseInt(targetPos.y) || 0) + (parseInt(targetPos.height) || 0);
                        }

                        if(distanceX < 0) {
                            startX = parseInt(sourcePos.x) || 0;
                            startY = (parseInt(sourcePos.y) || 0) + (parseInt(sourcePos.height) || 0) / 2;
                        }
                    }

                    // 첫 번째 waypoint (시작점)
                    if(isHorizontal) {
                        const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint1.setAttribute('x', startX);
                        waypoint1.setAttribute('y', startY);
                        bpmnEdge.appendChild(waypoint1);

                        if (startY === endY) {
                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        } else if(startX > endX) {
                            const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle1.setAttribute('x', startX);
                            waypointMiddle1.setAttribute('y', startY);
                            bpmnEdge.appendChild(waypointMiddle1);

                            const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle2.setAttribute('x', startX);
                            waypointMiddle2.setAttribute('y', startY + (endY - startY)/2);
                            bpmnEdge.appendChild(waypointMiddle2);

                            const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle3.setAttribute('x', endX - 60);
                            waypointMiddle3.setAttribute('y', endY - (endY - startY)/2);
                            bpmnEdge.appendChild(waypointMiddle3);

                            const waypointMiddle4 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle4.setAttribute('x', endX - 60);
                            waypointMiddle4.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypointMiddle4);

                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        } else {
                            const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle1.setAttribute('x', startX);
                            waypointMiddle1.setAttribute('y', startY);
                            bpmnEdge.appendChild(waypointMiddle1);

                            if(distanceY >= 0) {
                                const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle2.setAttribute('x', startX);
                                waypointMiddle2.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle2);

                                const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle3.setAttribute('x', endX);
                                waypointMiddle3.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle3);
                            } else {
                                const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle2.setAttribute('x', endX);
                                waypointMiddle2.setAttribute('y', startY);
                                bpmnEdge.appendChild(waypointMiddle2);

                                const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle3.setAttribute('x', endX);
                                waypointMiddle3.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle3);
                            }

                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        }
                    } else {
                        const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint1.setAttribute('x', startX);
                        waypoint1.setAttribute('y', startY);
                        bpmnEdge.appendChild(waypoint1);

                        if (startX === endX) {
                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        } else if(startY > endY) {
                            const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle1.setAttribute('x', startX);
                            waypointMiddle1.setAttribute('y', startY);
                            bpmnEdge.appendChild(waypointMiddle1);

                            const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle2.setAttribute('x', startX + (endX - startX)/2);
                            waypointMiddle2.setAttribute('y', startY);
                            bpmnEdge.appendChild(waypointMiddle2);

                            const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle3.setAttribute('x', endX - (endX - startX)/2);
                            waypointMiddle3.setAttribute('y', endY + 60);
                            bpmnEdge.appendChild(waypointMiddle3);

                            const waypointMiddle4 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle4.setAttribute('x', endX);
                            waypointMiddle4.setAttribute('y', endY + 60);
                            bpmnEdge.appendChild(waypointMiddle4);

                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        } else {
                            const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypointMiddle1.setAttribute('x', startX);
                            waypointMiddle1.setAttribute('y', startY);
                            bpmnEdge.appendChild(waypointMiddle1);

                            if(distanceX >= 0) {
                                const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle2.setAttribute('x', endX);
                                waypointMiddle2.setAttribute('y', startY);
                                bpmnEdge.appendChild(waypointMiddle2);

                                const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle3.setAttribute('x', endX);
                                waypointMiddle3.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle3);
                            } else {
                                const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle2.setAttribute('x', startX);
                                waypointMiddle2.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle2);

                                const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                                waypointMiddle3.setAttribute('x', endX);
                                waypointMiddle3.setAttribute('y', endY);
                                bpmnEdge.appendChild(waypointMiddle3);
                            }

                            const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                            waypoint2.setAttribute('x', endX);
                            waypoint2.setAttribute('y', endY);
                            bpmnEdge.appendChild(waypoint2);
                        }
                    }


                    // 게이트웨이에서 리턴되는 선의 경우 마지막 변곡점 추가
                    // if (sequence.source.includes('gateway') && sequence.target.includes('leave')) {
                    //     const extraWaypoint = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    //     extraWaypoint.setAttribute('x', endX);
                    //     extraWaypoint.setAttribute('y', endY + 20); // 원하는 위치로 조정
                    //     bpmnEdge.appendChild(extraWaypoint);
                    // }

                    bpmnPlane.appendChild(bpmnEdge);
                });
            }


            
            // XML 문자열로 변환 및 반환
            const serializer = new XMLSerializer();
            const bpmnXml = serializer.serializeToString(xmlDoc);
            return bpmnXml;

        },
        createBpmnXmlTest(jsonModel) {
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
                    if (idx === jsonModel.sequences.length - 1) {
                        positionMapping[sequence.target] = lastXPos += 130;
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
                    if(sequence.condition == '예') {
                        sequence.condition = 'true';
                    } else if(sequence.condition == '아니오') {
                        sequence.condition = 'false';
                    }
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
                    // let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    // let role = xmlDoc.createElementNS('http://uengine', 'uengine:Role');
                    // // role.textContent = activity.role
                    // // root.appendChild(role)
                    // let desc = xmlDoc.createElementNS('http://uengine', 'uengine:Description');
                    // // desc.textContent = activity.description
                    // // root.appendChild(desc)
                    // let checkpoints = xmlDoc.createElementNS('http://uengine', 'uengine:Checkpoint');
                    // if (activity.checkpoints) {
                    //     activity.checkpoints.forEach((checkpoint) => {
                    //         console.log(checkpoint)
                    //         let check = xmlDoc.createElementNS('http://uengine', 'uengine:Checkpoint');
                    //         check.textContent = checkpoint
                    //         checkpoints.appendChild(check)
                    //     })
                    // }
                    // root.appendChild(checkpoints)

                    // // Params
                    // let params = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    // if (activity.inputData) {
                    //     activity.inputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "input")
                    //         params.appendChild(param)
                    //     })
                    // }
                    // if (activity.outputData) {
                    //     activity.outputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "output")
                    //         params.appendChild(param)
                    //     })
                    // }
                    // root.appendChild(params)
                    // extensionElements.appendChild(root)
                    // userTask.appendChild(extensionElements)

                    if (jsonModel.events) {
                        jsonModel.events.forEach((event, index) => {
                            const bpmnEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + event.type);
                            bpmnEvent.setAttribute('id', event.id);
                            bpmnEvent.setAttribute('name', event.name);
                            process.appendChild(bpmnEvent);

                            // if (outGoing[event.id]) {
                            //     let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                            //     outGoingSeq.textContent = outGoing[event.id];
                            //     bpmnEvent.appendChild(outGoingSeq);
                            // }
                            // if (inComing[event.id]) {
                            //     let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                            //     inComingSeq.textContent = inComing[event.id];
                            //     bpmnEvent.appendChild(inComingSeq);
                            // }
                        });
                    }

                    // if (idx == 0) {
                    //     // 시작일땐 StartEvent와 연결
                    //     const startEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:startEvent');
                    //     startEvent.setAttribute('id', 'StartEvent_1');
                    //     startEvent.setAttribute('name', 'StartEvent');
                    //     process.appendChild(startEvent);

                    //     const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    //     sequenceFlow.setAttribute('id', 'SequenceFlow_' + 'StartEvent' + '_' + activity.id);
                    //     sequenceFlow.setAttribute('name', '');
                    //     sequenceFlow.setAttribute('sourceRef', 'StartEvent_1');
                    //     sequenceFlow.setAttribute('targetRef', activity.id);
                    //     let extensionElements = xmlDoc.createElementNS(
                    //         'http://www.omg.org/spec/BPMN/20100524/MODEL',
                    //         'bpmn:extensionElements'
                    //     );
                    //     let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    //     let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     conditionParam.setAttribute('key', 'condition');
                    //     conditionParam.textContent = '';
                    //     conditionParams.appendChild(conditionParam);
                    //     root.appendChild(conditionParams);
                    //     extensionElements.appendChild(root);
                    //     sequenceFlow.appendChild(extensionElements);
                    //     process.appendChild(sequenceFlow);

                    //     let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                    //     inComingSeq.textContent = 'SequenceFlow_' + 'StartEvent' + '_' + activity.id;
                    //     userTask.appendChild(inComingSeq);
                    // } else if (idx == jsonModel.activities.length - 1) {
                    //     // 마지막엔 EndEvent와 연결
                    //     // EndEvent 요소 추가
                    //     const endEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:endEvent');
                    //     endEvent.setAttribute('id', 'EndEvent');
                    //     endEvent.setAttribute('name', 'EndEvent');
                    //     process.appendChild(endEvent);

                    //     const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    //     sequenceFlow.setAttribute('id', 'SequenceFlow_' + activity.id + '_' + 'EndEvent');
                    //     sequenceFlow.setAttribute('name', '');
                    //     sequenceFlow.setAttribute('sourceRef', activity.id);
                    //     sequenceFlow.setAttribute('targetRef', 'EndEvent');
                    //     let extensionElements = xmlDoc.createElementNS(
                    //         'http://www.omg.org/spec/BPMN/20100524/MODEL',
                    //         'bpmn:extensionElements'
                    //     );
                    //     let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    //     let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     conditionParam.setAttribute('key', 'condition');
                    //     conditionParam.textContent = '';
                    //     conditionParams.appendChild(conditionParam);
                    //     root.appendChild(conditionParams);
                    //     extensionElements.appendChild(root);
                    //     sequenceFlow.appendChild(extensionElements);
                    //     process.appendChild(sequenceFlow);

                    //     let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                    //     outGoingSeq.textContent = 'SequenceFlow_' + activity.id + '_' + 'EndEvent';
                    //     userTask.appendChild(outGoingSeq);
                    // }
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
            // 스윔레인을 감싸고있는 가장 바깥 라인의 길이
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
                    // 가장 바깥 라인 안쪽의 스윔레인 자체 길이
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
                if (jsonModel.sequences)
                    jsonModel.sequences.forEach((sequence) => {
                        const sourceElement = elements.find((el) => el.id === sequence.source);
                        const targetElement = elements.find((el) => el.id === sequence.target);
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

            // XML 문자열로 변환 및 반환
            const serializer = new XMLSerializer();
            const bpmnXml = serializer.serializeToString(xmlDoc);
            return bpmnXml;

            // 기존 코드
            // // XML 문서 초기화
            // const parser = new DOMParser();
            // const xmlDoc = parser.parseFromString(
            //     '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"></bpmn:definitions>',
            //     'application/xml'
            // );
            // const bpmn = xmlDoc.documentElement;

            // // XML 네임스페이스 설정
            // bpmn.setAttribute('xmlns:bpmn', 'http://www.omg.org/spec/BPMN/20100524/MODEL');
            // bpmn.setAttribute('xmlns:bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI');
            // bpmn.setAttribute('xmlns:dc', 'http://www.omg.org/spec/DD/20100524/DC');
            // bpmn.setAttribute('xmlns:di', 'http://www.omg.org/spec/DD/20100524/DI');
            // bpmn.setAttribute('id', 'Definitions_1');
            // bpmn.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            // bpmn.setAttribute('exporter', 'Custom BPMN Modeler');
            // bpmn.setAttribute('exporterVersion', '1.0');

            // // 콜라보레이션 및 참가자 요소 생성
            // const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            // collaboration.setAttribute('id', 'Collaboration_1');
            // const participant = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            // participant.setAttribute('id', 'Participant_' + jsonProcess.processDefinitionId);
            // participant.setAttribute('name', jsonProcess.processDefinitionName);
            // participant.setAttribute('processRef', 'Process_' + jsonProcess.processDefinitionId);
            // collaboration.appendChild(participant);
            // bpmn.appendChild(collaboration);

            // // Process 요소 생성
            // const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            // process.setAttribute('id', jsonProcess.processDefinitionId); //.replace(/\s+/g, '_'));
            // process.setAttribute('isExecutable', 'true');

            // bpmn.appendChild(process);

            // // 레인셋 생성
            // const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
            // laneSet.setAttribute('id', 'LaneSet_' + jsonProcess.processDefinitionId);
            // process.appendChild(laneSet);

            // // 레인 생성 및 역할 할당
            // if (jsonProcess.roles)
            //     jsonProcess.roles.forEach((role) => {
            //         const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
            //         lane.setAttribute('id', 'Lane_' + role.name.replace(/\s+/g, '_'));
            //         lane.setAttribute('name', role.name);
            //         laneSet.appendChild(lane);

            //         // 해당 역할에 매핑된 활동들을 레인에 할당
            //         if (jsonProcess.activities)
            //             jsonProcess.activities.forEach((activity) => {
            //                 if (activity.role === role.name) {
            //                     const flowNodeRef = xmlDoc.createElementNS(
            //                         'http://www.omg.org/spec/BPMN/20100524/MODEL',
            //                         'bpmn:flowNodeRef'
            //                     );
            //                     flowNodeRef.textContent = activity.id;
            //                     lane.appendChild(flowNodeRef);
            //                 }
            //             });
            //     });

            // // 각 활동 (Activity) 요소 생성
            // if (jsonProcess.activities)
            //     jsonProcess.activities.forEach((activity) => {
            //         const task = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:userTask');
            //         task.setAttribute('id', activity.id);
            //         task.setAttribute('name', activity.name);
            //         process.appendChild(task);
            //     });

            // // 시퀀스 플로우 생성
            // if (jsonProcess.sequences)
            //     jsonProcess.sequences.forEach((sequence) => {
            //         const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
            //         sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
            //         sequenceFlow.setAttribute('sourceRef', sequence.source);
            //         sequenceFlow.setAttribute('targetRef', sequence.target);
            //         process.appendChild(sequenceFlow);
            //     });

            // //            bpmn.appendChild(process);

            // // BPMNDiagram 요소 추가
            // const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            // bpmnDiagram.setAttribute('id', 'BPMNDiagram_' + jsonProcess.processDefinitionId);
            // const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            // bpmnPlane.setAttribute('id', 'BPMNPlane_' + jsonProcess.processDefinitionId);
            // bpmnPlane.setAttribute('bpmnElement', collaboration.getAttribute('id'));
            // bpmnDiagram.appendChild(bpmnPlane);

            // // 레인의 시각적 표현 추가
            // if (jsonProcess.roles)
            //     jsonProcess.roles.forEach((role, index) => {
            //         const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //         laneShape.setAttribute('id', 'BPMNShape_Lane_' + role.name.replace(/\s+/g, '_'));
            //         laneShape.setAttribute('bpmnElement', 'Lane_' + role.name.replace(/\s+/g, '_'));

            //         const laneBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //         laneBounds.setAttribute('x', 100);
            //         laneBounds.setAttribute('y', 100 + index * 100);
            //         laneBounds.setAttribute('width', 600);
            //         laneBounds.setAttribute('height', 100);

            //         laneShape.appendChild(laneBounds);
            //         bpmnPlane.appendChild(laneShape);
            //     });

            // // 활동 및 시퀀스 플로우의 시각적 표현 추가
            // if (jsonProcess.activities)
            //     jsonProcess.activities.forEach((activity, index) => {
            //         const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //         shape.setAttribute('id', 'BPMNShape_' + activity.id);
            //         shape.setAttribute('bpmnElement', activity.id);

            //         const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //         bounds.setAttribute('x', 150 + index * 100); // 위치 예제
            //         bounds.setAttribute('y', 120 + index * 60); // 위치 예제
            //         bounds.setAttribute('width', 80);
            //         bounds.setAttribute('height', 60);

            //         shape.appendChild(bounds);
            //         bpmnPlane.appendChild(shape);
            //     });

            // if (jsonProcess.sequences)
            //     jsonProcess.sequences.forEach((sequence) => {
            //         const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            //         edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            //         edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            //         // Waypoint 예제 (실제 좌표는 활동의 위치에 따라 조정되어야 함)
            //         const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //         waypoint1.setAttribute('x', 200); // 예제 좌표
            //         waypoint1.setAttribute('y', 150); // 예제 좌표
            //         edge.appendChild(waypoint1);

            //         const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //         waypoint2.setAttribute('x', 300); // 예제 좌표
            //         waypoint2.setAttribute('y', 150); // 예제 좌표
            //         edge.appendChild(waypoint2);

            //         bpmnPlane.appendChild(edge);
            //     });

            // // // 시각적 요소 생성 (BPMNShape 및 BPMNEdge)
            // // if(jsonProcess.activities)
            // // jsonProcess.activities.forEach((activity, index) => {
            // //     const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            // //     shape.setAttribute('id', 'BPMNShape_' + activity.id);
            // //     shape.setAttribute('bpmnElement', activity.id);

            // //     const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            // //     bounds.setAttribute('x', 100 + (index * 150)); // 예제 위치
            // //     bounds.setAttribute('y', 100);
            // //     bounds.setAttribute('width', 100);
            // //     bounds.setAttribute('height', 80);

            // //     shape.appendChild(bounds);
            // //     bpmnPlane.appendChild(shape);
            // // });

            // // // 시퀀스 플로우 시각적 요소
            // // if(jsonProcess.sequences)
            // // jsonProcess.sequences.forEach(sequence => {
            // //     const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            // //     edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            // //     edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            // //     // 예제 waypoint
            // //     const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            // //     waypoint1.setAttribute('x', 150);
            // //     waypoint1.setAttribute('y', 140);

            // //     const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            // //     waypoint2.setAttribute('x', 250);
            // //     waypoint2.setAttribute('y', 140);

            // //     edge.appendChild(waypoint1);
            // //     edge.appendChild(waypoint2);

            // //     bpmnPlane.appendChild(edge);
            // // });

            // bpmn.appendChild(bpmnDiagram);

            // // XML 문자열로 변환
            // const serializer = new XMLSerializer();
            // const xmlString = serializer.serializeToString(xmlDoc);
            // return xmlString;
        },
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.loading = true;

                    const store = useBpmnStore();
                    let modeler = store.getModeler;
                    let xmlObj;
                    let retryCount = 0;
                    const maxRetries = 3;
                    const retryDelay = 1000; // 1초

                    async function saveXML() {
                        try {
                            const definitions = modeler.getDefinitions();
                            if (definitions) {
                                definitions.name = info.name || 'Default Name';
                            }
                            xmlObj = await modeler.saveXML({ format: true, preamble: true });
                            return true;
                        } catch (error) {
                            console.error('XML 저장 중 오류 발생:', error);
                            return false;
                        }
                    }

                    while (retryCount < maxRetries) {
                        if (await saveXML()) {
                            break;
                        } else {
                            retryCount++;
                            if (retryCount < maxRetries) {
                                console.log(`XML 저장 재시도 중... (${retryCount}/${maxRetries})`);
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                            } else {
                                console.error('최대 재시도 횟수 초과. XML 저장 실패.');
                                throw new Error('XML 저장 실패');
                            }
                        }
                    }

                    me.setDefinitionInfo(info.name, info.version)
                    let newProcessDefinition

                    // if (me.processDefinition) {
                    //     info.definition = me.processDefinition;
                    // }
                    if (xmlObj && xmlObj.xml && window.$mode == 'ProcessGPT') {
                        if (!window.$jms) {
                            let retryCount = 0;
                            while (retryCount < 10) {
                                modeler = store.getModeler;
                                xmlObj = await modeler.saveXML({ format: true, preamble: true });
                                newProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                                if (newProcessDefinition != null && (
                                    (newProcessDefinition.data && newProcessDefinition.data.length > 0) ||
                                    (newProcessDefinition.roles && newProcessDefinition.roles.length > 0) ||
                                    (newProcessDefinition.events && newProcessDefinition.events.length > 0) ||
                                    (newProcessDefinition.components && newProcessDefinition.components.length > 0) ||
                                    (newProcessDefinition.gateways && newProcessDefinition.gateways.length > 0) ||
                                    (newProcessDefinition.sequences && newProcessDefinition.sequences.length > 0)
                                )) {
                                    break;
                                }
                                retryCount++;
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } else {
                            newProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        }

                        if (!me.processDefinition) {
                            me.processDefinition = newProcessDefinition
                        } else {
                            if (me.processDefinition.roles) {
                                newProcessDefinition.roles = newProcessDefinition.roles.map(newRole => {
                                    const oldRole = me.processDefinition.roles.find(oldRole => oldRole.name === newRole.name);
                                    if (oldRole) {
                                        newRole.resolutionRule = oldRole.resolutionRule;
                                    }
                                    return newRole;
                                });
                            }
                            if (me.processDefinition.activities) {
                                newProcessDefinition.activities = newProcessDefinition.activities.map(activity => {
                                    const oldActivity = me.processDefinition.activities.find(oldActivity => oldActivity.id === activity.id);
                                    if (oldActivity) {
                                        activity.instruction = oldActivity.instruction;
                                        activity.checkpoints = oldActivity.checkpoints;
                                    }
                                    return activity;
                                });
                            }
                            me.processDefinition = newProcessDefinition
                        }

                        if (info.name && info.name != '') {
                            me.processDefinition.processDefinitionName = info.name;
                        }
                        info.definition = me.processDefinition;
                    }
                    
                    await me.saveModel(info, xmlObj.xml);
                    me.bpmn = xmlObj.xml;

                    let processInfo = {
                        bpmn: me.bpmn,
                        def: me.processDefinition
                    };
                    this.$emit("modelCreated", processInfo);

                    me.disableChat = true;
                    me.isViewMode = true;
                    me.lock = true; // 잠금처리 ( 수정 불가 )
                    me.definitionChangeCount++;

                    me.loading = false;
                    await me.toggleVersionDialog(false);
                },
                onFail: (e) => {
                    console.log(e);
                    me.loading = false;
                    me.isChanged = true;
                },
                successMsg: '저장되었습니다.'
            });
        },
        async convertXMLToJSON(xmlString) {
            try {
                if (!xmlString) return {};
                xmlString = xmlString.replace(/\$type/g, '_type'); //sanitizing for $type

                const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                const result = await parser.parseStringPromise(xmlString);
                var processDefinitionId = 'Unknown';
                if(this.fullPath) {
                    processDefinitionId = this.fullPath;
                } else {
                    processDefinitionId = this.$route.params.id;
                }

                function ensureArray(item) {
                    return Array.isArray(item) ? item : item ? [item] : [];
                }
                let processes =
                    result['bpmn:definitions'] && result['bpmn:definitions']['bpmn:process']
                        ? result['bpmn:definitions']['bpmn:process']
                        : {};
                if (!(processes instanceof Array)) {
                    processes = [processes];
                }
                let resultJsonData = null;

                let event = [];
                let lanes = [];
                let activities = [];
                let sequenceFlows = [];
                let gateways = [];
                let instanceNamePattern = null;

                const participants =
                    result['bpmn:definitions'] && result['bpmn:definitions']['bpmn:collaboration'] && result['bpmn:definitions']['bpmn:collaboration']['bpmn:participant']
                        ? result['bpmn:definitions']['bpmn:collaboration']['bpmn:participant']
                        : {};
                let data = [];
                for (let process of processes) {
                    Object.keys(process).forEach((key) => {
                        if (key.includes('Event')) {
                            let eventTmp = process[key];
                            if (eventTmp instanceof Array) {
                                eventTmp = eventTmp.map((obj) => ({ ...obj, type: key.replace('bpmn:', ''), process: process.id }));
                            } else {
                                eventTmp = { ...eventTmp, type: key.replace('bpmn:', ''), process: process.id };
                            }
                            event = event.concat(eventTmp);
                        } else if (key.includes('Task')) {
                            let activityTmp = process[key];
                            if (activityTmp instanceof Array) {
                                activityTmp = activityTmp.map((obj) => ({ ...obj, type: key.replace('bpmn:', ''), process: process.id }));
                            } else {
                                activityTmp = { ...activityTmp, type: key.replace('bpmn:', ''), process: process.id };
                            }
                            activities = activities.concat(activityTmp);
                        } else if (key.includes('Gateway')) {
                            let gatewayTmp = process[key];
                            if (gatewayTmp instanceof Array) {
                                gatewayTmp = gatewayTmp.map((obj) => ({ ...obj, type: key.replace('bpmn:', ''), process: process.id }));
                            } else {
                                gatewayTmp = { ...gatewayTmp, type: key.replace('bpmn:', ''), process: process.id };
                            }
                            gateways = gateways.concat(gatewayTmp);
                        }
                    });

                    let lanesTmp = ensureArray(process['bpmn:laneSet'] ? process['bpmn:laneSet']['bpmn:lane'] : []);
                    lanesTmp = lanesTmp.map((obj) => ({ ...obj, process: process.id }));
                    lanes = lanes.concat(lanesTmp);
                    let sequenceFlowsTmp = ensureArray(process['bpmn:sequenceFlow'] || []);
                    sequenceFlows = sequenceFlows.concat(sequenceFlowsTmp);
                    let dataTmp =
                        process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'] && process['bpmn:extensionElements']['uengine:properties']['uengine:variable']
                            ? (Array.isArray(process['bpmn:extensionElements']['uengine:properties']['uengine:variable'])
                                  ? process['bpmn:extensionElements']['uengine:properties']['uengine:variable']
                                  : [process['bpmn:extensionElements']['uengine:properties']['uengine:variable']]
                              ).map((varData) => ({
                                  name: varData.name,
                                  description: varData.name + ' description',
                                  type: varData.type
                              }))
                            : [];
                    data = data.concat(dataTmp);
                    instanceNamePattern = process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'] && process['bpmn:extensionElements']['uengine:properties']['uengine:json'] ? JSON.parse(process['bpmn:extensionElements']['uengine:properties']['uengine:json']).instanceNamePattern : null;
                }

                const jsonData = {
                    processDefinitionName: processDefinitionId,
                    processDefinitionId: processDefinitionId,
                    description: 'process.description',
                    data: data,
                    roles: lanes.map((lane) => ({
                        name: lane.name,
                        resolutionRule: lane.name === 'applicant' ? 'initiator' : 'system',
                        process: lane.process
                    })),
                    events: [
                        ...event.map((event) => {
                            let isProperties = event['bpmn:extensionElements'] && event['bpmn:extensionElements']['uengine:properties'];
                            let definitionType = Object.keys(event).filter((key) => key.includes('Definition'));
                            return {
                                name: event.name,
                                id: event.id,
                                type: event.type,
                                description: 'start event',
                                role: lanes[0] ? lanes[0].name : 'Unknown',
                                process: event.process,
                                definitionType: definitionType ? definitionType[0] : null,
                                properties: isProperties ? event['bpmn:extensionElements']['uengine:properties']['uengine:json'] : '{}'
                            };
                        })
                    ],
                    activities: [
                        ...activities.map((activity) => {
                            try {
                                let task = {};
                                task.name = activity.name;
                                task.id = activity.id;
                                task.type = activity.type;
                                task.description = `${activity.name} description`;
                                task.instruction = `${activity.name} instruction`;
                                task.process = activity.process;
                                task.role = lanes.find((lane) => {
                                    const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef'])
                                        ? lane['bpmn:flowNodeRef']
                                        : [lane['bpmn:flowNodeRef']];
                                    return flowNodeRefs.includes(activity.id);
                                })
                                    ? lanes.find((lane) => {
                                          const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef'])
                                              ? lane['bpmn:flowNodeRef']
                                              : [lane['bpmn:flowNodeRef']];
                                          return flowNodeRefs.includes(activity.id);
                                      }).name
                                    : 'Unknown';

                                let isProperties =
                                    activity['bpmn:extensionElements'] && activity['bpmn:extensionElements']['uengine:properties'];

                                if (isProperties) {
                                    let parseProperties = JSON.parse(
                                        activity['bpmn:extensionElements']['uengine:properties']['uengine:json']
                                    );
                                    task.inputData =
                                        parseProperties && parseProperties.parameters
                                            ? parseProperties.parameters
                                                  .filter((param) => param.direction === 'IN')
                                                  .map((param) => param.variable.name)
                                            : [];
                                    task.outputData =
                                        parseProperties && parseProperties.parameters
                                            ? parseProperties.parameters
                                                  .filter((param) => param.direction === 'OUT')
                                                  .map((param) => param.variable.name)
                                            : [];
                                    task.properties = activity['bpmn:extensionElements']['uengine:properties']['uengine:json'];
                                    task.duration = activity['bpmn:extensionElements']['uengine:properties']['uengine:json'].duration ? activity['bpmn:extensionElements']['uengine:properties']['uengine:json'].duration : 5;
                                } else {
                                    task.inputData = [];
                                    task.outputData = [];
                                }
                                const form = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json']);
                                if (form && form.variableForHtmlFormContext && form.variableForHtmlFormContext.name) {
                                    task.tool = 'formHandler:' + form.variableForHtmlFormContext.name;
                                } else {
                                    task.tool = '';
                                }
                                return task;
                            } catch (e) {
                                console.log(e);
                            }
                        })
                    ],
                    gateways: [
                        ...gateways.map((gateway) => ({
                            id: gateway.id || 'Gateway',
                            name: gateway.name || 'Gateway',
                            type: gateway.type,
                            description: gateway.name + ' description',
                            process: gateway.process,
                            role: lanes.find((lane) => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef'])
                                    ? lane['bpmn:flowNodeRef']
                                    : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(gateway.id);
                            })
                                ? lanes.find((lane) => {
                                      const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef'])
                                          ? lane['bpmn:flowNodeRef']
                                          : [lane['bpmn:flowNodeRef']];
                                      return flowNodeRefs.includes(gateway.id);
                                  }).name
                                : 'Unknown',
                            condition:
                                gateway['bpmn:extensionElements'] && gateway['bpmn:extensionElements']['uengine:properties']
                                    ? JSON.parse(gateway['bpmn:extensionElements']['uengine:properties']['uengine:json']).condition || ''
                                    : '',
                            properties: gateway['bpmn:extensionElements'] && gateway['bpmn:extensionElements']['uengine:properties'] && gateway['bpmn:extensionElements']['uengine:properties']['uengine:json'] ? gateway['bpmn:extensionElements']['uengine:properties']['uengine:json'] : '{}'
                        }))
                    ],
                    sequences: sequenceFlows.map((flow) => ({
                        id: flow.id,
                        source: flow.sourceRef,
                        target: flow.targetRef,
                        condition:
                            flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties']
                                ? JSON.parse(flow['bpmn:extensionElements']['uengine:properties']['uengine:json']).condition || ''
                                : '',
                        properties:
                            flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties']
                                ? flow['bpmn:extensionElements']['uengine:properties']['uengine:json'] || '{}'
                                : '{}'
                    })),
                    participants: participants,
                    instanceNamePattern: instanceNamePattern
                };
                resultJsonData = jsonData;
                return resultJsonData;
            } catch (error) {
                console.error('Error parsing XML:', error);
                throw error;
            }
        },
        // convertXMLToJSON(xmlString) {
        //     const parser = new DOMParser();
        //     const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        //     // Lanes (Roles) 추출
        //     const lanes = xmlDoc.getElementsByTagName('bpmn:lane');
        //     const laneMap = Array.from(lanes).reduce((acc, lane) => {
        //         const laneName = lane.getAttribute('name');
        //         const flowNodeRefs = lane.getElementsByTagName('bpmn:flowNodeRef');
        //         Array.from(flowNodeRefs).forEach((flowNodeRef) => {
        //             const activityId = flowNodeRef.textContent;
        //             acc[activityId] = laneName; // Map activity ID to lane (role) name
        //         });
        //         return acc;
        //     }, {});

        //     // User Tasks 추출
        //     const userTasks = xmlDoc.getElementsByTagName('bpmn:userTask');
        //     const activities = Array.from(userTasks).map((task) => {
        //         const id = task.getAttribute('id');
        //         return {
        //             name: task.getAttribute('name'),
        //             id: id,
        //             type: 'UserActivity',
        //             description: '', // XML에서 제공되지 않음
        //             instruction: '', // XML에서 제공되지 않음
        //             role: laneMap[id] || '', // LaneMap에서 Role 할당
        //             inputData: [], // XML에서 제공되지 않음
        //             outputData: [], // XML에서 제공되지 않음
        //             checkpoints: [] // XML에서 제공되지 않음
        //         };
        //     });

        //     // Sequence Flows 추출
        //     const sequenceFlows = xmlDoc.getElementsByTagName('bpmn:sequenceFlow');
        //     const sequences = Array.from(sequenceFlows)
        //         .map((flow) => {
        //             if (flow.getAttribute('sourceRef') != 'StartEvent_1' && flow.getAttribute('targetRef') != 'EndEvent')
        //                 return {
        //                     source: flow.getAttribute('sourceRef'),
        //                     target: flow.getAttribute('targetRef')
        //                 };
        //         })
        //         .filter((flow) => flow);

        //     // activities 배열을 sequenceFlow의 순서에 따라 정렬
        //     // const orderedActivities = [];
        //     // let currentId = xmlDoc.getElementsByTagName("bpmn:startEvent")[0].getAttribute("id");
        //     // while (sequences.length > 0) {
        //     //     const currentIndex = sequences.findIndex(seq => seq.source === currentId);
        //     //     if (currentIndex === -1) break;

        //     //     const currentSequence = sequences.splice(currentIndex, 1)[0];
        //     //     const activityIndex = activities.findIndex(act => act.id === currentSequence.target);
        //     //     if (activityIndex !== -1) {
        //     //         orderedActivities.push(activities[activityIndex]);
        //     //     }
        //     //     currentId = currentSequence.target;
        //     // }
        //     let orderedActivities = this.orderActivitiesBySequence(activities, sequences);

        //     return { activities: orderedActivities, sequences };
        // },
        // orderActivitiesBySequence(activities, sequences) {
        //     // 시작 활동 찾기: 'source'가 되지만 'target'이 되지 않는 항목
        //     const orderedActivities = []
        //     let currentId = sequences.find((seq) => !sequences.some((innerSeq) => innerSeq.target === seq.source))?.source;
        //     let startActivity = activities.findIndex((act) => act.id === currentId);
        //     if (startActivity !== -1) {
        //         orderedActivities.push(activities[startActivity]);
        //     }
        //     const visitedSequences = new Set(); // 중복 방문 방지
        //     // orderedActivities.push(ac)
        //     while (currentId && sequences.length > visitedSequences.size) {
        //         const sequence = sequences.find((seq) => seq.source === currentId && !visitedSequences.has(seq.source + seq.target));
        //         if (!sequence) break; // 다음 시퀀스를 찾을 수 없으면 중단

        //         visitedSequences.add(sequence.source + sequence.target); // 시퀀스 방문 기록
        //         const activityIndex = activities.findIndex((act) => act.id === sequence.target);
        //         if (activityIndex !== -1) {
        //             orderedActivities.push(activities[activityIndex]);
        //         }
        //         currentId = sequence.target; // 다음 대상으로 이동
        //     }

        //     return orderedActivities;
        // },
        // convertToProcessDefinition(jsonInput) {
        //     const processDefinition = {
        //         processDefinitionName: jsonInput.name,
        //         processDefinitionId: jsonInput.definitionId,
        //         description: '', // Assuming a generic description; update as needed
        //         data: jsonInput.processVariableDescriptors.map((variable) => ({
        //             name: variable.name,
        //             description: variable.displayName.text,
        //             type: 'Text' // Assuming all variables are of type Text; update logic as needed for different types
        //         })),
        //         roles: Object.values(jsonInput.elements)
        //             .filter((element) => element != null)
        //             .filter((element) => element._type == 'org.uengine.kernel.Role')
        //             .map((role) => ({
        //                 name: role.name,
        //                 resolutionRule: role.roleResolutionContext.endpoint
        //             })),
        //         activities: Object.values(jsonInput.elements)
        //             .filter((element) => element != null)
        //             .filter((element) => element._type == 'org.uengine.kernel.HumanActivity')
        //             .map((activity) => ({
        //                 name: activity.name || activity.oldName,
        //                 id: activity.elementView.id,
        //                 type: 'UserActivity', // Assuming UserActivity; update as needed for different activity types
        //                 description: activity.name + ' 활동', // Assuming a generic description; update as needed
        //                 instruction: '장애 정보를 기반으로 문제를 해결하세요.', // Assuming a generic instruction; update as needed
        //                 role: activity.role.name,
        //                 inputData: activity.parameters?.map((param) => ({
        //                     name: param.variable.name
        //                 })),
        //                 outputData: activity.parameters?.map((param) => ({
        //                     name: param.variable.name
        //                 })),
        //                 checkpoints: [] // Assuming no checkpoints; update as needed
        //             })),
        //         sequences: Object.values(jsonInput.relations)
        //             .filter((relation) => relation != null)
        //             .filter((relation) => relation._type == 'org.uengine.kernel.bpmn.SequenceFlow')
        //             .map((sequence) => ({
        //                 source: sequence.from,
        //                 target: sequence.to
        //             }))
        //     };

        //     return processDefinition;
        // },
        setDefinitionInfo(name, version) {
            
            const store = useBpmnStore();
            let modeler = store.getModeler;
            const definitions = modeler.getDefinitions();

            let bpmnFactory;
            try {
                bpmnFactory = modeler.get('bpmnFactory');
            } catch (error) {
                console.warn('bpmnFactory not available:', error);
                return;
            }

            const processElement = definitions.rootElements.find((element) => element.$type === 'bpmn:Process');
            if (!processElement) {
                console.error('bpmn:Process element not found');
                return;
            }

            // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
            let extensionElements = processElement.extensionElements;
            if (!extensionElements) {
                extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
                processElement.extensionElements = extensionElements;
            }

            // // uengine:properties 요소를 찾거나 새로 생성합니다.
            let uengineProperties;
            if (extensionElements.values) {
                uengineProperties = extensionElements.values.find((val) => val.$type === 'uengine:Properties');
            }

            if (!uengineProperties) {
                uengineProperties = bpmnFactory.create('uengine:Properties');
                extensionElements.get('values').push(uengineProperties);
            }

            let processJson;
            if (uengineProperties.json) {
                processJson = JSON.parse(uengineProperties.json);    
            } else {
                processJson = {};
            }
            processJson.definitionName = name;
            processJson.version = version

            uengineProperties.json = JSON.stringify(processJson)
            // processJson.instanceNamePattern ? processJson.instanceNamePattern : '';

            
        },
        async saveModel(info, xml) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (window.$mode == 'uEngine') {
                        // uEngine
                        console.log(info)
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                        if(info.release) {
                            await backend.releaseVersion(info.releaseName);
                        }
                    } else {
                        // GPT
                        if (!me.processDefinition) me.processDefinition = {};
                        if (!me.processDefinition.processDefinitionId) me.processDefinition.processDefinitionId = null;
                        if (!me.processDefinition.processDefinitionName) me.processDefinition.processDefinitionName = null;

                        me.processDefinition.processDefinitionId = info.proc_def_id
                            ? info.proc_def_id
                            : prompt('please give a ID for the process definition');

                        if (!me.processDefinition.processDefinitionName && info.name) {
                            me.processDefinition.processDefinitionName = info.name;
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

                    if(!this.isConsultingMode){
                        await backend.putProcessDefinitionMap(me.processDefinitionMap);
                    }

                    // 새 탭으로 열린 프로세스 편집창
                    if (me.$route.query && me.$route.query.modeling) {
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
                    console.log(e);
                }
            });
        }
    }
};
</script>

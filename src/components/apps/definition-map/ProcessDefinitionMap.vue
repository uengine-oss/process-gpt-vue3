<template>
    <div>
        <v-card v-if="!isViewProcess" elevation="10" style="height:calc(100vh - 155px);">
            <div class="pt-5 pl-6 pr-6 d-flex align-center">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <div class="ml-auto">
                    <ProcessMenu :size="24" :type="'map'" @add="addProcess" />
                </div>
            </div>
            <div class="pa-5">
                <v-row>
                    <v-col v-for="item in value.mega_proc_list" :key="item.id" cols="12" md="2" sm="6">
                        <MegaProcess :value="item" :parent="value" :storage="storage" @view="viewProcess" />
                    </v-col>
                </v-row>
            </div>
        </v-card>
        <v-card v-else elevation="10">
            <div class="pt-5 pl-6 pr-6 d-flex align-center">
                <div class="d-flex align-center">
                    <h6 class="text-h6 font-weight-semibold">{{ selectedProc.mega.label }}</h6>
                    <v-icon>mdi-chevron-right</v-icon>
                </div>
                <div class="d-flex align-center">
                    <h6 class="text-h6 font-weight-semibold">{{ selectedProc.major.label }}</h6>
                    <div>
                        <v-icon class="cursor-pointer">mdi-chevron-right</v-icon>
                        <v-menu activator="parent">
                            <v-list v-if="selectedProc.major.sub_proc_list" density="compact" class="cursor-pointer">
                                <v-list-item v-for="sub in selectedProc.major.sub_proc_list" :key="sub.id">
                                    <v-list-item-title @click="viewProcess(sub)">
                                        {{ sub.label }}
                                    </v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </div>
                </div>
                <div class="d-flex align-center" @click="updateBpmn(processDefinition.bpmn); subProcessBreadCrumb = []">
                    <h6 class="text-h6 font-weight-semibold">
                        {{ processDefinition.name ? processDefinition.name : processDefinition.label }}
                    </h6>
                </div>

                <div v-for="(subProcess, idx) in subProcessBreadCrumb" :key="idx">
                    <div class="d-flex align-center">
                        <v-icon>mdi-chevron-right</v-icon>
                        <h6 class="text-h6 font-weight-semibold">
                            {{ subProcess.processName }}
                        </h6>
                    </div>
                </div>

                <div class="ml-auto">
                    <v-btn icon variant="text" width="24" height="24" @click="closeProcess">
                        <v-icon size="24">mdi-arrow-left</v-icon>
                    </v-btn>
                </div>
            </div>
            <v-card-text style="width: 100%;">
                <ProcessDefinition v-if="onLoad && bpmn" style="width: 100%; height: 100%;" :bpmn="bpmn" :key="defCnt"
                    v-on:openSubProcess="ele => openSubProcess(ele)" :processDefinition="processDefinition.definition"
                    :isViewMode="true"></ProcessDefinition>
                <div v-else-if="onLoad && !bpmn" style="height: 100%; text-align: center">
                    <h6 class="text-h6">정의된 프로세스 모델이 없습니다.</h6>
                    <v-btn color="primary" variant="flat" class="mt-4" @click="editProcessModel">
                        프로세스 편집
                    </v-btn>
                </div>
                <div v-else style="height: 100%; text-align: center">
                    <v-progress-circular style="top: 50%" indeterminate color="primary"></v-progress-circular>
                </div>
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import MegaProcess from './MegaProcess.vue';
import ProcessMenu from './ProcessMenu.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

const storageKey = 'configuration'

export default {
    components: {
        ProcessMenu,
        MegaProcess,
        ProcessDefinition
    },
    data: () => ({
        storage: null,
        value: {
            mega_proc_list: []
        },
        // process
        isViewProcess: false,
        onLoad: false,
        bpmn: null,
        processDefinition: null,
        selectedProc: null,
        selectedSubProcess: null,
        subProcessBreadCrumb: [],
        defCnt: 0
    }),
    watch: {
        //TODO: 변경 후 즉시 저장하면 안됩니다. 검토 완료 후 저장되어야 해서 저장 버튼으로 대체
        value: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.saveProcess()
                }
            }
        }
    },
    created() {
        this.storage = StorageBaseFactory.getStorage();
        this.getProcessMap();
    },
    methods: {
        updateBpmn(bpmn) {
            this.bpmn = bpmn
            this.defCnt++
        },
        async openSubProcess(e) {
            let me = this;
            if (e.extensionElements?.values[0]?.definition) {
                console.log(e.extensionElements.values[0].definition)
                const defInfo = await this.storage.getObject(`proc_def/${e.extensionElements.values[0].definition}`, { key: "name" });
                if (defInfo) {
                    let obj = { processName: e.extensionElements.values[0].definition, xml: defInfo.bpmn }
                    me.subProcessBreadCrumb.push(obj)
                    me.selectedSubProcess = e.extensionElements.values[0].definition
                    me.updateBpmn(defInfo.bpmn)
                }
            }
        },
        async getProcessMap() {
            const procMap = await this.storage.getObject(storageKey + '/proc_map', { key: 'key' });
            if (procMap && procMap.value) {
                this.value = procMap.value;
            }
        },
        addProcess(newProcess) {
            var newMegaProc = {
                id: newProcess.id,
                label: newProcess.label,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
        },
        async saveProcess() {
            const putObj = {
                key: 'proc_map',
                value: this.value
            }
            await this.storage.putObject(storageKey, putObj);
        },
        async viewProcess(obj) {
            const def_id = obj.id;
            this.onLoad = false;
            this.selectedProc = {
                mega: null,
                major: null,
            }

            this.value.mega_proc_list.forEach(mega => {
                mega.major_proc_list.forEach(major => {
                    major.sub_proc_list.forEach(sub => {
                        if (sub.id == def_id) {
                            this.selectedProc.mega = mega;
                            this.selectedProc.major = major;
                        }
                    })
                })
            })

            const defInfo = await this.storage.getObject(`proc_def/${def_id}`, { key: "id" });
            if (defInfo) {
                this.processDefinition = defInfo;
                let definition = defInfo.definition;
                this.bpmn = defInfo.bpmn
                this.onLoad = true;
                this.isViewProcess = true;
            } else {
                this.processDefinition = obj;
                this.bpmn = null;
                this.onLoad = true;
                this.isViewProcess = true;
            }
        },
        closeProcess() {
            this.isViewProcess = false;
            this.bpmn = null;
            this.processDefinition = null;
            this.selectedProc = null;
        },
        editProcessModel() {
            if (this.processDefinition && this.processDefinition.id) {
                this.$router.push(`/definitions/chat?id=${this.processDefinition.id}&name=${this.processDefinition.label}`);
            }
        },
        taskMapping(activity) {
            switch (activity) {
                case "ScriptActivity":
                    return 'bpmn:scriptTask';
                case "EmailActivity":
                    return 'bpmn:sendTask';
                default:
                    return 'bpmn:userTask';
            }
        },
        createBpmnXml(jsonModel) {
            // XML 문서 초기화
            let me = this;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine"></bpmn:definitions>', 'application/xml');
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



            // Lane 및 Activity 매핑
            const laneActivityMapping = {};
            if (jsonModel.activities)
                jsonModel.activities.forEach(activity => {
                    if (!laneActivityMapping[activity?.role]) {
                        laneActivityMapping[activity?.role] = [];
                    }
                    laneActivityMapping[activity.role].push(activity.id);
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
                        laneActivityMapping[role.name].forEach(activityId => {
                            const flowNodeRef = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:flowNodeRef');
                            flowNodeRef.textContent = activityId;
                            lane.appendChild(flowNodeRef);
                        });
                    }
                });
            }

            let inComing = {}
            let outGoing = {}
            // Sequences 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach(sequence => {
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('name', sequence.name ? sequence.name : "")
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    let param = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    // let role = xmlDoc.createElementNS('http://uengine', 'uengine:role');
                    // let desc = xmlDoc.createElementNS('http://uengine', 'uengine:description');
                    // let checkpoints = xmlDoc.createElementNS('http://uengine', 'uengine:checkpoint');
                    //             <uengine:description>asdf</uengine:description>
                    //   <uengine:checkpoint>
                    //     <uengine:checkpoint>asdf</uengine:checkpoint>
                    //   </uengine:checkpoint>
                    param.setAttribute('key', "condition")
                    param.textContent = sequence.condition ? sequence.condition : ""
                    params.appendChild(param)
                    // }
                    root.appendChild(params)
                    extensionElements.appendChild(root)
                    sequenceFlow.appendChild(extensionElements)
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                });

            // Activities 생성
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity, idx) => {

                    const userTaskType = me.taskMapping(activity.type)

                    const userTask = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', userTaskType);
                    userTask.setAttribute('id', activity.id);
                    userTask.setAttribute('name', activity.name);
                    // let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:description');
                    if (outGoing[activity.id]) {
                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                        outGoingSeq.textContent = outGoing[activity.id]
                        userTask.appendChild(outGoingSeq)
                    }
                    if (inComing[activity.id]) {
                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                        inComingSeq.textContent = inComing[activity.id]
                        userTask.appendChild(inComingSeq)
                    }
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    // let role = xmlDoc.createElementNS('http://uengine', 'uengine:role');
                    // role.textContent = activity.role
                    // root.appendChild(role)
                    // let desc = xmlDoc.createElementNS('http://uengine', 'uengine:description');
                    // desc.textContent = activity.description
                    // root.appendChild(desc)
                    // let checkpoints = xmlDoc.createElementNS('http://uengine', 'uengine:checkpoint');
                    // let pythonCode = xmlDoc.createElementNS('http://uengine', 'uengine:pythonCode');
                    // pythonCode.textContent = "";
                    // root.appendChild(pythonCode)
                    // // let checkpoints = xmlDoc.createElementNS('http://uengine', 'uengine:checkpoints');
                    // if (activity.checkpoints) {
                    //     activity.checkpoints.forEach((checkpoint) => {
                    //         console.log(checkpoint)
                    //         let check = xmlDoc.createElementNS('http://uengine', 'uengine:checkpoint');
                    //         check.textContent = checkpoint
                    //         checkpoints.appendChild(check)
                    //     })
                    // }
                    // root.appendChild(checkpoints)
                    // let params = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                    // if (activity.inputData) {
                    //     activity.inputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "input")
                    //         params.appendChild(param)
                    //     })

                    //     // userTask.appendChild(extensionElements)
                    // }
                    // if (activity.outputData) {
                    //     activity.outputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "output")
                    //         params.appendChild(param)
                    //     })
                    //     root.appendChild(params)
                    //     extensionElements.appendChild(root)
                    // }
                    // root.appendChild(params)
                    extensionElements.appendChild(root)
                    userTask.appendChild(extensionElements)

                    if (idx == 0) {
                        // 시작일땐 StartEvent와 연결
                        const startEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:startEvent');
                        startEvent.setAttribute('id', 'StartEvent_1');
                        startEvent.setAttribute('name', 'StartEvent');
                        process.appendChild(startEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + 'StartEvent' + '_' + activity.id);
                        sequenceFlow.setAttribute('name', "")
                        sequenceFlow.setAttribute('sourceRef', 'StartEvent_1');
                        sequenceFlow.setAttribute('targetRef', activity.id);
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        conditionParam.setAttribute('key', "condition")
                        conditionParam.textContent = ""
                        conditionParams.appendChild(conditionParam)
                        root.appendChild(conditionParams)
                        extensionElements.appendChild(root)
                        sequenceFlow.appendChild(extensionElements)
                        process.appendChild(sequenceFlow);

                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                        inComingSeq.textContent = 'SequenceFlow_' + 'StartEvent' + '_' + activity.id
                        userTask.appendChild(inComingSeq)
                    } else if (idx == jsonModel.activities.length - 1) {
                        // 마지막엔 EndEvent와 연결
                        // EndEvent 요소 추가
                        const endEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:endEvent');
                        endEvent.setAttribute('id', 'EndEvent');
                        endEvent.setAttribute('name', 'EndEvent');
                        process.appendChild(endEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + activity.id + '_' + 'EndEvent');
                        sequenceFlow.setAttribute('name', "")
                        sequenceFlow.setAttribute('sourceRef', activity.id);
                        sequenceFlow.setAttribute('targetRef', 'EndEvent');
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        conditionParam.setAttribute('key', "condition")
                        conditionParam.textContent = ""
                        conditionParams.appendChild(conditionParam)
                        root.appendChild(conditionParams)
                        extensionElements.appendChild(root)
                        sequenceFlow.appendChild(extensionElements)
                        process.appendChild(sequenceFlow);

                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                        outGoingSeq.textContent = 'SequenceFlow_' + activity.id + '_' + 'EndEvent'
                        userTask.appendChild(outGoingSeq)
                    }
                    process.appendChild(userTask);
                });


            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_1');
            bpmnDefinitions.appendChild(bpmnDiagram);

            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_1');
            bpmnPlane.setAttribute('bpmnElement', 'Collaboration_1');
            bpmnDiagram.appendChild(bpmnPlane);
            let participantHeight = jsonModel?.roles.length > 0 ? jsonModel?.roles.length * 100 : 100
            const participantShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            participantShape.setAttribute('id', 'Participant_1');
            participantShape.setAttribute('bpmnElement', 'Participant');
            const dcBoundsParticipant = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            dcBoundsParticipant.setAttribute('x', '70');
            dcBoundsParticipant.setAttribute('y', `100`);
            dcBoundsParticipant.setAttribute('width', '830');
            dcBoundsParticipant.setAttribute('height', participantHeight);
            participantShape.appendChild(dcBoundsParticipant)
            bpmnPlane.appendChild(participantShape)
            // if (jsonModel.roles) {

            // }

            //         <bpmndi:BPMNShape id="Participant_0r9od0v_di" bpmnElement="Participant_0r9od0v" isHorizontal="true">
            //     <dc:Bounds x="156" y="62" width="600" height="250" />
            //   </bpmndi:BPMNShape>
            let rolePos = {}
            let activityPos = {};

            // Lane 및 Activity에 대한 시각적 표현 추가
            if (jsonModel.roles)
                jsonModel.roles.forEach((role, roleIndex) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', `BPMNShape_${roleIndex}`);
                    laneShape.setAttribute('bpmnElement', `Lane_${roleIndex}`);
                    laneShape.setAttribute('isHorizontal', true)
                    const dcBoundsLane = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLane.setAttribute('x', '100');
                    dcBoundsLane.setAttribute('y', `${100 + roleIndex * 100}`);
                    dcBoundsLane.setAttribute('width', '800');
                    dcBoundsLane.setAttribute('height', '100');
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    }
                });
            let lastXPos = 140;

            if (jsonModel.activities) {
                const firstActivity = jsonModel.activities[0];
                const lastActivity = jsonModel.activities[jsonModel.activities.length - 1];
                jsonModel.activities.forEach((activity, activityIndex) => {
                    if (!activity.role) {
                        return false;
                    }
                    if (activityIndex == 0 && firstActivity.role) {
                        // StartEvent의 BPMNShape 추가
                        let eventY = parseInt(rolePos[firstActivity.role].y) + 32
                        const startEventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                        startEventShape.setAttribute('id', `StartEvent_di`);
                        startEventShape.setAttribute('bpmnElement', `StartEvent_1`);
                        const startEventBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        startEventBounds.setAttribute('x', lastXPos);
                        startEventBounds.setAttribute('y', eventY);
                        startEventBounds.setAttribute('width', 36);
                        startEventBounds.setAttribute('height', 36);
                        startEventShape.appendChild(startEventBounds);
                        bpmnPlane.appendChild(startEventShape);
                        activityPos['startEvent'] = {
                            x: lastXPos,
                            y: eventY,
                            width: 36,
                            height: 36
                        }
                        lastXPos = lastXPos
                        lastXPos += 120
                    }
                    let activityY = parseInt(rolePos[activity.role].y)
                    const activityShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    activityShape.setAttribute('id', `BPMNShape_${activity.id}`);
                    activityShape.setAttribute('bpmnElement', activity.id);

                    const dcBoundsActivity = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsActivity.setAttribute('x', lastXPos);
                    dcBoundsActivity.setAttribute('y', activityY + 10);
                    dcBoundsActivity.setAttribute('width', 100);
                    dcBoundsActivity.setAttribute('height', 80);
                    activityPos[activity.id] = {
                        x: lastXPos,
                        y: activityY + 10,
                        width: 100,
                        height: 80
                    }
                    // if (!activity.pos)
                    //     activity.pos = {}
                    // activity.pos.x = lastXPos
                    // activity.pos.y =  activityY + 20
                    // activity.pos.width = 80
                    // activity.pos.height = 60

                    activityShape.appendChild(dcBoundsActivity);
                    bpmnPlane.appendChild(activityShape);
                    lastXPos = lastXPos
                    lastXPos += 120

                    if (activityIndex == jsonModel.activities.length - 1 && lastActivity.role) {
                        // EndEvent의 BPMNShape 추가
                        let eventY = parseInt(rolePos[lastActivity.role].y) + 32
                        const endEventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                        endEventShape.setAttribute('id', `EndEvent_di`);
                        endEventShape.setAttribute('bpmnElement', `EndEvent`);
                        const endEventBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        // endEventBounds.setAttribute('x', '100'); // 위치는 예시이며, 실제 모델에 따라 조정 필요
                        // endEventBounds.setAttribute('y', '218');
                        endEventBounds.setAttribute('x', lastXPos);
                        endEventBounds.setAttribute('y', eventY);
                        endEventBounds.setAttribute('width', 36);
                        endEventBounds.setAttribute('height', 36);
                        endEventShape.appendChild(endEventBounds);
                        bpmnPlane.appendChild(endEventShape);

                        // 마지막엔 Event들 Sequence 생성
                        // Start Event
                        const startBpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                        startBpmnEdge.setAttribute('id', `BPMNEdge_StartEvent_${firstActivity.id}`);
                        startBpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + 'StartEvent' + '_' + firstActivity.id);
                        const startWaypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // let startX, startY, endX, endY;

                        startWaypoint1.setAttribute('x', parseInt(activityPos['startEvent']?.x) + parseInt(activityPos['startEvent']?.width));
                        startWaypoint1.setAttribute('y', parseInt(activityPos['startEvent']?.y) + (parseInt(activityPos['startEvent']?.height) / 2));
                        startBpmnEdge.appendChild(startWaypoint1);
                        const startWaypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');

                        startWaypoint2.setAttribute('x', parseInt(activityPos[firstActivity.id]?.x));
                        startWaypoint2.setAttribute('y', parseInt(activityPos[firstActivity.id]?.y) + (parseInt(activityPos[firstActivity.id]?.height) / 2));
                        startBpmnEdge.appendChild(startWaypoint2);

                        const endBpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                        endBpmnEdge.setAttribute('id', `BPMNEdge_${lastActivity.id}_EndEvent`);
                        endBpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + lastActivity.id + '_' + 'EndEvent');
                        const endWaypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // startX = 
                        // startY = 
                        endWaypoint1.setAttribute('x', parseInt(activityPos[lastActivity.id]?.x) + parseInt(activityPos[lastActivity.id]?.width));
                        endWaypoint1.setAttribute('y', parseInt(activityPos[lastActivity.id]?.y) + (parseInt(activityPos[lastActivity.id]?.height) / 2));
                        endBpmnEdge.appendChild(endWaypoint1);
                        const endWaypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // endX = parseInt(activityPos['endEvent'].x)
                        // endY = parseInt(activityPos[sequence.target].y) + (parseInt(activityPos[sequence.target].height) / 2)
                        endWaypoint2.setAttribute('x', lastXPos);
                        endWaypoint2.setAttribute('y', eventY + 18);
                        endBpmnEdge.appendChild(endWaypoint2);
                        bpmnPlane.appendChild(startBpmnEdge);
                        bpmnPlane.appendChild(endBpmnEdge);
                    }
                });
            }

            if (jsonModel.sequences)
                jsonModel.sequences.forEach(sequence => {
                    if (!activityPos[sequence.source] || !activityPos[sequence.target]) {
                        return false;
                    }
                    const bpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    bpmnEdge.setAttribute('id', `BPMNEdge_${sequence.source}_${sequence.target}`);
                    bpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    // 예시로, 시작점과 끝점만 정의합니다. 실제 좌표는 모델에 따라 달라집니다.
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    // activity
                    let startX, startY, endX, endY;
                    startX = parseInt(activityPos[sequence.source].x) + parseInt(activityPos[sequence.source].width)
                    startY = parseInt(activityPos[sequence.source].y) + (parseInt(activityPos[sequence.source].height) / 2)
                    waypoint1.setAttribute('x', startX);
                    waypoint1.setAttribute('y', startY);
                    bpmnEdge.appendChild(waypoint1);

                    const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    endX = parseInt(activityPos[sequence.target].x)
                    endY = parseInt(activityPos[sequence.target].y) + (parseInt(activityPos[sequence.target].height) / 2)
                    waypoint2.setAttribute('x', endX);
                    waypoint2.setAttribute('y', endY);
                    bpmnEdge.appendChild(waypoint2);

                    bpmnPlane.appendChild(bpmnEdge);
                });
            // XML 문자열로 변환 및 반환
            const serializer = new XMLSerializer();
            const bpmnXml = serializer.serializeToString(xmlDoc);
            return bpmnXml;
        }
    },
}
</script>
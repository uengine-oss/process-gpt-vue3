<script>
import xml2js from 'xml2js';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import FormGenerator from './ai/FormDesignGenerator';
import FormDefinitionModule from './FormDefinitionModule.vue';
import BPMNXmlGenerator from './BPMNXmlGenerator.vue';
import FormScanModule from './FormScanModule.vue';
import partialParse from "partial-json-parser";
import JSON5 from 'json5';

const backend = BackendFactory.createBackend();

export default {
    mixins: [FormDefinitionModule, BPMNXmlGenerator, FormScanModule],
    data: () => ({
        processVariables: [],
        processDefinition: null,
        bpmn: null,
        definitionChangeCount: 0,
        projectName: null,
        disableChat: false,
        isViewMode: false,
        lock: false,
        loading: false,
        isChanged: false,
        generateFormTask: null,
        oldProcDefId: '',
        userInputs: null,
        formScanQueue: [] // 폼 스캔 큐 추가
    }),
    computed: {
        lastPath() {
            if (this.$route.path == '/definition-map') {
                return 'definition-map';
            } else if (this.$route.params && this.$route.params.pathMatch && this.$route.params.pathMatch.length > 0) {
                return this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
            }
            return null;
        }
    },
    mounted() {},
    beforeUnmount() {},
    async created() {},
    methods: {
        async checkedFormData() {
            if (this.processDefinition && this.processDefinition.elements) {
                const activities = this.processDefinition.elements.filter(element => 
                    element.elementType === 'Activity' && 
                    element.type === 'UserActivity'
                );
                this.generateFormTask = {};

                let externalCustomerActs = null;
                if (this.processDefinition.roles && this.processDefinition.roles.length > 0) {
                    const externalCustomer = this.processDefinition.roles.find(role => role.endpoint == "external_customer");
                    if (externalCustomer && externalCustomer.name) {
                        externalCustomerActs = activities.filter(act => act.role == externalCustomer.name);
                    }
                }
                
                for (const activity of activities) {
                    let inputs = null;
                    if (externalCustomerActs && externalCustomerActs.length > 0) {
                        if (activity.id == externalCustomerActs[0].id) {
                            if (window.$i18n.global.locale == 'ko') {
                                inputs = "이메일(*필드명은 customer_email)";
                            } else {
                                inputs = "email(*field name is customer_email)";
                            }
                        }
                    }
                    if (activity.outputData && activity.outputData.length > 0) {
                        inputs = inputs ? inputs + ", " + activity.outputData.join(', ') : activity.outputData.join(', ');
                    }
                    
                    if (inputs) { 
                        this.generateFormTask[activity.id] = 'generating';
                        let generateMsg = `Please refer to the following and create a form.`;
                        if (inputs) generateMsg += `Fields to enter: ${inputs}`;
                        generateMsg += `\nPlease place all fields in one area and arrange them vertically.`;
                        const formHtml = await this.generateForm(generateMsg, activity);
                        // 완료 메세지
                        let messageWriting = this.messages[this.messages.length - 1];
                        messageWriting.isLoading = false;
                        this.messages.push({
                            "role": "system",
                            "content": `${activity.name} 활동의 폼 생성이 완료되었습니다.`,
                            "timeStamp": Date.now(),
                            "contentType": "html",
                            "htmlContent": formHtml,
                            "jsonContent": {}
                        });
                    }
                }
                
                // 모든 폼 생성이 완료된 후 최종 메시지 추가
                if (activities.length > 0) {
                    this.messages.push({
                        "role": "system",
                        "content": `모든 활동에 대한 폼 생성을 완료했습니다.`,
                        "timeStamp": Date.now()
                    });

                    
                    const isUseDataSource = localStorage.getItem('isUseDataSource');
                    if(!isUseDataSource || isUseDataSource === 'false') {
                        this.$try({
                            context: this,
                            action: () => {
                            },
                            successMsg: this.$t('successMsg.formGenerationCompleted')
                        })
                    }

                    this.scanFormQueue();
                }
                
                this.generateFormTask = {};
            }
        },
        async generateForm(generateMsg, activity) {
            var me = this;
            return new Promise((resolve, reject) => {
                let retryCount = 0;
                let formHtml = null;
                const formGenerator = new FormGenerator(me, {
                    isStream: true,
                    preferredLanguage: 'Korean',
                });
                formGenerator.client.genType = 'form';
                formGenerator.client.onFormCreated = async (response) => {
                    let messageWriting = me.messages[me.messages.length - 1];
                    messageWriting.jsonContent = response;
                }
                formGenerator.client.onFormGenerationFinished = async (response) => {
                    try {
                        let jsonData = this.extractLastJSON(response);
                        if (jsonData.htmlOutput) {
                            const html = await me.keditorContentHTMLToDynamicFormHTML(jsonData.htmlOutput)
                            formHtml = await me.saveFormData(html, activity.id);
                            if (formHtml) {
                                me.generateFormTask[activity.id] = 'finished';
                            }
                            resolve(formHtml);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.log(error);
                        const maxRetries = 3;

                        const retry = async () => {
                            if (retryCount < maxRetries) {
                                console.log('retrying generate form');
                                retryCount++;
                                formGenerator.generate();
                            } else {
                                let messageWriting = me.messages[me.messages.length - 1];
                                messageWriting.isLoading = false;
                                me.messages.push({
                                    "role": "system",
                                    "content": `${activity.name} 활동의 폼 생성이 실패했습니다. 다시 시도해주세요.`,
                                    "timeStamp": Date.now()
                                });
                                reject(error);
                            }
                        };

                        retry();
                    }
                };
                formGenerator.previousMessages = [
                    ...formGenerator.previousMessageFormats
                ];

                this.userInputs = {
                    requestType: "Create",
                    request: generateMsg,
                    existingForm: "",
                    imageUrl: null
                };

                formGenerator.generate();
                me.messages.push({
                    "role": "system",
                    "content": `${activity.name} 활동의 폼을 생성합니다.`,
                    "timeStamp": Date.now(),
                    "isLoading": true
                })
            });
        },
        async saveFormData(html, activityId) {
            const options = {
                type: 'form',
                proc_def_id: this.processDefinition.processDefinitionId,
                activity_id: activityId
            };
            const formId = `${options.proc_def_id}_${options.activity_id}_form`;
            if (this.lastPath) {
                if (this.lastPath == 'chat' || this.lastPath == 'definition-map') {
                    localStorage.setItem(formId, html);
                } else {
                    await backend.putRawDefinition(html, formId, options);
                }
            } else {
                localStorage.setItem(formId, html);
            }
            return html;
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
                
                // 첫 번째 시도: ID로 직접 찾기
                let elementToRemove = elementRegistry.get(modification.value.id);
                
                // 두 번째 시도: beforeActivity가 있는 경우, 이 활동에서 시작하는 연결 찾기
                if (!elementToRemove && modification.beforeActivity) {
                    const allElements = elementRegistry.getAll();
                    const sequenceFlows = allElements.filter(el => el.type === 'bpmn:SequenceFlow');
                    
                    // 시작 활동(beforeActivity)에서 나가는 시퀀스 플로우 찾기
                    elementToRemove = sequenceFlows.find(flow => {
                        // source가 businessObject.sourceRef.id에 있을 것으로 예상
                        if (flow.businessObject && flow.businessObject.sourceRef) {
                            return flow.businessObject.sourceRef.id === modification.beforeActivity;
                        }
                        return false;
                    });
                }
                
                // 요소를 찾았다면 삭제
                if (elementToRemove) {
                    modeling.removeElements([elementToRemove]);
                    console.log('삭제된 요소:', elementToRemove.id);
                } else {
                    console.error('요소를 찾을 수 없습니다:', modification.value.id);
                }
            }
        },
        toggleVersionDialog(open) {
            // Version Dialog
            this.versionDialog = open;
            this.loading = false
        },
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.loading = true;
                    me.saveSchedule(info, '1.0');
                    await me.setDefinitionInfo(info)
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

                    
                    let newProcessDefinition

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
                                    (newProcessDefinition.elements && newProcessDefinition.elements.length > 0) ||
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
                        newProcessDefinition.data = me.processVariables;

                        if (!newProcessDefinition.sequences) {
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
                                        newRole.endpoint = oldRole.endpoint;
                                    }
                                    return newRole;
                                });
                            }

                            newProcessDefinition = me.checkDefinitionSync(newProcessDefinition, me.processDefinition);
                            me.processDefinition = newProcessDefinition;
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
                    me.$emit('closeConsultingDialog', true)
                },
                onFail: (e) => {
                    console.log(e);
                    me.loading = false;
                    me.isChanged = true;
                },
                successMsg: this.$t('successMsg.save')
            });
        },
        async saveSchedule(info, version) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(info.prevSnapshot, "text/xml");

            const startEvents = xmlDoc.getElementsByTagName("bpmn:startEvent");

            for (let i = 0; i < startEvents.length; i++) {
                let result = {};
                const event = startEvents[i];
                const timer = event.getElementsByTagName("bpmn:timerEventDefinition")[0];

                if (timer) {
                    const extensionElements = event.getElementsByTagName("bpmn:extensionElements")[0];
                    if (!extensionElements) continue;

                    const uengineJson = extensionElements.querySelector("uengine\\:json, json");
                    if (!uengineJson || !uengineJson.textContent) continue;

                    let cronExpression = null;
                    try {
                        const json = JSON.parse(uengineJson.textContent);
                        cronExpression = json.expression;
                    } catch (e) {
                        console.warn("Invalid uengine:json in startEvent", e);
                        continue;
                    }

                    result = {
                        proc_def_id: info.proc_def_id,
                        event_id: event.getAttribute("id"),
                        name: event.getAttribute("name") || "",
                        cronExpression: cronExpression,
                        version: version
                    };
                    
                    backend.setSchedule(result);
                }
            }
        },
        async convertXMLToJSON(xmlString) {
            try {
                if (!xmlString) return {};
                xmlString = xmlString.replace(/\$type/g, '_type'); //sanitizing for $type

                const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                const result = await parser.parseStringPromise(xmlString);
                let processDefinitionId = 'Unknown';
                let definitionName = null;
                let version = null;
                let shortDescription = null;

                if(this.fullPath) {
                    processDefinitionId = this.fullPath;
                } else {
                    processDefinitionId = this.$route.params.id;
                }

                if (processDefinitionId == 'chat') {
                    processDefinitionId = this.processDefinition.processDefinitionId;
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
                

                function processSubProcess(subProcessTmp, processId) {
                    if (subProcessTmp instanceof Array) {
                        return subProcessTmp.map((obj) => ({ ...obj, type: 'subProcess', process: processId }));
                    } else {
                        return [{ ...subProcessTmp, type: 'subProcess', process: processId }];
                    }
                }

                function processBpmnProcess(process) {
                    let events = [];
                    let activities = [];
                    let gateways = [];
                    let lanes = [];
                    let sequenceFlows = [];
                    let data = [];
                    let instanceNamePattern = null;
                    let definitionName = null;
                    let version = null;
                    let shortDescription = null;

                    Object.keys(process).forEach((key) => {
                        if (key.includes('Event')) {
                            let eventTmp = process[key];
                            if (eventTmp instanceof Array) {
                                eventTmp = eventTmp.map((obj) => ({ ...obj, type: key.replace('bpmn:', ''), process: process.id }));
                            } else {
                                eventTmp = { ...eventTmp, type: key.replace('bpmn:', ''), process: process.id };
                            }
                            events = events.concat(eventTmp);
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
                        } else if (key.includes('subProcess')) {
                            let subProcessTmp = process[key];
                            const subProcesses = processSubProcess(subProcessTmp, process.id);
                            subProcesses.forEach(subProcess => {
                                const subProcessResult = processBpmnProcess(subProcess);
                                events = events.concat(subProcessResult.events);
                                activities = activities.concat(subProcessResult.activities);
                                gateways = gateways.concat(subProcessResult.gateways);
                                lanes = lanes.concat(subProcessResult.lanes);
                                sequenceFlows = sequenceFlows.concat(subProcessResult.sequenceFlows);
                                data = data.concat(subProcessResult.data);
                            });
                        }
                    });

                    let lanesTmp = ensureArray(process['bpmn:laneSet'] ? process['bpmn:laneSet']['bpmn:lane'] : []);
                    lanesTmp = lanesTmp.map((obj) => ({ ...obj, process: process.id }));
                    lanes = lanes.concat(lanesTmp);

                    let sequenceFlowsTmp = ensureArray(process['bpmn:sequenceFlow'] || []);
                    sequenceFlows = sequenceFlows.concat(sequenceFlowsTmp);
                    
                    function extractVariables(process) {
                        const properties = process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'];
                        if (!properties) return [];

                        const variables = properties['uengine:variable'];
                        if (!variables) return [];

                        const variableArray = Array.isArray(variables) ? variables : [variables];
                        
                        if(window.$mode == 'ProcessGPT'){
                            return variableArray.map((varData) => ({
                                name: varData.name,
                                description: varData.description ? varData.description : varData.name + ' description',
                                type: varData.type
                            }));
                        } else {
                            return variableArray.map((varData) => ({
                                name: varData.name,
                                description: varData.description ? varData.description : varData.name + ' description',
                                type: varData.type,
                                defaultValue: varData['uengine:json'] ? JSON.parse(varData['uengine:json']).defaultValue : null
                            }));
                        }
                    }

                    let dataTmp = extractVariables(process);
                    data = data.concat(dataTmp);

                    let processJson = process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'] && process['bpmn:extensionElements']['uengine:properties']['uengine:json'] ? JSON.parse(process['bpmn:extensionElements']['uengine:properties']['uengine:json']) : null;
                    if(processJson){
                        instanceNamePattern = processJson.instanceNamePattern ? processJson.instanceNamePattern : null;
                        definitionName = processJson.definitionName ? processJson.definitionName : null;
                        version = processJson.version ? processJson.version : null;
                        shortDescription = processJson.shortDescription ? processJson.shortDescription : null;         
                    }

                    return {
                        events,
                        activities,
                        gateways,
                        lanes,
                        sequenceFlows,
                        data,
                        instanceNamePattern,
                        definitionName,
                        version,
                        shortDescription
                    };
                }

                for (let process of processes) {
                    const result = processBpmnProcess(process);
                    event = event.concat(result.events);
                    lanes = lanes.concat(result.lanes);
                    activities = activities.concat(result.activities);
                    sequenceFlows = sequenceFlows.concat(result.sequenceFlows);
                    gateways = gateways.concat(result.gateways);
                    data = data.concat(result.data);
                }

                const jsonData = {
                    processDefinitionName: definitionName,
                    processDefinitionId: processDefinitionId,
                    version: version,
                    shortDescription: shortDescription,
                    description: 'process.description',
                    data: data,
                    roles: lanes.map((lane) => {
                        let endpoint = '';
                        if (!lane.endpoint) {
                            if (lane['bpmn:extensionElements'] && lane['bpmn:extensionElements']['uengine:properties'] && lane['bpmn:extensionElements']['uengine:properties']['uengine:json']) {
                                let laneJson = JSON.parse(lane['bpmn:extensionElements']['uengine:properties']['uengine:json']);
                                if (laneJson.roleResolutionContext) {
                                    if (laneJson.roleResolutionContext.endpoint) {
                                        endpoint = laneJson.roleResolutionContext.endpoint;
                                    }
                                }
                            }
                        } else {
                            endpoint = lane.endpoint;
                        }
                        return {
                            name: lane.name,
                            endpoint: endpoint,
                            resolutionRule: lane.resolutionRule,
                            default: ""
                        }
                    }),
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
                                    task.description = parseProperties.description ? parseProperties.description : task.description;
                                } else {
                                    task.inputData = [];
                                    task.outputData = [];
                                }
                                const form = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json']);
                                if (window.$mode == 'ProcessGPT') {
                                    task.tool = 'formHandler:' + processDefinitionId + '_' + task.id + '_form';
                                } else {
                                    if (form && form.variableForHtmlFormContext && form.variableForHtmlFormContext.name) {
                                        task.tool = 'formHandler:' + form.variableForHtmlFormContext.name;
                                    } else {
                                        task.tool = '';
                                    }
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
                    sequences: sequenceFlows.map((flow) => {
                        let condition = null;
                        if (window.$mode == 'ProcessGPT') {
                            condition = flow.condition || '';
                        } else {
                            condition = flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties']
                                ? JSON.parse(flow['bpmn:extensionElements']['uengine:properties']['uengine:json']).condition || flow.condition
                                : '';
                        }
                        return {
                            id: flow.id,
                            source: flow.sourceRef,
                            target: flow.targetRef,
                            condition: condition,
                            properties:
                                flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties']
                                    ? flow['bpmn:extensionElements']['uengine:properties']['uengine:json'] || '{}'
                                    : '{}'
                        }
                    }),
                    participants: participants,
                    instanceNamePattern: instanceNamePattern
                };
                
                // 시퀀스 정보를 활용하여 activities 순서 재정렬
                resultJsonData = this.reorderActivitiesBySequence(jsonData);
                
                return resultJsonData;
            } catch (error) {
                console.error('Error parsing XML:', error);
                throw error;
            }
        },
        
        // 시퀀스 정보를 활용하여 activities 순서를 재정렬하는 함수
        reorderActivitiesBySequence(jsonData) {
            try {
                if (!jsonData.sequences || !jsonData.activities || jsonData.activities.length === 0) {
                    return jsonData;
                }

                // 시퀀스로부터 그래프 구조 생성
                const graph = {};
                const inDegree = {};
                
                // 모든 노드 초기화
                [...jsonData.events, ...jsonData.activities, ...jsonData.gateways].forEach(node => {
                    graph[node.id] = [];
                    inDegree[node.id] = 0;
                });

                // 시퀀스로부터 그래프 간선 추가
                jsonData.sequences.forEach(seq => {
                    if (graph[seq.source] && inDegree.hasOwnProperty(seq.target)) {
                        graph[seq.source].push(seq.target);
                        inDegree[seq.target]++;
                    }
                });

                // 시작 노드 찾기 (보통 start_event이지만 inDegree가 0인 노드들 중에서)
                let startNodes = Object.keys(inDegree).filter(node => inDegree[node] === 0);
                
                if (startNodes.length === 0) {
                    // 순환이 있는 경우 원래 순서 유지
                    return jsonData;
                }

                // BFS를 통한 순서 결정
                const visitedOrder = [];
                const visited = new Set();
                const queue = [...startNodes];

                while (queue.length > 0) {
                    const currentNode = queue.shift();
                    
                    if (visited.has(currentNode)) {
                        continue;
                    }
                    
                    visited.add(currentNode);
                    visitedOrder.push(currentNode);
                    
                    // 다음 노드들을 큐에 추가 (inDegree 감소시키면서)
                    graph[currentNode].forEach(nextNode => {
                        inDegree[nextNode]--;
                        if (inDegree[nextNode] === 0 && !visited.has(nextNode)) {
                            queue.push(nextNode);
                        }
                    });
                }

                // activities만 추출하여 순서대로 재정렬
                const activityIds = jsonData.activities.map(activity => activity.id);
                const orderedActivityIds = visitedOrder.filter(id => activityIds.includes(id));
                
                // 순서대로 activities 재배열
                const reorderedActivities = [];
                orderedActivityIds.forEach(id => {
                    const activity = jsonData.activities.find(act => act.id === id);
                    if (activity) {
                        reorderedActivities.push(activity);
                    }
                });

                // 혹시 누락된 activities가 있다면 마지막에 추가
                jsonData.activities.forEach(activity => {
                    if (!reorderedActivities.find(act => act.id === activity.id)) {
                        reorderedActivities.push(activity);
                    }
                });

                jsonData.activities = reorderedActivities;
                return jsonData;
                
            } catch (error) {
                console.error('Error reordering activities:', error);
                // 에러 발생 시 원래 데이터 반환
                return jsonData;
            }
        },
        async setDefinitionInfo(info) {  
            return new Promise (function (resolve) {
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
                processJson.definitionName = info.name;
                processJson.version = info.version
                processJson.shortDescription = {"text": info.message}

                uengineProperties.json = JSON.stringify(processJson)
                // processJson.instanceNamePattern ? processJson.instanceNamePattern : '';
                resolve()

            })
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
                        if (!me.processDefinition) {
                            me.processDefinition = {
                                processDefinitionId: info.proc_def_id,
                                processDefinitionName: info.name
                            };
                        }
                        if (me.processDefinition.processDefinitionId == 'definition-map') me.processDefinition.processDefinitionId = info.proc_def_id

                        // 최초 저장 시 폼 정보 저장
                        if (me.$route.fullPath.includes('/chat') || me.$route.fullPath.includes('/definition-map')) {
                            if (me.processDefinition.activities && me.processDefinition.activities.length > 0) {
                                me.processDefinition.data = [];
                                me.processDefinition.activities.forEach(async (activity) => {
                                    if (activity.tool && activity.tool.includes('formHandler:')) {
                                        let formHtml = null;
                                        const formId = info.proc_def_id + '_' + activity.id + '_form';
                                        activity.tool = `formHandler:${formId}`;
                                        const currentFormHtml = localStorage.getItem(formId);
                                        if (currentFormHtml) {
                                            formHtml = currentFormHtml;
                                        } else {
                                            if (me.oldProcDefId && me.oldProcDefId !== info.proc_def_id) {
                                                const oldFormId = me.oldProcDefId + '_' + activity.id + '_form';
                                                const oldFormHtml = localStorage.getItem(oldFormId);
                                                if (oldFormHtml) {
                                                    formHtml = oldFormHtml;
                                                    activity.tool = 'formHandler:' + formId;
                                                }
                                            }
                                        }
                                        if (formHtml) {
                                            let fieldData = me.extractFields(formHtml);
                                            fieldData = fieldData.map((field) => ({
                                                name: field.key,
                                                description: field.text,
                                                type: field.type
                                            }));
                                            me.processDefinition.data = me.processDefinition.data.concat(fieldData);
                                            const options = {
                                                type: 'form',
                                                proc_def_id: info.proc_def_id,
                                                activity_id: activity.id
                                            }
                                            await backend.putRawDefinition(formHtml, formId, options);
                                        }
                                        localStorage.removeItem(formId);
                                    }
                                });
                            }
                        }

                        me.processDefinition.processDefinitionId = info.proc_def_id
                            ? info.proc_def_id
                            : prompt('please give a ID for the process definition');

                        if (!me.processDefinition.processDefinitionName && info.name) {
                            me.processDefinition.processDefinitionName = info.name;
                        } else if (!me.processDefinition.processDefinitionName && !info.name) {
                            me.processDefinition.processDefinitionName = prompt('please give a name for the process definition');
                        }

                        if (info.definition.data) {
                            if (info.definition.data.length == 0) {
                                info.definition.data = [{
                                    "name": "customer_email",
                                    "type": "text",
                                    "description": "고객 이메일"
                                }]
                            } else {
                                info.definition.data.push({
                                    "name": "customer_email",
                                    "type": "text",
                                    "description": "고객 이메일"
                                });
                            }
                        }

                        me.projectName = me.processDefinition.processDefinitionName;
                        if (!me.processDefinition.processDefinitionId || !me.processDefinition.processDefinitionName) {
                            throw new Error('processDefinitionId or processDefinitionName is missing');
                        }
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                    }
                    // 신규 프로세스 이동.
                    if (me.$route.fullPath == '/definitions/chat') {
                        me.$router.push(`/definitions/${info.proc_def_id}`);
                    }
                    me.EventBus.emit('definitions-updated');

                    if(!info.skipSaveProcMap){
                        await backend.putProcessDefinitionMap(me.processDefinitionMap);
                    }

                    // 새 탭으로 열린 프로세스 편집창
                    if (me.$route.query && me.$route.query.modeling) {
                        let bpmn;
                        if (me.$route.query.id) {
                            bpmn = await backend.getRawDefinition(me.$route.query.id.replace('.bpmn', ''), { type: 'bpmn' });
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
        },

        checkDefinitionSync(newVal, oldVal) {
            if (newVal && oldVal) {
                if (newVal.activities && oldVal.activities && newVal.activities.length == oldVal.activities.length) {
                    newVal.activities = newVal.activities.map(newActivity => {
                        const oldActivity = oldVal.activities.find(oldActivity => oldActivity.id === newActivity.id);
                        if (oldActivity) {
                            newActivity.type = oldActivity.type;
                            newActivity.duration = oldActivity.duration;
                            newActivity.agentMode = oldActivity.agentMode;
                            newActivity.description = oldActivity.description;
                            newActivity.instruction = oldActivity.instruction;
                            newActivity.checkpoints = oldActivity.checkpoints;
                            newActivity.properties = oldActivity.properties;
                        }
                        return newActivity;
                    });
                }
                return newVal;
            }
        },
        notifyFormModificationComplete(html, formId) {
            if (!html || !formId) {
                this.onFormScanCompleted(null);
                return;
            }
            
            // formId에서 activityId 추출 (형식: processDefId_activityId_form)
            const parts = formId.split('_');
            if (parts.length >= 3) {
                const activityId = parts[parts.length - 2]; // 끝에서 두 번째가 activityId
                console.log(`[notifyFormModificationComplete] 🔍 추출된 activityId: ${activityId}`);
                
                // 해당 활동의 스캔 완료 처리
                this.onFormScanCompleted(activityId);
            } else {
                console.error('[notifyFormModificationComplete] ❌ formId 형식 오류:', formId);
                // fallback: 첫 번째 processing 상태 항목을 완료 처리
                const processingItem = this.formScanQueue.find(item => item.status === 'processing');
                if (processingItem) {
                    this.onFormScanCompleted(processingItem.activityId);
                }
            }
            console.log('[notifyFormModificationComplete] ✅ 폼 수정 완료:', formId);
            console.log('[notifyFormModificationComplete] 📄 수정된 HTML 길이:', html?.length || 0);
            this.generateFormTask = {};
        },
        resetGenerateFormTask() {
            const userActivities = this.processDefinition.elements.filter(activity => 
                activity.elementType === 'Activity' && 
                activity.type === 'UserActivity'
            );

            userActivities.forEach(activity => {
                this.generateFormTask[activity.id] = 'finished';
            });
        },
        scanFormQueue() {
            const isUseDataSource = localStorage.getItem('isUseDataSource');
            if(!isUseDataSource || isUseDataSource === 'false')return;
            console.log('[scanFormQueue] ======== 폼 스캔 큐 시작 ========');
            
            if (!this.processDefinition || !this.processDefinition.elements) {
                console.error('[scanFormQueue] ❌ processDefinition 또는 activities가 없음');
                return;
            }

            // UserActivity만 필터링
            const userActivities = this.processDefinition.elements.filter(activity => 
                activity.elementType === 'Activity' && 
                activity.type === 'UserActivity'
            );

            if (userActivities.length === 0) {
                console.log('[scanFormQueue] ℹ️ UserActivity가 없음 - 큐 처리 종료');
                return;
            }

            console.log(`[scanFormQueue] 📋 처리할 UserActivity: ${userActivities.length}개`);
            
            // 폼 스캔 큐 초기화
            this.formScanQueue = userActivities.map(activity => ({
                processDefinitionId: this.processDefinition.processDefinitionId,
                activityId: activity.id,
                activityName: activity.name,
                status: 'pending'
            }));

            console.log('[scanFormQueue] 📋 큐 초기화 완료:', this.formScanQueue);
            
            // 폼 스캔 시작 메시지 추가
            this.messages.push({
                "role": "system",
                "content": `데이터 소스를 사용 가능한지 확인하기 위해 ${userActivities.length}개 활동의 폼 스캔을 시작합니다.`,
                "timeStamp": Date.now()
            });
            
            // 첫 번째 활동 처리 시작
            this.processNextFormInQueue();
        },

        processNextFormInQueue() {
            console.log('[processNextFormInQueue] 🔄 다음 폼 처리 시작');
            
            // 대기 중인 첫 번째 항목 찾기
            const nextItem = this.formScanQueue.find(item => item.status === 'pending');
            
            if (!nextItem) {
                console.log('[processNextFormInQueue] ✅ 모든 폼 처리 완료');
                this.onAllFormsProcessed();
                return;
            }

            // 현재 처리 중으로 상태 변경
            
            this.resetGenerateFormTask();
            this.generateFormTask[nextItem.activityId] = 'generating';
            nextItem.status = 'processing';
            console.log(`[processNextFormInQueue] 🔄 처리 시작: ${nextItem.activityName} (${nextItem.activityId})`);

            // 개별 활동 스캔 시작 메시지 추가
            this.messages.push({
                "role": "system",
                "content": `"${nextItem.activityName}" 활동의 폼을 스캔하고 있습니다...`,
                "timeStamp": Date.now(),
                "isLoading": true
            });

            // FormScanModule의 scanActivity 호출
            this.scanActivity(nextItem.processDefinitionId, {
                activityId: nextItem.activityId,
                activityName: nextItem.activityName
            });
        },

        onFormScanCompleted(activityId) {
            if (!activityId) {
                this.processNextFormInQueue();
                return;
            }
            console.log(`[onFormScanCompleted] ✅ 폼 스캔 완료: ${activityId}`);
            
            // 해당 활동의 상태를 완료로 변경
            const item = this.formScanQueue.find(item => item.activityId === activityId);
            if (item) {
                item.status = 'completed';
                console.log(`[onFormScanCompleted] 📋 상태 업데이트: ${item.activityName} -> completed`);
                
                // 로딩 중인 마지막 메시지 찾아서 완료 처리
                for (let i = this.messages.length - 1; i >= 0; i--) {
                    if (this.messages[i].isLoading) {
                        this.messages[i].isLoading = false;
                        break;
                    }
                }
                
                // 개별 활동 완료 메시지 추가
                this.messages.push({
                    "role": "system",
                    "content": `"${item.activityName}" 활동의 폼 스캔이 완료되었습니다.`,
                    "timeStamp": Date.now()
                });
            }

            // 다음 폼 처리
            this.processNextFormInQueue();
        },

        onAllFormsProcessed() {
            console.log('[onAllFormsProcessed] 🎉 모든 폼 스캔 및 처리 완료!');
            console.log('[onAllFormsProcessed] 📊 처리 결과:', this.formScanQueue);
            
            // 필요시 추가 후처리 로직
            this.finalizeFormProcessing();
        },

        finalizeFormProcessing() {
            console.log('[finalizeFormProcessing] 🏁 폼 처리 마무리 작업 시작');
            
            // 완료된 활동 수 계산
            const completedCount = this.formScanQueue.filter(item => item.status === 'completed').length;
            const totalCount = this.formScanQueue.length;
            
            console.log(`[finalizeFormProcessing] 📊 처리 완료: ${completedCount}/${totalCount}`);
            
            // 전체 완료 메시지 추가
            this.messages.push({
                "role": "system",
                "content": `모든 활동의 폼 스캔을 완료했습니다. (변경된 폼: ${completedCount}/${totalCount})`,
                "timeStamp": Date.now()
            });
            
            // 큐 초기화
            this.formScanQueue = [];
            
            // 성공 메시지 표시
            if (completedCount > 0) {
                this.$try({
                    context: this,
                    action: () => {
                        console.log('[finalizeFormProcessing] ✅ 폼 스캔 프로세스 성공적으로 완료');
                    },
                    successMsg: `${completedCount}개 활동의 폼 스캔이 완료되었습니다.`
                });
            }
            let messageWriting = this.messages[this.messages.length - 1];
            messageWriting.isLoading = false;
            this.resetGenerateFormTask();

            this.$try({
                context: this,
                action: () => {
                },
                successMsg: this.$t('successMsg.formGenerationCompleted')
            })
        }
    }
};
</script>

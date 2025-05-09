<script>
import xml2js from 'xml2js';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import FormGenerator from './ai/FormDesignGenerator';
import FormDefinitionModule from './FormDefinitionModule.vue';
import BPMNXmlGenerator from './BPMNXmlGenerator.vue';
import partialParse from "partial-json-parser";
import JSON5 from 'json5';

const backend = BackendFactory.createBackend();

export default {
    mixins: [FormDefinitionModule, BPMNXmlGenerator],
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
                
                for (const activity of activities) {
                    let inputs = null;
                    if (activity.outputData && activity.outputData.length > 0) {
                        inputs = activity.outputData ? activity.outputData.join(', ') : '';
                    }
                    let outputs = null;
                    if (activity.inputData && activity.inputData.length > 0) {
                        const uniqueInputs = activity.inputData.filter(item => !activity.outputData.includes(item));
                        outputs = uniqueInputs.join(', ');
                    }
                    if (inputs || outputs) { 
                        this.generateFormTask[activity.id] = 'generating';
                        let generateMsg = `Please refer to the following and create a form.`;
                        if (inputs) generateMsg += `Fields to enter: ${inputs}`;
                        if (outputs) generateMsg += `Fields to read only without input: ${outputs}`;
                        const formHtml = await this.generateForm(generateMsg, activity);
                        // 완료 메세지
                        let messageWriting = this.messages[this.messages.length - 1];
                        messageWriting.isLoading = false;
                        this.messages.push({
                            "role": "system",
                            "content": `${activity.name} 활동의 폼이 생성되었습니다.`,
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

                    this.$try({
                        context: this,
                        action: () => {
                        },
                        successMsg: this.$t('successMsg.formGenerationCompleted')
                    })
                }
                
                this.generateFormTask = {};
            }
        },
        async generateForm(generateMsg, activity) {
            var me = this;
            return new Promise((resolve, reject) => {
                let formHtml = null;
                const formGenerator = new FormGenerator(me, {
                    isStream: true,
                    preferredLanguage: 'Korean',
                });
                formGenerator.client.genType = 'form';
                formGenerator.client.onFormCreated = async (response) => {
                    let messageWriting = me.messages[me.messages.length - 1];
                    messageWriting.content = response;
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
                        let retryCount = 0;

                        const retry = async () => {
                            if (retryCount < maxRetries) {
                                console.log('retrying generate form');
                                retryCount++;
                                formGenerator.generate();
                            } else {
                                reject(error);
                            }
                        };

                        retry();
                    }
                };
                formGenerator.previousMessages = [formGenerator.prevMessageFormat];
                formGenerator.previousMessages.push({
                    role: 'user',
                    content: generateMsg
                });
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
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.loading = true;
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
                                        activity.description = oldActivity.description;
                                        activity.checkpoints = oldActivity.checkpoints;
                                        activity.duration = oldActivity.duration;
                                        activity.attachments = oldActivity.attachments;
                                        activity.pythonCode = oldActivity.pythonCode;
                                        activity.taskLink = oldActivity.taskLink;
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
                        if (lane['bpmn:extensionElements'] && lane['bpmn:extensionElements']['uengine:properties'] && lane['bpmn:extensionElements']['uengine:properties']['uengine:json']) {
                            let laneJson = JSON.parse(lane['bpmn:extensionElements']['uengine:properties']['uengine:json']);
                            if (laneJson.roleResolutionContext) {
                                if (laneJson.roleResolutionContext.endpoint) {
                                    endpoint = laneJson.roleResolutionContext.endpoint;
                                }
                            }
                        }
                        return {
                            name: lane.name,
                            endpoint: endpoint,
                            resolutionRule: lane.resolutionRule
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
                                } else {
                                    task.inputData = [];
                                    task.outputData = [];
                                }
                                const form = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json']);
                                if (form && form.variableForHtmlFormContext && form.variableForHtmlFormContext.name) {
                                    task.tool = 'formHandler:' + form.variableForHtmlFormContext.name;
                                } else {
                                    if (window.$mode == 'ProcessGPT') {
                                        task.tool = 'formHandler:' + processDefinitionId + '_' + task.id + '_form';
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
                resultJsonData = jsonData;
                return resultJsonData;
            } catch (error) {
                console.error('Error parsing XML:', error);
                throw error;
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
                        if (!me.processDefinition) me.processDefinition = {};
                        if (!me.processDefinition.processDefinitionId) me.processDefinition.processDefinitionId = null;
                        if (me.processDefinition.processDefinitionId == 'definition-map') me.processDefinition.processDefinitionId = info.proc_def_id
                        if (!me.processDefinition.processDefinitionName) me.processDefinition.processDefinitionName = null;

                        // 최초 저장 시 폼 정보 저장
                        if (me.lastPath == 'chat' || me.lastPath == 'definition-map') {
                            if (me.processDefinition.activities && me.processDefinition.activities.length > 0) {
                                me.processDefinition.data = [];
                                me.processDefinition.activities.forEach(async (activity) => {
                                    if (activity.tool && activity.tool.includes('formHandler:')) {
                                        activity.tool.replace("formHandler:definition-map_", info.proc_def_id + '_')
                                        const formId = info.proc_def_id + '_' + activity.id + '_form';
                                        if (formId) {
                                            const formHtml = localStorage.getItem(formId);
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
        }
    }
};
</script>
'
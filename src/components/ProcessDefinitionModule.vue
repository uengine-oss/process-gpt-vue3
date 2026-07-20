<script>
import xml2js from 'xml2js';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import FormGenerator from './ai/FormDesignGenerator';
import DefinitionOptimizer from './ai/DefinitionOptimizer';
import FormDefinitionModule from './FormDefinitionModule.vue';
import BPMNXmlGenerator from './BPMNXmlGenerator.vue';
import partialParse from 'partial-json-parser';
import JSON5 from 'json5';
import { getCurrentUserTeamName } from '@/utils/organizationUtils';
import { getBpmnModelService } from '@/services/bpmnModelService';
import { normalizeUengineBpmnXmlForBackend } from '@/utils/uengineXmlTransform';
import { syncBpmnCallActivitiesIntoDefinition } from '@/utils/bpmnCallActivityDefinitionSync';
import { buildChangeSignature } from '@/utils/xmlDiff';
import {
    convertXMLToJSON as convertXMLToJSONShared,
    reorderActivitiesBySequence as reorderActivitiesBySequenceShared
} from '@/utils/bpmnXmlToDefinition';

const backend = BackendFactory.createBackend();

export default {
    mixins: [FormDefinitionModule, BPMNXmlGenerator],
    data: () => ({
        processVariables: [],
        processDefinition: {
            processDefinitionId: `new_process_${Date.now()}`,
            processDefinitionName: ''
        },
        bpmn: null,
        definitionChangeCount: 0,
        projectName: null,
        disableChat: true,
        isViewMode: true,
        lock: true,
        loading: false,
        isChanged: false,
        generateFormTask: null,
        oldProcDefId: '',
        userInputs: null,
        datasourceURL: null,
        datasourceSchema: null,
        definitionOptimizer: null,
        useOptimize: false,
        lastSavedXML: '', // 마지막 저장된 XML (변경 감지용)
        lastSavedXMLHash: '', // 마지막 저장된 XML 해시
        lastSavedSignature: '' // 마지막 저장된 복합 변경 시그니처(XML + XML 밖 편집 상태)
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
    mounted() {
        // 최신 XML 반영된 processDefinition을 콜백으로 전달
        this.EventBus.on('get-process-definition', async (callback) => {
            let xmlString = this.bpmn;
            // BPMN 모델러가 있으면 모델러의 현재 XML 사용 (편집 중인 최신 상태 반영)
            const modeler = useBpmnStore().getModeler;
            if (modeler && typeof modeler.saveXML === 'function') {
                try {
                    const result = await modeler.saveXML({ format: true, preamble: true });
                    xmlString = result.xml || result;
                } catch (e) {
                    console.warn('[ProcessDefinitionModule] 모델러 XML 추출 실패, this.bpmn 사용:', e);
                }
            }
            const processDefinition = await this.convertXMLToJSON(xmlString);
            if (processDefinition?.activities && this.processDefinition) {
                this.mergeProcessDefinitionActivities(processDefinition, this.processDefinition);
            }
            const syncedDefinition = syncBpmnCallActivitiesIntoDefinition(xmlString, processDefinition);
            if (callback && typeof callback === 'function') {
                callback(syncedDefinition);
            }
        });
    },
    methods: {
        cloneJsonSafe(obj) {
            if (obj === null || obj === undefined) return obj;
            try {
                return JSON.parse(JSON.stringify(obj));
            } catch (e) {
                return obj;
            }
        },
        isPlainObject(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        },
        isPlaceholderString(value) {
            if (typeof value !== 'string') return false;
            const normalized = value.trim();
            return normalized === 'formHandler:defaultform' || normalized === 'Process_1';
        },
        shouldFallbackToPrevious(previousValue, newValue) {
            if (previousValue === undefined) return false;
            if (newValue === undefined || newValue === null) return true;

            if (typeof newValue === 'string') {
                const normalizedNew = newValue.trim();
                const normalizedPrev = typeof previousValue === 'string' ? previousValue.trim() : previousValue;
                if (normalizedNew === '' && normalizedPrev !== '') return true;
                if (this.isPlaceholderString(normalizedNew) && normalizedPrev && normalizedPrev !== normalizedNew) {
                    return true;
                }
            }

            if (Array.isArray(newValue)) {
                return newValue.length === 0 && Array.isArray(previousValue) && previousValue.length > 0;
            }

            return false;
        },
        mergeValueWithFallback(previousValue, newValue) {
            if (this.isPlainObject(previousValue) && this.isPlainObject(newValue)) {
                const merged = {};
                const keys = new Set([...Object.keys(previousValue), ...Object.keys(newValue)]);
                keys.forEach((key) => {
                    merged[key] = this.mergeValueWithFallback(previousValue[key], newValue[key]);
                });
                return merged;
            }

            if (Array.isArray(previousValue) && Array.isArray(newValue)) {
                if (this.shouldFallbackToPrevious(previousValue, newValue)) {
                    return this.cloneJsonSafe(previousValue);
                }
                return this.cloneJsonSafe(newValue);
            }

            if (this.shouldFallbackToPrevious(previousValue, newValue)) {
                return this.cloneJsonSafe(previousValue);
            }

            return this.cloneJsonSafe(newValue);
        },
        collectActivitiesForMerge(definition, bucket = []) {
            if (!definition || typeof definition !== 'object') return bucket;

            if (Array.isArray(definition.activities)) {
                bucket.push(...definition.activities.filter((item) => item && item.id));
            }
            if (Array.isArray(definition.elements)) {
                bucket.push(...definition.elements.filter((item) => item && item.id && item.elementType === 'Activity'));
            }
            if (Array.isArray(definition.subProcesses)) {
                definition.subProcesses.forEach((subProcess) => {
                    if (subProcess?.children) {
                        this.collectActivitiesForMerge(subProcess.children, bucket);
                    }
                });
            }
            return bucket;
        },
        buildPreviousActivityMap(previousDefinition) {
            const previousActivities = this.collectActivitiesForMerge(previousDefinition, []);
            const previousActivityMap = new Map();
            previousActivities.forEach((activity) => {
                if (activity?.id && !previousActivityMap.has(activity.id)) {
                    previousActivityMap.set(activity.id, activity);
                }
            });
            return previousActivityMap;
        },
        mergeActivitiesArrayWithMap(newActivities, previousActivityMap) {
            if (!Array.isArray(newActivities)) return newActivities;

            return newActivities.map((newActivity) => {
                const previousActivity = previousActivityMap.get(newActivity?.id);
                if (!previousActivity) return newActivity;

                // 기본값/빈값으로 떨어진 필드만 이전값으로 보완하고, 실제 변경값은 신규값을 우선한다.
                const merged = this.mergeValueWithFallback(previousActivity, newActivity);
                if (newActivity?.id) merged.id = newActivity.id;
                return merged;
            });
        },
        /**
         * XML 왕복 밖에 존재하는 편집 상태 스냅샷을 만든다.
         * 편집 UI 에서 바꿀 수 있지만 BPMN XML 로는 직렬화되지 않는(혹은 저장 직전
         * mergeProcessDefinitionActivities 로만 합쳐지는) 값들을 변경 감지 대상에 포함한다.
         * - formDrafts : 폼 초안 (XML 미직렬화)
         * - dmn_decisions / dmn_rules : DMN 규칙 (XML 미직렬화)
         * - data : 프로세스 변수 (this.processVariables, XML 왕복 밖)
         * - roles : 역할 목록
         * - activities : 활동 메타데이터(지침/역할/설명/체크포인트/에이전트/툴 등)
         */
        buildDefinitionExtraState(def) {
            const source = def || {};
            const activities = this.collectActivitiesForMerge(source, [])
                .filter((activity) => activity && activity.id)
                .map((activity) => {
                    // 좌표/레이아웃성 필드는 stableStringify 단계에서도 걸러지지만,
                    // 여기서도 명시적으로 얕은 복사만 넘겨 순환/중복 노이즈를 줄인다.
                    return { ...activity };
                })
                .sort((a, b) => String(a.id).localeCompare(String(b.id)));

            return {
                formDrafts: source.formDrafts ?? null,
                dmn_decisions: source.dmn_decisions ?? null,
                dmn_rules: source.dmn_rules ?? null,
                data: this.processVariables ?? source.data ?? null,
                roles: source.roles ?? null,
                activities
            };
        },
        /**
         * BPMN XML + XML 밖 편집 상태를 합친 복합 변경 시그니처를 계산한다.
         * @param {string} xml 모델러가 내보낸 BPMN XML
         * @param {object} def 대상 프로세스 정의 (기본값: 현재 processDefinition)
         */
        computeDefinitionSignature(xml, def) {
            const targetDef = def || this.processDefinition;
            return buildChangeSignature(xml || '', this.buildDefinitionExtraState(targetDef));
        },
        // 서브프로세스(중첩 포함) 내부의 children.activities에도 동일한 폴백 병합을 적용한다.
        mergeSubProcessActivitiesRecursively(subProcesses, previousActivityMap) {
            if (!Array.isArray(subProcesses)) return;

            subProcesses.forEach((subProcess) => {
                if (!subProcess?.children) return;
                if (Array.isArray(subProcess.children.activities)) {
                    subProcess.children.activities = this.mergeActivitiesArrayWithMap(
                        subProcess.children.activities,
                        previousActivityMap
                    );
                }
                if (Array.isArray(subProcess.children.subProcesses)) {
                    this.mergeSubProcessActivitiesRecursively(subProcess.children.subProcesses, previousActivityMap);
                }
            });
        },
        // 최상위 activities와 서브프로세스 트리 전체에 메타데이터 보존 병합을 적용한다.
        mergeProcessDefinitionActivities(newProcessDefinition, previousDefinition) {
            if (!newProcessDefinition || !previousDefinition) return newProcessDefinition;

            const previousActivityMap = this.buildPreviousActivityMap(previousDefinition);
            if (Array.isArray(newProcessDefinition.activities)) {
                newProcessDefinition.activities = this.mergeActivitiesArrayWithMap(
                    newProcessDefinition.activities,
                    previousActivityMap
                );
            }
            this.mergeSubProcessActivitiesRecursively(newProcessDefinition.subProcesses, previousActivityMap);
            return newProcessDefinition;
        },
        async checkedFormData() {
            console.log('[FORM_DEBUG] checkedFormData called', {
                hasElements: !!this.processDefinition?.elements,
                hasActivities: !!this.processDefinition?.activities,
                procDefId: this.processDefinition?.processDefinitionId
            });
            if (this.processDefinition && this.processDefinition.elements) {
                const allActivities = this.collectAllActivities(this.processDefinition);
                console.log('[FORM_DEBUG] allActivities', {
                    count: allActivities.length,
                    ids: allActivities.map((a) => a.id),
                    withOutputData: allActivities
                        .filter((a) => a.outputData?.length > 0)
                        .map((a) => ({ id: a.id, outputData: a.outputData }))
                });

                this.generateFormTask = {};

                let externalCustomerActs = null;
                if (this.processDefinition.roles && this.processDefinition.roles.length > 0) {
                    const externalCustomer = this.processDefinition.roles.find((role) => role.endpoint == 'external_customer');
                    if (externalCustomer && externalCustomer.name) {
                        externalCustomerActs = allActivities.filter((act) => act.role == externalCustomer.name);
                    }
                }

                for (const activity of allActivities) {
                    let inputs = null;
                    if (externalCustomerActs && externalCustomerActs.length > 0) {
                        if (activity.id == externalCustomerActs[0].id) {
                            if (window.$i18n.global.locale == 'ko') {
                                inputs = '이메일(*필드명은 customer_email)';
                            } else {
                                inputs = 'email(*field name is customer_email)';
                            }
                        }
                    }
                    if (activity.outputData && activity.outputData.length > 0) {
                        inputs = inputs ? inputs + ', ' + activity.outputData.join(', ') : activity.outputData.join(', ');
                    }

                    if (inputs) {
                        this.generateFormTask[activity.id] = 'generating';

                        let generateMsg = `Please refer to the following and create a form.`;

                        if (inputs) generateMsg += ` Fields to enter: ${inputs}.`;

                        const isUseDataSource = localStorage.getItem('isUseDataSource');
                        if (isUseDataSource == 'true') {
                            generateMsg += `
                            Please place all fields in one area and arrange them vertically.

                            If any field label matches a column in the available dataSources, 
                            generate the field using select-field, checkbox-field, or radio-field 
                            with dynamic URL binding accordingly.
                            `;
                        }

                        const formHtml = await this.generateForm(generateMsg, activity);
                        // 완료 메세지
                        let messageWriting = this.messages[this.messages.length - 1];
                        messageWriting.isLoading = false;
                        this.messages.push({
                            role: 'system',
                            content: `${activity.name} 활동의 폼 생성이 완료되었습니다.`,
                            timeStamp: Date.now(),
                            contentType: 'html',
                            htmlContent: formHtml,
                            jsonContent: {}
                        });
                    }
                }

                // 모든 폼 생성이 완료된 후 최종 메시지 추가
                if (allActivities.length > 0) {
                    this.messages.push({
                        role: 'system',
                        content: `모든 활동에 대한 폼 생성을 완료했습니다.`,
                        timeStamp: Date.now()
                    });

                    this.$try({
                        context: this,
                        action: () => {},
                        successMsg: this.$t('successMsg.formGenerationCompleted')
                    });
                }

                this.generateFormTask = {};
                console.log('[FORM_DEBUG] checkedFormData finished', {
                    formDraftsCount: this.processDefinition?.formDrafts?.length,
                    drafts: (this.processDefinition?.formDrafts || []).map((d) => ({
                        id: d.id,
                        activity_id: d.activity_id,
                        htmlLen: d.html?.length
                    }))
                });
            }
        },

        // 메인 프로세스와 서브프로세스의 모든 activities를 재귀적으로 수집하는 함수
        collectAllActivities(processDefinition) {
            const allActivities = [];

            // 메인 프로세스의 activities 수집
            if (processDefinition.elements) {
                const mainActivities = processDefinition.elements.filter(
                    (element) => element.elementType === 'Activity' && element.type === 'UserActivity'
                );
                allActivities.push(...mainActivities);
            }

            // 서브프로세스의 activities 수집
            if (processDefinition.subProcesses && processDefinition.subProcesses.length > 0) {
                for (const subProcess of processDefinition.subProcesses) {
                    if (subProcess.children && subProcess.children.activities) {
                        const subActivities = subProcess.children.activities.filter(
                            (activity) => activity.type === 'userTask' || activity.type === 'emailTask'
                        );
                        allActivities.push(...subActivities);
                    }

                    // 서브프로세스 내의 서브프로세스도 재귀적으로 처리
                    if (subProcess.children && subProcess.children.subProcesses && subProcess.children.subProcesses.length > 0) {
                        const nestedSubProcess = {
                            subProcesses: subProcess.children.subProcesses
                        };
                        const nestedActivities = this.collectAllActivities(nestedSubProcess);
                        allActivities.push(...nestedActivities);
                    }
                }
            }

            return allActivities;
        },
        async generateForm(generateMsg, activity) {
            var me = this;
            return new Promise(async (resolve, reject) => {
                let retryCount = 0;
                let formHtml = null;
                const formGenerator = new FormGenerator(me, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
                formGenerator.client.genType = 'form';
                formGenerator.client.onFormCreated = async (response) => {
                    let messageWriting = me.messages[me.messages.length - 1];
                    messageWriting.jsonContent = response;
                };
                formGenerator.client.onFormGenerationFinished = async (response) => {
                    try {
                        let jsonData = this.extractLastJSON(response);
                        if (jsonData.htmlOutput) {
                            const html = await me.keditorContentHTMLToDynamicFormHTML(jsonData.htmlOutput);
                            const info = await me.saveFormData(html, activity.id);
                            if (info && info.id && info.html) {
                                formHtml = info.html;
                                activity.tool = `formHandler:${info.id}`;
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
                                    role: 'system',
                                    content: `${activity.name} 활동의 폼 생성이 실패했습니다. 다시 시도해주세요.`,
                                    timeStamp: Date.now()
                                });
                                reject(error);
                            }
                        };

                        retry();
                    }
                };
                formGenerator.previousMessages = [...formGenerator.previousMessageFormats];

                this.userInputs = {
                    requestType: 'Create',
                    request: generateMsg,
                    existingForm: '',
                    imageUrl: null
                };

                formGenerator.generate();
                me.messages.push({
                    role: 'system',
                    content: `${activity.name} 활동의 폼을 생성합니다.`,
                    timeStamp: Date.now(),
                    isLoading: true
                });
            });
        },
        async saveFormData(html, activityId) {
            console.log('[FORM_DEBUG] saveFormData called', {
                activityId,
                htmlLength: html?.length,
                hasActivities: Array.isArray(this.processDefinition?.activities),
                activitiesCount: this.processDefinition?.activities?.length,
                procDefId: this.processDefinition?.processDefinitionId
            });
            const activity =
                this.processDefinition && Array.isArray(this.processDefinition.activities)
                    ? this.processDefinition.activities.find((a) => a.id === activityId)
                    : null;

            let formId = '';
            const tool = activity?.tool || '';
            const toolFormId = tool.includes('formHandler:') ? tool.replace('formHandler:', '') : '';

            if (toolFormId && toolFormId !== 'defaultform') {
                formId = toolFormId;
            } else if (this.processDefinition && this.processDefinition.processDefinitionId) {
                formId = `${this.processDefinition.processDefinitionId}_${activityId}_form`;
            } else {
                formId = `${activityId}_form`;
            }

            formId = formId.toLowerCase().replace(/[/.]/g, '_').replace(/#/g, '_');

            if (activity && activity.tool !== `formHandler:${formId}`) {
                activity.tool = `formHandler:${formId}`;
            }

            if (!Array.isArray(this.processDefinition.formDrafts)) {
                this.processDefinition.formDrafts = [];
            }
            const draft = {
                id: formId,
                html: html,
                proc_def_id: this.processDefinition?.processDefinitionId || '',
                activity_id: activityId
            };
            const existingIndex = this.processDefinition.formDrafts.findIndex((item) => item && item.activity_id === activityId);
            if (existingIndex > -1) {
                this.processDefinition.formDrafts[existingIndex] = draft;
            } else {
                this.processDefinition.formDrafts.push(draft);
            }
            console.log('[FORM_DEBUG] saveFormData done', {
                formId,
                draftCount: this.processDefinition.formDrafts.length,
                drafts: this.processDefinition.formDrafts.map((d) => ({ id: d.id, activity_id: d.activity_id, htmlLen: d.html?.length }))
            });
            return { id: formId, html: html };
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
        upsertElementJsonProperties(modeler, elementId, jsonString, role) {
            try {
                const elementRegistry = modeler.get('elementRegistry');
                const bpmnFactory = modeler.get('bpmnFactory');
                const el = elementRegistry.get(elementId);
                if (!el || !el.businessObject) return;

                let ext = el.businessObject.get('extensionElements');
                if (!ext) {
                    ext = bpmnFactory.create('bpmn:ExtensionElements');
                    el.businessObject.set('extensionElements', ext);
                }
                let values = ext.get('values');
                if (!values) {
                    values = [];
                    ext.set('values', values);
                }
                let uprops = values.find((v) => v.$type === 'uengine:Properties');
                if (!uprops) {
                    uprops = bpmnFactory.create('uengine:Properties', { json: '' });
                    values.push(uprops);
                }

                // role이 전달되면 기존 properties에 role 추가/업데이트
                if (role !== undefined) {
                    let propsJson = {};
                    try {
                        if (uprops.json) {
                            propsJson = JSON.parse(uprops.json);
                        }
                    } catch (e) {
                        propsJson = {};
                    }
                    propsJson.role = role;
                    uprops.json = JSON.stringify(propsJson);
                } else {
                    // role이 없으면 기존 방식대로 jsonString 사용
                    uprops.json = jsonString || '{}';
                }
            } catch (e) {
                console.warn('Failed to upsert element properties for', elementId, e);
            }
        },
        applySubprocessProperties(modeler, subProcesses) {
            const list = Array.isArray(subProcesses) ? subProcesses : [];
            list.forEach((sp) => {
                if (!sp?.id) return;

                let props = {};
                if (typeof sp.properties === 'string' && sp.properties.trim()) {
                    try {
                        props = JSON.parse(sp.properties);
                    } catch {
                        props = {};
                    }
                } else if (sp.properties && typeof sp.properties === 'object') {
                    props = { ...sp.properties };
                }

                if (sp.description !== undefined && sp.description !== null) {
                    props.description = sp.description;
                }
                if (sp.instruction !== undefined && sp.instruction !== null) {
                    props.instruction = sp.instruction;
                }
                if (sp.duration !== undefined && sp.duration !== null) {
                    props.duration = sp.duration;
                }
                if (sp.role) {
                    props.role = sp.role;
                }
                if (sp.tool !== undefined && sp.tool !== null) {
                    props.tool = sp.tool;
                }

                this.upsertElementJsonProperties(modeler, sp.id, JSON.stringify(props));

                if (sp.children && Array.isArray(sp.children?.subProcesses)) {
                    this.applySubprocessProperties(modeler, sp.children.subProcesses);
                }
            });
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
                    const sequenceFlows = allElements.filter((el) => el.type === 'bpmn:SequenceFlow');

                    // 시작 활동(beforeActivity)에서 나가는 시퀀스 플로우 찾기
                    elementToRemove = sequenceFlows.find((flow) => {
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
            this.loading = false;
            // try {
            //     if (open) {
            //         if (this.$refs.definitionComponent.copyProcessDefinition) {
            //             this.optimizeDefinition(this.$refs.definitionComponent.copyProcessDefinition);
            //         } else {
            //             this.optimizeDefinition(this.processDefinition);
            //         }
            //     }
            // } catch(e) {
            //     console.log(e)
            // }
        },
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.loading = true;
                    me.saveSchedule(info, '1.0');
                    await me.setDefinitionInfo(info);

                    const savedFormDrafts = Array.isArray(me.processDefinition?.formDrafts) ? [...me.processDefinition.formDrafts] : [];
                    // pdf2bpmn 이 생성한 DMN 메타(dmn_decisions/dmn_rules)는 BPMN XML 에 직렬화되지
                    // 않으므로 convertXMLToJSON 왕복 시 유실된다. formDrafts 와 동일하게 저장 전 보존했다가
                    // XML 변환 후 복원한다.
                    const savedDmnDecisions = Array.isArray(me.processDefinition?.dmn_decisions)
                        ? me.processDefinition.dmn_decisions
                        : null;
                    const savedDmnRules = Array.isArray(me.processDefinition?.dmn_rules) ? me.processDefinition.dmn_rules : null;
                    console.log('[FORM_DEBUG] saveDefinition start', {
                        savedFormDraftsCount: savedFormDrafts.length,
                        drafts: savedFormDrafts.map((d) => ({ id: d.id, activity_id: d.activity_id, htmlLen: d.html?.length }))
                    });

                    const store = useBpmnStore();
                    let modeler = store.getModeler;
                    let xmlObj;
                    let retryCount = 0;
                    const maxRetries = 3;
                    const retryDelay = 1000; // 1초

                    // Pool/Lane 자동 설정
                    try {
                        const elementRegistry = modeler.get('elementRegistry');
                        const modeling = modeler.get('modeling');

                        // Pool(Participant) 이름을 프로세스명으로 설정
                        const participants = elementRegistry.filter((el) => el.type === 'bpmn:Participant');
                        if (participants.length > 0 && info.name) {
                            modeling.updateProperties(participants[0], { name: info.name });
                        }

                        // Lane 이름을 사용자 팀명으로 설정 (기본값인 경우에만)
                        const userTeamName = await getCurrentUserTeamName();
                        if (userTeamName) {
                            const lanes = elementRegistry.filter((el) => el.type === 'bpmn:Lane');
                            if (lanes.length > 0) {
                                const firstLane = lanes[0];
                                const laneName = firstLane.businessObject?.name;
                                if (!laneName || laneName === 'Lane 1' || laneName === 'Lane') {
                                    modeling.updateProperties(firstLane, { name: userTeamName });
                                }
                            }
                        }
                    } catch (poolLaneError) {
                        console.warn('[saveDefinition] Pool/Lane 자동 설정 실패:', poolLaneError);
                    }

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
                                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                            } else {
                                console.error('최대 재시도 횟수 초과. XML 저장 실패.');
                                throw new Error('XML 저장 실패');
                            }
                        }
                    }

                    let newProcessDefinition;

                    if (xmlObj && xmlObj.xml && window.$mode == 'ProcessGPT') {
                        if (!window.$jms) {
                            let retryCount = 0;
                            while (retryCount < 10) {
                                modeler = store.getModeler;
                                xmlObj = await modeler.saveXML({ format: true, preamble: true });
                                newProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                                if (
                                    newProcessDefinition != null &&
                                    ((newProcessDefinition.data && newProcessDefinition.data.length > 0) ||
                                        (newProcessDefinition.roles && newProcessDefinition.roles.length > 0) ||
                                        (newProcessDefinition.events && newProcessDefinition.events.length > 0) ||
                                        (newProcessDefinition.elements && newProcessDefinition.elements.length > 0) ||
                                        (newProcessDefinition.gateways && newProcessDefinition.gateways.length > 0) ||
                                        (newProcessDefinition.sequences && newProcessDefinition.sequences.length > 0))
                                ) {
                                    break;
                                }
                                retryCount++;
                                await new Promise((resolve) => setTimeout(resolve, 500));
                            }
                        } else {
                            newProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        }
                        newProcessDefinition.data = me.processVariables;

                        if (!newProcessDefinition.sequences) {
                            newProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        }

                        if (!me.processDefinition) {
                            me.processDefinition = newProcessDefinition;
                            if (savedFormDrafts.length > 0) me.processDefinition.formDrafts = savedFormDrafts;
                        } else {
                            // if (me.processDefinition.roles) {
                            //     newProcessDefinition.roles = newProcessDefinition.roles.map(newRole => {
                            //         const oldRole = me.processDefinition.roles.find(oldRole => oldRole.name === newRole.name);
                            //         if (oldRole && oldRole.endpoint && oldRole.endpoint != '' && oldRole.default && oldRole.default != '') {
                            //             newRole.resolutionRule = oldRole.resolutionRule;
                            //             newRole.endpoint = oldRole.endpoint;
                            //             newRole.default = oldRole.default;
                            //         }
                            //         return newRole;
                            //     });
                            // }

                            if (newProcessDefinition.activities) {
                                this.mergeProcessDefinitionActivities(newProcessDefinition, me.processDefinition);
                            }

                            me.processDefinition = newProcessDefinition;
                        }

                        if (savedFormDrafts.length > 0) me.processDefinition.formDrafts = savedFormDrafts;
                        if (savedDmnDecisions && !me.processDefinition.dmn_decisions) {
                            me.processDefinition.dmn_decisions = savedDmnDecisions;
                        }
                        if (savedDmnRules && !me.processDefinition.dmn_rules) {
                            me.processDefinition.dmn_rules = savedDmnRules;
                        }
                        console.log('[FORM_DEBUG] after Path1 processDefinition replaced', {
                            formDraftsCount: me.processDefinition.formDrafts?.length,
                            savedFormDraftsCount: savedFormDrafts.length
                        });

                        if (info.name && info.name != '') {
                            me.processDefinition.processDefinitionName = info.name;
                        }
                        me.processDefinition = syncBpmnCallActivitiesIntoDefinition(xmlObj.xml, me.processDefinition);
                        info.definition = me.processDefinition;
                    }

                    // ensure subprocess properties are written back into BPMN before saving
                    try {
                        const modeler = store.getModeler;
                        this.applySubprocessProperties(modeler, me.processDefinition?.subProcesses || []);
                    } catch (e) {
                        console.warn('applySubprocessProperties failed', e);
                    }

                    // update element roles in properties from XML (without propsJson interference)
                    try {
                        const modeler = store.getModeler;

                        // 현재 XML로 lane 기반 role 추출 (propsJson 영향 없이 순수 lane 정보만)
                        const tempXml = await modeler.saveXML({ format: true, preamble: true });
                        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                        const xmlResult = await parser.parseStringPromise(tempXml.xml);

                        // lane 역색인 생성 (elementId -> laneName)
                        const laneMap = new Map();
                        const processes = xmlResult['bpmn:definitions']?.['bpmn:process'];
                        const procList = Array.isArray(processes) ? processes : [processes];

                        procList.forEach((proc) => {
                            const laneSet = proc?.['bpmn:laneSet'];
                            if (laneSet) {
                                const lanes = laneSet['bpmn:lane'];
                                const laneList = Array.isArray(lanes) ? lanes : lanes ? [lanes] : [];
                                laneList.forEach((lane) => {
                                    const refs = lane['bpmn:flowNodeRef'];
                                    const refList = Array.isArray(refs) ? refs : refs ? [refs] : [];
                                    refList.forEach((ref) => {
                                        laneMap.set(ref, lane.name);
                                    });
                                });
                            }
                        });

                        // lane 정보를 사용해서 properties 업데이트
                        if (me.processDefinition.activities) {
                            me.processDefinition.activities.forEach((act) => {
                                const laneName = laneMap.get(act.id);
                                if (laneName) {
                                    this.upsertElementJsonProperties(modeler, act.id, null, laneName);
                                }
                            });
                        }

                        if (me.processDefinition.events) {
                            me.processDefinition.events.forEach((evt) => {
                                const laneName = laneMap.get(evt.id);
                                if (laneName) {
                                    this.upsertElementJsonProperties(modeler, evt.id, null, laneName);
                                }
                            });
                        }

                        if (me.processDefinition.gateways) {
                            me.processDefinition.gateways.forEach((gw) => {
                                const laneName = laneMap.get(gw.id);
                                if (laneName) {
                                    this.upsertElementJsonProperties(modeler, gw.id, null, laneName);
                                }
                            });
                        }

                        // 업데이트된 properties를 반영하기 위해 다시 XML 생성
                        xmlObj = await modeler.saveXML({ format: true, preamble: true });

                        // properties가 업데이트된 XML로 processDefinition 다시 생성 (한 번에 동기화)
                        const updatedProcessDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        updatedProcessDefinition.data = me.processVariables;

                        if (updatedProcessDefinition.activities && me.processDefinition.activities) {
                            this.mergeProcessDefinitionActivities(updatedProcessDefinition, me.processDefinition);
                        }

                        if (info.name && info.name != '') {
                            updatedProcessDefinition.processDefinitionName = info.name;
                        }

                        if (savedFormDrafts.length > 0) {
                            updatedProcessDefinition.formDrafts = savedFormDrafts;
                        }
                        if (savedDmnDecisions && !updatedProcessDefinition.dmn_decisions) {
                            updatedProcessDefinition.dmn_decisions = savedDmnDecisions;
                        }
                        if (savedDmnRules && !updatedProcessDefinition.dmn_rules) {
                            updatedProcessDefinition.dmn_rules = savedDmnRules;
                        }

                        me.processDefinition = syncBpmnCallActivitiesIntoDefinition(xmlObj.xml, updatedProcessDefinition);
                        info.definition = me.processDefinition;
                        console.log('[FORM_DEBUG] after Path2 processDefinition replaced', {
                            formDraftsCount: me.processDefinition.formDrafts?.length
                        });
                    } catch (e) {
                        console.warn('update element roles failed', e);
                        console.log('[FORM_DEBUG] Path2 failed, current formDrafts', {
                            formDraftsCount: me.processDefinition?.formDrafts?.length
                        });
                    }

                    console.log('[FORM_DEBUG] before saveModel', { formDraftsCount: me.processDefinition?.formDrafts?.length });
                    let finalXml = xmlObj.xml;
                    if (window.$mode === 'uEngine') {
                        const resolvedDefinitionName =
                            info.name ||
                            me.projectName ||
                            me.processDefinition?.processDefinitionName ||
                            me.processDefinition?.name ||
                            null;
                        finalXml = normalizeUengineBpmnXmlForBackend(xmlObj.xml, resolvedDefinitionName);
                    }

                    await me.saveModel(info, finalXml);
                    me.bpmn = finalXml;

                    // Phase 1: XML 파싱하여 정규화된 테이블에 저장 (비동기, 실패해도 저장은 진행)
                    try {
                        const bpmnModelService = getBpmnModelService();
                        await bpmnModelService.saveModel(info.proc_def_id, {
                            xml_content: finalXml
                        });
                        console.log('[saveDefinition] BPMN 모델 파싱 완료');
                    } catch (parseError) {
                        console.warn('[saveDefinition] BPMN 모델 파싱 실패 (저장은 정상 완료):', parseError);
                    }

                    // 저장 성공 후 lastSavedXML 업데이트 (변경 감지용)
                    me.lastSavedXML = finalXml;
                    // XML + XML 밖 편집 상태(폼/DMN/변수/활동 메타)를 합친 복합 시그니처를
                    // 저장 기준선으로 기록한다. 다음 저장 시 이 기준선과 비교해 변경 여부를 판단.
                    me.lastSavedSignature = me.computeDefinitionSignature(finalXml, me.processDefinition);
                    me.isChanged = false;
                    me.lastSavedTime = new Date();

                    // Extract organization info from swimlanes and save to process_organizations table
                    try {
                        await me.updateProcessOrganizations(info.proc_def_id, modeler);
                    } catch (e) {
                        console.warn('Failed to update process organizations:', e);
                    }

                    let processInfo = {
                        bpmn: me.bpmn,
                        def: me.processDefinition
                    };
                    this.$emit('modelCreated', processInfo);

                    if (window.$mode !== 'uEngine') {
                        me.disableChat = true;
                        me.isViewMode = true;
                        me.lock = true; // 잠금처리 ( 수정 불가 )
                    }
                    me.definitionChangeCount++;

                    me.loading = false;
                    await me.toggleVersionDialog(false);
                    me.$emit('closeConsultingDialog', true);
                },
                onFail: (e) => {
                    console.log(e);
                    me.loading = false;
                    me.isChanged = true;
                },
                successMsg: this.$t('successMsg.save')
            });
        },
        async updateProcessOrganizations(procDefId, modeler) {
            if (!procDefId || !modeler) {
                console.log('[updateProcessOrganizations] Missing procDefId or modeler');
                return;
            }

            try {
                // Extract organizations from lanes
                const organizations = this.extractOrganizationsFromLanes(modeler);
                console.log('[updateProcessOrganizations] Extracted organizations:', organizations);

                const supabase = window.$supabase;
                if (!supabase) {
                    console.log('[updateProcessOrganizations] No supabase instance');
                    return;
                }

                const tenantId = window.$tenantName || 'default';

                // Delete existing mappings for this process
                const { error: deleteError } = await supabase
                    .from('process_organizations')
                    .delete()
                    .eq('tenant_id', tenantId)
                    .eq('proc_def_id', procDefId);

                if (deleteError) {
                    console.warn('[updateProcessOrganizations] Error deleting existing mappings:', deleteError);
                }

                // Insert new mappings
                if (organizations.length > 0) {
                    const insertData = organizations.map((org) => ({
                        tenant_id: tenantId,
                        proc_def_id: procDefId,
                        organization_id: org.id,
                        organization_name: org.name,
                        organization_type: org.type || 'team'
                    }));

                    const { error: insertError } = await supabase.from('process_organizations').insert(insertData);

                    if (insertError) {
                        console.error('[updateProcessOrganizations] Error inserting mappings:', insertError);
                    } else {
                        console.log('[updateProcessOrganizations] Saved organizations for process:', procDefId, organizations);
                    }
                } else {
                    console.log('[updateProcessOrganizations] No organizations to save for process:', procDefId);
                }
            } catch (error) {
                console.error('[updateProcessOrganizations] Error:', error);
            }
        },
        extractOrganizationsFromLanes(modeler) {
            const organizations = [];
            const seenIds = new Set();

            try {
                const definitions = modeler.getDefinitions();
                console.log('[extractOrganizationsFromLanes] definitions:', definitions);
                if (!definitions || !definitions.rootElements) {
                    console.log('[extractOrganizationsFromLanes] No definitions or rootElements');
                    return organizations;
                }

                for (const rootElement of definitions.rootElements) {
                    console.log('[extractOrganizationsFromLanes] rootElement.$type:', rootElement.$type);
                    if (rootElement.$type !== 'bpmn:Process') continue;

                    const laneSets = rootElement.laneSets || [];
                    console.log('[extractOrganizationsFromLanes] laneSets count:', laneSets.length);

                    for (const laneSet of laneSets) {
                        const lanes = laneSet.lanes || [];
                        console.log('[extractOrganizationsFromLanes] lanes count:', lanes.length);

                        for (const lane of lanes) {
                            console.log('[extractOrganizationsFromLanes] lane name:', lane.name, 'id:', lane.id);

                            // Get extensionElements
                            const extElements = lane.extensionElements;
                            console.log('[extractOrganizationsFromLanes] extensionElements:', extElements);

                            if (!extElements || !extElements.values) {
                                console.log('[extractOrganizationsFromLanes] No extensionElements.values for lane:', lane.name);
                                continue;
                            }

                            console.log('[extractOrganizationsFromLanes] extensionElements.values:', extElements.values);

                            // Parse extensionElements.values to find roleResolutionContext
                            for (const ext of extElements.values) {
                                console.log('[extractOrganizationsFromLanes] ext:', ext);
                                console.log('[extractOrganizationsFromLanes] ext.$type:', ext.$type);
                                console.log('[extractOrganizationsFromLanes] ext.json:', ext.json);

                                try {
                                    let props = null;

                                    // Case 1: uengine:Properties with json string
                                    if (ext.json) {
                                        console.log('[extractOrganizationsFromLanes] Parsing ext.json');
                                        props = JSON.parse(ext.json);
                                    }
                                    // Case 2: uengine:Properties with $body
                                    else if (ext.$body) {
                                        console.log('[extractOrganizationsFromLanes] Parsing ext.$body');
                                        props = JSON.parse(ext.$body);
                                    }
                                    // Case 3: Direct properties object
                                    else if (ext.roleResolutionContext) {
                                        console.log('[extractOrganizationsFromLanes] Using ext directly');
                                        props = ext;
                                    }

                                    console.log('[extractOrganizationsFromLanes] parsed props:', props);

                                    if (props && props.roleResolutionContext) {
                                        const roleCtx = props.roleResolutionContext;
                                        console.log('[extractOrganizationsFromLanes] roleResolutionContext:', roleCtx);

                                        if (roleCtx._type === 'Organization' && roleCtx.organizationId) {
                                            console.log(
                                                '[extractOrganizationsFromLanes] Found Organization:',
                                                roleCtx.organizationId,
                                                roleCtx.organizationName
                                            );
                                            if (!seenIds.has(roleCtx.organizationId)) {
                                                seenIds.add(roleCtx.organizationId);
                                                organizations.push({
                                                    id: roleCtx.organizationId,
                                                    name: roleCtx.organizationName || roleCtx.organizationId,
                                                    type: roleCtx.organizationType || 'team'
                                                });
                                            }
                                        }
                                    }
                                } catch (parseError) {
                                    console.warn(
                                        '[extractOrganizationsFromLanes] Failed to parse lane properties:',
                                        parseError,
                                        'ext:',
                                        ext
                                    );
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[extractOrganizationsFromLanes] Error:', error);
            }

            console.log('[extractOrganizationsFromLanes] Final organizations:', organizations);
            return organizations;
        },
        async saveSchedule(info, version) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(info.prevSnapshot, 'text/xml');

            const startEvents = xmlDoc.getElementsByTagName('bpmn:startEvent');

            for (let i = 0; i < startEvents.length; i++) {
                let result = {};
                const event = startEvents[i];
                const timer = event.getElementsByTagName('bpmn:timerEventDefinition')[0];

                if (timer) {
                    const extensionElements = event.getElementsByTagName('bpmn:extensionElements')[0];
                    if (!extensionElements) continue;

                    const uengineJson = extensionElements.querySelector('uengine\\:json, json');
                    if (!uengineJson || !uengineJson.textContent) continue;

                    let cronExpression = null;
                    try {
                        const json = JSON.parse(uengineJson.textContent);
                        cronExpression = json.expression;
                    } catch (e) {
                        console.warn('Invalid uengine:json in startEvent', e);
                        continue;
                    }

                    result = {
                        proc_def_id: info.proc_def_id,
                        event_id: event.getAttribute('id'),
                        name: event.getAttribute('name') || '',
                        cronExpression: cronExpression,
                        version: version
                    };

                    backend.setSchedule(result);
                }
            }
        },
        async convertXMLToJSON(xmlString) {
            // 실제 변환 로직은 src/utils/bpmnXmlToDefinition.js로 추출됨(this.fullPath/this.$route
            // 의존성을 제거해 Vue 컴포넌트 밖에서도 호출 가능하게 하기 위함, process-feedback-whole-definition-review 참고).
            // 이 메서드는 기존 호출부와의 호환을 위한 얇은 래퍼로, 기존과 동일한 processDefinitionId
            // 결정 로직(this.fullPath → this.$route.params.id → this.processDefinition.processDefinitionId)을 유지한다.
            let processDefinitionId = this.fullPath || this.$route?.params?.id || 'Unknown';
            if (processDefinitionId === 'chat' || processDefinitionId === 'definition-map') {
                processDefinitionId = this.processDefinition.processDefinitionId;
            }
            return convertXMLToJSONShared(xmlString, processDefinitionId);
        },

        // 시퀀스 정보를 활용하여 activities 순서를 재정렬하는 함수
        reorderActivitiesBySequence(jsonData) {
            return reorderActivitiesBySequenceShared(jsonData);
        },
        async setDefinitionInfo(info) {
            return new Promise(function (resolve) {
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
                processJson.version = info.version;
                processJson.shortDescription = { text: info.message };

                uengineProperties.json = JSON.stringify(processJson);
                // processJson.instanceNamePattern ? processJson.instanceNamePattern : '';
                resolve();
            });
        },
        async saveModel(info, xml) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (window.$mode == 'uEngine') {
                        // uEngine
                        console.log(info);
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                        if (info.release) {
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
                        if (me.processDefinition.processDefinitionId == 'definition-map')
                            me.processDefinition.processDefinitionId = info.proc_def_id;

                        // 폼 임시본(formDrafts)을 항상 함께 저장
                        const normalizeIdPart = (id) => (id || '').toString().toLowerCase().replace(/[/.]/g, '_').replace(/#/g, '_');
                        const procIdForForm = normalizeIdPart(info.proc_def_id || me.processDefinition.processDefinitionId);
                        const formDrafts = Array.isArray(me.processDefinition.formDrafts) ? me.processDefinition.formDrafts : [];
                        const activities = Array.isArray(me.processDefinition.activities) ? me.processDefinition.activities : [];
                        console.log('[FORM_DEBUG] saveModel formDrafts check', {
                            formDraftsCount: formDrafts.length,
                            activitiesCount: activities.length,
                            procIdForForm,
                            drafts: formDrafts.map((d) => ({ id: d.id, activity_id: d.activity_id, htmlLen: d.html?.length })),
                            activityTools: activities.map((a) => ({ id: a?.id, tool: a?.tool }))
                        });

                        if (formDrafts.length > 0) {
                            await Promise.all(
                                formDrafts
                                    .filter((draft) => draft && draft.id && draft.html)
                                    .map(async (draft) => {
                                        const draftId = normalizeIdPart(draft.id);
                                        const draftActivityId = draft.activity_id ? String(draft.activity_id) : null;

                                        let targetActivity = activities.find((a) => a && a.id === draftActivityId) || null;

                                        if (!targetActivity) {
                                            targetActivity =
                                                activities.find((a) => {
                                                    if (!a || !a.id) return false;
                                                    return `${procIdForForm}_${normalizeIdPart(a.id)}_form` === draftId;
                                                }) || null;
                                        }

                                        let activityIdForSave = targetActivity?.id || draftActivityId;
                                        if (!activityIdForSave && draftId.startsWith(`${procIdForForm}_`) && draftId.endsWith('_form')) {
                                            activityIdForSave = draftId.slice(procIdForForm.length + 1, -5);
                                        }

                                        if (targetActivity) {
                                            targetActivity.tool = `formHandler:${draftId}`;
                                        }

                                        const options = {
                                            type: 'form',
                                            proc_def_id: info.proc_def_id,
                                            activity_id: activityIdForSave || draftActivityId || ''
                                        };
                                        console.log('[FORM_DEBUG] saving form to DB', {
                                            draftId,
                                            activityIdForSave,
                                            options,
                                            htmlLen: draft.html?.length
                                        });
                                        try {
                                            const result = await backend.putRawDefinition(draft.html, draftId, options);
                                            console.log('[FORM_DEBUG] putRawDefinition result', { draftId, result });
                                        } catch (err) {
                                            console.error('[FORM_DEBUG] putRawDefinition FAILED', { draftId, error: err });
                                        }
                                    })
                            );

                            me.processDefinition.formDrafts = [];
                        }

                        if (activities.length > 0) {
                            await Promise.all(
                                activities.map(async (activity) => {
                                    if (!activity || !activity.id || !activity.tool || !activity.tool.includes('formHandler:defaultform'))
                                        return;
                                    const activityId = normalizeIdPart(activity.id);
                                    const promotedFormId = `${procIdForForm}_${activityId}_form`;
                                    const draft = formDrafts.find(
                                        (item) =>
                                            item &&
                                            item.html &&
                                            (normalizeIdPart(item.id) === promotedFormId ||
                                                String(item.activity_id || '') === String(activity.id))
                                    );
                                    if (!draft) return;

                                    activity.tool = `formHandler:${promotedFormId}`;
                                    await backend.putRawDefinition(draft.html, promotedFormId, {
                                        type: 'form',
                                        proc_def_id: info.proc_def_id,
                                        activity_id: activity.id
                                    });
                                })
                            );
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
                        me.processDefinition = syncBpmnCallActivitiesIntoDefinition(xml, me.processDefinition);
                        // saveModel 내부에서 activity.tool이 바뀐 최신 정의를 proc_def.definition으로 저장하도록 동기화
                        info.definition = me.processDefinition;
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                    }
                    // 신규 프로세스 이동.
                    if (me.$route.fullPath == '/definitions/chat') {
                        me.$router.push(`/definitions/${info.proc_def_id}`);
                    }
                    me.EventBus.emit('definitions-updated');

                    if (!info.skipSaveProcMap) {
                        // 최신 정의 체계도 불러오기
                        me.processDefinitionMap = await backend.getProcessDefinitionMap();

                        // BPMN XML에서 mega/major 프로세스 ID 추출
                        let megaProcessId = null;
                        let majorProcessId = null;
                        try {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(xml, 'text/xml');
                            const processElement = xmlDoc.querySelector('process');
                            if (processElement) {
                                megaProcessId = processElement.getAttribute('megaProcessId');
                                majorProcessId = processElement.getAttribute('majorProcessId');
                            }
                            console.log(
                                `[정의체계도] 프로세스 추가 - Mega: ${megaProcessId}, Major: ${majorProcessId}, Process: ${info.proc_def_id}`
                            );
                        } catch (e) {
                            console.warn('Failed to parse XML for mega/major process IDs:', e);
                        }

                        // proc_map에 해당 프로세스가 이미 있는지 확인
                        let processExists = false;
                        if (me.processDefinitionMap && me.processDefinitionMap.mega_proc_list) {
                            for (const megaProc of me.processDefinitionMap.mega_proc_list) {
                                if (megaProc.major_proc_list) {
                                    for (const majorProc of megaProc.major_proc_list) {
                                        if (majorProc.sub_proc_list) {
                                            const existingProc = majorProc.sub_proc_list.find((sub) => sub.id === info.proc_def_id);
                                            if (existingProc) {
                                                processExists = true;
                                                // 기존 프로세스는 이름만 업데이트
                                                existingProc.name = info.name;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (processExists) break;
                            }
                        }

                        // 신규 프로세스인 경우 proc_map에 추가
                        if (!processExists) {
                            // proc_map 구조 초기화
                            if (!me.processDefinitionMap) {
                                me.processDefinitionMap = { mega_proc_list: [] };
                            }
                            if (!me.processDefinitionMap.mega_proc_list) {
                                me.processDefinitionMap.mega_proc_list = [];
                            }

                            // mega/major 정보가 없거나 "미분류"인 경우
                            if (!megaProcessId || !majorProcessId || megaProcessId === '미분류' || majorProcessId === '미분류') {
                                console.log(`[정의체계도] 미분류 프로세스로 추가`);

                                // "미분류" 메가 프로세스 찾기 (기존 것 재사용)
                                let unclassifiedMega = me.processDefinitionMap.mega_proc_list.find(
                                    (mega) => mega.id === 'unclassified' || mega.name === '미분류'
                                );

                                if (!unclassifiedMega) {
                                    console.log(`[정의체계도] 미분류 Mega 프로세스 생성`);
                                    unclassifiedMega = {
                                        id: 'unclassified',
                                        name: '미분류',
                                        major_proc_list: []
                                    };
                                    me.processDefinitionMap.mega_proc_list.push(unclassifiedMega);
                                } else {
                                    console.log(`[정의체계도] 기존 미분류 Mega 프로세스 사용`);
                                }

                                // "미분류" 메이저 프로세스 찾기 (기존 것 재사용)
                                let unclassifiedMajor = unclassifiedMega.major_proc_list.find(
                                    (major) => major.id === 'unclassified_major' || major.name === '미분류'
                                );

                                if (!unclassifiedMajor) {
                                    console.log(`[정의체계도] 미분류 Major 프로세스 생성`);
                                    unclassifiedMajor = {
                                        id: 'unclassified_major',
                                        name: '미분류',
                                        sub_proc_list: []
                                    };
                                    unclassifiedMega.major_proc_list.push(unclassifiedMajor);
                                } else {
                                    console.log(`[정의체계도] 기존 미분류 Major 프로세스 사용`);
                                }

                                // 서브 프로세스 추가
                                if (!unclassifiedMajor.sub_proc_list) {
                                    unclassifiedMajor.sub_proc_list = [];
                                }
                                unclassifiedMajor.sub_proc_list.push({
                                    id: info.proc_def_id,
                                    name: info.name,
                                    path: info.proc_def_id
                                });
                                console.log(`[정의체계도] 미분류 프로세스 추가 완료: ${info.name}`);
                            } else {
                                // mega/major 정보가 있는 경우
                                // 메가 프로세스 찾기: id 또는 name으로 검색 (기존 것 재사용)
                                let megaProc = me.processDefinitionMap.mega_proc_list.find(
                                    (mega) => mega.id === megaProcessId || mega.name === megaProcessId
                                );

                                if (!megaProc) {
                                    // 기존에 없으면 새로 생성
                                    console.log(`[정의체계도] 새 Mega 프로세스 생성: ${megaProcessId}`);
                                    megaProc = {
                                        id: megaProcessId,
                                        name: megaProcessId,
                                        major_proc_list: []
                                    };
                                    me.processDefinitionMap.mega_proc_list.push(megaProc);
                                } else {
                                    console.log(`[정의체계도] 기존 Mega 프로세스 사용: ${megaProc.name} (id: ${megaProc.id})`);
                                }

                                // 메이저 프로세스 찾기: id 또는 name으로 검색 (기존 것 재사용)
                                if (!megaProc.major_proc_list) {
                                    megaProc.major_proc_list = [];
                                }
                                let majorProc = megaProc.major_proc_list.find(
                                    (major) => major.id === majorProcessId || major.name === majorProcessId
                                );

                                if (!majorProc) {
                                    // 기존에 없으면 새로 생성
                                    console.log(`[정의체계도] 새 Major 프로세스 생성: ${majorProcessId}`);
                                    majorProc = {
                                        id: majorProcessId,
                                        name: majorProcessId,
                                        sub_proc_list: []
                                    };
                                    megaProc.major_proc_list.push(majorProc);
                                } else {
                                    console.log(`[정의체계도] 기존 Major 프로세스 사용: ${majorProc.name} (id: ${majorProc.id})`);
                                }

                                // 서브 프로세스 추가
                                if (!majorProc.sub_proc_list) {
                                    majorProc.sub_proc_list = [];
                                }
                                majorProc.sub_proc_list.push({
                                    id: info.proc_def_id,
                                    name: info.name,
                                    path: info.proc_def_id
                                });
                                console.log(`[정의체계도] 프로세스 추가 완료: ${info.name} → ${megaProc.name}/${majorProc.name}`);
                            }
                        }

                        // 업데이트된 proc_map 저장
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

        async optimizeDefinition(processDefinition) {
            const previousDefinitionSnapshot = this.cloneJsonSafe(this.processDefinition);
            if (!processDefinition || !processDefinition.activities) {
                processDefinition = await this.convertXMLToJSON(this.bpmn);
                if (processDefinition?.activities && previousDefinitionSnapshot) {
                    this.mergeProcessDefinitionActivities(processDefinition, previousDefinitionSnapshot);
                }
            }

            return new Promise((resolve, reject) => {
                if (processDefinition) {
                    backend
                        .listDefinition('form_def', {
                            match: {
                                proc_def_id: processDefinition.processDefinitionId
                            }
                        })
                        .then((formList) => {
                            const formFields = formList.map((item) => {
                                const obj = {};
                                obj[item.id] = item.fieldsJson;
                                return obj;
                            });

                            const definitionOptimizerClient = {
                                onGenerationFinished: (response) => {
                                    let jsonData = this.extractJSON(response);
                                    if (jsonData && jsonData.includes('{')) {
                                        try {
                                            jsonData = JSON.parse(jsonData);
                                        } catch (e) {
                                            try {
                                                jsonData = partialParse(jsonData);
                                            } catch (e) {
                                                console.log(e);
                                            }
                                        }
                                    } else {
                                        jsonData = null;
                                    }

                                    if (jsonData && jsonData.activities && jsonData.activities.length > 0) {
                                        const activities = jsonData.activities;
                                        activities.forEach((item) => {
                                            const activityId = item.activity_id;
                                            const activity = processDefinition.activities.find((activity) => activity.id === activityId);
                                            if (activity) {
                                                activity.inputData = item.input_fields;
                                            }
                                        });
                                    }

                                    if (jsonData && jsonData.gateways && jsonData.gateways.length > 0) {
                                        const gateways = jsonData.gateways;
                                        gateways.forEach((item) => {
                                            const gatewayId = item.gateway_id;
                                            const gateway = processDefinition.gateways.find((gateway) => gateway.id === gatewayId);
                                            if (gateway) {
                                                gateway.conditionData = item.condition_fields;
                                            }
                                        });
                                    }

                                    const options = {
                                        definition: syncBpmnCallActivitiesIntoDefinition(this.bpmn, processDefinition)
                                    };
                                    backend.putRawDefinition(this.bpmn, processDefinition.processDefinitionId, options);
                                    this.$try({
                                        context: this,
                                        action: () => {
                                            this.useOptimize = false;
                                            this.optimization = null;
                                        },
                                        successMsg: '프로세스 정의 최적화가 완료되었습니다.'
                                    });
                                    resolve();
                                },
                                onModelCreated: (response) => {
                                    this.optimization = response;
                                }
                            };

                            this.definitionOptimizer = new DefinitionOptimizer(definitionOptimizerClient, {
                                isStream: true,
                                preferredLanguage: 'Korean',
                                processDefinition: processDefinition,
                                formFields: formFields
                            });

                            this.definitionOptimizer.generate();
                        })
                        .catch((error) => {
                            console.error('Form list retrieval failed:', error);
                            reject(error);
                        });
                } else {
                    resolve();
                }
            });
        }
    }
};
</script>

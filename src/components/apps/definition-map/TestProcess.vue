<template>
    <v-card style="width: 100%; height: 100%">
        <div class="d-flex align-center justify-space-between pa-3 pb-0" style="min-height: 52px;">
            <v-card-title class="pa-0">{{ $t('TestProcess.title') }}</v-card-title>
            <v-btn icon variant="text" size="small" @click="$emit('close')" aria-label="닫기">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </div>
        <div>
            <v-row :class="isMobile ? 'ma-0 pa-2 mt-2' : 'ma-0 pa-4 pt-0'">
                <v-col class="pa-0" :cols="isMobile ? 12 : isSimulate ? 6 : 6">
                    <v-alert v-if="bpmn || subBpmn" class="pa-0 mt-4" color="#2196F3" variant="outlined">
                        <div
                            class="pa-2"
                            :style="
                                $globalState.state.isZoomed
                                    ? 'height: calc(100vh - 130px); overflow: auto'
                                    : 'height: calc(100vh - 240px); color: black; overflow: auto'
                            "
                        >
                            <div class="pa-0" style="height: 100%;" :key="updatedDefKey">
                                <div v-if="bpmn" style="border-bottom: 1px solid #E0E0E0;">
                                    {{ $t('TestProcess.mainInstanceId') }}{{ instanceId }}
                                    <BpmnUengine
                                        ref="bpmnVue"
                                        :key="bpmnKey"
                                        :bpmn="bpmn"
                                        :taskStatus="taskStatus"
                                        :options="options"
                                        :isViewMode="true"
                                        :currentActivities="currentActivities"
                                        :instance-id="instanceId"
                                        v-on:openDefinition="(ele) => openSubProcess(ele)"
                                        v-on:navigateToTask="onNavigateToTask"
                                        style="height: 45vh;"
                                    ></BpmnUengine>
                                </div>
                                <div v-if="subBpmn">
                                    <div v-for="(sub, key) in subBpmn"
                                         :key="key"
                                         style="border-bottom: 1px solid #E0E0E0;"
                                    >
                                        {{ $t('TestProcess.subInstanceId') }}{{ key }}
                                        <BpmnUengine
                                            ref="bpmnVue"
                                            :key= "subBpmnKey"
                                            :bpmn="sub"
                                            :options="options"
                                            :isViewMode="true"
                                            :taskStatus="subTaskStatus[key]"
                                            :currentActivities="subCurrentActivities[key]"
                                            :instance-id="String(key)"
                                            v-on:openDefinition="(ele) => openSubProcess(ele)"
                                            v-on:navigateToTask="onNavigateToTask"
                                            style="height: 45vh"
                                        ></BpmnUengine>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </v-alert>
                    <v-row v-else class="ma-0 pa-0 test-process-skeleton" style="height: 100%;">
                        <v-col cols="12" class="pa-4">
                            <v-skeleton-loader type="card"></v-skeleton-loader>
                        </v-col>
                    </v-row>
                </v-col>
                <v-col class="pa-4" :cols="6">
                    <div class="d-flex align-center justify-space-between mb-3">
                        <h6 class="text-subtitle-1 font-weight-medium ma-0 d-flex align-center gap-2">
                            <v-icon size="22" color="primary">mdi-format-list-checks</v-icon>
                            {{ $t('TestProcess.worklist') }}
                        </h6>
                        <div class="d-flex align-center gap-1">
                            <v-tooltip :text="$t('TestProcess.newInstance') || '새 인스턴스'">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" size="small" color="primary" variant="tonal" class="rounded-pill" @click="startNewInstance">
                                        <v-icon start size="18">mdi-plus-circle-outline</v-icon>
                                        {{ $t('TestProcess.newInstance') || '새 인스턴스' }}
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip :text="$t('common.refresh') || '새로고침'">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" size="small" @click="refreshProcess">
                                        <v-icon size="20">mdi-refresh</v-icon>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                    </div>
                    <div class="d-flex gap-3" style="max-height: calc(-270px + 100vh); min-height: 0;">
                        <!-- 작업 목록 + 프로세스 기록 -->
                        <div
                            class="flex-grow-1 min-width-0"
                            style="color: black; overflow-y: auto;"
                        >
                        <div v-if="eventList">
                            <div v-for="event in eventList" :key="event">
                                <v-btn
                                    @click="
                                        $try({
                                            context: this,
                                            action: () => fireMessage(event.tracingTag),
                                            successMsg: `${event.name} ${this.$t('TestProcess.success')}`
                                        })
                                    "
                                    v-if="event.name"
                                    >{{ event.name }}</v-btn
                                >
                            </div>
                        </div>
                        <div v-if="taskList" class="d-flex flex-column gap-3">
                            <v-card
                                v-for="task in taskList"
                                variant="outlined"
                                class="test-process-task-card rounded-xl pa-4"
                                :key="task.taskId"
                                elevation="0"
                            >
                                <div class="d-flex align-center gap-2 mb-3">
                                    <v-avatar size="36" color="primary" variant="tonal" class="flex-shrink-0">
                                        <v-icon size="20">mdi-clipboard-check-outline</v-icon>
                                    </v-avatar>
                                    <div class="min-width-0 flex-grow-1">
                                        <div class="text-subtitle-1 font-weight-medium text-truncate">{{ task.title }}</div>
                                        <div class="text-caption text-medium-emphasis">{{ $t('TestProcess.taskID') }}{{ task.taskId }} · {{ $t('TestProcess.instanceID') }}{{ task.instId }}</div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="d-flex align-center flex-wrap gap-3">
                                        <v-btn
                                            size="small"
                                            variant="tonal"
                                            density="compact"
                                            height="28"
                                            class="text-capitalize"
                                            @click="toggleExpandedTaskForVariables(task.taskId)"
                                        >
                                            <v-icon start size="18">mdi-tune-variant</v-icon>
                                            {{ $t('TestProcess.initialVariables') || '초기 프로세스 변수 설정' }}
                                            <v-icon end size="18">{{ expandedTaskIdForVariables === task.taskId ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                        </v-btn>
                                        <v-tooltip :text="$t('TestProcess.saveUnitTest') || '태스크별 초기 변수 세트 저장'">
                                            <template v-slot:activator="{ props }">
                                                <v-btn v-bind="props" size="small" variant="tonal" density="compact" height="28" class="rounded-pill" @click="saveUnitTestFile">
                                                    <v-icon start size="18">mdi-content-save-outline</v-icon>
                                                    {{ $t('TestProcess.saveUnitTest') || '변수 세트 저장' }}
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </div>
                                    <v-expand-transition>
                                        <div v-show="expandedTaskIdForVariables === task.taskId" class="mt-3 pl-1">
                                            <div class="text-caption text-medium-emphasis mb-2">{{ $t('TestProcess.initialVariablesHint') || '해당 단계 도달 시 가정한 초기값 (여러 시나리오 저장 가능)' }}</div>
                                            <div v-for="set in getInitialVariableSetsForTask(task.taskId)" :key="set.id" class="pa-3 mb-2 rounded-lg border">
                                                <v-text-field
                                                    v-model="set.name"
                                                    :label="$t('TestProcess.setName') || '세트 이름'"
                                                    density="compact"
                                                    hide-details
                                                    class="mb-2"
                                                />
                                                <template v-for="def in processVariableDefinitions" :key="def.name">
                                                    <v-text-field
                                                        v-model="set.values[def.name]"
                                                        :label="def.name"
                                                        :placeholder="def.defaultValue != null ? String(def.defaultValue) : ''"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-1"
                                                    />
                                                </template>
                                                <div class="d-flex mt-2 align-center gap-2">
                                                    <v-btn size="small" color="primary" variant="flat" class="rounded-pill" @click="applyInitialVariableSet(task, set)">
                                                        {{ $t('TestVariable.start') || '적용' }}
                                                    </v-btn>
                                                    <v-btn size="small" variant="text" color="error" @click="removeInitialVariableSet(task.taskId, set.id)">
                                                        {{ $t('TestVariable.delete') || '삭제' }}
                                                    </v-btn>
                                                </div>
                                            </div>
                                            <v-btn size="small" variant="outlined" class="rounded-pill" @click="addInitialVariableSet(task.taskId)">
                                                {{ $t('TestProcess.addSet') || '세트 추가' }}
                                            </v-btn>
                                        </div>
                                    </v-expand-transition>
                                </div>
                                <test-variables
                                    style="height: 100%"
                                    :definition-id="definitionId"
                                    :task="task.trcTag"
                                    :task-id="task.taskId"
                                    @executeTest="(e) => executeTestProcess(e, task)"
                                    @type="(e) => (tool = e)"
                                    @work-item="(e) => addWorkItem(e, task.taskId)"
                                ></test-variables>
                            </v-card>
                            
                            <div class="text-subtitle-1 font-weight-medium mt-4 mb-2 d-flex align-center gap-1">
                                <v-icon size="20">mdi-history</v-icon>
                                {{ $t('TestProcess.processRecord') }}
                            </div>
                            <v-card class="rounded-xl pa-4" variant="outlined" elevation="0">
                                <v-table class="test-process-record-table">
                                    <tbody>
                                        <tr v-for="key in Object.keys(recordedProcess)" :key="key">
                                            <td class="pa-0" style="width: calc(100% - 65px); ">
                                                <div style="display: flex; overflow-x: auto; white-space: nowrap; flex-direction: row; flex-wrap: wrap;">
                                                    <test-record-card class="mr-2" :testRecord="item" :isLast="(index === JSON.parse(recordedProcess[key]).length - 1)" v-for="(item, index) in JSON.parse(recordedProcess[key])" :key="item" @card-click="handleCardClick" />
                                                </div>
                                                <v-divider class="pb-2"/>
                                            </td>
                                            <td class="align-right" style="width: 65px; padding: 0px; text-align: right;">
                                                <v-tooltip :text="$t('TestVariable.start')">
                                                    <template v-slot:activator="{ props }">
                                                        <v-btn density="compact" icon flat @click="executeRecordProcess(recordedProcess[key])" v-bind="props" style="margin-right:5px;">
                                                            <Icons :icon="'play-outline'" :size="17" stroke-width="1.5" :color="'rgb(var(--v-theme-primary))'" />
                                                        </v-btn>
                                                    </template>
                                                </v-tooltip>
                                                <v-tooltip :text="$t('TestVariable.delete')">
                                                    <template v-slot:activator="{ props }">
                                                        <v-btn density="compact" icon flat @click="deleteRecordProcess(key)" v-bind="props">
                                                            <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                                                        </v-btn>
                                                    </template>
                                                </v-tooltip>
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </v-card>
                        </div>
                        <v-row v-else class="ma-0 pa-0 test-process-work-list-skeleton" style="height: 100%;">
                            <v-col cols="12" class="pa-0">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                        </v-row>
                        </div>
                        <!-- 실행 결과 -->
                        <div
                            v-if="lastExecuteResult"
                            class="test-process-result-panel flex-shrink-0 rounded-xl overflow-hidden"
                            style="width: 50%; min-width: 280px; max-height: 100%; overflow-y: auto;"
                        >
                            <v-card class="test-process-result-card h-100 rounded-xl" elevation="1" variant="tonal" color="primary">
                                <v-card-title class="d-flex align-center py-2 px-3 text-subtitle-1">
                                    <v-icon start size="20" color="primary">mdi-check-circle-outline</v-icon>
                                    {{ $t('TestProcess.lastExecuteResult') || '최근 실행 결과' }}
                                    <v-spacer />
                                    <v-btn icon size="x-small" variant="text" @click="lastExecuteResult = null" aria-label="닫기">
                                        <v-icon size="18">mdi-close</v-icon>
                                    </v-btn>
                                </v-card-title>
                                <v-divider />
                                <v-card-text class="py-3 px-3">
                                    <div class="d-flex flex-wrap gap-3 mb-2">
                                        <div class="d-flex align-center gap-1">
                                            <v-icon size="16" class="text-medium-emphasis">mdi-identifier</v-icon>
                                            <span class="text-caption text-medium-emphasis">{{ ($t('TestProcess.instanceID') || '인스턴스 ID').replace(/:?\s*$/, '') }}</span>
                                            <span class="text-body-2 font-weight-medium">{{ lastExecuteResult.instanceId }}</span>
                                        </div>
                                        <div class="d-flex align-center gap-1">
                                            <v-icon size="16" class="text-medium-emphasis">mdi-state-machine</v-icon>
                                            <span class="text-caption text-medium-emphasis">{{ ($t('TestProcess.processStatus') || '프로세스 상태').replace(/:?\s*$/, '') }}</span>
                                            <v-chip :color="lastExecuteResult.processStatus === 'Running' ? 'primary' : 'default'" size="x-small" variant="flat" class="font-weight-medium">{{ lastExecuteResult.processStatus }}</v-chip>
                                        </div>
                                    </div>
                                    <div v-if="lastExecuteResult.currentActivityNames || lastExecuteResult.currentActivityIds" class="d-flex flex-wrap gap-3 mb-3">
                                        <div v-if="lastExecuteResult.currentActivityNames" class="d-flex align-center gap-1">
                                            <v-icon size="16" class="text-medium-emphasis">mdi-cursor-default-click</v-icon>
                                            <span class="text-caption text-medium-emphasis">{{ ($t('TestProcess.currentActivityNames') || '진행 결과 액티비티').replace(/:?\s*$/, '') }}</span>
                                            <span class="text-body-2">{{ lastExecuteResult.currentActivityNames }}</span>
                                        </div>
                                        <div v-if="lastExecuteResult.currentActivityIds" class="text-caption text-medium-emphasis">{{ lastExecuteResult.currentActivityIds }}</div>
                                    </div>
                                    <template v-if="lastExecuteResult.changedProcessVariables && Object.keys(lastExecuteResult.changedProcessVariables).length">
                                        <div class="text-caption text-medium-emphasis mb-2 d-flex align-center gap-1">
                                            <v-icon size="14">mdi-variable</v-icon>
                                            {{ $t('TestProcess.changedProcessVariables') || '변경된 프로세스 변수' }}
                                        </div>
                                        <div class="rounded-lg overflow-hidden" style="background: rgba(var(--v-theme-surface), 0.6);">
                                            <v-table density="compact" class="text-body-2">
                                                <thead>
                                                    <tr>
                                                        <th class="text-left text-medium-emphasis text-caption py-2 pl-3" style="width: 30%;">{{ $t('TestProcess.varName') || '변수명' }}</th>
                                                        <th class="text-left text-medium-emphasis text-caption py-2 pl-2" style="width: 35%;">{{ $t('TestProcess.beforeValue') || '이전 값' }}</th>
                                                        <th class="text-left text-medium-emphasis text-caption py-2 pl-2">{{ $t('TestProcess.afterValue') || '변경 값' }}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(val, key) in lastExecuteResult.changedProcessVariables" :key="key" class="test-process-var-row">
                                                        <td class="text-medium-emphasis py-2 pl-3">{{ key }}</td>
                                                        <td class="py-2 pl-2">{{ isBeforeAfterFormat(val) ? formatVarValue(val.before) : '—' }}</td>
                                                        <td class="py-2 pr-3">{{ isBeforeAfterFormat(val) ? formatVarValue(val.after) : formatVarValue(val) }}</td>
                                                    </tr>
                                                </tbody>
                                            </v-table>
                                        </div>
                                    </template>
                                </v-card-text>
                            </v-card>
                        </div>
                    </div>
                </v-col>
            </v-row>
        </div>

        <v-dialog v-model="recodingDialog" max-width="600px">
            <v-card>
                <v-card-title class="pb-0">{{ testRecord.name }}</v-card-title>
                <v-card-text class="pt-0 pl-4 pr-4">
                    <v-form ref="form">
                        <v-simple-table>
                            <tbody>
                                <tr v-for="(value, key) in testRecord.workItem" :key="key" style="font-size: 12px;">
                                    <td><strong>{{ key }}</strong></td>
                                    <td>&nbsp;</td>
                                    <td>{{ value }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </v-form>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- <v-card-actions class="justify-center" v-if="tool == 'DefaultWorkItem'">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
        </v-card-actions> -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import TestVariables from '@/components/apps/definition-map/TestVariables.vue';
import TestRecordCard from '@/components/apps/definition-map/TestRecordCard.vue';
import customBpmnModule from '@/components/customBpmn';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
export default {
    components: { TestVariables, BpmnUengine, TestRecordCard },
    props: {
        definitionId: String, // proceeName (proceeName.bpmn)
        executeDialog: Boolean
    },
    data: () => ({
        backend: null,
        dryRunWorkItem: undefined,
        isSimulate: 'true',
        isDryRun: true,
        taskId: null,
        bpmn: null,
        updatedDefKey: 0,
        options: {
            additionalModules: [customBpmnModule]
        },
        eventList: [],
        workListByInstId: null,
        currentActivities: [],
        workItem: {},
        taskList: null,
        instanceId: null,
        tool: null,
        subBpmn: null,
        subBpmnKey: 0,
        subTaskStatus : {},
        subCurrentActivities: null,
        taskStatus: null,
        bpmnKey: 0,
        recordedProcess: [],
        isRecording: false,
        confirmRecording: false,
        recordedProcessQueue: [],
        recodingDialog: false,
        testRecord: null,
        intervalId: null,
        processVariableDefinitions: [],
        initialVariableSetsByTask: {},
        expandedTaskIdForVariables: null,
        lastExecuteResult: null
    }),
    created() {
        let me = this;
        me.backend = BackendFactory.createBackend();
        me.startProcess();
    },
    mounted() {
        this.getRecordList();
        this.intervalId = setInterval(() => {
            this.refreshProcessIfChanged();
        }, 10000);
    },
    watch: {
        executeDialog(newVal) {
            if(!newVal) {
                clearInterval(this.intervalId);
            }
        }
    },
    computed: {
        isMobile() {
            return typeof window !== 'undefined' && window.innerWidth <= 768;
        }
    },
    methods: {
        getProcessVariableDefinitions(bpmnDef) {
            if (!bpmnDef) return [];
            const ensureArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
            if (typeof bpmnDef === 'string') {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(bpmnDef, 'text/xml');
                    const processes = doc.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'process');
                    const vars = [];
                    const uengineNs = doc.documentElement.lookupNamespaceURI('uengine') || 'http://uengine';
                    for (let i = 0; i < processes.length; i++) {
                        const ext = processes[i].getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'extensionElements')[0];
                        if (!ext) continue;
                        const props = ext.getElementsByTagNameNS(uengineNs, 'properties')[0] || ext.getElementsByTagName('properties')[0];
                        if (!props) continue;
                        const variableEls = props.getElementsByTagNameNS(uengineNs, 'variable').length
                            ? props.getElementsByTagNameNS(uengineNs, 'variable')
                            : props.getElementsByTagName('variable');
                        for (let j = 0; j < variableEls.length; j++) {
                            const v = variableEls[j];
                            const name = v.getAttribute('name') || v.getAttributeNS(uengineNs, 'name') || '';
                            const type = v.getAttribute('type') || v.getAttributeNS(uengineNs, 'type') || 'Text';
                            const jsonEl = v.getElementsByTagNameNS(uengineNs, 'json')[0] || v.getElementsByTagName('json')[0];
                            let defaultValue = null;
                            if (jsonEl && jsonEl.textContent) {
                                try {
                                    const o = JSON.parse(jsonEl.textContent);
                                    defaultValue = o && o.defaultValue != null ? o.defaultValue : null;
                                } catch (_) {}
                            }
                            if (name) vars.push({ name, type, defaultValue });
                        }
                    }
                    return vars;
                } catch (e) {
                    return [];
                }
            }
            if (typeof bpmnDef === 'object') {
                const defs = bpmnDef['bpmn:definitions'];
                if (!defs) return [];
                let processes = defs['bpmn:process'];
                if (!processes) return [];
                processes = ensureArray(processes);
                const collected = [];
                for (const process of processes) {
                    const props = process['bpmn:extensionElements']?.['uengine:properties'];
                    if (!props) continue;
                    const vars = props['uengine:variable'];
                    if (!vars) continue;
                    const arr = ensureArray(vars);
                    for (const v of arr) {
                        const name = v.name ?? v['@_name'] ?? '';
                        const type = v.type ?? v['@_type'] ?? 'Text';
                        let defaultValue = null;
                        if (v['uengine:json']) {
                            try {
                                const o = typeof v['uengine:json'] === 'string' ? JSON.parse(v['uengine:json']) : v['uengine:json'];
                                defaultValue = o && o.defaultValue != null ? o.defaultValue : null;
                            } catch (_) {}
                        }
                        if (name) collected.push({ name, type, defaultValue });
                    }
                }
                return collected;
            }
            return [];
        },
        getInitialVariableSetsForTask(taskId) {
            if (!this.initialVariableSetsByTask[taskId]) this.initialVariableSetsByTask[taskId] = [];
            return this.initialVariableSetsByTask[taskId];
        },
        addInitialVariableSet(taskId) {
            if (!this.initialVariableSetsByTask[taskId]) this.initialVariableSetsByTask[taskId] = [];
            const defs = this.processVariableDefinitions || [];
            const values = {};
            defs.forEach((d) => { values[d.name] = d.defaultValue != null ? d.defaultValue : ''; });
            this.initialVariableSetsByTask[taskId].push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                name: '',
                values
            });
        },
        removeInitialVariableSet(taskId, setId) {
            if (!this.initialVariableSetsByTask[taskId]) return;
            this.initialVariableSetsByTask[taskId] = this.initialVariableSetsByTask[taskId].filter((s) => s.id !== setId);
        },
        async applyInitialVariableSet(task, set) {
            const me = this;
            const instId = task.instId != null ? String(task.instId) : me.instanceId;
            if (!instId || !set || !set.values) return;
            await me.$try({
                context: me,
                action: async () => {
                    for (const [varName, value] of Object.entries(set.values)) {
                        await me.backend.setVariable(instId, varName, value);
                    }
                },
                successMsg: me.$t('successMsg.saved') || '초기 변수 적용됨'
            });
        },
        isBeforeAfterFormat(val) {
            return val && typeof val === 'object' && ('before' in val || 'after' in val) && !Array.isArray(val);
        },
        formatVarValue(val) {
            if (val === undefined || val === null) return '—';
            if (typeof val === 'object' && val !== null && !this.isBeforeAfterFormat(val)) return JSON.stringify(val);
            if (String(val).trim() === '') return '—';
            return val;
        },
        toggleExpandedTaskForVariables(taskId) {
            this.expandedTaskIdForVariables = this.expandedTaskIdForVariables === taskId ? null : taskId;
        },
        async loadUnitTestFile() {
            const me = this;
            if (!me.definitionId || !me.backend?.getRawDefinition) return;
            me.$try({
                context: me,
                action: async () => {
                    const raw = await me.backend.getRawDefinition(`unitTests/${me.definitionId}`, { type: 'unit' });
                    if (!raw) return;
                    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!data || typeof data !== 'object') return;
                    const trcToTask = {};
                    (me.taskList || []).forEach((t) => {
                        if (t.trcTag) trcToTask[t.trcTag] = t.taskId;
                    });
                    const next = {};
                    for (const [trcTag, sets] of Object.entries(data)) {
                        if (!Array.isArray(sets)) continue;
                        const taskId = trcToTask[trcTag];
                        if (taskId) next[taskId] = sets.map((s) => ({ ...s, id: s.id || Date.now().toString(36) + Math.random().toString(36).slice(2) }));
                    }
                    me.initialVariableSetsByTask = next;
                },
                successMsg: me.$t('TestProcess.loadUnitTestSuccess') || '변수 세트를 불러왔습니다.',
                errorMsg: me.$t('TestProcess.loadUnitTestError') || '변수 세트 불러오기 실패'
            });
        },
        async saveUnitTestFile() {
            const me = this;
            if (!me.definitionId || !me.backend?.putRawDefinition) return;
            me.$try({
                context: me,
                action: async () => {
                    const taskList = me.taskList || [];
                    const taskIdToTrc = {};
                    taskList.forEach((t) => {
                        if (t.trcTag && t.taskId) taskIdToTrc[t.taskId] = t.trcTag;
                    });
                    const data = {};
                    for (const [taskId, sets] of Object.entries(me.initialVariableSetsByTask || {})) {
                        const trcTag = taskIdToTrc[taskId];
                        if (trcTag && Array.isArray(sets) && sets.length) {
                            data[trcTag] = sets.map((s) => ({ id: s.id, name: s.name, values: { ...(s.values || {}) } }));
                        }
                    }
                    await me.backend.putRawDefinition(JSON.stringify(data), `unitTests/${me.definitionId}.unit`, { type: 'unit' });
                },
                successMsg: me.$t('TestProcess.saveUnitTestSuccess') || '변수 세트를 저장했습니다.',
                errorMsg: me.$t('TestProcess.saveUnitTestError') || '변수 세트 저장 실패'
            });
        },
        async onNavigateToTask(payload) {
            const me = this;
            if (!payload || !payload.instanceId || !payload.tracingTag) return;
            if (!me.backend?.advanceToActivity) return;
            me.$try({
                context: me,
                action: async () => {
                    await me.backend.advanceToActivity(
                        String(payload.instanceId),
                        payload.tracingTag,
                        { maxAttempts: 30 }
                    );
                    const taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                    me.taskList = taskInfo;
                    me.setTaskInfo();
                    await me.setStatus();
                },
                successMsg: me.$t('TestProcess.navigateToTaskSuccess') || '해당 태스크로 이동했습니다.'
            });
        },
        startNewInstance() {
            this.lastExecuteResult = null;
            this.startProcess();
        },
        getWorklistSignature(taskList) {
            if (!taskList || !Array.isArray(taskList)) return '';
            return taskList.map(t => t.taskId).sort().join(',');
        },
        async refreshProcessIfChanged() {
            const me = this;
            if (!me.instanceId || !me.backend) return;
            try {
                const taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                const prevSig = me.getWorklistSignature(me.taskList);
                const nextSig = me.getWorklistSignature(taskInfo);
                if (prevSig === nextSig) return;
                me.taskList = taskInfo;
                me.setTaskInfo();
                await me.setStatus();
            } catch (_) {}
        },
        async refreshProcess() {
            let me = this;
            me.setTaskInfo();
            let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
            me.taskList = taskInfo;
            await me.setStatus();
        },
        async getRecordList() {
            const recordList = await this.backend.testRecordList(this.definitionId);
            this.recordedProcess = recordList;
        },
        async addWorkItem(item, taskId) {
            let me = this;
            this.workItem[taskId] = item;
            console.log(item);
            if (item.worklist.instId != item.worklist.rootInstId) {
                let tasks = await me.backend.getActivitiesStatus(item.worklist.instId);
                if (!me.subCurrentActivities) me.subCurrentActivities = {};
                Object.keys(tasks).forEach(function (task) {
                    if(!me.subCurrentActivities[item.worklist.instId]) me.subCurrentActivities[item.worklist.instId] = []
                    // me.workItem = await me.backend.getWorkItem(task.taskId);
                    me.subCurrentActivities[item.worklist.instId].push(task);
                });
                // me.subCurrentActivities[item.worklist.instId] = tasks;

                if (me.subBpmn == null) me.subBpmn = {};
                me.subBpmn[item.worklist.instId] = await me.backend.getRawDefinition(item.worklist.defId, { type: 'bpmn' });
                await me.setStatus();
                me.updatedDefKey++;

                
                // me.subCurrentActivities ?  : me.subCurrentActivities
            }
        },
        executeTestProcess(testData, task) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const sets = me.getInitialVariableSetsForTask(task.taskId) || [];
                    const instId = task.instId != null ? String(task.instId) : me.instanceId;
                    if (instId && me.backend?.setVariable) {
                        for (const set of sets) {
                            if (set.values && typeof set.values === 'object') {
                                for (const [varName, val] of Object.entries(set.values)) {
                                    if (varName != null && val !== undefined && val !== '') {
                                        await me.backend.setVariable(instId, varName, val);
                                    }
                                }
                            }
                        }
                    }
                    // Form은 Variable부터 Set
                    let value;
                    if (this.tool == 'FormWorkItem') {
                        me.saveForm(testData, task);
                    }
                    if (testData.parameterValues) value = testData;
                    else value = { parameterValues: testData };

                    if (task?.execScope) value.execScope = task.execScope;
                    let result = await me.backend.putWorkItemComplete(task.taskId, value, me.isSimulate);
                    me.lastExecuteResult = result && typeof result === 'object' ? result : null;
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                    // if (!me.recordedProcess) {
                    //     me.recordedProcess = [];
                    // }
                    // me.recordedProcess.push({
                    //     trcTag: task.trcTag,
                    //     workItem: value
                    // });
                    
                    me.taskList = taskInfo;
                    me.setTaskInfo();
                    
                    await me.setStatus();
                    
                },
                successMsg: this.$t('successMsg.workCompleted')
            });
            
        },
        async executeRecordProcess(process) {
            let me = this;
            let recordProcess = JSON.parse(process);
            console.log(recordProcess);
            for (const item of recordProcess) {
                let taskId;
                let currentTask;
                let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                me.taskList = taskInfo;
                for (let task of me.taskList) {
                    if (task.trcTag === item.tracingTag) {
                        taskId = task.taskId;
                        currentTask = task;
                        break;
                    }
                }

                let value;
                if (this.tool == 'FormWorkItem') {
                    me.saveForm(item.workItem, currentTask);
                }
                if (item.workItem.parameterValues) value = item.workItem;
                else value = { parameterValues: item.workItem };

                if(taskId) {
                    await me.backend.putWorkItemComplete(taskId, value, me.isSimulate);
                } else {
                    while (!taskId) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                        taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                        me.taskList = taskInfo;
                        for (let task of me.taskList) {
                            if (task.trcTag === item.tracingTag) {
                                taskId = task.taskId;
                                break;
                            }
                        }
                    }
                    await me.backend.putWorkItemComplete(taskId, value, me.isSimulate);
                }
            }

            this.setTaskInfo();
            await me.setStatus();
        },
        async deleteRecordProcess(key) {
            await this.backend.deleteRecordTest(this.definitionId, key);
            await this.getRecordList();
        },
        async saveForm(testData, task) {
            let me = this;

            let varName = me.workItem[task.taskId].activity.variableForHtmlFormContext.name;
            let variable = {};

            variable._type = 'org.uengine.contexts.HtmlFormContext';
            let tmp;
            Object.keys(testData).forEach(function (key) {
                tmp = testData[key];
            });

            variable.valueMap = tmp;
            Object.keys(variable.valueMap).forEach((key) => {
                if (Array.isArray(variable.valueMap[key])) {
                    if (!variable.valueMap[key]) return;
                    variable.valueMap[key]?.forEach((item) => {
                        if (item && item._type) {
                            item._type = 'java.util.HashMap';
                        }
                    });
                }
            });
            // variable.valueMap._type = 'java.util.HashMap';

            await me.backend.setVariableWithTaskId(me.instanceId, task.taskId, varName, variable);
            // Delete a specific key from the JSON object
            const keyToDelete = 'specificKey'; // Replace 'specificKey' with the actual key you want to delete
            if (me.workItem.hasOwnProperty(task.taskId)) {
                delete me.workItem[task.taskId];
            }
        },
        setStatus() {
            let me = this;
            if(me.subBpmn) {
                Object.keys(me.subBpmn).forEach(async function (instId) {
                    me.subTaskStatus[instId] = await me.backend.getActivitiesStatus(instId);
                    me.bpmnKey++;
                    me.subBpmnKey++;
                    me.updatedDefKey++;
                });
            }
        },
        startProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    console.log(me.isSimulate);
                    let command = {
                        processDefinitionId: me.definitionId,
                        simulation: true
                    };
                    let result = await me.backend.start(command);
                    this.instanceId = result.instanceId;
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(result.instanceId);
                    me.taskList = taskInfo;
                    me.bpmn = await me.backend.getRawDefinition(me.taskList[0].defId, { type: 'bpmn' });
                    me.setTaskInfo();
                }
            });
        },
        async setEventList() {
            let me = this;
            this.eventList = await me.backend.getEventList(this.instanceId);
        },
        async setTaskInfo() {
            let me = this;

            me.workListByInstId = await me.backend.getWorkListByInstId(me.instanceId);
            // me.updatedDefKey++;
            // me.taskList.forEach(function (task) {
            //     console.log(task);
            //     // me.workItem = await me.backend.getWorkItem(task.taskId);
            //     me.currentActivities.push(task.trcTag);
            // });
            me.setEventList();
            let tasks = await me.backend.getActivitiesStatus(me.instanceId);
            console.log(tasks);
            Object.keys(tasks).forEach(function (task) {
                console.log(task);
                // me.workItem = await me.backend.getWorkItem(task.taskId);
                me.currentActivities.push(task);
            });
            // let me = this;
            // me.currentActivities = [];
            // me.workItem = await me.backend.getWorkItem(me.taskId);

            me.taskStatus = tasks;
            me.bpmnKey++;
            me.updatedDefKey++;
            me.processVariableDefinitions = me.getProcessVariableDefinitions(me.bpmn) || [];
            me.loadUnitTestFile();
        },
        async fireMessage(event) {
            let me = this;
            await me.backend.fireMessage(me.instanceId, event);
            let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
            me.taskList = taskInfo;
            me.setTaskInfo();
        },
        handleCardClick(testRecord) {
            console.log('Card clicked:', testRecord);
            this.recodingDialog = true;
            this.testRecord = testRecord;
        }
    }
};
</script>

<style scoped>
.test-process-result-card {
    border: 1px solid rgba(var(--v-theme-primary), 0.2);
}
.test-process-result-card .v-card-title {
    min-height: 40px;
}
.test-process-var-row td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.test-process-var-row:last-child td {
    border-bottom: none;
}
.test-process-task-card {
    border: 1px solid rgba(0, 0, 0, 0.08);
}
.test-process-record-table tbody tr:hover {
    background: rgba(0, 0, 0, 0.02);
}
</style>

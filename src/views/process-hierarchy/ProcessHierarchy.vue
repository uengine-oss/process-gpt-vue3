<template>
    <div class="process-hierarchy-container">
        <!-- Left Panel: Tree -->
        <div class="hierarchy-left-panel" :style="{ width: leftPanelWidth + 'px' }">
            <ProcessHierarchyTree
                :procMap="procMap"
                :metricsMap="metricsMap"
                :definitionList="definitionList"
                :selectedId="selectedProcessId"
                @select="handleSelectProcess"
            />
            <div class="resize-handle-left" @mousedown="startResizeLeft"></div>
        </div>

        <!-- Center Panel: BPMN Designer -->
        <div class="hierarchy-center-panel">
            <ProcessHierarchyDesigner
                ref="designer"
                :bpmn="bpmnXml"
                :processName="selectedProcessName"
                :processDefinition="processDefinition"
                :definitionPath="selectedProcessId"
                :definitionList="definitionList"
                :loading="loading"
                @openPanel="handleOpenPanel"
                @updateXml="handleUpdateXml"
                @definition="handleDefinition"
                @save="handleSave"
                @clone="handleClone"
                @versionHistory="handleVersionHistory"
            />
        </div>

        <!-- Right Panel: Properties -->
        <div v-if="showProperties" class="hierarchy-right-panel" :style="{ width: rightPanelWidth + 'px' }">
            <div class="resize-handle-right" @mousedown="startResizeRight"></div>
            <ProcessHierarchyProperties
                :processDefinition="processDefinition"
                :element="selectedElement"
                :isViewMode="false"
                :roles="roles"
                :processVariables="processVariables"
                :definitionPath="selectedProcessId"
                :definition="bpmnDefinitions"
                @save="handlePropertiesSave"
                @close="handleCloseProperties"
            />
        </div>

        <!-- Toggle Properties Button -->
        <v-btn
            v-if="!showProperties && selectedProcessId"
            icon
            size="small"
            class="toggle-properties-btn"
            @click="showProperties = true"
        >
            <v-icon>mdi-chevron-left</v-icon>
        </v-btn>

        <!-- Version History Dialog -->
        <process-definition-version-dialog
            v-if="versionDialog"
            :process="processDefinition"
            :open="versionDialog"
            :definitionPath="selectedProcessId"
            :processName="selectedProcessName"
            :type="'bpmn'"
            :currentBpmn="bpmnXml"
            @close="versionDialog = false"
            @save="handleVersionSave"
        />

        <!-- Approval Warning Dialog -->
        <v-dialog v-model="approvalWarningDialog" max-width="460" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
                    {{ $t('approval.inProgressTitle') || '승인 진행 중' }}
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="mb-3">{{ $t('approval.inProgressMessage') || '현재 이 프로세스에 대해 승인이 진행 중입니다. 저장하면 기존 승인이 취소되고 새로 검토 요청됩니다.' }}</p>
                    <v-alert v-if="activeApprovalState" type="info" variant="tonal" density="compact">
                        <div class="text-body-2">
                            <strong>{{ $t('approval.currentState') || '현재 상태' }}:</strong> {{ activeApprovalState.state }}
                        </div>
                        <div v-if="activeApprovalState.version" class="text-body-2">
                            <strong>{{ $t('approval.version') || '버전' }}:</strong> v{{ activeApprovalState.version }}
                        </div>
                        <div v-if="activeApprovalState.submitted_by" class="text-body-2">
                            <strong>{{ $t('approval.submittedBy') || '제출자' }}:</strong> {{ activeApprovalState.submitted_by }}
                        </div>
                    </v-alert>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="approvalWarningDialog = false; activeApprovalState = null;">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="warning" variant="flat" @click="proceedAfterApprovalWarning">
                        {{ $t('approval.cancelAndSave') || '기존 승인 취소 후 저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Save & Version Dialog -->
        <v-dialog v-model="saveVersionDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-content-save-check</v-icon>
                    {{ $t('processHierarchy.saveVersion') || '버전 저장' }}
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="saveVersionDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <div class="d-flex align-center mb-4 pa-3 rounded-lg" style="background: #f5f7fa;">
                        <v-icon size="18" class="mr-2" color="grey-darken-1">mdi-tag-outline</v-icon>
                        <span class="text-body-2 text-medium-emphasis">{{ $t('processHierarchy.currentVersion') || '현재 버전' }}:</span>
                        <v-chip size="small" color="primary" variant="flat" class="ml-2">v{{ saveVersion }}</v-chip>
                    </div>
                    <v-textarea
                        v-model="saveVersionMessage"
                        :label="$t('processHierarchy.changeNote') || '변경 사항 메모'"
                        :placeholder="$t('processHierarchy.changeNotePlaceholder') || '이 버전에서 변경된 내용을 간단히 기록하세요'"
                        variant="outlined"
                        density="compact"
                        rows="2"
                        hide-details
                        class="mb-3"
                    />
                    <v-checkbox
                        v-model="submitReviewAfterSave"
                        :label="$t('processHierarchy.submitForReviewAfterSave') || '저장 후 검토 요청'"
                        color="primary"
                        density="compact"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="saveVersionDialog = false" :disabled="savingVersion">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="confirmSaveVersion" :loading="savingVersion">
                        <v-icon start>mdi-content-save</v-icon>
                        {{ $t('processHierarchy.saveAndContinue') || '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import ProcessHierarchyDesigner from './ProcessHierarchyDesigner.vue';
import ProcessHierarchyProperties from './ProcessHierarchyProperties.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import { useBpmnStore } from '@/stores/bpmn';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'ProcessHierarchy',
    components: {
        ProcessHierarchyTree,
        ProcessHierarchyDesigner,
        ProcessHierarchyProperties,
        ProcessDefinitionVersionDialog,
    },
    data() {
        return {
            procMap: null,
            metricsMap: null,
            definitionList: [],
            selectedProcessId: '',
            selectedProcessName: '',
            bpmnXml: '',
            processDefinition: null,
            bpmnDefinitions: null,
            selectedElement: null,
            roles: [],
            processVariables: [],
            loading: false,
            showProperties: true,
            versionDialog: false,
            // Save & Version dialog
            saveVersionDialog: false,
            saveVersionTag: 'minor',
            saveVersionMessage: '',
            submitReviewAfterSave: true,
            latestVersion: '0.0',
            savingVersion: false,
            pendingSaveXml: '',
            // Approval warning
            approvalWarningDialog: false,
            activeApprovalState: null,
            leftPanelWidth: 280,
            rightPanelWidth: 340,
            resizing: null,
            resizeStartX: 0,
            resizeStartWidth: 0,
            selectionListenerCleanup: null,
        };
    },
    async mounted() {
        await this.loadInitialData();
        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
        if (this.selectionListenerCleanup) {
            this.selectionListenerCleanup();
            this.selectionListenerCleanup = null;
        }
    },
    computed: {
        saveVersion() {
            // 저장 시에는 버전을 올리지 않음. 최초 저장만 0.1
            const base = this.latestVersion;
            if (!base || base === '0.0') return '0.1';
            return base;
        },
    },
    methods: {
        async loadInitialData() {
            this.loading = true;
            try {
                const [procMapResult, metricsResult, defList, versionList] = await Promise.all([
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap(),
                    backend.listDefinition('', { match: { tenant_id: window.$tenantName } }),
                    storage.list('proc_def_version', {
                        sort: 'desc',
                        orderBy: 'timeStamp',
                    }),
                ]);
                this.procMap = procMapResult;
                this.metricsMap = metricsResult;

                // 각 정의의 최신 버전 매핑
                const latestVersionMap = {};
                if (versionList && versionList.length > 0) {
                    versionList.forEach(v => {
                        const defId = v.proc_def_id;
                        if (defId && !latestVersionMap[defId]) {
                            latestVersionMap[defId] = v.version;
                        }
                    });
                }
                const defs = defList || [];
                defs.forEach(def => {
                    const id = def.id || def.file_name;
                    if (id && latestVersionMap[id]) {
                        def.version = latestVersionMap[id];
                    }
                });
                this.definitionList = defs;
            } catch (e) {
                console.error('Failed to load initial data:', e);
            } finally {
                this.loading = false;
            }
        },

        async handleSelectProcess(id, name) {
            if (this.selectedProcessId === id) return;

            // 이전 element 선택 초기화
            this.selectedElement = null;
            this.selectedProcessId = id;
            this.selectedProcessName = name;
            await this.loadProcess(id);
        },

        async loadProcess(id) {
            if (!id) return;
            this.loading = true;
            this.bpmnXml = '';
            try {
                // definitionList에서 해당 프로세스 찾기
                const def = this.definitionList.find(d => d.id === id || d.file_name === id);

                if (def) {
                    this.processDefinition = def;
                    this.bpmnXml = def.bpmn || '';
                    this.processVariables = def.definition?.data || [];

                    // roles 추출 (definition에서 가져오기)
                    if (def.definition?.roles) {
                        this.roles = def.definition.roles;
                    } else {
                        this.roles = [];
                    }
                } else {
                    this.processDefinition = null;
                    this.bpmnXml = '';
                    this.processVariables = [];
                    this.roles = [];
                }
            } catch (e) {
                console.error('Failed to load process:', e);
                this.processDefinition = null;
                this.bpmnXml = '';
            } finally {
                this.loading = false;
            }
        },

        handleOpenPanel(elementId) {
            if (!elementId) return;
            if (elementId.startsWith('Collaboration_') || elementId.startsWith('Process_')) {
                this.selectedElement = null;
                return;
            }

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const elementRegistry = modeler.get('elementRegistry');
            if (!elementRegistry) return;

            const element = elementRegistry.get(elementId);
            if (!element) {
                this.selectedElement = null;
                return;
            }

            // Extend uEngine properties if needed (businessObject 전달)
            const bpmnVue = this.$refs.designer?.$refs?.bpmnVue;
            if (bpmnVue && bpmnVue.extendUEngineProperties) {
                bpmnVue.extendUEngineProperties({ businessObject: element.businessObject });
            }

            this.selectedElement = element;
            this.showProperties = true;
        },

        handleDefinition(def) {
            this.bpmnDefinitions = def;
            // BPMN definitions 로드 완료 → selection 리스너 등록
            this.setupSelectionListener();
        },

        setupSelectionListener() {
            // 이전 리스너 정리
            if (this.selectionListenerCleanup) {
                this.selectionListenerCleanup();
                this.selectionListenerCleanup = null;
            }

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const eventBus = modeler.get('eventBus');
            if (!eventBus) return;

            // element 클릭(선택) 시 자동으로 Properties 패널에 반영
            const onSelectionChanged = (event) => {
                const newSelection = event.newSelection || [];
                if (newSelection.length === 1) {
                    const element = newSelection[0];
                    // Root element 무시
                    if (element.type === 'bpmn:Process' || element.type === 'bpmn:Collaboration') {
                        this.selectedElement = null;
                        return;
                    }
                    // extendUEngineProperties 호출 (businessObject 전달)
                    const bpmnVue = this.$refs.designer?.$refs?.bpmnVue;
                    if (bpmnVue && bpmnVue.extendUEngineProperties) {
                        bpmnVue.extendUEngineProperties({ businessObject: element.businessObject });
                    }
                    this.selectedElement = element;
                    this.showProperties = true;
                } else if (newSelection.length === 0) {
                    this.selectedElement = null;
                }
            };

            eventBus.on('selection.changed', onSelectionChanged);

            this.selectionListenerCleanup = () => {
                eventBus.off('selection.changed', onSelectionChanged);
            };
        },

        handleCloseProperties() {
            this.selectedElement = null;
        },

        handleUpdateXml(xml) {
            this.bpmnXml = xml;
        },

        async handleSave() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                this.pendingSaveXml = xml;

                // 최신 버전 조회
                const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                    sort: 'desc',
                    orderBy: 'version',
                });
                if (versions && versions.length > 0) {
                    const sorted = versions.sort((a, b) => {
                        const [aM, am] = String(a.version).split('.').map(Number);
                        const [bM, bm] = String(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                    });
                    this.latestVersion = String(sorted[0].version);
                } else {
                    this.latestVersion = '0.0';
                }

                // 활성 승인 건 체크
                try {
                    const activeApproval = await backend.getActiveApprovalState(this.selectedProcessId);
                    if (activeApproval) {
                        this.activeApprovalState = activeApproval;
                        this.approvalWarningDialog = true;
                        return;
                    }
                } catch (e) {
                    console.warn('승인 상태 확인 실패:', e);
                }

                // 다이얼로그 초기화 후 열기
                this.saveVersionTag = 'minor';
                this.saveVersionMessage = '';
                this.submitReviewAfterSave = true;
                this.saveVersionDialog = true;
            } catch (e) {
                console.error('Save preparation failed:', e);
                if (this.$toast) {
                    this.$toast.error('저장 준비에 실패했습니다.');
                }
            }
        },

        updateXmlVersion(xml, version) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, 'application/xml');
                const ns = 'http://uengine';
                const props = doc.getElementsByTagNameNS(ns, 'properties');
                for (let i = 0; i < props.length; i++) {
                    const el = props[i];
                    // process-level properties (direct child of extensionElements under bpmn:process)
                    const parent = el.parentElement;
                    if (!parent || parent.localName !== 'extensionElements') continue;
                    const grandParent = parent.parentElement;
                    if (!grandParent || grandParent.localName !== 'process') continue;

                    const jsonAttr = el.getAttribute('json');
                    if (jsonAttr) {
                        try {
                            const obj = JSON.parse(jsonAttr);
                            obj.version = version;
                            el.setAttribute('json', JSON.stringify(obj));
                        } catch (e) {
                            console.warn('Failed to parse uengine:properties json:', e);
                        }
                    }
                }
                const serializer = new XMLSerializer();
                return serializer.serializeToString(doc);
            } catch (e) {
                console.warn('updateXmlVersion failed, using original xml:', e);
                return xml;
            }
        },

        proceedAfterApprovalWarning() {
            this.approvalWarningDialog = false;
            this.activeApprovalState = null;
            // 승인 취소는 submitForReview에서 자동 처리됨 → 저장 다이얼로그 열기
            this.saveVersionTag = 'minor';
            this.saveVersionMessage = '';
            this.submitReviewAfterSave = true;
            this.saveVersionDialog = true;
        },

        async confirmSaveVersion() {
            this.savingVersion = true;
            try {
                const version = this.saveVersion;
                // BPMN XML 내부 uengine:properties의 version 필드 업데이트
                const xml = this.updateXmlVersion(this.pendingSaveXml, version);
                this.bpmnXml = xml;

                // 버전 정보 포함하여 저장 (같은 버전으로 덮어쓰기)
                await (backend).putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition: this.processDefinition?.definition || null,
                    version: version,
                    version_tag: null,
                    arcv_id: `${this.selectedProcessId}_${version}`,
                    message: this.saveVersionMessage || null,
                });

                // 검토 요청 (버전 정보 포함)
                if (this.submitReviewAfterSave) {
                    try {
                        await (backend).submitForReview(this.selectedProcessId, this.saveVersionMessage || undefined, version);
                    } catch (reviewErr) {
                        console.warn('submitForReview failed (may already be in review):', reviewErr);
                    }
                }

                this.saveVersionDialog = false;

                if (this.$toast) {
                    const msg = this.submitReviewAfterSave
                        ? (this.$t('processHierarchy.savedAndSubmitted') || `v${version} 저장 및 검토 요청 완료`)
                        : (this.$t('successMsg.save') || '저장되었습니다.');
                    this.$toast.success(msg);
                }

                // definitionList 갱신
                await this.loadInitialData();
            } catch (e) {
                console.error('Save failed:', e);
                if (this.$toast) {
                    this.$toast.error('저장에 실패했습니다.');
                }
            } finally {
                this.savingVersion = false;
            }
        },

        async handleClone() {
            if (!this.selectedProcessId || !this.processDefinition) return;
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                let currentBpmn = this.bpmnXml;
                if (modeler) {
                    const { xml } = await modeler.saveXML({ format: true });
                    currentBpmn = xml;
                }

                const newName = (this.selectedProcessName || 'Process') + ' (Copy)';
                const result = await (backend).duplicateLocalProcess(
                    this.selectedProcessId,
                    newName,
                    currentBpmn,
                    this.processDefinition
                );

                if (result && result.success) {
                    if (this.$toast) {
                        this.$toast.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
                    }
                    await this.loadInitialData();
                }
            } catch (e) {
                console.error('Clone failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('ProcessMenu.duplicateFailed') || '프로세스 복사에 실패했습니다.');
                }
            }
        },

        handleVersionHistory() {
            // Version Comparison 페이지로 이동
            this.$router.push({
                path: '/version-comparison',
                query: { processId: this.selectedProcessId },
            });
        },

        async handleVersionSave(info) {
            this.versionDialog = false;
            await this.handleSave();
        },

        async handlePropertiesSave(data) {
            if (!this.processDefinition) return;
            try {
                if (data.name) this.selectedProcessName = data.name;
                Object.assign(this.processDefinition, data);
                await this.handleSave();
            } catch (e) {
                console.error('Properties save failed:', e);
            }
        },

        // Resize handlers
        startResizeLeft(e) {
            this.resizing = 'left';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.leftPanelWidth;
            e.preventDefault();
        },
        startResizeRight(e) {
            this.resizing = 'right';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.rightPanelWidth;
            e.preventDefault();
        },
        onResize(e) {
            if (!this.resizing) return;
            if (this.resizing === 'left') {
                const diff = e.clientX - this.resizeStartX;
                this.leftPanelWidth = Math.max(200, Math.min(500, this.resizeStartWidth + diff));
            } else if (this.resizing === 'right') {
                const diff = this.resizeStartX - e.clientX;
                this.rightPanelWidth = Math.max(250, Math.min(500, this.resizeStartWidth + diff));
            }
        },
        stopResize() {
            this.resizing = null;
        },
    },
};
</script>

<style scoped>
.process-hierarchy-container {
    display: flex;
    height: calc(100vh - 125px);
    overflow: hidden;
    position: relative;
    background: #fafafa;
}

.hierarchy-left-panel {
    position: relative;
    flex-shrink: 0;
    border-right: 1px solid #e0e0e0;
    overflow: hidden;
}

.hierarchy-center-panel {
    flex: 1;
    min-width: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.hierarchy-right-panel {
    position: relative;
    flex-shrink: 0;
    border-left: 1px solid #e0e0e0;
    overflow-y: auto;
}

.resize-handle-left {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-left:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.resize-handle-right {
    position: absolute;
    top: 0;
    left: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-right:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.toggle-properties-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
}
</style>

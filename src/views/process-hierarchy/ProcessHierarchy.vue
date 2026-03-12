<template>
    <v-card elevation="10" class="process-hierarchy-container rounded-xl">
        <!-- Left Panel: Tree -->
        <div class="hierarchy-left-panel" :style="{ width: isLeftCollapsed ? '40px' : leftPanelWidth + 'px' }">
            <!-- Collapsed Mini Bar -->
            <div v-if="isLeftCollapsed" class="collapsed-sidebar">
                <v-tooltip v-for="item in collapsedMenuItems" :key="item.icon" location="right">
                    <template v-slot:activator="{ props }">
                        <div
                            v-bind="props"
                            class="collapsed-menu-icon"
                            :class="{ 'collapsed-menu-icon--active': item.active }"
                            @click="item.action"
                        >
                            <v-icon size="18" :color="item.active ? 'primary' : 'grey-darken-1'">{{ item.icon }}</v-icon>
                        </div>
                    </template>
                    <div class="collapsed-tooltip-content">
                        <div class="font-weight-bold text-body-2">{{ item.name }}</div>
                        <div class="text-caption" style="opacity: 0.85;">{{ item.desc }}</div>
                    </div>
                </v-tooltip>
                <v-divider class="my-1" style="width: 24px; opacity: 0.3;" />
                <v-tooltip location="right">
                    <template v-slot:activator="{ props }">
                        <div v-bind="props" class="collapsed-menu-icon" @click="toggleLeftPanel">
                            <v-icon size="18" color="grey-darken-1">mdi-chevron-right</v-icon>
                        </div>
                    </template>
                    <span class="text-caption">{{ $t('processHierarchy.expandPanel') || '패널 펼치기' }}</span>
                </v-tooltip>
            </div>
            <!-- Full Tree -->
            <template v-else>
                <ProcessHierarchyTree
                    :procMap="procMap"
                    :metricsMap="metricsMap"
                    :definitionList="definitionList"
                    :selectedId="selectedProcessId"
                    :collapsed="false"
                    @select="handleSelectProcess"
                    @openPermission="handleOpenPermission"
                />
                <div class="resize-handle-left" @mousedown="startResizeLeft"></div>
            </template>
            <!-- Toggle Button -->
            <v-btn
                icon
                size="x-small"
                variant="text"
                class="collapse-toggle-btn"
                @click="toggleLeftPanel"
            >
                <v-icon size="16">{{ isLeftCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-left' }}</v-icon>
            </v-btn>
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
                :recoveryBackup="recoveryBackup"
                @openPanel="handleOpenPanel"
                @updateXml="handleUpdateXml"
                @definition="handleDefinition"
                @save="handleSave"
                @clone="handleClone"
                @versionHistory="handleVersionHistory"
                @toggleWip="handleToggleWip"
                @dismissBackup="dismissBackup"
                @recoverBackup="recoverFromBackup"
            />
        </div>

        <!-- Right Panel: Properties -->
        <div v-if="showProperties && selectedProcessId" class="hierarchy-right-panel" :style="{ width: rightPanelWidth + 'px' }">
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
                @focusElement="handleFocusElement"
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

        <!-- [6.3.1] Version Conflict Dialog -->
        <v-dialog v-model="conflictDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="error">mdi-alert-decagram</v-icon>
                    {{ $t('processHierarchy.versionConflict') || '버전 충돌' }}
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    {{ $t('processHierarchy.conflictMessage') || '다른 사용자가 이미 같은 버전을 저장했습니다. 새 Draft(v0.1)로 저장하시겠습니까?' }}
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="conflictDialog = false">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="forceSaveAsNewDraft">
                        {{ $t('processHierarchy.saveAsNewDraft') || '새 Draft로 저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <!-- Permission Dialog -->
        <v-dialog v-model="permissionDialog" max-width="560" persistent>
            <PermissionDialog
                v-if="permissionDialog && permissionProcess"
                :procDef="permissionProcess"
                :processMap="procMap"
                :metricsMap="metricsMap"
                @close:permissionDialog="permissionDialog = false"
                @saved="permissionDialog = false"
            />
        </v-dialog>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { saveBackup, getBackup, deleteBackup } from '@/utils/localBackup';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import ProcessHierarchyDesigner from './ProcessHierarchyDesigner.vue';
import ProcessHierarchyProperties from './ProcessHierarchyProperties.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import PermissionDialog from '@/components/apps/definition-map/PermissionDialog.vue';
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
        PermissionDialog,
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
            // [6.2.1-2] Local backup recovery
            recoveryBackup: null,
            // Left panel collapse
            isLeftCollapsed: false,
            savedLeftWidth: 280,
            // [6.3.1] Version conflict
            conflictDialog: false,
            // Permission dialog
            permissionDialog: false,
            permissionProcess: null,
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
        // Auto-select process from query parameter (from Process Architecture navigation)
        const queryId = this.$route?.query?.id;
        const queryName = this.$route?.query?.name;
        if (queryId) {
            await this.handleSelectProcess(queryId, queryName || queryId);
        }
        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
        // [6.2.1] Offline 감지 → 자동 로컬 백업
        this._offlineHandler = async () => {
            if (this.bpmnXml && this.selectedProcessId) {
                await saveBackup({
                    procDefId: this.selectedProcessId,
                    xml: this.bpmnXml,
                    processName: this.selectedProcessName || '',
                    timestamp: Date.now(),
                });
                console.info('[LocalBackup] Auto-saved due to offline event');
            }
        };
        window.addEventListener('offline', this._offlineHandler);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
        }
        if (this.selectionListenerCleanup) {
            this.selectionListenerCleanup();
            this.selectionListenerCleanup = null;
        }
    },
    computed: {
        collapsedMenuItems() {
            return [
                {
                    icon: 'mdi-file-tree',
                    name: this.$t('processHierarchy.title') || '프로세스 계층도',
                    desc: this.$t('processHierarchy.treeDesc') || '프로세스 트리에서 편집할 프로세스를 선택합니다.',
                    active: !!this.selectedProcessId,
                    action: () => this.toggleLeftPanel(),
                },
                {
                    icon: 'mdi-content-save-outline',
                    name: this.$t('processHierarchy.save') || '저장',
                    desc: this.$t('processHierarchy.saveDesc') || '현재 프로세스를 버전과 함께 저장합니다.',
                    active: false,
                    action: () => { if (this.selectedProcessId) this.handleSave(); },
                },
                {
                    icon: 'mdi-history',
                    name: this.$t('processHierarchy.versionHistory') || '버전 이력',
                    desc: this.$t('processHierarchy.versionHistoryDesc') || '버전 간 차이를 비교하고 이전 버전으로 되돌립니다.',
                    active: false,
                    action: () => { if (this.selectedProcessId) this.handleVersionHistory(); },
                },
                {
                    icon: 'mdi-cog-outline',
                    name: this.$t('processHierarchy.properties') || '속성 패널',
                    desc: this.$t('processHierarchy.propertiesDesc') || '선택된 요소의 속성을 편집합니다.',
                    active: this.showProperties,
                    action: () => { this.showProperties = !this.showProperties; },
                },
            ];
        },
        saveVersion() {
            // 저장할 때마다 minor +1 (거버넌스: Draft 단계에서 저장 시마다 마이너 버전 자동 기록)
            const base = this.latestVersion;
            if (!base || base === '0.0') return '0.1';
            const parts = String(base).split('.');
            const major = parseInt(parts[0]) || 0;
            const minor = (parseInt(parts[1]) || 0) + 1;
            return `${major}.${minor}`;
        },
    },
    methods: {
        async loadInitialData() {
            this.loading = true;
            try {
                const [procMapResult, metricsResult, defList] = await Promise.all([
                    backend.getProcessDefinitionMap({ skipPermissionFilter: true }),
                    backend.getMetricsMap(),
                    backend.listDefinition('', {}),
                ]);
                this.procMap = procMapResult;
                this.metricsMap = metricsResult;

                // 버전/승인 상태는 별도로 조회 (실패해도 목록 표시에 영향 없음)
                let versionList = [];
                let approvalStates = [];
                try {
                    [versionList, approvalStates] = await Promise.all([
                        backend.getLatestVersionMap(),
                        backend.getApprovalStateList(),
                    ]);
                } catch (e) {
                    console.warn('Failed to load version/approval data:', e);
                }

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

                // 각 정의의 최신 승인 상태 매핑
                const approvalMap = {};
                if (approvalStates && approvalStates.length > 0) {
                    approvalStates.forEach(row => {
                        if (row.proc_def_id && !approvalMap[row.proc_def_id]) {
                            approvalMap[row.proc_def_id] = row.state;
                        }
                    });
                }

                const defs = defList || [];
                defs.forEach(def => {
                    const id = def.id || def.file_name;
                    if (id && latestVersionMap[id]) {
                        def.version = latestVersionMap[id];
                    }
                    // WIP flag from definition JSONB
                    const defObj = typeof def.definition === 'string'
                        ? JSON.parse(def.definition || '{}')
                        : (def.definition || {});
                    if (defObj.wip) {
                        def.approval_state = 'wip';
                    }
                    // approval_state 매핑 (proc_def 테이블에 없는 경우 보충)
                    else if (id && approvalMap[id] && !def.approval_state) {
                        const state = approvalMap[id];
                        // proc_def_approval_state의 state 값을 UI 상태로 매핑
                        if (state === 'public_feedback') def.approval_state = 'public_review';
                        else if (state === 'in_review' || state === 'final_edit') def.approval_state = 'review';
                        else if (state === 'published') def.approval_state = 'published';
                        else def.approval_state = state;
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
            this.recoveryBackup = null;
            await this.loadProcess(id);

            // [6.2.2] 로컬 백업 확인
            try {
                const backup = await getBackup(id);
                if (backup) {
                    this.recoveryBackup = backup;
                }
            } catch (e) { /* ignore */ }
        },

        async recoverFromBackup() {
            if (!this.recoveryBackup) return;
            this.bpmnXml = this.recoveryBackup.xml;
            if (this.$toast) {
                this.$toast.success(this.$t('processHierarchy.recoveryApplied') || '로컬 백업이 복구되었습니다. 저장해주세요.');
            }
            this.recoveryBackup = null;
        },

        async dismissBackup() {
            if (this.recoveryBackup) {
                await deleteBackup(this.recoveryBackup.procDefId);
                this.recoveryBackup = null;
            }
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
            this.showProperties = false;
            this.selectedElement = null;
        },

        handleUpdateXml(xml) {
            this.bpmnXml = xml;
        },

        async handleSave() {
            const designer = this.$refs.designer;

            // To-Be 모드에서 저장 시: To-Be XML을 definition.tobe_bpmn에 저장
            if (designer && designer.toBeMode) {
                await this.handleSaveToBe();
                return;
            }

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

        async handleSaveToBe() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler || !this.selectedProcessId) return;

            try {
                const { xml } = await modeler.saveXML({ format: true, preamble: true });

                // definition JSON에 tobe_bpmn 저장
                const currentDef = this.processDefinition?.definition || {};
                const updatedDef = { ...currentDef, tobe_bpmn: xml };

                const supabase = window.$supabase;
                if (supabase) {
                    await supabase
                        .from('proc_def')
                        .update({ definition: updatedDef })
                        .eq('id', this.selectedProcessId);
                }

                // 로컬 상태 업데이트
                if (this.processDefinition) {
                    this.processDefinition.definition = updatedDef;
                }
                // designer의 toBeBlueprintXml도 동기화
                const designer = this.$refs.designer;
                if (designer) designer.toBeBlueprintXml = xml;

                if (this.$toast) {
                    this.$toast.success('To-Be Blueprint가 저장되었습니다.');
                }
            } catch (e) {
                console.error('To-Be save failed:', e);
                if (this.$toast) {
                    this.$toast.error('To-Be Blueprint 저장에 실패했습니다.');
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

        async captureThumbnail() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return null;
                const { svg } = await modeler.saveSVG();
                // SVG → Canvas → base64 PNG (max 320px wide)
                return await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const maxW = 320;
                        const scale = Math.min(maxW / img.width, 1);
                        const w = Math.round(img.width * scale);
                        const h = Math.round(img.height * scale);
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/png', 0.8));
                    };
                    img.onerror = () => resolve(null);
                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                    img.src = URL.createObjectURL(blob);
                });
            } catch (e) {
                console.warn('Thumbnail capture failed:', e);
                return null;
            }
        },

        async confirmSaveVersion() {
            this.savingVersion = true;
            try {
                const version = this.saveVersion;
                // BPMN XML 내부 uengine:properties의 version 필드 업데이트
                const xml = this.updateXmlVersion(this.pendingSaveXml, version);
                this.bpmnXml = xml;

                // [6.1.2] Canvas 썸네일 캡처 → definition JSON에 저장
                const thumbnail = await this.captureThumbnail();
                const definition = { ...(this.processDefinition?.definition || {}), };
                if (thumbnail) definition.thumbnail = thumbnail;

                // 새 minor 버전으로 저장 (거버넌스: 저장 시마다 마이너 버전 자동 기록)
                await (backend).putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition,
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

                // [6.2.1] Save 성공 시 로컬 백업 삭제
                if (this.selectedProcessId) {
                    deleteBackup(this.selectedProcessId).catch(() => {});
                }
                this.recoveryBackup = null;

                // definitionList 갱신
                await this.loadInitialData();
            } catch (e) {
                console.error('Save failed:', e);
                // [6.3.1] 409 Conflict detection
                if (e?.status === 409 || e?.code === '23505' || e?.message?.includes('conflict') || e?.message?.includes('duplicate')) {
                    this.conflictDialog = true;
                    this.savingVersion = false;
                    return;
                }
                // [6.2.1] Save 실패 시 IndexedDB 로컬 백업
                try {
                    const xml = this.pendingSaveXml || this.bpmnXml;
                    if (xml && this.selectedProcessId) {
                        await saveBackup({
                            procDefId: this.selectedProcessId,
                            xml,
                            processName: this.selectedProcessName || '',
                            timestamp: Date.now(),
                            version: this.saveVersion,
                        });
                        if (this.$toast) {
                            this.$toast.warning(this.$t('processHierarchy.savedLocally') || '서버 저장 실패. 로컬에 백업되었습니다.');
                        }
                    }
                } catch (backupErr) {
                    console.warn('Local backup also failed:', backupErr);
                    if (this.$toast) {
                        this.$toast.error('저장에 실패했습니다.');
                    }
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

        async handleToggleWip() {
            if (!this.selectedProcessId) return;
            const supabase = window.$supabase;
            if (!supabase) return;

            // 현재 정의 찾기
            const def = this.definitionList.find(
                d => (d.file_name || d.id) === this.selectedProcessId
            );
            if (!def) return;

            const isCurrentlyWip = def.approval_state === 'wip' || def.status === 'wip';
            const newWipFlag = !isCurrentlyWip;

            try {
                // WIP is a work-in-progress flag stored in proc_def.definition JSONB
                const currentDef = typeof def.definition === 'string'
                    ? JSON.parse(def.definition || '{}')
                    : (def.definition || {});
                currentDef.wip = newWipFlag;

                const { error } = await supabase
                    .from('proc_def')
                    .update({ definition: currentDef })
                    .eq('id', this.selectedProcessId);

                if (error) throw error;

                // 로컬 definitionList 갱신
                def.definition = currentDef;
                if (newWipFlag) {
                    def.approval_state = 'wip';
                } else {
                    // Restore actual governance state
                    delete def.approval_state;
                }

                if (this.$toast) {
                    const msg = newWipFlag
                        ? (this.$t('processHierarchy.wipEnabled') || 'WIP 상태로 전환되었습니다.')
                        : (this.$t('processHierarchy.wipDisabled') || 'WIP 상태가 해제되었습니다.');
                    this.$toast.success(msg);
                }
            } catch (e) {
                console.error('WIP toggle failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.wipFailed') || 'WIP 상태 변경에 실패했습니다.');
                }
            }
        },

        handleFocusElement(elementId) {
            if (!elementId) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;
            try {
                const elementRegistry = modeler.get('elementRegistry');
                const canvas = modeler.get('canvas');
                const selection = modeler.get('selection');
                const element = elementRegistry.get(elementId);
                if (!element) return;
                // Center viewport on the element
                canvas.scrollToElement(element);
                // Select the element
                selection.select(element);
            } catch (e) {
                console.warn('Focus element failed:', e);
            }
        },

        handleOpenPermission(sub) {
            this.permissionProcess = sub;
            this.permissionDialog = true;
        },

        toggleLeftPanel() {
            if (this.isLeftCollapsed) {
                this.isLeftCollapsed = false;
                this.leftPanelWidth = this.savedLeftWidth;
            } else {
                this.savedLeftWidth = this.leftPanelWidth;
                this.isLeftCollapsed = true;
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

        async forceSaveAsNewDraft() {
            this.conflictDialog = false;
            this.savingVersion = true;
            try {
                const version = '0.1';
                const xml = this.updateXmlVersion(this.pendingSaveXml, version);
                this.bpmnXml = xml;

                const thumbnail = await this.captureThumbnail();
                const definition = { ...(this.processDefinition?.definition || {}) };
                if (thumbnail) definition.thumbnail = thumbnail;

                const newArcvId = `${this.selectedProcessId}_${version}_${Date.now()}`;
                await (backend).putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition,
                    version: version,
                    version_tag: null,
                    arcv_id: newArcvId,
                    message: this.saveVersionMessage || null,
                });

                this.saveVersionDialog = false;
                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.forceSavedAsDraft') || '새 Draft(v0.1)로 저장되었습니다.');
                }
                await this.loadInitialData();
            } catch (e2) {
                console.error('Force save as draft failed:', e2);
                if (this.$toast) {
                    this.$toast.error('저장에 실패했습니다.');
                }
            } finally {
                this.savingVersion = false;
            }
        },
    },
};
</script>

<style scoped>
.process-hierarchy-container {
    display: flex;
    height: calc(100vh - 140px);
    overflow: hidden;
    position: relative;
    background: #fafafa;
}

.hierarchy-left-panel {
    position: relative;
    flex-shrink: 0;
    border-right: 1px solid #e0e0e0;
    overflow: hidden;
    transition: width 0.25s ease;
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
    overflow: hidden;
    display: flex;
    flex-direction: column;
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

.collapsed-sidebar {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
    gap: 4px;
    height: 100%;
    background: #fafafa;
}

.collapsed-menu-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s;
}

.collapsed-menu-icon:hover {
    background-color: #e3f2fd;
}

.collapsed-menu-icon--active {
    background-color: #e8eaf6;
}

.collapsed-tooltip-content {
    max-width: 200px;
    line-height: 1.4;
}

.collapse-toggle-btn {
    position: absolute;
    top: 8px;
    right: -14px;
    z-index: 15;
    background: #fff !important;
    border: 1px solid #e0e0e0 !important;
    border-radius: 50% !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
</style>

<template>
    <v-card elevation="10" class="process-hierarchy-container rounded-xl">
        <div class="hierarchy-workspace">
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
                        :loading="loading"
                        :statusLoading="statusLoading"
                        :lockMap="lockMap"
                        :canManagePermissions="hasEditAccess"
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
                    :loading="loadingProcess"
                    :recoveryBackup="recoveryBackup"
                    :isViewMode="isReadOnlyMode"
                    :editorMode="editorMode"
                    :breadcrumbItems="selectedBreadcrumbItems"
                    :lockInfo="lockInfo"
                    :readOnlyMessage="readOnlyMessage"
                    :showCopilotPanel="showCopilotPanel"
                    @openPanel="handleOpenPanel"
                    @updateXml="handleUpdateXml"
                    @definition="handleDefinition"
                    @save="handleSave"
                    @clone="handleClone"
                    @delete="handleDelete"
                    @versionHistory="handleVersionHistory"
                    @toggleWip="handleToggleWip"
                    @dismissBackup="dismissBackup"
                    @recoverBackup="recoverFromBackup"
                    @replaceXml="handleReplaceXml"
                    @toggleCopilot="toggleCopilotPanel"
                />
            </div>

            <!-- Right Panel: Properties -->
            <div v-if="showProperties && selectedProcessId" class="hierarchy-right-panel" :style="{ width: rightPanelWidth + 'px' }">
                <div class="resize-handle-right" @mousedown="startResizeRight"></div>
                <ProcessHierarchyProperties
                    :processDefinition="processDefinition"
                    :element="selectedElement"
                    :isViewMode="isReadOnlyMode"
                    :initialTopTab="initialRightTab"
                    :readOnlyMessage="readOnlyMessage"
                    :roles="roles"
                    :processVariables="processVariables"
                    :definitionPath="selectedProcessId"
                    :definition="bpmnDefinitions"
                    :entrySource="entrySource"
                    :reviewId="currentReviewId"
                    @save="handlePropertiesSave"
                    @close="handleCloseProperties"
                    @focusElement="handleFocusElement"
                    @governanceUpdated="handleGovernanceUpdated"
                />
            </div>

            <div v-if="showCopilotPanel && selectedProcessId" class="hierarchy-copilot-panel" :style="{ width: copilotPanelWidth + 'px' }">
                <div class="hierarchy-copilot-panel__header">
                    <div class="hierarchy-copilot-panel__heading">
                        <div class="hierarchy-copilot-panel__title">AI Copilot</div>
                        <div class="hierarchy-copilot-panel__subtitle">
                            {{ selectedElement?.businessObject?.name || selectedProcessName || '프로세스 전체 문맥' }}
                        </div>
                    </div>
                    <v-btn icon variant="text" size="x-small" @click="showCopilotPanel = false">
                        <v-icon size="16">mdi-close</v-icon>
                    </v-btn>
                </div>
                <div class="hierarchy-copilot-panel__body">
                    <ProcessHierarchyAIGuide
                        embedded
                        :element="selectedElement"
                        :processDefinition="processDefinition"
                        :isViewMode="isReadOnlyMode"
                        @focusElement="handleFocusElement"
                    />
                </div>
            </div>

            <!-- Toggle Properties Button -->
            <v-btn
                v-if="!showProperties && selectedProcessId"
                icon
                size="small"
                class="toggle-properties-btn"
                :style="{ right: `${showCopilotPanel ? copilotPanelWidth + 8 : 8}px` }"
                @click="showProperties = true"
            >
                <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
        </div>

        <div v-if="showHistoryPanel && selectedProcessId" class="history-panel-shell" :style="{ height: `${historyPanelHeight}px` }">
            <ProcessHierarchyHistoryPanel
                :loading="historyLoading"
                :versions="historyVersions"
                :selectedVersion="historySelectedVersion"
                :compareVersion="historyCompareVersion"
                :compareVersionOptions="historyCompareVersionOptions"
                :selectedVersionMeta="historySelectedVersionMeta"
                :diffRows="historyDiffRows"
                :compareLabel="historyCompareLabel"
                @close="showHistoryPanel = false"
                @selectVersion="selectHistoryVersion"
                @update:compareVersion="updateHistoryCompareVersion"
            />
        </div>

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
                    <v-btn variant="text" @click="approvalWarningDialog = false; activeApprovalState = null; forceReviewSubmission = false;">
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
                    <v-alert density="compact" variant="tonal" type="info" class="mb-3">
                        현재 저장은 minor patch 경로입니다.
                        <span v-if="currentGovernanceStatus === 'published'" class="d-block mt-1">
                            차기 major 변경은 우측 Governance 탭에서 요청해야 배포본과 병렬 Draft로 분기됩니다.
                        </span>
                    </v-alert>
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
                    <div class="text-subtitle-2 mb-2">
                        {{ $t('processHierarchy.saveStrategy') || '저장 전략' }}
                    </div>
                    <v-btn-toggle v-model="saveSubmissionMode" mandatory divided class="mb-2">
                        <v-btn value="draft" size="small" :disabled="forceReviewSubmission">
                            {{ $t('processHierarchy.saveDraftOnly') || 'Draft만 저장' }}
                        </v-btn>
                        <v-btn value="review" size="small">
                            {{ $t('processHierarchy.saveAndRequestReview') || '저장 후 검토 요청' }}
                        </v-btn>
                    </v-btn-toggle>
                    <div class="text-caption text-medium-emphasis">
                        {{ saveSubmissionDescription }}
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="saveVersionDialog = false" :disabled="savingVersion">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="confirmSaveVersion" :loading="savingVersion">
                        <v-icon start>mdi-content-save</v-icon>
                        {{ saveConfirmButtonLabel }}
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
import ProcessHierarchyAIGuide from './ProcessHierarchyAIGuide.vue';
import ProcessHierarchyHistoryPanel from './ProcessHierarchyHistoryPanel.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import PermissionDialog from '@/components/apps/definition-map/PermissionDialog.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { authClaimsState } from '@/utils/authClaims';
import { computeBpmnDiff, formatElementTypeName } from '@/utils/bpmnDiff';
import {
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE,
    PROCESS_HIERARCHY_PANEL_STATE,
    PROCESS_HIERARCHY_RIGHT_TAB,
    resolveProcessHierarchyEntryState
} from './navigation';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'ProcessHierarchy',
    components: {
        ProcessHierarchyTree,
        ProcessHierarchyDesigner,
        ProcessHierarchyProperties,
        ProcessHierarchyAIGuide,
        ProcessHierarchyHistoryPanel,
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
            loadingProcess: false,
            statusLoading: false,
            showProperties: true,
            showCopilotPanel: false,
            showHistoryPanel: false,
            entrySource: 'direct',
            currentReviewId: '',
            requestedMode: PROCESS_HIERARCHY_MODE.EDIT,
            initialRightTab: PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES,
            // Lock state
            isLockedByOther: false,
            lockInfo: null, // { user_id, heartbeat_at }
            lockMap: new Map(), // proc_def_id → { user_id }
            versionDialog: false,
            // Save & Version dialog
            saveVersionDialog: false,
            saveVersionTag: 'minor',
            saveVersionMessage: '',
            saveSubmissionMode: 'draft',
            forceReviewSubmission: false,
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
            copilotPanelWidth: 360,
            historyPanelHeight: 280,
            resizing: null,
            resizeStartX: 0,
            resizeStartWidth: 0,
            selectionListenerCleanup: null,
            // 저장 여부 체크용 초기 XML
            savedBpmnXml: '',
            historyLoading: false,
            historyVersions: [],
            historySelectedVersion: '',
            historyCompareVersion: '__current__',
            historyDiffRows: [],
        };
    },
    async beforeRouteLeave(to, from, next) {
        if (this.checkUnsavedChanges()) {
            const answer = window.confirm(this.$t('changePath'));
            if (!answer) return next(false);
        }
        next();
    },
    async mounted() {
        this.applyEntryStateFromRoute();
        await this.loadInitialData();
        // Auto-select process from query parameter (from Process Architecture navigation)
        const routeId = this.$route?.params?.id;
        const queryId = this.$route?.query?.id;
        const queryName = this.$route?.query?.name;
        const initialId = routeId || queryId;
        if (initialId) {
            await this.handleSelectProcess(initialId, queryName || initialId);
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
        // 브라우저 탭 닫기/새로고침 시 미저장 경고
        this._beforeUnloadHandler = (e) => {
            if (this.checkUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
        }
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
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
        isAdmin() {
            const role = localStorage.getItem('role');
            return role === 'superAdmin' || authClaimsState.isAdmin;
        },
        hasEditAccess() {
            return this.isAdmin;
        },
        isReadOnlyMode() {
            return (
                this.requestedMode === PROCESS_HIERARCHY_MODE.VIEW ||
                this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY ||
                !this.hasEditAccess ||
                this.isLockedByOther
            );
        },
        readOnlyMessage() {
            if (!this.hasEditAccess) {
                return this.$t('processHierarchy.adminOnlyEdit') || '관리자만 편집할 수 있습니다. 읽기 전용으로 표시됩니다.';
            }
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.VIEW || this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                return this.$t('processHierarchy.readOnlyMode') || '읽기 전용으로 표시됩니다.';
            }
            if (this.lockInfo?.user_id) {
                return `${this.lockInfo.user_id}${this.$t('processHierarchy.lockedByOther') || ' 님이 편집 중입니다. 읽기 전용으로 표시됩니다.'}`;
            }
            return this.$t('processHierarchy.lockedByOtherReadOnly') || '다른 사용자가 편집 중입니다. 읽기 전용으로 표시됩니다.';
        },
        editorMode() {
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                return PROCESS_HIERARCHY_MODE.HISTORY;
            }
            return this.isReadOnlyMode ? PROCESS_HIERARCHY_MODE.VIEW : PROCESS_HIERARCHY_MODE.EDIT;
        },
        selectedBreadcrumbItems() {
            const targetId = this.selectedProcessId;
            if (!targetId || !this.procMap?.mega_proc_list) return [];

            for (const mega of this.procMap.mega_proc_list) {
                for (const major of mega.major_proc_list || []) {
                    const found = (major.sub_proc_list || []).find((sub) => sub.id === targetId);
                    if (found) {
                        const domainLabel = major.domain || major.domain_id || '';
                        return [domainLabel, mega.name, major.name].filter(Boolean);
                    }
                }
            }

            return [];
        },
        currentGovernanceStatus() {
            if (this.processDefinition?.approval_state) {
                return this.processDefinition.approval_state;
            }
            const matched = this.definitionList.find((def) => (def.id || def.file_name) === this.selectedProcessId);
            return matched?.approval_state || matched?.status || '';
        },
        historySelectedVersionMeta() {
            return this.historyVersions.find((row) => String(row.version) === String(this.historySelectedVersion)) || null;
        },
        historyCompareVersionOptions() {
            const options = [
                {
                    title: `현재 편집본${this.processDefinition?.version ? ` · v${this.processDefinition.version}` : ''}`,
                    value: '__current__',
                },
            ];

            this.historyVersions.forEach((row) => {
                if (String(row.version) === String(this.historySelectedVersion)) return;
                options.push({
                    title: `v${row.version}${row.version_tag ? ` · ${row.version_tag}` : ''}`,
                    value: String(row.version),
                });
            });

            return options;
        },
        historyCompareLabel() {
            if (!this.historySelectedVersion) {
                return '좌측에서 버전을 선택하면 현재 편집본 또는 다른 버전과 비교합니다.';
            }
            if (this.historyCompareVersion === '__current__') {
                return `v${this.historySelectedVersion} 기준으로 현재 편집본과 비교합니다.`;
            }
            return `v${this.historySelectedVersion} 기준으로 v${this.historyCompareVersion}과 비교합니다.`;
        },
        saveSubmissionDescription() {
            if (this.forceReviewSubmission) {
                return (
                    this.$t('processHierarchy.saveSubmissionForcedReviewDesc') ||
                    '진행 중인 review를 갱신해야 하므로 이번 저장은 검토 요청 경로로만 진행됩니다.'
                );
            }
            if (this.saveSubmissionMode === 'review') {
                return this.$t('processHierarchy.saveSubmissionReviewDesc') || '저장 후 Review Board의 검토 파이프라인으로 바로 올립니다.';
            }
            if (this.currentGovernanceStatus === 'published') {
                return (
                    this.$t('processHierarchy.saveSubmissionDraftPublishedDesc') ||
                    '배포본은 유지하고 minor draft만 저장합니다. major 변경은 Governance 탭에서 별도 요청해야 합니다.'
                );
            }
            return this.$t('processHierarchy.saveSubmissionDraftDesc') || '현재 편집본만 저장하고, 검토 요청은 나중에 별도로 진행합니다.';
        },
        saveConfirmButtonLabel() {
            if (this.saveSubmissionMode === 'review') {
                return this.$t('processHierarchy.saveAndRequestReview') || '저장 후 검토 요청';
            }
            return this.$t('processHierarchy.saveAndContinue') || '저장';
        }
    },
    watch: {
        '$route.params.id': {
            immediate: false,
            async handler(newId) {
                if (newId && newId !== this.selectedProcessId) {
                    const routeName = this.$route?.query?.name;
                    await this.handleSelectProcess(newId, routeName || newId);
                }
            }
        },
        '$route.query.id': {
            immediate: false,
            async handler(newId) {
                if (newId && newId !== this.selectedProcessId) {
                    const routeName = this.$route?.query?.name;
                    await this.handleSelectProcess(newId, routeName || newId);
                }
            }
        },
        '$route.query': {
            deep: true,
            handler() {
                this.applyEntryStateFromRoute();
            }
        }
    },
    methods: {
        applyEntryStateFromRoute() {
            const state = resolveProcessHierarchyEntryState(this.$route?.query || {});
            this.entrySource = state.entry;
            this.currentReviewId = state.reviewId;
            this.requestedMode = state.mode;
            this.initialRightTab =
                state.rightTab === PROCESS_HIERARCHY_RIGHT_TAB.AI_GUIDE
                    ? PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES
                    : state.rightTab;
            this.isLeftCollapsed = state.left === PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED;
            this.showProperties = state.right === PROCESS_HIERARCHY_PANEL_STATE.OPEN;
            this.showCopilotPanel =
                state.rightTab === PROCESS_HIERARCHY_RIGHT_TAB.AI_GUIDE || state.mode === PROCESS_HIERARCHY_MODE.VIEW;
        },

        getDefaultSaveSubmissionMode() {
            if (this.entrySource === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
                return 'review';
            }
            if (['in_review', 'review', 'public_feedback', 'final_edit', 'rejected'].includes(this.currentGovernanceStatus)) {
                return 'review';
            }
            return 'draft';
        },

        activateContextPanelForSelection() {
            if (this.entrySource === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
                this.initialRightTab = PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE;
            } else {
                this.initialRightTab = PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES;
            }
            this.showProperties = true;
        },

        toggleCopilotPanel(forceState) {
            if (typeof forceState === 'boolean') {
                this.showCopilotPanel = forceState;
                return;
            }
            this.showCopilotPanel = !this.showCopilotPanel;
        },

        showEditDeniedToast() {
            const message = this.$t('processHierarchy.adminOnlyEdit') || '관리자만 편집할 수 있습니다.';
            if (this.$toast) {
                this.$toast.warning(message);
            }
        },

        ensureEditable() {
            if (!this.hasEditAccess) {
                this.showEditDeniedToast();
                return false;
            }
            if (this.isLockedByOther) {
                if (this.$toast) {
                    this.$toast.warning(this.$t('processHierarchy.lockedByOther') || '다른 사용자가 편집 중입니다.');
                }
                return false;
            }
            return true;
        },

        isProcessGptMode() {
            return window.$mode === 'ProcessGPT' || window.$pal;
        },

        async fetchDefinitionListLite() {
            if (typeof backend.listDefinitionStatusLite === 'function') {
                return await backend.listDefinitionStatusLite('', {});
            }
            return await backend.listDefinition('', {});
        },

        async fetchProcessDefinitionDetail(id) {
            if (!id) return null;

            if (this.isProcessGptMode() && typeof backend.getDefinitionDetailLite === 'function') {
                for (let attempt = 0; attempt < 4; attempt++) {
                    const detail = await backend.getDefinitionDetailLite(id);
                    if (detail) return detail;
                    if (attempt < 3) {
                        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
                    }
                }
            }

            if (typeof backend.getRawDefinition === 'function') {
                try {
                    const raw = await backend.getRawDefinition(id);
                    if (raw) {
                        return {
                            ...raw,
                            id: raw.id || id,
                            version: raw.version || raw.prod_version || null,
                            path: `${raw.id || id}.bpmn`,
                            name: raw.name || id
                        };
                    }
                } catch (e) {
                    console.warn('[ProcessHierarchy] getRawDefinition fallback failed:', e);
                }
            }

            return this.definitionList.find(d => d.id === id || d.file_name === id) || null;
        },

        normalizeReviewVersion(reviewState) {
            if (reviewState?.version) return String(reviewState.version);
            if (reviewState && (reviewState.major_version !== undefined || reviewState.minor_version !== undefined)) {
                return `${reviewState.major_version || 0}.${reviewState.minor_version || 0}`;
            }
            if (reviewState?.version_label) {
                return String(reviewState.version_label).replace(/^v/i, '');
            }
            return '';
        },

        async resolveReviewVersionContext(defId) {
            if (!defId || !this.currentReviewId || this.entrySource !== PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
                return null;
            }
            if (typeof backend.getApprovalStateById !== 'function') return null;

            try {
                const reviewState = await backend.getApprovalStateById(this.currentReviewId);
                if (!reviewState || reviewState.proc_def_id !== defId) return null;

                const reviewVersion = this.normalizeReviewVersion(reviewState);
                if (!reviewVersion) {
                    return { reviewState, reviewVersion: '', snapshot: '', versionRow: null };
                }

                let snapshot = '';
                try {
                    snapshot = await backend.getRawDefinition(defId, { type: 'bpmn', version: reviewVersion });
                } catch (e) {
                    console.warn('[ProcessHierarchy] Failed to load review snapshot:', e);
                }

                let versionRow = null;
                try {
                    const versions = await backend.getDefinitionVersions(defId, {
                        sort: 'desc',
                        orderBy: 'version',
                    });
                    versionRow = (versions || []).find((row) => String(row.version) === reviewVersion) || null;
                } catch (e) {
                    console.warn('[ProcessHierarchy] Failed to resolve review version row:', e);
                }

                return {
                    reviewState,
                    reviewVersion,
                    snapshot,
                    versionRow
                };
            } catch (e) {
                console.warn('[ProcessHierarchy] Failed to resolve review context:', e);
                return null;
            }
        },

        collectProcDefIds(procMap) {
            const ids = [];
            const megaList = procMap?.mega_proc_list || [];
            megaList.forEach((mega) => {
                (mega.major_proc_list || []).forEach((major) => {
                    (major.sub_proc_list || []).forEach((sub) => {
                        if (sub?.id) ids.push(sub.id);
                    });
                });
            });
            return [...new Set(ids)];
        },

        applyDefinitionStatusMaps(versionList = [], approvalStates = []) {
            const latestVersionMap = {};
            if (versionList?.length) {
                versionList.forEach((v) => {
                    const defId = v.proc_def_id;
                    if (defId && !latestVersionMap[defId]) {
                        latestVersionMap[defId] = v.version;
                    }
                });
            }

            const approvalMap = {};
            if (approvalStates?.length) {
                approvalStates.forEach((row) => {
                    if (row.proc_def_id && !approvalMap[row.proc_def_id]) {
                        approvalMap[row.proc_def_id] = row.state;
                    }
                });
            }

            this.definitionList = (this.definitionList || []).map((def) => {
                const id = def.id || def.file_name;
                const nextDef = { ...def };

                if (id && latestVersionMap[id]) {
                    nextDef.version = latestVersionMap[id];
                }

                if (id && approvalMap[id] && !nextDef.approval_state) {
                    const state = approvalMap[id];
                    if (state === 'public_feedback') nextDef.approval_state = 'public_review';
                    else if (state === 'in_review' || state === 'final_edit') nextDef.approval_state = 'review';
                    else if (state === 'published') nextDef.approval_state = 'published';
                    else nextDef.approval_state = state;
                }

                return nextDef;
            });
        },

        async enrichDefinitionStatuses(procIds) {
            if (!procIds?.length) return;

            this.statusLoading = true;
            try {
                const isProcessGpt = this.isProcessGptMode();
                const [versionList, approvalStates] = await Promise.all([
                    isProcessGpt && typeof backend.getLatestVersionMapByProcIds === 'function'
                        ? backend.getLatestVersionMapByProcIds(procIds)
                        : backend.getLatestVersionMap(),
                    isProcessGpt && typeof backend.getApprovalStateListByProcIds === 'function'
                        ? backend.getApprovalStateListByProcIds(procIds)
                        : backend.getApprovalStateList(),
                ]);

                this.applyDefinitionStatusMaps(versionList, approvalStates);
            } catch (e) {
                console.warn('Failed to enrich hierarchy statuses:', e);
            } finally {
                this.statusLoading = false;
            }
        },

        async loadInitialData() {
            this.loading = true;
            try {
                const [procMapResult, metricsResult, defListResult] = await Promise.allSettled([
                    backend.getProcessDefinitionMap({ skipPermissionFilter: true }),
                    backend.getMetricsMap(),
                    this.fetchDefinitionListLite(),
                ]);

                this.procMap = procMapResult.status === 'fulfilled' ? procMapResult.value : null;
                this.metricsMap = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
                const defList = defListResult.status === 'fulfilled' ? defListResult.value : [];
                this.definitionList = defList || [];

                const procIds = this.collectProcDefIds(this.procMap);
                this.enrichDefinitionStatuses(procIds);

                // Lock 목록 로드
                this.loadLockMap();
            } catch (e) {
                console.error('Failed to load initial data:', e);
            } finally {
                this.loading = false;
            }
        },

        checkUnsavedChanges() {
            if (!this.selectedProcessId || !this.savedBpmnXml) return false;
            return this.bpmnXml !== this.savedBpmnXml;
        },

        async handleSelectProcess(id, name) {
            if (this.selectedProcessId === id) return;

            // 미저장 변경사항 체크
            if (this.checkUnsavedChanges()) {
                const answer = window.confirm(this.$t('changePath'));
                if (!answer) return;
            }

            // 이전 element 선택 초기화
            this.selectedElement = null;
            this.selectedProcessId = id;
            this.selectedProcessName = name;
            this.recoveryBackup = null;
            this.isLockedByOther = false;
            this.lockInfo = null;
            this.showHistoryPanel = false;
            this.historyVersions = [];
            this.historySelectedVersion = '';
            this.historyCompareVersion = '__current__';
            this.historyDiffRows = [];

            // URL 동기화 (새로고침 시 선택 유지)
            const currentRouteId = this.$route?.params?.id;
            if (currentRouteId !== id) {
                const nextQuery = { ...this.$route.query };
                delete nextQuery.id;
                if (name) nextQuery.name = name;
                else delete nextQuery.name;
                this.$router.replace({
                    path: `/process-hierarchy/${id}`,
                    query: nextQuery
                }).catch((navigationError) => {
                    console.debug('[ProcessHierarchy] route sync skipped:', navigationError);
                });
            }

            // Lock 체크: 다른 사용자가 편집 중인지 확인
            await this.checkEditLock(id);
            await this.loadProcess(id);
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                await this.handleVersionHistory();
            }

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

        async loadLockMap() {
            try {
                const supabase = window.$supabase;
                if (!supabase) return;
                const { data: locks } = await supabase
                    .from('lock')
                    .select('id, user_id')
                    .eq('tenant_id', window.$tenantName);
                const map = new Map();
                if (locks) {
                    const currentUserId = window.$user?.id || '';
                    for (const lock of locks) {
                        if (lock.user_id && lock.user_id !== currentUserId) {
                            map.set(lock.id, { user_id: lock.user_id });
                        }
                    }
                }
                this.lockMap = map;
            } catch (e) {
                console.warn('[ProcessHierarchy] loadLockMap failed:', e);
            }
        },

        async checkEditLock(id) {
            try {
                const currentUserId = window.$user?.id || '';
                const lock = await backend.getLock(id);
                if (lock && lock.user_id && lock.user_id !== currentUserId) {
                    // 다른 사용자가 편집 중
                    this.isLockedByOther = true;
                    this.lockInfo = lock;
                } else {
                    this.isLockedByOther = false;
                    this.lockInfo = null;
                }
            } catch (e) {
                console.warn('[ProcessHierarchy] Lock check failed:', e);
                this.isLockedByOther = false;
                this.lockInfo = null;
            }
        },

        async loadProcess(id) {
            if (!id) return;
            this.loadingProcess = true;
            this.bpmnXml = '';
            try {
                const def = await this.fetchProcessDefinitionDetail(id);
                const reviewContext = await this.resolveReviewVersionContext(id);

                if (def) {
                    this.processDefinition = def;
                    this.bpmnXml = reviewContext?.snapshot || def.bpmn || '';
                    this.savedBpmnXml = this.bpmnXml;
                    const rawDefinition = reviewContext?.versionRow?.definition ?? def.definition;
                    const definition = typeof rawDefinition === 'string'
                        ? JSON.parse(rawDefinition || '{}')
                        : (rawDefinition || {});
                    this.processDefinition.definition = definition;
                    this.processDefinition.review_state = reviewContext?.reviewState || null;
                    if (reviewContext?.reviewVersion) {
                        this.processDefinition.version = reviewContext.reviewVersion;
                    }
                    if (reviewContext?.reviewState?.state) {
                        this.processDefinition.approval_state = reviewContext.reviewState.state;
                    }
                    this.processVariables = definition?.data || [];

                    // roles 추출 (definition에서 가져오기)
                    if (definition?.roles) {
                        this.roles = definition.roles;
                    } else {
                        this.roles = [];
                    }

                    const listIndex = this.definitionList.findIndex(d => (d.id || d.file_name) === id);
                    if (listIndex >= 0) {
                        const current = this.definitionList[listIndex];
                        this.definitionList.splice(listIndex, 1, {
                            ...current,
                            name: def.name || current.name,
                            version: def.version || current.version,
                            version_tag: def.version_tag || current.version_tag,
                            status: def.status || current.status,
                            approval_state: def.approval_state || current.approval_state,
                        });
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
                this.loadingProcess = false;
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
            this.activateContextPanelForSelection();
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
                    this.activateContextPanelForSelection();
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

        handleReplaceXml(xml) {
            if (!xml) return;
            this.selectedElement = null;
            this.bpmnDefinitions = null;
            this.bpmnXml = xml;
            if (this.processDefinition) {
                this.processDefinition.bpmn = xml;
            }
        },

        async handleSave() {
            if (!this.ensureEditable()) return;
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
                this.forceReviewSubmission = false;

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
                this.forceReviewSubmission = false;
                this.saveSubmissionMode = this.getDefaultSaveSubmissionMode();
                this.saveVersionDialog = true;
            } catch (e) {
                console.error('Save preparation failed:', e);
                if (this.$toast) {
                    this.$toast.error('저장 준비에 실패했습니다.');
                }
            }
        },

        async handleSaveToBe() {
            if (!this.ensureEditable()) return;
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
            this.forceReviewSubmission = true;
            this.saveSubmissionMode = 'review';
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
            if (!this.ensureEditable()) return;
            this.savingVersion = true;
            try {
                const version = this.saveVersion;
                const shouldSubmitReview = this.forceReviewSubmission || this.saveSubmissionMode === 'review';
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
                if (shouldSubmitReview) {
                    try {
                        await (backend).submitForReview(this.selectedProcessId, this.saveVersionMessage || undefined, version);
                    } catch (reviewErr) {
                        console.warn('submitForReview failed (may already be in review):', reviewErr);
                    }
                }

                this.saveVersionDialog = false;
                this.forceReviewSubmission = false;
                this.savedBpmnXml = this.bpmnXml;

                if (this.$toast) {
                    const msg = shouldSubmitReview
                        ? (this.$t('processHierarchy.savedAndSubmitted') || `v${version} 저장 및 검토 요청 완료`)
                        : (this.$t('successMsg.save') || '저장되었습니다.');
                    this.$toast.success(msg);
                }

                // [6.2.1] Save 성공 시 로컬 백업 삭제
                if (this.selectedProcessId) {
                    deleteBackup(this.selectedProcessId).catch((deleteBackupError) => {
                        console.debug('[ProcessHierarchy] backup cleanup skipped:', deleteBackupError);
                    });
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
            if (!this.ensureEditable()) return;
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

        async handleDelete() {
            if (!this.selectedProcessId) return;
            if (!this.ensureEditable()) return;

            const confirmed = window.confirm(
                this.$t('processHierarchy.confirmDelete') || '선택한 프로세스를 삭제하시겠습니까? 관련 버전과 폼도 함께 삭제됩니다.'
            );
            if (!confirmed) return;

            const defId = this.selectedProcessId;

            try {
                const supabase = window.$supabase;
                const tenantId = window.$tenantName;

                // 소프트 삭제: deleted_at 타임스탬프 설정 (휴지통에서 복구 가능)
                if (supabase) {
                    const deletedAt = new Date().toISOString();
                    // 현재 로그인 유저 정보 조회
                    let deletedBy = 'Unknown';
                    try {
                        const { data: authData } = await supabase.auth.getUser();
                        if (authData?.user) {
                            const uid = authData.user.id;
                            const { data: userData } = await supabase
                                .from('users')
                                .select('username, email')
                                .match({ id: uid, tenant_id: tenantId })
                                .limit(1);
                            deletedBy = userData?.[0]?.username || userData?.[0]?.email || authData.user.email || 'Unknown';
                        }
                    } catch (e) {
                        console.warn('Failed to get user info for delete:', e);
                    }

                    // 원래 위치 정보 기록 (복원 시 사용)
                    let deletedFrom = null;
                    const currentProcMap = this.procMap || { mega_proc_list: [] };
                    for (const mega of (currentProcMap.mega_proc_list || [])) {
                        for (const major of (mega.major_proc_list || [])) {
                            const found = (major.sub_proc_list || []).find((sub) => sub.id === defId);
                            if (found) {
                                deletedFrom = {
                                    mega_id: mega.id,
                                    mega_name: mega.name,
                                    major_id: major.id,
                                    major_name: major.name,
                                    process_name: found.name || this.selectedProcessName
                                };
                                break;
                            }
                        }
                        if (deletedFrom) break;
                    }

                    // proc_def, tb_bpmn_model 양쪽 모두 soft delete (삭제자 + 원래 위치 기록)
                    const results = await Promise.allSettled([
                        supabase.from('proc_def').update({ deleted_at: deletedAt, deleted_by: deletedBy, deleted_from: deletedFrom }).eq('id', defId).eq('tenant_id', tenantId),
                        supabase.from('tb_bpmn_model').update({ deleted_at: deletedAt, deleted_by: deletedBy }).eq('id', defId).eq('tenant_id', tenantId),
                    ]);

                    // proc_def 업데이트 실패 시 에러
                    const procDefResult = results[0];
                    if (procDefResult.status === 'fulfilled' && procDefResult.value.error) {
                        throw procDefResult.value.error;
                    }

                    // lock 해제
                    await supabase.from('lock').delete().eq('id', defId).eq('tenant_id', tenantId);
                } else {
                    await backend.deleteDefinition(defId, {});
                }

                // procMap에서 제거
                const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
                (nextProcMap.mega_proc_list || []).forEach((mega) => {
                    (mega.major_proc_list || []).forEach((major) => {
                        major.sub_proc_list = (major.sub_proc_list || []).filter((sub) => sub.id !== defId);
                    });
                });

                await backend.putProcessDefinitionMap(nextProcMap);

                this.selectedProcessId = '';
                this.selectedProcessName = '';
                this.bpmnXml = '';
                this.savedBpmnXml = '';
                this.processDefinition = null;
                this.selectedElement = null;
                this.showProperties = true;

                await this.loadInitialData();
                this.$router.replace({ path: '/process-hierarchy' });

                if (this.$toast) {
                    this.$toast.success(this.$t('common.deleteSuccess') || '프로세스가 삭제되었습니다.');
                }
            } catch (e) {
                console.error('Delete failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('common.deleteFailed') || '프로세스 삭제에 실패했습니다.');
                }
            }
        },

        async loadHistoryPanelData() {
            if (!this.selectedProcessId) return;

            this.historyLoading = true;
            try {
                const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                    sort: 'desc',
                    orderBy: 'version',
                });
                this.historyVersions = [...(versions || [])].sort((a, b) => {
                    const [aMajor, aMinor] = String(a.version || '0.0').split('.').map(Number);
                    const [bMajor, bMinor] = String(b.version || '0.0').split('.').map(Number);
                    if (bMajor !== aMajor) return bMajor - aMajor;
                    return (bMinor || 0) - (aMinor || 0);
                });

                if (!this.historySelectedVersion && this.historyVersions.length > 0) {
                    this.historySelectedVersion = String(this.historyVersions[0].version);
                }

                const compareOptions = this.historyCompareVersionOptions.map((item) => item.value);
                if (!compareOptions.includes(this.historyCompareVersion)) {
                    this.historyCompareVersion = '__current__';
                }

                await this.runHistoryDiff();
            } catch (e) {
                console.error('Failed to load history panel data:', e);
                this.historyVersions = [];
                this.historyDiffRows = [];
            } finally {
                this.historyLoading = false;
            }
        },

        async resolveHistoryXml(versionKey) {
            if (versionKey === '__current__') {
                return this.bpmnXml || '';
            }

            const matched = this.historyVersions.find((row) => String(row.version) === String(versionKey));
            if (matched?.snapshot) {
                return matched.snapshot;
            }

            if (!versionKey || !this.selectedProcessId || typeof backend.getRawDefinition !== 'function') {
                return '';
            }

            try {
                return await backend.getRawDefinition(this.selectedProcessId, { type: 'bpmn', version: versionKey });
            } catch (e) {
                console.warn('Failed to resolve history version xml:', e);
                return '';
            }
        },

        async runHistoryDiff() {
            if (!this.historySelectedVersion) {
                this.historyDiffRows = [];
                return;
            }

            const [baseXml, compareXml] = await Promise.all([
                this.resolveHistoryXml(this.historySelectedVersion),
                this.resolveHistoryXml(this.historyCompareVersion),
            ]);

            if (!baseXml || !compareXml || this.historySelectedVersion === this.historyCompareVersion) {
                this.historyDiffRows = [];
                return;
            }

            try {
                const result = computeBpmnDiff(baseXml, compareXml);
                this.historyDiffRows = (result.changes || []).map((change, index) => ({
                    key: `${change.id}-${change.type}-${index}`,
                    label: change.name || change.id,
                    description: change.description || '변경점이 감지되었습니다.',
                    section: formatElementTypeName(change.elementType || ''),
                }));
            } catch (e) {
                console.error('Failed to compute history diff:', e);
                this.historyDiffRows = [];
            }
        },

        async selectHistoryVersion(version) {
            this.historySelectedVersion = String(version || '');

            if (this.historySelectedVersion === this.historyCompareVersion) {
                this.historyCompareVersion = '__current__';
            }

            await this.runHistoryDiff();
        },

        async updateHistoryCompareVersion(version) {
            this.historyCompareVersion = String(version || '__current__');
            await this.runHistoryDiff();
        },

        async handleVersionHistory() {
            if (!this.selectedProcessId) return;
            this.showHistoryPanel = true;
            await this.loadHistoryPanelData();
        },

        async handleVersionSave() {
            this.versionDialog = false;
            await this.handleSave();
        },

        async handlePropertiesSave(data) {
            if (!this.ensureEditable()) return;
            if (!this.processDefinition) return;
            try {
                if (data.name) this.selectedProcessName = data.name;
                Object.assign(this.processDefinition, data);
                await this.handleSave();
            } catch (e) {
                console.error('Properties save failed:', e);
            }
        },

        async handleGovernanceUpdated(payload = {}) {
            if (payload?.reviewId) {
                this.currentReviewId = payload.reviewId;
            }

            if (this.processDefinition && payload?.state) {
                this.processDefinition.approval_state = payload.state;
                this.processDefinition.review_state = {
                    ...(this.processDefinition.review_state || {}),
                    id: payload.reviewId || this.currentReviewId || this.processDefinition.review_state?.id || null,
                    state: payload.state
                };
            }

            const listIndex = this.definitionList.findIndex((d) => (d.id || d.file_name) === this.selectedProcessId);
            if (listIndex >= 0 && payload?.state) {
                const current = this.definitionList[listIndex];
                this.definitionList.splice(listIndex, 1, {
                    ...current,
                    approval_state: payload.state
                });
            }

            if (this.selectedProcessId) {
                await this.enrichDefinitionStatuses([this.selectedProcessId]);
            }
        },

        async handleToggleWip() {
            if (!this.ensureEditable()) return;
            if (!this.selectedProcessId) return;
            const supabase = window.$supabase;
            if (!supabase) return;

            const def = this.processDefinition;
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

                const listDef = this.definitionList.find(d => (d.file_name || d.id) === this.selectedProcessId);
                if (listDef) {
                    if (newWipFlag) {
                        listDef.approval_state = 'wip';
                    } else {
                        delete listDef.approval_state;
                    }
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
            if (!this.hasEditAccess) {
                this.showEditDeniedToast();
                return;
            }
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
            if (!this.ensureEditable()) return;
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
    flex-direction: column;
    height: calc(100vh - 140px);
    overflow: hidden;
    position: relative;
    background: #fafafa;
}

.hierarchy-workspace {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
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

.hierarchy-copilot-panel {
    flex-shrink: 0;
    border-left: 1px solid #e5e7eb;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    min-width: 320px;
}

.hierarchy-copilot-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eef2f7;
}

.hierarchy-copilot-panel__heading {
    min-width: 0;
}

.hierarchy-copilot-panel__title {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
}

.hierarchy-copilot-panel__subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.hierarchy-copilot-panel__body {
    flex: 1;
    min-height: 0;
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

.history-panel-shell {
    position: relative;
    flex: 0 0 auto;
    border-top: 1px solid #dbe4f0;
    background: #ffffff;
    box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
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

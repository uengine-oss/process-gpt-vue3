<template>
    <v-card elevation="10" class="process-hierarchy-container rounded-xl">
        <div class="hierarchy-workspace">
            <!-- Left Panel: Tree -->
            <div class="hierarchy-left-panel" :style="{ width: isLeftCollapsed ? '36px' : leftPanelWidth + 'px' }">
                <!-- Collapsed: expand button only -->
                <div v-if="isLeftCollapsed" class="collapsed-sidebar">
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
                        ref="tree"
                        :procMap="procMap"
                        :metricsMap="metricsMap"
                        :definitionList="definitionList"
                        :selectedId="selectedProcessId"
                        :collapsed="false"
                        :loading="loading"
                        :statusLoading="statusLoading"
                        :lockMap="lockMap"
                        :canManagePermissions="hasEditAccess"
                        :isAdmin="isAdmin"
                        :isOwner="isOwner"
                        @select="handleSelectProcess"
                        @openPermission="handleOpenPermission"
                        @collapse="toggleLeftPanel"
                        @addMegaProcess="handleAddMegaProcess"
                        @addMajorProcess="handleAddMajorProcess"
                        @addCallActivitySub="handleAddCallActivitySub"
                        @renameProcess="handleRenameProcess"
                    />
                    <div class="resize-handle-left" @mousedown="startResizeLeft"></div>
                </template>
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
                    :hasEditAccess="hasEditAccess"
                    :versionList="historyVersions"
                    :isAdmin="isAdmin"
                    :isOwner="isOwner"
                    :showPiFlag="showPiFlag"
                    :showRelatedProjectGroup="showRelatedProjectGroup"
                    :showPartitionGroups="showPartitionGroups"
                    :canClone="canClone"
                    :runStarting="runStarting"
                    :showTeamChatPanel="showTeamChatPanel"
                    @changeMode="handleChangeMode"
                    @openPanel="handleOpenPanel"
                    @addComment="handleAddComment"
                    @openTaskMapping="handleOpenTaskMapping"
                    @togglePiFlag="showPiFlag = !showPiFlag"
                    @toggleRelatedProjectGroup="showRelatedProjectGroup = !showRelatedProjectGroup"
                    @togglePartitionGroups="showPartitionGroups = !showPartitionGroups"
                    @openPiFlagTab="handleOpenPiFlagTab"
                    @openDefinition="handleOpenDefinition"
                    @updateXml="handleUpdateXml"
                    @definition="handleDefinition"
                    @save="handleSave"
                    @clone="handleClone"
                    @delete="handleDelete"
                    @run="handleRun"
                    @execInfo="openExecInfo"
                    @versionHistory="handleVersionHistory"
                    @toggleWip="handleToggleWip"
                    @dismissBackup="dismissBackup"
                    @recoverBackup="recoverFromBackup"
                    @replaceXml="handleReplaceXml"
                    @toggleCopilot="toggleCopilotPanel"
                    @toggleTeamChat="toggleTeamChatPanel"
                    @openGovernance="openGovernancePanel"
                    @selectVersionPreview="selectVersionPreview"
                    @bpmnLoaded="handleBpmnLoaded"
                    @update:activeMode="handleDesignerModeChange"
                    @registerGeneratedProcesses="handleRegisterGeneratedProcesses"
                    @addProcessReferenceLinks="handleAddProcessReferenceLinks"
                    @restoreToBeVersion="handleRestoreToBeVersion"
                    @partitionMembershipChanged="handlePartitionMembershipChanged"
                    @commitPartitionGroups="handleCommitPartitionGroups"
                    @partitionEditStarted="handlePartitionEditStarted"
                    @partitionEditCancelled="handlePartitionEditCancelled"
                    @partitionBlockAdded="handlePartitionBlockAdded"
                    @partitionCommitPreviewRequested="handlePartitionCommitPreviewRequested"
                    @partitionNodeFocus="handlePartitionNodeFocus"
                />
            </div>

            <!-- Right Panel: Properties -->
            <div
                v-if="showProperties && selectedProcessId && bpmnLoaded"
                class="hierarchy-right-panel"
                :style="{ width: rightPanelWidth + 'px' }"
            >
                <div class="resize-handle-right" @mousedown="startResizeRight"></div>
                <ProcessHierarchyProperties
                    ref="properties"
                    :processDefinition="processDefinition"
                    :element="selectedElement"
                    :isViewMode="isReadOnlyMode"
                    :isAdmin="isAdmin"
                    :isOwner="isOwner"
                    :procMap="procMap"
                    :metricsMap="metricsMap"
                    :dataFreezeInfo="dataFreezeInfo"
                    :initialTopTab="initialRightTab"
                    @update:topTab="initialRightTab = $event"
                    :readOnlyMessage="readOnlyMessage"
                    :roles="roles"
                    :processVariables="processVariables"
                    :definitionPath="selectedProcessId"
                    :definition="bpmnDefinitions"
                    :entrySource="entrySource"
                    :reviewId="currentReviewId"
                    :focusCommentSection="focusCommentSection"
                    :multiSelectedElementIds="multiSelectedElementIds"
                    :focusTaskMappingSection="focusTaskMappingSection"
                    :multiTaskMappingElementIds="multiTaskMappingElementIds"
                    :focusPiFlagAgentSection="focusPiFlagAgentSection"
                    @piFlagAgentSectionFocused="focusPiFlagAgentSection = false"
                    @openToBeDialog="openToBeStudioDialog($event || 'partition')"
                    @commentSectionFocused="focusCommentSection = false"
                    @exitMultiCommentSelection="multiSelectedElementIds = []"
                    @taskMappingSectionFocused="focusTaskMappingSection = false"
                    @exitMultiTaskMappingSelection="multiTaskMappingElementIds = []"
                    @save="handlePropertiesSave"
                    @close="handleCloseProperties"
                    @focusElement="handleFocusElement"
                    @governanceUpdated="handleGovernanceUpdated"
                    @navigateToDefinition="handleNavigateToDefinition"
                    @taskMappingChanged="handleTaskMappingChanged"
                    @parentChanged="handleParentChanged"
                    @propertyAuditPending="onPropertyAuditPending"
                    @persistBpmn="handlePersistBpmn"
                />
            </div>

            <div
                v-if="selectedProcessId"
                v-show="showCopilotPanel"
                class="hierarchy-copilot-panel"
                :style="{ width: copilotPanelWidth + 'px' }"
            >
                <div class="resize-handle-copilot" @mousedown="startResizeCopilot"></div>
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
                        ref="copilotGuide"
                        embedded
                        :element="selectedElement"
                        :processDefinition="processDefinition"
                        :bpmnXml="bpmnXml"
                        :isViewMode="isReadOnlyMode"
                        :toBeActive="designerActiveMode === 'to-be'"
                        @focusElement="handleFocusElement"
                        @openToBeDialog="openToBeStudioDialog($event || 'partition')"
                        @openOrchestratorDialog="orchestratorDialogOpen = true"
                        @openRoadmapDialog="roadmapDialogOpen = true"
                        @focusPiFlagAgent="handleFocusPiFlagAgent"
                        @renderPartitionBlocks="handleRenderPartitionBlocks"
                        @applyPartitionApis="handleApplyPartitionApis"
                        @applyGapFlags="handleApplyGapFlags"
                        @applyToBeBlueprint="handleApplyToBeBlueprint"
                        @aiCopilotStateChanged="handleAiCopilotStateChanged"
                    />
                </div>
            </div>

            <div
                v-if="showTeamChatPanel && selectedProcessId"
                class="hierarchy-team-chat-panel"
                :style="{ width: teamChatPanelWidth + 'px' }"
            >
                <div class="resize-handle-team-chat" @mousedown="startResizeTeamChat"></div>
                <ProcessDefinitionTeamChat
                    ref="teamChat"
                    :definitionId="selectedProcessId"
                    :processName="selectedProcessName"
                    :userInfo="currentUserInfo"
                    :agentCommandEnabled="hasEditAccess && !isReadOnlyMode"
                    :agentCommandHandler="handleTeamChatAgentCommand"
                    :livePartitions="livePartitions"
                    :partitionEditable="partitionEditable"
                    @partition-block-click="handleChatPartitionBlockClick"
                    @partition-task-move="handlePartitionTaskMove"
                    @partition-block-rename="handlePartitionBlockRename"
                />
            </div>

            <!-- 파티션 → Call Activity 변환 미리보기 (US2) -->
            <PartitionCommitPreviewDialog
                v-model="partitionPreviewOpen"
                :preview="partitionPreview"
                :converting="partitionConverting"
                @confirm="handlePartitionPreviewConfirm"
            />

            <!-- Toggle Properties Button -->
            <v-btn
                v-if="!showProperties && selectedProcessId"
                icon
                size="small"
                class="toggle-properties-btn"
                :style="{ right: `${rightAuxPanelOffset + 8}px` }"
                @click="showProperties = true"
            >
                <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
        </div>

        <div v-if="showHistoryPanel && selectedProcessId" class="history-panel-shell" :style="{ height: `${historyPanelHeight}px` }">
            <div class="resize-handle-history" @mousedown="startResizeHistory"></div>
            <ProcessHierarchyHistoryPanel
                :loading="historyLoading"
                :versions="historyVersions"
                :selectedVersion="historySelectedVersion"
                :compareVersion="historyCompareVersion"
                :compareVersionOptions="historyCompareVersionOptions"
                :selectedVersionMeta="historySelectedVersionMeta"
                :diffRows="historyDiffRows"
                :compareLabel="historyCompareLabel"
                :currentBpmnXml="bpmnXml"
                @close="showHistoryPanel = false"
                @selectVersion="selectHistoryVersion"
                @update:compareVersion="updateHistoryCompareVersion"
                @rollback="handleVersionRollback"
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
                    승인 진행 중
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="mb-3">현재 이 프로세스에 대해 승인이 진행 중입니다. 저장하면 기존 승인이 취소되고 새로 검토 요청됩니다.</p>
                    <v-alert v-if="activeApprovalState" type="info" variant="tonal" density="compact">
                        <div class="text-body-2"><strong>현재 상태:</strong> {{ displayText(activeApprovalState.state) }}</div>
                        <div v-if="activeApprovalState.version" class="text-body-2">
                            <strong>버전:</strong> v{{ displayText(activeApprovalState.version) }}
                        </div>
                        <div v-if="activeApprovalState.submitted_by" class="text-body-2">
                            <strong>제출자:</strong> {{ displayText(activeApprovalState.submitted_by) }}
                        </div>
                    </v-alert>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        @click="
                            approvalWarningDialog = false;
                            activeApprovalState = null;
                            forceReviewSubmission = false;
                        "
                    >
                        취소
                    </v-btn>
                    <v-btn color="warning" variant="flat" @click="proceedAfterApprovalWarning"> 기존 승인 취소 후 저장 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Save & Version Dialog -->
        <v-dialog v-model="saveVersionDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-content-save-check</v-icon>
                    버전 저장
                    <v-spacer />
                    <v-btn
                        icon
                        variant="text"
                        size="small"
                        @click="
                            saveVersionDialog = false;
                            lockSaveAsDraft = false;
                        "
                    >
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <div class="d-flex align-center mb-4 pa-3 rounded-lg" style="background: #f5f7fa">
                        <v-icon size="18" class="mr-2" color="grey-darken-1">mdi-tag-outline</v-icon>
                        <span class="text-body-2 text-medium-emphasis">현재 버전:</span>
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
                    <div class="text-subtitle-2 mb-2">저장 전략</div>
                    <v-btn-toggle v-model="saveSubmissionMode" mandatory divided class="mb-2">
                        <v-btn value="draft" size="small" :disabled="forceReviewSubmission"> 저장만 하기 </v-btn>
                        <v-btn value="review" size="small" :disabled="lockedToDraftSave"> 저장 후 검토 요청 </v-btn>
                    </v-btn-toggle>
                    <div class="text-caption text-medium-emphasis">
                        {{ saveSubmissionDescription }}
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        @click="
                            saveVersionDialog = false;
                            lockSaveAsDraft = false;
                        "
                        :disabled="savingVersion"
                    >
                        취소
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="confirmSaveVersion" :loading="savingVersion">
                        <v-icon start>mdi-content-save</v-icon>
                        {{ saveConfirmButtonLabel }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Schema Required-Field Validation Dialog -->
        <v-dialog v-model="schemaValidationDialog" max-width="560">
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" :color="schemaValidationViolations.length > 0 ? 'error' : 'success'">
                        {{ schemaValidationViolations.length > 0 ? 'mdi-alert-circle' : 'mdi-check-circle' }}
                    </v-icon>
                    {{ schemaValidationBlockingSave ? '저장이 차단되었습니다' : '필수 입력 검증 결과' }}
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="schemaValidationDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <v-alert v-if="schemaValidationBlockingSave" type="error" variant="tonal" density="compact" class="mb-3">
                        필수 입력 항목을 모두 채운 뒤 다시 저장해 주세요.
                    </v-alert>
                    <v-alert
                        v-else-if="schemaValidationViolations.length === 0"
                        type="success"
                        variant="tonal"
                        density="compact"
                        class="mb-3"
                    >
                        모든 필수 입력 항목이 입력되어 있습니다.
                    </v-alert>
                    <v-alert v-else type="warning" variant="tonal" density="compact" class="mb-3">
                        다음 필수 입력 항목이 누락되었습니다:
                    </v-alert>
                    <v-list v-if="schemaValidationViolations.length > 0" density="compact">
                        <v-list-item
                            v-for="(v, i) in schemaValidationViolations"
                            :key="`${v.scope}-${v.elementId}-${v.propertyKey}-${i}`"
                            :class="{ 'cursor-pointer': v.scope === 'task' }"
                            @click="focusSchemaViolation(v)"
                        >
                            <template v-slot:prepend>
                                <v-icon size="18" color="error">mdi-alert-circle-outline</v-icon>
                            </template>
                            <v-list-item-title class="text-body-2">
                                {{ v.propertyLabel }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                                <span v-if="v.scope === 'process'">프로세스</span>
                                <span v-else>{{ v.elementName }}</span>
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="schemaValidationDialog = false"> 닫기 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- [6.3.1] Version Conflict Dialog -->
        <v-dialog v-model="conflictDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="error">mdi-alert-decagram</v-icon>
                    버전 충돌
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    다른 사용자가 이미 같은 버전을 저장했습니다. 새 Draft(v0.1)로 저장하시겠습니까?
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="conflictDialog = false"> 취소 </v-btn>
                    <v-btn color="primary" variant="flat" @click="forceSaveAsNewDraft"> 새 Draft로 저장 </v-btn>
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

        <!-- AN Transformation: To-Be Studio Dialog (파티셔닝 / To-Be 도면 / As-Is 비교) -->
        <ProcessBlueprintStudio
            v-if="selectedProcessId && processDefinition"
            v-model="toBeDialogOpen"
            :process-definition="processDefinition"
            :as-is-xml="anStudio.asIsXml.value || bpmnXml"
            :def-id="selectedProcessId"
            :readonly="isReadOnlyMode"
            :is-admin="isAdmin"
            :initial-view="toBeDialogView"
        />

        <!-- AN Transformation: 챗 명령 결과 경량 다이얼로그 -->
        <AnOrchestratorDialog v-model="orchestratorDialogOpen" />
        <AnRoadmapDialog v-model="roadmapDialogOpen" :roadmap="aiCopilotRoadmap" />

        <!-- Edit Lock Dialog (다른 사용자가 편집 중일 때 팝업) -->
        <v-dialog v-model="editLockDialog" max-width="440">
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="warning">mdi-lock-outline</v-icon>
                    편집 불가
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="text-body-1">
                        현재 <strong>{{ editLockOwnerName }}</strong> 이 해당 프로세스를 수정 중에 있습니다.
                    </p>
                    <p class="text-body-2 text-medium-emphasis mt-2">편집이 완료될 때까지 읽기 전용으로만 확인할 수 있습니다.</p>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="flat" color="primary" @click="editLockDialog = false"> 확인 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 프로세스 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="480" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="error">mdi-delete-alert-outline</v-icon>
                    프로세스 삭제
                    <v-spacer />
                    <v-btn icon variant="text" size="small" :disabled="deleting" @click="cancelDelete">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="text-body-2 mb-3">
                        선택한 프로세스를 삭제하시겠습니까? 휴지통에서 복구할 수 있지만, 관련 버전과 폼도 함께 삭제됩니다.
                    </p>
                    <div class="delete-warning-banner">
                        <div class="delete-warning-header">
                            <v-icon size="18" color="error">mdi-alert-circle-outline</v-icon>
                            <span class="delete-warning-title">함께 삭제되는 항목</span>
                        </div>
                        <ul class="delete-warning-list">
                            <li>BPMN 모델 (proc_def, tb_bpmn_model)</li>
                            <li>해당 프로세스의 모든 버전 히스토리</li>
                            <li>연결된 폼 및 편집 잠금 정보</li>
                        </ul>
                        <label class="delete-warning-ack">
                            <input type="checkbox" v-model="deleteAck" />
                            <span>위 내용을 확인하였으며 삭제를 진행합니다.</span>
                        </label>
                    </div>
                    <div v-if="selectedProcessName" class="delete-target-info mt-3">
                        <span class="delete-target-label">대상</span>
                        <span class="delete-target-name">{{ selectedProcessName }}</span>
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" :disabled="deleting" @click="cancelDelete"> 취소 </v-btn>
                    <v-btn color="error" variant="flat" :disabled="!deleteAck" :loading="deleting" @click="executeDelete">
                        <v-icon start>mdi-delete-outline</v-icon>
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 프로세스 복제 확인 다이얼로그 -->
        <v-dialog v-model="cloneDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-content-copy</v-icon>
                    프로세스 복제
                    <v-spacer />
                    <v-btn icon variant="text" size="small" :disabled="cloning" @click="cancelClone">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="text-body-2 mb-3">
                        현재 프로세스를 복제하여 새 프로세스를 생성합니다. 복제 후 트리에서 별도 항목으로 관리됩니다.
                    </p>
                    <div v-if="selectedProcessName" class="clone-target-info">
                        <span class="clone-target-label">원본</span>
                        <span class="clone-target-name">{{ selectedProcessName }}</span>
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" :disabled="cloning" @click="cancelClone"> 취소 </v-btn>
                    <v-btn color="primary" variant="flat" :loading="cloning" @click="executeClone">
                        <v-icon start>mdi-content-copy</v-icon>
                        복제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 실행 인스턴스/태스크 ID 확인 패널 (exec 사용자 전용) -->
        <ExecInstancePanel
            v-model="execInfoOpen"
            :def-id="selectedProcessId"
            :def-name="selectedProcessName"
            :highlight-instance-id="execInfoHighlightId"
        />

        <!-- 다중 시작 정의 실행 시 시작 이벤트 선택 (specs/010) -->
        <StartEventSelectDialog
            v-model="startSelectOpen"
            :start-events="startSelectEvents"
            :definition="startSelectDefinition"
            @select="onStartEventSelected"
            @cancel="onStartSelectCancel"
        />

        <!-- 첫 태스크가 userTask 인 경우: 폼 데이터를 입력하며 인스턴스 시작 -->
        <v-dialog v-model="startFormOpen" persistent fullscreen>
            <ProcessGPTExecute
                v-if="startFormDefinition"
                :key="startFormKey"
                class="process-gpt-execute-component-dialog"
                :definitionId="selectedProcessId"
                :processDefinition="startFormDefinition"
                isSimulate="false"
                :startEventId="startFormStartEventId"
                :stayOnStart="true"
                @close="startFormOpen = false"
                @started="onStartFormStarted"
            />
        </v-dialog>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { generateProcessId, getNextSequenceFromIds } from '@/utils/processIdGenerator';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { saveBackup, getBackup, deleteBackup } from '@/utils/localBackup';
import { resolveProcessRouteId, processUuidForRoute } from '@/utils/processRouteId';
import { provide } from 'vue';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import ProcessHierarchyDesigner from './ProcessHierarchyDesigner.vue';
import ProcessHierarchyProperties from './ProcessHierarchyProperties.vue';
import ProcessHierarchyAIGuide from './ProcessHierarchyAIGuide.vue';
import ProcessHierarchyHistoryPanel from './ProcessHierarchyHistoryPanel.vue';
import ExecInstancePanel from './ExecInstancePanel.vue';
import StartEventSelectDialog from './StartEventSelectDialog.vue';
import ProcessGPTExecute from '@/components/apps/definition-map/ProcessGPTExecute.vue';
import ProcessBlueprintStudio from './blueprint/ProcessBlueprintStudio.vue';
import AnOrchestratorDialog from './blueprint/AnOrchestratorDialog.vue';
import AnRoadmapDialog from './blueprint/AnRoadmapDialog.vue';
import { useAnStudio, AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';
import { canUseExecFeatures } from '@/utils/execFeatureGate';
import { buildChildBpmn, validateBpmn, makeChildDefId, rewireOriginalBpmn } from '@/composables/anStudio/callActivityModularizer';
import { splitTmfCodes } from '@/composables/blueprint/blueprintModel';
import { ensurePartitionColors, movePartitionTask } from '@/composables/blueprint/partitionEditing';
import PartitionCommitPreviewDialog from './PartitionCommitPreviewDialog.vue';
import { extractBpmnSkeleton } from '@/composables/blueprint/executableModel';
import { mergeTmfApiIntegrations } from '@/utils/apiIntegrations';
import ProcessDefinitionTeamChat from '@/components/ProcessDefinitionTeamChat.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import PermissionDialog from '@/components/apps/definition-map/PermissionDialog.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import { authClaimsState } from '@/utils/authClaims';
import { computeBpmnDiff, formatElementTypeName } from '@/utils/bpmnDiff';
import { buildCopilotProcessDefinitionPayload } from '@/utils/bpmnCopilotPayload';
import { collectProcessRequiredViolations } from '@/utils/processSchemaValidation';
import {
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE,
    PROCESS_HIERARCHY_PANEL_STATE,
    PROCESS_HIERARCHY_RIGHT_TAB,
    resolveProcessHierarchyEntryState
} from './navigation';
import { useCustomizerStore } from '@/stores/customizer';
import { getMajorBusinessDomain } from '@/views/process-architecture/processClassification';
import { toSafeText } from '@/utils/safeText';
import { formatIdentityWithTeam } from '@/utils/userIdentity';
import { getResolvedRole } from '@/utils/authClaims';
import { canEdit as roleCanEdit, isOwnerOrAbove } from '@/utils/roles';
import { isDesignatedOwner } from '@/utils/reviewPermissions';
import { describeDataFreeze, findMatchingDataFreezeItem, normalizeDataFreezeList } from '@/utils/dataFreeze';
import { syncProjectMappingsFromModeler } from '@/services/projectMappingsApi';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'ProcessHierarchy',
    components: {
        StartEventSelectDialog,
        ProcessHierarchyTree,
        ProcessHierarchyDesigner,
        ProcessHierarchyProperties,
        ProcessHierarchyAIGuide,
        ProcessHierarchyHistoryPanel,
        ExecInstancePanel,
        ProcessGPTExecute,
        ProcessDefinitionTeamChat,
        ProcessDefinitionVersionDialog,
        PermissionDialog,
        ProcessBlueprintStudio,
        AnOrchestratorDialog,
        AnRoadmapDialog,
        PartitionCommitPreviewDialog
    },
    setup() {
        // AN Transformation 컨텍스트 — 챗 명령(AIGuide)/속성패널 Gap Triage/To-Be Dialog 가
        // 같은 인스턴스를 공유하도록 페이지 레벨에서 1개만 생성해 provide 한다.
        const anStudio = useAnStudio();
        provide(AN_STUDIO_KEY, anStudio);
        return { anStudio };
    },
    data() {
        return {
            procMap: null,
            metricsMap: null,
            dataFreezeList: [],
            definitionList: [],
            selectedProcessId: '',
            selectedProcessName: '',
            bpmnXml: '',
            processDefinition: null,
            bpmnDefinitions: null,
            selectedElement: null,
            // AN Transformation (To-Be 모드 통합) 상태
            designerActiveMode: 'as-is',
            toBeDialogOpen: false,
            toBeDialogView: 'tobe',
            orchestratorDialogOpen: false,
            roadmapDialogOpen: false,
            focusPiFlagAgentSection: false,
            roles: [],
            processVariables: [],
            loading: false,
            loadingProcess: false,
            statusLoading: false,
            runStarting: false,
            execInfoOpen: false,
            execInfoHighlightId: '',
            startSelectOpen: false,
            startSelectEvents: [],
            startSelectDefinition: null,
            // 첫 태스크가 userTask 인 실행 정의: 폼 입력과 함께 시작하는 다이얼로그
            startFormOpen: false,
            startFormDefinition: null,
            startFormStartEventId: '',
            startFormKey: 0,
            bpmnLoaded: false,
            showProperties: true,
            showCopilotPanel: false,
            showTeamChatPanel: false,
            showPiFlag: false,
            showRelatedProjectGroup: false,
            showPartitionGroups: false,
            // 파티션 그룹 편집: 진입 시점 스냅샷(취소 원복용) + 변환 미리보기 다이얼로그 상태
            partitionEditSnapshot: null,
            partitionPreviewOpen: false,
            partitionPreview: null,
            partitionConverting: false,
            showHistoryPanel: false,
            entrySource: 'direct',
            currentReviewId: '',
            focusCommentSection: false,
            multiSelectedElementIds: [],
            focusTaskMappingSection: false,
            multiTaskMappingElementIds: [],
            requestedMode: PROCESS_HIERARCHY_MODE.VIEW,
            initialRightTab: PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES,
            // Lock state
            isLockedByOther: false,
            lockInfo: null, // { user_id, user_name, heartbeat_at }
            lockMap: new Map(), // proc_def_id → { user_id }
            editLockDialog: false,
            editLockOwnerName: '',
            lockHeartbeatTimer: null,
            versionDialog: false,
            // Save & Version dialog
            saveVersionDialog: false,
            saveVersionTag: 'minor',
            saveVersionMessage: '',
            saveSubmissionMode: 'draft',
            forceReviewSubmission: false,
            // 공람/최종수정 상태에서 저장할 때 켜짐 — "저장만 하기" 강제 + "검토 요청" 비활성
            lockedToDraftSave: false,
            latestVersion: '0.0',
            savingVersion: false,
            pendingSaveXml: '',
            // Approval warning
            approvalWarningDialog: false,
            activeApprovalState: null,
            // Delete confirmation
            deleteDialog: false,
            deleteAck: false,
            deleting: false,
            // Clone confirmation
            cloneDialog: false,
            cloning: false,
            // [6.2.1-2] Local backup recovery
            recoveryBackup: null,
            // Left panel collapse
            isLeftCollapsed: false,
            savedLeftWidth: 280,
            // [6.3.1] Version conflict
            conflictDialog: false,
            // Schema required-field validation
            schemaValidationDialog: false,
            schemaValidationViolations: [],
            schemaValidationBlockingSave: false,
            // Permission dialog
            permissionDialog: false,
            permissionProcess: null,
            leftPanelWidth: 280,
            rightPanelWidth: 340,
            copilotPanelWidth: 360,
            teamChatPanelWidth: 360,
            historyPanelHeight: 280,
            resizing: null,
            resizeStartX: 0,
            resizeStartY: 0,
            resizeStartWidth: 0,
            resizeStartHeight: 0,
            selectionListenerCleanup: null,
            // 저장 여부 체크용 초기 XML
            savedBpmnXml: '',
            // 감사 로그용 변경 버퍼 (속성값 임시저장 시 적재 → 실제 저장 시 일괄 기록)
            pendingPropertyAudits: {},
            historyLoading: false,
            historyVersions: [],
            historySelectedVersion: '',
            historyCompareVersion: '__current__',
            historyDiffRows: []
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
        // URL 의 id 는 영구 UUID(신규 표준) 또는 legacy id(과거 북마크) — 내부용 legacy id 로 정규화
        const routeId = this.getRouteText(this.$route?.params?.id);
        const queryId = this.getRouteText(this.$route?.query?.id);
        const queryName = this.getRouteText(this.$route?.query?.name);
        const initialId = (await resolveProcessRouteId(routeId || queryId)) || this.findProcessIdByName(queryName);
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
                    timestamp: Date.now()
                });
                console.info('[LocalBackup] Auto-saved due to offline event');
            }
        };
        window.addEventListener('offline', this._offlineHandler);
        // 브라우저 탭 닫기/새로고침 시 미저장 경고 + lock 해제
        this._beforeUnloadHandler = (e) => {
            if (this.checkUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
            // 편집 중이면 lock 해제 시도
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.EDIT && this.selectedProcessId) {
                this.releaseProcessEditLock(this.selectedProcessId);
            }
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
        this._windowFocusHandler = () => {
            this.refreshDataFreezeList({ silent: true });
        };
        window.addEventListener('focus', this._windowFocusHandler);
    },
    beforeUnmount() {
        // AN Transformation 컨텍스트 정리 (자동저장 타이머 등)
        this.anStudio?.dispose?.();
        // 편집 중이었으면 lock 해제
        if (this.requestedMode === PROCESS_HIERARCHY_MODE.EDIT && this.selectedProcessId) {
            this.releaseProcessEditLock(this.selectedProcessId);
        }
        this.stopLockHeartbeat();
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
        }
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
        }
        if (this._windowFocusHandler) {
            window.removeEventListener('focus', this._windowFocusHandler);
        }
        if (this.selectionListenerCleanup) {
            this.selectionListenerCleanup();
            this.selectionListenerCleanup = null;
        }
    },
    computed: {
        /** Legacy AN blueprint XML is no longer a source for the flowchart To-Be canvas. */
        anBlueprintXml() {
            return '';
        },
        /** AN studio persist 가 생성한 최신 definition payload — 페이지 상태와 동기화 */
        anPersistedDefinition() {
            return this.anStudio?.processDefinition?.value?.definition || null;
        },
        /** 저장된 파티션 시그니처 — 로드/변경 시 캔버스 오버레이 복원 트리거 */
        anPartitionSignature() {
            const partitions = this.aiCopilotState.partitions || this.anStudio?.partitions?.value || [];
            return partitions.map((p) => `${p.id}:${(p.element_ids || []).length}`).join('|');
        },
        aiCopilotState() {
            const state = this.processDefinition?.definition?.ai_copilot;
            return state && typeof state === 'object' ? state : {};
        },
        /** 현재 파티션 목록(저장 상태 기준) — 채팅 라이브 카드·편집 배선의 단일 소스 */
        livePartitions() {
            const list = Array.isArray(this.aiCopilotState.partitions)
                ? this.aiCopilotState.partitions
                : this.anStudio?.partitions?.value || [];
            return Array.isArray(list) ? list : [];
        },
        /** 채팅 패널 파티션 편집(드래그·rename) 허용 여부 — 편집 권한 && As-Is 모드 */
        partitionEditable() {
            if (!this.hasEditAccess || this.isReadOnlyMode) return false;
            return !this.designerActiveMode || this.designerActiveMode === 'as-is';
        },
        aiCopilotRoadmap() {
            return this.aiCopilotState.roadmap || null;
        },
        collapsedMenuItems() {
            return [
                {
                    icon: 'mdi-file-tree',
                    name: this.$t('processHierarchy.title') || '프로세스 계층도',
                    desc: this.$t('processHierarchy.treeDesc') || '프로세스 트리에서 편집할 프로세스를 선택합니다.',
                    active: !!this.selectedProcessId,
                    action: () => this.toggleLeftPanel()
                },
                {
                    icon: 'mdi-content-save-outline',
                    name: this.$t('processHierarchy.save') || '저장',
                    desc: this.$t('processHierarchy.saveDesc') || '현재 프로세스를 버전과 함께 저장합니다.',
                    active: false,
                    action: () => {
                        if (this.selectedProcessId) this.handleSave();
                    }
                },
                {
                    icon: 'mdi-history',
                    name: this.$t('processHierarchy.versionHistory') || '버전 이력',
                    desc: this.$t('processHierarchy.versionHistoryDesc') || '버전 간 차이를 비교하고 이전 버전으로 되돌립니다.',
                    active: false,
                    action: () => {
                        if (this.selectedProcessId) this.handleVersionHistory();
                    }
                },
                {
                    icon: 'mdi-shield-check-outline',
                    name: '거버넌스',
                    desc: 'Owner 설정 및 승인 워크플로우를 관리합니다.',
                    active: this.showProperties && this.initialRightTab === 'governance',
                    action: () => {
                        this.openGovernancePanel();
                    }
                },
                {
                    icon: 'mdi-cog-outline',
                    name: this.$t('processHierarchy.properties') || '속성 패널',
                    desc: this.$t('processHierarchy.propertiesDesc') || '선택된 요소의 속성을 편집합니다.',
                    active: this.showProperties,
                    action: () => {
                        this.showProperties = !this.showProperties;
                    }
                },
                {
                    icon: 'mdi-robot-happy-outline',
                    name: 'AI Chat',
                    desc: 'AI 에게 질문하고 /partition 등 AN 변환 명령을 실행합니다.',
                    active: this.showTeamChatPanel,
                    action: () => {
                        this.toggleTeamChatPanel();
                    }
                }
            ];
        },
        currentUserInfo() {
            const user = window.$user || {};
            const email = localStorage.getItem('email') || user.email || '';
            const name = localStorage.getItem('userName') || user.name || user.username || email || 'User';
            return {
                id: user.id || localStorage.getItem('uid') || email || name,
                name,
                username: name,
                email
            };
        },
        rightAuxPanelOffset() {
            let offset = 0;
            if (this.showTeamChatPanel) offset += this.teamChatPanelWidth;
            if (this.showCopilotPanel) offset += this.copilotPanelWidth;
            return offset;
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
        // owner 이상 여부 (PI Flag 순서도 노출 기준 — 관리자 콘솔 PI Flag 메뉴와 동일 기준)
        isOwner() {
            if (this.isAdmin) return true;
            if (isOwnerOrAbove(getResolvedRole())) return true;
            // 방어적 fallback: SSO claims 보강 전이라도 localStorage 의 resolved role 로 판단
            // (isAdmin 컴퓨티드가 localStorage('role') 을 직접 읽는 것과 동일한 기준)
            const stored = (localStorage.getItem('role') || '').toLowerCase();
            return isOwnerOrAbove(stored);
        },
        hasEditAccess() {
            if (this.isAdmin) return true;

            const resolvedRole = getResolvedRole();
            if (!roleCanEdit(resolvedRole)) return false;

            const metaOwners = this.processDefinition?.definition?.meta?.owners || {};
            const fieldOwners = Array.isArray(metaOwners.fieldOwners) ? metaOwners.fieldOwners : [];
            const hqOwners = Array.isArray(metaOwners.hqOwners) ? metaOwners.hqOwners : [];
            const primaryOwner = metaOwners.primaryOwner || this.processDefinition?.owner || '';
            const allOwners = [...fieldOwners, ...hqOwners, primaryOwner]
                .map((o) => (typeof o === 'object' ? o.email || o.employee_no || o.user_id || o.id || o.name || '' : String(o || '')))
                .filter(Boolean);

            // 담당자가 할당되지 않은 프로세스는 Editor 이상 편집 가능
            if (allOwners.length === 0) {
                return true;
            }

            // 담당자가 할당된 프로세스는 역할과 무관하게 본인이 담당자여야 편집 가능
            const userCtx = {
                role: resolvedRole,
                userId: window.$user?.id || null,
                userName: localStorage.getItem('userName') || localStorage.getItem('email') || window.$userName || null,
                employeeNo: localStorage.getItem('employeeNo') || null
            };

            return isDesignatedOwner(allOwners, userCtx);
        },
        canClone() {
            if (this.isAdmin) return true;

            const resolvedRole = getResolvedRole();
            if (!isOwnerOrAbove(resolvedRole)) return false;

            const metaOwners = this.processDefinition?.definition?.meta?.owners || {};
            const fieldOwners = Array.isArray(metaOwners.fieldOwners) ? metaOwners.fieldOwners : [];
            const hqOwners = Array.isArray(metaOwners.hqOwners) ? metaOwners.hqOwners : [];
            const primaryOwner = metaOwners.primaryOwner || this.processDefinition?.owner || '';
            const allOwners = [...fieldOwners, ...hqOwners, primaryOwner]
                .map((o) => (typeof o === 'object' ? o.email || o.employee_no || o.user_id || o.id || o.name || '' : String(o || '')))
                .filter(Boolean);

            // 담당자 미지정 프로세스는 복제 불가 (강화 정책)
            if (allOwners.length === 0) return false;

            const userCtx = {
                role: resolvedRole,
                userId: window.$user?.id || null,
                userName: localStorage.getItem('userName') || localStorage.getItem('email') || window.$userName || null,
                employeeNo: localStorage.getItem('employeeNo') || null
            };

            return isDesignatedOwner(allOwners, userCtx);
        },
        dataFreezeInfo() {
            return findMatchingDataFreezeItem(
                this.selectedProcessId,
                this.procMap,
                this.metricsMap,
                this.dataFreezeList,
                this.processDefinition || null
            );
        },
        isDataFreezeLocked() {
            return !!this.dataFreezeInfo;
        },
        isReadOnlyMode() {
            return (
                this.requestedMode === PROCESS_HIERARCHY_MODE.VIEW ||
                this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY ||
                this.isDataFreezeLocked ||
                !this.hasEditAccess ||
                this.isLockedByOther
            );
        },
        readOnlyMessage() {
            if (this.isDataFreezeLocked) {
                return `${describeDataFreeze(this.dataFreezeInfo)} 읽기 전용으로 표시됩니다.`;
            }
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.VIEW || this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                return this.$t('processHierarchy.readOnlyMode') || '읽기 전용으로 표시됩니다.';
            }
            if (!this.hasEditAccess) {
                return (
                    this.$t('processHierarchy.noEditPermission') ||
                    '편집 권한이 없습니다. 담당자로 등록된 Editor/Owner만 편집할 수 있습니다.'
                );
            }
            if (this.lockInfo?.user_id || this.lockInfo?.user_name) {
                const displayName = toSafeText(this.lockInfo.user_name || this.lockInfo.user_id);
                return `${displayName}${this.$t('processHierarchy.lockedByOther') || ' 님이 편집 중입니다. 읽기 전용으로 표시됩니다.'}`;
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
                        const domainLabel = getMajorBusinessDomain(major, this.metricsMap?.domains || []);
                        return [domainLabel, mega.name, major.name].map((item) => toSafeText(item)).filter(Boolean);
                    }
                }
            }

            return [];
        },
        currentGovernanceStatus() {
            if (this.processDefinition?.approval_state) {
                return toSafeText(this.processDefinition.approval_state).trim();
            }
            const matched = this.definitionList.find((def) => toSafeText(def?.id || def?.file_name).trim() === this.selectedProcessId);
            return toSafeText(matched?.approval_state || matched?.status).trim();
        },
        historySelectedVersionMeta() {
            return (
                this.historyVersions.find((row) => toSafeText(row?.version).trim() === toSafeText(this.historySelectedVersion).trim()) ||
                null
            );
        },
        historyCompareVersionOptions() {
            const options = [
                {
                    title: `현재 편집본${
                        this.processDefinition?.version ? ` · v${toSafeText(this.processDefinition.version).trim()}` : ''
                    }`,
                    value: '__current__'
                }
            ];

            this.historyVersions.forEach((row) => {
                const version = toSafeText(row?.version).trim();
                if (!version || version === toSafeText(this.historySelectedVersion).trim()) return;
                const versionTag = toSafeText(row?.version_tag).trim();
                options.push({
                    title: `v${version}${versionTag ? ` · ${versionTag}` : ''}`,
                    value: version
                });
            });

            return options;
        },
        historyCompareLabel() {
            if (!this.historySelectedVersion) {
                return '좌측에서 버전을 선택하면 현재 편집본 또는 다른 버전과 비교합니다.';
            }
            const selectedVersion = toSafeText(this.historySelectedVersion).trim();
            const compareVersion = toSafeText(this.historyCompareVersion).trim();
            if (this.historyCompareVersion === '__current__') {
                return `v${selectedVersion} 기준으로 현재 편집본과 비교합니다.`;
            }
            return `v${selectedVersion} 기준으로 v${compareVersion}과 비교합니다.`;
        },
        saveSubmissionDescription() {
            if (this.lockSaveAsDraft) {
                return '공람/최종수정 중에는 진행 중인 검토를 유지한 채 현재 편집본만 저장합니다. (검토 요청/취소 없음)';
            }
            if (this.forceReviewSubmission) {
                return '진행 중인 review를 갱신해야 하므로 이번 저장은 검토 요청 경로로만 진행됩니다.';
            }
            if (this.lockedToDraftSave) {
                return '공람/최종수정 중에는 저장만 가능합니다. 검토 재요청 없이 현재 단계가 유지됩니다.';
            }
            if (this.saveSubmissionMode === 'review') {
                return '저장 후 Review Board의 검토 파이프라인으로 바로 올립니다.';
            }
            if (this.currentGovernanceStatus === 'published') {
                return '배포본은 유지하고 minor draft만 저장합니다. major 변경은 Governance 탭에서 별도 요청해야 합니다.';
            }
            return '현재 편집본만 저장하고, 검토 요청은 나중에 별도로 진행합니다.';
        },
        saveConfirmButtonLabel() {
            if (this.saveSubmissionMode === 'review') {
                return '저장 후 검토 요청';
            }
            return '저장';
        }
    },
    watch: {
        // 파티션 로드/변경 시(재접속 포함) As-Is 캔버스에 오버레이 복원
        anPartitionSignature() {
            if (this.bpmnLoaded) this.$nextTick(() => this.restorePartitionOverlay());
        },
        // To-Be 도면 생성(generateToBeBpmn)/수동 반영 시 디자이너 To-Be 캔버스 동기화
        anBlueprintXml(xml) {
            if (!xml) return;
            const designer = this.$refs.designer;
            if (!designer || designer.toBeBlueprintXml === xml) return;
            designer.toBeBlueprintXml = xml;
            if (designer.toBeMode) designer.bpmnKey++;
        },
        // AN studio persist(자동저장 포함)가 definition 을 새 payload 로 교체하면 페이지 상태에 반영
        anPersistedDefinition(def) {
            if (!def || !this.processDefinition) return;
            const anId = this.anStudio?.processDefinition?.value?.id || '';
            if (anId && anId === this.selectedProcessId && this.processDefinition.definition !== def) {
                this.processDefinition.definition = def;
            }
        },
        '$route.params.id': {
            immediate: false,
            async handler(newId) {
                const normalizedId = await resolveProcessRouteId(this.getRouteText(newId));
                if (normalizedId && normalizedId !== this.selectedProcessId) {
                    const routeName = this.getRouteText(this.$route?.query?.name);
                    await this.handleSelectProcess(normalizedId, routeName || normalizedId);
                }
            }
        },
        '$route.query.id': {
            immediate: false,
            async handler(newId) {
                const normalizedId = await resolveProcessRouteId(this.getRouteText(newId));
                if (normalizedId && normalizedId !== this.selectedProcessId) {
                    const routeName = this.getRouteText(this.$route?.query?.name);
                    await this.handleSelectProcess(normalizedId, routeName || normalizedId);
                }
            }
        },
        '$route.query.name': {
            immediate: false,
            async handler(newName) {
                if (this.getRouteText(this.$route?.params?.id) || this.getRouteText(this.$route?.query?.id)) return;
                const normalizedName = this.getRouteText(newName);
                const matchedId = this.findProcessIdByName(normalizedName);
                if (matchedId && matchedId !== this.selectedProcessId) {
                    await this.handleSelectProcess(matchedId, normalizedName || matchedId);
                }
            }
        },
        '$route.query': {
            deep: true,
            async handler() {
                const previousReviewId = this.currentReviewId;
                this.applyEntryStateFromRoute();
                const routeId = this.getRouteText(this.$route?.params?.id);
                const queryId = this.getRouteText(this.$route?.query?.id);
                const currentId = await resolveProcessRouteId(routeId || queryId);
                if (
                    currentId &&
                    currentId === this.selectedProcessId &&
                    this.entrySource === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD &&
                    previousReviewId !== this.currentReviewId
                ) {
                    await this.loadProcess(currentId);
                }
            }
        }
    },
    methods: {
        displayText(value) {
            return toSafeText(value);
        },

        /* ---------------- AN Transformation (To-Be 통합) ---------------- */

        /** 페이지에 로드된 프로세스를 AN studio 컨텍스트에 연결 (definition 은 동일 참조 공유). */
        syncAnStudioProcess() {
            if (!this.anStudio) return;
            if (!this.processDefinition || !this.selectedProcessId) {
                this.anStudio.reset();
                return;
            }
            this.anStudio
                .loadProcess(
                    {
                        id: this.selectedProcessId,
                        name: this.selectedProcessName || this.processDefinition.name || this.selectedProcessId,
                        owner: this.processDefinition.owner || null,
                        definition: this.processDefinition.definition || {}
                    },
                    { xml: this.bpmnXml }
                )
                .catch(() => undefined);
        },

        handleDesignerModeChange(mode) {
            this.designerActiveMode = mode === 'to-be' ? 'to-be' : 'as-is';
        },

        openToBeStudioDialog(view = 'tobe') {
            if (!this.selectedProcessId) return;
            // 실행형은 다이얼로그 대신 순서도 캔버스의 Exec 뷰어로 전환 (허용 사용자 전용)
            if (view === 'executable') {
                if (!canUseExecFeatures()) return;
                const designer = this.$refs.designer;
                if (designer) designer.activeMode = 'exec';
                return;
            }
            this.toBeDialogView = ['partition', 'compare'].includes(view) ? view : 'tobe';
            this.toBeDialogOpen = true;
        },

        handleFocusPiFlagAgent() {
            this.showProperties = true;
            this.$nextTick(() => {
                this.focusPiFlagAgentSection = true;
            });
        },

        normalizeDefinitionRecord(def, fallbackId = '') {
            if (!def || typeof def !== 'object') return null;
            const id = toSafeText(def.id || def.file_name || fallbackId).trim();
            const fileName = toSafeText(def.file_name || id).trim();
            const resolvedId = id || fileName;
            if (!resolvedId) return null;
            const definitionLifecycleState = this.getDefinitionLifecycleState(def.definition);

            return {
                ...def,
                id: resolvedId,
                file_name: fileName || resolvedId,
                name: toSafeText(def.name || resolvedId),
                version: toSafeText(def.version || def.prod_version).trim(),
                prod_version: toSafeText(def.prod_version).trim(),
                version_tag: toSafeText(def.version_tag).trim(),
                status: toSafeText(def.status).trim(),
                approval_state: toSafeText(def.approval_state).trim() || definitionLifecycleState,
                saved_at: toSafeText(def.saved_at).trim()
            };
        },

        normalizeDefinitionList(list) {
            return (Array.isArray(list) ? list : []).map((def) => this.normalizeDefinitionRecord(def)).filter(Boolean);
        },

        getRouteText(value) {
            if (Array.isArray(value)) {
                return toSafeText(value[0]).trim();
            }
            return toSafeText(value).trim();
        },

        isBpmnXmlText(value) {
            const lower = String(value || '')
                .slice(0, 1000)
                .toLowerCase();
            return (
                lower.includes('<bpmn:definitions') ||
                lower.includes('<bpmn2:definitions') ||
                lower.includes('<definitions') ||
                (lower.includes('<?xml') && lower.includes('definitions'))
            );
        },

        normalizeBpmnXml(value, seen = new Set()) {
            if (!value) return '';

            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return '';

                const mightBeJson =
                    trimmed.startsWith('{') || trimmed.startsWith('[') || (trimmed.startsWith('"') && trimmed.endsWith('"'));
                if (mightBeJson) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        const parsedXml = this.normalizeBpmnXml(parsed, seen);
                        if (parsedXml) return parsedXml;
                    } catch {
                        // Plain XML can contain JSON-looking extension fields; keep the original string.
                    }
                }

                return this.isBpmnXmlText(trimmed) ? trimmed : '';
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    const xml = this.normalizeBpmnXml(item, seen);
                    if (xml) return xml;
                }
                return '';
            }

            if (typeof value === 'object') {
                if (seen.has(value)) return '';
                seen.add(value);

                const record = value;
                for (const key of ['bpmn', 'snapshot', 'xml', 'content', 'definition']) {
                    try {
                        if (record[key] === value) continue;
                        const xml = this.normalizeBpmnXml(record[key], seen);
                        if (xml) return xml;
                    } catch {
                        // Ignore unreadable proxy fields.
                    }
                }
            }

            return '';
        },

        safeParseDefinition(rawDefinition) {
            if (!rawDefinition) return {};

            if (typeof rawDefinition === 'string') {
                const trimmed = rawDefinition.trim();
                if (!trimmed) return {};

                try {
                    const parsed = JSON.parse(trimmed);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (e) {
                    console.warn('[ProcessHierarchy] definition JSON parse failed:', e);
                    return {};
                }
            }

            if (typeof rawDefinition === 'object' && !Array.isArray(rawDefinition)) {
                return rawDefinition;
            }

            return {};
        },

        getDefinitionLifecycleState(rawDefinition) {
            const definition = this.safeParseDefinition(rawDefinition);
            if (definition.wip === true) return 'wip';
            return toSafeText(definition.approval_state || definition.status).trim();
        },

        async resolveProcessBpmnXml(id, def, reviewContext) {
            const candidates = [
                reviewContext?.snapshot,
                reviewContext?.versionRow?.snapshot,
                def?.bpmn,
                def?.snapshot,
                def?.xml,
                def?.content,
                def?.definition?.bpmn,
                def?.definition?.snapshot
            ];

            for (const candidate of candidates) {
                const xml = this.normalizeBpmnXml(candidate);
                if (xml) return xml;
            }

            if (typeof backend.getRawDefinition !== 'function') return '';

            if (reviewContext?.reviewVersion) {
                try {
                    const versionXml = this.normalizeBpmnXml(
                        await backend.getRawDefinition(id, { type: 'bpmn', version: reviewContext.reviewVersion })
                    );
                    if (versionXml) return versionXml;
                } catch (e) {
                    console.warn('[ProcessHierarchy] review BPMN fallback failed:', e);
                }
            }

            try {
                const latestXml = this.normalizeBpmnXml(await backend.getRawDefinition(id, { type: 'bpmn' }));
                if (latestXml) return latestXml;
            } catch (e) {
                console.warn('[ProcessHierarchy] latest BPMN fallback failed:', e);
            }

            return '';
        },

        applyEntryStateFromRoute() {
            const state = resolveProcessHierarchyEntryState(this.$route?.query || {});
            this.entrySource = state.entry;
            this.currentReviewId = state.reviewId;
            this.requestedMode = state.mode;
            this.initialRightTab =
                state.rightTab === PROCESS_HIERARCHY_RIGHT_TAB.AI_GUIDE ? PROCESS_HIERARCHY_RIGHT_TAB.PROPERTIES : state.rightTab;
            this.isLeftCollapsed = state.left === PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED;
            this.showProperties = state.right === PROCESS_HIERARCHY_PANEL_STATE.OPEN;
            this.showCopilotPanel = state.rightTab === PROCESS_HIERARCHY_RIGHT_TAB.AI_GUIDE;

            if (
                state.entry === PROCESS_HIERARCHY_ENTRY.ARCHITECTURE ||
                state.entry === PROCESS_HIERARCHY_ENTRY.ANALYSIS ||
                state.entry === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD
            ) {
                const customizer = useCustomizerStore();
                customizer.Sidebar_drawer = false;
            }
        },

        getDefaultSaveSubmissionMode() {
            // 공람/최종수정 중에는 저장만 가능 (검토 재요청 막음)
            if (this.isSaveOnlyGovernanceState(this.currentGovernanceStatus)) {
                return 'draft';
            }
            if (this.entrySource === PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
                return 'review';
            }
            if (['in_review', 'review', 'rejected'].includes(this.currentGovernanceStatus)) {
                return 'review';
            }
            return 'draft';
        },

        isSaveOnlyGovernanceState(state) {
            return ['public_feedback', 'public_review', 'final_edit'].includes(toSafeText(state).trim());
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

        toggleTeamChatPanel(forceState) {
            if (typeof forceState === 'boolean') {
                this.showTeamChatPanel = forceState;
                return;
            }
            this.showTeamChatPanel = !this.showTeamChatPanel;
        },

        async handleTeamChatAgentCommand({ commandText }) {
            const text = toSafeText(commandText).trim();
            if (!text) {
                return { message: 'Agent에게 전달할 요청이 비어 있습니다.' };
            }
            if (!this.hasEditAccess || this.isReadOnlyMode) {
                return { message: '현재 순서도는 읽기 전용이라 Agent 편집 명령을 실행할 수 없습니다.' };
            }

            // Copilot 패널을 열지 않고 채팅 안에서 직접 처리한다.
            // (copilotGuide 는 selectedProcessId 가 있으면 v-show 로 항상 마운트되어 호출 가능)
            await this.$nextTick();
            const guide = this.$refs.copilotGuide;
            if (!guide?.ask) {
                return { message: 'AI Copilot 엔진을 아직 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            // 슬래시 명령(/partition 등)은 Copilot 의 명령 파서가 직접 처리하므로 래핑하지 않는다
            const prompt = text.startsWith('/') ? text : `현재 프로세스 순서도에서 다음 요청을 수행해줘: ${text}`;
            const result = await guide.ask(prompt);
            return {
                message: result?.message || (result?.ok ? '요청을 처리했습니다.' : '요청을 처리하지 못했습니다.'),
                data: result?.data || null
            };
        },

        // AI Chat: /partition 이 태스크별로 추정한 TMF Open API 코드(2개 이상 가능)를
        // 각 태스크의 API 연동 속성(uengine json 의 apiIntegrations 목록)으로 채운다.
        // 이미 같은 이름의 항목이 있으면 건너뛰는 idempotent 병합이라 재실행해도 중복되지 않는다.
        handleApplyPartitionApis(payload) {
            if (this.isReadOnlyMode) return;
            const partitions = payload?.partitions || [];
            if (!partitions.length) return;
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;
                const elementRegistry = modeler.get('elementRegistry');
                const modeling = modeler.get('modeling');
                const bpmnFactory = modeler.get('bpmnFactory');
                if (!elementRegistry || !modeling || !bpmnFactory) return;

                let touched = 0;
                partitions.forEach((p) => {
                    (p?.tasks || []).forEach((t) => {
                        const codes = splitTmfCodes(t?.tmf);
                        if (!t?.id || !codes.length) return;
                        const element = elementRegistry.get(t.id);
                        const bo = element?.businessObject;
                        if (!bo) return;
                        const extValues = bo.extensionElements?.values || [];
                        const uengineEl = extValues.find((v) => v.$type === 'uengine:Properties');
                        let props = {};
                        try {
                            props = uengineEl?.json ? JSON.parse(uengineEl.json) || {} : {};
                        } catch {
                            props = {};
                        }
                        if (!mergeTmfApiIntegrations(props, codes)) return;
                        const otherExtValues = extValues.filter((v) => v.$type !== 'uengine:Properties');
                        const newUengineEl = bpmnFactory.create('uengine:Properties', {
                            json: JSON.stringify(props),
                            variables: uengineEl?.variables || []
                        });
                        const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                            values: [...otherExtValues, newUengineEl]
                        });
                        modeling.updateProperties(element, { extensionElements: newExtElements });
                        touched++;
                    });
                });
                if (touched) {
                    this.handlePersistBpmn();
                    this.$toast?.success(`${touched}개 태스크의 API 연동 속성에 TMF Open API 코드를 채웠습니다.`);
                }
            } catch (e) {
                console.warn('[ProcessHierarchy] 파티셔닝 TMF → API 속성 반영 실패:', e);
            }
        },

        // AI Chat: /partition 실행 시 에디터 캔버스에 블록 박스를 그린다.
        handleRenderPartitionBlocks(blocks) {
            // 명시적 렌더 요청은 그룹 보기 토글(기본 OFF)을 켜서 결과가 보이게 한다
            if ((blocks || []).some((b) => (b.element_ids || []).length > 0)) {
                this.showPartitionGroups = true;
            }
            this.$refs.designer?.renderPartitionBlocks?.(blocks || []);
        },

        async saveAiCopilotState(patch, label = 'AI Copilot 상태 저장') {
            if (!this.selectedProcessId || !this.processDefinition) return;
            const currentDef = this.processDefinition.definition || {};
            const currentState = currentDef.ai_copilot && typeof currentDef.ai_copilot === 'object' ? currentDef.ai_copilot : {};
            const nextDef = {
                ...currentDef,
                ai_copilot: {
                    ...currentState,
                    ...patch,
                    updated_at: new Date().toISOString()
                }
            };
            this.processDefinition.definition = nextDef;
            await backend.updateProcessDefinitionMetadata(this.selectedProcessId, { definition: nextDef }, label);
        },

        withAiCopilotResult(patch, result) {
            const current = Array.isArray(this.aiCopilotState.results) ? this.aiCopilotState.results : [];
            const entry = {
                id: result.id || `${result.kind || 'result'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                kind: result.kind,
                command: result.command || '',
                title: result.title || 'AI Copilot 결과',
                summary: result.summary || '',
                created_at: result.created_at || new Date().toISOString(),
                data: result.data || {}
            };
            return {
                ...patch,
                results: [...current.filter((item) => item.id !== entry.id), entry].slice(-20)
            };
        },

        handleAiCopilotStateChanged(state) {
            if (!this.processDefinition) return;
            const currentDef = this.processDefinition.definition || {};
            this.processDefinition.definition = { ...currentDef, ai_copilot: state || {} };
        },

        // 그룹 편집: 사용자가 그룹 박스를 조정하면 파티션 멤버십(element_ids)을 재계산·반영.
        handlePartitionMembershipChanged(updates, removedPartitionIds) {
            const current = Array.isArray(this.aiCopilotState.partitions)
                ? this.aiCopilotState.partitions
                : this.anStudio?.partitions?.value || [];
            if (!current.length) return;
            const removed = new Set(Array.isArray(removedPartitionIds) ? removedPartitionIds : []);
            const hasUpdates = Array.isArray(updates) && updates.length > 0;
            // 갱신도 삭제도 없으면 무시 (이동/리사이즈 없이 발생한 잡음 방지)
            if (!hasUpdates && !removed.size) return;
            const byId = new Map((hasUpdates ? updates : []).map((u) => [u.partitionId, Array.isArray(u.members) ? u.members : []]));
            let changed = false;
            let next = current.map((p) => {
                if (!byId.has(p.id)) return p;
                const members = byId.get(p.id) || [];
                const memberIds = members.map((m) => m.id);
                const existing = new Map((p.tasks || []).map((t) => [t.id, t]));
                const tasks = members.map((m) => {
                    const prev = existing.get(m.id);
                    return prev ? { ...prev, name: m.name || prev.name } : { id: m.id, name: m.name, tmf: 'TMF XXX' };
                });
                if ((p.element_ids || []).join('|') !== memberIds.join('|')) changed = true;
                return { ...p, element_ids: memberIds, tasks };
            });
            // FR-002: 편집 중 삭제된 그룹의 partition 을 목록에서 제거 → 저장·새로고침 후 부활 방지.
            if (removed.size) {
                const beforeLen = next.length;
                next = next.filter((p) => !removed.has(p.id));
                if (next.length !== beforeLen) changed = true;
            }
            if (changed) {
                this.saveAiCopilotState({ partitions: next }).catch((e) =>
                    console.warn('[ProcessHierarchy] AI Copilot partition save failed:', e)
                );
            }
        },

        // 그룹 편집 진입: 취소 원복용 스냅샷 보관 + color_idx 지연 마이그레이션 영속화 (T005)
        handlePartitionEditStarted() {
            const current = this.livePartitions;
            const { partitions: migrated, changed } = ensurePartitionColors(current);
            if (changed) {
                this.saveAiCopilotState({ partitions: migrated }, '파티션 색상 마이그레이션').catch((e) =>
                    console.warn('[ProcessHierarchy] partition color migration save failed:', e)
                );
            }
            this.partitionEditSnapshot = JSON.parse(JSON.stringify(migrated));
            // 편집 상태를 저장본(전체 블록 + 확정 color_idx) 기준으로 재구성 — 오버레이 필터로 빠진 빈 블록도 팔레트에 노출
            this.$refs.designer?.renderPartitionBlocks?.(migrated);
        },

        // 그룹 편집 취소: 스냅샷으로 원복·저장 후 캔버스 오버레이 재렌더 (T005)
        handlePartitionEditCancelled() {
            const snapshot = this.partitionEditSnapshot;
            this.partitionEditSnapshot = null;
            if (!Array.isArray(snapshot)) return;
            this.saveAiCopilotState({ partitions: snapshot }, '파티션 편집 취소 원복').catch((e) => {
                console.warn('[ProcessHierarchy] partition cancel revert save failed:', e);
                this.$toast?.warning('편집 취소 원복 저장에 실패했습니다. 새로고침 시 편집 내용이 남아 있을 수 있습니다.');
            });
            this.$refs.designer?.renderPartitionBlocks?.(snapshot.filter((b) => (b.element_ids || []).length > 0));
        },

        // 팔레트 "+ 블록": 빈 파티션을 목록에 추가·저장 (T015 — membershipChanged 는 미지의 partition 을 추가하지 않으므로 별도 처리)
        handlePartitionBlockAdded(payload) {
            const { id, name, color_idx } = payload || {};
            if (!id) return;
            const current = this.livePartitions;
            if (current.some((p) => p.id === id)) return;
            const next = [...current, { id, name: name || id, color_idx, tasks: [], element_ids: [] }];
            this.saveAiCopilotState({ partitions: next }, '파티션 블록 추가').catch((e) =>
                console.warn('[ProcessHierarchy] partition block add save failed:', e)
            );
        },

        // "변환 미리보기" → 다이얼로그 오픈 (T010)
        handlePartitionCommitPreviewRequested(preview) {
            this.partitionPreview = preview || null;
            this.partitionPreviewOpen = true;
        },

        // 미리보기 "변환 진행" 확정 → Designer 의 public 커밋 메서드 호출 (T010)
        async handlePartitionPreviewConfirm() {
            this.partitionConverting = true;
            try {
                await this.$refs.designer?.commitPartitionGroupsAsCallActivity?.();
            } catch (e) {
                this.partitionConverting = false;
                this.$toast?.error(e?.message || 'Call Activity 변환 요청에 실패했습니다.');
            }
        },

        // 채팅 카드 태스크 드래그 이동 → 파티션 병합·저장 → 캔버스 반영 (T020)
        handlePartitionTaskMove(payload) {
            const { taskId, fromBlockId, toBlockId } = payload || {};
            if (!taskId || !fromBlockId || !toBlockId) return;
            const current = this.livePartitions;
            const next = movePartitionTask(current, { taskId, fromBlockId, toBlockId });
            if (next === current) return;
            this.saveAiCopilotState({ partitions: next }, '파티션 태스크 이동').catch((e) =>
                console.warn('[ProcessHierarchy] partition task move save failed:', e)
            );
            const designer = this.$refs.designer;
            if (designer && !designer.partitionEditMode) this.showPartitionGroups = true;
            designer?.renderPartitionBlocks?.(next);
        },

        // 채팅 카드 블록명 인라인 편집 → 저장 → 캔버스 팔레트/오버레이 반영 (T020)
        handlePartitionBlockRename(payload) {
            const { blockId, name } = payload || {};
            const trimmed = (name || '').trim();
            if (!blockId || !trimmed) return;
            const current = this.livePartitions;
            let changed = false;
            const next = current.map((p) => {
                if (p.id !== blockId || p.name === trimmed) return p;
                changed = true;
                return { ...p, name: trimmed };
            });
            if (!changed) return;
            this.saveAiCopilotState({ partitions: next }, '파티션 블록명 변경').catch((e) =>
                console.warn('[ProcessHierarchy] partition rename save failed:', e)
            );
            this.$refs.designer?.renderPartitionBlocks?.(next);
        },

        // 캔버스 노드 배정/클릭 → 채팅 라이브 카드 해당 태스크 하이라이트 (T020, 양방향 동기화)
        handlePartitionNodeFocus(payload) {
            if (!payload?.elementId) return;
            this.$refs.teamChat?.focusPartitionNode?.(payload);
        },

        // 그룹 편집 확정: 편집된 파티션을 Call Activity 로 변환 → To-Be 도면에 적용.
        // (미리보기 다이얼로그 확정 → Designer emit 경유로만 호출됨 — finally 에서 다이얼로그 상태 정리)
        async handleCommitPartitionGroups(payload) {
            try {
                await this.runPartitionModularization(payload);
            } finally {
                this.partitionConverting = false;
                this.partitionPreviewOpen = false;
                this.partitionPreview = null;
                this.partitionEditSnapshot = null;
            }
        },

        async runPartitionModularization(payload) {
            const cleanedXml = payload?.cleanedXml || '';
            if (cleanedXml) {
                // 임시 그룹 도형이 제거된 As-Is XML 을 모듈화 입력으로 사용
                this.bpmnXml = cleanedXml;
            }
            const asIsXml = cleanedXml || this.bpmnXml || this.processDefinition?.bpmn || '';
            const partitions = (this.aiCopilotState.partitions || this.anStudio?.partitions?.value || []).filter(
                (b) => (b.element_ids || []).length > 0
            );
            if (!asIsXml || !partitions.length) {
                this.$toast?.warning('Call Activity 로 변환할 파티션이 없습니다. 먼저 /partition 후 그룹을 조정하세요.');
                return;
            }
            try {
                const created = [];
                const failed = [];
                const warnings = [];
                for (const item of partitions) {
                    // 파티셔닝이 태스크별로 추정한 TMF Open API 코드 수집 (다중 허용, placeholder "TMF XXX" 제외).
                    const taskTmf = {};
                    const tmfApis = [];
                    (item.tasks || []).forEach((t) => {
                        const codes = splitTmfCodes(t?.tmf);
                        if (!codes.length) return;
                        if (t.id) taskTmf[t.id] = codes;
                        codes.forEach((code) => {
                            if (!tmfApis.includes(code)) tmfApis.push(code);
                        });
                    });
                    const built = buildChildBpmn(asIsXml, item.element_ids, {
                        name: item.name,
                        etomProcessId: item.etom_process_id || '',
                        etomL3: item.etom_l3 || '',
                        taskTmf
                    });
                    if (!built) {
                        failed.push(`${item.name} (BPMN 추출 실패)`);
                        continue;
                    }
                    const valid = await validateBpmn(built.xml);
                    if (!valid.ok) {
                        failed.push(`${item.name} (검증 실패: ${valid.error || 'invalid'})`);
                        continue;
                    }
                    const defId = makeChildDefId(item.name, item.etom_process_id || '');
                    await backend.putRawDefinition(built.xml, defId, {
                        name: item.name,
                        // PI팀담당자(owner)는 실행자 이름으로 등록 — id 로 표기되던 문제 개선
                        owner: this.getCurrentLockUserName() || this.getCurrentLockUserId() || null,
                        definition: {
                            type: 'call-activity-sub',
                            etom_process_id: item.etom_process_id || '',
                            etom_l3: item.etom_l3 || '',
                            tmf_apis: tmfApis
                        },
                        version: '0.1',
                        arcv_id: `${defId}_0.1`
                    });
                    created.push({
                        partition_id: item.id,
                        def_id: defId,
                        name: item.name,
                        etom_process_id: item.etom_process_id || '',
                        tmf_apis: tmfApis,
                        element_ids: item.element_ids || [],
                        created_at: new Date().toISOString()
                    });
                    if (built.warnings?.length) warnings.push(...built.warnings);
                }

                if (!created.length) {
                    this.$toast?.warning(`Call Activity 변환에 실패했습니다.${failed.length ? ` ${failed.join(', ')}` : ''}`);
                    return;
                }

                const rewired = rewireOriginalBpmn(
                    asIsXml,
                    created.map((c) => ({
                        element_ids: c.element_ids,
                        name: c.name,
                        called_def_id: c.def_id,
                        etom_process_id: c.etom_process_id,
                        tmf_apis: c.tmf_apis
                    }))
                );
                if (!rewired) {
                    this.$toast?.warning('자식 프로세스는 생성했지만 To-Be 치환 도면을 만들지 못했습니다.');
                    await this.saveAiCopilotState(
                        this.withAiCopilotResult(
                            { modularized: created },
                            {
                                kind: 'modularize',
                                command: '/modularize',
                                title: 'Call Activity 모듈화',
                                summary: `${created.length}개 자식 프로세스 생성`,
                                data: { modularized: created }
                            }
                        )
                    );
                    return;
                }
                const rewiredValid = await validateBpmn(rewired.xml);
                if (!rewiredValid.ok) {
                    this.$toast?.warning(
                        `자식 프로세스는 생성했지만 To-Be 치환 도면 검증에 실패했습니다: ${rewiredValid.error || 'invalid'}`
                    );
                    await this.saveAiCopilotState(
                        this.withAiCopilotResult(
                            { modularized: created },
                            {
                                kind: 'modularize',
                                command: '/modularize',
                                title: 'Call Activity 모듈화',
                                summary: `${created.length}개 자식 프로세스 생성`,
                                data: { modularized: created }
                            }
                        )
                    );
                    return;
                }
                await this.saveAiCopilotState(
                    this.withAiCopilotResult(
                        { modularized: created, modularized_bpmn: rewired.xml },
                        {
                            kind: 'modularize',
                            command: '/modularize',
                            title: 'Call Activity 모듈화',
                            summary: `${created.length}개 Call Activity`,
                            data: { modularized: created, xml: rewired.xml }
                        }
                    )
                );
                await this.$refs.designer?.applyToBeBlueprint?.(rewired.xml);
                this.$toast?.success(
                    `그룹을 ${created.length}개 Call Activity 로 변환해 To-Be 도면에 적용했습니다.${
                        warnings.length ? ` 경고 ${warnings.length}건` : ''
                    }`
                );
            } catch (e) {
                this.$toast?.error(e?.message || 'Call Activity 변환 중 오류가 발생했습니다.');
            }
        },

        // AI Chat: /gap 실행 → 진단된 PI Flag 초안을 속성 패널을 통해 BPMN 요소에 기록.
        async handleApplyGapFlags(payload) {
            const drafts = Array.isArray(payload?.drafts) ? payload.drafts : Array.isArray(payload) ? payload : [];
            if (!drafts.length) return { applied: 0, unmatched: 0 };
            // applyGapDrafts 는 속성 패널 컴포넌트의 메서드이므로, 패널이 아직 마운트되지
            // 않았으면 $refs.properties 가 없어 초안이 조용히 사라진다. 먼저 패널을 띄운다.
            if (!this.$refs.properties) {
                this.showProperties = true;
                await this.$nextTick();
            }
            const res = (await this.$refs.properties?.applyGapDrafts?.(drafts)) || { applied: 0, unmatched: 0 };
            return res;
        },

        // AI Chat: /tobe 실행 → 생성된 To-Be BPMN 을 To-Be 캔버스에 적용.
        async handleApplyToBeBlueprint(payload) {
            const xml = typeof payload === 'string' ? payload : payload?.xml || '';
            return await this.$refs.designer?.applyToBeBlueprint?.(xml);
        },

        // AI Chat 의 블록 클릭 → 박스를 (다시) 그리고 해당 영역으로 Zoom.
        handleChatPartitionBlockClick(payload) {
            const blocks = payload?.blocks || [];
            const elementIds = payload?.elementIds || [];
            if (blocks.length) {
                // 명시적 블록 클릭은 그룹 보기 토글(기본 OFF)을 켜서 박스가 보이게 한다
                this.showPartitionGroups = true;
                this.$refs.designer?.renderPartitionBlocks?.(blocks);
            }
            this.$refs.designer?.zoomToBlock?.(elementIds);
        },

        showEditDeniedToast() {
            const message = '해당 프로세스의 담당자가 아니여서 편집권한이 없습니다 ㅠㅠ';
            if (this.$toast) {
                this.$toast.warning(message);
            }
        },

        ensureEditable() {
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.VIEW || this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                this.$toast?.warning(this.readOnlyMessage || this.$t('processHierarchy.readOnlyMode') || '읽기 전용으로 표시됩니다.');
                return false;
            }
            if (this.isDataFreezeLocked) {
                this.$toast?.warning(this.readOnlyMessage || 'Data Freeze가 적용된 범위입니다.');
                return false;
            }
            if (!this.hasEditAccess) {
                this.showEditDeniedToast();
                return false;
            }
            if (this.isLockedByOther) {
                if (this.$toast) {
                    const lockerName = this.lockInfo?.user_name || this.lockInfo?.user_id || '다른 사용자';
                    this.$toast.warning(`현재 ${lockerName} 이 해당 프로세스를 수정 중에 있습니다.`);
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
            const normalizedId = this.getRouteText(id);
            if (!normalizedId) return null;

            if (this.isProcessGptMode() && typeof backend.getDefinitionDetailLite === 'function') {
                for (let attempt = 0; attempt < 4; attempt++) {
                    const detail = await backend.getDefinitionDetailLite(normalizedId);
                    if (detail) return this.normalizeDefinitionRecord(detail, normalizedId) || detail;
                    if (attempt < 3) {
                        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
                    }
                }
            }

            if (typeof backend.getRawDefinition === 'function') {
                try {
                    const raw = await backend.getRawDefinition(normalizedId);
                    if (raw) {
                        if (typeof raw === 'string') {
                            return {
                                id: normalizedId,
                                bpmn: raw,
                                version: null,
                                path: `${normalizedId}.bpmn`,
                                name: normalizedId,
                                definition: {}
                            };
                        }
                        const rawRecord = raw && typeof raw === 'object' ? raw : {};
                        return this.normalizeDefinitionRecord(
                            {
                                ...rawRecord,
                                id: rawRecord.id || normalizedId,
                                bpmn: this.normalizeBpmnXml(rawRecord.bpmn || rawRecord.snapshot || rawRecord.xml || rawRecord),
                                version: rawRecord.version || rawRecord.prod_version || null,
                                path: `${rawRecord.id || normalizedId}.bpmn`,
                                name: rawRecord.name || normalizedId
                            },
                            normalizedId
                        );
                    }
                } catch (e) {
                    console.warn('[ProcessHierarchy] getRawDefinition fallback failed:', e);
                }
            }

            return this.definitionList.find((d) => d.id === normalizedId || d.file_name === normalizedId) || null;
        },

        findProcessIdByName(name) {
            const normalizedName = toSafeText(name).trim();
            if (!normalizedName) return '';

            const matchedDefinition = (this.definitionList || []).find((def) => {
                const candidate = toSafeText(def?.name).trim();
                return candidate === normalizedName;
            });
            if (matchedDefinition) {
                return matchedDefinition.id || matchedDefinition.file_name || '';
            }

            const megaList = this.procMap?.mega_proc_list || [];
            for (const mega of megaList) {
                for (const major of mega.major_proc_list || []) {
                    const matchedSub = (major.sub_proc_list || []).find((sub) => {
                        const candidate = toSafeText(sub?.name).trim();
                        return candidate === normalizedName;
                    });
                    if (matchedSub?.id) {
                        return matchedSub.id;
                    }
                }
            }

            return '';
        },

        findProcessNameById(id) {
            const normalizedId = this.getRouteText(id);
            if (!normalizedId) return '';

            const matchedDefinition = (this.definitionList || []).find((def) => {
                const candidateId = toSafeText(def?.id || def?.file_name).trim();
                return candidateId === normalizedId;
            });
            if (matchedDefinition?.name) {
                return toSafeText(matchedDefinition.name).trim();
            }

            const megaList = this.procMap?.mega_proc_list || [];
            for (const mega of megaList) {
                for (const major of mega.major_proc_list || []) {
                    const matchedSub = (major.sub_proc_list || []).find((sub) => toSafeText(sub?.id).trim() === normalizedId);
                    if (matchedSub?.name) {
                        return toSafeText(matchedSub.name).trim();
                    }
                }
            }

            return '';
        },

        normalizeReviewVersion(reviewState) {
            if (reviewState?.version) return toSafeText(reviewState.version);
            if (reviewState && (reviewState.major_version !== undefined || reviewState.minor_version !== undefined)) {
                return `${reviewState.major_version || 0}.${reviewState.minor_version || 0}`;
            }
            if (reviewState?.version_label) {
                return toSafeText(reviewState.version_label).replace(/^v/i, '');
            }
            return '';
        },

        async resolveReviewVersionContext(defId) {
            const normalizedId = this.getRouteText(defId);
            if (!normalizedId || !this.currentReviewId || this.entrySource !== PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD) {
                return null;
            }
            if (typeof backend.getApprovalStateById !== 'function') return null;

            try {
                const reviewState = await backend.getApprovalStateById(this.currentReviewId);
                if (!reviewState || this.getRouteText(reviewState.proc_def_id) !== normalizedId) return null;

                const reviewVersion = this.normalizeReviewVersion(reviewState);
                if (!reviewVersion) {
                    return { reviewState, reviewVersion: '', snapshot: '', versionRow: null };
                }

                let snapshot = '';
                let versionRow = null;
                const [snapshotResult, versionsResult] = await Promise.allSettled([
                    backend.getRawDefinition(normalizedId, { type: 'bpmn', version: reviewVersion }),
                    backend.getDefinitionVersions(normalizedId, {
                        sort: 'desc',
                        orderBy: 'version'
                    })
                ]);
                if (snapshotResult.status === 'fulfilled') {
                    snapshot = this.normalizeBpmnXml(snapshotResult.value);
                } else {
                    console.warn('[ProcessHierarchy] Failed to load review snapshot:', snapshotResult.reason);
                }
                if (versionsResult.status === 'fulfilled') {
                    versionRow = (versionsResult.value || []).find((row) => toSafeText(row?.version).trim() === reviewVersion) || null;
                } else {
                    console.warn('[ProcessHierarchy] Failed to resolve review version row:', versionsResult.reason);
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
                        const id = this.getRouteText(sub?.id);
                        if (id) ids.push(id);
                    });
                });
            });
            return [...new Set(ids)];
        },

        applyDefinitionStatusMaps(versionList = [], approvalStates = []) {
            const latestVersionMap = {};
            if (versionList?.length) {
                versionList.forEach((v) => {
                    const defId = toSafeText(v?.proc_def_id).trim();
                    if (defId && !latestVersionMap[defId]) {
                        latestVersionMap[defId] = toSafeText(v?.version).trim();
                    }
                });
            }

            const approvalMap = {};
            if (approvalStates?.length) {
                approvalStates.forEach((row) => {
                    const defId = toSafeText(row?.proc_def_id).trim();
                    if (defId && !approvalMap[defId]) {
                        approvalMap[defId] = toSafeText(row?.state).trim();
                    }
                });
            }

            this.definitionList = (this.definitionList || [])
                .map((def) => {
                    const normalizedDef = this.normalizeDefinitionRecord(def);
                    if (!normalizedDef) return null;
                    const id = normalizedDef.id || normalizedDef.file_name;
                    const nextDef = { ...normalizedDef };

                    if (id && latestVersionMap[id]) {
                        nextDef.version = latestVersionMap[id];
                    }

                    const hasVersion = !!toSafeText(nextDef.version || nextDef.prod_version).trim();
                    if (!hasVersion) {
                        nextDef.approval_state = '';
                        nextDef.status = '';
                        return nextDef;
                    }

                    if (id && approvalMap[id]) {
                        const state = approvalMap[id];
                        if (state === 'public_feedback') nextDef.approval_state = 'public_review';
                        else if (state === 'in_review') nextDef.approval_state = 'review';
                        else if (state === 'final_edit') nextDef.approval_state = 'final_edit';
                        else if (state === 'published') nextDef.approval_state = 'published';
                        else nextDef.approval_state = state;
                    }

                    const definitionLifecycleState = this.getDefinitionLifecycleState(nextDef.definition);
                    if (definitionLifecycleState === 'wip' || definitionLifecycleState === 'sunset') {
                        nextDef.approval_state = definitionLifecycleState;
                    }

                    if (id && !nextDef.approval_state) {
                        nextDef.approval_state = 'draft';
                    }

                    return nextDef;
                })
                .filter(Boolean);
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
                        : backend.getApprovalStateList()
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
                console.time('[ProcessHierarchy] loadInitialData total');
                const t0 = performance.now();
                const [procMapResult, metricsResult, defListResult, freezeResult] = await Promise.allSettled([
                    backend.getProcessDefinitionMap({ skipPermissionFilter: true }).then((r) => {
                        console.log(`[ProcessHierarchy] getProcessDefinitionMap: ${(performance.now() - t0).toFixed(0)}ms`);
                        return r;
                    }),
                    backend.getMetricsMap().then((r) => {
                        console.log(`[ProcessHierarchy] getMetricsMap: ${(performance.now() - t0).toFixed(0)}ms`);
                        return r;
                    }),
                    this.fetchDefinitionListLite().then((r) => {
                        console.log(`[ProcessHierarchy] fetchDefinitionListLite: ${(performance.now() - t0).toFixed(0)}ms`);
                        return r;
                    }),
                    backend.getDataFreezeList().then((r) => {
                        console.log(`[ProcessHierarchy] getDataFreezeList: ${(performance.now() - t0).toFixed(0)}ms`);
                        return r;
                    })
                ]);

                this.procMap = procMapResult.status === 'fulfilled' ? procMapResult.value : null;
                this.metricsMap = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
                const defList = defListResult.status === 'fulfilled' ? defListResult.value : [];
                this.definitionList = this.normalizeDefinitionList(defList);
                this.dataFreezeList = normalizeDataFreezeList(freezeResult.status === 'fulfilled' ? freezeResult.value : []);

                const procIds = this.collectProcDefIds(this.procMap);
                await this.enrichDefinitionStatuses(procIds);

                // Lock 목록 로드
                this.loadLockMap();
                console.timeEnd('[ProcessHierarchy] loadInitialData total');
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

        async refreshDataFreezeList({ silent = false } = {}) {
            try {
                this.dataFreezeList = normalizeDataFreezeList((await backend.getDataFreezeList()) || []);
            } catch (e) {
                if (!silent) {
                    console.warn('[ProcessHierarchy] Failed to refresh data freeze list:', e);
                }
            }
        },

        async handleSelectProcess(id, name, options = {}) {
            const selectedId = this.getRouteText(id);
            const selectedName = this.getRouteText(name) || selectedId;
            if (!selectedId) return;
            if (this.selectedProcessId === selectedId) {
                if (selectedName) this.selectedProcessName = selectedName;
                this.refreshDataFreezeList({ silent: true });
                this.activateContextPanelForSelection();
                return;
            }

            // 미저장 변경사항 체크
            if (this.checkUnsavedChanges()) {
                const answer = window.confirm(this.$t('changePath'));
                if (!answer) return;
            }

            // 다른 프로세스로 전환 → 저장되지 않은(임시저장만 된) 감사 버퍼 폐기
            this.pendingPropertyAudits = {};

            // 이전 프로세스에 대한 편집 lock 해제
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.EDIT && this.selectedProcessId) {
                await this.releaseProcessEditLock(this.selectedProcessId);
                this.requestedMode = PROCESS_HIERARCHY_MODE.VIEW;
            }

            // 이전 element 선택 초기화
            this.selectedElement = null;
            this.bpmnLoaded = false;
            this.selectedProcessId = selectedId;
            this.selectedProcessName = selectedName;
            this.recoveryBackup = null;
            this.isLockedByOther = false;
            this.lockInfo = null;
            this.showHistoryPanel = false;
            this.historyVersions = [];
            this.historySelectedVersion = '';
            this.historyCompareVersion = '__current__';
            this.historyDiffRows = [];

            // URL 동기화 (새로고침 시 선택 유지)
            // ID에 슬래시가 포함될 수 있으므로 path param 대신 query로 동기화.
            // URL 표기는 영구 UUID 기준 — legacy id 링크로 들어와도 uuid 로 치환된다(조회 실패 시 legacy 유지).
            const currentRouteId = this.getRouteText(this.$route?.params?.id) || this.getRouteText(this.$route?.query?.id);
            const desiredRouteId = (await processUuidForRoute(selectedId)) || selectedId;
            if (currentRouteId !== desiredRouteId) {
                const nextQuery = { ...this.$route.query, id: desiredRouteId };
                if (selectedName) nextQuery.name = selectedName;
                else delete nextQuery.name;
                const routeSyncMethod = options.routeSyncMode === 'push' ? 'push' : 'replace';
                await this.$router[routeSyncMethod]({
                    path: '/process-hierarchy',
                    query: nextQuery
                }).catch((navigationError) => {
                    console.debug('[ProcessHierarchy] route sync skipped:', navigationError);
                });
            }

            await this.refreshDataFreezeList({ silent: true });

            // Lock 체크: 다른 사용자가 편집 중인지 확인
            await this.checkEditLock(selectedId);
            await this.loadProcess(selectedId);
            if (this.requestedMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                await this.handleVersionHistory();
            }

            // [6.2.2] 로컬 백업 확인
            try {
                const backup = await getBackup(selectedId);
                if (backup) {
                    this.recoveryBackup = backup;
                }
            } catch (e) {
                /* ignore */
            }
        },

        async handleNavigateToDefinition(defId) {
            const targetId = this.getRouteText(defId);
            if (!targetId) return;
            const targetName = this.findProcessNameById(targetId) || targetId;

            await this.handleSelectProcess(targetId, targetName, {
                routeSyncMode: 'push'
            });
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

        normalizeLockIdentifier(value) {
            return toSafeText(value).trim();
        },

        getCurrentLockUserId() {
            const user = window.$user || {};
            return (
                this.normalizeLockIdentifier(localStorage.getItem('uid')) ||
                this.normalizeLockIdentifier(user.id) ||
                this.normalizeLockIdentifier(user.uid) ||
                this.normalizeLockIdentifier(localStorage.getItem('email')) ||
                this.normalizeLockIdentifier(user.email) ||
                this.normalizeLockIdentifier(localStorage.getItem('userName')) ||
                this.normalizeLockIdentifier(user.name) ||
                this.normalizeLockIdentifier(user.username) ||
                this.normalizeLockIdentifier(window.$userName)
            );
        },

        getCurrentLockUserName() {
            const user = window.$user || {};
            return (
                this.normalizeLockIdentifier(localStorage.getItem('userName')) ||
                this.normalizeLockIdentifier(user.name) ||
                this.normalizeLockIdentifier(user.username) ||
                this.normalizeLockIdentifier(window.$userName) ||
                this.normalizeLockIdentifier(localStorage.getItem('email')) ||
                this.normalizeLockIdentifier(user.email) ||
                this.getCurrentLockUserId()
            );
        },

        getCurrentLockIdentitySet() {
            const user = window.$user || {};
            return new Set(
                [
                    this.getCurrentLockUserId(),
                    localStorage.getItem('uid'),
                    localStorage.getItem('email'),
                    localStorage.getItem('userName'),
                    user.id,
                    user.uid,
                    user.email,
                    user.name,
                    user.username,
                    window.$userName
                ]
                    .map((value) => this.normalizeLockIdentifier(value))
                    .filter(Boolean)
            );
        },

        getLockOwnerIdentityList(lock) {
            return [lock?.user_id, lock?.user_name].map((value) => this.normalizeLockIdentifier(value)).filter(Boolean);
        },

        hasLockOwner(lock) {
            return this.getLockOwnerIdentityList(lock).length > 0;
        },

        isLockOwnedByCurrentUser(lock) {
            const currentUserIdentities = this.getCurrentLockIdentitySet();
            return this.getLockOwnerIdentityList(lock).some((owner) => currentUserIdentities.has(owner));
        },

        async loadLockMap() {
            try {
                const supabase = window.$supabase;
                if (!supabase) return;
                const { data: locks } = await supabase.from('lock').select('id, user_id, user_name').eq('tenant_id', window.$tenantName);
                const map = new Map();
                if (locks) {
                    for (const lock of locks) {
                        if (this.hasLockOwner(lock) && !this.isLockOwnedByCurrentUser(lock)) {
                            map.set(lock.id, {
                                user_id: this.normalizeLockIdentifier(lock.user_id) || this.normalizeLockIdentifier(lock.user_name),
                                user_name: lock.user_name
                            });
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
                const lock = await backend.getLock(id);
                if (lock && this.hasLockOwner(lock) && !this.isLockOwnedByCurrentUser(lock)) {
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

        async acquireProcessEditLock(procDefId) {
            try {
                const currentUserId = this.getCurrentLockUserId();
                const currentUserName = this.getCurrentLockUserName();
                if (!currentUserId) {
                    this.$toast?.error('사용자 정보를 확인할 수 없어 편집 잠금을 획득할 수 없습니다.');
                    return false;
                }
                const result = await backend.acquireLockWithStaleCheck(
                    {
                        id: procDefId,
                        user_id: currentUserId,
                        user_name: currentUserName
                    },
                    30
                ); // 30분 stale threshold (브라우저 탭 비활성화 시 heartbeat 지연 고려)
                if (!result.acquired) {
                    // 다른 사용자가 편집 중 → 팝업 다이얼로그 표시
                    this.editLockOwnerName = result.lockedByName || result.lockedBy || '다른 사용자';
                    this.editLockDialog = true;
                    this.isLockedByOther = true;
                    this.lockInfo = { user_id: result.lockedBy, user_name: result.lockedByName };
                    return false;
                }
                // lock 획득 성공 → heartbeat 시작
                this.isLockedByOther = false;
                this.lockInfo = null;
                this.startLockHeartbeat(procDefId);
                return true;
            } catch (e) {
                console.warn('[ProcessHierarchy] acquireProcessEditLock failed:', e);
                this.$toast?.error('편집 잠금을 확인하지 못해 편집 모드로 전환할 수 없습니다.');
                return false;
            }
        },

        async releaseProcessEditLock(procDefId) {
            try {
                this.stopLockHeartbeat();
                const lock = await backend.getLock(procDefId);
                if (!lock || !this.hasLockOwner(lock) || this.isLockOwnedByCurrentUser(lock)) {
                    await backend.deleteLock(procDefId);
                }
            } catch (e) {
                console.warn('[ProcessHierarchy] releaseProcessEditLock failed:', e);
            }
        },

        startLockHeartbeat(procDefId) {
            this.stopLockHeartbeat();
            this.lockHeartbeatTimer = setInterval(async () => {
                await backend.updateLockHeartbeat(procDefId);
            }, 30000); // 30초마다 heartbeat
        },

        stopLockHeartbeat() {
            if (this.lockHeartbeatTimer) {
                clearInterval(this.lockHeartbeatTimer);
                this.lockHeartbeatTimer = null;
            }
        },

        async syncProcessHierarchyMetadata(procDefId, procMapOverride = null) {
            const normalizedId = this.getRouteText(procDefId);
            if (!normalizedId || typeof backend.syncProcessDefinitionHierarchyFromMap !== 'function') return null;

            try {
                await backend.syncProcessDefinitionHierarchyFromMap(normalizedId, procMapOverride || this.procMap, this.metricsMap);
                if (typeof backend.getProcessDefinitionHierarchy !== 'function') return null;

                const hierarchyMeta = await backend.getProcessDefinitionHierarchy(normalizedId);
                if (hierarchyMeta && this.selectedProcessId === normalizedId && this.processDefinition) {
                    this.processDefinition = {
                        ...this.processDefinition,
                        ...hierarchyMeta
                    };
                }
                return hierarchyMeta;
            } catch (e) {
                console.warn('[ProcessHierarchy] Failed to sync process hierarchy metadata:', e);
                return null;
            }
        },

        async loadProcess(id) {
            const normalizedId = this.getRouteText(id);
            if (!normalizedId) return;
            this.loadingProcess = true;
            this.bpmnXml = '';
            try {
                const [def, reviewContext, hierarchyMeta] = await Promise.all([
                    this.fetchProcessDefinitionDetail(normalizedId),
                    this.resolveReviewVersionContext(normalizedId),
                    typeof backend.getProcessDefinitionHierarchy === 'function'
                        ? backend.getProcessDefinitionHierarchy(normalizedId)
                        : Promise.resolve(null)
                ]);

                if (def) {
                    const normalizedDef = this.normalizeDefinitionRecord({ ...def, ...(hierarchyMeta || {}) }, normalizedId) || {
                        ...def,
                        ...(hierarchyMeta || {}),
                        id: normalizedId,
                        name: normalizedId
                    };
                    this.processDefinition = normalizedDef;
                    const definitionName = toSafeText(normalizedDef.name).trim();
                    if (definitionName) this.selectedProcessName = definitionName;
                    this.bpmnXml = await this.resolveProcessBpmnXml(normalizedId, normalizedDef, reviewContext);
                    this.savedBpmnXml = this.bpmnXml;
                    const versionDefinition = reviewContext?.versionRow?.definition;
                    const definition = this.safeParseDefinition(versionDefinition ?? normalizedDef.definition);
                    // 버전 스냅샷 definition에는 To-Be 작업본이 없으므로(tobe/executable 컬럼 분리) live 정의에서 재부착
                    if (versionDefinition && definition && typeof definition === 'object') {
                        const liveDefinition = this.safeParseDefinition(normalizedDef.definition) || {};
                        for (const tobeKey of ['tobe', 'tobe_bpmn', 'tobe_version', 'tobe_bpmn_versions']) {
                            if (definition[tobeKey] === undefined && liveDefinition[tobeKey] !== undefined) {
                                definition[tobeKey] = liveDefinition[tobeKey];
                            }
                        }
                    }
                    this.processDefinition.definition = definition;
                    this.processDefinition.review_state = reviewContext?.reviewState || null;
                    if (reviewContext?.reviewVersion) {
                        this.processDefinition.version = toSafeText(reviewContext.reviewVersion).trim();
                    }
                    if (reviewContext?.reviewState?.state) {
                        this.processDefinition.approval_state = toSafeText(reviewContext.reviewState.state).trim();
                    }
                    this.processVariables = Array.isArray(definition?.data) ? definition.data : [];

                    // roles 추출 (definition에서 가져오기)
                    if (Array.isArray(definition?.roles)) {
                        this.roles = definition.roles;
                    } else {
                        this.roles = [];
                    }

                    if (!this.bpmnXml) {
                        console.warn('[ProcessHierarchy] BPMN XML is empty after process load:', {
                            id: normalizedId,
                            entrySource: this.entrySource,
                            reviewId: this.currentReviewId,
                            reviewVersion: reviewContext?.reviewVersion || '',
                            hasDefinition: !!def
                        });
                    }

                    const listIndex = this.definitionList.findIndex((d) => toSafeText(d?.id || d?.file_name).trim() === normalizedId);
                    if (listIndex >= 0) {
                        const current = this.definitionList[listIndex];
                        this.definitionList.splice(listIndex, 1, {
                            ...current,
                            name: definitionName || current.name,
                            version: toSafeText(this.processDefinition.version || current.version).trim(),
                            version_tag: toSafeText(normalizedDef.version_tag || current.version_tag).trim(),
                            status: toSafeText(normalizedDef.status || current.status).trim(),
                            approval_state: toSafeText(this.processDefinition.approval_state || current.approval_state).trim()
                        });
                    }

                    const hasHierarchyMeta = [
                        this.processDefinition?.domain_id,
                        this.processDefinition?.mega_process_id,
                        this.processDefinition?.major_process_id
                    ].some((value) => toSafeText(value).trim());
                    if (!hasHierarchyMeta) {
                        await this.syncProcessHierarchyMetadata(normalizedId, this.procMap);
                    }
                } else {
                    this.processDefinition = null;
                    this.bpmnXml = '';
                    this.processVariables = [];
                    this.roles = [];
                }
                this.loadHistoryVersionsQuiet();
            } catch (e) {
                console.error('Failed to load process:', e);
                this.processDefinition = null;
                this.bpmnXml = '';
            } finally {
                this.loadingProcess = false;
                // AN Transformation 컨텍스트(챗 명령/Gap Triage/To-Be Dialog)에 현재 프로세스 연결
                this.syncAnStudioProcess();
            }
        },

        async loadHistoryVersionsQuiet() {
            if (!this.selectedProcessId || typeof backend.getDefinitionVersions !== 'function') return;
            try {
                const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                    sort: 'desc',
                    orderBy: 'version'
                });
                const mapped = [...(versions || [])]
                    .map((row, index) => ({
                        ...row,
                        id: toSafeText(row?.id || index).trim() || String(index),
                        version: toSafeText(row?.version).trim(),
                        version_tag: toSafeText(row?.version_tag).trim(),
                        created_at: toSafeText(row?.created_at || row?.timeStamp).trim()
                    }))
                    .sort((a, b) => {
                        const [aMajor, aMinor] = toSafeText(a.version || '0.0')
                            .split('.')
                            .map(Number);
                        const [bMajor, bMinor] = toSafeText(b.version || '0.0')
                            .split('.')
                            .map(Number);
                        if (bMajor !== aMajor) return bMajor - aMajor;
                        return (bMinor || 0) - (aMinor || 0);
                    });
                this.historyVersions = await this.attachVersionOwnerNames(mapped);
            } catch (e) {
                /* ignore */
            }
        },

        /** 버전 행의 owner(사번/email/UUID)를 공통 userIdentity lookup 으로 이름화하여 ownerName 부여. */
        async attachVersionOwnerNames(versions) {
            const list = Array.isArray(versions) ? versions : [];
            const ids = [...new Set(list.map((v) => toSafeText(v?.owner).trim()).filter(Boolean))];
            if (ids.length === 0 || typeof backend.resolveUserIdentities !== 'function') return list;
            try {
                const identityMap = await backend.resolveUserIdentities(ids);
                const nameMap = {};
                ids.forEach((id) => {
                    nameMap[id] = formatIdentityWithTeam(identityMap[id], id);
                });
                return list.map((v) => {
                    const ownerId = toSafeText(v?.owner).trim();
                    return ownerId ? { ...v, ownerName: nameMap[ownerId] || ownerId } : v;
                });
            } catch (e) {
                console.warn('Failed to resolve version owner names:', e);
                return list;
            }
        },

        handleOpenPanel(elementId) {
            if (!elementId) return;
            // 단일 요소 열기 시 멀티선택 코멘트/과제 맵핑 상태 초기화
            if (!Array.isArray(elementId)) {
                this.multiSelectedElementIds = [];
                this.multiTaskMappingElementIds = [];
            }
            if (elementId.startsWith('Collaboration_') || elementId.startsWith('Process_')) {
                this.selectedElement = null;
                this.activateContextPanelForSelection();
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
            // 루트(Process/Collaboration) 요소면 프로세스 패널 열기 (id prefix 가 비표준인 경우 대비)
            if (element.type === 'bpmn:Process' || element.type === 'bpmn:Collaboration') {
                this.selectedElement = null;
                this.activateContextPanelForSelection();
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

        handleAddComment(payload) {
            if (Array.isArray(payload) && payload.length > 1) {
                this.handleOpenPanel(payload[0]); // handleOpenPanel이 멀티선택 상태를 초기화하므로 반드시 이후에 세팅
                // 묶음 선택 시 코멘트/과제 맵핑 어느 쪽으로 전환해도 묶음 그대로 등록되도록 두 상태 모두 세팅
                this.multiSelectedElementIds = payload;
                this.multiTaskMappingElementIds = payload;
            } else {
                this.multiSelectedElementIds = [];
                this.multiTaskMappingElementIds = [];
                this.handleOpenPanel(Array.isArray(payload) ? payload[0] : payload);
            }
            this.$nextTick(() => {
                this.focusCommentSection = true;
            });
        },

        handleOpenTaskMapping(payload) {
            if (Array.isArray(payload) && payload.length > 1) {
                this.handleOpenPanel(payload[0]); // handleOpenPanel이 멀티선택 상태를 초기화하므로 반드시 이후에 세팅
                // 묶음 선택 시 과제 맵핑/코멘트 어느 쪽으로 전환해도 묶음 그대로 등록되도록 두 상태 모두 세팅
                this.multiTaskMappingElementIds = payload;
                this.multiSelectedElementIds = payload;
            } else {
                this.multiTaskMappingElementIds = [];
                this.multiSelectedElementIds = [];
                this.handleOpenPanel(Array.isArray(payload) ? payload[0] : payload);
            }
            this.$nextTick(() => {
                this.focusTaskMappingSection = true;
            });
        },

        handleOpenDefinition(businessObject) {
            if (!businessObject) return;
            let definitionId = '';
            // extensionElements JSON에서 definitionId 추출
            if (businessObject.extensionElements && businessObject.extensionElements.values) {
                for (const ext of businessObject.extensionElements.values) {
                    if (ext.json) {
                        try {
                            const props = JSON.parse(ext.json);
                            if (props.definitionId) {
                                definitionId = props.definitionId.replace('.bpmn', '');
                                break;
                            }
                        } catch (err) {
                            console.error('Failed to parse CallActivity properties', err);
                        }
                    }
                }
            }
            // calledElement 속성에서도 시도
            if (!definitionId && businessObject.calledElement) {
                definitionId = businessObject.calledElement.replace('.bpmn', '');
            }
            if (definitionId) {
                const definitionName = this.findProcessNameById(definitionId) || businessObject.name || definitionId;
                this.handleSelectProcess(definitionId, definitionName, { routeSyncMode: 'push' });
            }
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

            // 좌클릭(요소 선택)은 패널에 일절 관여하지 않음 — 패널 오픈/내용 전환은 우클릭에서만 처리
            this.selectionListenerCleanup = () => undefined;
        },

        handleCloseProperties() {
            this.showProperties = false;
            this.selectedElement = null;
            this.multiSelectedElementIds = [];
            this.multiTaskMappingElementIds = [];
        },

        handleUpdateXml(xml) {
            this.bpmnXml = xml;
            // As-Is 모드 편집 중에는 AN 파티셔닝 입력(As-Is XML)도 최신으로 유지
            if (this.designerActiveMode === 'as-is') {
                this.anStudio?.setAsIsXml?.(xml);
            }
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
                let xml;
                try {
                    const result = await modeler.saveXML({ format: true, preamble: true });
                    xml = result.xml;
                } catch (xmlErr) {
                    xml = this.bpmnXml || this.processDefinition?.bpmn;
                    if (!xml) throw xmlErr;
                }
                this.pendingSaveXml = xml;
                this.forceReviewSubmission = false;
                this.lockSaveAsDraft = false;

                // 최신 버전 조회
                const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                    sort: 'desc',
                    orderBy: 'version'
                });
                if (versions && versions.length > 0) {
                    const sorted = versions.sort((a, b) => {
                        const [aM, am] = toSafeText(a.version).split('.').map(Number);
                        const [bM, bm] = toSafeText(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                    });
                    this.latestVersion = toSafeText(sorted[0].version).trim() || '0.0';
                } else {
                    this.latestVersion = '0.0';
                }

                // 활성 승인 건 체크
                this.lockedToDraftSave = false;
                try {
                    const activeApproval = await backend.getActiveApprovalState(this.selectedProcessId);
                    if (activeApproval) {
                        // 공람/최종수정 단계는 편집해도 검토 재시작 없이 저장만 진행 → 경고/강제검토 스킵
                        if (this.isSaveOnlyGovernanceState(activeApproval.state)) {
                            this.activeApprovalState = null;
                            this.forceReviewSubmission = false;
                            this.lockedToDraftSave = true;
                        } else {
                            this.activeApprovalState = activeApproval;
                            this.approvalWarningDialog = true;
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('승인 상태 확인 실패:', e);
                }

                // 다이얼로그 초기화 후 열기
                this.saveVersionTag = 'minor';
                this.saveVersionMessage = '';
                if (!this.lockedToDraftSave) this.forceReviewSubmission = false;
                this.saveSubmissionMode = this.lockedToDraftSave ? 'draft' : this.getDefaultSaveSubmissionMode();
                this.saveVersionDialog = true;
            } catch (e) {
                console.warn('Process save preparation failed:', e);
            }
        },
        /** 기존 To-Be 버전 배열에서 다음 버전(부 버전 자동 증가)을 계산한다. */
        computeNextToBeVersion(versions) {
            if (!Array.isArray(versions) || versions.length === 0) return '1.0';
            let maxMajor = 1;
            let maxMinor = 0;
            for (const v of versions) {
                const [major = 0, minor = 0] = toSafeText(v?.version)
                    .split('.')
                    .map((n) => parseInt(n, 10) || 0);
                if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
                    maxMajor = major;
                    maxMinor = minor;
                }
            }
            return `${maxMajor}.${maxMinor + 1}`;
        },

        /**
         * To-Be XML 을 definition 에 저장하면서 새 버전 이력 1건을 definition.tobe_bpmn_versions 에 추가한다.
         * As-Is 버전 목록(proc_def_version)과 분리된 To-Be 전용 히스토리이며 별도 마이그레이션이 필요 없다.
         * @returns {Promise<string>} 새로 기록된 버전 문자열
         */
        async persistToBeVersion(xml, message = '') {
            const currentDef = this.processDefinition?.definition || {};
            const versions = Array.isArray(currentDef.tobe_bpmn_versions) ? currentDef.tobe_bpmn_versions.slice() : [];
            const version = this.computeNextToBeVersion(versions);
            versions.push({
                version,
                xml,
                message: message || '',
                created_at: new Date().toISOString(),
                created_by: this.getCurrentLockUserName() || this.getCurrentLockUserId() || ''
            });
            // jsonb 비대화 방지: 최근 50건만 보관
            const TOBE_HISTORY_LIMIT = 50;
            const capped = versions.length > TOBE_HISTORY_LIMIT ? versions.slice(versions.length - TOBE_HISTORY_LIMIT) : versions;
            const updatedDef = { ...currentDef, tobe_bpmn: xml, tobe_version: version, tobe_bpmn_versions: capped };

            await backend.updateProcessDefinitionMetadata(this.selectedProcessId, { definition: updatedDef }, 'To-Be 저장');

            // 로컬 상태 동기화
            if (this.processDefinition) this.processDefinition.definition = updatedDef;
            const designer = this.$refs.designer;
            if (designer) designer.toBeBlueprintXml = xml;
            if (this.anStudio?.processDefinition?.value) {
                this.anStudio.processDefinition.value.definition = updatedDef;
            }
            // Exec 뷰·실행형 변환 원본이 방금 저장한 To-Be 를 보도록 studio 청사진도 동기화
            try {
                this.anStudio?.studio?.setBlueprintXml?.(xml, '순서도 To-Be 저장 반영');
            } catch (e) {
                console.warn('To-Be studio sync failed:', e);
            }
            return version;
        },

        async handleSaveToBe() {
            if (!this.ensureEditable()) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler || !this.selectedProcessId) return;

            try {
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                const version = await this.persistToBeVersion(xml);
                if (this.$toast) {
                    this.$toast.success(`To-Be v${version} 저장되었습니다.`);
                }
                // 저장 후 읽기 모드로 복귀 (편집 잠금 해제 포함)
                this.handleChangeMode(PROCESS_HIERARCHY_MODE.VIEW);
            } catch (e) {
                console.error('To-Be save failed:', e);
                if (this.$toast) {
                    this.$toast.error('To-Be Blueprint 저장에 실패했습니다.');
                }
            }
        },

        /** To-Be 히스토리에서 특정 버전으로 되돌리기 — 복원본을 새 버전으로 기록한다. */
        async handleRestoreToBeVersion(entry) {
            if (!entry?.xml) return;
            if (!this.ensureEditable()) return;
            if (!this.selectedProcessId) return;
            try {
                const version = await this.persistToBeVersion(entry.xml, `v${toSafeText(entry.version)} 복원`);
                const designer = this.$refs.designer;
                if (designer) {
                    designer.previewingToBeVersion = '';
                    designer.toBeBlueprintXml = entry.xml;
                    designer.bpmnKey++;
                }
                if (this.$toast) {
                    this.$toast.success(`To-Be v${toSafeText(entry.version)} → v${version}로 복원되었습니다.`);
                }
            } catch (e) {
                console.error('To-Be restore failed:', e);
                if (this.$toast) {
                    this.$toast.error('To-Be 버전 복원에 실패했습니다.');
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

        collectSchemaRequiredViolations() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            const catalogStore = useTaskCatalogStore();
            const schemasByAppliesTo = (target, elementType) => catalogStore.schemasByAppliesTo(target, elementType);
            return collectProcessRequiredViolations({
                modeler,
                processDefinition: this.processDefinition,
                processName: this.selectedProcessName,
                schemasByAppliesTo
            });
        },

        focusSchemaViolation(violation) {
            if (!violation?.elementId) return;
            const designer = this.$refs.designer;
            if (designer?.focusElement) {
                try {
                    designer.focusElement(violation.elementId);
                } catch (e) {
                    console.warn('focusSchemaViolation failed:', e);
                }
            }
        },

        async confirmSaveVersion() {
            if (!this.ensureEditable()) return;
            const preSaveViolations = this.collectSchemaRequiredViolations();
            if (preSaveViolations.length > 0) {
                this.schemaValidationViolations = preSaveViolations;
                this.schemaValidationBlockingSave = true;
                this.schemaValidationDialog = true;
                if (this.$toast) {
                    this.$toast.error('필수 입력 항목이 누락되어 저장할 수 없습니다.');
                }
                return;
            }
            this.savingVersion = true;
            try {
                const version = this.saveVersion;
                // 공람/최종수정 상태 잠금 시에는 어떤 경우에도 검토요청(=기존 리뷰 취소)을 보내지 않는다.
                const shouldSubmitReview = !this.lockSaveAsDraft && (this.forceReviewSubmission || this.saveSubmissionMode === 'review');
                let submitError = null;
                // BPMN XML 내부 uengine:properties의 version 필드 업데이트
                const xml = this.updateXmlVersion(this.pendingSaveXml, version);
                this.bpmnXml = xml;

                // [6.1.2] Canvas 썸네일 캡처 → definition JSON에 저장
                const thumbnail = await this.captureThumbnail();
                // BPMN XML에서 activities/sequences/events 등을 추출하여 definition에 동기화
                const definition = buildCopilotProcessDefinitionPayload({
                    storedDefinition: this.processDefinition?.definition || {},
                    bpmnXml: xml,
                    processDefinitionId: this.selectedProcessId,
                    processName: this.selectedProcessName
                }) || { ...(this.processDefinition?.definition || {}) };
                if (thumbnail) definition.thumbnail = thumbnail;

                // 새 minor 버전으로 저장 (거버넌스: 저장 시마다 마이너 버전 자동 기록)
                await backend.putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition,
                    version: version,
                    version_tag: null,
                    arcv_id: `${this.selectedProcessId}_${version}`,
                    message: this.saveVersionMessage || null
                });

                // 영구 저장 성공 → 속성 변경 감사 로그 일괄 기록 (API 연동·관련자료 링크)
                this.flushPropertyAudits();

                // 검토 요청 (버전 정보 포함)
                if (shouldSubmitReview) {
                    try {
                        await backend.submitForReview(this.selectedProcessId, this.saveVersionMessage || undefined, version);
                    } catch (reviewErr) {
                        submitError = reviewErr;
                        console.error('submitForReview failed after save:', reviewErr);
                    }
                }

                this.saveVersionDialog = false;
                this.forceReviewSubmission = false;
                this.lockedToDraftSave = false;
                this.savedBpmnXml = this.bpmnXml;

                if (this.$toast) {
                    if (submitError) {
                        const reviewMessage = submitError?.message || '검토 요청에 실패했습니다.';
                        this.$toast.warning(`v${version} 저장은 완료되었지만 검토 요청은 실패했습니다. ${reviewMessage}`);
                    } else {
                        const msg = shouldSubmitReview
                            ? this.$t('processHierarchy.savedAndSubmitted') || `v${version} 저장 및 검토 요청 완료`
                            : this.$t('successMsg.save') || '저장되었습니다.';
                        this.$toast.success(msg);
                    }
                }

                // proc_map에 해당 프로세스가 없으면 자동 등록 (proc_def만 있고 proc_map 누락된 경우 방���)
                // call-activity-sub 타입은 계층도에 등록하지 않음
                const isCallActivitySub = this.processDefinition?.definition?.type === 'call-activity-sub';
                if (!isCallActivitySub && this.selectedProcessId && this.procMap?.mega_proc_list) {
                    let foundInMap = false;
                    for (const mega of this.procMap.mega_proc_list) {
                        for (const major of mega.major_proc_list || []) {
                            if ((major.sub_proc_list || []).some((s) => s.id === this.selectedProcessId)) {
                                foundInMap = true;
                                break;
                            }
                        }
                        if (foundInMap) break;
                    }
                    if (!foundInMap) {
                        try {
                            const freshMap = await backend.getProcessDefinitionMap({ skipPermissionFilter: true });
                            if (freshMap?.mega_proc_list?.length > 0) {
                                const lastMega = freshMap.mega_proc_list[freshMap.mega_proc_list.length - 1];
                                const majorList = lastMega.major_proc_list || [];
                                if (majorList.length > 0) {
                                    const lastMajor = majorList[majorList.length - 1];
                                    if (!lastMajor.sub_proc_list) lastMajor.sub_proc_list = [];
                                    lastMajor.sub_proc_list.push({
                                        id: this.selectedProcessId,
                                        name: this.selectedProcessName || this.selectedProcessId
                                    });
                                    await backend.putProcessDefinitionMap(freshMap);
                                    this.procMap = freshMap;
                                    await this.syncProcessHierarchyMetadata(this.selectedProcessId, freshMap);
                                }
                            }
                        } catch (mapErr) {
                            console.warn('[ProcessHierarchy] proc_map 자동 등록 실패:', mapErr);
                        }
                    }
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

                this.handleChangeMode(PROCESS_HIERARCHY_MODE.VIEW);
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
                            version: this.saveVersion
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

        handleClone() {
            if (!this.canClone) return;
            if (!this.ensureEditable()) return;
            if (!this.selectedProcessId || !this.processDefinition) return;
            this.cloneDialog = true;
        },

        cancelClone() {
            if (this.cloning) return;
            this.cloneDialog = false;
        },

        async executeClone() {
            if (!this.canClone) return;
            if (!this.selectedProcessId || !this.processDefinition) return;

            this.cloning = true;
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                let currentBpmn = this.bpmnXml;
                if (modeler) {
                    const { xml } = await modeler.saveXML({ format: true });
                    currentBpmn = xml;
                }

                const newName = (this.selectedProcessName || 'Process') + ' (Copy)';
                const result = await backend.duplicateLocalProcess(this.selectedProcessId, newName, currentBpmn, this.processDefinition);

                if (result && result.success) {
                    if (this.$toast) {
                        this.$toast.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
                    }
                    await this.loadInitialData();
                    if (result.newId) {
                        await this.handleSelectProcess(result.newId, newName);
                    }
                }
                this.cloneDialog = false;
            } catch (e) {
                console.error('Clone failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('ProcessMenu.duplicateFailed') || '프로세스 복사에 실패했습니다.');
                }
            } finally {
                this.cloning = false;
            }
        },

        handleDelete() {
            if (!this.selectedProcessId) return;
            if (!this.isAdmin) {
                this.$toast?.warning('프로세스 삭제는 관리자만 가능합니다.');
                return;
            }
            if (!this.ensureEditable()) return;

            this.deleteAck = false;
            this.deleteDialog = true;
        },

        async handleRun() {
            if (!this.selectedProcessId || this.runStarting) return;
            if (!canUseExecFeatures()) {
                this.$toast?.warning('프로세스 실행 권한이 없습니다.');
                return;
            }
            this.runStarting = true;
            try {
                const execDef = await backend.getExecutionDefinition(this.selectedProcessId);
                const activities = execDef?.definition?.activities;
                if (!activities || activities.length === 0) {
                    this.$toast?.warning('이 프로세스에는 실행 정의가 없어 실행할 수 없습니다. 실행 정의(definition)가 등록된 프로세스만 실행됩니다.');
                    return;
                }
                // 다중 시작 정의: 시작 이벤트가 2개 이상이면 선택 다이얼로그를 거친다 (specs/010)
                // definition.events 에는 서브프로세스 children 이벤트도 평탄화되어 들어있으므로
                // 서브프로세스(process 필드가 subProcess id) 소속 시작 이벤트는 후보에서 제외한다.
                // 풀 2개 이상 도면은 실행형 Pool(definition.execPoolId)의 시작 이벤트만 후보로 삼는다.
                const startEvents = this.filterStartEventsByExecPool(
                    this.collectTopLevelStartEvents(execDef?.definition),
                    execDef
                );
                if (startEvents.length >= 2) {
                    this.startSelectEvents = startEvents;
                    this.startSelectDefinition = execDef.definition;
                    this.startSelectOpen = true;
                    this.runStarting = false; // 선택 대기 동안 버튼 잠금 해제 (취소 시 인스턴스 미생성)
                    return;
                }
                // 첫 태스크가 userTask 면 자동제출 대신 폼 입력과 함께 시작한다.
                const initial = this.resolveInitialActivity(execDef.definition, startEvents[0]?.id || null);
                if (this.isUserTaskType(initial.activity?.type)) {
                    this.openStartForm(execDef.definition, initial.startEventId);
                    return;
                }
                await this.doRunStart(null);
            } catch (e) {
                this.$toast?.error(e?.message || '프로세스 실행 중 오류가 발생했습니다.');
            } finally {
                if (!this.startSelectOpen) this.runStarting = false;
            }
        },

        collectTopLevelStartEvents(definition) {
            const subProcessIds = new Set();
            const collect = (def) => {
                (def?.subProcesses || []).forEach((sp) => {
                    if (sp?.id) subProcessIds.add(sp.id);
                    collect(sp?.children);
                });
            };
            collect(definition);
            return (definition?.events || []).filter((e) => e?.type === 'startEvent' && !subProcessIds.has(e?.process));
        },

        /**
         * 실행형 Pool 지정(definition.execPoolIds, 구버전 단일 execPoolId)이 있으면
         * 그 풀들 소속 시작 이벤트만 남긴다.
         * 풀 매핑은 실행 정의와 함께 반환된 BPMN XML 의 participant/process 구조로 판별.
         * 필터 결과가 비면(스탬프-도면 불일치 등) 원본을 유지해 실행 자체는 막지 않는다.
         */
        filterStartEventsByExecPool(startEvents, execDef) {
            try {
                const def = execDef?.definition;
                const poolIds = (Array.isArray(def?.execPoolIds) && def.execPoolIds.length
                    ? def.execPoolIds
                    : def?.execPoolId
                      ? [def.execPoolId]
                      : []
                ).map((id) => String(id || '').trim()).filter(Boolean);
                if (!poolIds.length || !execDef?.bpmn || !Array.isArray(startEvents) || startEvents.length <= 1) return startEvents;
                const skeleton = extractBpmnSkeleton(execDef.bpmn);
                if (!skeleton.pools || skeleton.pools.length < 2) return startEvents;
                const allowed = new Set(poolIds);
                const filtered = startEvents.filter((ev) => {
                    const pool = skeleton.poolByNode?.[ev?.id];
                    return !pool || allowed.has(pool);
                });
                return filtered.length ? filtered : startEvents;
            } catch (e) {
                console.warn('[ProcessHierarchy] 실행형 Pool 시작 이벤트 필터 실패(원본 유지):', e);
                return startEvents;
            }
        },

        /**
         * 엔진 find_initial_activity 와 같은 규칙으로 시작 이벤트 뒤 첫 액티비티를 찾는다.
         * events 에 시작 이벤트가 없는 정의는 엔진과 동일하게 gateways 의 startEvent 도 본다.
         */
        resolveInitialActivity(definition, startEventId) {
            let starts = this.collectTopLevelStartEvents(definition);
            if (starts.length === 0) {
                starts = (definition?.gateways || []).filter((g) => g?.type === 'startEvent');
            }
            const start = startEventId ? starts.find((e) => e?.id === startEventId) : starts[0];
            if (!start) return { startEventId: '', activity: null };
            const seq = (definition?.sequences || []).find((s) => s?.source === start.id);
            const activity = seq ? (definition?.activities || []).find((a) => a?.id === seq.target) || null : null;
            return { startEventId: start.id, activity };
        },

        isUserTaskType(type) {
            const t = String(type || '').toLowerCase();
            return t === 'usertask' || t === 'useractivity';
        },

        openStartForm(definition, startEventId) {
            // ProcessGPTExecute 는 mounted 에서 prop 정의 객체에 Object.assign 하므로 사본을 넘긴다.
            this.startFormDefinition = {
                ...definition,
                processDefinitionId: definition?.processDefinitionId || this.selectedProcessId,
                processDefinitionName: definition?.processDefinitionName || this.selectedProcessName
            };
            this.startFormStartEventId = startEventId || '';
            this.startFormKey += 1;
            this.startFormOpen = true;
        },

        onStartFormStarted({ instanceId } = {}) {
            this.startFormOpen = false;
            if (!instanceId) return;
            this.$toast?.success(`프로세스 인스턴스가 시작되었습니다. (ID: ${instanceId})`);
            // 순서도 화면을 떠나지 않고 인스턴스/태스크 ID를 바로 확인 — 이동은 패널의 열기 버튼으로.
            this.execInfoHighlightId = instanceId;
            this.execInfoOpen = true;
        },

        async doRunStart(startEventId) {
            this.runStarting = true;
            try {
                const command = {
                    process_instance_id: 'new',
                    process_definition_id: this.selectedProcessId
                };
                if (startEventId) command.start_event_id = startEventId;
                const data = await backend.start(command);
                if (data?.instanceId) {
                    this.$toast?.success(`프로세스 인스턴스가 시작되었습니다. (ID: ${data.instanceId})`);
                    // 순서도 화면을 떠나지 않고 인스턴스/태스크 ID를 바로 확인 — 이동은 패널의 열기 버튼으로.
                    this.execInfoHighlightId = data.instanceId;
                    this.execInfoOpen = true;
                } else {
                    this.$toast?.error(data?.error?.message || data?.message || '프로세스 실행에 실패했습니다.');
                }
            } catch (e) {
                this.$toast?.error(e?.message || '프로세스 실행 중 오류가 발생했습니다.');
            } finally {
                this.runStarting = false;
            }
        },

        onStartEventSelected(startEventId) {
            this.startSelectOpen = false;
            // 선택된 시작 이벤트의 첫 태스크가 userTask 면 폼 입력과 함께 시작한다.
            const definition = this.startSelectDefinition;
            if (definition) {
                const initial = this.resolveInitialActivity(definition, startEventId);
                if (this.isUserTaskType(initial.activity?.type)) {
                    this.openStartForm(definition, initial.startEventId || startEventId);
                    return;
                }
            }
            this.doRunStart(startEventId);
        },

        onStartSelectCancel() {
            // 취소: 인스턴스 미생성 (contracts/ui-start-selection.md)
            this.startSelectOpen = false;
            this.startSelectEvents = [];
            this.startSelectDefinition = null;
        },

        openExecInfo() {
            if (!this.selectedProcessId) return;
            if (!canUseExecFeatures()) {
                this.$toast?.warning('실행 정보 조회 권한이 없습니다.');
                return;
            }
            this.execInfoHighlightId = '';
            this.execInfoOpen = true;
        },

        cancelDelete() {
            if (this.deleting) return;
            this.deleteDialog = false;
            this.deleteAck = false;
        },

        async executeDelete() {
            if (!this.selectedProcessId || !this.deleteAck) return;

            const defId = this.selectedProcessId;
            this.deleting = true;

            try {
                const supabase = window.$supabase;
                const tenantId = window.$tenantName;

                // SSO 모드에서 Supabase RLS 인증 헤더 갱신
                await storage.ensureSupabaseAuthHeader();

                // 소프트 삭제: deleted_at 타임스탬프 설정 (휴지통에서 복구 가능)
                // deleted_by 는 DB 트리거가 JWT 클레임에서 자동 추출해 채움
                if (supabase) {
                    const deletedAt = new Date().toISOString();

                    // 원래 위치 정보 기록 (복원 시 사용)
                    let deletedFrom = null;
                    const currentProcMap = this.procMap || { mega_proc_list: [] };
                    for (const mega of currentProcMap.mega_proc_list || []) {
                        for (const major of mega.major_proc_list || []) {
                            const found = (major.sub_proc_list || []).find((sub) => sub.id === defId || sub.proc_def_id === defId);
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

                    // proc_def, tb_bpmn_model 양쪽 모두 soft delete (deleted_by 는 트리거가 자동 채움)
                    const results = await Promise.allSettled([
                        supabase
                            .from('proc_def')
                            .update({ deleted_at: deletedAt, deleted_from: deletedFrom })
                            .eq('id', defId)
                            .eq('tenant_id', tenantId),
                        supabase.from('tb_bpmn_model').update({ deleted_at: deletedAt }).eq('proc_def_id', defId).eq('tenant_id', tenantId)
                    ]);

                    // proc_def 업데이트 실패 시 에러
                    const procDefResult = results[0];
                    if (procDefResult.status === 'rejected') {
                        throw procDefResult.reason;
                    }
                    if (procDefResult.status === 'fulfilled' && procDefResult.value.error) {
                        throw procDefResult.value.error;
                    }
                    const modelResult = results[1];
                    if (modelResult.status === 'rejected') {
                        throw modelResult.reason;
                    }
                    if (modelResult.status === 'fulfilled' && modelResult.value.error) {
                        throw modelResult.value.error;
                    }

                    // lock 해제
                    await supabase.from('lock').delete().eq('id', defId).eq('tenant_id', tenantId);

                    backend.insertAdminAuditLog({
                        action: 'process_soft_delete',
                        target_type: 'process',
                        target_id: defId,
                        target_name: this.selectedProcessName || defId,
                        before_value: deletedFrom
                            ? {
                                  mega_name: deletedFrom.mega_name,
                                  major_name: deletedFrom.major_name,
                                  process_name: deletedFrom.process_name
                              }
                            : null
                    });
                } else {
                    await backend.deleteDefinition(defId, {});
                }

                // procMap에서 제거
                const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
                (nextProcMap.mega_proc_list || []).forEach((mega) => {
                    (mega.major_proc_list || []).forEach((major) => {
                        // 엔트리에 따라 id 대신 proc_def_id 만 갖는 경우가 있어 양쪽 모두 매칭
                        major.sub_proc_list = (major.sub_proc_list || []).filter((sub) => sub.id !== defId && sub.proc_def_id !== defId);
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
                this.deleteDialog = false;
                this.deleteAck = false;
            } catch (e) {
                console.error('Delete failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('common.deleteFailed') || '프로세스 삭제에 실패했습니다.');
                }
            } finally {
                this.deleting = false;
            }
        },

        async loadHistoryPanelData() {
            if (!this.selectedProcessId) return;

            this.historyLoading = true;
            try {
                const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                    sort: 'desc',
                    orderBy: 'version'
                });
                const mapped = [...(versions || [])]
                    .map((row, index) => ({
                        ...row,
                        id: toSafeText(row?.id || index).trim() || String(index),
                        version: toSafeText(row?.version).trim(),
                        version_tag: toSafeText(row?.version_tag).trim(),
                        snapshot: this.normalizeBpmnXml(row?.snapshot),
                        created_at: toSafeText(row?.created_at || row?.timeStamp).trim()
                    }))
                    .sort((a, b) => {
                        const [aMajor, aMinor] = toSafeText(a.version || '0.0')
                            .split('.')
                            .map(Number);
                        const [bMajor, bMinor] = toSafeText(b.version || '0.0')
                            .split('.')
                            .map(Number);
                        if (bMajor !== aMajor) return bMajor - aMajor;
                        return (bMinor || 0) - (aMinor || 0);
                    });
                this.historyVersions = await this.attachVersionOwnerNames(mapped);

                if (!this.historySelectedVersion && this.historyVersions.length > 0) {
                    this.historySelectedVersion = toSafeText(this.historyVersions[0].version).trim();
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

            const normalizedVersionKey = toSafeText(versionKey).trim();
            const matched = this.historyVersions.find((row) => toSafeText(row.version).trim() === normalizedVersionKey);
            if (matched?.snapshot) {
                return matched.snapshot;
            }

            if (!normalizedVersionKey || !this.selectedProcessId || typeof backend.getRawDefinition !== 'function') {
                return '';
            }

            try {
                return await backend.getRawDefinition(this.selectedProcessId, { type: 'bpmn', version: normalizedVersionKey });
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
                this.resolveHistoryXml(this.historyCompareVersion)
            ]);

            if (!baseXml || !compareXml || this.historySelectedVersion === this.historyCompareVersion) {
                this.historyDiffRows = [];
                return;
            }

            try {
                const result = computeBpmnDiff(baseXml, compareXml);
                this.historyDiffRows = (result.changes || []).map((change, index) => ({
                    key: `${toSafeText(change.id)}-${toSafeText(change.type)}-${index}`,
                    label: toSafeText(change.name || change.id),
                    description: toSafeText(change.description || '변경점이 감지되었습니다.'),
                    section: formatElementTypeName(toSafeText(change.elementType))
                }));
            } catch (e) {
                console.error('Failed to compute history diff:', e);
                this.historyDiffRows = [];
            }
        },

        async selectHistoryVersion(version) {
            this.historySelectedVersion = toSafeText(version).trim();

            if (this.historySelectedVersion === this.historyCompareVersion) {
                this.historyCompareVersion = '__current__';
            }

            await this.runHistoryDiff();
        },

        async updateHistoryCompareVersion(version) {
            this.historyCompareVersion = toSafeText(version || '__current__').trim() || '__current__';
            await this.runHistoryDiff();
        },

        async handleVersionRollback({ xml, versionLabel }) {
            if (!xml || !this.selectedProcessId) return;
            try {
                await backend.putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    version: toSafeText(versionLabel).trim()
                });
                if (this.$toast) {
                    this.$toast.success(`v${toSafeText(versionLabel).trim()} 버전으로 되돌렸습니다.`);
                }
                this.showHistoryPanel = false;
                await this.loadProcess(this.selectedProcessId);

                // loadProcess 후에도 proc_def.version이 갱신되지 않을 수 있어 로컬 동기화
                if (this.processDefinition) {
                    this.processDefinition.version = toSafeText(versionLabel).trim();
                }
                const listIndex = this.definitionList.findIndex((d) => toSafeText(d?.id || d?.file_name).trim() === this.selectedProcessId);
                if (listIndex >= 0) {
                    this.definitionList.splice(listIndex, 1, {
                        ...this.definitionList[listIndex],
                        version: toSafeText(versionLabel).trim()
                    });
                }

                this.showHistoryPanel = true;
                await this.loadHistoryPanelData();
            } catch (e) {
                console.error('Rollback failed:', e);
                if (this.$toast) {
                    this.$toast.error('되돌리기에 실패했습니다.');
                }
            }
        },

        async handleChangeMode(newMode) {
            if (!newMode) return;
            if (newMode === PROCESS_HIERARCHY_MODE.EDIT && !this.hasEditAccess) return;
            if (newMode === PROCESS_HIERARCHY_MODE.EDIT && this.isDataFreezeLocked) {
                this.$toast?.warning(this.readOnlyMessage || 'Data Freeze가 적용된 범위입니다.');
                return;
            }
            // 편집 모드 진입 시 lock acquire
            if (newMode === PROCESS_HIERARCHY_MODE.EDIT && this.selectedProcessId) {
                const acquired = await this.acquireProcessEditLock(this.selectedProcessId);
                if (!acquired) return;
            }
            // 편집 모드에서 벗어날 때 lock release
            if (newMode !== PROCESS_HIERARCHY_MODE.EDIT && this.requestedMode === PROCESS_HIERARCHY_MODE.EDIT && this.selectedProcessId) {
                await this.releaseProcessEditLock(this.selectedProcessId);
            }
            this.requestedMode = newMode;
            if (newMode === PROCESS_HIERARCHY_MODE.HISTORY) {
                this.handleVersionHistory();
            } else {
                this.showHistoryPanel = false;
            }
        },

        async handleVersionHistory() {
            if (!this.selectedProcessId) return;
            this.showHistoryPanel = true;
            await this.loadHistoryPanelData();
        },

        async selectVersionPreview(version) {
            if (!this.selectedProcessId || !version) return;
            if (version === '__current__') {
                this.bpmnXml = this.savedBpmnXml;
                return;
            }
            try {
                const xml = await this.resolveHistoryXml(version);
                if (xml) {
                    this.bpmnXml = xml;
                }
            } catch (e) {
                console.warn('[ProcessHierarchy] Failed to load version preview:', e);
            }
        },

        async handleVersionSave() {
            this.versionDialog = false;
            await this.handleSave();
        },

        async handlePropertiesSave(data) {
            if (!this.ensureEditable()) return;
            if (!this.processDefinition) return;
            try {
                const parentChange = data._parentChange;
                delete data._parentChange;

                const currentDefBefore = this.processDefinition.definition || {};
                const beforeSnapshot = {
                    name: this.processDefinition.name,
                    owner: this.processDefinition.owner,
                    description: this.processDefinition.description,
                    type: this.processDefinition.type,
                    prod_version: this.processDefinition.prod_version,
                    systems: currentDefBefore.systems,
                    fte: currentDefBefore.fte,
                    fteHoursPerMonth: currentDefBefore.fteHoursPerMonth,
                    futureState: currentDefBefore.futureState,
                    wilTask: currentDefBefore.wilTask,
                    hitlRequired: currentDefBefore.hitlRequired,
                    manualLink: currentDefBefore.manualLink,
                    kpiEnabled: currentDefBefore.kpiEnabled,
                    primaryOwner: currentDefBefore.meta?.owners?.primaryOwner,
                    version: currentDefBefore.version,
                    shortDescription: currentDefBefore.shortDescription,
                    roles: currentDefBefore.roles,
                    participants: currentDefBefore.participants
                };

                if (data.name) this.selectedProcessName = data.name;
                Object.assign(this.processDefinition, data);

                if (parentChange) {
                    await this.applyParentChange(parentChange.megaId, parentChange.majorId);
                }

                if (!this.selectedProcessId) return;

                const currentDef = this.processDefinition.definition || {};
                const updatedDef = {
                    ...currentDef,
                    description: data.description ?? '',
                    systems: data.systems,
                    fte: data.fte,
                    futureState: data.futureState,
                    wilTask: data.wilTask,
                    fteHoursPerMonth: data.fteHoursPerMonth,
                    hitlRequired: data.hitlRequired,
                    manualLinks: Array.isArray(data.manualLinks) ? data.manualLinks : currentDef.manualLinks,
                    kpiEnabled: data.kpiEnabled
                };

                const taskCatalogStore = useTaskCatalogStore();
                const activeSchemaFields = taskCatalogStore.schemasByAppliesTo('process') || [];
                const deprecatedSchemaFields = taskCatalogStore.deprecatedSchemasByAppliesTo('process') || [];
                const mergedSchemaFields = [...activeSchemaFields, ...deprecatedSchemaFields];
                mergedSchemaFields.forEach((schemaField) => {
                    if (schemaField.property_type === 'daterange') {
                        const startKey = `${schemaField.property_key}_start`;
                        const endKey = `${schemaField.property_key}_end`;
                        if (Object.prototype.hasOwnProperty.call(data, startKey)) updatedDef[startKey] = data[startKey];
                        if (Object.prototype.hasOwnProperty.call(data, endKey)) updatedDef[endKey] = data[endKey];
                    } else if (Object.prototype.hasOwnProperty.call(data, schemaField.property_key)) {
                        updatedDef[schemaField.property_key] = data[schemaField.property_key];
                        if (schemaField.property_type === 'user') {
                            const labelKey = `${schemaField.property_key}_label`;
                            if (Object.prototype.hasOwnProperty.call(data, labelKey)) {
                                updatedDef[labelKey] = data[labelKey];
                            }
                        }
                    }
                });

                if (data.owner) {
                    if (!updatedDef.meta) updatedDef.meta = {};
                    if (!updatedDef.meta.owners) updatedDef.meta.owners = {};
                    updatedDef.meta.owners.primaryOwner = data.owner;
                }

                const updatePayload = {
                    name: data.name || this.selectedProcessName,
                    owner: data.owner || null,
                    definition: updatedDef
                };

                // FR-012: 프로세스명이 실제로 바뀌면 BPMN XML 의 <process name> 도 함께 갱신한다.
                //   <process id> 는 변경하지 않는다 (C4: id = proc_def_id = proc_map.sub.id = calledElement 타깃).
                //   name 만 바꾼 businessObject 를 재직렬화해 proc_def.bpmn 컬럼에 반영(별도 저장 호출 없이 동일 payload 로).
                const nameChanged = !!data.name && String(data.name).trim() !== String(beforeSnapshot.name ?? '').trim();
                if (nameChanged) {
                    try {
                        const store = useBpmnStore();
                        const modeler = store.getModeler;
                        if (modeler) {
                            const elementRegistry = modeler.get('elementRegistry');
                            const processes = elementRegistry.filter((el) => el.type === 'bpmn:Process' && el.businessObject);
                            // id 가 proc_def_id 와 일치하는 프로세스 우선, 없으면 단일 프로세스인 경우만 대상(모호하면 no-op).
                            let target = processes.find((pe) => pe.businessObject.id === this.selectedProcessId);
                            if (!target && processes.length === 1) target = processes[0];
                            if (target) {
                                target.businessObject.name = data.name; // name 만 갱신, id 는 그대로
                                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                                if (xml) Object.assign(updatePayload, { bpmn: xml });
                            }
                        }
                    } catch (e) {
                        console.warn('[ProcessHierarchy] <process name> XML 동기화 건너뜀:', e);
                    }
                }

                await backend.updateProcessDefinitionMetadata(this.selectedProcessId, updatePayload, '속성 저장');

                this.processDefinition.definition = updatedDef;

                if (data.name) {
                    this.selectedProcessName = data.name;
                }
                const hasNameUpdate = !!data.name;
                const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(data, 'description');
                // FR-011: 프로세스명 → 체계도(proc_map) 동기화.
                //   명칭 동기화는 editor+ 가능한 RPC(sync_proc_map_name)를 단일 권위로 사용한다.
                //   기존 putProcessDefinitionMap 은 owner+/admin RLS 라 editor 저장 시 조용히 실패(=재발 원인)했다.
                if (hasNameUpdate) {
                    try {
                        await backend.updateProcessNameInMap(this.selectedProcessId, data.name);
                    } catch (e) {
                        console.warn('[ProcessHierarchy] sync_proc_map_name failed:', e);
                    }
                }
                if ((hasNameUpdate || hasDescriptionUpdate) && this.procMap?.mega_proc_list) {
                    const nextProcMap = JSON.parse(JSON.stringify(this.procMap));
                    let subUpdated = false;
                    for (const mega of nextProcMap.mega_proc_list) {
                        for (const major of mega.major_proc_list || []) {
                            const sub = (major.sub_proc_list || []).find((s) => s.id === this.selectedProcessId);
                            if (sub) {
                                if (hasNameUpdate) sub.name = data.name;
                                if (hasDescriptionUpdate) sub.description = data.description ?? '';
                                subUpdated = true;
                                break;
                            }
                        }
                        if (subUpdated) break;
                    }
                    if (subUpdated) {
                        // 로컬 procMap 즉시 반영(이름은 위 RPC 로 서버 동기화 완료).
                        this.procMap = nextProcMap;
                        try {
                            // owner+ 는 여기서 description 까지 서버 반영. editor 는 owner+ 전용 RLS 로 실패해도
                            // 이름은 RPC 로 이미 동기화됐으므로 치명적이지 않다(경고만).
                            await backend.putProcessDefinitionMap(nextProcMap);
                        } catch (e) {
                            console.warn('[ProcessHierarchy] putProcessDefinitionMap skipped (name already synced via RPC):', e);
                        }
                    }
                }

                const afterSnapshot = {
                    name: data.name || this.selectedProcessName,
                    owner: data.owner || null,
                    description: data.description || '',
                    type: this.processDefinition.type,
                    prod_version: this.processDefinition.prod_version,
                    systems: updatedDef.systems,
                    fte: updatedDef.fte,
                    fteHoursPerMonth: updatedDef.fteHoursPerMonth,
                    futureState: updatedDef.futureState,
                    wilTask: updatedDef.wilTask,
                    hitlRequired: updatedDef.hitlRequired,
                    manualLink: updatedDef.manualLink,
                    kpiEnabled: updatedDef.kpiEnabled,
                    primaryOwner: updatedDef.meta?.owners?.primaryOwner,
                    version: updatedDef.version,
                    shortDescription: updatedDef.shortDescription,
                    roles: updatedDef.roles,
                    participants: updatedDef.participants
                };
                backend.insertAdminAuditLog({
                    action: 'process_update',
                    target_type: 'process',
                    target_id: this.selectedProcessId,
                    target_name: afterSnapshot.name,
                    before_value: beforeSnapshot,
                    after_value: afterSnapshot
                });

                if (this.$toast) {
                    this.$toast.success('속성이 저장되었습니다.');
                }
            } catch (e) {
                console.error('Properties save failed:', e);
                if (this.$toast) {
                    this.$toast.error('속성 저장에 실패했습니다.');
                }
            }
        },

        handleTaskMappingChanged() {
            this.$refs.designer?.refreshTaskMappingBadges?.();
            this.$refs.designer?.refreshCommentOverlays?.();
            this.$refs.designer?.refreshRelatedProjectGroupOverlays?.();
        },

        // 속성값 저장하기 → 프로세스 저장 버튼 없이 즉시 서버 반영 (연타 대비 직렬화)
        handlePersistBpmn(options = {}) {
            this._persistBpmnQueue = (this._persistBpmnQueue || Promise.resolve())
                .then(() => this.persistBpmnSnapshot(options))
                .catch((e) => console.debug('[ProcessHierarchy] persistBpmn queue error:', e));
            return this._persistBpmnQueue;
        },

        /**
         * 현재 모델러 XML 을 새 버전 발행 없이 영구 반영한다.
         * - 로드 경로가 최신 proc_def_version.snapshot 을 우선하므로 최신 버전 행의 snapshot 을
         *   같은 버전 번호로 덮어쓴다 (published 버전은 putRawDefinition 이 minor 자동 증가로 보호).
         * - 버전 이력이 없으면 proc_def.bpmn 만 갱신한다 (로드 폴백 경로와 일치).
         * - 새 버전 발행/검토 요청은 기존 '프로세스 저장' 버튼 플로우를 그대로 유지한다.
         */
        async persistBpmnSnapshot(options = {}) {
            if (!this.selectedProcessId || !this.processDefinition) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                if (!xml) return;

                const designer = this.$refs.designer;
                if (designer && designer.toBeMode) {
                    // To-Be 모드: 현재 To-Be XML 만 갱신 (To-Be 버전 이력 추가는 프로세스 저장 전용)
                    const updatedDef = { ...(this.processDefinition.definition || {}), tobe_bpmn: xml };
                    await backend.updateProcessDefinitionMetadata(this.selectedProcessId, { definition: updatedDef }, '속성 저장');
                    this.processDefinition.definition = updatedDef;
                    designer.toBeBlueprintXml = xml;
                    return;
                }

                // 검토(승인) 진행 중이면 스냅샷을 몰래 덮어쓰지 않고 기존 거버넌스 플로우로 유도
                try {
                    const activeApproval = await backend.getActiveApprovalState(this.selectedProcessId);
                    if (activeApproval && !this.isSaveOnlyGovernanceState(activeApproval.state)) {
                        this.$toast?.info('검토 진행 중인 프로세스입니다. 속성값은 편집기에 반영되었으니 프로세스 저장 버튼으로 저장해 주세요.');
                        return;
                    }
                } catch (e) {
                    console.warn('[ProcessHierarchy] 승인 상태 확인 실패(속성 즉시 반영 계속 진행):', e);
                }

                // 로드 경로(created_at 최신 스냅샷)와 동일한 기준으로 덮어쓸 최신 버전 행을 찾는다
                let latest = null;
                try {
                    const versions = await backend.getDefinitionVersions(this.selectedProcessId, {
                        sort: 'desc',
                        orderBy: 'created_at'
                    });
                    if (Array.isArray(versions) && versions.length > 0) {
                        latest = [...versions].sort((a, b) => {
                            const at = new Date(a.created_at || a.timeStamp || 0).getTime();
                            const bt = new Date(b.created_at || b.timeStamp || 0).getTime();
                            return bt - at;
                        })[0];
                    }
                } catch (e) {
                    console.warn('[ProcessHierarchy] 버전 조회 실패(속성 즉시 반영 계속 진행):', e);
                }

                const definition = buildCopilotProcessDefinitionPayload({
                    storedDefinition: this.processDefinition.definition || {},
                    bpmnXml: xml,
                    processDefinitionId: this.selectedProcessId,
                    processName: this.selectedProcessName
                }) || { ...(this.processDefinition.definition || {}) };

                await backend.putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition,
                    version: latest?.version || undefined,
                    version_tag: latest?.version_tag ?? null,
                    arcv_id: latest ? (latest.arcv_id || `${this.selectedProcessId}_${latest.version}`) : undefined,
                    message: latest?.message ?? null
                });

                // putRawDefinition 이 편집 잠금을 해제하므로 편집 세션 유지를 위해 재획득
                if (this.editorMode === PROCESS_HIERARCHY_MODE.EDIT) {
                    await this.acquireProcessEditLock(this.selectedProcessId);
                }

                this.bpmnXml = xml;
                this.savedBpmnXml = xml;
                this.processDefinition.bpmn = xml;
                this.processDefinition.definition = definition;

                const projectIds = Array.isArray(options.projectIds) ? options.projectIds : [];
                if (projectIds.length) {
                    try {
                        await syncProjectMappingsFromModeler({
                            modeler,
                            processId: this.selectedProcessId,
                            processName: this.selectedProcessName,
                            projectIds,
                        });
                    } catch (mappingError) {
                        console.warn('[ProcessHierarchy] 과제 매핑 API 동기화 실패:', mappingError);
                        this.$toast?.warning('프로세스는 저장되었지만 연관 과제 매핑 동기화에 실패했습니다. 다시 저장해 주세요.');
                    }
                }

                // 영구 반영 완료 → 버퍼된 속성 감사 로그 즉시 기록
                this.flushPropertyAudits();
            } catch (e) {
                console.error('[ProcessHierarchy] 속성값 즉시 반영 실패:', e);
                this.$toast?.error('속성값 서버 반영에 실패했습니다. 프로세스 저장 버튼으로 다시 저장해 주세요.');
            }
        },

        // 속성값 임시저장 시점에 변경분을 버퍼에 적재 (가장 처음 before 유지, 최신 after 갱신)
        onPropertyAuditPending(payload) {
            if (!payload?.elementId) return;
            const prev = this.pendingPropertyAudits[payload.elementId] || {
                elementName: payload.elementName,
                api: null,
                manualLinks: null
            };
            prev.elementName = payload.elementName;
            if (payload.api) {
                if (!prev.api) prev.api = { before: payload.api.before, after: payload.api.after };
                else prev.api.after = payload.api.after;
            }
            if (payload.manualLinks) {
                if (!prev.manualLinks) prev.manualLinks = { before: payload.manualLinks.before, after: payload.manualLinks.after };
                else prev.manualLinks.after = payload.manualLinks.after;
            }
            this.pendingPropertyAudits[payload.elementId] = prev;
        },

        // 실제 영구 저장 성공 시 버퍼에 쌓인 변경분을 감사 로그로 일괄 기록
        flushPropertyAudits() {
            const entries = Object.entries(this.pendingPropertyAudits || {});
            this.pendingPropertyAudits = {};
            for (const [elementId, entry] of entries) {
                if (entry.api && JSON.stringify(entry.api.before) !== JSON.stringify(entry.api.after)) {
                    backend
                        .insertAdminAuditLog({
                            action: 'task_api_integration_change',
                            target_type: 'task',
                            target_id: elementId,
                            target_name: entry.elementName,
                            before_value: entry.api.before,
                            after_value: entry.api.after
                        })
                        .catch((err) => console.warn('[ApiIntegration] audit log insert failed:', err));
                }
                if (entry.manualLinks && JSON.stringify(entry.manualLinks.before) !== JSON.stringify(entry.manualLinks.after)) {
                    backend
                        .insertAdminAuditLog({
                            action: 'task_manual_link_change',
                            target_type: 'task',
                            target_id: elementId,
                            target_name: entry.elementName,
                            before_value: { links: entry.manualLinks.before },
                            after_value: { links: entry.manualLinks.after }
                        })
                        .catch((err) => console.warn('[ManualLink] audit log insert failed:', err));
                }
            }
        },

        async handleParentChanged() {
            // Domain/Mega/Major 변경 또는 모듈 전환 후 proc_map(트리) + 현재 열린 processDefinition 둘 다 다시 로드
            try {
                const currentId = this.selectedProcessId;
                await this.loadInitialData();
                if (currentId) {
                    await this.loadProcess(currentId);
                }
            } catch (e) {
                console.warn('[ProcessHierarchy] reload after parent change failed:', e);
            }
        },

        handleBpmnLoaded() {
            this.bpmnLoaded = true;
            // 재접속/재로드 시 definition.ai_copilot 에 저장된 파티션을 캔버스에 다시 표시.
            this.$nextTick(() => this.restorePartitionOverlay());
        },

        // 저장된 파티션 결과를 As-Is 캔버스에 다시 그려 재접속 후에도 이력을 볼 수 있게 한다.
        restorePartitionOverlay() {
            const designer = this.$refs.designer;
            if (!designer || designer.partitionEditMode) return;
            if (this.designerActiveMode && this.designerActiveMode !== 'as-is') return;
            const partitions = this.aiCopilotState.partitions || this.anStudio?.partitions?.value || [];
            const blocks = partitions.filter((b) => (b.element_ids || []).length > 0);
            if (!blocks.length) return;
            // color_idx 미지정 구버전 데이터도 편집 진입 시 영속화될 색과 동일하게 표시 (표시 전용, 저장은 편집 진입 시)
            designer.renderPartitionBlocks(ensurePartitionColors(blocks).partitions);
        },

        async applyParentChange(newMegaId, newMajorId) {
            const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
            let removedSub = null;

            for (const mega of nextProcMap.mega_proc_list) {
                for (const major of mega.major_proc_list || []) {
                    const idx = (major.sub_proc_list || []).findIndex((sub) => sub.id === this.selectedProcessId);
                    if (idx >= 0) {
                        removedSub = major.sub_proc_list.splice(idx, 1)[0];
                        break;
                    }
                }
                if (removedSub) break;
            }

            if (!removedSub) {
                removedSub = { id: this.selectedProcessId, name: this.selectedProcessName || '' };
            }

            const targetMega = nextProcMap.mega_proc_list.find((m) => m.id === newMegaId);
            if (targetMega) {
                const targetMajor = (targetMega.major_proc_list || []).find((m) => m.id === newMajorId);
                if (targetMajor) {
                    if (!targetMajor.sub_proc_list) targetMajor.sub_proc_list = [];
                    targetMajor.sub_proc_list.push(removedSub);
                }
            }

            await backend.putProcessDefinitionMap(nextProcMap);
            this.procMap = nextProcMap;
            await this.syncProcessHierarchyMetadata(this.selectedProcessId, nextProcMap);
        },

        async handleAddMegaProcess({ name }) {
            if (!this.isOwner) {
                this.$toast?.warning('프로세스 생성은 소유자(Owner) 이상만 가능합니다.');
                return;
            }
            if (!this.ensureEditable()) return;
            try {
                const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
                if (!nextProcMap.mega_proc_list) nextProcMap.mega_proc_list = [];

                const existingIds = nextProcMap.mega_proc_list.map((m) => m.id);
                const nextSeq = getNextSequenceFromIds(existingIds, 'mega');
                const newId = generateProcessId('mega', nextSeq);

                nextProcMap.mega_proc_list.push({
                    id: newId,
                    name: name,
                    major_proc_list: []
                });

                await backend.putProcessDefinitionMap(nextProcMap);
                this.procMap = nextProcMap;
                await this.loadInitialData();

                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.megaAdded') || 'Mega 프로세스가 추가되었습니다.');
                }
            } catch (e) {
                console.error('Failed to add mega process:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.addFailed') || '프로세스 추가에 실패했습니다.');
                }
            }
        },

        async handleAddMajorProcess({ megaId, name, domain }) {
            if (!this.isOwner) {
                this.$toast?.warning('프로세스 생성은 소유자(Owner) 이상만 가능합니다.');
                return;
            }
            if (!this.ensureEditable()) return;
            try {
                const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
                const mega = (nextProcMap.mega_proc_list || []).find((m) => m.id === megaId);
                if (!mega) {
                    console.error('Mega process not found:', megaId);
                    return;
                }
                if (!mega.major_proc_list) mega.major_proc_list = [];

                const allMajorIds = [];
                (nextProcMap.mega_proc_list || []).forEach((m) => {
                    (m.major_proc_list || []).forEach((maj) => allMajorIds.push(maj.id));
                });
                const nextSeq = getNextSequenceFromIds(allMajorIds, 'major');
                const newId = generateProcessId('major', nextSeq);
                const resolvedDomainId =
                    (this.metricsMap?.domains || []).find((item) => item?.name === domain || item?.id === domain)?.id || domain;

                mega.major_proc_list.push({
                    id: newId,
                    name: name,
                    domain: domain,
                    ...(resolvedDomainId ? { domain_id: resolvedDomainId } : {}),
                    sub_proc_list: []
                });

                await backend.putProcessDefinitionMap(nextProcMap);
                this.procMap = nextProcMap;
                await this.loadInitialData();

                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.majorAdded') || 'Major 프로세스가 추가되었습니다.');
                }
            } catch (e) {
                console.error('Failed to add major process:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.addFailed') || '프로세스 추가에 실패했습니다.');
                }
            }
        },

        async handleRenameProcess({ level, id, megaId, name }) {
            if (!this.isAdmin) {
                this.$toast?.warning('이름 변경은 관리자만 가능합니다.');
                return;
            }
            if (!this.ensureEditable()) return;
            try {
                // lock 테이블 재조회하여 하위 Sub 프로세스 편집 중인지 확인
                const lockedSub = await this.checkSubProcessLocks(level, id);
                if (lockedSub) {
                    this.editLockOwnerName = lockedSub.userName || lockedSub.userId || '다른 사용자';
                    this.editLockDialog = true;
                    return;
                }

                const nextProcMap = JSON.parse(JSON.stringify(this.procMap || { mega_proc_list: [] }));
                let renamed = false;

                if (level === 'mega') {
                    const mega = (nextProcMap.mega_proc_list || []).find((m) => m.id === id);
                    if (mega) {
                        mega.name = name;
                        renamed = true;
                    }
                } else if (level === 'major') {
                    for (const mega of nextProcMap.mega_proc_list || []) {
                        const major = (mega.major_proc_list || []).find((m) => m.id === id);
                        if (major) {
                            major.name = name;
                            renamed = true;
                            break;
                        }
                    }
                }

                if (!renamed) {
                    console.error('Rename target not found:', level, id);
                    return;
                }

                await backend.putProcessDefinitionMap(nextProcMap);
                this.procMap = nextProcMap;

                if (this.$toast) {
                    this.$toast.success('프로세스 이름이 변경되었습니다.');
                }
            } catch (e) {
                console.error('Failed to rename process:', e);
                if (this.$toast) {
                    this.$toast.error('이름 변경에 실패했습니다.');
                }
            }
        },

        async checkSubProcessLocks(level, id) {
            try {
                const supabase = window.$supabase;
                if (!supabase) return null;

                // 해당 Mega/Major 하위의 모든 Sub 프로세스 ID 수집
                const subIds = [];
                const megaList = this.procMap?.mega_proc_list || [];

                if (level === 'mega') {
                    const mega = megaList.find((m) => m.id === id);
                    if (mega) {
                        for (const major of mega.major_proc_list || []) {
                            for (const sub of major.sub_proc_list || []) {
                                if (sub.id) subIds.push(sub.id);
                            }
                        }
                    }
                } else if (level === 'major') {
                    for (const mega of megaList) {
                        const major = (mega.major_proc_list || []).find((m) => m.id === id);
                        if (major) {
                            for (const sub of major.sub_proc_list || []) {
                                if (sub.id) subIds.push(sub.id);
                            }
                            break;
                        }
                    }
                }

                if (subIds.length === 0) return null;

                const { data: locks } = await supabase
                    .from('lock')
                    .select('id, user_id, user_name')
                    .eq('tenant_id', window.$tenantName)
                    .in('id', subIds);

                if (!locks || locks.length === 0) return null;

                const otherLock = locks.find((l) => this.hasLockOwner(l) && !this.isLockOwnedByCurrentUser(l));
                if (otherLock) {
                    return { userId: otherLock.user_id, userName: otherLock.user_name };
                }
                return null;
            } catch (e) {
                console.warn('[ProcessHierarchy] checkSubProcessLocks failed:', e);
                return null;
            }
        },

        normalizeGeneratedProcessName(value, index) {
            const name = toSafeText(value).trim();
            return name || `AI 생성 프로세스 ${index + 1}`;
        },

        createGeneratedProcessId(name, index, usedIds) {
            const slug =
                toSafeText(name)
                    .toLowerCase()
                    .replace(/[^a-z0-9가-힣]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '') || `generated-process-${index + 1}`;
            const base = `ca-${slug}`;
            let suffix = `${Date.now()}-${index + 1}`;
            let candidate = `${base}-${suffix}`;
            let counter = 1;

            while (usedIds.has(candidate)) {
                suffix = `${Date.now()}-${index + 1}-${counter++}`;
                candidate = `${base}-${suffix}`;
            }

            usedIds.add(candidate);
            return candidate;
        },

        async handleRegisterGeneratedProcesses(payload = {}) {
            const resolve = typeof payload.resolve === 'function' ? payload.resolve : null;
            const reject = typeof payload.reject === 'function' ? payload.reject : null;

            try {
                if (!this.isOwner) {
                    const message = '프로세스 생성은 소유자(Owner) 이상만 가능합니다.';
                    this.$toast?.warning(message);
                    const error = new Error(message);
                    error.handled = true;
                    throw error;
                }
                if (!this.ensureEditable()) {
                    const error = new Error(this.readOnlyMessage || '현재 상태에서는 프로세스를 등록할 수 없습니다.');
                    error.handled = true;
                    throw error;
                }

                const results = (Array.isArray(payload.results) ? payload.results : []).filter((item) => item?.xml);
                if (results.length === 0) {
                    throw new Error('등록할 BPMN XML이 없습니다.');
                }

                const usedIds = new Set();
                (this.definitionList || []).forEach((def) => {
                    const id = toSafeText(def?.id || def?.file_name).trim();
                    if (id) usedIds.add(id);
                });
                for (const mega of this.procMap?.mega_proc_list || []) {
                    for (const major of mega.major_proc_list || []) {
                        for (const sub of major.sub_proc_list || []) {
                            const id = toSafeText(sub?.id || sub?.proc_def_id).trim();
                            if (id) usedIds.add(id);
                        }
                    }
                }

                const created = [];
                for (let index = 0; index < results.length; index++) {
                    const item = results[index];
                    const name = this.normalizeGeneratedProcessName(item.process_name || item.name, index);
                    const defId = this.createGeneratedProcessId(name, index, usedIds);
                    const definition = {
                        type: 'call-activity-sub',
                        source: 'ai-bpmn-generation',
                        sourceType: payload.sourceType || null,
                        scenario_source: payload.scenarioSource || null,
                        guideline_source: payload.guidelineSource || null
                    };
                    // AI 생성에 활용된 참조 링크(Confluence 등)를 관련자료 링크로 자동 등록
                    if (Array.isArray(payload.referenceLinks) && payload.referenceLinks.length > 0) {
                        definition.manualLinks = payload.referenceLinks;
                    }

                    await backend.putRawDefinition(item.xml, defId, {
                        name,
                        definition,
                        version: '0.1',
                        arcv_id: `${defId}_0.1`
                    });
                    created.push({ id: defId, name });
                }

                await this.loadInitialData();
                if (created[0]) {
                    await this.handleSelectProcess(created[0].id, created[0].name);
                }

                this.$toast?.success(`${created.length}개의 프로세스가 별도 등록되었습니다.`);
                resolve?.({ created });
            } catch (e) {
                console.error('Failed to register generated processes:', e);
                if (!e?.handled) {
                    this.$toast?.error(e?.message || '생성된 프로세스 등록에 실패했습니다.');
                }
                reject?.(e);
            }
        },

        /**
         * 캔버스 적용 경로(단건/복수 선택)에서 AI 생성 출처 링크를 현재 프로세스의
         * 관련자료 링크로 자동 등록한다.
         * 폼 병합에만 의존하면 속성 패널이 닫혀 있을 때(ref 부재) 조용히 유실되고,
         * BPMN 저장 경로가 processDefinition.definition 을 통째로 다시 쓰므로 폼에만
         * 있던 링크는 저장 시 사라진다(재발 원인). 생성 완료 시점에
         * proc_def.definition.manualLinks 에 직접 병합해 즉시 영속화하고 로컬
         * definition 도 갱신한다. url 기준 중복 제거.
         */
        async handleAddProcessReferenceLinks(links) {
            console.info('[ProcessHierarchy] AI 생성 참조 링크 수신:', links);
            if (!Array.isArray(links) || links.length === 0) return;
            if (!this.selectedProcessId || !this.processDefinition) {
                console.warn('[ProcessHierarchy] 참조 링크 등록 스킵 — 선택된 프로세스 없음', {
                    selectedProcessId: this.selectedProcessId,
                    hasDefinition: !!this.processDefinition
                });
                return;
            }
            const currentDef = this.processDefinition.definition || {};
            const rawExisting = Array.isArray(currentDef.manualLinks)
                ? currentDef.manualLinks
                : (currentDef.manualLink ? [currentDef.manualLink] : []);
            const normalizeLink = (item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    const url = item.trim();
                    return url ? { name: '', url } : null;
                }
                const url = toSafeText(item.url ?? '').trim();
                if (!url) return null;
                return { name: toSafeText(item.name ?? '').trim(), url };
            };
            const merged = rawExisting.map(normalizeLink).filter(Boolean);
            const seen = new Set(merged.map((l) => l.url));
            let added = false;
            links.forEach((link) => {
                const normalized = normalizeLink(link);
                if (!normalized || seen.has(normalized.url)) return;
                seen.add(normalized.url);
                merged.push(normalized);
                added = true;
            });

            // 영속화 성공 여부와 무관하게 로컬 definition 을 먼저 갱신한다.
            // BPMN 저장 경로(putRawDefinition)가 이 definition 을 그대로 들고 가므로,
            // 즉시 영속화가 실패해도 다음 '프로세스 저장' 때 링크가 함께 반영된다.
            const updatedDef = { ...currentDef, manualLinks: merged };
            this.processDefinition.definition = updatedDef;
            // 속성 패널이 열려 있으면 폼에도 즉시 반영(패널이 닫혀 있으면 마운트 시 definition 기준으로 채워짐)
            this.$refs.properties?.addProcessManualLinks?.(links);
            if (!added) return;

            try {
                await backend.updateProcessDefinitionMetadata(this.selectedProcessId, { definition: updatedDef }, '관련자료 링크 자동 등록');
                console.info('[ProcessHierarchy] AI 생성 참조 링크 영속화 완료:', this.selectedProcessId);
                this.$toast?.info('생성에 활용된 컨플루언스 링크를 관련자료 링크에 등록했습니다.');
            } catch (e) {
                console.warn('[ProcessHierarchy] AI 생성 참조 링크 즉시 영속화 실패(폼에는 반영됨, 프로세스 저장 시 함께 저장됩니다):', e);
                this.$toast?.warning('참조 링크 즉시 저장에 실패했습니다. 프로세스 저장 시 함께 저장됩니다.');
            }
        },

        async handleAddCallActivitySub({ name }) {
            if (!this.isOwner) {
                this.$toast?.warning('프로세스 생성은 소유자(Owner) 이상만 가능합니다.');
                return;
            }
            if (!this.ensureEditable()) return;
            try {
                const defId =
                    'ca-' +
                    name
                        .toLowerCase()
                        .replace(/[^a-z0-9가-힣]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '') +
                    '-' +
                    Date.now();

                const defaultBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="${name}" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="담당자">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ManualTask_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:manualTask id="ManualTask_1" name="Manual Task">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:manualTask>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ManualTask_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ManualTask_1" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="190" y="80" width="570" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="232" y="182" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManualTask_1_di" bpmnElement="ManualTask_1">
        <dc:Bounds x="340" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="512" y="182" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="268" y="200"/>
        <di:waypoint x="340" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="440" y="200"/>
        <di:waypoint x="512" y="200"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

                await backend.putRawDefinition(defaultBpmn, defId, {
                    name: name,
                    definition: { type: 'call-activity-sub' },
                    version: '0.1',
                    arcv_id: `${defId}_0.1`
                });

                await this.loadInitialData();
                await this.handleSelectProcess(defId, name);

                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.callActivityAdded') || '프로세스 모듈이 생성되었습니다.');
                }
            } catch (e) {
                console.error('Failed to create call activity subprocess:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.addFailed') || '프로세스 추가에 실패했습니다.');
                }
            }
        },

        openGovernancePanel() {
            this.showProperties = true;
            this.initialRightTab = PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE;
        },
        async handleGovernanceUpdated(payload = {}) {
            if (payload?.reviewId) {
                this.currentReviewId = toSafeText(payload.reviewId).trim();
            }

            if (this.processDefinition && payload?.state) {
                const state = toSafeText(payload.state).trim();
                this.processDefinition.approval_state = state;
                this.processDefinition.review_state = {
                    ...(this.processDefinition.review_state || {}),
                    id: toSafeText(payload.reviewId || this.currentReviewId || this.processDefinition.review_state?.id).trim() || null,
                    state
                };
            }

            const listIndex = this.definitionList.findIndex((d) => toSafeText(d?.id || d?.file_name).trim() === this.selectedProcessId);
            if (listIndex >= 0 && payload?.state) {
                const current = this.definitionList[listIndex];
                this.definitionList.splice(listIndex, 1, {
                    ...current,
                    approval_state: toSafeText(payload.state).trim()
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
                const currentDef = typeof def.definition === 'string' ? JSON.parse(def.definition || '{}') : def.definition || {};
                currentDef.wip = newWipFlag;

                // 초크포인트 경유: definition 에 병합돼 있는 To-Be 작업본을 분리 컬럼으로 유지 (+tenant 필터)
                await backend.updateProcessDefinitionMetadata(this.selectedProcessId, { definition: currentDef }, 'WIP 전환');

                // 로컬 definitionList 갱신
                def.definition = currentDef;
                if (newWipFlag) {
                    def.approval_state = 'wip';
                } else {
                    // Restore actual governance state
                    delete def.approval_state;
                }

                const listDef = this.definitionList.find((d) => (d.file_name || d.id) === this.selectedProcessId);
                if (listDef) {
                    if (newWipFlag) {
                        listDef.approval_state = 'wip';
                    } else {
                        delete listDef.approval_state;
                    }
                }

                if (this.$toast) {
                    const msg = newWipFlag
                        ? this.$t('processHierarchy.wipEnabled') || 'WIP 상태로 전환되었습니다.'
                        : this.$t('processHierarchy.wipDisabled') || 'WIP 상태가 해제되었습니다.';
                    this.$toast.success(msg);
                }
            } catch (e) {
                console.error('WIP toggle failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.wipFailed') || 'WIP 상태 변경에 실패했습니다.');
                }
            }
        },

        handleOpenPiFlagTab(payload) {
            this.showProperties = true;
            this.$nextTick(() => {
                this.$refs.properties?.openPiFlagTab?.(payload);
            });
        },

        handleFocusElement(elementIdOrIds) {
            if (!elementIdOrIds) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;
            try {
                const elementRegistry = modeler.get('elementRegistry');
                const canvas = modeler.get('canvas');
                const selection = modeler.get('selection');
                // 배열이면 묶음 다중 선택 (파란 테두리 동시 노출)
                const ids = Array.isArray(elementIdOrIds) ? elementIdOrIds : [elementIdOrIds];
                const elements = ids.map((id) => elementRegistry.get(id)).filter(Boolean);
                if (!elements.length) return;
                // Center viewport on the first element
                canvas.scrollToElement(elements[0]);
                // Select the element(s)
                selection.select(elements);
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
                this.$nextTick(() => {
                    this.$refs.tree?.expandToSelected();
                });
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
        startResizeHistory(e) {
            this.resizing = 'history';
            this.resizeStartY = e.clientY;
            this.resizeStartHeight = this.historyPanelHeight;
            e.preventDefault();
        },
        startResizeCopilot(e) {
            this.resizing = 'copilot';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.copilotPanelWidth;
            e.preventDefault();
        },
        startResizeTeamChat(e) {
            this.resizing = 'teamChat';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.teamChatPanelWidth;
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
            } else if (this.resizing === 'copilot') {
                const diff = this.resizeStartX - e.clientX;
                this.copilotPanelWidth = Math.max(320, Math.min(720, this.resizeStartWidth + diff));
            } else if (this.resizing === 'teamChat') {
                const diff = this.resizeStartX - e.clientX;
                this.teamChatPanelWidth = Math.max(320, Math.min(620, this.resizeStartWidth + diff));
            } else if (this.resizing === 'history') {
                const diff = this.resizeStartY - e.clientY;
                this.historyPanelHeight = Math.max(150, Math.min(600, this.resizeStartHeight + diff));
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
                await backend.putRawDefinition(xml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                    definition,
                    version: version,
                    version_tag: null,
                    arcv_id: newArcvId,
                    message: this.saveVersionMessage || null
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
        }
    }
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
    position: relative;
    flex-shrink: 0;
    border-left: 1px solid #e5e7eb;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    min-width: 320px;
}

.hierarchy-team-chat-panel {
    position: relative;
    flex-shrink: 0;
    border-left: 1px solid #e5e7eb;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    min-width: 320px;
}

.resize-handle-copilot {
    position: absolute;
    top: 0;
    left: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-copilot:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.resize-handle-team-chat {
    position: absolute;
    top: 0;
    left: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-team-chat:hover {
    background-color: rgba(25, 118, 210, 0.3);
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

.resize-handle-history {
    position: absolute;
    top: -3px;
    left: 0;
    width: 100%;
    height: 6px;
    cursor: row-resize;
    z-index: 10;
}
.resize-handle-history:hover {
    background-color: rgba(25, 118, 210, 0.3);
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

/* 프로세스 삭제 다이얼로그 */
.delete-warning-banner {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid #ef4444;
    border-radius: 6px;
    padding: 12px 14px;
}
.delete-warning-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.delete-warning-title {
    font-size: 13px;
    font-weight: 700;
    color: #b91c1c;
}
.delete-warning-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: #7f1d1d;
}
.delete-warning-list li {
    margin-bottom: 2px;
}
.delete-warning-list li:last-child {
    margin-bottom: 0;
}
.delete-warning-ack {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #fca5a5;
    font-size: 12px;
    font-weight: 600;
    color: #7f1d1d;
    cursor: pointer;
}
.delete-warning-ack input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: #dc2626;
    cursor: pointer;
}
.delete-target-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 6px;
    font-size: 13px;
}
.delete-target-label {
    font-weight: 600;
    color: #6b7280;
}
.delete-target-name {
    font-weight: 600;
    color: #111827;
    word-break: break-all;
}

.clone-target-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 6px;
    font-size: 13px;
}
.clone-target-label {
    font-weight: 600;
    color: #6b7280;
}
.clone-target-name {
    font-weight: 600;
    color: #111827;
    word-break: break-all;
}
</style>

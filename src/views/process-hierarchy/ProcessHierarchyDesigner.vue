<template>
    <div class="hierarchy-designer">
        <!-- Header Toolbar -->
        <div class="designer-toolbar">
            <div v-if="processNameText && normalizedBreadcrumbItems.length > 0" class="toolbar-breadcrumb-row">
                <div class="toolbar-breadcrumb" :title="breadcrumbTitle">
                    <template v-for="(item, index) in normalizedBreadcrumbItems" :key="`${item}-${index}`">
                        <span class="toolbar-breadcrumb__item" :title="item">{{ item }}</span>
                        <v-icon v-if="index < normalizedBreadcrumbItems.length - 1" size="12" class="mx-1 text-medium-emphasis">
                            mdi-chevron-right
                        </v-icon>
                    </template>
                </div>
            </div>
            <!-- Row 1: Title + Mode Toggle -->
            <div class="toolbar-main-row">
                <div class="toolbar-left">
                    <template v-if="processNameText">
                        <div class="toolbar-title-group">
                            <div class="toolbar-meta-row">
                                <span class="process-name font-weight-bold" :title="processNameText">{{ processNameText }}</span>
                                <v-tooltip
                                    v-if="displayDefinitionId"
                                    :text="definitionUuid ? '프로세스 UUID (proc_def.uuid) — 클릭하여 복사' : '프로세스 ID (proc_def_id) — 클릭하여 복사'"
                                    location="bottom"
                                >
                                    <template #activator="{ props: tt }">
                                        <code v-bind="tt" class="toolbar-defid" @click="copyDefinitionId">{{ displayDefinitionId }}</code>
                                    </template>
                                </v-tooltip>
                                <ProgressBadge v-if="currentStatus" type="status" :status="currentStatus" size="x-small" />
                                <v-menu v-if="currentVersion" offset-y :close-on-content-click="true">
                                    <template #activator="{ props: menuProps }">
                                        <v-chip
                                            v-bind="menuProps"
                                            size="x-small"
                                            :variant="previewingVersion ? 'flat' : 'tonal'"
                                            :color="previewingVersion ? 'orange' : 'grey'"
                                            style="cursor: pointer"
                                        >
                                            <v-icon v-if="previewingVersion" size="12" start>mdi-eye</v-icon>
                                            <template v-if="previewingVersion"
                                                >v{{ currentVersion }} | 미리보기 v{{ previewingVersion }}</template
                                            >
                                            <template v-else>v{{ currentVersion }}</template>
                                        </v-chip>
                                    </template>
                                    <v-list density="compact" max-height="240" class="py-0">
                                        <v-list-item density="compact" :active="!previewingVersion" @click="onSelectVersion('')">
                                            <v-list-item-title class="text-caption"> v{{ currentVersion }} (현재) </v-list-item-title>
                                        </v-list-item>
                                        <v-divider v-if="normalizedVersionList.length" />
                                        <v-list-item
                                            v-for="ver in normalizedVersionList"
                                            :key="ver.versionKey"
                                            density="compact"
                                            :active="previewingVersion === ver.versionText"
                                            @click="onSelectVersion(ver.versionText)"
                                        >
                                            <v-list-item-title class="text-caption">
                                                v{{ ver.versionText }}
                                                <span v-if="ver.versionTagText" class="text-disabled ml-1">({{ ver.versionTagText }})</span>
                                            </v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                                <v-chip v-if="lastSavedAt" size="x-small" variant="tonal" color="grey">최근 저장 {{ lastSavedAt }}</v-chip>
                                <v-chip v-if="toBeMode" color="purple" variant="flat" size="small"> To-Be Mode </v-chip>
                                <v-chip v-if="execMode" color="teal" variant="flat" size="small"> Exec Mode </v-chip>
                                <v-chip v-if="execMode && execData && execData.applied_at" size="x-small" variant="tonal" color="success">
                                    실행 정의 등록됨
                                </v-chip>
                                <v-chip
                                    v-if="toBeMode && currentToBeVersion"
                                    size="x-small"
                                    :variant="isToBePreviewing ? 'flat' : 'tonal'"
                                    :color="isToBePreviewing ? 'orange' : 'purple'"
                                >
                                    <v-icon v-if="isToBePreviewing" size="12" start>mdi-eye</v-icon>
                                    <template v-if="isToBePreviewing"
                                        >To-Be v{{ currentToBeVersion }} | 미리보기 v{{ previewingToBeVersion }}</template
                                    >
                                    <template v-else>To-Be v{{ currentToBeVersion }}</template>
                                </v-chip>
                                <v-btn v-if="toBeMode" variant="text" size="x-small" color="purple" class="ml-1" @click="openToBeHistory">
                                    <v-icon start size="14">mdi-history</v-icon>
                                    To-Be 이력
                                </v-btn>
                                <v-btn
                                    v-if="toBeMode && isToBePreviewing"
                                    variant="tonal"
                                    size="x-small"
                                    color="orange"
                                    class="ml-1"
                                    @click="exitToBePreview"
                                >
                                    <v-icon start size="14">mdi-close</v-icon>
                                    현재 버전으로
                                </v-btn>
                            </div>
                        </div>
                    </template>
                    <span v-else class="text-medium-emphasis">
                        {{ $t('processHierarchy.selectProcess') || '왼쪽 트리에서 프로세스를 선택하세요' }}
                    </span>
                </div>
                <div class="mode-pill-track" v-if="processNameText">
                    <div class="mode-pill-slider" :style="pillSliderStyle"></div>
                    <v-tooltip
                        v-for="m in modeOptions"
                        :key="m.value"
                        :text="m.disabledReason || ''"
                        :disabled="!m.disabledReason"
                        location="bottom"
                    >
                        <template #activator="{ props: tooltipProps }">
                            <button
                                v-bind="tooltipProps"
                                class="mode-pill-item"
                                :class="{
                                    'mode-pill-item--active': activeModePillValue === m.value,
                                    'mode-pill-item--disabled': m.disabled
                                }"
                                :disabled="m.disabled"
                                @click="!m.disabled && onModePillClick(m.value)"
                            >
                                <v-icon size="14" class="mode-pill-icon">{{ m.icon }}</v-icon>
                                <span>{{ m.label }}</span>
                            </button>
                        </template>
                    </v-tooltip>
                </div>
            </div>
            <!-- Row 2: Action Buttons -->
            <div class="toolbar-actions-row">
                <!-- As-Is / To-Be (허용 사용자는 + Exec) Mode Toggle -->
                <div
                    class="mode-pill-track mr-2"
                    :class="asisTobeOptions.length === 3 ? 'mode-pill-track--three' : 'mode-pill-track--two'"
                >
                    <div class="mode-pill-slider" :style="asisTobeSliderStyle"></div>
                    <button
                        v-for="m in asisTobeOptions"
                        :key="m.value"
                        class="mode-pill-item"
                        :class="{ 'mode-pill-item--active': activeMode === m.value, 'mode-pill-item--disabled': !processNameText }"
                        :disabled="!processNameText"
                        @click="activeMode = m.value"
                    >
                        <span>{{ m.label }}</span>
                    </button>
                </div>
                <v-divider vertical class="mx-1" />
                <v-tooltip
                    :text="showCopilotPanel ? 'AI Copilot 패널을 닫습니다' : 'AI Copilot 패널을 열어 프로세스 설계를 도와줍니다'"
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            :variant="showCopilotPanel ? 'flat' : 'tonal'"
                            :color="showCopilotPanel ? 'primary' : 'grey'"
                            size="small"
                            :disabled="!processNameText"
                            @click="$emit('toggleCopilot')"
                        >
                            <v-icon start size="16">mdi-robot-outline</v-icon>
                            Copilot
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-if="isOwner"
                    :text="showPiFlag ? 'PI Flag 코멘트와 그룹 박스 표시를 끕니다' : 'PI Flag 코멘트와 그룹 박스를 다이어그램에 표시합니다'"
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            :variant="showPiFlag ? 'flat' : 'tonal'"
                            :color="showPiFlag ? 'error' : 'grey'"
                            size="small"
                            :disabled="!processNameText"
                            @click="$emit('togglePiFlag')"
                        >
                            <v-icon start size="16">mdi-flag</v-icon>
                            PI Flag
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip
                    :text="
                        showRelatedProjectGroup
                            ? '과제 그룹 박스 표시를 끕니다'
                            : '같은 그룹으로 매핑된 과제를 가진 Task들을 박스로 묶어 표시합니다'
                    "
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            :variant="showRelatedProjectGroup ? 'flat' : 'tonal'"
                            :color="showRelatedProjectGroup ? 'purple' : 'grey'"
                            size="small"
                            :disabled="!processNameText"
                            @click="$emit('toggleRelatedProjectGroup')"
                        >
                            <v-icon start size="16">mdi-clipboard-list-outline</v-icon>
                            과제 그룹
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-if="hasPartitionOverlay"
                    :text="showPartitionGroups ? '논리 블록(그룹) 박스 표시를 끕니다' : '논리 블록(그룹) 박스를 다이어그램에 표시합니다'"
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            :variant="showPartitionGroups ? 'flat' : 'tonal'"
                            :color="showPartitionGroups ? 'teal' : 'grey'"
                            size="small"
                            :disabled="!processNameText"
                            @click="$emit('togglePartitionGroups')"
                        >
                            <v-icon start size="16">mdi-group</v-icon>
                            그룹 보기
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-divider vertical class="mx-1" />
                <v-tooltip text="BPMN 모델의 유효성을 검사합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn v-bind="tt" variant="text" size="small" :disabled="!processNameText" @click="handleValidate">
                            <v-icon start size="16">mdi-check-circle-outline</v-icon>
                            검증
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip text="현재 BPMN XML을 보거나 수정합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn v-bind="tt" variant="text" size="small" :disabled="!processNameText" @click="openXmlDialog">
                            <v-icon start size="16">mdi-code-tags</v-icon>
                            XML
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-divider vertical class="mx-1" />
                <v-tooltip text="현재 다이어그램을 이미지(PNG)로 저장합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn v-bind="tt" variant="text" size="small" :disabled="!processNameText" @click="capturePng">
                            <v-icon start size="16">mdi-image-outline</v-icon>
                            이미지
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip text="외부 BPMN/XML 파일을 직접 불러와 캔버스에 적용합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="text"
                            size="small"
                            :disabled="!processNameText || isViewMode"
                            @click="triggerBpmnUpload"
                        >
                            <v-icon start size="16">mdi-upload</v-icon>
                            가져오기
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip text="텍스트·파일·Confluence 문서를 기반으로 AI가 BPMN을 자동 생성합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="text"
                            size="small"
                            color="primary"
                            :disabled="!processNameText || isViewMode"
                            @click="openGenDialog"
                        >
                            <v-icon start size="16">mdi-auto-fix</v-icon>
                            AI 생성
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-divider vertical class="mx-1" />
                <v-tooltip text="현재 프로세스를 삭제합니다 (관리자 전용)" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="text"
                            size="small"
                            color="error"
                            :disabled="!processNameText || isViewMode || !isAdmin"
                            @click="$emit('delete')"
                        >
                            <v-icon start size="16">mdi-delete-outline</v-icon>
                            삭제
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip
                    :text="
                        canClone
                            ? '현재 프로세스를 복제하여 새 프로세스를 만듭니다'
                            : 'owner 이상 권한 + 본인이 담당자인 경우에만 복제할 수 있습니다'
                    "
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="text"
                            size="small"
                            :disabled="!processNameText || isViewMode || !canClone"
                            @click="$emit('clone')"
                        >
                            <v-icon start size="16">mdi-content-copy</v-icon>
                            복제
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip text="변경사항을 저장합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="flat"
                            color="primary"
                            size="small"
                            :disabled="!processNameText || isViewMode"
                            @click="$emit('save')"
                        >
                            <v-icon start size="16">mdi-content-save</v-icon>
                            저장
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-if="isExecUser"
                    text="이 프로세스의 인스턴스를 시작합니다 (실행 정의가 등록된 프로세스만 실행됩니다)"
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            variant="flat"
                            color="success"
                            size="small"
                            :disabled="!processNameText"
                            :loading="runStarting"
                            @click="$emit('run')"
                        >
                            <v-icon start size="16">mdi-play</v-icon>
                            실행
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip v-if="isExecUser" text="이 프로세스의 인스턴스 ID / 태스크 ID를 확인합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn v-bind="tt" variant="text" size="small" :disabled="!processNameText" @click="$emit('execInfo')">
                            <v-icon start size="16">mdi-identifier</v-icon>
                            실행 ID
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>

        <!-- Recovery Banner (floating over canvas) -->
        <v-alert
            v-if="recoveryBackup"
            type="warning"
            variant="tonal"
            density="compact"
            closable
            class="recovery-backup-alert"
            @click:close="$emit('dismissBackup')"
        >
            <div class="recovery-backup-alert__inner">
                <span class="text-body-2 recovery-backup-alert__text">
                    저장되지 않은 로컬 백업이 발견되었습니다.
                    <span class="text-caption text-medium-emphasis recovery-backup-alert__timestamp">
                        ({{ formatKST(recoveryBackup.timestamp) }})
                    </span>
                </span>
                <v-btn size="x-small" variant="flat" color="warning" class="recovery-backup-alert__action" @click="$emit('recoverBackup')">
                    복구
                </v-btn>
            </div>
        </v-alert>

        <!-- Exec(실행형) Viewer — 캔버스 대신 실행 정의 뷰를 표시 (BPMN 캔버스는 As-Is 상태로 유지) -->
        <div v-if="execMode && activeBpmn" class="designer-exec-pane">
            <ExecutableProcessView
                :executable="execData"
                :source-xml="execSourceXml"
                :generating="execGenerating"
                :applying="execApplying"
                :readonly="isViewMode"
                :is-admin="isExecUser"
                :use-external-panel="execUseExternalPanel"
                @generate="onGenerateExecutable"
                @apply="onApplyExecutable"
                @updateDefinition="onUpdateExecutableDefinition"
                @openElementPanel="(id) => $emit('openPanel', id)"
            />
        </div>

        <!-- BPMN Canvas -->
        <div
            class="designer-canvas"
            v-show="activeBpmn && !execMode"
            :style="canvasMinHeight ? { minHeight: canvasMinHeight + 'px' } : {}"
        >
            <div v-if="isViewMode" class="lock-banner-floating">
                <v-icon size="14" class="mr-2">mdi-lock</v-icon>
                <span class="lock-banner-floating__text">
                    {{ readOnlyMessage || $t('processHierarchy.readOnlyMode') || '읽기 전용으로 표시됩니다.' }}
                </span>
            </div>
            <div class="designer-canvas__modeler">
                <BpmnuEngine
                    ref="bpmnVue"
                    :key="bpmnKey + '-' + (isViewMode || isToBePreviewing ? 'view' : 'edit')"
                    :bpmn="activeBpmn"
                    :isViewMode="isViewMode || isToBePreviewing"
                    :enable-linked-navigation="true"
                    :root-process-name="processNameText"
                    :showPiFlag="showPiFlag"
                    :showRelatedProjectGroup="showRelatedProjectGroup"
                    @openPanel="(id) => $emit('openPanel', id)"
                    @addComment="(payload) => $emit('addComment', payload)"
                    @openTaskMapping="(payload) => $emit('openTaskMapping', payload)"
                    @openPiFlagTab="(payload) => $emit('openPiFlagTab', payload)"
                    @openDefinition="(bo) => $emit('openDefinition', bo)"
                    @update-xml="(val) => $emit('updateXml', val)"
                    @definition="(def) => $emit('definition', def)"
                    @done="onBpmnDone"
                />
            </div>

            <!-- [2.3.3] Coordinate Anchor Overlay -->
            <div v-if="activeBpmn && viewboxInfo" class="coord-anchor">
                x: {{ viewboxInfo.x }} y: {{ viewboxInfo.y }} | {{ viewboxInfo.zoom }}%
            </div>

            <!-- As-Is 파티셔닝: 페인트 방식 그룹 편집 → Call Activity 변환 -->
            <div v-if="!toBeMode && !isViewMode && hasPartitionOverlay" class="partition-edit-fab">
                <template v-if="!partitionEditMode">
                    <v-btn color="indigo" variant="flat" size="small" rounded="lg" @click="enterPartitionEditMode">
                        <v-icon start size="16">mdi-vector-polygon</v-icon>
                        그룹 직접 편집
                    </v-btn>
                </template>
                <template v-else>
                    <div class="partition-palette">
                        <button
                            v-for="(b, i) in paletteBlocks"
                            :key="b.id"
                            type="button"
                            class="partition-chip"
                            :class="{ 'partition-chip--active': activePaintBlockId === b.id }"
                            :style="{ '--chip-color': b.color }"
                            :title="`${i + 1}. ${b.name} — 클릭해 페인트 활성/해제 (숫자키 ${i + 1})`"
                            @click="togglePaintBlock(b.id)"
                        >
                            <span class="partition-chip__dot"></span>
                            <span class="partition-chip__name">{{ b.name }}</span>
                            <span class="partition-chip__count">{{ b.count }}</span>
                            <span
                                class="partition-chip__remove"
                                title="블록 삭제 (멤버는 미배정으로)"
                                @click.stop="removePaintBlock(b.id)"
                                >×</span
                            >
                        </button>
                        <button type="button" class="partition-chip partition-chip--add" title="새 블록 추가" @click="addPartitionBlock">
                            ＋ 블록
                        </button>
                        <span
                            class="partition-chip partition-chip--unassigned"
                            :class="{ 'partition-chip--warn': unassignedCount > 0 }"
                            title="어느 블록에도 배정되지 않은 노드 수 — 변환 시 원본 흐름에 남습니다"
                        >
                            미배정 {{ unassignedCount }}
                        </span>
                    </div>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        rounded="lg"
                        :loading="committingPartition"
                        @click="requestCommitPreview"
                    >
                        <v-icon start size="16">mdi-puzzle-outline</v-icon>
                        변환 미리보기
                    </v-btn>
                    <v-btn color="grey-darken-1" variant="tonal" size="small" rounded="lg" @click="cancelPartitionEdit"> 취소 </v-btn>
                </template>
            </div>

            <!-- 파티션 편집: 노드 우클릭 블록 이동 메뉴 -->
            <template v-if="partitionCtxMenu.show">
                <div class="partition-ctx-backdrop" @mousedown.prevent="closePartitionCtxMenu" @contextmenu.prevent="closePartitionCtxMenu"></div>
                <div class="partition-ctx-menu" :style="{ left: partitionCtxMenu.x + 'px', top: partitionCtxMenu.y + 'px' }">
                    <div class="partition-ctx-menu__title">{{ partitionCtxMenu.elementName }}</div>
                    <button
                        v-for="b in paletteBlocks"
                        :key="b.id"
                        type="button"
                        class="partition-ctx-menu__item"
                        :class="{ 'partition-ctx-menu__item--current': partitionCtxMenu.currentBlockId === b.id }"
                        @click="assignFromCtxMenu(b.id)"
                    >
                        <span class="partition-chip__dot" :style="{ '--chip-color': b.color }"></span>
                        {{ b.name }}
                    </button>
                    <button
                        type="button"
                        class="partition-ctx-menu__item partition-ctx-menu__item--clear"
                        :disabled="!partitionCtxMenu.currentBlockId"
                        @click="assignFromCtxMenu(null)"
                    >
                        미배정으로 해제
                    </button>
                </div>
            </template>

            <div v-if="toBeMode" class="tobe-studio-fab" :class="{ 'tobe-studio-fab--view': isViewMode }">
                <v-btn
                    v-if="hasEditAccess && !isViewMode"
                    color="grey-darken-1"
                    variant="flat"
                    size="small"
                    rounded="lg"
                    @click="loadAsIsIntoToBe"
                >
                    <v-icon start size="16">mdi-content-copy</v-icon>
                    As-Is 불러오기
                </v-btn>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="!activeBpmn && !loading" class="designer-empty">
            <v-icon size="64" color="grey-lighten-1">mdi-file-document-outline</v-icon>
            <div class="text-h6 text-medium-emphasis mt-4">
                {{ $t('processHierarchy.emptyState') || '프로세스를 선택하세요' }}
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
                {{ $t('processHierarchy.emptyStateDesc') || '왼쪽 트리에서 서브 프로세스를 클릭하면 BPMN 에디터가 표시됩니다.' }}
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="designer-empty">
            <v-progress-circular indeterminate color="primary" size="48" />
            <div class="text-body-2 text-medium-emphasis mt-4">Loading...</div>
        </div>

        <input ref="xmlFileInput" type="file" accept=".bpmn,.xml" style="display: none" @change="handleBpmnFileChange" />

        <v-dialog v-model="xmlDialog" max-width="1100">
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-code-tags</v-icon>
                    {{ $t('processDefinition.showXML') || 'xml' }}
                    <v-spacer />
                    <v-btn variant="text" size="small" @click="copyXmlToClipboard">
                        <v-icon start size="16">mdi-content-copy</v-icon>
                        {{ $t('common.copy') || 'Copy' }}
                    </v-btn>
                    <v-btn icon variant="text" size="small" @click="xmlDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pt-2">
                    <div v-if="!isViewMode" class="text-body-2 text-medium-emphasis mb-3">
                        {{ $t('processHierarchy.xmlEditHint') || 'XML을 수정한 뒤 적용하면 현재 BPMN 캔버스에 반영됩니다.' }}
                    </div>
                    <div class="xml-preview-shell">
                        <textarea
                            v-model="xmlPreview"
                            class="xml-preview-textarea"
                            :class="{ 'xml-preview-textarea--readonly': isViewMode }"
                            :readonly="isViewMode"
                            spellcheck="false"
                        ></textarea>
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-btn v-if="!isViewMode" variant="text" :disabled="!hasXmlChanges" @click="resetXmlPreview">
                        {{ $t('common.reset') || 'Reset' }}
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="text" @click="xmlDialog = false">
                        {{ $t('common.close') || 'Close' }}
                    </v-btn>
                    <v-btn v-if="!isViewMode" color="primary" variant="flat" :disabled="!hasXmlChanges" @click="applyXmlPreview">
                        {{ $t('apply') || '적용' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Validation Results Dialog -->
        <v-dialog v-model="validationDialog" max-width="500">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
                    {{ $t('validation.title') || 'BPMN 검증 결과' }}
                </v-card-title>
                <v-card-text>
                    <div class="text-body-2 mb-3">{{ $t('validation.warningMessage') || '다음 문제가 발견되었습니다:' }}</div>
                    <v-list density="compact" class="validation-result-list">
                        <v-list-item
                            v-for="(result, i) in validationResults"
                            :key="i"
                            @click="focusElement(result.elementId)"
                            :class="{ 'cursor-pointer': result.elementId }"
                        >
                            <template v-slot:prepend>
                                <v-icon :color="result.level === 'error' ? 'error' : 'warning'" size="18">
                                    {{ result.level === 'error' ? 'mdi-alert-circle' : 'mdi-alert' }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="text-body-2">{{ result.message }}</v-list-item-title>
                            <v-list-item-subtitle v-if="result.elementName" class="text-caption">
                                {{ result.elementName }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="clearValidation">
                        {{ $t('validation.clearOverlays') || 'Clear Overlays' }}
                    </v-btn>
                    <v-btn @click="validationDialog = false">{{ $t('common.close') || 'Close' }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- To-Be 버전 이력 다이얼로그 -->
        <v-dialog v-model="toBeHistoryDialog" max-width="640">
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="purple">mdi-history</v-icon>
                    To-Be 버전 이력
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="toBeHistoryDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pt-2">
                    <div v-if="!toBeVersions.length" class="text-body-2 text-medium-emphasis py-6 text-center">
                        저장된 To-Be 버전이 없습니다. To-Be 모드에서 저장하면 버전이 기록됩니다.
                    </div>
                    <v-list v-else density="compact" class="py-0" max-height="420">
                        <v-list-item
                            v-for="ver in toBeVersions"
                            :key="ver.version + '-' + ver.created_at"
                            class="tobe-version-item"
                            :active="previewingToBeVersion === ver.version"
                        >
                            <template #prepend>
                                <v-chip
                                    size="x-small"
                                    :variant="ver.version === currentToBeVersion ? 'flat' : 'tonal'"
                                    :color="ver.version === currentToBeVersion ? 'purple' : 'grey'"
                                    class="mr-2"
                                >
                                    v{{ ver.version }}
                                    <span v-if="ver.version === currentToBeVersion" class="ml-1">(현재)</span>
                                </v-chip>
                            </template>
                            <v-list-item-title class="text-body-2">
                                {{ ver.message || '메시지 없음' }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                                {{ formatKST(ver.created_at) }}
                                <span v-if="ver.created_by" class="ml-1">· {{ ver.created_by }}</span>
                            </v-list-item-subtitle>
                            <template #append>
                                <v-btn variant="text" size="x-small" color="grey" @click="previewToBeVersion(ver)">
                                    <v-icon start size="14">mdi-eye-outline</v-icon>
                                    미리보기
                                </v-btn>
                                <v-tooltip
                                    :text="isViewMode ? '편집 모드에서 되돌릴 수 있습니다' : ''"
                                    :disabled="!isViewMode"
                                    location="bottom"
                                >
                                    <template #activator="{ props: tt }">
                                        <span v-bind="tt">
                                            <v-btn
                                                variant="text"
                                                size="x-small"
                                                color="purple"
                                                :disabled="isViewMode || ver.version === currentToBeVersion"
                                                @click="restoreToBeVersion(ver)"
                                            >
                                                <v-icon start size="14">mdi-restore</v-icon>
                                                되돌리기
                                            </v-btn>
                                        </span>
                                    </template>
                                </v-tooltip>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- AI BPMN 생성 다이얼로그 (텍스트 / 파일 / Confluence) -->
        <v-dialog v-model="genDialog" max-width="640" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-auto-fix</v-icon>
                    AI로 BPMN 생성
                    <v-spacer />
                    <v-btn icon variant="text" size="small" :disabled="genLoading || genRegistering" @click="closeGenDialog">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pt-2 pb-0">
                    <!-- 입력 영역: 결과가 없을 때 표시 -->
                    <template v-if="!genResult && !genPipelineResponse">
                        <div class="text-caption text-medium-emphasis mb-3">
                            파일과 Confluence 링크, 직접 입력 텍스트를 자유롭게 조합해 추가하세요. 추가한 모든 자료를 하나의 맥락으로 통합해
                            BPMN을 생성합니다.
                        </div>

                        <!-- 파일 (복수) -->
                        <div class="gen-input-block">
                            <div class="d-flex align-center mb-2">
                                <span class="gen-input-label">파일</span>
                                <v-chip v-if="genFiles.length" size="x-small" variant="tonal" color="primary" class="ml-2">
                                    {{ genFiles.length }}
                                </v-chip>
                                <v-spacer />
                                <input
                                    ref="genFileInput"
                                    type="file"
                                    multiple
                                    :accept="acceptAttr"
                                    style="display: none"
                                    @change="onGenFileInputChange"
                                />
                                <v-btn variant="tonal" color="primary" size="small" :disabled="genLoading" @click="triggerGenFilePick">
                                    <v-icon start size="16">mdi-paperclip</v-icon>
                                    파일 추가
                                </v-btn>
                            </div>
                            <div v-if="genFiles.length" class="gen-chip-list">
                                <v-chip
                                    v-for="(file, idx) in genFiles"
                                    :key="`${file.name}-${file.size}-${file.lastModified}`"
                                    size="small"
                                    variant="tonal"
                                    closable
                                    :disabled="genLoading"
                                    class="gen-chip"
                                    @click:close="removeGenFile(idx)"
                                >
                                    <v-icon start size="14">mdi-file-document-outline</v-icon>
                                    {{ file.name }}
                                    <span class="text-caption text-medium-emphasis ml-1">({{ formatFileSize(file.size) }})</span>
                                </v-chip>
                            </div>
                            <div class="text-caption text-medium-emphasis mt-1">
                                지원 형식: PDF · Word(docx) · Excel · PowerPoint · HWP · txt/md/csv 등 · 파일당 최대 30MB
                            </div>
                        </div>

                        <!-- Confluence 링크 (복수) -->
                        <div class="gen-input-block mt-4">
                            <div class="d-flex align-center mb-2">
                                <span class="gen-input-label">Confluence 링크</span>
                                <v-chip v-if="genConfluenceUrls.length" size="x-small" variant="tonal" color="primary" class="ml-2">
                                    {{ genConfluenceUrls.length }}
                                </v-chip>
                            </div>
                            <div class="d-flex align-center gen-url-row">
                                <v-text-field
                                    v-model="genConfluenceUrlInput"
                                    label="Confluence 페이지 URL"
                                    placeholder="https://confluence.tde.sktelecom.com/pages/viewpage.action?pageId=..."
                                    variant="outlined"
                                    density="compact"
                                    :disabled="genLoading"
                                    hide-details="auto"
                                    @keydown.enter.prevent="addGenConfluenceUrl"
                                />
                                <v-btn
                                    variant="tonal"
                                    color="primary"
                                    size="small"
                                    class="ml-2"
                                    :disabled="genLoading || !genConfluenceUrlInput.trim()"
                                    @click="addGenConfluenceUrl"
                                >
                                    <v-icon start size="16">mdi-plus</v-icon>
                                    추가
                                </v-btn>
                            </div>
                            <div v-if="genConfluenceUrls.length" class="gen-chip-list mt-2">
                                <v-chip
                                    v-for="(url, idx) in genConfluenceUrls"
                                    :key="`${url}-${idx}`"
                                    size="small"
                                    variant="tonal"
                                    closable
                                    :disabled="genLoading"
                                    class="gen-chip gen-chip--url"
                                    @click:close="removeGenConfluenceUrl(idx)"
                                >
                                    <v-icon start size="14">mdi-link-variant</v-icon>
                                    {{ url }}
                                </v-chip>
                            </div>
                        </div>

                        <!-- 직접 입력 텍스트 -->
                        <v-textarea
                            v-model="genInputText"
                            label="직접 입력 텍스트 (선택)"
                            placeholder="예: 고객이 주문을 등록하면 담당자가 검토 후 승인하고, 반려 시 고객에게 보완을 요청한다."
                            variant="outlined"
                            density="compact"
                            rows="4"
                            auto-grow
                            :disabled="genLoading"
                            hide-details="auto"
                            class="mt-4"
                            @keydown.ctrl.enter="runBpmnGeneration"
                        />

                        <!-- 공통: 추가 가이드라인 -->
                        <v-textarea
                            v-model="genGuidelineText"
                            label="가이드라인 (선택)"
                            placeholder="예: Lane을 포함하고, 승인 프로세스는 게이트웨이로 분기해주세요."
                            variant="outlined"
                            density="compact"
                            rows="2"
                            auto-grow
                            :disabled="genLoading"
                            hide-details="auto"
                            class="mt-3"
                        />
                    </template>

                    <!-- 로딩 -->
                    <v-expand-transition>
                        <div v-if="genLoading" class="mt-4 pa-3" style="background: rgba(var(--v-theme-primary), 0.04); border-radius: 8px">
                            <div class="d-flex align-center">
                                <v-progress-circular indeterminate color="primary" size="24" width="2" class="mr-3" />
                                <span class="text-body-2 text-medium-emphasis">{{ genLoadingText }}</span>
                            </div>
                            <!-- 실시간 토큰 미리보기 (스트리밍) -->
                            <pre v-if="genProgress" class="gen-stream-preview mt-3">{{ genProgressTail }}</pre>
                        </div>
                    </v-expand-transition>

                    <!-- 결과 미리보기 -->
                    <div v-if="genResult" class="gen-result mt-2">
                        <div class="d-flex align-center mb-3">
                            <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                            <span class="text-body-2 font-weight-medium">BPMN 생성 완료</span>
                            <v-chip v-if="genSourceLabel" size="x-small" variant="tonal" color="grey" class="ml-2">
                                {{ genSourceLabel }}
                            </v-chip>
                        </div>

                        <!-- 통합 본문 길이 초과 경고 -->
                        <v-alert v-if="genContextTruncated" type="warning" variant="tonal" density="compact" class="mb-3 text-caption">
                            {{ genContextTruncatedMessage }}
                        </v-alert>

                        <!-- AI 답변 (OpenUI 지원) -->
                        <div v-if="genResultSegments.length > 0" class="gen-result__answer">
                            <template v-for="(segment, idx) in genResultSegments" :key="`${segment.type}-${idx}`">
                                <OpenUiRenderer
                                    v-if="segment.type === 'openui'"
                                    :response="segment.content"
                                    @action="handleGenOpenUiAction"
                                />
                                <div v-else-if="segment.content" class="gen-result__text" v-html="_formatAnswerText(segment.content)"></div>
                            </template>
                        </div>

                        <!-- XML 미리보기 토글 -->
                        <v-expansion-panels variant="accordion" class="mt-3">
                            <v-expansion-panel>
                                <v-expansion-panel-title class="text-caption py-0" style="min-height: 36px">
                                    BPMN XML 미리보기
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <pre class="gen-result__xml">{{ genResult.xml }}</pre>
                                </v-expansion-panel-text>
                            </v-expansion-panel>
                        </v-expansion-panels>
                    </div>

                    <!-- 파이프라인 복수 결과: 프로세스 선택 -->
                    <div v-if="genPipelineResponse" class="gen-result mt-2">
                        <div class="d-flex align-center mb-2">
                            <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                            <span class="text-body-2 font-weight-medium">
                                {{ genPipelineResponse.results.length }}개의 프로세스가 발견되었습니다
                            </span>
                            <v-chip v-if="genPipelineSourceLabel" size="x-small" variant="tonal" color="grey" class="ml-2">
                                {{ genPipelineSourceLabel }}
                            </v-chip>
                        </div>
                        <div class="d-flex align-center justify-space-between mb-2">
                            <div class="text-caption text-medium-emphasis">
                                캔버스에 적용할 프로세스를 선택하거나, 별도 프로세스로 등록하세요.
                            </div>
                            <v-chip v-if="pipelineRegisterableCount > 1" size="x-small" variant="tonal" color="primary">
                                등록 가능 {{ pipelineRegisterableCount }}개
                            </v-chip>
                        </div>

                        <v-radio-group v-model="genSelectedProcessIndex" density="compact" hide-details>
                            <v-radio v-for="(item, idx) in genPipelineResponse.results" :key="idx" :value="idx" :disabled="!!item.error">
                                <template #label>
                                    <span>{{ item.process_name }}</span>
                                    <v-chip v-if="item.error" size="x-small" color="error" variant="tonal" class="ml-2"> 생성 실패 </v-chip>
                                </template>
                            </v-radio>
                        </v-radio-group>

                        <!-- 변환 품질 안내 -->
                        <v-alert
                            v-if="
                                genPipelineResponse.quality_flags?.includes('has_image') ||
                                genPipelineResponse.quality_flags?.includes('has_diagram')
                            "
                            type="info"
                            variant="tonal"
                            density="compact"
                            class="mt-2 text-caption"
                        >
                            일부 이미지/다이어그램이 해석되지 않았을 수 있습니다. 생성 결과를 확인해 주세요.
                        </v-alert>
                        <!-- 통합 본문 길이 초과 경고 -->
                        <v-alert v-if="genContextTruncated" type="warning" variant="tonal" density="compact" class="mt-2 text-caption">
                            {{ genContextTruncatedMessage }}
                        </v-alert>

                        <!-- 선택한 프로세스 XML 미리보기 토글 -->
                        <v-expansion-panels
                            v-if="genPipelineResponse.results[genSelectedProcessIndex]?.xml"
                            variant="accordion"
                            class="mt-3"
                        >
                            <v-expansion-panel>
                                <v-expansion-panel-title class="text-caption py-0" style="min-height: 36px">
                                    BPMN XML 미리보기 — {{ genPipelineResponse.results[genSelectedProcessIndex].process_name }}
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <pre class="gen-result__xml">{{ genPipelineResponse.results[genSelectedProcessIndex].xml }}</pre>
                                </v-expansion-panel-text>
                            </v-expansion-panel>
                        </v-expansion-panels>
                    </div>

                    <!-- 에러 -->
                    <v-alert
                        v-if="genError"
                        type="error"
                        variant="tonal"
                        density="compact"
                        class="mt-3"
                        closable
                        @click:close="genError = ''"
                    >
                        {{ genError }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer />
                    <!-- 결과가 있을 때: 다시 생성 / 캔버스에 적용 -->
                    <template v-if="genResult">
                        <v-btn variant="text" @click="resetGenResult">다시 생성</v-btn>
                        <v-btn variant="flat" color="primary" @click="applyGenResult">
                            <v-icon start size="16">mdi-check</v-icon>
                            캔버스에 적용
                        </v-btn>
                    </template>
                    <!-- 파이프라인 복수 결과: 다시 생성 / 선택 적용 -->
                    <template v-else-if="genPipelineResponse">
                        <v-btn variant="text" :disabled="genRegistering" @click="resetGenResult">다시 생성</v-btn>
                        <v-btn
                            variant="tonal"
                            color="secondary"
                            :loading="genRegistering"
                            :disabled="!canRegisterPipelineResults || genRegistering"
                            @click="registerPipelineResults"
                        >
                            <v-icon start size="16">mdi-folder-plus-outline</v-icon>
                            {{ pipelineRegisterButtonText }}
                        </v-btn>
                        <v-btn
                            variant="flat"
                            color="primary"
                            :disabled="!canApplySelectedPipelineResult"
                            @click="applySelectedPipelineResult"
                        >
                            <v-icon start size="16">mdi-check</v-icon>
                            선택한 프로세스 적용
                        </v-btn>
                    </template>
                    <!-- 로딩 중: 중지 -->
                    <template v-else-if="genLoading">
                        <v-btn variant="text" @click="closeGenDialog">취소</v-btn>
                        <v-btn variant="tonal" color="error" @click="cancelGenGeneration">중지</v-btn>
                    </template>
                    <!-- 기본: 취소 / 생성 -->
                    <template v-else>
                        <v-btn variant="text" @click="genDialog = false">취소</v-btn>
                        <v-btn variant="flat" color="primary" :disabled="!canGenerate" @click="runBpmnGeneration">BPMN 생성</v-btn>
                    </template>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BpmnuEngine from '@/components/BpmnUengine.vue';
import BackendFactory from '@/components/api/BackendFactory';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import { toSafeText } from '@/utils/safeText';
import { formatKST as formatKSTUtil } from '@/utils/datetime';
import { validateBpmnModel, reportToConsoleItems } from '@/services/bpmnValidationService';
import { collectProcessRequiredViolations } from '@/utils/processSchemaValidation';
import { useBpmnExport } from '@/composables/useBpmnExport';
import OpenUiRenderer from '@/components/openui/OpenUiRenderer.vue';
import ExecutableProcessView from '@/views/process-hierarchy/blueprint/ExecutableProcessView.vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';
import { canUseExecFeatures } from '@/utils/execFeatureGate';
import { processUuidForRoute } from '@/utils/processRouteId';
import {
    generateBpmnMulti,
    BpmnNoProcessDataError,
    SUPPORTED_FILE_EXTENSIONS,
    MAX_FILE_BYTES,
    isSupportedFileExtension
} from '@/services/bpmnGenerationService';
import { PARTITION_BLOCK_COLORS, partitionColor, ensurePartitionColors, computeCommitPreview } from '@/composables/blueprint/partitionEditing';

const backend = BackendFactory.createBackend();
const EMPTY_TOBE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:uengine="http://uengine"
    id="Definitions_ToBeBlank"
    targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="Process_ToBeBlank" isExecutable="false">
        <bpmn:extensionElements>
            <uengine:properties></uengine:properties>
        </bpmn:extensionElements>
    </bpmn:process>
    <bpmndi:BPMNDiagram id="BPMNDiagram_ToBeBlank">
        <bpmndi:BPMNPlane id="BPMNPlane_ToBeBlank" bpmnElement="Process_ToBeBlank" />
    </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default {
    name: 'ProcessHierarchyDesigner',
    components: { BpmnuEngine, ProgressBadge, OpenUiRenderer, ExecutableProcessView },
    // 순서도 페이지(ProcessHierarchy)가 provide 하는 공유 AN Studio — Exec(실행형) 뷰의 상태 소스
    inject: { anStudio: { from: AN_STUDIO_KEY, default: null } },
    props: {
        bpmn: { type: String, default: '' },
        processName: { type: String, default: '' },
        processDefinition: { type: Object, default: null },
        definitionPath: { type: String, default: '' },
        definitionList: { type: Array, default: () => [] },
        loading: { type: Boolean, default: false },
        recoveryBackup: { type: Object, default: null },
        isViewMode: { type: Boolean, default: false },
        editorMode: { type: String, default: 'edit' },
        breadcrumbItems: { type: Array, default: () => [] },
        lockInfo: { type: Object, default: null },
        readOnlyMessage: { type: String, default: '' },
        showCopilotPanel: { type: Boolean, default: false },
        showTeamChatPanel: { type: Boolean, default: false },
        hasEditAccess: { type: Boolean, default: true },
        versionList: { type: Array, default: () => [] },
        isAdmin: { type: Boolean, default: false },
        isOwner: { type: Boolean, default: false },
        showPiFlag: { type: Boolean, default: true },
        showRelatedProjectGroup: { type: Boolean, default: false },
        showPartitionGroups: { type: Boolean, default: false },
        canClone: { type: Boolean, default: false },
        runStarting: { type: Boolean, default: false }
    },
    emits: [
        'openPanel',
        'openDefinition',
        'updateXml',
        'save',
        'clone',
        'delete',
        'run',
        'execInfo',
        'versionHistory',
        'definition',
        'toggleWip',
        'validationDone',
        'dismissBackup',
        'recoverBackup',
        'replaceXml',
        'toggleCopilot',
        'toggleTeamChat',
        'togglePiFlag',
        'toggleRelatedProjectGroup',
        'openPiFlagTab',
        'changeMode',
        'openGovernance',
        'selectVersionPreview',
        'bpmnLoaded',
        'update:activeMode',
        'registerGeneratedProcesses',
        'addProcessReferenceLinks',
        'restoreToBeVersion',
        'partitionMembershipChanged',
        'commitPartitionGroups',
        'togglePartitionGroups',
        'partitionEditStarted',
        'partitionEditCancelled',
        'partitionBlockAdded',
        'partitionBlockRenamed',
        'partitionCommitPreviewRequested',
        'partitionNodeFocus'
    ],
    beforeUnmount() {
        // 전역 상태 정리 — 다른 페이지에 영향 방지
        window.$bpmnTimeTravel = null;

        clearTimeout(this._pendingModeTimer);

        // 파티션 편집 세션 리스너/타이머 정리
        this._teardownPartitionEditSession();
        if (this._partitionFocusHandler) {
            try {
                useBpmnStore().getModeler?.get('eventBus').off('element.click', this._partitionFocusHandler);
            } catch (e) {
                /* ignore */
            }
            this._partitionFocusHandler = null;
        }

        // 진행 중인 AI BPMN 생성 요청 취소 (네트워크/백엔드 작업 누수 방지)
        this.cancelGenGeneration();

        // [2.3.3] Cleanup viewbox listener
        if (this._viewboxHandler) {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (modeler) {
                    const canvas = modeler.get('canvas');
                    canvas.off('viewbox.changed', this._viewboxHandler);
                }
            } catch (e) {
                /* ignore */
            }
            this._viewboxHandler = null;
        }
    },
    data() {
        return {
            previewingVersion: '',
            bpmnKey: 0,
            // 툴바 표기용 프로세스 영구 UUID (proc_def.uuid) — 조회 실패 시 legacy id 폴백
            definitionUuid: '',
            // As-Is 파티셔닝 그룹 편집 상태
            hasPartitionOverlay: false,
            partitionEditMode: false,
            committingPartition: false,
            // 페인트 편집: 활성 블록·팔레트 표시 상태 (배정 원본은 비반응형 _editAssign Map)
            activePaintBlockId: null,
            paletteBlocks: [], // [{id, name, color_idx, color, count}]
            unassignedCount: 0,
            partitionCtxMenu: { show: false, x: 0, y: 0, elementId: null, elementName: '', currentBlockId: null },
            validationDialog: false,
            validationResults: [],
            validationOverlayIds: [],
            validationMarkerIds: [],
            activeMode: 'as-is',
            toBeBlueprintXml: '',
            toBeHistoryDialog: false, // To-Be 버전 이력 다이얼로그
            previewingToBeVersion: '', // 미리보기 중인 To-Be 버전 (빈 문자열이면 현재본)
            asIsXmlSnapshot: '', // As-Is XML 스냅샷 (To-Be 전환 시 현재 상태 보존)
            switchingMode: false, // 모드 전환 중 플래그
            viewboxInfo: null,
            _viewboxHandler: null,
            canvasMinHeight: 0,
            _expandDebounceTimer: null,
            xmlDialog: false,
            xmlPreview: '',
            xmlOriginal: '',
            // 모드 전환 슬라이더 즉시 반응용 (실제 모드 변경은 비동기 lock acquire 등으로 지연될 수 있음)
            pendingModeValue: null,
            _pendingModeTimer: null,
            // AI BPMN 생성 (파일 N개 + Confluence 링크 N개 + 텍스트 자유 혼합 → 통합 context)
            genDialog: false,
            genInputText: '',
            genFiles: [],
            genConfluenceUrls: [],
            genConfluenceUrlInput: '',
            genGuidelineText: '',
            genLoading: false,
            genError: '',
            genResult: null,
            // 스트리밍 생성 중 누적되는 미리보기 텍스트 (실시간 토큰)
            genProgress: '',
            // Confluence 파이프라인이 복수 프로세스를 반환한 경우의 응답 (1개면 genResult 경로 사용)
            genPipelineResponse: null,
            genSelectedProcessIndex: 0,
            genRegistering: false,
            _genAbortController: null
        };
    },
    computed: {
        /** 툴바 title 우측 표기 — 영구 UUID 우선, 조회 전/실패 시 legacy id */
        displayDefinitionId() {
            return this.definitionUuid || this.definitionPath;
        },
        pipelineRegisterableResults() {
            return (this.genPipelineResponse?.results || []).filter((item) => !item?.error && item?.xml);
        },
        pipelineRegisterableCount() {
            return this.pipelineRegisterableResults.length;
        },
        canRegisterPipelineResults() {
            return !this.genLoading && this.pipelineRegisterableCount > 0;
        },
        canApplySelectedPipelineResult() {
            const item = this.genPipelineResponse?.results?.[this.genSelectedProcessIndex];
            return !this.genRegistering && !!item?.xml && !item?.error;
        },
        pipelineRegisterButtonText() {
            return this.pipelineRegisterableCount > 1 ? '전체 프로세스 별도 등록' : '프로세스 별도 등록';
        },
        genResultSegments() {
            const answer = this.genResult?.answer || '';
            if (!answer) return [];
            return this._splitOpenUiAnswer(answer);
        },
        /** 파일 input accept 속성 (지원 확장자 목록) */
        acceptAttr() {
            return SUPPORTED_FILE_EXTENSIONS.join(',');
        },
        /** 파일/링크/텍스트 중 하나라도 입력되면 'BPMN 생성' 버튼 활성화 */
        canGenerate() {
            if (this.genLoading) return false;
            return this.genFiles.length > 0 || this.genConfluenceUrls.length > 0 || this.genInputText.trim().length > 0;
        },
        /** 로딩 중 안내 문구 */
        genLoadingText() {
            return 'AI가 입력 자료를 하나의 맥락으로 통합한 뒤 절차 판별 → 프로세스 분리 → BPMN 생성을 진행 중입니다. 자료가 많으면 수 분 정도 걸릴 수 있습니다.';
        },
        /** 스트리밍 미리보기: 누적 텍스트의 마지막 부분만 노출 (말미로 자동 스크롤되는 효과) */
        genProgressTail() {
            const text = this.genProgress || '';
            const LIMIT = 1200;
            return text.length > LIMIT ? '…' + text.slice(text.length - LIMIT) : text;
        },
        /** 결과 칩에 표시할 출처 라벨 (한국어) */
        genSourceLabel() {
            const src = this.genResult?.scenario_source;
            const map = { input_text: '텍스트', file: '파일', confluence: 'Confluence', multi: '통합 자료' };
            return map[src] || src || '';
        },
        /** 파이프라인 복수 결과 칩에 표시할 출처 라벨 (한국어) */
        genPipelineSourceLabel() {
            const src = this.genPipelineResponse?.scenario_source;
            const map = { confluence: 'Confluence', multi: '통합 자료' };
            return map[src] || src || '';
        },
        /** 통합 본문이 분리 한도를 초과해 일부 내용이 생략됐을 수 있는지 (백엔드 context_truncated 플래그) */
        genContextTruncated() {
            const flags = this.genResult?.quality_flags || this.genPipelineResponse?.quality_flags || [];
            return Array.isArray(flags) && flags.includes('context_truncated');
        },
        genContextTruncatedMessage() {
            return '추가한 자료가 많아 일부 내용이 프로세스 분리 단계에서 생략됐을 수 있습니다. 자료를 나눠 여러 번 생성하면 더 정확합니다.';
        },
        toBeMode() {
            return this.activeMode === 'to-be';
        },
        /** 실행 기능(실행 버튼·Exec 뷰) 노출 대상 사용자인지 — execFeatureGate 참조. */
        isExecUser() {
            return canUseExecFeatures();
        },
        execMode() {
            return this.activeMode === 'exec' && this.isExecUser;
        },
        /** Exec(실행형) 뷰 상태 — 페이지가 provide 한 공유 Blueprint Studio 에서 읽는다. */
        execStudio() {
            return this.anStudio?.studio || null;
        },
        execData() {
            return this.execStudio?.executable?.value || null;
        },
        execGenerating() {
            return !!this.execStudio?.generatingExecutable?.value;
        },
        execApplying() {
            return !!this.execStudio?.applyingExecutable?.value;
        },
        /** Exec 캔버스에 표시할 원본 XML — 변환 결과의 source 를 따르고, 없으면 다음 변환 원본. */
        execSourceXml() {
            const studio = this.execStudio;
            const src = this.execData?.source || (studio?.executableSource ? studio.executableSource().source : 'asis');
            if (src === 'modularized' && studio?.modularizedBpmn?.value) return studio.modularizedBpmn.value;
            if (src === 'tobe' && studio?.blueprintXml?.value) return studio.blueprintXml.value;
            return this.normalizeBpmnText(this.bpmn);
        },
        /**
         * Exec 캔버스 클릭/우클릭을 기존 우측 속성 패널로 보낼지 — 그 패널은 숨겨진 As-Is
         * 모델러에서 요소를 찾으므로, 변환 원본이 As-Is 일 때만 유효하다. To-Be/모듈화 원본이면
         * 요소 id 가 As-Is 에 없어 조용히 무시되므로 Exec 내장 패널을 쓴다.
         */
        execUseExternalPanel() {
            const studio = this.execStudio;
            const src = this.execData?.source || (studio?.executableSource ? studio.executableSource().source : 'asis');
            return src === 'asis';
        },
        hasToBeBlueprint() {
            return !!this.toBeBlueprintXml;
        },
        /** definition.tobe_bpmn_versions — 최신순 정렬 */
        toBeVersions() {
            const list = this.processDefinition?.definition?.tobe_bpmn_versions;
            if (!Array.isArray(list)) return [];
            return list
                .filter((v) => v && v.xml)
                .slice()
                .sort((a, b) => {
                    const [aMaj, aMin] = toSafeText(a.version)
                        .split('.')
                        .map((n) => parseInt(n, 10) || 0);
                    const [bMaj, bMin] = toSafeText(b.version)
                        .split('.')
                        .map((n) => parseInt(n, 10) || 0);
                    if ((bMaj || 0) !== (aMaj || 0)) return (bMaj || 0) - (aMaj || 0);
                    return (bMin || 0) - (aMin || 0);
                });
        },
        currentToBeVersion() {
            return toSafeText(this.processDefinition?.definition?.tobe_version).trim();
        },
        isToBePreviewing() {
            return !!this.previewingToBeVersion;
        },
        processNameText() {
            return toSafeText(this.processName);
        },
        normalizedBreadcrumbItems() {
            return (this.breadcrumbItems || []).map((item) => toSafeText(item)).filter(Boolean);
        },
        breadcrumbTitle() {
            return this.normalizedBreadcrumbItems.join(' > ');
        },
        normalizedVersionList() {
            return (this.versionList || [])
                .map((ver, index) => {
                    const versionText = toSafeText(ver?.version).trim();
                    if (!versionText) return null;
                    return {
                        ...ver,
                        versionText,
                        versionTagText: toSafeText(ver?.version_tag).trim(),
                        versionKey: `${versionText}-${toSafeText(ver?.id || ver?.created_at || index).trim() || index}`
                    };
                })
                .filter(Boolean);
        },
        /** 캔버스에 로드할 실제 XML */
        activeBpmn() {
            if (this.switchingMode) return null; // 전환 중 무시
            if (this.toBeMode) {
                return this.normalizeBpmnText(this.toBeBlueprintXml) || EMPTY_TOBE_BPMN_XML;
            }
            return this.normalizeBpmnText(this.bpmn);
        },
        currentStatus() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find((d) => toSafeText(d?.file_name || d?.id).trim() === this.definitionPath);
            if (!toSafeText(def?.version).trim()) return '';
            return toSafeText(def?.approval_state || def?.status).trim();
        },
        currentVersion() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find((d) => toSafeText(d?.file_name || d?.id).trim() === this.definitionPath);
            return toSafeText(def?.version).trim();
        },
        lastSavedAt() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find((d) => toSafeText(d?.file_name || d?.id).trim() === this.definitionPath);
            const raw = toSafeText(def?.saved_at).trim();
            if (!raw) return '';
            const d = new Date(raw);
            if (isNaN(d.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
                d.getSeconds()
            )}`;
        },
        isWip() {
            if (!this.definitionPath || !this.definitionList) return false;
            const def = this.definitionList.find((d) => toSafeText(d?.file_name || d?.id).trim() === this.definitionPath);
            const approvalState = toSafeText(def?.approval_state).trim();
            const status = toSafeText(def?.status).trim();
            return approvalState === 'wip' || status === 'wip';
        },
        modeOptions() {
            const editDisabled = !this.hasEditAccess || !!this.previewingVersion;
            const editReason = this.previewingVersion ? '미리보기를 해제해주세요' : '';
            return [
                { value: 'view', label: '읽기', icon: 'mdi-eye-outline', disabled: false, disabledReason: '' },
                {
                    value: 'edit',
                    label: '편집',
                    icon: 'mdi-pencil-outline',
                    disabled: editDisabled,
                    disabledReason: editDisabled ? editReason : ''
                },
                { value: 'history', label: '변경 이력', icon: 'mdi-history', disabled: false, disabledReason: '' }
            ];
        },
        // 슬라이더가 즉시 반응하도록 pending 클릭값을 우선 적용, 없으면 prop 사용
        activeModePillValue() {
            return this.pendingModeValue || this.editorMode;
        },
        pillSliderStyle() {
            const idx = this.modeOptions.findIndex((m) => m.value === this.activeModePillValue);
            const activeIdx = idx >= 0 ? idx : 0;
            const pct = 100 / 3;
            return {
                left: `calc(${activeIdx * pct}% + 3px)`,
                width: `calc(${pct}% - 6px)`
            };
        },
        asisTobeOptions() {
            const options = [
                { value: 'as-is', label: 'As-Is' },
                { value: 'to-be', label: 'To-Be' }
            ];
            // Exec(실행형) 모드는 허용 사용자에게만 노출 — 나머지는 기존 2단 토글 유지
            if (this.isExecUser) options.push({ value: 'exec', label: 'Exec' });
            return options;
        },
        asisTobeSliderStyle() {
            const idx = this.asisTobeOptions.findIndex((m) => m.value === this.activeMode);
            const activeIdx = idx >= 0 ? idx : 0;
            const pct = 100 / this.asisTobeOptions.length;
            return {
                left: `calc(${activeIdx * pct}% + 3px)`,
                width: `calc(${pct}% - 6px)`
            };
        },
        editorModeLabel() {
            if (this.editorMode === 'history') return 'Version History';
            if (this.editorMode === 'view') return 'View Mode';
            return 'Edit Mode';
        },
        editorModeColor() {
            if (this.editorMode === 'history') return 'info';
            if (this.editorMode === 'view') return 'grey';
            return 'primary';
        },
        hasXmlChanges() {
            return this.xmlPreview !== this.xmlOriginal;
        }
    },
    watch: {
        // FR-003: 그룹 보기 토글 → 즉시 오버레이 렌더/클리어 (편집 모드에선 실 그룹 도형이므로 제외).
        //   renderPartitionBlocks 가 showPartitionGroups 를 자체 게이트하므로 off 시 clear 됨.
        showPartitionGroups() {
            if (this.partitionEditMode) return;
            this.renderPartitionBlocks(this._lastPartitionBlocks || []);
        },
        definitionPath: {
            immediate: true,
            handler(val) {
                this.previewingVersion = '';
                this.resolveDefinitionUuid(val);
            }
        },
        editorMode(val) {
            // 부모에서 실제 모드 변경이 prop 으로 반영되면 pending 해제
            if (val === this.pendingModeValue) {
                this.pendingModeValue = null;
                clearTimeout(this._pendingModeTimer);
            }
        },
        async bpmn(newVal, oldVal) {
            if (newVal !== oldVal && newVal) {
                // 프로세스 전환 전에 To-Be 편집 중이었으면 persist (미리보기 중에는 제외 — 과거 버전 덮어쓰기 방지)
                if (this.toBeMode && this.toBeBlueprintXml && oldVal && !this.previewingToBeVersion) {
                    const currentXml = await this.getCurrentXml();
                    if (currentXml) {
                        await this.persistToBeBpmn(currentXml);
                    }
                }
                this.previewingToBeVersion = '';
                this.bpmnKey++;
                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
                // 프로세스 전환 시 이전 프로세스의 파티션 오버레이 상태가 남지 않도록 초기화
                // (캔버스는 bpmnKey 재마운트로 새로 그려지지만 아래 상태는 컴포넌트에 유지됨)
                this._teardownPartitionEditSession();
                this.hasPartitionOverlay = false;
                this.partitionEditMode = false;
                this._lastPartitionBlocks = [];
                this._partitionLayer = null;
                this._partitionTintMarks = [];
                this._partitionFocusHandler = null; // 캔버스 재마운트로 eventBus 도 새로 생성됨
                if (!this.previewingVersion) {
                    this.activeMode = 'as-is';
                }
                this.asIsXmlSnapshot = '';
                this.switchingMode = false;
                window.$bpmnTimeTravel = null;
                // definition에서 저장된 tobe_bpmn 로드
                const savedToBe = this.processDefinition?.definition?.tobe_bpmn;
                this.toBeBlueprintXml = savedToBe || '';
            }
        },
        async activeMode(newMode, oldMode) {
            // 부모(ProcessHierarchy)가 To-Be 게이팅(챗 명령/다이얼로그)에 사용할 수 있도록 항상 통지
            this.$emit('update:activeMode', newMode);
            if (!this.bpmn || this.switchingMode) return;
            // Exec 는 캔버스를 As-Is 상태로 둔 채 실행형 뷰만 덮어씌우므로,
            // 캔버스 전환 작업은 to-be 가 관여할 때만 필요하다 (as-is ↔ exec 는 no-op).
            const canvasKind = (m) => (m === 'to-be' ? 'to-be' : 'as-is');
            if (canvasKind(newMode) === canvasKind(oldMode)) return;
            this.switchingMode = true;

            try {
                // 현재 캔버스의 최신 XML 스냅샷 저장
                const currentXml = await this.getCurrentXml();

                if (newMode === 'to-be') {
                    // As-Is/Exec → To-Be: As-Is 상태 보존
                    if (currentXml) this.asIsXmlSnapshot = currentXml;
                    if (!this.hasToBeBlueprint) this.toBeBlueprintXml = EMPTY_TOBE_BPMN_XML;
                    this.bpmnKey++;
                    // timeTravel 모드 설정
                    window.$bpmnTimeTravel = 'toBe';
                } else {
                    // To-Be → As-Is/Exec: To-Be 상태 보존 + DB persist
                    // 미리보기 중에는 과거 버전 XML 이 캔버스에 있으므로 persist 하지 않는다(현재본 덮어쓰기 방지).
                    if (this.previewingToBeVersion) {
                        this.previewingToBeVersion = '';
                    } else if (currentXml && this.hasToBeBlueprint) {
                        this.toBeBlueprintXml = currentXml;
                        this.persistToBeBpmn(currentXml);
                    }
                    // As-Is로 복원
                    this.bpmnKey++;
                    window.$bpmnTimeTravel = null;
                }
            } finally {
                this.$nextTick(() => {
                    this.switchingMode = false;
                });
            }
        }
    },
    methods: {
        formatKST(value, pattern, fallback) {
            return formatKSTUtil(value, pattern, fallback);
        },
        /** definitionPath(legacy id) → proc_def.uuid 조회. 비동기 응답 도착 시점에 프로세스가 바뀌었으면 무시. */
        async resolveDefinitionUuid(defId) {
            this.definitionUuid = '';
            const path = toSafeText(defId).trim();
            if (!path) return;
            try {
                const uuid = await processUuidForRoute(path);
                if (toSafeText(this.definitionPath).trim() === path) {
                    this.definitionUuid = uuid || '';
                }
            } catch (e) {
                console.warn('[ProcessHierarchyDesigner] 프로세스 uuid 조회 실패(legacy id 표시 유지):', e);
            }
        },
        async copyDefinitionId() {
            const id = this.displayDefinitionId;
            if (!id) return;
            try {
                await navigator.clipboard.writeText(id);
                this.$toast?.success(`복사됨: ${id}`);
            } catch (e) {
                this.$toast?.error('클립보드 복사에 실패했습니다.');
            }
        },
        onModePillClick(value) {
            if (!value || value === this.activeModePillValue) return;
            // 슬라이더가 즉시 미끄러져 보이도록 pending 부터 세팅
            this.pendingModeValue = value;
            // 부모에서 변경이 거부되거나 prop 반영이 늦어질 때 슬라이더가 영원히 어긋나지 않도록 안전 timeout
            clearTimeout(this._pendingModeTimer);
            this._pendingModeTimer = setTimeout(() => {
                if (this.pendingModeValue && this.pendingModeValue !== this.editorMode) {
                    this.pendingModeValue = null;
                }
            }, 3000);
            this.$emit('changeMode', value);
        },
        /** Exec 뷰: AI 실행형 변환 (공유 Blueprint Studio 상태에 저장·자동 persist). */
        async onGenerateExecutable() {
            const studio = this.execStudio;
            if (!studio?.generateExecutable) {
                this.$toast?.error('실행형 변환 기능을 사용할 수 없습니다 (studio 미초기화).');
                return;
            }
            try {
                const result = await studio.generateExecutable();
                if (result?.validation?.errors?.length) {
                    this.$toast?.warning(`실행형 변환 완료 — 검증 오류 ${result.validation.errors.length}건. 재변환 시 AI에 피드백됩니다.`);
                } else {
                    this.$toast?.success('실행형 프로세스로 변환했습니다.');
                }
            } catch (e) {
                this.$toast?.error(e?.message || '실행형 변환에 실패했습니다.');
            }
        },
        /** Exec 뷰: 속성 패널에서 직접 수정한 definition 저장 (tobe.executable autosave — 실행 반영은 재등록 필요). */
        onUpdateExecutableDefinition(definition) {
            const studio = this.execStudio;
            if (!studio?.updateExecutableDefinition) {
                this.$toast?.error('실행 정의 수정 기능을 사용할 수 없습니다 (studio 미초기화).');
                return;
            }
            try {
                const validation = studio.updateExecutableDefinition(definition);
                if (validation?.errors?.length) {
                    this.$toast?.warning(`수정을 저장했습니다 — 검증 오류 ${validation.errors.length}건. 오류 해결 후 등록할 수 있습니다.`);
                } else {
                    this.$toast?.success('수정을 저장했습니다. "실행 정의로 등록"을 눌러야 실행에 반영됩니다.');
                }
            } catch (e) {
                this.$toast?.error(e?.message || '실행 정의 수정에 실패했습니다.');
            }
        },
        /** Exec 뷰: 변환된 definition 을 proc_def 실행 정의로 등록 (허용 사용자 전용). */
        async onApplyExecutable() {
            if (!this.isExecUser) {
                this.$toast?.warning('실행 정의 등록 권한이 없습니다.');
                return;
            }
            const studio = this.execStudio;
            if (!studio?.applyExecutable) {
                this.$toast?.error('실행 정의 등록 기능을 사용할 수 없습니다 (studio 미초기화).');
                return;
            }
            try {
                const result = await studio.applyExecutable();
                const n = result?.generatedFormCount || 0;
                this.$toast?.success(
                    n
                        ? `실행 정의로 등록했습니다 (userTask 폼 ${n}개 자동 생성·연결). 실행 버튼으로 인스턴스를 시작할 수 있습니다.`
                        : '실행 정의로 등록했습니다. 실행 버튼으로 인스턴스를 시작할 수 있습니다.'
                );
            } catch (e) {
                this.$toast?.error(e?.message || '실행 정의 등록에 실패했습니다.');
            }
        },
        loadAsIsIntoToBe() {
            if (this.isViewMode) return;
            const asIsXml = this.normalizeBpmnText(this.asIsXmlSnapshot) || this.normalizeBpmnText(this.bpmn);
            if (!asIsXml) {
                this.$toast?.warning('불러올 As-Is BPMN이 없습니다.');
                return;
            }
            this.toBeBlueprintXml = asIsXml;
            this.bpmnKey++;
            this.$toast?.info('As-Is BPMN을 To-Be 편집 캔버스로 불러왔습니다.');
        },
        async capturePng() {
            const bpmnVue = this.$refs.bpmnVue;
            if (!bpmnVue || !bpmnVue.bpmnViewer) {
                console.error('BPMN viewer not found');
                return;
            }
            const { capturePng } = useBpmnExport();
            await capturePng({
                bpmnViewer: bpmnVue.bpmnViewer,
                processName: this.processName || 'Process Diagram'
            });
        },
        normalizeBpmnText(value) {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'object') {
                for (const key of ['bpmn', 'snapshot', 'xml', 'content']) {
                    const candidate = value?.[key];
                    if (typeof candidate === 'string' && candidate.trim()) {
                        return candidate;
                    }
                }
            }
            return '';
        },

        onSelectVersion(version) {
            let normalizedVersion = toSafeText(version).trim();
            if (normalizedVersion === this.currentVersion) normalizedVersion = '';
            this.previewingVersion = normalizedVersion;
            if (normalizedVersion && this.editorMode === 'edit') {
                this.$emit('changeMode', 'view');
            }
            this.$emit('selectVersionPreview', normalizedVersion || '__current__');
        },
        /** 현재 modeler에서 최신 XML 추출 */
        async getCurrentXml() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return null;
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                return xml;
            } catch {
                return null;
            }
        },

        async openXmlDialog() {
            const currentXml = await this.getCurrentXml();
            this.xmlPreview = currentXml || this.activeBpmn || '';
            this.xmlOriginal = this.xmlPreview;
            this.xmlDialog = true;
        },

        triggerBpmnUpload() {
            if (this.isViewMode) return;
            this.$refs.xmlFileInput?.click();
        },

        validateBpmnXml(xml) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'application/xml');
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                throw new Error('invalid xml');
            }

            const rootName = doc.documentElement?.localName?.toLowerCase();
            if (rootName !== 'definitions') {
                throw new Error('invalid bpmn definitions');
            }
        },

        applyXmlToCanvas(xml) {
            const normalizedXml = String(xml || '').trim();
            if (!normalizedXml) {
                throw new Error('empty xml');
            }

            this.validateBpmnXml(normalizedXml);
            this.xmlPreview = normalizedXml;

            if (this.toBeMode) {
                this.toBeBlueprintXml = normalizedXml;
                this.bpmnKey++;
            } else {
                this.$emit('replaceXml', normalizedXml);
            }

            this.xmlOriginal = normalizedXml;
            return normalizedXml;
        },

        async handleBpmnFileChange(event) {
            const input = event?.target;
            const file = input?.files?.[0];
            if (!file) return;

            if (input) {
                input.value = '';
            }

            try {
                const xml = String((await file.text()) || '').trim();
                this.applyXmlToCanvas(xml);
                this.$toast?.success(this.$t('chat.importBpmnFile') || 'BPMN 파일을 불러왔습니다.');
            } catch (e) {
                console.error('BPMN upload failed:', e);
                let message = 'BPMN XML 파일을 불러오지 못했습니다.';
                if (e?.message === 'invalid xml') {
                    message = 'XML 형식이 표준 규격에 맞지 않아 불러올 수 없습니다. 다른 BPMN 도구에서 만든 파일일 수 있습니다.';
                } else if (e?.message === 'invalid bpmn definitions') {
                    message = 'BPMN 파일이 아닙니다. (루트가 <definitions>가 아닙니다)';
                } else if (e?.message === 'empty xml') {
                    message = '파일이 비어있습니다.';
                }
                this.$toast?.error(message);
            }
        },

        // ===== AI BPMN 생성 (텍스트 / 파일 / Confluence) =====

        openGenDialog() {
            this.genInputText = '';
            this.genFiles = [];
            this.genConfluenceUrls = [];
            this.genConfluenceUrlInput = '';
            this.genGuidelineText = '';
            this.genLoading = false;
            this.genError = '';
            this.genResult = null;
            this.genPipelineResponse = null;
            this.genSelectedProcessIndex = 0;
            this.genRegistering = false;
            this._genAbortController = null;
            this.genDialog = true;
        },

        closeGenDialog() {
            if (this.genRegistering) return;
            this.cancelGenGeneration();
            this.genDialog = false;
        },

        resetGenResult() {
            if (this.genRegistering) return;
            this.genResult = null;
            this.genPipelineResponse = null;
            this.genSelectedProcessIndex = 0;
            this.genError = '';
        },

        // ----- 파일 선택 -----
        triggerGenFilePick() {
            if (this.genLoading) return;
            this.$refs.genFileInput?.click();
        },

        onGenFileInputChange(event) {
            const input = event?.target;
            const files = Array.from(input?.files || []);
            // 같은 파일을 다시 선택할 수 있도록 input 초기화
            if (input) input.value = '';
            this.applyPickedGenFiles(files);
        },

        applyPickedGenFiles(files) {
            this.genError = '';
            const rejected = [];
            for (const file of files) {
                if (!isSupportedFileExtension(file.name)) {
                    const dot = file.name.lastIndexOf('.');
                    rejected.push(`${file.name} (${dot >= 0 ? file.name.slice(dot) : '확장자 없음'})`);
                    continue;
                }
                if (file.size > MAX_FILE_BYTES) {
                    rejected.push(`${file.name} (30MB 초과)`);
                    continue;
                }
                // 같은 이름+크기 파일은 중복 추가하지 않음
                const dup = this.genFiles.some((f) => f.name === file.name && f.size === file.size);
                if (!dup) this.genFiles.push(file);
            }
            if (rejected.length) {
                this.genError = `추가하지 못한 파일: ${rejected.join(', ')}`;
            }
        },

        removeGenFile(index) {
            this.genFiles.splice(index, 1);
            this.genError = '';
        },

        // ----- Confluence 링크 추가/삭제 -----
        addGenConfluenceUrl() {
            if (this.genLoading) return;
            const url = this.genConfluenceUrlInput.trim();
            if (!url) return;
            if (!url.startsWith('http')) {
                this.genError = '올바른 URL을 입력해주세요. (https://...)';
                return;
            }
            if (this.genConfluenceUrls.includes(url)) {
                this.genConfluenceUrlInput = '';
                return;
            }
            this.genConfluenceUrls.push(url);
            this.genConfluenceUrlInput = '';
            this.genError = '';
        },

        removeGenConfluenceUrl(index) {
            this.genConfluenceUrls.splice(index, 1);
            this.genError = '';
        },

        formatFileSize(bytes) {
            if (typeof bytes !== 'number') return '';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        },

        // ----- 생성 실행 -----
        async runBpmnGeneration() {
            if (!this.canGenerate) return;

            this.genError = '';
            this.genResult = null;
            this.genPipelineResponse = null;
            this.genSelectedProcessIndex = 0;
            this.genProgress = '';
            this.genLoading = true;

            const abortController = new AbortController();
            this._genAbortController = abortController;

            try {
                const guideline = this.genGuidelineText.trim();

                // 모든 입력(파일 N개 + Confluence 링크 N개 + 텍스트)을 통합 파이프라인으로 처리:
                // Consolidator(결정적 병합) → 절차 판별 → 프로세스 분리 → N건 병렬 생성
                const response = await generateBpmnMulti(
                    {
                        inputText: this.genInputText.trim() || undefined,
                        files: this.genFiles,
                        confluenceUrls: this.genConfluenceUrls,
                        guidelineText: guideline || undefined
                    },
                    abortController.signal,
                    {
                        // 단계 로그를 실시간으로 진행 영역에 표시
                        onLog: (message) => {
                            this.genProgress = this.genProgress ? `${this.genProgress}\n${message}` : message;
                        },
                        // 프로세스별 생성 완료를 진행 영역에 누적 표시
                        onProcess: ({ index, total, result }) => {
                            const status = result.error ? '실패' : '완료';
                            const line = `  → [${index + 1}/${total}] ${result.process_name || '프로세스'} 생성 ${status}`;
                            this.genProgress = this.genProgress ? `${this.genProgress}\n${line}` : line;
                        }
                    }
                );

                const succeeded = (response?.results || []).filter((r) => !r.error && r.xml);
                if (succeeded.length === 0) {
                    // 전체 실패는 서버가 500으로 주므로 사실상 방어 코드
                    throw new Error('생성된 BPMN XML이 없습니다. 다시 시도해 주세요.');
                }

                if (response.results.length === 1) {
                    // 프로세스 1개 → 기존 단건과 동일한 결과 화면 재사용
                    const normalized = this._normalizeGenResult({
                        xml: succeeded[0].xml,
                        scenario_source: response.scenario_source,
                        guideline_source: response.guideline_source
                    });
                    // 통합 본문 절단 경고 등 품질 플래그를 단건 결과 화면에서도 노출하기 위해 전달
                    normalized.quality_flags = response.quality_flags;
                    this.genResult = normalized;
                } else {
                    // 프로세스 여러 개 → 선택 UI 표시
                    this.genPipelineResponse = response;
                    this.genSelectedProcessIndex = response.results.findIndex((r) => !r.error && r.xml);
                }
            } catch (error) {
                if (error?.name === 'AbortError') {
                    // 사용자가 중지함 → 조용히 종료 (finally에서 로딩 해제)
                    return;
                }
                if (error instanceof BpmnNoProcessDataError) {
                    // 절차 없음은 "오류"가 아니라 정상적인 판별 결과 → 안내 톤으로 노출
                    this.genError = '이 페이지에서는 업무 절차를 찾지 못했습니다. 절차(담당자·순서·행동)가 포함된 문서인지 확인해 주세요.';
                    return;
                }
                this.genError = error?.message || '요청 중 오류가 발생했습니다.';
            } finally {
                this.genLoading = false;
                this.genProgress = '';
                this._genAbortController = null;
            }
        },

        /** 응답의 xml이 OpenUI로 래핑된 경우 실제 BPMN XML을 추출해 정규화한다. */
        _normalizeGenResult(result) {
            const rawXml = result.xml;
            if (this._isOpenUiContent(rawXml)) {
                const extractedXml = this._extractBpmnXmlFromOpenUi(rawXml);
                if (!extractedXml) {
                    throw new Error('OpenUI 응답에서 BPMN XML을 추출하지 못했습니다.');
                }
                return {
                    xml: extractedXml,
                    answer: this._stripCodeBlockFromOpenUi(rawXml),
                    scenario_source: result.scenario_source,
                    guideline_source: result.guideline_source
                };
            }
            return result;
        },

        applyGenResult() {
            if (!this.genResult?.xml) return;
            try {
                this.applyXmlToCanvas(this.genResult.xml);
                this._emitGenReferenceLinks();
                this.genDialog = false;
                this.$toast?.success('AI가 생성한 BPMN을 캔버스에 적용했습니다.');
            } catch (e) {
                console.error('Generated BPMN apply failed:', e);
                let message = 'BPMN XML을 캔버스에 적용하지 못했습니다.';
                if (e?.message === 'invalid xml' || e?.message === 'invalid bpmn definitions') {
                    message = 'AI가 생성한 XML이 표준 BPMN 형식이 아닙니다. "다시 생성"을 눌러 다시 시도해 주세요.';
                } else if (e?.message === 'empty xml') {
                    message = '생성된 XML이 비어 있습니다. "다시 생성"을 눌러 다시 시도해 주세요.';
                }
                this.genError = message;
            }
        },

        /**
         * AI 생성에 활용된 참조 링크(관련자료 링크)를 만든다.
         * 입력에 추가된 모든 Confluence 링크를 대상으로 한다.
         * 제목은 "생성시 활용된 컨플"로 등록하며, URL 경로에서 페이지 제목을 추출할 수 있으면 뒤에 덧붙여 구분한다.
         */
        _buildGenReferenceLinks() {
            return (this.genConfluenceUrls || [])
                .map((rawUrl) => {
                    const url = (rawUrl || '').trim();
                    if (!url) return null;
                    let name = '생성시 활용된 컨플';
                    try {
                        const m = url.match(/\/pages\/\d+\/([^/?#]+)/);
                        if (m && m[1]) {
                            const decoded = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
                            if (decoded) name = `생성시 활용된 컨플: ${decoded}`;
                        }
                    } catch (e) {
                        // 디코딩 실패 시 기본 라벨 유지
                    }
                    return { name, url };
                })
                .filter(Boolean);
        },

        /** 캔버스 적용 시, 생성 출처 링크를 현재 프로세스의 관련자료 링크에 자동 등록하도록 부모에 알린다. */
        _emitGenReferenceLinks() {
            const links = this._buildGenReferenceLinks();
            if (links.length > 0) {
                console.info('[BPMN Gen] 참조 링크 자동 등록 요청:', links.map((l) => l.url));
                this.$emit('addProcessReferenceLinks', links);
            } else {
                console.info('[BPMN Gen] 등록할 참조 링크 없음 — Confluence URL 입력이 비어 있음');
            }
        },

        /** 파이프라인 복수 결과 중 선택된 프로세스를 캔버스에 적용한다. */
        applySelectedPipelineResult() {
            const item = this.genPipelineResponse?.results?.[this.genSelectedProcessIndex];
            if (this.genRegistering || !item || item.error || !item.xml) return;
            try {
                // 단건과 동일하게 OpenUI 래핑 가능성을 정규화한 뒤 적용
                const normalized = this._normalizeGenResult({ xml: item.xml });
                this.applyXmlToCanvas(normalized.xml);
                this._emitGenReferenceLinks();
                this.genDialog = false;
                this.$toast?.success(`"${item.process_name}" BPMN을 캔버스에 적용했습니다.`);
            } catch (e) {
                console.error('Pipeline BPMN apply failed:', e);
                this.genError = 'BPMN XML을 캔버스에 적용하지 못했습니다. 다른 프로세스를 선택하거나 다시 생성해 주세요.';
            }
        },

        /** 파이프라인에서 생성된 성공 결과들을 별도 프로세스 정의로 등록한다. */
        async registerPipelineResults() {
            if (!this.canRegisterPipelineResults || this.genRegistering) return;

            this.genRegistering = true;
            this.genError = '';
            try {
                const results = this.pipelineRegisterableResults.map((item, index) => {
                    const normalized = this._normalizeGenResult({ xml: item.xml });
                    return {
                        process_name: item.process_name || `프로세스 ${index + 1}`,
                        xml: normalized.xml
                    };
                });

                await new Promise((resolve, reject) => {
                    this.$emit('registerGeneratedProcesses', {
                        results,
                        sourceType: 'multi',
                        scenarioSource: this.genPipelineResponse?.scenario_source,
                        guidelineSource: this.genPipelineResponse?.guideline_source,
                        referenceLinks: this._buildGenReferenceLinks(),
                        resolve,
                        reject
                    });
                });

                this.genDialog = false;
            } catch (e) {
                console.error('Generated process registration failed:', e);
                this.genError = e?.message || '생성된 프로세스를 등록하지 못했습니다.';
            } finally {
                this.genRegistering = false;
            }
        },

        cancelGenGeneration() {
            if (this.genRegistering) return;
            this._genAbortController?.abort();
            this._genAbortController = null;
            this.genLoading = false;
        },

        handleGenOpenUiAction(event) {
            const params = event?.params || {};
            const question = String(params.question || params.prompt || params.text || event?.humanFriendlyMessage || '').trim();
            if (question) {
                this.genGuidelineText = question;
                this.resetGenResult();
            }
        },

        // OpenUI 응답에서 BPMN XML 추출
        _isOpenUiContent(text) {
            if (!text) return false;
            const trimmed = text.trim();
            return trimmed.includes('```openui') || (/^root\s*=/m.test(trimmed) && /CodeBlock/m.test(trimmed));
        },

        _extractBpmnXmlFromOpenUi(text) {
            if (!text) return null;

            // ```openui ... ``` 펜스 제거
            let content = text;
            const fenceMatch = content.match(/```openui\s*([\s\S]*?)```/);
            if (fenceMatch) content = fenceMatch[1];

            // CodeBlock("xml", "...") 에서 두 번째 인자(BPMN XML 문자열) 추출
            const codeBlockStart = /CodeBlock\s*\(\s*"xml"\s*,\s*"/.exec(content);
            if (!codeBlockStart) return null;

            let i = codeBlockStart.index + codeBlockStart[0].length;
            let result = '';

            while (i < content.length) {
                if (content[i] === '\\' && i + 1 < content.length) {
                    const next = content[i + 1];
                    if (next === 'n') result += '\n';
                    else if (next === 't') result += '\t';
                    else if (next === '"') result += '"';
                    else if (next === '\\') result += '\\';
                    else result += next;
                    i += 2;
                } else if (content[i] === '"') {
                    break;
                } else {
                    result += content[i];
                    i++;
                }
            }

            const xml = result.trim();
            if (!xml || (!xml.includes('<definitions') && !xml.includes(':definitions'))) return null;
            return xml;
        },

        /**
         * OpenUI 원문에서 CodeBlock 정의 및 참조를 제거한다.
         * CodeBlock은 OpenUiRenderer가 지원하지 않으며,
         * BPMN XML은 이미 별도 추출하여 미리보기에 표시하므로 제거해도 무방하다.
         */
        _stripCodeBlockFromOpenUi(text) {
            if (!text) return text;

            // ```openui 펜스 내부 추출
            let content = text;
            const fenceMatch = content.match(/```openui\s*([\s\S]*?)```/);
            if (fenceMatch) content = fenceMatch[1];

            // 1) CodeBlock 변수명 수집 + 해당 정의 행 제거
            const codeBlockVars = [];
            let cleaned = '';
            let idx = 0;

            while (idx < content.length) {
                // 행 시작 위치에서 "varName = CodeBlock(" 패턴 감지
                const lineStart = idx;
                const lineEnd = content.indexOf('\n', idx);
                const eol = lineEnd === -1 ? content.length : lineEnd;
                const line = content.slice(lineStart, eol);

                const cbMatch = line.match(/^(\w+)\s*=\s*CodeBlock\s*\(/);
                if (cbMatch) {
                    codeBlockVars.push(cbMatch[1]);
                    // CodeBlock("lang", "...escaped string...") 의 닫는 ) 를 찾아 건너뛴다
                    let i = lineStart + cbMatch.index + cbMatch[0].length;
                    let depth = 1;
                    let inStr = false;
                    while (i < content.length && depth > 0) {
                        if (inStr) {
                            if (content[i] === '\\') {
                                i += 2;
                                continue;
                            }
                            if (content[i] === '"') inStr = false;
                        } else {
                            if (content[i] === '"') inStr = true;
                            else if (content[i] === '(') depth++;
                            else if (content[i] === ')') depth--;
                        }
                        i++;
                    }
                    // 줄바꿈까지 소비
                    idx = i < content.length && content[i] === '\n' ? i + 1 : i;
                } else {
                    cleaned += content.slice(lineStart, eol + 1 <= content.length ? eol + 1 : content.length);
                    idx = eol + 1 <= content.length ? eol + 1 : content.length;
                }
            }

            // 2) 배열 내 CodeBlock 변수 참조 제거  예: [xmlNote, code] → [xmlNote]
            for (const v of codeBlockVars) {
                cleaned = cleaned.replace(new RegExp(`,\\s*${v}\\b`, 'g'), '');
                cleaned = cleaned.replace(new RegExp(`\\b${v}\\s*,\\s*`, 'g'), '');
                cleaned = cleaned.replace(new RegExp(`\\[\\s*${v}\\s*\\]`, 'g'), '[]');
            }

            return cleaned.trim();
        },

        // OpenUI 파싱 유틸 (ProcessHierarchyAIGuide 패턴)
        _escapeHtml(input) {
            return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },

        _formatAnswerText(input) {
            return this._escapeHtml(input).replace(/\n/g, '<br />');
        },

        _looksLikeOpenUiLang(input) {
            const trimmed = input.trim();
            return /^root\s*=/.test(trimmed) && /^[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(trimmed);
        },

        _splitOpenUiAnswer(input) {
            const source = input || '';
            const openUiFencePattern = /```openui\s*([\s\S]*?)```/gi;
            const segments = [];
            let cursor = 0;
            let match;

            while ((match = openUiFencePattern.exec(source)) !== null) {
                const textBefore = source.slice(cursor, match.index).trim();
                const openUiCode = (match[1] || '').trim();
                if (textBefore) segments.push({ type: 'text', content: textBefore });
                if (openUiCode) segments.push({ type: 'openui', content: openUiCode });
                cursor = match.index + match[0].length;
            }

            const tail = source.slice(cursor).trim();
            if (tail) segments.push({ type: 'text', content: tail });

            if (segments.length === 0 && this._looksLikeOpenUiLang(source)) {
                return [{ type: 'openui', content: source.trim() }];
            }

            return segments;
        },

        resetXmlPreview() {
            this.xmlPreview = this.xmlOriginal;
        },

        applyXmlPreview() {
            if (this.isViewMode) return;

            try {
                this.applyXmlToCanvas(this.xmlPreview);
                this.xmlDialog = false;
                this.$toast?.success(this.$t('processHierarchy.xmlApplySuccess') || 'XML 변경사항이 적용되었습니다.');
            } catch (e) {
                console.error('Apply XML failed:', e);
                let message = this.$t('processHierarchy.xmlApplyFailed') || 'XML 변경사항을 적용하지 못했습니다.';
                if (e?.message === 'invalid xml') {
                    message = 'XML 형식이 표준 규격에 맞지 않아 적용할 수 없습니다.';
                } else if (e?.message === 'invalid bpmn definitions') {
                    message = 'BPMN 구조가 아닙니다. (루트가 <definitions>가 아닙니다)';
                } else if (e?.message === 'empty xml') {
                    message = 'XML이 비어있어 적용할 수 없습니다.';
                }
                this.$toast?.error(message);
            }
        },

        async copyXmlToClipboard() {
            if (!this.xmlPreview) return;

            try {
                await navigator.clipboard.writeText(this.xmlPreview);
                this.$toast?.success(this.$t('ProcessDefinitionVersionManager.copiedToClipboard') || '클립보드에 복사되었습니다.');
            } catch (e) {
                console.error('Copy XML failed:', e);
                this.$toast?.error('XML 복사에 실패했습니다.');
            }
        },

        /** To-Be XML을 definition.tobe_bpmn에 즉시 persist (모드 전환 시 유실 방지) */
        async persistToBeBpmn(xml) {
            if (!xml || !this.definitionPath) return;
            // 공유 studio 의 To-Be 청사진도 즉시 동기화 — 미동기 시 Exec 뷰·실행형 변환이
            // 옛 blueprint_xml 을 원본으로 삼아 최신 편집(ServiceTask 등)이 사라져 보이고,
            // 실행 정의 등록/full 저장이 옛 XML 로 tobe_bpmn 을 되돌린다.
            try {
                this.execStudio?.setBlueprintXml?.(xml, '순서도 To-Be 편집 반영');
            } catch (e) {
                console.warn('To-Be studio sync failed:', e);
            }
            try {
                const currentDef = this.processDefinition?.definition || {};
                const updatedDef = { ...currentDef, tobe_bpmn: xml };
                await backend.updateProcessDefinitionMetadata(this.definitionPath, { definition: updatedDef }, '저장');
                // 로컬 동기화
                if (this.processDefinition) {
                    this.processDefinition.definition = updatedDef;
                }
            } catch (e) {
                console.warn('To-Be auto-persist failed:', e);
            }
        },

        createToBeBlueprint() {
            if (this.isViewMode) return;
            this.toBeBlueprintXml = EMPTY_TOBE_BPMN_XML;
            this.bpmnKey++;
        },

        /* -------------------- To-Be 버전 이력 -------------------- */

        openToBeHistory() {
            this.toBeHistoryDialog = true;
        },

        /** 과거 To-Be 버전을 캔버스에 읽기 전용으로 미리본다. */
        previewToBeVersion(ver) {
            const xml = this.normalizeBpmnText(ver?.xml);
            if (!xml) return;
            this.previewingToBeVersion = toSafeText(ver.version);
            this.toBeBlueprintXml = xml;
            this.bpmnKey++;
            this.toBeHistoryDialog = false;
        },

        /** 미리보기를 종료하고 현재 저장본으로 복귀한다. */
        exitToBePreview() {
            if (!this.previewingToBeVersion) return;
            this.previewingToBeVersion = '';
            const current = this.normalizeBpmnText(this.processDefinition?.definition?.tobe_bpmn);
            this.toBeBlueprintXml = current || EMPTY_TOBE_BPMN_XML;
            this.bpmnKey++;
        },

        /** 선택한 To-Be 버전으로 되돌리기 — 실제 저장은 부모가 처리한다. */
        restoreToBeVersion(ver) {
            if (this.isViewMode) return;
            if (!ver?.xml) return;
            this.toBeHistoryDialog = false;
            this.$emit('restoreToBeVersion', { version: ver.version, xml: ver.xml });
        },

        /** 코파일럿 /tobe 가 생성한 To-Be BPMN 을 To-Be 캔버스에 적용. */
        async applyToBeBlueprint(xml) {
            if (this.isViewMode) {
                this.$toast?.warning('읽기 전용 상태에서는 To-Be 도면을 적용할 수 없습니다.');
                return false;
            }
            const normalized = this.normalizeBpmnText(xml);
            if (!normalized) {
                this.$toast?.warning('적용할 To-Be 도면이 없습니다.');
                return false;
            }
            // To-Be 모드로 전환 후(watcher 가 빈 도면을 채우기 전에) 생성 도면으로 덮어쓴다.
            if (this.activeMode !== 'to-be') {
                this.activeMode = 'to-be';
                await this.$nextTick();
            }
            this.toBeBlueprintXml = normalized;
            this.bpmnKey++;
            await this.persistToBeBpmn(normalized);
            this.$toast?.success('To-Be 도면을 캔버스에 적용했습니다.');
            return true;
        },

        onBpmnDone() {
            this.$nextTick(() => {
                const bpmnVue = this.$refs.bpmnVue;
                if (!bpmnVue) return;

                // ResizeObserver의 자동 orientation 변경을 항상 horizontal로 고정
                bpmnVue.onContainerResizeFinished = () => {
                    bpmnVue.initDefaultOrientation('horizontal');
                    if (bpmnVue.EventBus) {
                        bpmnVue.EventBus.emit('orientation-changed', { isHorizontal: true });
                    }
                    // 패널 열고 닫기 등 컨테이너 리사이즈 시 사용자가 맞춰둔 줌이 초기화되지 않도록 resetZoom 호출 제거
                };

                if (bpmnVue.initDefaultOrientation) {
                    bpmnVue.initDefaultOrientation('horizontal');
                }
                setTimeout(() => {
                    if (bpmnVue.resetZoom) {
                        bpmnVue.resetZoom();
                    }
                }, 500);

                // [2.3.3] Coordinate anchor - listen to viewbox changes
                const store2 = useBpmnStore();
                const modeler2 = store2.getModeler;
                if (modeler2) {
                    try {
                        const canvas2 = modeler2.get('canvas');
                        this._viewboxHandler = () => {
                            try {
                                const vb = canvas2.viewbox();
                                this.viewboxInfo = {
                                    x: Math.round(vb.x),
                                    y: Math.round(vb.y),
                                    zoom: Math.round((vb.scale || 1) * 100)
                                };
                            } catch (e) {
                                /* ignore */
                            }
                        };
                        canvas2.on('viewbox.changed', this._viewboxHandler);
                        // Initial read
                        this._viewboxHandler();
                    } catch (e) {
                        /* ignore */
                    }

                    // [2.3.1] Canvas auto-expand on content overflow
                    try {
                        const eventBus = modeler2.get('eventBus');
                        const checkCanvasExpand = () => {
                            if (this._expandDebounceTimer) clearTimeout(this._expandDebounceTimer);
                            this._expandDebounceTimer = setTimeout(() => {
                                this.checkAndExpandCanvas();
                            }, 300);
                        };
                        eventBus.on('commandStack.changed', checkCanvasExpand);
                    } catch (e) {
                        /* ignore */
                    }

                    // FR-001: CA 프로세스모듈 드릴인(plane 전환) 시 partition 그룹 오버레이 숨김.
                    //   드릴 plane root id 는 `${caId}_ca_plane` (CallActivityDrilldown PLANE_SUFFIX).
                    //   읽기전용 SVG 레이어(an-partition-blocks)만 display 토글 —
                    //   저장 데이터/틴트 마커 불변, base root 복귀 시 자동 복원.
                    try {
                        modeler2.get('eventBus').on('root.set', (evt) => {
                            const rootId = (evt && evt.element && evt.element.id) || '';
                            const onDrillPlane = /_ca_plane$/.test(rootId);
                            if (this._partitionLayer) {
                                try {
                                    this._partitionLayer.style.display = onDrillPlane ? 'none' : '';
                                } catch (_e) {
                                    /* ignore */
                                }
                            }
                        });
                    } catch (e) {
                        /* ignore */
                    }

                    // BPMN 최초 로드 시 1회 뱃지 렌더링 (이후는 속성 저장 시 부모가 명시적으로 호출)
                    setTimeout(() => {
                        this.refreshTaskMappingBadges();
                        this.$emit('bpmnLoaded');
                    }, 300);
                }
            });
        },

        checkAndExpandCanvas() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;
                const elementRegistry = modeler.get('elementRegistry');
                const allElements = elementRegistry.getAll();

                let maxY = 0;
                allElements.forEach((el) => {
                    if (el.y !== undefined && el.height !== undefined) {
                        const bottom = el.y + el.height;
                        if (bottom > maxY) maxY = bottom;
                    }
                });

                // Get container height
                const container = this.$el?.querySelector('.designer-canvas');
                if (!container) return;
                const containerHeight = container.clientHeight;

                // If content exceeds container, expand in 500px increments (max 5000px)
                if (maxY > containerHeight - 100) {
                    const needed = Math.ceil(maxY / 500) * 500 + 500;
                    this.canvasMinHeight = Math.min(needed, 5000);
                }
            } catch (e) {
                // ignore
            }
        },

        /** Task businessObject에서 uengine:Properties JSON을 파싱해 반환 */
        readTaskUengineProps(element) {
            try {
                const values = element?.businessObject?.extensionElements?.values || [];
                for (const ext of values) {
                    if (!ext?.json) continue;
                    if (ext.$type && ext.$type !== 'uengine:Properties') continue;
                    try {
                        return JSON.parse(ext.json) || {};
                    } catch {
                        return {};
                    }
                }
            } catch (e) {
                /* ignore */
            }
            return {};
        },

        /** 뱃지에 적용할 relatedProjects 개수와 system 매핑 여부 계산 */
        computeTaskMappingBadgeState(element) {
            const props = this.readTaskUengineProps(element);
            const relatedProjects = Array.isArray(props.relatedProjects) ? props.relatedProjects : [];
            const validProjects = relatedProjects.filter((p) => {
                if (!p) return false;
                if (typeof p === 'string') return !!p.trim();
                return !!(p.id || p.name);
            });
            const systems = Array.isArray(props.systems) ? props.systems : [];
            const hasSystem = systems.some((s) => {
                if (!s) return false;
                if (typeof s === 'string') return !!s.trim();
                return !!(s.id || s.name);
            });
            return {
                relatedProjectCount: validProjects.length,
                hasSystem
            };
        },

        /** 단일 Task 요소에 매핑 뱃지 DOM 생성 */
        createTaskMappingBadgeHtml(state) {
            const container = document.createElement('div');
            container.className = 'task-mapping-badge-group';
            container.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 4px;
                pointer-events: none;
                z-index: 50;
                width: auto;
                height: 18px;
                line-height: 0;
                white-space: nowrap;
                transform: translateX(-100%);
                box-sizing: border-box;
            `;

            if (state.hasSystem) {
                const systemBadge = document.createElement('div');
                systemBadge.className = 'task-mapping-badge task-mapping-badge--system';
                systemBadge.style.cssText = `
                    width: 18px;
                    height: 18px;
                    flex: 0 0 18px;
                    border-radius: 50%;
                    background: #1976d2;
                    opacity: 0.7;
                    box-sizing: border-box;
                `;
                systemBadge.title = '시스템 매핑됨';
                container.appendChild(systemBadge);
            }

            if (state.relatedProjectCount > 0) {
                const projectBadge = document.createElement('div');
                projectBadge.className = 'task-mapping-badge task-mapping-badge--project';
                projectBadge.style.cssText = `
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    border-radius: 9px;
                    background: #8e24aa;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1;
                    text-align: center;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    opacity: 0.7;
                    box-sizing: border-box;
                `;
                projectBadge.innerHTML = `<span style="display:inline-block;transform:translateY(-1px);">${state.relatedProjectCount}</span>`;
                projectBadge.title = `연관 과제 ${state.relatedProjectCount}건`;
                container.appendChild(projectBadge);
            }

            return container;
        },

        /** 기존 매핑 뱃지 오버레이 일괄 제거 */
        clearTaskMappingBadges() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;
                const overlays = modeler.get('overlays');
                try {
                    overlays.remove({ type: 'task-mapping-badge' });
                } catch (e) {
                    /* ignore */
                }
            } catch (e) {
                /* ignore */
            }
        },

        /** 모든 Task 요소를 순회하며 매핑 뱃지 갱신 */
        refreshTaskMappingBadges() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;
                const overlays = modeler.get('overlays');
                const elementRegistry = modeler.get('elementRegistry');

                this.clearTaskMappingBadges();

                const taskElements = elementRegistry.getAll().filter((el) => {
                    const type = el.type || '';
                    if (el.labelTarget) return false;
                    if (type === 'label') return false;
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                });

                const BADGE_RIGHT_INSET = 6;
                taskElements.forEach((element) => {
                    const state = this.computeTaskMappingBadgeState(element);
                    if (!state.hasSystem && state.relatedProjectCount === 0) return;
                    try {
                        const badgeHtml = this.createTaskMappingBadgeHtml(state);
                        const anchorLeft = (element.width || 100) - BADGE_RIGHT_INSET;
                        overlays.add(element.id, 'task-mapping-badge', {
                            position: { top: 4, left: anchorLeft },
                            html: badgeHtml
                        });
                    } catch (e) {
                        /* ignore */
                    }
                });
            } catch (e) {
                /* ignore */
            }
        },

        refreshCommentOverlays() {
            this.$refs.bpmnVue?.refreshCommentOverlays?.();
        },

        refreshRelatedProjectGroupOverlays() {
            this.$refs.bpmnVue?.refreshRelatedProjectGroupOverlays?.();
        },

        collectSchemaRequiredViolations(modelerInstance) {
            const store = useBpmnStore();
            const modeler = modelerInstance || store.getModeler;
            if (!modeler) return [];
            const catalogStore = useTaskCatalogStore();
            const schemasByAppliesTo = (target, elementType) => catalogStore.schemasByAppliesTo(target, elementType);
            return collectProcessRequiredViolations({
                modeler,
                processDefinition: this.processDefinition,
                processName: this.processName,
                schemasByAppliesTo
            });
        },

        clearValidationOverlays() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');

                // 타입 기반으로 모든 validation 오버레이 일괄 제거 (ID 추적 실패 방지)
                try {
                    overlays.remove({ type: 'validation-error' });
                } catch (e) {
                    /* ignore */
                }

                // 모든 요소에서 validation 마커 제거
                elementRegistry.getAll().forEach((el) => {
                    try {
                        canvas.removeMarker(el.id, 'validation-error-element');
                    } catch (e) {
                        /* ignore */
                    }
                    try {
                        canvas.removeMarker(el.id, 'validation-blink-error');
                    } catch (e) {
                        /* ignore */
                    }
                });

                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
            } catch (e) {
                // modeler가 아직 초기화되지 않은 경우
            }
        },

        clearValidation() {
            this.clearValidationOverlays();
            this.validationResults = [];
            this.validationDialog = false;
        },

        focusElement(elementId) {
            if (!elementId) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');
                const element = elementRegistry.get(elementId);
                if (element) {
                    // 해당 element로 뷰포트 이동
                    canvas.scrollToElement(element);
                    // 선택
                    const selection = modeler.get('selection');
                    if (selection) selection.select(element);
                }
            } catch (e) {
                // ignore
            }
        },

        /** blocks 의 표시 색 인덱스 — color_idx(고정색) 우선, 구버전 데이터는 배열 순서 폴백. */
        _partitionColorIdx(block, idx) {
            const n = PARTITION_BLOCK_COLORS.length;
            return Number.isInteger(block?.color_idx) && block.color_idx >= 0 ? block.color_idx % n : idx % n;
        },

        /** As-Is 파티셔닝 블록을 에디터 캔버스 위에 그룹 박스 + 멤버 틴트로 그린다. */
        renderPartitionBlocks(blocks) {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler || !Array.isArray(blocks)) return;
            this._lastPartitionBlocks = blocks;
            // 편집 중이면 오버레이 재드로우 대신 배정 맵·팔레트를 blocks 기준으로 재구성
            // (부모의 취소 원복·채팅 패널 편집이 캔버스에 반영되는 경로)
            if (this.partitionEditMode) {
                this._buildEditStateFromBlocks(blocks);
                this._renderLiveTints();
                this._refreshPaletteCounts();
                return;
            }
            this.hasPartitionOverlay = (blocks || []).some((b) => (b.element_ids || []).length > 0);
            this._attachPartitionFocusHandler();
            // FR-003: 그룹 보기 토글이 꺼져 있으면 오버레이를 그리지 않음(표시 전용, 저장 데이터 불변).
            if (!this.showPartitionGroups) {
                this.clearPartitionBlocks();
                return;
            }
            try {
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');
                this.clearPartitionBlocks();

                const SVG_NS = 'http://www.w3.org/2000/svg';
                // 기본 레이어 위(index 1)에 전용 레이어 — pointer-events: none 으로 편집 방해 없음
                const layer = canvas.getLayer('an-partition-blocks', 1);
                this._partitionLayer = layer;
                this._partitionTintMarks = [];
                // FR-001: CA 드릴인 plane 위에서 렌더되는 경우(지연 복원 등) 오버레이 숨김 유지
                try {
                    const rootId = canvas.getRootElement()?.id || '';
                    layer.style.display = /_ca_plane$/.test(rootId) ? 'none' : '';
                } catch (_e) {
                    /* ignore */
                }

                blocks.forEach((block, idx) => {
                    const ids = Array.isArray(block.element_ids) ? block.element_ids : [];
                    const els = ids.map((id) => elementRegistry.get(id)).filter((el) => el && typeof el.x === 'number');
                    if (!els.length) return;

                    const colorIdx = this._partitionColorIdx(block, idx);
                    const color = partitionColor(colorIdx);
                    const tintClass = `an-block-tint-${colorIdx}`;
                    ids.forEach((id) => {
                        if (!elementRegistry.get(id)) return;
                        try {
                            canvas.addMarker(id, tintClass);
                            this._partitionTintMarks.push({ id, cls: tintClass });
                        } catch (e) {
                            /* ignore */
                        }
                    });

                    let minX = Infinity;
                    let minY = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;
                    els.forEach((el) => {
                        minX = Math.min(minX, el.x);
                        minY = Math.min(minY, el.y);
                        maxX = Math.max(maxX, el.x + (el.width || 0));
                        maxY = Math.max(maxY, el.y + (el.height || 0));
                    });
                    const pad = 22;
                    const x = minX - pad;
                    const y = minY - pad;
                    const w = maxX - minX + pad * 2;
                    const h = maxY - minY + pad * 2;

                    const g = document.createElementNS(SVG_NS, 'g');
                    g.setAttribute('class', 'an-partition-box');
                    g.style.pointerEvents = 'none';

                    const rect = document.createElementNS(SVG_NS, 'rect');
                    rect.setAttribute('x', x);
                    rect.setAttribute('y', y);
                    rect.setAttribute('width', w);
                    rect.setAttribute('height', h);
                    rect.setAttribute('rx', '10');
                    rect.setAttribute('ry', '10');
                    rect.setAttribute('fill', color);
                    rect.setAttribute('fill-opacity', '0.05');
                    rect.setAttribute('stroke', color);
                    rect.setAttribute('stroke-width', '2');
                    rect.setAttribute('stroke-dasharray', '6 4');
                    g.appendChild(rect);

                    const label = (block.name || `Block ${idx + 1}`) + (block.etom_process_id ? `  ·  ${block.etom_process_id}` : '');
                    const labelWidth = Math.min(label.length * 7.6 + 18, Math.max(w, 80));
                    const bg = document.createElementNS(SVG_NS, 'rect');
                    bg.setAttribute('x', x + 6);
                    bg.setAttribute('y', y + 6);
                    bg.setAttribute('width', labelWidth);
                    bg.setAttribute('height', '21');
                    bg.setAttribute('rx', '5');
                    bg.setAttribute('fill', '#ffffff');
                    bg.setAttribute('fill-opacity', '0.92');
                    bg.setAttribute('stroke', color);
                    bg.setAttribute('stroke-opacity', '0.45');
                    g.appendChild(bg);

                    const text = document.createElementNS(SVG_NS, 'text');
                    text.setAttribute('x', x + 14);
                    text.setAttribute('y', y + 21);
                    text.setAttribute('fill', color);
                    text.setAttribute('font-size', '13');
                    text.setAttribute('font-weight', '700');
                    text.textContent = label;
                    g.appendChild(text);

                    // US5: 라벨 배지(bg+text)만 포인터 허용 — 더블클릭으로 편집 진입 (박스 rect 는 계속 통과)
                    [bg, text].forEach((n) => {
                        n.style.pointerEvents = 'auto';
                        n.style.cursor = 'pointer';
                        n.addEventListener('dblclick', (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            this.enterPartitionEditMode();
                        });
                    });

                    layer.appendChild(g);
                });
            } catch (e) {
                console.warn('[ProcessHierarchyDesigner] renderPartitionBlocks failed:', e);
            }
        },

        /** 그려둔 파티셔닝 박스/틴트를 모두 제거. */
        clearPartitionBlocks() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;
            try {
                const canvas = modeler.get('canvas');
                (this._partitionTintMarks || []).forEach(({ id, cls }) => {
                    try {
                        canvas.removeMarker(id, cls);
                    } catch (e) {
                        /* ignore */
                    }
                });
                this._partitionTintMarks = [];
                let layer = this._partitionLayer;
                if (!layer) {
                    try {
                        layer = canvas.getLayer('an-partition-blocks', 1);
                    } catch (e) {
                        layer = null;
                    }
                }
                if (layer) {
                    while (layer.firstChild) layer.removeChild(layer.firstChild);
                }
            } catch (e) {
                /* ignore */
            }
        },

        /* ===== As-Is 파티셔닝: 페인트 방식 그룹 편집 → Call Activity 변환 ===== */

        _partitionFlowNode(el) {
            const bo = el?.businessObject;
            try {
                if (bo && typeof bo.$instanceOf === 'function') {
                    return bo.$instanceOf('bpmn:FlowNode') && typeof el.x === 'number';
                }
            } catch (e) {
                /* fallthrough */
            }
            return typeof el?.x === 'number' && /Task$|Event$|Gateway$|CallActivity$|SubProcess$/.test(el?.type || '');
        },

        _partitionElementName(el) {
            const bo = el?.businessObject;
            return String(bo?.name || el?.id || '')
                .replace(/\s+/g, ' ')
                .trim();
        },

        /* ---- 편집 세션 구성/정리 ---- */

        /** blocks → 편집 세션 상태(_editBlocks/_editAssign) 구성. color_idx 미지정 블록은 즉석 배정. */
        _buildEditStateFromBlocks(blocks) {
            const modeler = useBpmnStore().getModeler;
            const registry = modeler ? modeler.get('elementRegistry') : null;
            const { partitions: colored } = ensurePartitionColors(blocks || []);
            this._editBlocks = colored.map((b) => ({
                id: b.id,
                name: b.name || '논리 블록',
                color_idx: b.color_idx,
                etom_process_id: b.etom_process_id
            }));
            this._editAssign = new Map();
            colored.forEach((b) => {
                (b.element_ids || []).forEach((elId) => {
                    if (this._editAssign.has(elId)) return; // 중복 배정은 첫 블록 우선
                    if (registry && !registry.get(elId)) return;
                    this._editAssign.set(elId, b.id);
                });
            });
        },

        /** 편집 세션 리스너/타이머/마커/상태 정리 — 편집 중이 아니어도 안전. */
        _teardownPartitionEditSession() {
            this._detachPaintListeners();
            if (this._membershipEmitTimer) {
                clearTimeout(this._membershipEmitTimer);
                this._membershipEmitTimer = null;
            }
            this._clearLiveTints();
            this._syncPaintCursor(false);
            this.closePartitionCtxMenu();
            this.activePaintBlockId = null;
            this._sweepActive = false;
            this._sweepMoved = false;
            this._sweepStartId = null;
            this._sweptIds = null;
            this._editBlocks = [];
            this._editAssign = new Map();
            this._editRemovedIds = new Set();
            this.paletteBlocks = [];
            this.unassignedCount = 0;
        },

        /** 페인트 편집 모드 진입 — 배정 맵 기반. 캔버스에 도형을 만들지 않는다. */
        enterPartitionEditMode() {
            if (this.partitionEditMode || this.isViewMode) return;
            if (this.activeMode !== 'as-is') {
                this.$toast?.warning('As-Is 편집 모드에서만 그룹을 편집할 수 있습니다.');
                return;
            }
            const blocks = this._lastPartitionBlocks || [];
            if (!blocks.length) {
                this.$toast?.warning('편집할 파티셔닝 블록이 없습니다. 먼저 /partition 을 실행하세요.');
                return;
            }
            const modeler = useBpmnStore().getModeler;
            if (!modeler) return;

            this.clearPartitionBlocks(); // 읽기전용 SVG 오버레이 제거
            this._buildEditStateFromBlocks(blocks);
            this._editRemovedIds = new Set();
            this.activePaintBlockId = null;
            this.partitionEditMode = true;
            this._attachPaintListeners();
            this._renderLiveTints();
            this._refreshPaletteCounts();
            this.$emit('partitionEditStarted');
            this.$toast?.info('팔레트에서 블록을 선택한 뒤 노드를 클릭/드래그해 배정하세요. 우클릭=블록 이동, 숫자키 1~8=블록 선택, Esc=취소');
        },

        /** 취소 — pending 변경은 버리고 부모에 원복 요청 (데이터 원복은 부모 스냅샷 책임). */
        cancelPartitionEdit() {
            if (!this.partitionEditMode) return;
            if (this._membershipEmitTimer) {
                clearTimeout(this._membershipEmitTimer);
                this._membershipEmitTimer = null;
            }
            this.exitPartitionEditMode();
            this.$emit('partitionEditCancelled');
        },

        /** 그룹 편집 종료 — 마커·리스너 정리만 하며 데이터는 건드리지 않는다. */
        exitPartitionEditMode() {
            this._teardownPartitionEditSession();
            this.partitionEditMode = false;
            // 종료 후 읽기전용 오버레이 복귀 (부모가 최신/원복 blocks 로 재호출하면 그 기준으로 다시 그림)
            this.$nextTick(() => this.renderPartitionBlocks(this._lastPartitionBlocks || []));
        },

        /* ---- 배정 조작 ---- */

        /** elementId 를 partitionId(null=미배정)로 배정하고 틴트·카운트·emit 을 갱신. */
        _setAssignment(elementId, partitionId) {
            if (!this._editAssign) this._editAssign = new Map();
            const prev = this._editAssign.get(elementId) || null;
            const next = partitionId || null;
            if (prev === next) return false;
            if (next) this._editAssign.set(elementId, next);
            else this._editAssign.delete(elementId);
            this._updateNodeTint(elementId);
            this._refreshPaletteCounts();
            this._scheduleMembershipEmit();
            this.$emit('partitionNodeFocus', { elementId, partitionId: next });
            return true;
        },

        /** 팔레트 칩 클릭 — 페인트 활성 블록 토글. */
        togglePaintBlock(blockId) {
            this.activePaintBlockId = this.activePaintBlockId === blockId ? null : blockId;
            this._syncPaintCursor(!!this.activePaintBlockId);
        },

        /** 팔레트 "+ 새 블록" — 미사용 최소 color_idx 배정 후 즉시 활성화. */
        addPartitionBlock() {
            const { partitions } = ensurePartitionColors([
                ...(this._editBlocks || []),
                { id: '__new__', name: '', tasks: [] }
            ]);
            const colorIdx = partitions[partitions.length - 1].color_idx;
            const id = `blk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const name = `블록 ${(this._editBlocks || []).length + 1}`;
            this._editBlocks = [...(this._editBlocks || []), { id, name, color_idx: colorIdx, etom_process_id: undefined }];
            this.activePaintBlockId = id;
            this._syncPaintCursor(true);
            this._refreshPaletteCounts();
            this.$emit('partitionBlockAdded', { id, name, color_idx: colorIdx });
        },

        /** 블록 삭제 — 멤버는 전원 미배정으로 전환, removedPartitionIds 로 부모에 영속. */
        removePaintBlock(blockId) {
            const block = (this._editBlocks || []).find((b) => b.id === blockId);
            if (!block) return;
            [...(this._editAssign || new Map()).entries()].forEach(([elId, pid]) => {
                if (pid === blockId) this._editAssign.delete(elId);
            });
            this._editBlocks = (this._editBlocks || []).filter((b) => b.id !== blockId);
            if (!this._editRemovedIds) this._editRemovedIds = new Set();
            this._editRemovedIds.add(blockId);
            if (this.activePaintBlockId === blockId) {
                this.activePaintBlockId = null;
                this._syncPaintCursor(false);
            }
            this._renderLiveTints();
            this._refreshPaletteCounts();
            this._scheduleMembershipEmit();
        },

        openPartitionCtxMenu(evt, element) {
            this.partitionCtxMenu = {
                show: true,
                x: Math.min(evt.clientX, window.innerWidth - 240),
                y: Math.min(evt.clientY, window.innerHeight - 320),
                elementId: element.id,
                elementName: this._partitionElementName(element) || element.id,
                currentBlockId: this._editAssign?.get(element.id) || null
            };
        },

        closePartitionCtxMenu() {
            if (this.partitionCtxMenu?.show) this.partitionCtxMenu = { ...this.partitionCtxMenu, show: false };
        },

        assignFromCtxMenu(blockId) {
            const elId = this.partitionCtxMenu?.elementId;
            this.closePartitionCtxMenu();
            if (!elId) return;
            this._setAssignment(elId, blockId);
        },

        /* ---- 라이브 시각화 (US1) ---- */

        _tintClassFor(elementId) {
            const pid = this._editAssign?.get(elementId);
            const block = pid ? (this._editBlocks || []).find((b) => b.id === pid) : null;
            if (!block) return 'an-node-unassigned';
            return `an-block-tint-${block.color_idx % PARTITION_BLOCK_COLORS.length}`;
        },

        /** 노드 1개의 틴트 마커를 배정 상태에 맞게 교체 (변경분만 remove/add). */
        _updateNodeTint(elementId) {
            const modeler = useBpmnStore().getModeler;
            if (!modeler) return;
            const canvas = modeler.get('canvas');
            if (!this._editTintByElement) this._editTintByElement = new Map();
            const desired = this._tintClassFor(elementId);
            const current = this._editTintByElement.get(elementId);
            if (current === desired) return;
            try {
                if (current) canvas.removeMarker(elementId, current);
                canvas.addMarker(elementId, desired);
                this._editTintByElement.set(elementId, desired);
            } catch (e) {
                /* ignore */
            }
        },

        /** 편집 배정 상태 → 전체 플로우 노드 틴트 렌더 (멤버=블록 색, 미배정=회색 점선). */
        _renderLiveTints() {
            const modeler = useBpmnStore().getModeler;
            if (!modeler || !this.partitionEditMode) return;
            try {
                modeler
                    .get('elementRegistry')
                    .filter((el) => this._partitionFlowNode(el))
                    .forEach((el) => this._updateNodeTint(el.id));
            } catch (e) {
                /* ignore */
            }
        },

        _clearLiveTints() {
            const modeler = useBpmnStore().getModeler;
            if (modeler && this._editTintByElement) {
                const canvas = modeler.get('canvas');
                this._editTintByElement.forEach((cls, id) => {
                    try {
                        canvas.removeMarker(id, cls);
                    } catch (e) {
                        /* ignore */
                    }
                });
            }
            this._editTintByElement = new Map();
        },

        /** 팔레트 칩(블록별 카운트)·미배정 카운트 재계산 — 배정 변경 즉시 호출. */
        _refreshPaletteCounts() {
            const counts = new Map();
            (this._editAssign || new Map()).forEach((pid) => counts.set(pid, (counts.get(pid) || 0) + 1));
            this.paletteBlocks = (this._editBlocks || []).map((b) => ({
                id: b.id,
                name: b.name,
                color_idx: b.color_idx,
                color: partitionColor(b.color_idx),
                count: counts.get(b.id) || 0
            }));
            let total = 0;
            const modeler = useBpmnStore().getModeler;
            if (modeler) {
                try {
                    total = modeler.get('elementRegistry').filter((el) => this._partitionFlowNode(el)).length;
                } catch (e) {
                    total = 0;
                }
            }
            this.unassignedCount = Math.max(0, total - (this._editAssign?.size || 0));
        },

        /** 페인트 활성 중 캔버스 커서를 crosshair 로. */
        _syncPaintCursor(active) {
            try {
                const container = useBpmnStore().getModeler?.get('canvas')?.getContainer?.();
                if (container) container.classList.toggle('an-paint-active', !!active);
            } catch (e) {
                /* ignore */
            }
        },

        /* ---- 페인트 입력 (US3, R2: 캡처 단계 DOM 리스너) ---- */

        _attachPaintListeners() {
            this._detachPaintListeners();
            const container = useBpmnStore().getModeler?.get('canvas')?.getContainer?.();
            if (!container) return;
            this._paintContainer = container;
            this._onPaintMouseDownBound = (e) => this._onPaintMouseDown(e);
            this._onPaintMouseMoveBound = (e) => this._onPaintMouseMove(e);
            this._onPaintMouseUpBound = (e) => this._onPaintMouseUp(e);
            this._onPaintContextMenuBound = (e) => this._onPaintContextMenu(e);
            this._onPartitionKeydownBound = (e) => this._onPartitionKeydown(e);
            container.addEventListener('mousedown', this._onPaintMouseDownBound, true);
            container.addEventListener('mousemove', this._onPaintMouseMoveBound, true);
            window.addEventListener('mouseup', this._onPaintMouseUpBound, true);
            container.addEventListener('contextmenu', this._onPaintContextMenuBound, true);
            window.addEventListener('keydown', this._onPartitionKeydownBound, true);
        },

        _detachPaintListeners() {
            const container = this._paintContainer;
            if (container) {
                if (this._onPaintMouseDownBound) container.removeEventListener('mousedown', this._onPaintMouseDownBound, true);
                if (this._onPaintMouseMoveBound) container.removeEventListener('mousemove', this._onPaintMouseMoveBound, true);
                if (this._onPaintContextMenuBound) container.removeEventListener('contextmenu', this._onPaintContextMenuBound, true);
            }
            if (this._onPaintMouseUpBound) window.removeEventListener('mouseup', this._onPaintMouseUpBound, true);
            if (this._onPartitionKeydownBound) window.removeEventListener('keydown', this._onPartitionKeydownBound, true);
            this._paintContainer = null;
            this._onPaintMouseDownBound = null;
            this._onPaintMouseMoveBound = null;
            this._onPaintMouseUpBound = null;
            this._onPaintContextMenuBound = null;
            this._onPartitionKeydownBound = null;
        },

        /** 이벤트 target → 플로우 노드 요소 (아니면 null — 시퀀스 플로우·빈 캔버스 등). */
        _paintHitTest(e) {
            const gfx = e.target?.closest?.('[data-element-id]');
            if (!gfx) return null;
            const el = useBpmnStore().getModeler?.get('elementRegistry')?.get(gfx.getAttribute('data-element-id'));
            return el && this._partitionFlowNode(el) ? el : null;
        },

        /** R2: 활성 블록이 있을 때만 노드 mousedown 을 가로채 페인트 — 없으면 일반 편집(이동) 통과. */
        _onPaintMouseDown(e) {
            if (!this.partitionEditMode || e.button !== 0) return;
            this.closePartitionCtxMenu();
            const el = this._paintHitTest(e);
            if (!el) return; // 빈 캔버스·시퀀스 플로우 → 팬/줌 등 기본 동작 유지
            if (!this.activePaintBlockId) {
                // 비활성: 일반 편집 통과 + 채팅 패널 하이라이트 동기화만
                this.$emit('partitionNodeFocus', { elementId: el.id, partitionId: this._editAssign?.get(el.id) || null });
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this._sweepActive = true;
            this._sweepMoved = false;
            this._sweepStartId = el.id;
            this._sweptIds = new Set([el.id]);
        },

        /** 누른 채 이동 = 스윕 배정 (지나간 플로우 노드를 활성 블록으로, 토글 없음). */
        _onPaintMouseMove(e) {
            if (!this._sweepActive || !this.activePaintBlockId) return;
            const el = this._paintHitTest(e);
            if (!el || this._sweptIds.has(el.id)) return;
            if (!this._sweepMoved) {
                this._sweepMoved = true;
                this._setAssignment(this._sweepStartId, this.activePaintBlockId); // 시작 노드도 배정
            }
            this._sweptIds.add(el.id);
            this._setAssignment(el.id, this.activePaintBlockId);
        },

        _onPaintMouseUp() {
            if (!this._sweepActive) return;
            const wasClick = !this._sweepMoved;
            const startId = this._sweepStartId;
            this._sweepActive = false;
            this._sweepMoved = false;
            this._sweepStartId = null;
            this._sweptIds = null;
            if (wasClick && startId && this.activePaintBlockId) {
                // 클릭 = 토글: 이미 활성 블록 소속이면 미배정으로 해제
                const current = this._editAssign?.get(startId) || null;
                this._setAssignment(startId, current === this.activePaintBlockId ? null : this.activePaintBlockId);
            }
        },

        /** 우클릭 — 플로우 노드 위에서만 블록 이동 메뉴 (US3). */
        _onPaintContextMenu(e) {
            if (!this.partitionEditMode) return;
            const el = this._paintHitTest(e);
            if (!el) return;
            e.preventDefault();
            e.stopPropagation();
            this.openPartitionCtxMenu(e, el);
        },

        /** 숫자키 1~8 = 팔레트 순번 블록 활성 토글, Esc = 메뉴/다이얼로그 닫기 → 취소 (US5). */
        _onPartitionKeydown(e) {
            if (!this.partitionEditMode) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const block = this.paletteBlocks[Number(e.key) - 1];
                if (block) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.togglePaintBlock(block.id);
                }
                return;
            }
            if (e.key === 'Escape') {
                if (this.partitionCtxMenu.show) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closePartitionCtxMenu();
                    return;
                }
                // 미리보기 다이얼로그 등 Vuetify 오버레이가 열려 있으면 그쪽 Esc 처리에 양보
                if (document.querySelector('.v-overlay--active')) return;
                e.preventDefault();
                e.stopPropagation();
                this.cancelPartitionEdit();
            }
        },

        /* ---- 부모 연동 ---- */

        /** 배정 변경 → 기존 partitionMembershipChanged 계약으로 debounce emit (부모 병합·저장 재사용). */
        _scheduleMembershipEmit() {
            if (this._membershipEmitTimer) clearTimeout(this._membershipEmitTimer);
            this._membershipEmitTimer = setTimeout(() => {
                this._membershipEmitTimer = null;
                this._emitMembership();
            }, 300);
        },

        _emitMembership() {
            if (!this.partitionEditMode) return;
            const registry = useBpmnStore().getModeler?.get('elementRegistry');
            const byBlock = new Map((this._editBlocks || []).map((b) => [b.id, []]));
            (this._editAssign || new Map()).forEach((pid, elId) => {
                if (!byBlock.has(pid)) return;
                const el = registry ? registry.get(elId) : null;
                byBlock.get(pid).push({ id: elId, name: el ? this._partitionElementName(el) : elId });
            });
            const updates = (this._editBlocks || []).map((b) => ({ partitionId: b.id, members: byBlock.get(b.id) || [] }));
            this.$emit('partitionMembershipChanged', updates, [...(this._editRemovedIds || new Set())]);
        },

        /** 비편집 중 노드 클릭 → 소속 블록과 함께 partitionNodeFocus emit (채팅 카드 동기화, US4). */
        _attachPartitionFocusHandler() {
            if (this._partitionFocusHandler) return;
            const modeler = useBpmnStore().getModeler;
            if (!modeler) return;
            const handler = (e) => {
                if (this.partitionEditMode || !this.hasPartitionOverlay) return;
                const el = e?.element;
                if (!el || !this._partitionFlowNode(el)) return;
                const block = (this._lastPartitionBlocks || []).find((b) => (b.element_ids || []).includes(el.id));
                this.$emit('partitionNodeFocus', { elementId: el.id, partitionId: block?.id || null });
            };
            try {
                modeler.get('eventBus').on('element.click', handler);
                this._partitionFocusHandler = handler;
            } catch (e) {
                this._partitionFocusHandler = null;
            }
        },

        /** "변환 미리보기" — 최종 배정 flush 후 레지스트리 스냅샷으로 미리보기 계산 → 부모에 emit (US2). */
        requestCommitPreview() {
            if (!this.partitionEditMode) return;
            if (this._membershipEmitTimer) {
                clearTimeout(this._membershipEmitTimer);
                this._membershipEmitTimer = null;
                this._emitMembership();
            }
            const registry = useBpmnStore().getModeler?.get('elementRegistry');
            if (!registry) return;
            const nodes = registry
                .filter((el) => this._partitionFlowNode(el))
                .map((el) => ({ id: el.id, name: this._partitionElementName(el) || el.id }));
            const connections = registry
                .filter((el) => el.type === 'bpmn:SequenceFlow' && el.source && el.target)
                .map((el) => ({ id: el.id, sourceId: el.source.id, targetId: el.target.id }));
            const byBlock = new Map((this._editBlocks || []).map((b) => [b.id, []]));
            (this._editAssign || new Map()).forEach((pid, elId) => {
                if (byBlock.has(pid)) byBlock.get(pid).push(elId);
            });
            const partitions = (this._editBlocks || []).map((b) => ({
                id: b.id,
                name: b.name,
                color_idx: b.color_idx,
                etom_process_id: b.etom_process_id,
                tasks: [],
                element_ids: byBlock.get(b.id) || []
            }));
            this.$emit('partitionCommitPreviewRequested', computeCommitPreview(partitions, nodes, connections));
        },

        /**
         * 미리보기 다이얼로그에서 "변환 진행" 확정 후 부모가 호출하는 public 메서드.
         * 1) pending 멤버십 flush (부모 partitions 최신화)
         * 2) 편집 마커/리스너 정리 — 캔버스에 도형을 만들지 않으므로 XML 은 이미 깨끗
         * 3) 현재 As-Is XML 확보 → commitPartitionGroups emit (부모가 runModularization → 재배선)
         */
        async commitPartitionGroupsAsCallActivity() {
            if (!this.partitionEditMode || this.committingPartition) return;
            this.committingPartition = true;
            try {
                if (this._membershipEmitTimer) {
                    clearTimeout(this._membershipEmitTimer);
                    this._membershipEmitTimer = null;
                }
                this._emitMembership();
                await this.$nextTick();

                const modeler = useBpmnStore().getModeler;
                let cleanedXml = '';
                if (modeler) {
                    try {
                        const r = await modeler.saveXML({ format: true });
                        cleanedXml = r?.xml || '';
                    } catch (e) {
                        cleanedXml = '';
                    }
                }
                this.exitPartitionEditMode();

                // 부모에서 모듈화 실행 + To-Be 적용
                this.$emit('commitPartitionGroups', { cleanedXml });
            } finally {
                this.committingPartition = false;
            }
        },

        /** 한 블록(여러 element)의 영역에 맞춰 뷰포트를 Zoom·이동하고 멤버를 선택한다. */
        zoomToBlock(elementIds) {
            const ids = Array.isArray(elementIds) ? elementIds : [elementIds];
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler || !ids.length) return;
            try {
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');
                const selection = modeler.get('selection');
                const els = ids.map((id) => elementRegistry.get(id)).filter((el) => el && typeof el.x === 'number');
                if (!els.length) return;

                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                els.forEach((el) => {
                    minX = Math.min(minX, el.x);
                    minY = Math.min(minY, el.y);
                    maxX = Math.max(maxX, el.x + (el.width || 0));
                    maxY = Math.max(maxY, el.y + (el.height || 0));
                });
                const pad = 80;
                const region = { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
                const vb = canvas.viewbox();
                const outer = vb.outer || { width: vb.width, height: vb.height };
                let scale = Math.min(outer.width / region.width, outer.height / region.height);
                scale = Math.max(0.2, Math.min(scale, 1.4));
                const cx = region.x + region.width / 2;
                const cy = region.y + region.height / 2;
                const nw = outer.width / scale;
                const nh = outer.height / scale;
                canvas.viewbox({ x: cx - nw / 2, y: cy - nh / 2, width: nw, height: nh });

                try {
                    if (selection) selection.select(els);
                } catch (e) {
                    /* ignore */
                }
            } catch (e) {
                console.warn('[ProcessHierarchyDesigner] zoomToBlock failed:', e);
            }
        },

        createOverlayHtml(errors) {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 8px;
                background: #fff;
                border: 1px solid #ffcdd2;
                border-radius: 8px;
                padding: 8px 12px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.12);
                white-space: normal;
                word-break: break-word;
                pointer-events: auto;
                cursor: pointer;
                min-width: 140px;
                max-width: 320px;
                z-index: 100;
            `;

            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #f44336;
                margin-top: 2px;
                flex-shrink: 0;
            `;
            container.appendChild(dot);

            const content = document.createElement('div');

            const title = document.createElement('div');
            title.style.cssText = 'font-size: 12px; font-weight: 600; color: #f44336; line-height: 1.3;';
            title.textContent = this.$t('validation.validationError') || 'Validation Error';
            content.appendChild(title);

            // 각 에러 메시지 표시
            errors.forEach((err) => {
                const msg = document.createElement('div');
                msg.style.cssText = 'font-size: 11px; color: #666; line-height: 1.4; word-break: break-word; white-space: normal;';
                msg.textContent = err.shortMessage || err.message;
                content.appendChild(msg);
            });

            container.appendChild(content);
            return container;
        },

        collectLocalValidationResults(modeler, results) {
            try {
                const elementRegistry = modeler.get('elementRegistry');
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');
                // label 요소와 root 요소를 필터링하여 중복 오버레이 방지
                const allElements = elementRegistry.getAll().filter((el) => el.type !== 'label' && !el.labelTarget);

                let hasStartEvent = false;
                let hasEndEvent = false;

                // connections map 생성
                const connections = new Map();
                allElements.forEach((el) => {
                    if (el.id) {
                        connections.set(el.id, {
                            incoming: (el.incoming || []).map((c) => c.source?.id).filter(Boolean),
                            outgoing: (el.outgoing || []).map((c) => c.target?.id).filter(Boolean)
                        });
                    }
                });

                const processedIds = new Set();
                allElements.forEach((element) => {
                    // 같은 ID 중복 처리 방지
                    if (processedIds.has(element.id)) return;
                    processedIds.add(element.id);
                    const type = element.type;
                    if (type === 'bpmn:StartEvent') hasStartEvent = true;
                    if (type === 'bpmn:EndEvent') hasEndEvent = true;

                    const elementErrors = [];

                    // E003: 완전 고립 노드 (incoming + outgoing 모두 없음) → ERROR
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:StartEvent' && type !== 'bpmn:EndEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || (conn.incoming.length === 0 && conn.outgoing.length === 0)) {
                            elementErrors.push({
                                level: 'error',
                                message: this.$t('validation.isolatedNode') || 'Isolated node: no connections at all.',
                                shortMessage: this.$t('validation.isolated') || 'Isolated'
                            });
                        }
                    }

                    // E004: Dangling SequenceFlow
                    if (type === 'bpmn:SequenceFlow') {
                        const bo = element.businessObject;
                        if (!bo?.sourceRef || !bo?.targetRef) {
                            elementErrors.push({
                                level: 'error',
                                message: this.$t('validation.danglingFlow') || 'Dangling flow: missing source or target.',
                                shortMessage: this.$t('validation.dangling') || 'Dangling Flow'
                            });
                        }
                    }

                    // W001: 이름 없는 태스크
                    if (type?.includes('Task')) {
                        const name = element.businessObject?.name;
                        if (!name || !name.trim()) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.unnamedTask') || 'Task has no name.',
                                shortMessage: this.$t('validation.nameRequired') || 'Name Required'
                            });
                        }
                    }

                    // W002: 들어오는 연결 없음
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:StartEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || conn.incoming.length === 0) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noIncomingConnection') || 'No incoming connection.',
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing'
                            });
                        }
                    }

                    // W003: 나가는 연결 없음
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:EndEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || conn.outgoing.length === 0) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noOutgoingConnection') || 'No outgoing connection.',
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing'
                            });
                        }
                    }

                    // W004: 게이트웨이 분기 부족
                    if (type?.includes('Gateway')) {
                        const conn = connections.get(element.id);
                        if (conn) {
                            const isJoin = conn.incoming.length > 1;
                            const isSplit = conn.outgoing.length > 1;
                            if (!isJoin && !isSplit) {
                                elementErrors.push({
                                    level: 'warning',
                                    message: this.$t('validation.gatewayNeedsBranches') || 'Gateway needs at least 2 branches.',
                                    shortMessage: this.$t('validation.branchingRequired') || 'Branching Required'
                                });
                            }
                        }
                    }

                    // W005: 레인 담당자 없음
                    if (type === 'bpmn:Lane') {
                        // extension elements에서 실제 담당자/조직 할당 정보 확인
                        let hasAssignee = false;
                        try {
                            const extValues = element.businessObject?.extensionElements?.values || [];
                            for (const ext of extValues) {
                                if (!ext?.json) continue;
                                const props = JSON.parse(ext.json);
                                // ProcessHierarchyProperties에서 저장한 담당자/조직 (배열 또는 단건)
                                const la = props.laneAssignee;
                                const lo = props.laneOrganization;
                                if ((Array.isArray(la) ? la.length : la) || (Array.isArray(lo) ? lo.length : lo)) {
                                    hasAssignee = true;
                                    break;
                                }
                                // LanePanel에서 저장한 roleResolutionContext
                                const ctx = props.roleResolutionContext;
                                if (ctx && (ctx.endpoint || ctx.scope || ctx.group || ctx.organizationId)) {
                                    hasAssignee = true;
                                    break;
                                }
                            }
                        } catch (_) {
                            /* ignore */
                        }
                        if (!hasAssignee) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noLaneAssignee') || 'Lane has no assignee.',
                                shortMessage: this.$t('validation.assigneeRequired') || 'Assignee Required'
                            });
                        }
                    }

                    // W006: 게이트웨이 분기 조건 누락
                    // 검증버튼 클릭시 조건식 관련 내용(게이트웨이)
                    // if (type === 'bpmn:SequenceFlow') {
                    //     const source = element.source;
                    //     if (source?.type === 'bpmn:ExclusiveGateway' || source?.type === 'bpmn:InclusiveGateway') {
                    //         const isDefault = source.businessObject?.default?.id === element.id;
                    //         if (!isDefault) {
                    //             const condition = element.businessObject?.conditionExpression;
                    //             if (!condition) {
                    //                 elementErrors.push({
                    //                     level: 'warning',
                    //                     message: this.$t('validation.missingCondition') || 'Condition expression is missing.',
                    //                     shortMessage: this.$t('validation.conditionMissing') || 'Condition Missing'
                    //                 });
                    //                 // [4.4.5] Gateway 자체에 ⚠️ 뱃지 오버레이
                    //                 if (source && !processedIds.has('gateway-badge-' + source.id)) {
                    //                     processedIds.add('gateway-badge-' + source.id);
                    //                     try {
                    //                         const badgeHtml = document.createElement('div');
                    //                         badgeHtml.className = 'gateway-warning-badge';
                    //                         badgeHtml.textContent = '⚠️';
                    //                         badgeHtml.style.cssText = 'font-size:16px;cursor:pointer;';
                    //                         badgeHtml.title = this.$t('validation.missingCondition') || 'Condition expression is missing';
                    //                         const badgeId = overlays.add(source.id, 'validation-error', {
                    //                             position: { top: -8, right: -8 },
                    //                             html: badgeHtml
                    //                         });
                    //                         this.validationOverlayIds.push(badgeId);
                    //                     } catch (e) {
                    //                         /* ignore */
                    //                     }
                    //                 }
                    //             }
                    //         }
                    //     }
                    // }

                    // element에 에러가 있으면 오버레이 추가
                    if (elementErrors.length > 0) {
                        // 마커 추가 (빨간 테두리)
                        try {
                            canvas.addMarker(element.id, 'validation-error-element');
                            this.validationMarkerIds.push(element.id);
                        } catch (e) {
                            /* ignore */
                        }

                        // 오버레이 추가 (에러 메시지 말풍선)
                        try {
                            const overlayHtml = this.createOverlayHtml(elementErrors);
                            const overlayId = overlays.add(element.id, 'validation-error', {
                                position: {
                                    top: -12,
                                    left: (element.width || 100) + 8
                                },
                                html: overlayHtml
                            });
                            this.validationOverlayIds.push(overlayId);
                        } catch (e) {
                            console.warn('Failed to add overlay for', element.id, e);
                        }

                        // 결과 목록에 추가
                        elementErrors.forEach((err) => {
                            results.push({
                                ...err,
                                elementName: element.businessObject?.name || element.id,
                                elementId: element.id
                            });
                        });
                    }
                });

                // [4.4.4] 프로세스 레벨 에러 → Pool/Lane 붉은 점멸
                if (!hasStartEvent || !hasEndEvent) {
                    // Pool/Participant 요소에 점멸 마커 적용
                    const poolElements = allElements.filter((el) => el.type === 'bpmn:Participant' || el.type === 'bpmn:Process');
                    poolElements.forEach((pool) => {
                        try {
                            canvas.addMarker(pool.id, 'validation-blink-error');
                            this.validationMarkerIds.push(pool.id);
                        } catch (e) {
                            /* ignore */
                        }
                    });
                    // Lane 요소에도 점멸 마커 적용
                    const laneElements = allElements.filter((el) => el.type === 'bpmn:Lane');
                    laneElements.forEach((lane) => {
                        try {
                            canvas.addMarker(lane.id, 'validation-blink-error');
                            this.validationMarkerIds.push(lane.id);
                        } catch (e) {
                            /* ignore */
                        }
                    });
                }
                if (!hasStartEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noStartEvent') || 'No start event found.'
                    });
                }
                if (!hasEndEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noEndEvent') || 'No end event found.'
                    });
                }
            } catch (e) {
                console.error('Validation error:', e);
            }
        },

        // 백엔드 검증 리포트를 결과 목록 + 캔버스 마커/오버레이로 반영
        applyBackendValidationResults(backendItems, results) {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            results.push(...backendItems);
            if (!modeler) return;

            try {
                const elementRegistry = modeler.get('elementRegistry');
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');

                // 요소 단위 error → 빨간 테두리 마커 + 말풍선 오버레이
                const errorsByElement = new Map();
                backendItems.forEach((item) => {
                    if (item.level !== 'error' || !item.elementId) return;
                    if (!elementRegistry.get(item.elementId)) return;
                    if (!errorsByElement.has(item.elementId)) {
                        errorsByElement.set(item.elementId, []);
                    }
                    errorsByElement.get(item.elementId).push({
                        ...item,
                        // 오버레이가 줄바꿈으로 전체 메시지를 표시하므로 자르지 않음
                        shortMessage: item.message
                    });
                });
                errorsByElement.forEach((errors, elementId) => {
                    try {
                        canvas.addMarker(elementId, 'validation-error-element');
                        this.validationMarkerIds.push(elementId);
                    } catch (e) {
                        /* ignore */
                    }
                    try {
                        const element = elementRegistry.get(elementId);
                        const overlayId = overlays.add(elementId, 'validation-error', {
                            position: {
                                top: -12,
                                left: (element.width || 100) + 8
                            },
                            html: this.createOverlayHtml(errors)
                        });
                        this.validationOverlayIds.push(overlayId);
                    } catch (e) {
                        console.warn('Failed to add overlay for', elementId, e);
                    }
                });

                // [4.4.4] 모델 레벨 에러(Start/End 누락) → Pool/Lane 붉은 점멸
                const hasEventMissing = backendItems.some(
                    (item) => item.ruleId === 'bpmn.global.start_event_missing' || item.ruleId === 'bpmn.global.end_event_missing'
                );
                if (hasEventMissing) {
                    elementRegistry
                        .getAll()
                        .filter((el) => el.type === 'bpmn:Participant' || el.type === 'bpmn:Process' || el.type === 'bpmn:Lane')
                        .forEach((el) => {
                            try {
                                canvas.addMarker(el.id, 'validation-blink-error');
                                this.validationMarkerIds.push(el.id);
                            } catch (e) {
                                /* ignore */
                            }
                        });
                }
            } catch (e) {
                console.error('Validation overlay error:', e);
            }
        },

        async handleValidate() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            // 이전 오버레이 제거
            this.clearValidationOverlays();

            // 백엔드 통합 검증: BPMN Global 문법 + SKT BPMN 작성 가이드 + 속성필수값.
            // (publish 시에는 같은 API가 targetStatus=published 로 배포를 차단한다)
            // 호출 실패 시에만 기존 로컬 검증으로 대체한다.
            let backendItems = null;
            try {
                const { xml } = await modeler.saveXML({ format: true });
                const report = await validateBpmnModel({ bpmnXml: xml });
                backendItems = reportToConsoleItems(report);
            } catch (e) {
                console.warn('[ProcessHierarchyDesigner] 백엔드 BPMN 검증 호출 실패, 로컬 검증으로 대체:', e);
            }

            const results = [];
            if (backendItems) {
                this.applyBackendValidationResults(backendItems, results);
            } else {
                this.collectLocalValidationResults(modeler, results);
            }

            // 스키마 기반 필수 속성 검증 (테넌트 스키마 설정 — 백엔드 검증과 별개로 항상 수행)
            try {
                const schemaViolations = this.collectSchemaRequiredViolations(modeler);
                if (schemaViolations.length > 0) {
                    schemaViolations.forEach((v) => {
                        const prefix = v.scope === 'process' ? '프로세스' : v.elementName;
                        results.push({
                            level: 'error',
                            message: `[${prefix}] ${v.propertyLabel} 항목은 필수 입력입니다.`,
                            shortMessage: '필수 입력 누락',
                            elementId: v.scope === 'task' ? v.elementId : '',
                            elementName: v.scope === 'task' ? v.elementName : prefix,
                            propertyKey: v.propertyKey
                        });
                    });
                }
            } catch (e) {
                console.error('Validation error:', e);
            }

            // [3.1.3] 검증 결과 emit (에러 레벨 포함)
            this.$emit('validationDone', results);

            if (results.length > 0) {
                this.validationResults = results;
                this.validationDialog = true;
            } else {
                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.validationPassed') || '검증 통과');
                }
            }
        }
    }
};
</script>

<style scoped>
.hierarchy-designer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
}

.designer-toolbar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 4px;
    padding: 6px 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #fafafa;
    flex-shrink: 0;
}

.toolbar-breadcrumb-row {
    min-width: 0;
}

.toolbar-main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
}

.mode-pill-track {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: #eef0f4;
    border-radius: 10px;
    padding: 3px;
    flex-shrink: 0;
    height: 32px;
}

.mode-pill-track--two {
    grid-template-columns: repeat(2, 1fr);
}

.mode-pill-track--three {
    grid-template-columns: repeat(3, 1fr);
}

.mode-pill-slider {
    position: absolute;
    top: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 7px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
}

.mode-pill-item {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    white-space: nowrap;
    transition: color 0.2s ease;
    padding: 0 10px;
    line-height: 1;
}

.mode-pill-item--active {
    color: #1e293b;
    font-weight: 600;
}

.mode-pill-item--disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.mode-pill-item:not(.mode-pill-item--disabled):not(.mode-pill-item--active):hover {
    color: #475569;
}

.toolbar-actions-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
}

.toolbar-left {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

.toolbar-title-group {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

.toolbar-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
}

.toolbar-breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    min-width: 0;
    white-space: nowrap;
    color: rgba(60, 60, 67, 0.7);
    font-size: 12px;
    scrollbar-width: thin;
}

.toolbar-breadcrumb__item {
    flex: 0 0 auto;
    white-space: nowrap;
}

.process-name {
    font-size: 14px;
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.toolbar-defid {
    font-family: Menlo, Consolas, 'D2Coding', monospace;
    font-size: 11px;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 4px;
    padding: 1px 6px;
    cursor: pointer;
    flex: 0 1 auto;
    min-width: 0;
    /* UUID(36자) 전체가 잘리지 않도록 */
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
}

.designer-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.designer-exec-pane {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.recovery-backup-alert {
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    min-height: 0;
    width: auto;
    max-width: 90%;
    padding-inline-end: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.recovery-backup-alert :deep(.v-alert__content) {
    padding: 0;
}

.recovery-backup-alert :deep(.v-alert__close) {
    align-self: center;
    margin-top: 0;
}

.recovery-backup-alert__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 36px;
    padding: 2px 0;
}

.recovery-backup-alert__text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    line-height: 1.35;
}

.recovery-backup-alert__timestamp {
    margin-left: 0;
    white-space: nowrap;
}

.recovery-backup-alert__action {
    flex-shrink: 0;
}

.lock-banner-floating {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 12;
    display: inline-flex;
    align-items: center;
    max-width: min(520px, calc(100% - 24px));
    padding: 6px 10px;
    border: 1px solid rgba(245, 158, 11, 0.28);
    border-radius: 999px;
    background: rgba(255, 248, 235, 0.95);
    color: #9a6700;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(4px);
}

.lock-banner-floating__text {
    font-size: 12px;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.designer-canvas__modeler {
    height: 100%;
}

.designer-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.xml-preview-shell {
    height: min(70vh, 720px);
}

.xml-preview-textarea {
    width: 100%;
    height: 100%;
    border: 1px solid #d7dee8;
    border-radius: 12px;
    padding: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    background: #f8fafc;
    color: #0f172a;
    box-sizing: border-box;
}

.xml-preview-textarea--readonly {
    background: #f8fafc;
    color: #475569;
}

.cursor-pointer {
    cursor: pointer;
}

/* 검증 결과 다이얼로그: 메시지가 잘리지 않고 전체가 보이도록 줄바꿈 허용 */
.validation-result-list :deep(.v-list-item-title),
.validation-result-list :deep(.v-list-item-subtitle) {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    -webkit-line-clamp: unset;
    line-height: 1.5;
}
.validation-result-list :deep(.v-list-item-subtitle) {
    opacity: 1;
}
.validation-result-list :deep(.v-list-item) {
    padding-top: 8px;
    padding-bottom: 8px;
}

.tobe-studio-fab {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 11;
    display: flex;
    align-items: center;
    gap: 8px;
}
.tobe-studio-fab--view {
    top: 16px;
    right: 92px;
}
.tobe-studio-fab .v-btn {
    box-shadow: 0 4px 14px rgba(147, 51, 234, 0.35);
}

/* As-Is 파티셔닝: 그룹 편집/변환 컨트롤 */
.partition-edit-fab {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 11;
    display: flex;
    align-items: center;
    gap: 8px;
}
.partition-edit-fab .v-btn {
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);
}
/* 파티션 편집 팔레트 (블록 칩 + 미배정 카운트) */
.partition-palette {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    max-width: 640px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 6px 8px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
}
.partition-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid var(--chip-color, #94a3b8);
    border-radius: 999px;
    background: #ffffff;
    color: #1e293b;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    padding: 4px 9px;
    cursor: pointer;
    user-select: none;
    transition: box-shadow 0.12s ease, background 0.12s ease;
}
.partition-chip:hover {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--chip-color, #94a3b8) 25%, transparent);
}
.partition-chip--active {
    background: var(--chip-color, #4f46e5);
    color: #ffffff;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--chip-color, #4f46e5) 35%, transparent);
}
.partition-chip__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--chip-color, #94a3b8);
    flex: 0 0 auto;
}
.partition-chip--active .partition-chip__dot {
    background: #ffffff;
}
.partition-chip__name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.partition-chip__count {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.75;
}
.partition-chip__remove {
    display: none;
    margin-left: 2px;
    font-size: 13px;
    line-height: 1;
    opacity: 0.6;
}
.partition-chip:hover .partition-chip__remove {
    display: inline;
}
.partition-chip__remove:hover {
    opacity: 1;
    color: #dc2626;
}
.partition-chip--active .partition-chip__remove:hover {
    color: #fecaca;
}
.partition-chip--add {
    border-style: dashed;
    border-color: #94a3b8;
    color: #475569;
}
.partition-chip--unassigned {
    border-color: #cbd5e1;
    color: #64748b;
    cursor: default;
}
.partition-chip--warn {
    border-color: #f59e0b;
    background: #fffbeb;
    color: #b45309;
}

/* 파티션 편집: 노드 우클릭 블록 이동 메뉴 */
.partition-ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2999;
}
.partition-ctx-menu {
    position: fixed;
    z-index: 3000;
    min-width: 190px;
    max-width: 260px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    padding: 4px;
}
.partition-ctx-menu__title {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    padding: 6px 10px 4px;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.partition-ctx-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    font-size: 12.5px;
    color: #1e293b;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
}
.partition-ctx-menu__item:hover {
    background: #f1f5f9;
}
.partition-ctx-menu__item--current {
    font-weight: 700;
    background: #f8fafc;
}
.partition-ctx-menu__item--clear {
    color: #b91c1c;
    border-top: 1px solid #f1f5f9;
    margin-top: 2px;
}
.partition-ctx-menu__item:disabled {
    opacity: 0.4;
    cursor: default;
}

.coord-anchor {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-family: monospace;
    color: #666;
    z-index: 5;
    pointer-events: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* AI BPMN 생성 — 다중 입력 블록 (파일 / 링크 / 텍스트) */
.gen-input-block {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    border-radius: 8px;
    padding: 12px;
}
.gen-input-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.78);
}
.gen-url-row {
    width: 100%;
}
.gen-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.gen-chip {
    max-width: 100%;
}
.gen-chip :deep(.v-chip__content) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.gen-chip--url :deep(.v-chip__content) {
    word-break: break-all;
}

/* 스트리밍 실시간 토큰 미리보기 */
.gen-stream-preview {
    max-height: 160px;
    overflow-y: auto;
    margin: 0;
    padding: 8px 10px;
    background: rgba(var(--v-theme-on-surface), 0.04);
    border-radius: 6px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: rgba(var(--v-theme-on-surface), 0.65);
    white-space: pre-wrap;
    word-break: break-word;
}
/* 실시간 수신 중 타이핑 커서 */
.gen-stream-preview::after {
    content: '▌';
    color: rgb(var(--v-theme-primary));
    animation: gen-stream-caret 1s steps(2, start) infinite;
}
@keyframes gen-stream-caret {
    0%,
    50% {
        opacity: 1;
    }
    50.01%,
    100% {
        opacity: 0;
    }
}

/* AI BPMN 생성 결과 미리보기 */
.gen-result__answer {
    padding: 14px;
    border-radius: 12px;
    background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
    border: 1px solid #dbeafe;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.gen-result__text {
    font-size: 13px;
    line-height: 1.7;
    color: #1f2937;
}

.gen-result__xml {
    font-size: 11px;
    line-height: 1.5;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px;
    max-height: 200px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
}
</style>

<style>
/* 검증 에러 마커 - scoped가 아닌 global CSS (bpmn-js DOM에 적용) */
.validation-error-element .djs-visual > :nth-child(1) {
    stroke: #f44336 !important;
    stroke-width: 2.5px !important;
}
.validation-error-element .djs-outline {
    stroke: #f44336 !important;
    stroke-width: 1px !important;
    stroke-dasharray: 4 3;
}

/* [4.4.4] Pool/Lane 붉은 점멸 애니메이션 */
@keyframes validation-blink {
    0%,
    100% {
        stroke: #f44336;
        stroke-opacity: 1;
    }
    50% {
        stroke: #f44336;
        stroke-opacity: 0.2;
    }
}
.validation-blink-error .djs-visual > :nth-child(1) {
    animation: validation-blink 1.2s ease-in-out infinite !important;
    stroke: #f44336 !important;
    stroke-width: 2.5px !important;
}

/* As-Is 파티셔닝 블록 멤버 틴트 - scoped 아닌 global CSS (bpmn-js DOM 에 적용) */
.an-block-tint-0 .djs-visual > :nth-child(1) {
    fill: #5b6ee1 !important;
    fill-opacity: 0.14 !important;
    stroke: #5b6ee1 !important;
}
.an-block-tint-1 .djs-visual > :nth-child(1) {
    fill: #21a36b !important;
    fill-opacity: 0.14 !important;
    stroke: #21a36b !important;
}
.an-block-tint-2 .djs-visual > :nth-child(1) {
    fill: #e0762b !important;
    fill-opacity: 0.14 !important;
    stroke: #e0762b !important;
}
.an-block-tint-3 .djs-visual > :nth-child(1) {
    fill: #9b59b6 !important;
    fill-opacity: 0.14 !important;
    stroke: #9b59b6 !important;
}
.an-block-tint-4 .djs-visual > :nth-child(1) {
    fill: #c0397b !important;
    fill-opacity: 0.14 !important;
    stroke: #c0397b !important;
}
.an-block-tint-5 .djs-visual > :nth-child(1) {
    fill: #0e9aa7 !important;
    fill-opacity: 0.14 !important;
    stroke: #0e9aa7 !important;
}
.an-block-tint-6 .djs-visual > :nth-child(1) {
    fill: #b58900 !important;
    fill-opacity: 0.14 !important;
    stroke: #b58900 !important;
}
.an-block-tint-7 .djs-visual > :nth-child(1) {
    fill: #475569 !important;
    fill-opacity: 0.14 !important;
    stroke: #475569 !important;
}

/* 파티션 편집 중 미배정 노드 — 회색 + 점선 (US1) */
.an-node-unassigned .djs-visual > :nth-child(1) {
    fill: #f1f5f9 !important;
    fill-opacity: 0.55 !important;
    stroke: #94a3b8 !important;
    stroke-dasharray: 5 4 !important;
}

/* 페인트 활성 중 캔버스 커서 (US3) */
.an-paint-active,
.an-paint-active .djs-element,
.an-paint-active .djs-element * {
    cursor: crosshair !important;
}
</style>

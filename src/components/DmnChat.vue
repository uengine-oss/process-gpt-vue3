<template>
    <div style="background-color: rgba(255, 255, 255, 0); width: 100%">
        <!-- 좌우 분할 레이아웃 (/dmn/ 경로) -->
        <AppBaseCard v-if="isStandaloneMode">
            <template v-slot:leftpart>
                <!-- DMN Modeler -->
                <div class="d-flex flex-column h-100 bg-grey-lighten-4">
                    <DmnModeler
                        v-if="isShowDmnModeler"
                        ref="dmnModeler"
                        :dmn="dmnXml"
                        :isViewMode="viewMode === 'view'"
                        :key="dmnRenderKey"
                        @definition="onDmnDefinitionLoaded"
                        @error="onDmnError"
                        @shown="onDmnShown"
                    />
                    <div v-else class="d-flex align-center justify-center h-100 w-100">
                        <v-progress-circular color="primary" indeterminate></v-progress-circular>
                    </div>
                </div>
            </template>

            <template v-slot:rightpart>
                <div class="dmn-chat-right-section">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :chatInfo="chatInfo"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-title>
                            <!-- DMN Header -->
                            <div class="d-flex align-center bg-white border-b ga-2 pa-3 pt-0 pb-0">
                                <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName || 'New DMN Decision' }}</h6>
                                <v-spacer></v-spacer>
                                <div class="d-flex align-center ga-1">
                                    <v-btn icon size="small" variant="text" @click="openSaveDialog" :class="{ 'icon-heartbit': isChanged }">
                                        <v-icon size="small">mdi-content-save</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" @click="openHistoryDialog">
                                        <v-icon size="small">mdi-history</v-icon>
                                        <v-tooltip activator="parent">버전 이력</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" color="error" @click="openDeleteDialog">
                                        <v-icon size="small">mdi-delete</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>
                        </template>
                        <template #custom-input-tools>
                            <v-select
                                v-model="isInferenceMode"
                                :items="[
                                    { title: $t('dmn.creation'), value: false },
                                    { title: $t('dmn.inference'), value: true }
                                ]"
                                item-title="title"
                                item-value="value"
                                variant="outlined"
                                density="compact"
                                hide-details
                                rounded
                                class="mx-2 inference-mode-select"
                                :style="inferenceModeSelectStyle"
                            ></v-select>
                        </template>
                    </Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <div class="dmn-chat-mobile-section">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :chatInfo="chatInfo"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-title>
                            <!-- DMN Header -->
                            <div class="d-flex align-center bg-white border-b ga-2">
                                <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName || 'New DMN Decision' }}</h6>
                                <v-spacer></v-spacer>
                                <div class="d-flex align-center ga-1">
                                    <v-btn icon size="small" variant="text" @click="openSaveDialog" :class="{ 'icon-heartbit': isChanged }">
                                        <v-icon size="small">mdi-content-save</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" @click="openHistoryDialog">
                                        <v-icon size="small">mdi-history</v-icon>
                                        <v-tooltip activator="parent">버전 이력</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" color="error" @click="openDeleteDialog">
                                        <v-icon size="small">mdi-delete</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>
                        </template>
                        <template #custom-input-tools>
                            <v-select
                                v-model="isInferenceMode"
                                :items="[
                                    { title: $t('dmn.creation'), value: false },
                                    { title: $t('dmn.inference'), value: true }
                                ]"
                                item-title="title"
                                item-value="value"
                                variant="outlined"
                                density="compact"
                                hide-details
                                rounded
                                class="mx-2 inference-mode-select"
                                :style="inferenceModeSelectStyle"
                            ></v-select>
                        </template>
                    </Chat>
                </div>
            </template>
        </AppBaseCard>

        <!-- 통합 레이아웃 (기타 경로) -->
        <div v-else class="w-100 dmn-chat-container">
            <Chat
                :messages="messages"
                :userInfo="userInfo"
                :showScrollTopButton="true"
                :agentMessage="true"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @stopMessage="stopMessage"
            >
                <template #custom-content>
                    <!-- DMN Section -->
                    <div class="dmn-section-wrapper">
                        <div class="d-flex flex-column bg-grey-lighten-4 dmn-section">
                            <!-- DMN Header -->
                            <div class="d-flex align-center bg-white border-b ga-2 pa-3 pt-0 pb-0">
                                <h6 class="text-subtitle-1 font-weight-semibold">{{ dmnName ? dmnName : 'New DMN Decision' }}</h6>
                                <v-spacer></v-spacer>
                                <div class="d-flex align-center ga-1">
                                    <v-btn icon size="small" variant="text" @click="openSaveDialog" :class="{ 'icon-heartbit': isChanged }">
                                        <v-icon size="small">mdi-content-save</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.save') }}</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" @click="openHistoryDialog">
                                        <v-icon size="small">mdi-history</v-icon>
                                        <v-tooltip activator="parent">버전 이력</v-tooltip>
                                    </v-btn>
                                    <v-btn v-if="isLoadedDmn" icon size="small" variant="text" color="error" @click="openDeleteDialog">
                                        <v-icon size="small">mdi-delete</v-icon>
                                        <v-tooltip activator="parent">{{ $t('dmn.deleteDmn') }}</v-tooltip>
                                    </v-btn>
                                </div>
                            </div>

                            <!-- DMN Modeler -->
                            <div class="dmn-modeler-wrapper">
                                <DmnModeler
                                    v-if="isShowDmnModeler"
                                    ref="dmnModeler"
                                    :dmn="dmnXml"
                                    :isViewMode="viewMode === 'view'"
                                    :key="dmnRenderKey"
                                    @definition="onDmnDefinitionLoaded"
                                    @error="onDmnError"
                                    @shown="onDmnShown"
                                />
                                <div v-else class="d-flex align-center justify-center h-100 w-100">
                                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <template #custom-input-tools>
                    <v-select
                        v-model="isInferenceMode"
                        :items="[
                            { title: $t('dmn.creation'), value: false },
                            { title: $t('dmn.inference'), value: true }
                        ]"
                        item-title="title"
                        item-value="value"
                        variant="outlined"
                        density="compact"
                        hide-details
                        rounded
                        class="mx-2 inference-mode-select"
                        :style="inferenceModeSelectStyle"
                    ></v-select>
                </template>
            </Chat>
        </div>

        <v-dialog v-model="isOpenSaveDialog" max-width="400" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    <div>{{ isNewDmn ? $t('dmn.save') : $t('ProcessDefinitionVersionDialog.title2') }}</div>
                    <v-btn variant="text" density="compact" icon @click="closeSaveDialog">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4 pb-0">
                    <div v-if="isNewDmn">
                        <v-text-field
                            v-model="dmnNameToSave"
                            :label="$t('ProcessDefinitionVersionDialog.name')"
                            :rules="[(v) => !!v || 'DMN 이름을 입력하세요']"
                            required
                            class="pb-2"
                        ></v-text-field>
                    </div>

                    <!-- 버전 태그 선택 -->
                    <v-select
                        v-model="saveVersionTag"
                        :items="versionTagOptions"
                        :label="$t('ProcessDefinitionVersionDialog.versionTag')"
                        :messages="[versionFlowMessage]"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                    ></v-select>

                    <!-- 비오너 안내 -->
                    <v-alert
                        v-if="!isOwnerUser && !isNewDmn"
                        type="info"
                        variant="tonal"
                        density="compact"
                        class="mb-3"
                        icon="mdi-information-outline"
                    >
                        <div>v{{ saveCurrentVersion }} → <b>v{{ saveNewVersion }}</b> (마이너)으로 저장됩니다.</div>
                        <div class="text-caption mt-1" style="opacity:.7">메이저 업데이트는 담당자의 승인을 통한 병합으로만 가능합니다.</div>
                    </v-alert>

                    <!-- 병합 요청 체크박스 + PR 제목 (마이너일 때만) -->
                    <template v-if="!isNewDmn && saveVersionTag !== 'major'">
                        <v-checkbox
                            v-model="saveCreatePr"
                            label="병합 요청 생성"
                            hide-details
                            density="compact"
                            color="primary"
                            class="mt-0 mb-1"
                        />
                        <v-text-field
                            v-if="saveCreatePr"
                            v-model="savePrTitle"
                            label="병합 요청 제목"
                            density="compact"
                            variant="outlined"
                            hide-details="auto"
                            class="mb-2"
                            :placeholder="dmnNameToSave ? `[병합 요청] ${dmnNameToSave} 변경` : ''"
                        />
                    </template>

                    <v-textarea
                        v-model="saveMessage"
                        :label="$t('ProcessDefinitionVersionDialog.message')"
                        hide-details
                        auto-grows
                    ></v-textarea>
                </v-card-text>

                <!-- PR 성공 표시 -->
                <v-card-text v-if="savePrSuccess" class="pa-4 pt-2 text-center">
                    <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
                    <div class="text-body-1 mb-1">저장 및 병합 요청이 완료되었습니다.</div>
                    <div class="text-caption text-medium-emphasis">담당자가 승인하면 메이저 버전으로 업데이트됩니다.</div>
                </v-card-text>

                <v-card-actions class="d-flex justify-space-between align-center pa-4">
                    <v-spacer />
                    <template v-if="savePrSuccess">
                        <v-btn variant="text" @click="closeSaveDialog">닫기</v-btn>
                    </template>
                    <template v-else>
                        <v-alert v-if="savePrError" type="error" density="compact" class="mr-auto" closable @click:close="savePrError = ''">
                            {{ savePrError }}
                        </v-alert>
                        <v-btn
                            color="primary"
                            rounded
                            variant="flat"
                            :disabled="!isSaveFormValid || savePrSubmitting || (saveCreatePr && !savePrTitle.trim())"
                            :loading="savePrSubmitting"
                            @click="handleSaveDmn"
                        >
                            {{ $t('ProcessDefinitionVersionDialog.save') }}
                        </v-btn>
                    </template>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="isOpenDeleteDialog" max-width="500">
            <v-card class="pa-0">
                <v-row class="ma-0 pa-4 pb-0 align-center">
                    <v-card-title class="pa-0">
                        {{ $t('dmn.deleteDmnMessage') }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="isOpenDeleteDialog = false" class="ml-auto" variant="text" density="compact" icon>
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-row class="ma-0 pa-4">
                    <v-spacer></v-spacer>
                    <v-btn @click="deleteDmn" color="error" rounded variant="flat">
                        {{ $t('dmn.delete') }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>

        <!-- 버전 비교 (전체화면) -->
        <v-dialog v-model="isOpenHistoryDialog" fullscreen persistent transition="dialog-bottom-transition">
            <div v-if="isOpenHistoryDialog" class="dvc-page">
                <!-- Header -->
                <div class="dvc-header">
                    <div class="dvc-header-left">
                        <v-btn variant="text" size="small" @click="isOpenHistoryDialog = false">
                            <v-icon start>mdi-close</v-icon>
                            닫기
                        </v-btn>
                        <div class="dvc-header-divider"></div>
                        <v-icon class="mx-2" size="20" color="grey">mdi-swap-horizontal</v-icon>
                        <span class="text-subtitle-1 font-weight-bold">{{ dmnName }}</span>
                    </div>
                    <div class="dvc-header-right">
                        <v-btn v-if="historyIsOwner && historyCanMerge && historySelectedPr && historySelectedPr.status !== 'MERGED'"
                            variant="flat" size="small" color="deep-purple" :loading="historyMerging" @click="mergeHistoryPr">
                            <v-icon start size="14">mdi-source-merge</v-icon> 병합
                        </v-btn>
                    </div>
                </div>

                <div class="dvc-body">
                    <!-- Center: Two DMN Viewers -->
                    <div class="dvc-center">
                        <!-- Version A (신규) -->
                        <div class="dvc-vpanel">
                            <div class="dvc-vbar">
                                <div class="dvc-vbar-left">
                                    <span class="dvc-badge dvc-badge-new">버전 A (신규)</span>
                                    <v-select v-model="historySelectedA" :items="historyVersionItems" item-title="title" item-value="value"
                                        density="compact" variant="outlined" hide-details class="dvc-vselect ml-3"
                                        :disabled="historyVersions.length === 0" @update:model-value="loadHistoryVersionA" />
                                </div>
                                <div class="dvc-vbar-right text-caption text-medium-emphasis">
                                    <template v-if="historyVersionAData">
                                        <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                        {{ formatHistoryTime(historyVersionAData.timeStamp) }}
                                    </template>
                                </div>
                            </div>
                            <div class="dvc-canvas">
                                <DmnModeler v-if="historyVersionAXml" :key="'ha-' + historyViewerKeyA"
                                    :dmn="historyVersionAXml" :isViewMode="true" />
                                <div v-else class="dvc-empty">
                                    <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                    <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                                </div>
                            </div>
                        </div>

                        <v-divider />

                        <!-- Version B (이전) -->
                        <div class="dvc-vpanel">
                            <div class="dvc-vbar">
                                <div class="dvc-vbar-left">
                                    <span class="dvc-badge dvc-badge-old">버전 B (이전)</span>
                                    <v-select v-model="historySelectedB" :items="historyVersionItems" item-title="title" item-value="value"
                                        density="compact" variant="outlined" hide-details class="dvc-vselect ml-3"
                                        :disabled="historyVersions.length === 0" @update:model-value="loadHistoryVersionB" />
                                </div>
                                <div class="dvc-vbar-right text-caption text-medium-emphasis">
                                    <template v-if="historyVersionBData">
                                        <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                        {{ formatHistoryTime(historyVersionBData.timeStamp) }}
                                    </template>
                                </div>
                            </div>
                            <div class="dvc-canvas">
                                <DmnModeler v-if="historyVersionBXml" :key="'hb-' + historyViewerKeyB"
                                    :dmn="historyVersionBXml" :isViewMode="true" />
                                <div v-else class="dvc-empty">
                                    <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                    <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Panel: 3-Tab -->
                    <div class="dvc-right">
                        <div class="dmn-history-tabs">
                            <button :class="['dmn-history-tab', { 'dmn-history-tab--active': historyTab === 'changes' }]" @click="historyTab = 'changes'">
                                <v-icon size="16">mdi-format-list-bulleted</v-icon>
                                변경
                                <span v-if="historyDiffChanges.length > 0" class="dmn-history-tab-count">{{ historyDiffChanges.length }}</span>
                            </button>
                            <button :class="['dmn-history-tab', { 'dmn-history-tab--active': historyTab === 'pr' }]" @click="historyTab = 'pr'; historySelectedPr = null">
                                <v-icon size="16">mdi-source-merge</v-icon>
                                병합 요청
                                <span v-if="historyOpenPrCount > 0" class="dmn-history-tab-count">{{ historyOpenPrCount }}</span>
                            </button>
                            <button :class="['dmn-history-tab', { 'dmn-history-tab--active': historyTab === 'history' }]" @click="historyTab = 'history'">
                                <v-icon size="16">mdi-clock-outline</v-icon>
                                이력
                            </button>
                        </div>

                        <div class="dvc-rail-pane">
                            <!-- 변경 탭 -->
                            <div v-show="historyTab === 'changes'">
                                <div class="pa-4 pb-2">
                                    <div class="text-subtitle-2 font-weight-bold">DMN 비교</div>
                                    <div class="dvc-legend mt-2">
                                        <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-added"></span>추가됨</span>
                                        <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-modified"></span>변경됨</span>
                                        <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-removed"></span>삭제됨</span>
                                    </div>
                                </div>
                                <div v-if="historyDiffChanges.length > 0" class="dmn-pr-section-head px-4">변경 항목 · {{ historyDiffChanges.length }}건</div>
                                <div v-if="historyDiffChanges.length > 0" class="dvc-diff-list">
                                    <div v-for="(c, i) in historyDiffChanges" :key="i" class="dvc-diff-card">
                                        <span :class="['dvc-diff-bar', 'dvc-diff-bar-' + c.type]"></span>
                                        <div class="dvc-diff-content">
                                            <div class="dvc-diff-title">
                                                {{ c.name || c.id }}
                                                <span :class="['dvc-diff-tag', 'dvc-diff-tag-' + c.type]">
                                                    {{ c.type === 'added' ? '추가' : c.type === 'modified' ? '변경' : '삭제' }}
                                                </span>
                                            </div>
                                            <div v-if="c.description" class="dvc-diff-sub">{{ c.description }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div v-else-if="historyVersionAXml && historyVersionBXml" class="pa-6 text-center">
                                    <v-icon size="32" color="grey-lighten-1">mdi-check-circle-outline</v-icon>
                                    <div class="text-caption text-medium-emphasis mt-2">변경 사항이 없습니다</div>
                                </div>
                                <div v-else class="pa-6 text-center">
                                    <div class="text-caption text-medium-emphasis">두 버전을 선택하면 비교할 수 있습니다</div>
                                </div>
                            </div>

                            <!-- 병합 요청 탭 -->
                            <div v-show="historyTab === 'pr'">
                                <template v-if="historySelectedPr">
                                    <div class="dmn-pr-detail-back">
                                        <button class="dmn-pr-back-btn" @click="historySelectedPr = null">
                                            <v-icon size="14">mdi-arrow-left</v-icon> 목록으로
                                        </button>
                                        <span class="dmn-pr-detail-title text-truncate">{{ historySelectedPr.title }}</span>
                                    </div>
                                    <div class="dmn-pr-approval-section">
                                        <div class="dmn-pr-section-head">승인 현황</div>
                                        <div v-if="historyOwnerName" class="dmn-pr-reviewer-row">
                                            <v-avatar size="22" :color="getAvatarColor(historyOwnerName)">
                                                <span class="text-white" style="font-size: 10px">{{ getInitial(historyOwnerName) }}</span>
                                            </v-avatar>
                                            <span class="dmn-pr-reviewer-name">{{ historyOwnerName }}</span>
                                            <span class="dmn-pr-role-chip">담당자</span>
                                            <span :class="['dmn-pr-status-chip', historyLatestOwnerAction === 'APPROVED' ? 'st-ok' : historyLatestOwnerAction === 'CHANGES_REQUESTED' ? 'st-req' : 'st-pend']">
                                                {{ historyLatestOwnerAction === 'APPROVED' ? '승인함' : historyLatestOwnerAction === 'CHANGES_REQUESTED' ? '변경요청' : '검토 중' }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="dmn-pr-section-head px-4">코멘트 · {{ historyPrReviews.length }}건</div>
                                    <PrReviewTimeline :reviews="historyPrReviews" />
                                    <PrReviewForm
                                        v-if="historySelectedPr.status === 'OPEN' || historySelectedPr.status === 'APPROVED' || historySelectedPr.status === 'CHANGES_REQUESTED'"
                                        :is-owner="historyIsOwner && historyLatestOwnerAction === 'PENDING'"
                                        :loading="historyReviewSubmitting" @submit="handleHistoryReviewSubmit" />
                                </template>
                                <template v-else>
                                    <div v-if="historyPrList.length === 0" class="pa-6 text-center">
                                        <v-icon size="32" color="grey-lighten-1">mdi-source-merge</v-icon>
                                        <div class="text-caption text-medium-emphasis mt-2">병합 요청이 없습니다</div>
                                    </div>
                                    <template v-else>
                                        <template v-if="historyActivePrList.length > 0">
                                            <div class="dmn-pr-list-head">활성 · {{ historyActivePrList.length }}건</div>
                                            <div v-for="pr in historyActivePrList" :key="pr.id" class="dmn-prc" @click="openHistoryPrDetail(pr)">
                                                <span :class="['dmn-pr-accent', prAccentClass(pr.status)]"></span>
                                                <span class="dmn-pr-ava" :style="{ background: getAvatarColor(pr.requester_name) }">{{ getInitial(pr.requester_name) }}</span>
                                                <div class="dmn-prc-body">
                                                    <div class="dmn-prc-title">{{ pr.title }} <span :class="['dmn-st-badge', prBadgeClass(pr.status)]">{{ prStatusLabelFn(pr.status) }}</span></div>
                                                    <div class="dmn-prc-byline"><b>{{ pr.requester_name || '알 수 없음' }}</b><span class="dmn-dot-sep">·</span><span>{{ formatHistoryRelativeTime(pr.created_at) }}</span></div>
                                                    <div class="dmn-prc-branchline"><code class="dmn-branch-chip">{{ pr.branch_name }}</code><v-icon size="10" class="mx-1 text-grey">mdi-arrow-right</v-icon><code class="dmn-branch-chip">{{ pr.base_branch }}</code></div>
                                                </div>
                                                <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
                                            </div>
                                        </template>
                                        <template v-if="historyMergedPrList.length > 0">
                                            <div class="dmn-pr-list-head">병합됨 · {{ historyMergedPrList.length }}건</div>
                                            <div v-for="pr in historyMergedPrList" :key="pr.id" class="dmn-prc dmn-prc-merged" @click="openHistoryPrDetail(pr)">
                                                <span class="dmn-pr-accent ac-merged"></span>
                                                <span class="dmn-pr-ava" :style="{ background: getAvatarColor(pr.requester_name), opacity: .7 }">{{ getInitial(pr.requester_name) }}</span>
                                                <div class="dmn-prc-body">
                                                    <div class="dmn-prc-title">{{ pr.title }} <span class="dmn-st-badge st-merged">병합됨</span></div>
                                                    <div class="dmn-prc-byline"><b>{{ pr.requester_name || '알 수 없음' }}</b><span class="dmn-dot-sep">·</span><span>{{ formatHistoryRelativeTime(pr.merged_at || pr.updated_at || pr.created_at) }}</span></div>
                                                </div>
                                                <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
                                            </div>
                                        </template>
                                    </template>
                                </template>
                            </div>

                            <!-- 이력 탭 -->
                            <div v-show="historyTab === 'history'">
                                <div v-for="(ver, idx) in historyVersions" :key="ver.version" class="dmn-history-row" :class="{ 'dmn-history-row--cur': idx === 0 }">
                                    <div class="dmn-history-badge">v{{ ver.version }}</div>
                                    <div class="dmn-history-meta">
                                        <div class="dmn-history-title">
                                            {{ ver.message || `v${ver.version}` }}
                                            <span v-if="idx === 0" class="dmn-history-cur-tag">현재</span>
                                            <span v-if="ver.version_tag === 'major'" class="dmn-history-major-chip">major</span>
                                        </div>
                                        <div class="dmn-history-sub">{{ formatHistoryTime(ver.timeStamp) }}</div>
                                    </div>
                                    <div class="dvc-history-actions">
                                        <button class="dvc-history-btn" @click="setHistoryVersionAs('A', ver.version)">A로</button>
                                        <button class="dvc-history-btn" @click="setHistoryVersionAs('B', ver.version)">B로</button>
                                    </div>
                                </div>
                                <div v-if="historyVersions.length === 0" class="text-center text-caption text-medium-emphasis pa-6">
                                    저장된 버전이 없습니다
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </v-dialog>
    </div>
</template>

<script>
import { useDmnStore } from '@/stores/dmn';

import Chat from './ui/Chat.vue';
import ChatModule from './ChatModule.vue';
import DmnModeler from './DmnModeler.vue';
import ChatGenerator from './ai/DmnGenerator.js';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrReviewForm from '@/components/pr/PrReviewForm.vue';
import {
    getInitial as _getInitial,
    getAvatarColor as _getAvatarColor,
    formatRelativeTime as _formatRelativeTime,
    prStatusLabel as _prStatusLabel,
    prBadgeClass as _prBadgeClass,
    prAccentClass as _prAccentClass
} from '@/composables/usePrUtils';

export default {
    mixins: [ChatModule],
    name: 'DmnChat',
    components: {
        Chat,
        DmnModeler,
        AppBaseCard,
        PrReviewTimeline,
        PrReviewForm
    },
    props: {
        ownerInfo: Object,
        dmnId: String
    },
    data() {
        return {
            chatInfo: {
                title: '',
                text: 'dmn.explanation'
            },

            dmnXml: null,
            dmnName: '',
            dmnRenderKey: 0,
            prevDmnOutput: '',

            isOpenSaveDialog: false,
            isOpenDeleteDialog: false,
            isShowDmnModeler: false,
            isLoadedDmn: false,
            isChanged: false,
            isAIUpdated: false,
            isInferenceMode: false,

            viewMode: 'edit',
            loadDmnId: '',
            dmnIdToSave: '',
            dmnNameToSave: '',

            dmnDefinition: null,
            isRoutedWithUnsaved: false,

            owner: '',

            // 버전 저장 다이얼로그
            isNewDmn: true,
            saveVersionTag: 'minor',
            saveCurrentVersion: '0.0',
            saveMessage: '',
            isOwnerUser: true,
            saveCreatePr: false,
            savePrTitle: '',
            savePrSubmitting: false,
            savePrSuccess: false,
            savePrError: '',

            // 버전 이력 다이얼로그
            isOpenHistoryDialog: false,
            historyTab: 'history',
            historyVersions: [],
            historyPrList: [],
            historySelectedPr: null,
            historyPrReviews: [],
            historyOwnerId: '',
            historyOwnerName: '',
            historyCurrentUserInfo: null,
            historyReviewSubmitting: false,
            historyMerging: false,

            // 버전 비교 뷰어
            historySelectedA: null,
            historySelectedB: null,
            historyVersionAData: null,
            historyVersionBData: null,
            historyVersionAXml: '',
            historyVersionBXml: '',
            historyViewerKeyA: 0,
            historyViewerKeyB: 0,
            historyDiffChanges: []
        };
    },
    async created() {
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        await this.init();

        // dmnId prop이 있으면 초기 로딩
        if (this.dmnId) {
            await this.loadData();
        }
        // 라우트 기반 모드 (/dmn/ 경로)
        else if (this.$route.params.pathMatch) {
            await this.loadData();
        }
        // 새 DMN 생성 모드
        else {
            this.isShowDmnModeler = true;
        }
    },
    watch: {
        saveVersionTag(newVal) {
            if (newVal === 'major') this.saveCreatePr = false;
        },
        dmnId: {
            handler(newVal, oldVal) {
                // 초기 로딩 시 (oldVal === undefined)는 created에서 처리하므로 스킵
                if (oldVal === undefined || oldVal === null) return;

                // 값이 실제로 변경되었을 때만 처리
                if (newVal !== oldVal) {
                    if (newVal) {
                        if (this.$refs.dmnModeler) {
                            if (this.isAIUpdated || this.isChanged) {
                                const answer = window.confirm(this.$t('changePath'));
                                if (answer) this.loadData();
                            } else {
                                this.loadData();
                            }
                        } else {
                            this.loadData();
                        }
                    } else {
                        // dmnId가 null이 되었을 때 (삭제 등)
                        this.loadDmnId = null;
                        this.dmnXml = null;
                        this.dmnName = null;
                        this.isLoadedDmn = false;
                        this.dmnRenderKey++;
                        this.messages = [];
                    }
                }
            }
        },
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (!newVal.path.startsWith('/dmn')) return;

                if (this.isRoutedWithUnsaved) {
                    this.isRoutedWithUnsaved = false;
                    return;
                }

                if (newVal.path !== oldVal.path) {
                    if (this.$refs.dmnModeler) {
                        if (this.isAIUpdated || this.isChanged) {
                            const answer = window.confirm(this.$t('changePath'));
                            if (answer) this.loadData();
                            else {
                                this.isRoutedWithUnsaved = true;
                                this.$router.push(oldVal.path);
                            }
                        } else {
                            this.loadData();
                        }
                    } else {
                        this.loadData();
                    }
                } else {
                    this.isShowDmnModeler = true;
                }
            }
        }
    },
    computed: {
        isSaveFormValid() {
            if (this.isNewDmn && !this.dmnNameToSave?.trim()) return false;
            return true;
        },
        isStandaloneMode() {
            return this.$route.path.startsWith('/dmn/');
        },
        inferenceModeSelectStyle() {
            const currentLocale = this.$i18n?.locale || 'ko';
            return {
                maxWidth: currentLocale === 'ko' ? '100px' : '150px'
            };
        },
        saveNewVersion() {
            const base = this.saveCurrentVersion || '0.0';
            let major = Math.floor(parseFloat(base)) || 0;
            let minor = base.toString().includes('.') ? Number(base.toString().split('.')[1]) || 0 : 0;
            if (this.saveVersionTag === 'major') {
                return `${major + 1}.0`;
            }
            return `${major}.${minor + 1}`;
        },
        versionFlowMessage() {
            const cur = this.saveCurrentVersion || '0.0';
            return `${this.$t('ProcessDefinitionVersionDialog.currentVersion')} : v${cur} -> ${this.$t('ProcessDefinitionVersionDialog.nextVersion')} : v${this.saveNewVersion}`;
        },
        versionTagOptions() {
            const minor = {
                title: this.$t('ProcessDefinitionVersionDialog.minor') + ' (' + this.$t('ProcessDefinitionVersionDialog.minorDesc') + ')',
                value: 'minor'
            };
            const major = {
                title: this.$t('ProcessDefinitionVersionDialog.major') + ' (' + this.$t('ProcessDefinitionVersionDialog.majorDesc') + ')',
                value: 'major'
            };
            if (!this.isOwnerUser && !this.isNewDmn) return [minor];
            return [minor, major];
        },
        historyVersionItems() {
            const items = [{ title: '현재 (최신)', value: '__current__' }];
            this.historyVersions.forEach(v => {
                items.push({ title: `v${v.version}${v.version_tag === 'major' ? ' (major)' : ''}`, value: v.version });
            });
            return items;
        },
        historyOpenPrCount() {
            return this.historyPrList.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED').length;
        },
        historyActivePrList() {
            return this.historyPrList.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED');
        },
        historyMergedPrList() {
            return this.historyPrList.filter(pr => pr.status === 'MERGED' || pr.status === 'CLOSED');
        },
        historyIsOwner() {
            if (!this.historyCurrentUserInfo || !this.historyOwnerId) return false;
            return this.historyCurrentUserInfo.uid === this.historyOwnerId;
        },
        historyLatestOwnerAction() {
            if (!this.historyPrReviews.length || !this.historyOwnerId) return 'PENDING';
            for (let i = this.historyPrReviews.length - 1; i >= 0; i--) {
                const r = this.historyPrReviews[i];
                if (r.reviewer_id === this.historyOwnerId && r.action !== 'COMMENT') return r.action;
            }
            return 'PENDING';
        },
        historyCanMerge() {
            return this.historyLatestOwnerAction === 'APPROVED' && this.historyIsOwner;
        }
    },
    methods: {
        async openSaveDialog() {
            this.dmnIdToSave = this.loadDmnId || '';
            this.dmnNameToSave = this.dmnName || '';
            this.saveVersionTag = 'minor';
            this.saveMessage = '';
            this.saveCreatePr = false;
            this.savePrTitle = '';
            this.savePrSuccess = false;
            this.savePrError = '';
            this.savePrSubmitting = false;
            this.isOwnerUser = true;
            this.saveCurrentVersion = '0.0';

            this.isNewDmn = !this.isLoadedDmn;

            if (this.isLoadedDmn && this.dmnIdToSave) {
                try {
                    const [definitionInfo, versionInfo] = await Promise.all([
                        this.backend.getRawDefinition(this.dmnIdToSave),
                        this.backend.getDefinitionVersions(this.dmnIdToSave, {
                            sort: 'desc',
                            orderBy: 'timeStamp',
                            size: 1
                        })
                    ]);
                    const defOwner = definitionInfo?.owner || '';
                    if (versionInfo && versionInfo.length > 0) {
                        this.saveCurrentVersion = versionInfo[0].version || '0.0';
                    }
                    // 오너 여부 판별
                    try {
                        const currentUser = this.userInfo || await this.backend.getUserInfo();
                        const currentUid = currentUser?.uid || '';
                        this.isOwnerUser = !defOwner || !currentUid || defOwner === currentUid;
                        if (!this.isOwnerUser) {
                            this.saveVersionTag = 'minor';
                        }
                    } catch (_) {
                        this.isOwnerUser = true;
                    }
                } catch (_) {
                    // 버전 정보 조회 실패 시 기본값 유지
                }
            }

            this.isOpenSaveDialog = true;
        },

        closeSaveDialog() {
            this.isOpenSaveDialog = false;
        },

        getInitial: _getInitial,
        getAvatarColor: _getAvatarColor,
        prStatusLabelFn: _prStatusLabel,
        prBadgeClass: _prBadgeClass,
        prAccentClass: _prAccentClass,

        formatHistoryTime(ts) {
            if (!ts) return '';
            try {
                return new Date(ts).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch { return ts; }
        },
        formatHistoryRelativeTime: _formatRelativeTime,

        async openHistoryDialog() {
            this.historyTab = 'changes';
            this.historyVersions = [];
            this.historyPrList = [];
            this.historySelectedPr = null;
            this.historyPrReviews = [];
            this.historyOwnerId = '';
            this.historyOwnerName = '';
            this.historyCurrentUserInfo = null;
            this.historySelectedA = null;
            this.historySelectedB = null;
            this.historyVersionAData = null;
            this.historyVersionBData = null;
            this.historyVersionAXml = '';
            this.historyVersionBXml = '';
            this.historyDiffChanges = [];
            this.isOpenHistoryDialog = true;

            const defId = this.loadDmnId;
            if (!defId) return;

            try {
                const [versionInfo, defInfo, userInfo] = await Promise.all([
                    this.backend.getDefinitionVersions(defId, { sort: 'desc', orderBy: 'timeStamp' }),
                    this.backend.getRawDefinition(defId),
                    this.backend.getUserInfo()
                ]);

                this.historyCurrentUserInfo = userInfo;

                if (versionInfo && versionInfo.length > 0) {
                    this.historyVersions = versionInfo.sort((a, b) => {
                        const [aM, am] = String(a.version).split('.').map(Number);
                        const [bM, bm] = String(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                    });
                    this.historySelectedA = '__current__';
                    if (this.historyVersions.length >= 1) {
                        this.historySelectedB = this.historyVersions[0].version;
                    }
                    await this.loadHistoryVersionA();
                    await this.loadHistoryVersionB();
                }

                const ownerId = defInfo?.owner || '';
                this.historyOwnerId = ownerId;
                if (ownerId) {
                    try {
                        const ownerUser = await this.backend.getUserById(ownerId);
                        this.historyOwnerName = ownerUser?.name || ownerUser?.username || ownerId;
                    } catch (_) {
                        this.historyOwnerName = ownerId;
                    }
                }

                try {
                    const allPrs = await this.backend.getResourcePrRecords('dmn', defId);
                    this.historyPrList = (allPrs || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                } catch (_) {
                    this.historyPrList = [];
                }
            } catch (e) {
                console.error('버전 이력 로드 실패:', e);
            }
        },

        async loadHistoryVersionA() {
            if (!this.historySelectedA) return;
            try {
                if (this.historySelectedA === '__current__') {
                    const def = await this.backend.getRawDefinition(this.loadDmnId);
                    this.historyVersionAXml = def?.bpmn || '';
                    this.historyVersionAData = { version: 'current', timeStamp: def?.updated_at || '' };
                } else {
                    const v = this.historyVersions.find(ver => String(ver.version) === String(this.historySelectedA));
                    if (v) {
                        this.historyVersionAXml = v.snapshot || '';
                        this.historyVersionAData = v;
                    }
                }
                this.historyViewerKeyA++;
                this.runHistoryDiff();
            } catch (e) { console.error('버전 A 로드 실패:', e); }
        },

        async loadHistoryVersionB() {
            if (!this.historySelectedB) return;
            try {
                if (this.historySelectedB === '__current__') {
                    const def = await this.backend.getRawDefinition(this.loadDmnId);
                    this.historyVersionBXml = def?.bpmn || '';
                    this.historyVersionBData = { version: 'current', timeStamp: def?.updated_at || '' };
                } else {
                    const v = this.historyVersions.find(ver => String(ver.version) === String(this.historySelectedB));
                    if (v) {
                        this.historyVersionBXml = v.snapshot || '';
                        this.historyVersionBData = v;
                    }
                }
                this.historyViewerKeyB++;
                this.runHistoryDiff();
            } catch (e) { console.error('버전 B 로드 실패:', e); }
        },

        setHistoryVersionAs(side, version) {
            if (side === 'A') { this.historySelectedA = version; this.loadHistoryVersionA(); }
            else { this.historySelectedB = version; this.loadHistoryVersionB(); }
        },

        runHistoryDiff() {
            if (!this.historyVersionAXml || !this.historyVersionBXml) {
                this.historyDiffChanges = [];
                return;
            }
            try {
                const parse = (xml) => {
                    const els = [];
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(xml, 'text/xml');
                    const DMN_NS = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
                    const tags = ['decision', 'decisionTable', 'input', 'output', 'rule', 'inputEntry', 'outputEntry',
                                  'inputExpression', 'informationRequirement', 'knowledgeRequirement', 'businessKnowledgeModel'];
                    tags.forEach(tag => {
                        const found = doc.getElementsByTagNameNS(DMN_NS, tag);
                        for (let i = 0; i < found.length; i++) {
                            const el = found[i];
                            const id = el.getAttribute('id') || `${tag}_${i}`;
                            const attrs = {};
                            for (let a = 0; a < el.attributes.length; a++) {
                                const at = el.attributes[a];
                                if (at.name !== 'id' && !at.name.startsWith('xmlns')) attrs[at.name] = at.value;
                            }
                            const textEl = el.getElementsByTagNameNS(DMN_NS, 'text')[0];
                            if (textEl) attrs.__text = textEl.textContent || '';
                            els.push({ id, name: el.getAttribute('name') || el.getAttribute('label') || '', tag, attrs });
                        }
                    });
                    return els;
                };
                const oldEls = parse(this.historyVersionBXml);
                const newEls = parse(this.historyVersionAXml);
                const oldMap = new Map(oldEls.map(e => [e.id, e]));
                const newMap = new Map(newEls.map(e => [e.id, e]));
                const changes = [];
                const fmtTag = (t) => {
                    const m = { decision: 'Decision', decisionTable: 'Decision Table', input: 'Input', output: 'Output',
                                 rule: 'Rule', inputEntry: 'Input Entry', outputEntry: 'Output Entry',
                                 inputExpression: 'Input Expression', informationRequirement: 'Information Requirement',
                                 knowledgeRequirement: 'Knowledge Requirement', businessKnowledgeModel: 'Business Knowledge Model' };
                    return m[t] || t;
                };
                for (const [id, el] of newMap) {
                    if (!oldMap.has(id)) {
                        changes.push({ type: 'added', id, name: el.name || id, description: `${fmtTag(el.tag)} 추가` });
                    }
                }
                for (const [id, el] of oldMap) {
                    if (!newMap.has(id)) {
                        changes.push({ type: 'removed', id, name: el.name || id, description: `${fmtTag(el.tag)} 삭제` });
                    }
                }
                for (const [id, nEl] of newMap) {
                    const oEl = oldMap.get(id);
                    if (!oEl) continue;
                    if (JSON.stringify(oEl.attrs) !== JSON.stringify(nEl.attrs)) {
                        const desc = oEl.name !== nEl.name ? `이름 변경: "${oEl.name}" → "${nEl.name}"` : `${fmtTag(nEl.tag)} 속성 변경`;
                        changes.push({ type: 'modified', id, name: nEl.name || oEl.name || id, description: desc });
                    }
                }
                this.historyDiffChanges = changes;
            } catch (e) {
                console.error('DMN diff 실패:', e);
                this.historyDiffChanges = [];
            }
        },

        async openHistoryPrDetail(pr) {
            this.historySelectedPr = pr;
            try {
                this.historyPrReviews = await this.backend.getResourcePrReviews(pr.id);
            } catch (_) {
                this.historyPrReviews = [];
            }
        },

        async handleHistoryReviewSubmit(action, comment) {
            if (!this.historySelectedPr) return;
            if (action !== 'COMMENT' && !this.historyIsOwner) return;

            this.historyReviewSubmitting = true;
            try {
                const u = this.historyCurrentUserInfo || await this.backend.getUserInfo();
                const name = u?.name || localStorage.getItem('userName') || '';

                await this.backend.addResourcePrReview(this.historySelectedPr.id, action, comment, u.uid, name);

                if (action === 'APPROVED') {
                    await this.backend.updateResourcePrStatus(this.historySelectedPr, 'APPROVED', { reviewerId: u.uid });
                    this.historySelectedPr.status = 'APPROVED';
                } else if (action === 'CHANGES_REQUESTED') {
                    await this.backend.updateResourcePrStatus(this.historySelectedPr, 'CHANGES_REQUESTED', { reviewerId: u.uid });
                    this.historySelectedPr.status = 'CHANGES_REQUESTED';
                }

                this.historyPrReviews = await this.backend.getResourcePrReviews(this.historySelectedPr.id);
            } catch (e) {
                console.error('리뷰 제출 실패:', e);
            } finally {
                this.historyReviewSubmitting = false;
            }
        },

        async mergeHistoryPr() {
            if (!this.historySelectedPr || !this.historyCanMerge) return;
            this.historyMerging = true;
            try {
                const u = this.historyCurrentUserInfo || await this.backend.getUserInfo();
                const defId = this.loadDmnId;

                const latestVersion = this.historyVersions.length > 0 ? this.historyVersions[0].version : '0.0';
                const majorNum = (parseInt(String(latestVersion).split('.')[0]) || 0) + 1;
                const newMajorVersion = `${majorNum}.0`;

                const currentDef = await this.backend.getRawDefinition(defId);
                if (currentDef?.bpmn && defId) {
                    await this.backend.putRawDefinition(currentDef.bpmn, defId, {
                        type: 'dmn',
                        name: this.dmnName,
                        version: newMajorVersion,
                        version_tag: 'major',
                        arcv_id: `${defId}_${newMajorVersion}`,
                        message: `[병합] ${this.historySelectedPr.title}`
                    });
                }

                await this.backend.updateResourcePrStatus(this.historySelectedPr, 'MERGED', {
                    reviewerId: u.uid,
                    mergedAt: new Date().toISOString()
                });

                this.historySelectedPr.status = 'MERGED';

                // 이력 새로고침
                const versionInfo = await this.backend.getDefinitionVersions(defId, { sort: 'desc', orderBy: 'timeStamp' });
                if (versionInfo && versionInfo.length > 0) {
                    this.historyVersions = versionInfo.sort((a, b) => {
                        const [aM, am] = String(a.version).split('.').map(Number);
                        const [bM, bm] = String(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                    });
                }
                const allPrs = await this.backend.getResourcePrRecords('dmn', defId);
                this.historyPrList = (allPrs || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } catch (e) {
                console.error('병합 실패:', e);
            } finally {
                this.historyMerging = false;
            }
        },

        openDeleteDialog() {
            this.isOpenDeleteDialog = true;
        },

        handleSaveDmn() {
            if (!this.isNewDmn && this.saveCreatePr) {
                this.saveWithPr();
            } else {
                this.beforeSaveDmn();
            }
        },

        async beforeSaveDmn() {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    const xml = await me.$refs.dmnModeler.saveDMN();

                    await me.saveDmn({
                        id: me.dmnIdToSave,
                        name: me.dmnNameToSave,
                        xml: xml,
                        version: me.saveNewVersion,
                        version_tag: me.saveVersionTag,
                        message: me.saveMessage
                    });

                    me.isAIUpdated = false;
                    me.isChanged = false;
                    me.isOpenSaveDialog = false;

                    if (me.$route.path === '/dmn/chat') {
                        await me.$router.push(`/dmn/${me.dmnIdToSave}`);
                    }
                },
                successMsg: this.$t('successMsg.save')
            });
        },

        async saveWithPr() {
            const me = this;
            if (!me.savePrTitle.trim()) return;
            me.savePrSubmitting = true;
            me.savePrError = '';
            try {
                const xml = await me.$refs.dmnModeler.saveDMN();
                await me.saveDmn({
                    id: me.dmnIdToSave,
                    name: me.dmnNameToSave,
                    xml: xml,
                    version: me.saveNewVersion,
                    version_tag: 'minor',
                    message: me.saveMessage
                });

                me.isAIUpdated = false;
                me.isChanged = false;

                const user = me.userInfo || await me.backend.getUserInfo();
                const majorNum = (parseInt(String(me.saveCurrentVersion).split('.')[0]) || 0) + 1;
                await me.backend.createResourcePrRecord('dmn', {
                    resourceId: me.dmnIdToSave,
                    branchName: `v${me.saveNewVersion}`,
                    baseBranch: `v${majorNum}.0`,
                    title: me.savePrTitle.trim(),
                    description: me.saveMessage || null,
                    requesterId: user.uid,
                    requesterName: user.name || localStorage.getItem('userName') || ''
                });

                me.savePrSuccess = true;

                if (me.$route.path === '/dmn/chat') {
                    await me.$router.push(`/dmn/${me.dmnIdToSave}`);
                }
            } catch (e) {
                me.savePrError = e?.message || String(e);
            } finally {
                me.savePrSubmitting = false;
            }
        },

        async saveDmn({ id, name, xml, version, version_tag, message }) {
            const putObj = {
                type: 'dmn',
                name: name
            };
            if (this.owner !== '') putObj.owner = this.owner;
            if (version) {
                putObj.version = version;
                putObj.version_tag = version_tag || 'minor';
                putObj.arcv_id = `${id}_${version}`;
                putObj.message = message || '';
            }
            await this.backend.putRawDefinition(xml, id, putObj);

            this.dmnName = name;
            this.loadDmnId = id;
            this.isLoadedDmn = true;

            this.EventBus.emit('dmn-saved', { id: id, name: name, owner: this.owner || null });
        },

        async loadData() {
            if (this.dmnId && this.dmnId !== 'chat') {
                this.loadDmnId = this.dmnId;
            } else {
                this.loadDmnId = this.$route.params.pathMatch ? this.$route.params.pathMatch.join('/') : 'chat';
            }

            // null 체크 추가
            if (this.loadDmnId && this.loadDmnId.startsWith('/')) {
                this.loadDmnId = this.loadDmnId.substring(1);
            }

            this.isLoadedDmn = this.loadDmnId && this.loadDmnId !== 'chat';
            this.isAIUpdated = false;
            this.messages = [];

            if (this.isLoadedDmn) {
                try {
                    const dmnData = await this.backend.getRawDefinition(this.loadDmnId);
                    this.dmnXml = dmnData.bpmn;
                    this.dmnName = dmnData.name;

                    this.dmnRenderKey++;
                    this.isShowDmnModeler = true;
                } catch (error) {
                    console.error('DMN 로드 실패:', error);
                    // AgentChat 내 임베디드 모드에서는 라우터 푸시하지 않음
                    if (this.$route.path.startsWith('/dmn/')) {
                        alert(`'${this.loadDmnId}' ID를 가지는 DMN 정보가 없습니다! 새 DMN 만들기 화면으로 이동됩니다.`);
                        this.$router.push('/dmn/chat');
                    } else {
                        // 임베디드 모드에서는 경고만 출력하고 새 DMN 화면으로
                        console.warn(`DMN '${this.loadDmnId}' 로드 실패. 새 DMN 생성 모드로 전환합니다.`);
                    }
                    // 새 DMN으로 전환
                    this.dmnXml = null;
                    this.dmnName = '';
                    this.loadDmnId = this.uuid();
                    this.isLoadedDmn = false;
                    this.isShowDmnModeler = true;
                }
            } else {
                // 새 DMN 생성 모드 - UUID로 ID 생성
                this.dmnXml = null;
                this.dmnName = '';
                this.loadDmnId = this.uuid();
                this.isShowDmnModeler = true;
                this.messages = [];
            }

            if (this.ownerInfo && this.ownerInfo.id) {
                this.owner = this.ownerInfo.id;
            }
        },

        beforeSendMessage(newMessage) {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    // DMN XML 수집 (추론 모드에서도 필요)
                    if (me.$refs.dmnModeler) {
                        me.prevDmnOutput = await me.$refs.dmnModeler.saveDMN();
                    }

                    newMessage.mentionedUsers = null;

                    // 모드에 따라 다른 처리
                    if (me.isInferenceMode) {
                        // 추론 모드: DMN XML을 컨텍스트로 제공
                        me.generator.isInferenceMode = true;

                        if (me.prevDmnOutput) {
                            me.generator.dmnXmlList = [
                                {
                                    id: me.loadDmnId || 'current_dmn',
                                    name: me.dmnName || 'Current DMN',
                                    xml: me.prevDmnOutput
                                }
                            ];
                        }

                        me.generator.sendInferenceMessage(newMessage);
                    } else {
                        // 생성 모드: DMN 생성/수정
                        me.generator.isInferenceMode = false;
                        me.generator.dmnXmlList = [];

                        if (me.prevDmnOutput) {
                            me.generator.sendMessageWithPrevDmnOutput(newMessage);
                        } else {
                            me.generator.sendMessage(newMessage);
                        }
                    }
                    newMessage.callType = 'chats';
                    me.sendMessage(newMessage);
                }
            });
        },

        afterModelCreated(response) {
            try {
                const messageWriting = this.messages[this.messages.length - 1];
                if (this.isInferenceMode) {
                    if (messageWriting) {
                        messageWriting.contentType = 'markdown';
                        messageWriting.content = response;
                    }
                    return;
                }
            } catch (parseError) {
                console.error('[DMN] JSON 파싱 실패:', parseError);
                return;
            }
        },

        afterGenerationFinished(response) {
            this.processResponse(response);
        },

        processResponse(response) {
            try {
                const messageWriting = this.messages[this.messages.length - 1];

                // 추론 모드: 마크다운 응답을 그대로 표시
                if (this.isInferenceMode) {
                    if (messageWriting) {
                        messageWriting.contentType = 'markdown';
                        messageWriting.content = response;
                    }
                    return;
                }

                // 생성 모드: JSON 파싱 및 DMN 업데이트
                let parsed;
                if (typeof response === 'object' && response.dmnXml) {
                    parsed = response;
                } else {
                    try {
                        const jsonContent = this.extractJSON(response);
                        parsed = JSON.parse(jsonContent);
                    } catch (parseError) {
                        console.error('[DMN] JSON 파싱 실패:', parseError);
                        if (messageWriting) {
                            messageWriting.content = 'AI 응답의 JSON 파싱에 실패했습니다.';
                        }
                        return;
                    }
                }

                // DMN XML 설정
                this.dmnXml = parsed.dmnXml;

                // XML 파싱 에러 체크만 수행 (id와 name은 읽지 않음)
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(this.dmnXml, 'text/xml');

                    // XML 파싱 에러 체크
                    const parserError = xmlDoc.querySelector('parsererror');
                    if (parserError) {
                        console.error('[DMN] XML 파싱 에러:', parserError.textContent);
                        if (messageWriting) {
                            messageWriting.content = 'DMN XML이 유효하지 않습니다. AI에게 다시 요청해주세요.';
                        }
                        return;
                    }

                    // 새 DMN 생성 시 - ID가 없으면 UUID 생성
                    if (!this.loadDmnId || this.loadDmnId === 'chat') {
                        this.loadDmnId = this.uuid();
                        const definitions = xmlDoc.getElementsByTagName('definitions')[0];
                        if (definitions) {
                            this.dmnName = definitions.getAttribute('name') || 'New DMN Decision';
                        }
                    }
                } catch (xmlError) {
                    console.error('[DMN] XML 처리 중 오류:', xmlError);
                }

                this.dmnRenderKey++;
                this.isAIUpdated = true;
                this.isChanged = true;

                // 메시지 내용 업데이트
                messageWriting.content = parsed.description;

                // 수정 내역이 있으면 표시
                if (parsed.modifications && parsed.modifications.length > 0) {
                    const modDesc = parsed.modifications.map((m) => `- ${m.description}`).join('\n');
                    messageWriting.content += '\n\n수정 내역:\n' + modDesc;
                }
            } catch (error) {
                console.error('[DMN] AI 응답 처리 중 오류 발생:', error);
                const messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting) {
                    messageWriting.content = 'AI 응답 처리 중 오류가 발생했습니다: ' + error.message;
                }
            }
        },

        afterModelStopped(response) {
            console.log('DMN 생성 중단:', response);
        },

        onDmnDefinitionLoaded(definition) {
            this.dmnDefinition = definition;

            // Store에 DMN 정의 저장
            const dmnStore = useDmnStore();
            dmnStore.setDecisionDefinition(definition);
        },

        onDmnError(error) {
            console.error('DMN Error:', error);
        },

        onDmnShown(warnings) {
            if (warnings && warnings.length > 0) {
                console.warn('DMN Warnings:', warnings);
            }
        },

        async deleteDmn() {
            const me = this;
            await this.backend.deleteDefinition(me.loadDmnId, { type: 'dmn' });
            me.$try({
                context: me,
                action: async () => {
                    me.isOpenDeleteDialog = false;
                    me.isAIUpdated = false;
                    me.isChanged = false;
                    if (me.$route.path.startsWith('/dmn/')) {
                        await me.$router.push('/dmn/chat');
                    } else {
                        me.EventBus.emit('dmn-deleted', { owner: me.owner || null });
                        me.loadDmnId = null;
                        me.loadData();
                    }
                },
                successMsg: this.$t('successMsg.delete')
            });
        }
    },

    async beforeRouteLeave(to, from, next) {
        if (!this.$refs.dmnModeler) return next();

        if (this.isAIUpdated || this.isChanged) {
            const answer = window.confirm(this.$t('changePath'));
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    }
};
</script>

<style scoped>
/* 통합 레이아웃 */
.dmn-chat-container {
    height: calc(100vh - 132px);
}

.dmn-section {
    overflow: hidden;
    background-color: white;
}

.dmn-modeler-wrapper :deep(.vue-dmn-diagram-container) {
    height: 100%;
}
/* 좌우 분할 레이아웃 (/dmn/ 경로) */
:deep(.left-part) {
    width: 75%;
    /* DMN Modeler 영역 */
}

.dmn-chat-right-section {
    height: 100%;
    overflow: auto;
}

.dmn-chat-mobile-section {
    height: 100%;
    overflow: auto;
}

.icon-heartbit {
    animation: icon-pulse 1.5s ease-in-out infinite;
    transform-origin: center;
}

@keyframes icon-pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

/* 반응형 레이아웃 */
@media (max-width: 768px) {
    .dmn-chat-container {
        height: calc(100vh - 40px);
    }
}

/* ── 버전 비교 전체화면 ── */
.dvc-page { display: flex; flex-direction: column; height: 100vh; background: #F4F6F9; overflow: hidden; }

.dvc-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #fff; border-bottom: 1px solid #E6E8EE; flex-shrink: 0; gap: 14px; }
.dvc-header-left { display: flex; align-items: center; min-width: 0; flex: 1; }
.dvc-header-divider { width: 1px; height: 22px; background: #D9DCE3; margin: 0 8px; }
.dvc-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.dvc-body { display: flex; flex: 1; overflow: hidden; }

.dvc-center { flex: 1; display: flex; flex-direction: column; min-width: 400px; overflow: hidden; border-right: 1px solid #E6E8EE; }
.dvc-vpanel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.dvc-vbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0; gap: 12px; }
.dvc-vbar-left { display: flex; align-items: center; min-width: 0; }
.dvc-vbar-right { display: flex; align-items: center; flex-shrink: 0; }
.dvc-badge { font-size: 12px; font-weight: 700; padding: 3px 11px; border-radius: 8px; white-space: nowrap; }
.dvc-badge-new { background: #EAF1FF; color: #1B4FCB; }
.dvc-badge-old { background: #F0EBFB; color: #5e45b8; }
.dvc-vselect { max-width: 180px; font-size: 13px; }
.dvc-vselect :deep(.v-field) { min-height: 32px !important; font-size: 13px; }
.dvc-vselect :deep(.v-field__input) { padding-top: 4px; padding-bottom: 4px; }
.dvc-canvas { flex: 1; position: relative; overflow: hidden; background: #fff; }
.dvc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }

.dvc-right { width: 360px; flex-shrink: 0; background: #FBFCFD; display: flex; flex-direction: column; overflow: hidden; }
.dvc-rail-pane { flex: 1; overflow-y: auto; }

/* diff */
.dvc-legend { display: flex; gap: 14px; font-size: 12px; }
.dvc-legend-item { display: flex; align-items: center; gap: 6px; color: #697084; }
.dvc-legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.dvc-dot-added { background: #22A05B; }
.dvc-dot-modified { background: #E0922B; }
.dvc-dot-removed { background: #E04848; }
.dvc-diff-list { flex: 1; overflow-y: auto; }
.dvc-diff-card { display: flex; gap: 10px; padding: 11px 14px; margin: 0 10px 7px; border: 1px solid #E6E8EE; border-radius: 11px; background: #fff; }
.dvc-diff-bar { width: 4px; border-radius: 3px; flex: none; }
.dvc-diff-bar-added { background: #22A05B; }
.dvc-diff-bar-modified { background: #E0922B; }
.dvc-diff-bar-removed { background: #E04848; }
.dvc-diff-content { flex: 1; min-width: 0; }
.dvc-diff-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 7px; }
.dvc-diff-sub { font-size: 11.5px; color: #697084; margin-top: 2px; }
.dvc-diff-tag { font-size: 9.5px; font-weight: 700; border-radius: 5px; padding: 1px 6px; color: #fff; white-space: nowrap; }
.dvc-diff-tag-added { background: #22A05B; }
.dvc-diff-tag-modified { background: #E0922B; }
.dvc-diff-tag-removed { background: #E04848; }

/* history actions */
.dvc-history-actions { display: flex; gap: 5px; flex: none; }
.dvc-history-btn { border: 1px solid #D9DCE3; background: #fff; border-radius: 7px; padding: 5px 9px; font-size: 11px; color: #697084; font-weight: 600; cursor: pointer; transition: .12s; }
.dvc-history-btn:hover { background: #F4F6F9; }

/* tabs */
.dmn-history-tabs {
    display: flex;
    padding: 8px 14px 0;
    gap: 4px;
    border-bottom: 1px solid #E6E8EE;
    background: #fff;
    flex-shrink: 0;
}
.dmn-history-tab {
    flex: 1;
    border: none;
    background: none;
    padding: 9px 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: #697084;
    border-bottom: 2px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: .15s;
}
.dmn-history-tab:hover { color: #1E2330; }
.dmn-history-tab--active { color: #1B4FCB; border-bottom-color: #2F6BFF; }
.dmn-history-tab-count {
    background: #EAF1FF;
    color: #1B4FCB;
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 8px;
    padding: 0 6px;
    min-width: 17px;
    height: 17px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* 이력 행 */
.dmn-history-row {
    display: flex;
    gap: 11px;
    padding: 12px 14px;
    margin: 8px 12px 0;
    border: 1px solid #E6E8EE;
    border-radius: 11px;
    align-items: center;
    background: #fff;
}
.dmn-history-row--cur { border-color: #BBCBE8; background: #F7FAFF; }
.dmn-history-badge {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: #EAF1FF;
    color: #1B4FCB;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11.5px;
    flex: none;
}
.dmn-history-meta { flex: 1; min-width: 0; }
.dmn-history-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.dmn-history-sub { font-size: 11px; color: #697084; margin-top: 2px; }
.dmn-history-cur-tag { font-size: 10px; font-weight: 700; color: #137a40; background: #E4F6EC; border-radius: 5px; padding: 1px 6px; }
.dmn-history-major-chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: #EEF0F4; border-radius: 6px; padding: 1px 7px; color: #697084; }

/* PR 목록 */
.dmn-pr-list-head { font-size: 11px; font-weight: 700; color: #9AA0AD; text-transform: uppercase; letter-spacing: .04em; padding: 12px 14px 6px; }
.dmn-prc {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    margin: 0 10px 7px;
    border: 1px solid #E6E8EE;
    border-radius: 11px;
    background: #fff;
    position: relative;
    cursor: pointer;
    transition: border-color .12s, box-shadow .12s;
}
.dmn-prc:hover { border-color: #BBCBE8; box-shadow: 0 2px 8px rgba(30, 50, 100, .06); }
.dmn-prc-merged { opacity: .85; }
.dmn-prc-merged:hover { opacity: 1; }
.dmn-pr-accent { position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 3px; }
.ac-open { background: #1B4FCB; }
.ac-chg { background: #E0922B; }
.ac-app { background: #22A05B; }
.ac-merged { background: #7C6BD6; }
.dmn-pr-ava { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex: none; margin-top: 1px; }
.dmn-prc-body { flex: 1; min-width: 0; padding-left: 2px; }
.dmn-prc-title { font-size: 13px; font-weight: 600; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; line-height: 1.4; }
.dmn-prc-byline { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 11.5px; color: #697084; flex-wrap: wrap; }
.dmn-prc-byline b { color: #1E2330; font-weight: 600; }
.dmn-prc-branchline { display: flex; align-items: center; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
.dmn-dot-sep { color: #9AA0AD; }
.dmn-branch-chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: #EEF0F4; border-radius: 6px; padding: 1px 7px; color: #697084; }
.dmn-st-badge { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 1px 7px; white-space: nowrap; }
.st-open { background: #EAF1FF; color: #1B4FCB; }
.st-chg { background: #FCF1DD; color: #9a630f; }
.st-app { background: #E4F6EC; color: #137a40; }
.st-merged { background: #F0EBFB; color: #5e45b8; }

/* PR 상세 */
.dmn-pr-detail-back { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #E6E8EE; background: #fff; flex-shrink: 0; }
.dmn-pr-back-btn { border: none; background: none; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #697084; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: .12s; }
.dmn-pr-back-btn:hover { background: #F4F6F9; color: #1E2330; }
.dmn-pr-detail-title { font-size: 13px; font-weight: 600; color: #1E2330; min-width: 0; }
.dmn-pr-approval-section { padding: 14px 16px; border-bottom: 1px solid #E6E8EE; }
.dmn-pr-section-head { font-size: 11px; font-weight: 700; color: #9AA0AD; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 9px; }
.dmn-pr-reviewer-row { display: flex; align-items: center; gap: 9px; padding: 6px 0; }
.dmn-pr-reviewer-name { font-size: 13px; font-weight: 600; }
.dmn-pr-role-chip { font-size: 10px; font-weight: 700; color: #1B4FCB; background: #EAF1FF; border-radius: 5px; padding: 1px 6px; }
.dmn-pr-status-chip { margin-left: auto; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 8px; }
.st-ok { background: #E4F6EC; color: #137a40; }
.st-pend { background: #EEF0F4; color: #697084; }
.st-req { background: #FCF1DD; color: #9a630f; }
</style>

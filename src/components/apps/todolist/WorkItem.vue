<template>
    <v-card v-if="currentComponent" class="work-item-top-box" elevation="10" :key="updatedKey">
        <div class="pa-2 pb-0 pl-4 pr-4 align-center">
            <div class="d-flex align-center" :style="isMobile ? 'display: block !important;' : ''">
                <v-row class="pa-0 pt-1 pb-1 ma-0 align-center">
                    <!-- 목록으로 돌아가는 버튼: 실제 워크아이템 화면에서만. 시뮬레이션·실행 팝업(dry run)에는 돌아갈 목록이 없다 -->
                    <v-btn
                        v-if="isSimulate != 'true' && !isDryRun"
                        @click="goBackToPreviousPage"
                        variant="text"
                        density="comfortable"
                        class="mr-2"
                        icon
                    >
                        <v-icon>mdi-arrow-left</v-icon>
                    </v-btn>
                    <h5 class="text-h5 font-weight-semibold mr-2">
                        {{ activityName }}
                    </h5>
                    <v-chip
                        v-if="workItemStatus"
                        size="x-small"
                        variant="outlined"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center"
                        :style="isMobile ? 'margin: 0px !important;' : ''"
                    >
                        {{ workItemStatus }}
                    </v-chip>
                    <v-chip
                        v-if="workItemVersionLabel"
                        size="x-small"
                        variant="outlined"
                        color="primary"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center"
                        :style="isMobile ? 'margin: 0px !important;' : ''"
                    >
                        {{ workItemVersionLabel }}
                    </v-chip>
                    <v-spacer></v-spacer>

                    <!-- 위임하기 UI -->
                    <v-row class="ma-0 pa-0" v-if="showDelegate">
                        <v-spacer></v-spacer>
                        <v-tooltip :text="$t('WorkItem.delegate')">
                            <template v-slot:activator="{ props }">
                                <div @click="openDelegateTask()" class="d-flex align-center" v-bind="props" style="cursor: pointer" data-testid="workitem-delegate">
                                    <v-avatar size="32">
                                        <v-img
                                            :src="
                                                assigneeUserInfo && assigneeUserInfo[0] && assigneeUserInfo[0].profile
                                                    ? assigneeUserInfo[0].profile
                                                    : '/images/defaultUser.png'
                                            "
                                        />
                                    </v-avatar>
                                </div>
                            </template>
                        </v-tooltip>
                    </v-row>
                    <div v-else-if="enableReworkButton">
                        <v-btn
                            @click="handleReworkDialog('open')"
                            color="primary"
                            density="compact"
                            rounded
                            variant="flat"
                            :disabled="isLoading"
                            :loading="isLoading"
                        >
                            {{ $t('WorkItem.runAgain') }}
                        </v-btn>
                    </div>
                </v-row>
                <v-divider v-if="isMobile" class="my-2"></v-divider>
                <!-- <v-row v-if="isSimulate == 'true'" class="pa-0 pt-1 pb-1 ma-0 align-center">
                    <v-tooltip v-if="isSimulate == 'true'" text="이전 단계">
                        <template v-slot:activator="{ props }">
                            <v-btn @click="backToPrevStep"
                                class="ml-1"
                                size="x-small"
                                icon="mdi-arrow-left"
                                v-bind="props"
                                :disabled="activityIndex == 0"
                            >
                                
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-btn v-if="isSimulate == 'true'" 
                        :disabled="activityIndex == 0"
                        @click="backToPrevStep"
                        variant="elevated" 
                        class="rounded-pill ml-1"
                        density="compact"
                        style="background-color: var(--cds-text-muted); color: white;"
                    >이전 단계</v-btn>
                </v-row> -->
            </div>
        </div>

        <v-row :class="isMobile ? 'ma-0 pa-0' : 'ma-0 pa-0'">
            <!-- Left -->
            <v-col :cols="isMobile ? 12 : 5" :class="isMobile ? 'pa-4 pt-0 order-last' : 'pa-0 pt-3 pl-4 pb-4'">
                <v-alert class="pa-0 primary-border" variant="outlined">
                    <!-- 데스크톱: 기존 탭 -->
                    <div v-if="!isMobile">
                        <v-tabs v-model="selectedTab" color="primary">
                            <template v-if="inFormNameTabs && inFormNameTabs.length > 0">
                                <v-tab v-for="(inFormNameTab, index) in inFormNameTabs" :key="index" :value="`form-${index}`">
                                    {{ inFormNameTab }}
                                </v-tab>
                            </template>
                            <v-tab v-for="tab in tabList" :key="tab.value" :value="tab.value">
                                {{ tab.label }}
                                <v-icon
                                    v-if="tab.value == 'agent' && isAddedNewForm"
                                    class="bouncing-arrow-horizontal-left"
                                    color="primary"
                                    size="large"
                                >
                                    mdi-arrow-left-bold
                                </v-icon>
                            </v-tab>
                        </v-tabs>
                    </div>

                    <!-- 모바일: 버튼 형태 -->
                    <div v-else class="pa-2">
                        <div class="d-flex flex-wrap ga-2">
                            <template v-if="inFormNameTabs && inFormNameTabs.length > 0">
                                <v-btn
                                    v-for="(inFormNameTab, index) in inFormNameTabs"
                                    :key="index"
                                    :variant="selectedTab === `form-${index}` ? 'flat' : 'text'"
                                    :color="selectedTab === `form-${index}` ? 'primary' : 'default'"
                                    size="small"
                                    @click="selectedTab = `form-${index}`"
                                >
                                    {{ inFormNameTab }}
                                </v-btn>
                            </template>
                            <v-btn
                                v-for="tab in tabList"
                                :key="tab.value"
                                :variant="selectedTab === tab.value ? 'flat' : 'text'"
                                :color="selectedTab === tab.value ? '' : 'default'"
                                :style="selectedTab === tab.value ? 'background-color: var(--cds-text-muted); color: white;' : ''"
                                size="small"
                                @click="selectedTab = tab.value"
                            >
                                {{ tab.label }}
                                <v-icon
                                    v-if="tab.value == 'agent' && isAddedNewForm"
                                    class="bouncing-arrow-horizontal-left ml-1"
                                    color="primary"
                                    size="small"
                                >
                                    mdi-arrow-left-bold
                                </v-icon>
                            </v-btn>
                        </div>
                    </div>
                    <v-window
                        v-model="selectedTab"
                        class="work-item-tab-box"
                        :class="$globalState.state.isZoomed ? '.work-item-tab-process-box-full' : 'work-item-tab-process-box-empty'"
                        :touch="false"
                    >
                        <v-window-item v-if="isTabAvailable('progress')" value="progress">
                            <div
                                :class="
                                    $globalState.state.isZoomed
                                        ? 'work-item-tab-item-process-box-full'
                                        : 'work-item-tab-item-process-box-empty'
                                "
                            >
                                <div class="pa-0" style="height: 100%" :key="updatedDefKey">
                                    <div v-if="bpmn" style="height: 100%">
                                        <div v-show="isBpmnLoading">
                                            <v-skeleton-loader type="image" class="mx-auto work-item-skeleton-loader"></v-skeleton-loader>
                                        </div>
                                        <BpmnUengine
                                            v-show="!isBpmnLoading"
                                            ref="bpmnVue"
                                            :bpmn="bpmn"
                                            :options="options"
                                            :isViewMode="true"
                                            :currentActivities="currentActivities"
                                            :taskStatus="taskStatus"
                                            :instanceId="workItem?.worklist?.instId"
                                            v-on:error="handleError"
                                            v-on:shown="handleShown"
                                            v-on:openDefinition="(ele) => openSubProcess(ele)"
                                            v-on:loading="handleLoading"
                                            v-on:openPanel="(id) => openPanel(id)"
                                            v-on:update-xml="(val) => $emit('update-xml', val)"
                                            v-on:definition="(def) => (definitions = def)"
                                            v-on:add-shape="onAddShape"
                                            v-on:done="setDefinition"
                                            v-on:change-sequence="onChangeSequence"
                                            v-on:remove-shape="onRemoveShape"
                                            v-on:change-shape="onChangeShape"
                                            :onLoadStart="onBpmnLoadStart"
                                            :onLoadEnd="onBpmnLoadEnd"
                                            style="height: 100%"
                                        ></BpmnUengine>

                                        <!-- <process-definition
                                            style="height: 100%"
                                            :currentActivities="currentActivities"
                                            :bpmn="bpmn"
                                            :key="updatedDefKey"
                                            :isViewMode="true"
                                        ></process-definition> -->
                                    </div>
                                    <span v-else style="height: 100%">
                                        <div v-show="isBpmnLoading">
                                            <v-skeleton-loader type="image" class="mx-auto work-item-skeleton-loader"></v-skeleton-loader>
                                        </div>
                                    </span>
                                </div>
                            </div>
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('history')" value="history" class="pa-2 work-item-history-tab">
                            <!-- 워크아이템 액티비티 -->
                            <v-card elevation="10" class="pa-0">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            class="work-item-activity-box"
                                            :class="mode == 'ProcessGPT' && isMobile ? 'work-item-activity-box-mobile' : ''"
                                            :is="'work-history-' + mode"
                                            :messages="messages"
                                            :isCompleted="isCompleted"
                                            @clickMessage="navigateToWorkItemByTaskId"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('chatbot')" value="chatbot" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component :is="'work-history-' + mode" :messages="[]" :useThreadId="true" />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('agent-monitor')" value="agent-monitor" class="pa-0" style="height: 100%">
                            <!-- 워크아이템 에이전트 맡기기 -->
                            <AgentMonitor
                                ref="agentMonitor"
                                :html="html"
                                :workItem="workItem"
                                :key="updatedDefKey"
                                :selected-agent-type="selectedAgent"
                                :readonly="!isOwnWorkItem"
                                @browser-use-completed="handleBrowserUseCompleted"
                                @update:agent-busy="updateAgentBusyState"
                                @before-generate-example="beforeGenerateExample"
                                @update-work-item="updateWorkItem"
                            />
                        </v-window-item>
                        <v-window-item v-for="(inFormNameTab, index) in inFormNameTabs" :key="index" :value="`form-${index}`">
                            <DynamicForm
                                v-if="inFormValues[index]?.html"
                                ref="dynamicForm"
                                :formHTML="inFormValues[index]?.html"
                                v-model="inFormValues[index].formData"
                                :readonly="true"
                                class="dynamic-form"
                            >
                            </DynamicForm>
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('output')" value="output" class="pa-2">
                            <InstanceOutput :instance="processInstance" :isInWorkItem="true" />
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('similar')" value="similar" class="pa-0">
                            <!-- 아코디언/폼 확장 시 탭 영역 내부에서 스크롤되도록 높이 제한 -->
                            <div
                                :style="{
                                    height: $globalState.state.isZoomed ? 'calc(100vh - 130px)' : 'calc(100vh - 260px)',
                                    overflowY: 'auto'
                                }"
                            >
                                <SimilarInstancesPanel v-if="procInstId" :procInstId="procInstId" />
                            </div>
                        </v-window-item>
                    </v-window>
                </v-alert>
            </v-col>
            <!-- Right -->
            <v-col
                class="pa-0"
                :cols="isMobile ? 12 : 7"
                :class="[
                    isMobile ? 'order-first' : '',
                    isMobile
                        ? 'overflow: auto'
                        : $globalState.state.isZoomed
                        ? 'work-item-form-box-height-full'
                        : 'work-item-form-box-height-empty'
                ]"
            >
                <div v-if="currentComponent" class="work-itme-current-component" style="height: 100%">
                    <!-- FormDefinition 분리된 영역 -->
                    <FormDefinition
                        v-if="isSimulate == 'true' && showFeedbackForm"
                        ref="formDefinition"
                        type="simulation"
                        :formId="formId"
                        :simulation_data="simulation_data"
                        @addedNewForm="addedNewForm"
                        v-model="tempFormHtml"
                        class="feedback-form"
                    />
                    <template v-if="currentComponent === 'FormWorkItem'">
                        <FormWorkItem
                            ref="currentWorkItemComponent"
                            class="work-item-current-component-box"
                            :definitionId="definitionId"
                            :work-item="workItem"
                            :workItemStatus="workItemStatus"
                            :isDryRun="isDryRun"
                            :dryRunWorkItem="dryRunWorkItem"
                            :currentActivities="currentActivities"
                            :isOwnWorkItem="isOwnWorkItem"
                            :activityIndex="activityIndex"
                            :deployDefinitionId="deployDefinitionId"
                            :deployVersion="deployVersion"
                            @loadInputData="loadInputData"
                            @updateCurrentActivities="updateCurrentActivities"
                            @close="close"
                            @executeProcess="executeProcess"
                            @backToPrevStep="backToPrevStep"
                            :is-simulate="isSimulate"
                            :is-finished-agent-generation="isFinishedAgentGeneration"
                            :is-generating-example="isGeneratingExample"
                            :processDefinition="processDefinition"
                        >
                            <template #form-work-item-action-label>
                                <div class="text-h5 font-weight-semibold">{{ $t('WorkItem.resultInput') }}</div>
                            </template>
                            <template #form-work-item-action-btn>
                                <div
                                    v-if="formData && Object.keys(formData).length > 0 && !isCompleted && isOwnWorkItem"
                                    class="work-item-form-btn-box align-center"
                                >
                                    <!-- 「음성 에이전트」 창(FormRealtimeAssistant) 단추는 없앴다 — 말로 입력하기는 아래 마이크 하나로,
                                         창 없이 이 폼에 바로 들어간다(2026-11-11 화면 검토 1:50~2:35). -->
                                    <v-btn
                                        v-if="isMobile && canResetGeneratedContent"
                                        @click="resetGeneratedContent"
                                        :disabled="isGeneratingExample"
                                        :class="isMobile ? 'mr-1 text-medium-emphasis' : 'mr-1'"
                                        :icon="isMobile"
                                        :variant="isMobile ? 'outlined' : 'flat'"
                                        :size="isMobile ? 'small' : 'default'"
                                        :rounded="!isMobile"
                                        density="comfortable"
                                        :style="isMobile ? 'border-color: var(--cds-border) !important;' : 'background-color: var(--cds-text-muted); color: white;'"
                                    >
                                        <v-icon>mdi-delete-outline</v-icon>
                                        <span v-if="!isMobile" class="ms-1">{{ $t('WorkItem.resetContent') }}</span>
                                    </v-btn>
                                    <!-- 누르면 바로 맡긴다(정해 둔 방식 → 지난번 방식 → 딥 에이전트). 방식 고르기는 ⋯ 안에.
                                         휴대폰에서도 보인다 — 휴대폰에서 가장 자주 쓸 일이다(2026-11-11 휴대폰 점검 H4) -->
                                    <v-btn
                                        v-if="!gs"
                                        class="mr-1"
                                        color="primary"
                                        variant="flat"
                                        density="comfortable"
                                        rounded
                                        :loading="isGeneratingExample"
                                        :disabled="isGeneratingExample"
                                        data-testid="workitem-delegate-agent"
                                        @click="delegateToAgent"
                                    >
                                        <v-icon>mdi-auto-fix</v-icon>
                                        <span class="ms-2">{{ $t('WorkItem.researchMethod') }}</span>
                                    </v-btn>
                                    <!-- 피드백 버튼만 유지 -->
                                    <v-btn
                                        v-if="isSimulate == 'true' && !isMobile"
                                        class="feedback-btn rounded-pill mr-1"
                                        variant="elevated"
                                        density="comfortable"
                                        @click="toggleFeedback"
                                        :disabled="isGeneratingExample"
                                        style="background-color: var(--cds-text-muted); color: white"
                                    >
                                        <v-icon>{{ showFeedbackForm ? 'mdi-close' : 'mdi-message-reply-text' }}</v-icon>
                                        <span v-if="!showFeedbackForm" class="ms-2">{{ $t('feedback') || 'Feedback' }}</span>
                                    </v-btn>
                                    <v-btn
                                        v-if="isSimulate == 'true' && isMobile"
                                        @click="toggleFeedback"
                                        :disabled="isGeneratingExample"
                                        class="mr-1 text-medium-emphasis"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        style="border-color: var(--cds-border) !important"
                                    >
                                        <v-icon>{{ showFeedbackForm ? 'mdi-close' : 'mdi-message-reply-text' }}</v-icon>
                                    </v-btn>
                                    <!-- 말로 입력하기(받아쓰기). 누르면 듣고, 다시 누르면 받아써서 이 폼에 넣는다 —
                                         듣는 동안의 상태 · 받아쓴 글 · 오류는 머리 아래 한 줄 막대에 보인다. -->
                                    <v-btn
                                        v-if="!gs"
                                        @click="toggleDictation"
                                        class="mr-1 text-medium-emphasis"
                                        :class="{ 'workitem-dictation-mic--on': dictation.state === 'recording' }"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        :style="dictation.state === 'recording' ? '' : 'border-color: var(--cds-border) !important'"
                                        :loading="dictationBusy"
                                        :disabled="dictationBusy || isGeneratingExample"
                                        :aria-label="
                                            dictation.state === 'recording' ? $t('WorkItemDictation.stop') : $t('WorkItemDictation.start')
                                        "
                                        :aria-pressed="dictation.state === 'recording' ? 'true' : 'false'"
                                        data-testid="workitem-dictation-mic"
                                    >
                                        <Icons :icon="dictation.state === 'recording' ? 'stop' : 'sharp-mic'" :size="'16'" />
                                    </v-btn>

                                    <v-menu v-if="!isMobile && !gs" location="bottom end">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                class="mr-1 text-medium-emphasis"
                                                density="comfortable"
                                                icon
                                                variant="outlined"
                                                size="small"
                                                style="border-color: var(--cds-border) !important"
                                                :aria-label="$t('WorkItem.moreActions')"
                                                data-testid="workitem-more-actions"
                                            >
                                                <v-icon>mdi-dots-horizontal</v-icon>
                                            </v-btn>
                                        </template>
                                        <v-list density="compact">
                                            <v-list-item prepend-icon="mdi-tune-variant" @click="selectedTab = 'agent-monitor'">
                                                <v-list-item-title>{{ $t('WorkItem.chooseAgent') }}</v-list-item-title>
                                            </v-list-item>
                                            <v-list-item
                                                v-if="aiFormEnabled"
                                                prepend-icon="mdi-creation"
                                                :disabled="isGeneratingExample"
                                                @click="triggerBasicLlmAgentFromResearchMethod"
                                            >
                                                <v-list-item-title>{{ $t('WorkItem.quickCreate') }}</v-list-item-title>
                                            </v-list-item>
                                            <v-list-item
                                                v-if="canResetGeneratedContent"
                                                prepend-icon="mdi-delete-outline"
                                                :disabled="isGeneratingExample"
                                                @click="resetGeneratedContent"
                                            >
                                                <v-list-item-title>{{ $t('WorkItem.resetContent') }}</v-list-item-title>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                    <v-btn
                                        v-if="isMobile && aiFormEnabled"
                                        @click="beforeGenerateExample"
                                        :loading="isGeneratingExample"
                                        :disabled="isGeneratingExample"
                                        class="mr-1 text-medium-emphasis"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        style="border-color: var(--cds-border) !important"
                                    >
                                        <template v-if="!isGeneratingExample">
                                            <v-icon v-if="generator">mdi-refresh</v-icon>
                                            <Icons v-else :icon="'sparkles'" :size="'16'" />
                                        </template>
                                    </v-btn>
                                </div>
                                <!-- 받아쓰기 막대 — 머리 줄 바로 아래 한 줄(머리 줄이 감싸는 flex 의 새 줄). 창을 띄우지 않는다:
                                     말하는 동안 받아쓴 글 · 지난 시간 · 멈춤, 끝나면 어디에 넣었는지, 안 되면 왜 안 되는지. -->
                                <div
                                    v-if="!gs && dictationBarVisible"
                                    class="workitem-dictation-bar"
                                    :class="{ 'workitem-dictation-bar--error': !!dictation.error }"
                                    role="status"
                                    aria-live="polite"
                                    data-testid="workitem-dictation-bar"
                                    :data-state="dictation.error ? 'error' : dictation.state"
                                >
                                    <template v-if="dictation.error">
                                        <v-icon size="18" color="error">mdi-alert-circle-outline</v-icon>
                                        <span
                                            class="workitem-dictation-text text-error"
                                            :title="dictation.error"
                                            data-testid="workitem-dictation-error"
                                            >{{ dictation.error }}</span
                                        >
                                    </template>
                                    <template v-else-if="dictation.state === 'recording'">
                                        <span class="workitem-dictation-dot" aria-hidden="true"></span>
                                        <span class="workitem-dictation-time" data-testid="workitem-dictation-elapsed">{{
                                            dictationElapsed
                                        }}</span>
                                        <span
                                            class="workitem-dictation-text"
                                            :class="{ 'text-medium-emphasis': !dictation.partial }"
                                            data-testid="workitem-dictation-partial"
                                            >{{
                                                dictation.partial ? dictationTail(dictation.partial) : $t('WorkItemDictation.listening')
                                            }}</span
                                        >
                                        <v-btn
                                            size="small"
                                            variant="tonal"
                                            color="error"
                                            rounded
                                            density="comfortable"
                                            data-testid="workitem-dictation-stop"
                                            @click="stopDictation"
                                        >
                                            <v-icon start size="16">mdi-stop</v-icon>{{ $t('WorkItemDictation.stop') }}
                                        </v-btn>
                                    </template>
                                    <template v-else-if="dictationBusy">
                                        <v-progress-circular indeterminate size="16" width="2" color="primary" />
                                        <span class="workitem-dictation-text">{{
                                            dictation.state === 'filling'
                                                ? $t('WorkItemDictation.filling', { text: dictationTail(dictation.transcript, 60) })
                                                : dictation.state === 'transcribing'
                                                ? $t('WorkItemDictation.transcribing')
                                                : $t('WorkItemDictation.starting')
                                        }}</span>
                                    </template>
                                    <template v-else>
                                        <v-icon size="18" color="success">mdi-check-circle-outline</v-icon>
                                        <span class="workitem-dictation-text" data-testid="workitem-dictation-note">{{
                                            dictation.note
                                        }}</span>
                                    </template>
                                    <v-btn
                                        v-if="dictation.error || dictation.state === 'idle'"
                                        icon
                                        variant="text"
                                        size="x-small"
                                        density="comfortable"
                                        :aria-label="$t('WorkItemDictation.close')"
                                        data-testid="workitem-dictation-close"
                                        @click="dismissDictation"
                                    >
                                        <v-icon size="16">mdi-close</v-icon>
                                    </v-btn>
                                </div>
                            </template>
                        </FormWorkItem>
                    </template>
                    <template v-else>
                        <component
                            ref="currentWorkItemComponent"
                            class="work-item-current-component-box"
                            :is="currentComponent"
                            :definitionId="definitionId"
                            :work-item="workItem"
                            :workItemStatus="workItemStatus"
                            :isDryRun="isDryRun"
                            :dryRunWorkItem="dryRunWorkItem"
                            :currentActivities="currentActivities"
                            :isOwnWorkItem="isOwnWorkItem"
                            @updateCurrentActivities="updateCurrentActivities"
                            @close="close"
                            @executeProcess="executeProcess"
                            :is-simulate="isSimulate"
                            :is-finished-agent-generation="isFinishedAgentGeneration"
                            :processDefinition="processDefinition"
                        ></component>
                    </template>
                </div>
            </v-col>
        </v-row>

        <!-- 위임하기 다이얼로그 -->
        <v-dialog
            v-model="delegateTaskDialog"
            :class="isMobile ? 'form-work-item-delegate-task-form-dialog-mobile' : 'form-work-item-delegate-task-form-dialog-pc'"
        >
            <DelegateTaskForm :task="workItem" @delegate="delegateTask" @close="closeDelegateTask" />
        </v-dialog>

        <v-dialog v-model="reworkDialog" width="500">
            <ReworkDialog :reworkActivities="reworkActivities" @submitRework="submitRework" @close="handleReworkDialog('close')" />
        </v-dialog>
    </v-card>
</template>

<script>
import FormDefinition from '@/components/FormDefinition.vue';
import BackendFactory from '@/components/api/BackendFactory';
import { canUseAiFeatures } from '@/utils/aiFeatureGate';
import { awaitingUserInput } from '@/shared/awaitingUserInput';
// import ProcessDefinition from '@/components/ProcessDefinition.vue';
import DefaultWorkItem from './DefaultWorkItem.vue';
import FormWorkItem from './FormWorkItem.vue'; // FormWorkItem 컴포넌트 임포트
import URLWorkItem from './URLWorkItem.vue';
import InstanceOutput from './InstanceOutput.vue';
import SimilarInstancesPanel from '@/components/apps/instance-classifier/SimilarInstancesPanel.vue';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import AgentMonitor from '@/views/markdown/AgentMonitor.vue';

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceTable from '@/components/ProcessInstanceTable.vue';
import customBpmnModule from '@/components/customBpmn';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import DelegateTaskForm from '@/components/apps/todolist/DelegateTaskForm.vue';
import exampleGenerator from '@/components/ai/WorkItemAgentGenerator.js';
import ReworkDialog from './ReworkDialog.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import AgentSelectField from '@/components/ui/field/AgentSelectField.vue';
import { useDefaultSetting } from '@/stores/defaultSetting';
import {
    appendTranscript,
    buildFillMessages,
    dictationTarget,
    formatElapsed,
    isOnAttr,
    parseFillResponse,
    parseItemsAttr,
    partialDue,
    startRecording,
    tailText,
    transcribe
} from '@/shared/dictation';
import { requestFormFill } from '@/components/ai/FormFillGenerator';

import JSON5 from 'json5';
import partialParse from 'partial-json-parser';
import { canReassignWorkItem, findStarterId } from '@/utils/workItemAccess';
import { pickAgentDelegation, readLastAgentDelegation } from '@/utils/agentDelegation';
import { phoneScopeMode } from '@/shared/phoneScope';
import axios from 'axios';

export default {
    props: {
        definitionId: {
            type: String,
            required: true
        },
        taskId: String,
        isDryRun: {
            type: Boolean,
            default: false
        },
        dryRunWorkItem: Object,
        isSimulate: {
            type: String,
            default: 'false'
        },
        simulationInstances: Array,
        processDefinition: Object,
        activityIndex: Number,
        isStarted: {
            type: Boolean,
            default: false
        },
        disableAdvancedResearch: {
            type: Boolean,
            default: false
        },
        deployDefinitionId: {
            type: String,
            default: ''
        },
        deployVersion: {
            type: String,
            default: ''
        }
    },
    components: {
        // ProcessDefinition,
        DefaultWorkItem,
        FormWorkItem,
        URLWorkItem,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceTable,
        BpmnUengine,
        DynamicForm,
        FormDefinition,
        InstanceOutput,
        SimilarInstancesPanel,
        AgentMonitor,
        DelegateTaskForm,
        ReworkDialog,
        DetailComponent,
        AgentSelectField
    },
    data: () => ({
        backend: null,

        workItem: null,
        workListByInstId: null,
        windowWidth: window.innerWidth,

        // bpmn
        bpmn: null,
        isBpmnLoading: false,
        options: {
            propertiesPanel: {},
            additionalModules: [customBpmnModule]
        },
        currentComponent: null,
        currentActivities: [],
        taskStatus: null,

        // status variables
        updatedKey: 0,
        updatedDefKey: 0,

        // WorkItem Tabs
        selectedTab: 'progress',

        eventList: [],

        html: null,
        formData: null,
        formFields: [],

        // Form data
        inFormNameTabs: [],
        inFormValues: [],

        isFinishedAgentGeneration: false,
        showFeedbackForm: false,
        tempFormHtml: null,
        formId: null,
        simulation_data: {},
        agentRenderKey: 0,

        processInstance: null,
        generator: null,
        imgKeyList: [],
        isVisionMode: false,
        isGeneratingExample: false,

        // 빠른 초안에 함께 넘기는 글(예전 마이크가 받아쓴 글을 여기 넣었다)
        newMessage: '',

        // 받아쓰기(머리의 마이크). state: idle · starting · recording · transcribing · filling
        dictation: { state: 'idle', partial: '', transcript: '', elapsedMs: 0, note: '', error: '' },

        assigneeUserInfo: null,
        isLoading: false,

        // Agent 상태 추적
        isAgentBusy: false,

        // 순차적 폼 채우기를 위한 변수
        appliedFormFields: {},

        delegateTaskDialog: false,
        inputData: null,

        // rework
        reworkDialog: false,
        reworkActivities: [],
        enableReworkButton: false,

        // research method dropdown
        researchMethodMenu: false,
        selectedResearchMethod: null,
        researchMethods: [
            {
                value: 'default',
                label: 'WorkItem.quickGenerateExample',
                description: 'WorkItem.quickGenerateExampleDescription',
                advanced: false,
                costKey: 'AgentSelectInfo.cost.low'
            },
            {
                value: 'crewaiDeepResearch',
                label: 'AgentSelectInfo.orchestration.crewaiDeepResearch.title',
                description: 'AgentSelectInfo.orchestration.crewaiDeepResearch.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.medium',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.title',
                    details: [
                        { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.0.title' },
                        { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.1.title' },
                        { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.2.title' }
                    ]
                }
            },
            {
                value: 'deepResearchCustom',
                label: 'AgentSelectInfo.orchestration.deepResearchCustom.title',
                description: 'AgentSelectInfo.orchestration.deepResearchCustom.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.medium',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.title',
                    details: [
                        { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.0.title' },
                        { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.1.title' },
                        { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.2.title' }
                    ]
                }
            },
            {
                value: 'crewaiAction',
                label: 'AgentSelectInfo.orchestration.crewaiAction.title',
                description: 'AgentSelectInfo.orchestration.crewaiAction.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.low',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.title',
                    details: [
                        { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.0.title' },
                        { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.1.title' },
                        { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.2.title' }
                    ]
                }
            },
            {
                value: 'openaiDeepResearch',
                label: 'AgentSelectInfo.orchestration.openaiDeepResearch.title',
                description: 'AgentSelectInfo.orchestration.openaiDeepResearch.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.high',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.openaiDeepResearch.detailDesc.title',
                    details: [
                        { title: 'AgentSelectInfo.orchestration.openaiDeepResearch.detailDesc.details.0.title' },
                        { title: 'AgentSelectInfo.orchestration.openaiDeepResearch.detailDesc.details.1.title' },
                        { title: 'AgentSelectInfo.orchestration.openaiDeepResearch.detailDesc.details.2.title' }
                    ]
                }
            },
            {
                value: 'langchainReact',
                label: 'AgentSelectInfo.orchestration.langchainReact.title',
                description: 'AgentSelectInfo.orchestration.langchainReact.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.medium',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.title',
                    details: [
                        { title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.0.title' },
                        { title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.1.title' },
                        { title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.2.title' },
                        { title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.3.title' }
                    ]
                }
            },
            {
                value: 'visionParse',
                label: 'AgentSelectInfo.orchestration.visionParse.title',
                description: 'AgentSelectInfo.orchestration.visionParse.description',
                advanced: true,
                costKey: 'AgentSelectInfo.cost.high',
                detailDesc: {
                    title: 'AgentSelectInfo.orchestration.visionParse.detailDesc.title'
                }
            }
        ],

        selectedAgent: {
            agent: '',
            agentMode: 'none',
            orchestration: null
        }
    }),
    created() {
        this.backend = BackendFactory.createBackend();

        // this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.updatedDefKey++;
        });
        this.EventBus.on('html-updated', (newHtml) => {
            this.html = newHtml;
            // 현재 폼(html/formData)에 반영 대상(definition/version) 주입
            // formData가 아직 없을 수 있으므로, formData-updated에서도 한 번 더 시도함
            this.injectDeployTargetToBpmnField(this.html, this.formData);
            if (this.isSimulate == 'true' && !this.generator) {
                this.beforeGenerateExample();
            }
        });
        this.EventBus.on('formData-updated', (newformData) => {
            this.formData = newformData;
            // 현재 폼(html/formData)에 반영 대상(definition/version) 주입
            this.injectDeployTargetToBpmnField(this.html, this.formData);
        });
        this.EventBus.on('form-data-loaded', (formData) => {
            this.inFormNameTabs = formData.inFormNameTabs;
            this.inFormValues = formData.inFormValues;
            // ref/in-parameter 폼들도 로드된 시점에 주입 (ProcessGPT 모드에서는 loadRefForm을 안 타는 경우가 있어 여기서 처리)
            try {
                (this.inFormValues || []).forEach((item) => {
                    if (item && item.html && item.formData) {
                        this.injectDeployTargetToBpmnField(item.html, item.formData);
                    }
                });
            } catch (e) {
                // ignore
            }
        });
        window.addEventListener('resize', this.handleResize);
    },
    async mounted() {
        // KPI 설문 워크아이템(strategy 서비스 발행, activity_id='kpi_survey')은 전용 응답 화면으로 이동
        const taskId = this.taskId || this.$route.params.taskId;
        if (taskId && window.$supabase) {
            try {
                const { data } = await window.$supabase.from('todolist').select('activity_id').eq('id', taskId).maybeSingle();
                if (data && data.activity_id === 'kpi_survey') {
                    this.$router.replace(`/strategy/surveys/${taskId}`);
                    return;
                }
            } catch (e) {
                // 조회 실패 시 일반 워크아이템으로 처리
            }
        }
        await this.init();
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.handleResize);
        // 화면을 떠나도 마이크가 켜져 있으면 녹음 표시가 계속 남는다
        this.cancelDictation();
    },
    computed: {
        phoneScopeMode() {
            return phoneScopeMode(window);
        },
        gs() {
            return window.$gs;
        },
        aiFormEnabled() {
            return canUseAiFeatures('FORM');
        },
        currentRunningResearchMethod() {
            // 에이전트가 진행 중이고 workItem에 orchestration 정보가 있는 경우
            if (this.isAgentBusy && this.workItem && this.workItem.worklist && this.workItem.worklist.orchestration) {
                const orch = this.workItem.worklist.orchestration;
                const mapping = {
                    'crewai-deep-research': this.$t('agentMonitor.crewaiDeepResearch'),
                    'crewai-action': this.$t('agentMonitor.crewaiAction'),
                    'openai-deep-research': this.$t('agentMonitor.openaiDeepResearch'),
                    'langchain-react': this.$t('agentMonitor.langchainReact'),
                    'browser-automation-agent': 'Browser Automation Agent',
                    visionparse: 'Vision Parse'
                };
                return mapping[orch] || orch;
            }
            return null;
        },
        hasGeneratedContent() {
            // 생성 중인 경우
            if (this.isGeneratingExample) return true;

            // generator가 있고 이전 메시지가 있는 경우
            if (this.generator && this.generator.previousMessages && this.generator.previousMessages.length > 0) return true;

            // 오디오 메시지가 있는 경우
            if (this.newMessage && this.newMessage.trim()) return true;

            // formData에 실제 값이 있는지 확인
            if (this.formData && typeof this.formData === 'object') {
                for (const key of Object.keys(this.formData)) {
                    const value = this.formData[key];
                    if (value && typeof value === 'string' && value.trim() !== '') {
                        return true;
                    }
                }
            }

            return false;
        },
        isOwnWorkItem() {
            if (this.isStarted || this.isSimulate == 'true' || this.pal) {
                return true;
            }

            if (this.mode == 'uEngine') {
                const currentUserEmail = localStorage.getItem('email');
                const endpoint = this.workItem && this.workItem.worklist ? this.workItem.worklist.endpoint : null;

                if (!currentUserEmail || !endpoint) {
                    return false;
                }

                return currentUserEmail === endpoint;
            } else {
                const currentUserId = localStorage.getItem('uid');
                const endpoint = this.workItem && this.workItem.worklist ? this.workItem.worklist.endpoint : null;

                if (!currentUserId || !endpoint) {
                    return false;
                }

                // endpoint가 단일 값일 때 uid와 일치하면 내 업무
                const endpointList = String(endpoint)
                    .split(',')
                    .map((e) => e.trim());
                return endpointList.includes(currentUserId);
            }
        },
        // 위임(담당자 바꾸기)은 담당자 본인 · 시작자 · 관리자만. 다른 참여자는 남의 업무를 볼 수만 있다.
        showDelegate() {
            if (this.isSimulate == 'true' || this.isDryRun || this.isStarted || this.isCompleted) return false;
            if (this.pal) return this.isNoAssignee;
            const uid = this.mode == 'uEngine' ? localStorage.getItem('email') : localStorage.getItem('uid');
            return canReassignWorkItem({
                uid,
                isAdmin: localStorage.getItem('isAdmin') == 'true',
                endpoint: this.workItem?.worklist?.endpoint,
                starterId: findStarterId(this.workListByInstId),
                completed: this.isCompleted
            });
        },
        canResetGeneratedContent() {
            return this.hasGeneratedContent && (!this.selectedResearchMethod || this.selectedResearchMethod === 'default');
        },
        isNoAssignee() {
            const endpoint = this.workItem && this.workItem.worklist ? this.workItem.worklist.endpoint : null;
            return !endpoint;
        },
        mode() {
            return window.$mode;
        },
        pal() {
            return window.$pal;
        },
        currentTaskId() {
            return this.taskId ? this.taskId : this.$route.params.taskId;
        },
        messages() {
            if (!this.workListByInstId) return [];
            return this.workListByInstId.map((workItem) => ({
                profile: 'https://avatars0.githubusercontent.com/u/9064066?v=4&s=460',
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }));
        },
        activityName() {
            if (!this.workItem) return null;
            return this.workItem.activity.name;
        },
        assistantInstruction() {
            return this.workItem && this.workItem.activity && this.workItem.activity.instruction ? this.workItem.activity.instruction : '';
        },
        dictationBusy() {
            return ['starting', 'transcribing', 'filling'].includes(this.dictation.state);
        },
        dictationBarVisible() {
            return this.dictation.state !== 'idle' || !!this.dictation.error || !!this.dictation.note;
        },
        dictationElapsed() {
            return formatElapsed(this.dictation.elapsedMs);
        },
        workItemStatus() {
            if (!this.workItem) return null;
            if (this.isDryRun) return 'NEW';

            return this.workItem.worklist.status;
        },
        workItemVersionLabel() {
            if (!this.workItem || !this.workItem.worklist) return null;
            const version = this.workItem.worklist.version;
            if (!version) return null;
            const tag = this.workItem.worklist.version_tag;
            return tag ? `v ${version}` : version;
        },
        isCompleted() {
            return this.workItemStatus == 'COMPLETED' || this.workItemStatus == 'DONE';
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        tabList() {
            if (this.mode == 'ProcessGPT') {
                let tabs = [];

                if (this.bpmn && this.isStarted) {
                    tabs = [
                        { value: 'progress', label: this.$t('WorkItem.progress') },
                        { value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') } //에이전트에 맡기기
                    ];
                } else if (this.bpmn && !this.isStarted && this.isCompleted) {
                    tabs = [
                        // { value: 'output', label: this.$t('InstanceCard.output') }, //산출물
                        { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                        { value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') } //에이전트에 맡기기
                    ];
                } else if (this.bpmn && !this.isStarted && !this.isCompleted) {
                    tabs = [
                        { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                        { value: 'history', label: this.$t('WorkItem.history') }, //액티비티
                        // { value: 'chatbot', label: this.$t('WorkItem.chatbot') },
                        { value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') } //에이전트에 맡기기
                        // { value: 'output', label: this.$t('InstanceCard.output') }, //산출물
                    ];
                } else {
                    tabs = [
                        { value: 'chatbot', label: this.$t('WorkItem.chatbot') } //어시스턴트
                    ];
                }

                // currentRunningResearchMethod가 있으면 agent-monitor 탭 추가
                if (this.currentRunningResearchMethod && !tabs.find((t) => t.value === 'agent-monitor')) {
                    tabs.push({ value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') });
                }

                // 유사 과거 사례(인스턴스 자동분류) 탭 — 인스턴스가 있을 때만
                if (this.procInstId && !tabs.find((t) => t.value === 'similar')) {
                    tabs.push({ value: 'similar', label: '유사 사례' });
                }

                return tabs;
            } else {
                return [
                    { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                    { value: 'history', label: this.$t('WorkItem.history') } //액티비티
                ];

                // if(this.inFormNameTabs.length > 0) {
                //     this.inFormNameTabs.forEach((tab, index) => {
                //         tabList.push({ value: `form-${index}`, label: tab });
                //     });
                // }
            }
        },
        procInstId() {
            return this.workItem?.worklist?.instId || null;
        }
    },
    watch: {
        windowWidth(newWidth) {
            if (newWidth <= 768) {
                this.isMobile = true;
            } else {
                this.isMobile = false;
            }
        },
        researchMethodMenu(isOpen) {
            if (isOpen) {
                this.$nextTick(() => {
                    const agentSelectFieldRef = this.$refs.researchMethodAgentSelectField;
                    if (agentSelectFieldRef && typeof agentSelectFieldRef.expandAgentUserSelectField === 'function') {
                        agentSelectFieldRef.expandAgentUserSelectField();
                    }
                });
            }
        },
        $route: {
            handler(newVal, oldVal) {
                if (newVal.params.taskId && newVal.params.taskId != oldVal.params.taskId) {
                    this.init();
                }
            },
            deep: true
        },
        inFormNameTabs(newVal) {
            console.log(newVal);
        },
        selectedTab(newTab) {
            // 현재 탭이 사용 가능한 탭 목록에 있는지 확인
            if (!this.isTabAvailable(newTab)) {
                // 사용 가능한 첫 번째 탭으로 변경
                const firstAvailableTab = this.tabList[0];
                if (firstAvailableTab) {
                    this.selectedTab = firstAvailableTab.value;
                }
            }
            if (newTab == 'agent-monitor') {
                if (this.selectedAgent.agentMode == 'none') {
                    this.selectedAgent.agentMode = 'draft';
                }
            }
        },
        currentRunningResearchMethod(newValue) {
            // currentRunningResearchMethod가 있으면 agent-monitor 탭으로 변경
            if (newValue) {
                this.selectedTab = 'agent-monitor';
            }
        },
        bpmn(newVal, oldVal) {
            const newLen = (newVal || '').length;

            // 초기 렌더 타이밍에 bpmn 미로딩으로 chatbot 탭으로 떨어진 경우 복구
            if (newLen > 0 && this.mode === 'ProcessGPT' && this.isTabAvailable('progress') && this.selectedTab === 'chatbot') {
                this.selectedTab = 'progress';
            }
        },
        workItem: {
            async handler(newVal) {
                if (newVal && newVal.worklist && newVal.worklist.taskId) {
                    this.loadAssigneeInfo();
                    this.enableReworkButton = await this.backend.enableRework(newVal);
                    // 에이전트 상태 초기화
                    if (this.mode == 'uEngine') return;
                    this.checkInitialAgentBusyState();

                    this.selectedAgent = {
                        agent: newVal.worklist.endpoint || '',
                        agentMode: newVal.worklist.agentMode.toLowerCase() || 'none',
                        orchestration: newVal.worklist.orchestration || null
                    };
                }
            },
            deep: true
        },
        selectedAgent: {
            handler(newVal) {
                if (newVal && newVal.agentMode && newVal.agentMode !== 'none') {
                    if (newVal.orchestration === 'default') {
                        this.beforeGenerateExample(null);
                    }
                }
            },
            deep: true
        }
    },
    methods: {
        getCostColor(costKey) {
            if (costKey === 'AgentSelectInfo.cost.low') {
                return 'success';
            } else if (costKey === 'AgentSelectInfo.cost.medium') {
                return 'warning';
            } else if (costKey === 'AgentSelectInfo.cost.high') {
                return 'error';
            }
            return 'grey';
        },
        extractFieldSchema(formHtml, formData) {
            if (!formHtml) return [];
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(formHtml, 'text/html');
                const selectors =
                    'text-field, textarea-field, select-field, checkbox-field, radio-field, boolean-field, user-select-field, file-field, folder-field, bpmn-uengine-field, report-field, slide-field';
                const fields = [];
                Array.from(doc.querySelectorAll(selectors)).forEach((el) => {
                    const name = el.getAttribute('name') || el.getAttribute('id');
                    if (!name) return;
                    // 이 저장소의 폼은 칸 이름을 alias 에 둔다 — label 만 보면 LLM 이 「고객명」 대신 customer_name 만 본다
                    const label = el.getAttribute('label') || el.getAttribute('alias') || el.getAttribute('placeholder') || name;
                    const required = el.hasAttribute('required') || el.getAttribute('required') === 'true';
                    const placeholder = el.getAttribute('placeholder') || '';
                    const tag = (el.tagName || '').toLowerCase();
                    const inputType = (el.getAttribute('type') || el.getAttribute('input-type') || '').toLowerCase();
                    let type = tag;
                    if (tag === 'text-field' && inputType) {
                        if (inputType === 'date') type = 'date-field';
                        else if (inputType === 'time') type = 'time-field';
                        else if (inputType === 'datetime-local') type = 'datetime-field';
                    }
                    const options = [];
                    el.querySelectorAll('option').forEach((opt) => {
                        const value = opt.getAttribute('value') || (opt.textContent || '').trim();
                        const labelText = (opt.textContent || '').trim();
                        options.push({ label: labelText, value });
                    });
                    const rawItems = el.getAttribute('items') || undefined;
                    const itemOptions = options.length ? options : parseItemsAttr(rawItems);
                    fields.push({
                        name,
                        label,
                        type,
                        inputType: inputType || undefined,
                        required,
                        placeholder,
                        // 받아쓰기는 읽기 전용 칸을 건드리지 않는다(disabled='false' 처럼 글자로 꺼 둔 칸이 흔하다)
                        readonly: isOnAttr(el.getAttribute('readonly')),
                        disabled: isOnAttr(el.getAttribute('disabled')),
                        value: Object.prototype.hasOwnProperty.call(formData || {}, name) ? formData[name] : null,
                        options: itemOptions.length ? itemOptions : undefined,
                        rawItems
                    });
                });
                return fields;
            } catch (e) {
                console.error('assistant schema parse error', e);
                return [];
            }
        },
        injectDeployTargetToBpmnField(formHtml, formData) {
            if (!this.deployDefinitionId || !formHtml || !formData) return;
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(formHtml, 'text/html');
                const nodes = Array.from(doc.querySelectorAll('bpmn-uengine-field'));
                if (nodes.length === 0) return;
                let target = nodes.find((n) => (n.getAttribute('name') || '') === 'definition_id');
                if (!target && nodes.length === 1) target = nodes[0];
                if (!target) {
                    target = nodes.find((n) => ((n.getAttribute('alias') || '') + '').includes('요청')) || nodes[0];
                }
                const fieldName = (target.getAttribute('name') || '').trim();
                if (!fieldName) return;
                const current = formData[fieldName];
                formData[fieldName] = {
                    ...(typeof current === 'object' && current ? current : {}),
                    definition_id: this.deployDefinitionId,
                    version: this.deployVersion || undefined
                };
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[WorkItem] injectDeployTargetToBpmnField failed:', e);
            }
        },
        onBpmnLoadStart() {
            this.isBpmnLoading = true;
        },
        onBpmnLoadEnd() {
            this.isBpmnLoading = false;
        },
        isTabAvailable(tabValue) {
            return this.tabList.some((tab) => tab.value === tabValue);
        },
        // ── 받아쓰기(머리의 마이크) ─────────────────────────────────────────────
        // 녹음 · 받아쓰기는 휴대폰 웹과 같은 것(src/shared/dictation, /completion/upload)을 쓴다.
        // 받아쓴 글은 창 없이 이 폼에 넣는다 — 글 칸 하나면 그 칸 뒤에 그대로, 칸이 여럿이면 서버 LLM 한 번으로
        // 말한 칸만 채운다. 채운 뒤 사람이 보고 제출한다(자동 제출 · 자동 저장 없음).
        async toggleDictation() {
            if (this.dictation.state === 'recording') return this.stopDictation();
            if (this.dictation.state !== 'idle') return;
            await this.startDictation();
        },
        async startDictation() {
            this.cancelDictation();
            this.dictation = { state: 'starting', partial: '', transcript: '', elapsedMs: 0, note: '', error: '' };
            const session = await startRecording({ timeslice: 1000 });
            if (this.dictation.state !== 'starting') {
                // 기다리는 사이 화면을 떠났거나 취소했다 — 받은 마이크를 바로 놓는다
                if (session.ok) session.stop();
                return;
            }
            if (!session.ok) {
                // 녹음 시작의 'failed' 는 서버가 아니라 마이크 문제다(장치 없음 등)
                this.failDictation(session.reason === 'failed' ? 'micFailed' : session.reason);
                return;
            }
            const run = { session, startedAt: Date.now(), lastPartialAt: 0, partialInFlight: false, timer: null };
            run.timer = setInterval(() => this.tickDictation(run), 1000);
            this.dictationRun = run;
            this.dictation.state = 'recording';
        },
        tickDictation(run) {
            if (this.dictationRun !== run || this.dictation.state !== 'recording') return;
            const now = Date.now();
            const elapsedMs = now - run.startedAt;
            this.dictation.elapsedMs = elapsedMs;
            // 말하는 동안 지금까지 받아쓴 글을 보여 준다 — 「듣고 있나?」 를 묻지 않아도 되게
            if (!partialDue({ elapsedMs, sinceLastMs: now - run.lastPartialAt, inFlight: run.partialInFlight })) return;
            const blob = run.session.peek();
            if (!blob) return;
            run.partialInFlight = true;
            run.lastPartialAt = now;
            transcribe(blob, { post: (url, body) => axios.post(url, body) })
                .then((result) => {
                    if (result.ok && this.dictationRun === run && this.dictation.state === 'recording') {
                        this.dictation.partial = result.text;
                    }
                })
                .finally(() => {
                    run.partialInFlight = false;
                });
        },
        async stopDictation() {
            const run = this.dictationRun;
            if (!run || this.dictation.state !== 'recording') return;
            clearInterval(run.timer);
            this.dictation.state = 'transcribing';
            const blob = await run.session.stop();
            const result = await transcribe(blob, { post: (url, body) => axios.post(url, body) });
            if (this.dictationRun !== run) return;
            if (!result.ok) {
                this.failDictation(result.reason);
                return;
            }
            await this.applyDictation(result.text, run);
        },
        async applyDictation(text, run) {
            const fields = this.extractFieldSchema(this.html, this.formData || {});
            const target = dictationTarget(fields);
            if (target.mode === 'append') {
                const current = this.formData ? this.formData[target.name] : '';
                this.EventBus.emit('form-values-updated', { [target.name]: appendTranscript(current, text) });
                this.finishDictation(this.$t('WorkItemDictation.appended', { field: target.label }));
                return;
            }
            if (target.mode === 'none') {
                this.failDictation('nothingToFill', text);
                return;
            }
            this.dictation.state = 'filling';
            this.dictation.transcript = text;
            const messages = buildFillMessages({
                fields,
                values: this.formData || {},
                transcript: text,
                processName: this.processDefinition ? this.processDefinition.processDefinitionName : '',
                activityName: this.activityName || '',
                instruction: this.assistantInstruction
            });
            let patch = {};
            try {
                patch = parseFillResponse(await requestFormFill(messages), fields);
            } catch (e) {
                if (this.dictationRun === run) this.failDictation('fillFailed', text);
                return;
            }
            if (this.dictationRun !== run) return;
            const names = Object.keys(patch);
            if (!names.length) {
                this.failDictation('noMatch', text);
                return;
            }
            this.EventBus.emit('form-values-updated', patch);
            const labels = names.map((n) => (fields.find((f) => f.name === n) || {}).label || n);
            this.finishDictation(this.$t('WorkItemDictation.filled', { count: names.length, fields: labels.join(', ') }));
        },
        finishDictation(note) {
            this.releaseDictation();
            this.dictation = { state: 'idle', partial: '', transcript: '', elapsedMs: 0, note, error: '' };
        },
        failDictation(reason, transcript = '') {
            this.releaseDictation();
            // 받아쓴 글이 있으면 같이 보여 준다 — 칸에 못 넣었어도 말한 것을 다시 하지 않아도 되게
            const message = this.$t(`WorkItemDictation.reason.${reason}`);
            const error = transcript ? `${message} ${this.$t('WorkItemDictation.heard', { text: transcript })}` : message;
            this.dictation = { state: 'idle', partial: '', transcript, elapsedMs: 0, note: '', error };
        },
        dismissDictation() {
            this.dictation = { state: 'idle', partial: '', transcript: '', elapsedMs: 0, note: '', error: '' };
        },
        releaseDictation() {
            const run = this.dictationRun;
            this.dictationRun = null;
            if (!run) return;
            clearInterval(run.timer);
            // 마이크를 놓지 않으면 녹음 표시가 계속 남는다(이미 멈췄으면 아무 일도 없다)
            run.session.stop();
        },
        cancelDictation() {
            this.releaseDictation();
            if (this.dictation && this.dictation.state !== 'idle') this.dismissDictation();
        },
        dictationTail(text, max) {
            return tailText(text, max);
        },
        hasUnclosedTripleBackticks(inputString) {
            // 백틱 세 개의 시작과 끝을 찾는 정규 표현식
            const regex = /`{3}/g;
            let match;
            let isOpen = false;

            // 모든 백틱 세 개의 시작과 끝을 찾습니다
            while ((match = regex.exec(inputString)) !== null) {
                // 현재 상태를 토글합니다 (열림 -> 닫힘, 닫힘 -> 열림)
                isOpen = !isOpen;
            }

            // 마지막으로 찾은 백틱 세 개가 닫혀있지 않은 경우 true 반환
            return isOpen;
        },
        extractJSON(inputString, checkFunction) {
            try {
                JSON5.parse(inputString); // if no problem, just return the whole thing
                return inputString;
            } catch (e) {}

            if (this.hasUnclosedTripleBackticks(inputString)) {
                inputString = inputString + '\n```';
            }

            // 정규 표현식 정의
            //const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;
            let regex = /```(?:json)?\s*([\s\S]*?)\s*```/;

            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            let match = inputString.match(regex);
            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if (checkFunction)
                    match.forEach((shouldBeJson) => {
                        const lastIndex = shouldBeJson.lastIndexOf('}');
                        const result = shouldBeJson.slice(0, lastIndex + 1);
                        if (checkFunction(result)) return result;
                    });
                else return match[1];
            } else {
                regex = /\{[\s\S]*\}/;
                match = inputString.match(regex);
                return match && match[0] ? match[0] : null;
            }

            // 매치된 결과가 없으면 null 반환
            return null;
        },
        async resizeBase64Image(base64Str, minWidth, minHeight) {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64Str;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > minWidth) {
                            height *= minWidth / width;
                            width = minWidth;
                        }
                    } else {
                        if (height > minHeight) {
                            width *= minHeight / height;
                            height = minHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL());
                };
            });
        },
        isMethodDisabled(method) {
            // 빠른 생성(default)은 항상 활성화
            if (method.value === 'default') {
                return false;
            }

            // disableAdvancedResearch가 true이고 해당 메서드가 고급 연구 방식이면 disabled
            if (method.advanced && this.disableAdvancedResearch) {
                return true;
            }

            // 에이전트가 진행중이거나 대기열에 있으면 고급 연구 방식만 비활성화
            if (this.isAgentBusy) {
                return true;
            }

            return false;
        },
        updateAgentBusyState(isBusy) {
            this.isAgentBusy = isBusy;
        },
        async checkInitialAgentBusyState() {
            if (window.$mode === 'uEngine') {
                this.isAgentBusy = false;
                return;
            }
            // workItem의 상태를 기반으로 에이전트가 진행 중인지 확인
            if (!this.workItem || !this.workItem.worklist || this.isStarted) {
                this.isAgentBusy = false;
                return;
            }

            const worklist = this.workItem.worklist;
            const taskId = worklist.taskId;

            // todolist 테이블에서 현재 상태 조회
            try {
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('status, agent_mode, draft_status, agent_orch')
                    .eq('id', taskId)
                    .single();

                if (error) {
                    console.error('Error fetching todolist status:', error);
                    this.isAgentBusy = false;
                    return;
                }

                // agent_mode가 DRAFT 또는 COMPLETE이고, status가 IN_PROGRESS이며,
                // agent_orch가 설정되어 있으면 에이전트가 진행 중인 것으로 판단
                const validOrchs = [
                    'crewai-deep-research',
                    'deep-research-custom',
                    'deepagents',
                    'cliagents',
                    'codex',
                    'crewai-action',
                    'openai-deep-research',
                    'langchain-react',
                    'browser-automation-agent'
                ];
                this.isAgentBusy =
                    data.status === 'IN_PROGRESS' &&
                    (data.agent_mode === 'DRAFT' || data.agent_mode === 'COMPLETE') &&
                    validOrchs.includes(data.agent_orch);
            } catch (error) {
                console.error('Error checking agent busy state:', error);
                this.isAgentBusy = false;
            }
        },
        // 연구 방식 value를 orchestration method로 변환
        convertToOrchestrationMethod(researchMethod) {
            const mapping = {
                crewaiDeepResearch: 'crewai-deep-research',
                deepResearchCustom: 'deep-research-custom',
                deepagents: 'deepagents',
                codex: 'codex',
                crewaiAction: 'crewai-action',
                openaiDeepResearch: 'openai-deep-research',
                langchainReact: 'langchain-react',
                visionParse: 'visionparse'
            };
            return mapping[researchMethod] || researchMethod;
        },
        async selectResearchMethod(method) {
            this.selectedResearchMethod = method;
            this.researchMethodMenu = false;

            // 'default'인 경우 기본 동작 수행
            if (method === 'default') {
                this.beforeGenerateExample(null);
                return;
            }

            // 고급 연구 방식인 경우 AgentMonitor를 통해 처리
            const researchMethodObj = this.researchMethods.find((m) => m.value === method);
            if (researchMethodObj && researchMethodObj.advanced) {
                // 탭을 agent-monitor로 변경
                this.selectedTab = 'agent-monitor';

                // AgentMonitor가 렌더링될 때까지 대기
                await this.$nextTick();

                // AgentMonitor의 메서드 호출
                if (this.$refs.agentMonitor) {
                    const orchestrationMethod = this.convertToOrchestrationMethod(method);
                    this.$refs.agentMonitor.selectOrchestrationMethod(orchestrationMethod);

                    // startTask 호출
                    await this.$refs.agentMonitor.startTask();
                }
            }
        },
        async beforeGenerateExample(researchMethod = null) {
            // 빠른 생성 실행 시 selectedResearchMethod 설정
            if (!researchMethod) {
                this.selectedResearchMethod = 'default';
            }

            if (!this.generator) {
                this.generator = new exampleGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean',
                    researchMethod: researchMethod
                });
            } else if (researchMethod) {
                // 이미 generator가 있어도 researchMethod는 업데이트
                this.generator.researchMethod = researchMethod;
            }

            const processDefinitionId = this.processDefinition
                ? this.processDefinition.processDefinitionId
                : this.workItem?.worklist?.defId
                ? this.workItem.worklist.defId
                : null;
            const activityId = this.workItem?.activity?.tracingTag ? this.workItem.activity.tracingTag : null;
            const form = await this.backend.getFormFields(null, activityId, processDefinitionId);
            const formFields = form ? form.fields_json : [];

            this.isGeneratingExample = true;
            this.isVisionMode = false;
            this.imgKeyList = [];

            if (this.formData && typeof this.formData == 'object') {
                for (const key of Object.keys(this.formData)) {
                    const field = formFields.find((f) => f.key == key) || null;

                    if (this.formData[key] && typeof this.formData[key] == 'object') {
                        // 빈 객체가 아니면 삭제 (내용이 있으면 삭제)
                        if (Object.keys(this.formData[key]).length > 0) {
                            delete this.formData[key];
                        }
                    } else if (typeof this.formData[key] == 'string') {
                        // 빈 문자열이 아니면 삭제 (내용이 있으면 삭제)
                        if (field && field.type == 'text') {
                            if (this.formData[key].trim() !== '') {
                                delete this.formData[key];
                            }
                        } else if (field && field.type == 'number') {
                            if (this.formData[key] !== '0') {
                                delete this.formData[key];
                            }
                        }
                    }

                    if (this.formData[key] && typeof this.formData[key] == 'string' && this.formData[key].includes('data:image/')) {
                        this.imgKeyList.push(key);
                        this.isVisionMode = true;
                        this.generator.previousMessages = [];
                        const resizedImage = await this.resizeBase64Image(this.formData[key], 512, 512);
                        this.generator.previousMessages.push({
                            content: [
                                {
                                    type: 'text',
                                    text: '해당 이미지를 분석하고 이미지 분석 내용을 자세하게 한글로 설명해. 이미지에 표시된 날짜, 글자 위주로 집중 분석한 결과를 설명해. 결과는 최대한 정확하고 자세하지만 최대한 요약해서 생성해주면 좋아.'
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: resizedImage
                                    }
                                }
                            ],
                            role: 'user'
                        });
                        this.generator.model = 'gpt-4-vision-preview';
                    }
                }
            }
            if (this.isVisionMode) {
                this.generator.generate();
            } else {
                if (this.newMessage) {
                    this.generateExample(this.newMessage, 'audio');
                } else {
                    this.generateExample();
                }
            }
        },
        resetGeneratedContent() {
            // 생성 중인 상태 초기화
            this.isGeneratingExample = false;

            // 비전 모드 관련 초기화
            this.isVisionMode = false;
            this.imgKeyList = [];

            // 생성기 초기화
            if (this.generator) {
                this.generator.previousMessages = [];
                this.generator = null;
            }

            // 오디오 메시지 초기화
            this.newMessage = '';

            // 폼 데이터에서 이미지 데이터 제거
            if (this.formData && typeof this.formData === 'object') {
                for (const key of Object.keys(this.formData)) {
                    if (this.formData[key] && typeof this.formData[key] === 'string' && this.formData[key].includes('data:image/')) {
                        this.formData[key] = '';
                    }
                }
            }

            // 컴포넌트 다시 렌더링을 위한 키 업데이트
            this.updatedKey++;
        },
        async generateExample(response, type) {
            var me = this;
            this.isVisionMode = false;

            // 순차적 폼 채우기를 위한 초기화
            this.appliedFormFields = {};

            this.generator = new exampleGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });

            this.generator.model = 'gpt-4o';

            if (response) {
                if (type == 'audio') {
                    this.generator.previousMessages.push({
                        content:
                            '오디오 내용을 보고 오디오 내용을 개선해서 예시를 생성해. 오디오 내용을 기반으로 생성해야하고 오디오에 관한 언급은 하면 안돼. 오디오 내용과 생성될 내용이 달라서도 안돼. 적당한 수준의 보완, 정리만 해서 생성해.',
                        role: 'user'
                    });
                    this.generator.previousMessages.push({
                        content: '오디오 내용: ' + response,
                        role: 'user'
                    });
                } else if (type == 'vision') {
                    this.generator.previousMessages.push({
                        content: '첨부된 이미지에 대한 설명: ' + response,
                        role: 'user'
                    });
                }
            }
            if (this.inputData) {
                this.generator.previousMessages.push({
                    content: '참고 정보: ' + JSON.stringify(this.inputData),
                    role: 'user'
                });
            }
            if (this.processInstance && this.processInstance.instId) {
                const instance = await this.backend.getInstance(this.processInstance.instId);
                this.generator.previousMessages.push({
                    content: '이전 작업 내역 리스트: ' + JSON.stringify(instance),
                    role: 'user'
                });
            } else if (this.simulationInstances && this.simulationInstances.length > 0) {
                this.generator.previousMessages.push({
                    content: '이전 작업 내역 리스트: ' + JSON.stringify(this.simulationInstances),
                    role: 'user'
                });
            } else {
                this.generator.previousMessages.push({
                    content: '이전 작업 내역 리스트: []',
                    role: 'user'
                });
            }

            this.generator.previousMessages.push({
                content: '현재 작업 입력 양식: ' + this.html,
                role: 'user'
            });

            let formData = JSON.parse(JSON.stringify(me.formData));
            if (this.imgKeyList.length > 0) {
                this.imgKeyList.forEach(function (key) {
                    delete formData[key];
                });
                me.imgKeyList = [];
            }
            let formValues = {
                formValues: formData
            };
            this.generator.previousMessages.push({
                content: '생성해야할 답변 형식: ' + JSON.stringify(formValues),
                role: 'user'
            });

            // 현재 날짜 정보 추가
            const currentDate = new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            this.generator.previousMessages.push({
                content: '현재 날짜: ' + currentDate + ' (이 날짜를 기준으로 예시를 생성해주세요)',
                role: 'user'
            });

            const userList = await this.backend.getUserList();
            this.generator.previousMessages.push({
                content: '유저 목록: ' + JSON.stringify(userList),
                role: 'user'
            });
            const organization = await this.backend.getOrganization(`db://configuration/organization`, { key: 'key' });
            if (organization && organization.value) {
                this.generator.previousMessages.push({
                    content: '회사 조직도: ' + JSON.stringify(organization.value),
                    role: 'user'
                });
            }

            this.generator.generate();
        },
        onModelCreated(response) {
            //
        },
        onReceived(partialResponse) {
            // 스트리밍 중 부분적으로 받은 데이터를 실시간으로 처리
            const me = this;

            // requestAnimationFrame으로 UI 업데이트를 다음 프레임으로 미루기
            requestAnimationFrame(() => {
                try {
                    // JSON 추출 시도
                    let jsonStr = me.extractJSON(partialResponse);
                    if (!jsonStr || !jsonStr.includes('{')) return;

                    // 부분적인 JSON 파싱
                    let partialData;
                    try {
                        partialData = partialParse(jsonStr);
                    } catch (e) {
                        // 파싱 실패 시 무시
                        return;
                    }

                    // formValues가 있는지 확인
                    if (partialData && partialData.formValues && typeof partialData.formValues === 'object') {
                        const formValues = partialData.formValues;
                        const newFields = {};

                        // 새로 완성된 필드만 추출
                        for (const key in formValues) {
                            const value = formValues[key];

                            // 값이 문자열이고, 이전에 적용되지 않았거나 값이 변경된 경우
                            if (typeof value === 'string' && value.length > 0) {
                                if (!me.appliedFormFields[key] || me.appliedFormFields[key] !== value) {
                                    newFields[key] = value;
                                    me.appliedFormFields[key] = value;
                                }
                            }
                        }

                        // 새로운 필드가 있으면 폼에 적용
                        if (Object.keys(newFields).length > 0) {
                            me.EventBus.emit('form-values-updated', newFields);
                        }
                    }
                } catch (error) {
                    // 에러는 무시 (스트리밍 중이므로)
                    console.warn('onReceived 처리 중 에러:', error);
                }
            });
        },
        onGenerationFinished(response) {
            var me = this;
            me.$try({
                action: async () => {
                    if (me.isVisionMode) {
                        me.generateExample(response, 'vision');
                    } else {
                        let jsonData = response;
                        if (typeof response == 'string') {
                            jsonData = me.extractJSON(response);
                            if (jsonData && jsonData.includes('{')) {
                                try {
                                    jsonData = JSON.parse(jsonData);
                                } catch (e) {
                                    jsonData = partialParse(jsonData);
                                }
                            } else {
                                jsonData = null;
                            }
                        }
                        if (jsonData && jsonData['formValues'] && Object.keys(jsonData['formValues']).length > 0) {
                            // 순차적 업데이트에서 아직 적용되지 않은 필드만 최종 적용
                            const formValues = jsonData['formValues'];
                            const remainingFields = {};

                            for (const key in formValues) {
                                if (!me.appliedFormFields[key]) {
                                    remainingFields[key] = formValues[key];
                                }
                            }

                            // 남은 필드가 있으면 적용
                            if (Object.keys(remainingFields).length > 0) {
                                me.EventBus.emit('form-values-updated', remainingFields);
                            }
                            // 채운 초안은 바로 중간 저장한다 — 다시 열면 사라져 빈 폼이 제출되던 문제(2026-11-11 휴대폰 점검 H5)
                            me.EventBus.emit('form-autosave-request', { reason: 'quick-generate' });

                            me.agentGenerationFinished(jsonData);
                        } else {
                            me.agentGenerationFinished(null);
                        }
                        me.isGeneratingExample = false;
                        me.newMessage = null;

                        // 순차적 폼 채우기 상태 초기화
                        me.appliedFormFields = {};
                    }
                },
                successMsg: '빠른 생성이 완료되었습니다.',
                errorMsg: '초안 생성을 실패하였습니다. 잠시 후 다시 시도해주세요.',
                finalAction: () => {
                    me.isGeneratingExample = false;
                    me.newMessage = null;
                    me.appliedFormFields = {};
                }
            });
        },
        addedNewForm() {
            this.isFinishedAgentGeneration = false;
        },
        agentGenerationFinished(value) {
            if (this.isSimulate == 'true') {
                this.$emit('agentGenerationFinished', value);
                this.isFinishedAgentGeneration = true;
                setTimeout(() => {
                    this.selectedTab = 'progress';
                }, 1500);
            }
        },
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.isDryRun) {
                        me.workItem = me.dryRunWorkItem;
                        me.currentActivities = [me.workItem.activity.tracingTag];
                        if (me.processDefinition && me.processDefinition.bpmn) {
                            me.bpmn = me.processDefinition.bpmn;
                        } else if (me.isSimulate == 'true') {
                            me.bpmn = await this.backend.getRawDefinition(me.definitionId, { type: 'bpmn' });
                        } else {
                            try {
                                const execDef = await this.backend.getExecutionDefinition(me.definitionId);
                                if (execDef && execDef.bpmn) {
                                    me.bpmn = execDef.bpmn;
                                } else {
                                    me.bpmn = await this.backend.getRawDefinition(me.definitionId, { type: 'bpmn' });
                                }
                            } catch (e) {
                                me.bpmn = await this.backend.getRawDefinition(me.definitionId, { type: 'bpmn' });
                            }
                        }
                    } else {
                        me.workItem = await this.backend.getWorkItem(me.currentTaskId);
                        me.bpmn = await this.backend.getRawDefinition(me.workItem.worklist.defId, {
                            type: 'bpmn',
                            version: me.workItem.worklist.version,
                            version_tag: me.workItem.worklist.version_tag
                        });
                        // 에이전트가 답을 기다리는 업무는 질문 카드가 있는 '에이전트에 맡기기' 탭으로 바로 연다(spec 018).
                        // 탭 목록은 BPMN 이 있어야 이 탭을 포함하므로 BPMN 을 읽은 뒤에 고른다.
                        if (awaitingUserInput(me.workItem?.worklist)) me.selectedTab = 'agent-monitor';
                        if (me.workItem.worklist.execScope) me.workItem.execScope = me.workItem.worklist.execScope;
                        me.workListByInstId = await this.backend.getWorkListByInstId(me.workItem.worklist.instId);

                        let tmp = {};
                        tmp[me.workItem?.activity?.tracingTag] = 'Running';
                        me.taskStatus = tmp;

                        if (me.workItem.worklist.currentActivities) {
                            me.currentActivities = me.workItem.worklist.currentActivities;
                        } else {
                            me.currentActivities = me.workListByInstId.map((item) => item.tracingTag);
                        }

                        if (me.mode !== 'ProcessGPT') {
                            await me.loadRefForm();
                        }
                    }

                    if (me.workItem.worklist && me.workItem.worklist.instId) {
                        me.taskStatus = await this.backend.getActivitiesStatus(me.workItem.worklist.instId);
                        me.processInstance = await this.backend.getInstance(me.workItem.worklist.instId);
                    }

                    if (me.mode == 'ProcessGPT' && !me.pal) {
                        me.currentComponent = 'FormWorkItem';
                    } else {
                        const tool = me.workItem && me.workItem.activity && me.workItem.activity.tool ? me.workItem.activity.tool : '';
                        me.currentComponent = tool.includes('urlHandler')
                            ? 'URLWorkItem'
                            : tool.includes('formHandler')
                            ? 'FormWorkItem'
                            : 'DefaultWorkItem';
                    }

                    me.updatedDefKey++;
                },
                errorMsg: '워크아이템을 찾을 수 없습니다.'
            });
        },
        async loadRefForm() {
            var me = this;
            if (!me.workItem || !me.workItem.activity) return;
            if (me.workItem && me.workItem.worklist && me.workItem.activity && !me.workItem.activity.inParameterContexts) {
                const refForms = await this.backend.getRefForm(me.workItem.worklist.taskId);
                refForms.forEach((refForm) => {
                    const tabName = `${me.$t('WorkItem.previous')} (${refForm.name}) ${me.$t('WorkItem.inputForm')}`;
                    me.inFormNameTabs.push(tabName);
                    //me.inFormValues.push({'html': refForm.html, 'formData': refForm.formData});

                    const formData = refForm.formData || {};
                    me.injectDeployTargetToBpmnField(refForm.html, formData);

                    me.inFormValues.push({ html: refForm.html, formData: formData });
                    me.selectedTab = `form-0`;
                });
                return;
            }

            me.inFormNameTabs = [];
            me.inFormValues = [];

            const promises = me.workItem.activity.inParameterContexts.map(async (inParameterContext) => {
                const formName = inParameterContext.variable.name;
                const variable = await this.backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, formName);

                if (Array.isArray(variable)) {
                    const itemPromises = variable.map(async (item, idx) => {
                        const form = await this.backend.getRawDefinition(item.formDefId, { type: 'form' });
                        me.inFormNameTabs.push(item.subProcessLabel || `${formName}-${idx + 1}`);
                        //me.inFormValues.push({'html': form, 'formData': item.valueMap});

                        const formData = item.valueMap || {};
                        me.injectDeployTargetToBpmnField(form, formData);

                        me.inFormValues.push({ html: form, formData: formData });
                    });
                    await Promise.all(itemPromises);
                } else if (variable) {
                    const form = await this.backend.getRawDefinition(variable.formDefId, { type: 'form' });
                    me.inFormNameTabs.push(variable.subProcessLabel || formName);
                    //me.inFormValues.push({'html': form, 'formData': variable.valueMap});

                    const formData = variable.valueMap || {};
                    me.injectDeployTargetToBpmnField(form, formData);

                    me.inFormValues.push({ html: form, formData: formData });
                }
            });

            await Promise.all(promises);
        },
        handleResize() {
            this.windowWidth = window.innerWidth;
        },
        updateCurrentActivities(currentActivities) {
            if (!currentActivities) currentActivities = [];

            this.currentActivities = currentActivities;
            this.updatedDefKey++;
        },
        close() {
            this.$emit('close');
        },
        navigateToWorkItemByTaskId(obj) {
            var me = this;
            me.$router.push(`/todolist/${obj._item.taskId}`);
            this.$nextTick(() => {
                me.delay(500).then(() => {
                    me.init();
                    me.updatedKey++;
                });
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        executeProcess(value) {
            this.showFeedbackForm = false;
            this.$emit('executeProcess', value);
        },
        triggerExecuteProcess() {
            // 동적 컴포넌트의 executeProcess 메서드를 호출하여 폼 데이터 수집
            if (this.$refs.currentWorkItemComponent && this.$refs.currentWorkItemComponent.executeProcess) {
                this.$refs.currentWorkItemComponent.executeProcess();
            }
        },
        backToPrevStep() {
            this.$emit('backToPrevStep');
        },
        async toggleFeedback() {
            this.showFeedbackForm = !this.showFeedbackForm;
            if (this.showFeedbackForm) {
                this.formId = this.processDefinition.processDefinitionId + '_' + this.dryRunWorkItem.activity.tracingTag + '_form';
                this.simulation_data = {
                    proc_def_id: this.processDefinition.processDefinitionId,
                    element_id: this.dryRunWorkItem.activity.tracingTag
                };
                if (window.location.pathname == '/definition-map') {
                    this.tempFormHtml = localStorage.getItem(this.formId);
                } else {
                    this.tempFormHtml = await this.backend.getRawDefinition(this.formId, { type: 'form' });
                }
            }
        },
        goToDefaultForm() {
            this.$router.push('/ui-definitions/defaultform');
        },
        async loadAssigneeInfo() {
            var me = this;
            if (!me.workItem || !me.workItem.worklist || !me.workItem.worklist.taskId) {
                return;
            }

            me.$try({
                context: me,
                action: async () => {
                    try {
                        const latestWorkItem = await this.backend.getWorkItem(me.workItem.worklist.taskId);
                        if (latestWorkItem && latestWorkItem.worklist.endpoint) {
                            const endpoint = latestWorkItem.worklist.endpoint;
                            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(endpoint);
                            if (isUUID) {
                                try {
                                    const user = await this.backend.getUserById(endpoint);
                                    me.assigneeUserInfo = user ? [user] : null;
                                } catch (e) {
                                    me.assigneeUserInfo = null;
                                }
                            } else {
                                me.assigneeUserInfo = await this.backend.getUserList({
                                    orderBy: 'email',
                                    startAt: endpoint,
                                    endAt: endpoint
                                });
                            }
                        } else {
                            me.assigneeUserInfo = null;
                        }
                    } catch (error) {
                        console.log('담당자 정보 로딩 실패:', error);
                        me.assigneeUserInfo = null;
                    }
                }
            });
        },
        openDelegateTask() {
            if (!this.showDelegate) return;
            this.delegateTaskDialog = true;
        },
        closeDelegateTask() {
            this.delegateTaskDialog = false;
        },
        delegateTask(delegateUser, assigneeUserInfo, reason) {
            var me = this;
            if (!me.showDelegate) return;

            me.$try({
                context: me,
                action: async () => {
                    const previousUserId = me.workItem.worklist.endpoint;
                    const previousUsername = me.assigneeUserInfo?.[0]?.username || previousUserId;

                    if (me.mode == 'uEngine') {
                        await this.backend.delegateWorkItem(me.workItem.worklist.taskId, {
                            endpoint: delegateUser.email
                        });

                        me.workItem.worklist.endpoint = delegateUser.email;
                        me.workItem.worklist.status = 'DELEGATED';
                    } else {
                        let notificationMessage = me.$t('WorkItem.delegateMessage', {
                            taskName: me.workItem.activity.name,
                            username: delegateUser.username
                        });
                        if (assigneeUserInfo) {
                            const formattedAssigneeInfo = assigneeUserInfo.map((user) => user.username).join(',');
                            notificationMessage = me.$t('WorkItem.delegateMessageWithAssignee', {
                                taskName: me.workItem.activity.name,
                                assigneeInfo: formattedAssigneeInfo,
                                username: delegateUser.username
                            });
                        }

                        // uid 값을 백엔드로 전송
                        const userIdForBackend = delegateUser.uid;

                        // role_bindings 업데이트
                        const instance = await this.backend.getInstance(me.workItem.worklist.instId);
                        if (instance && instance.roleBindings) {
                            const roleBindings = instance.roleBindings;
                            let updated = false;

                            console.log(`담당자 변경: ${previousUserId} -> ${userIdForBackend}`);
                            console.log('현재 workItem 구조:', me.workItem);
                            console.log('role_bindings 구조:', roleBindings);

                            // 이전 담당자가 있으면 교체, 없으면 새 담당자만 추가
                            roleBindings.forEach((role) => {
                                if (role.default) {
                                    // default가 배열이 아니면 배열로 변환
                                    if (!Array.isArray(role.default)) {
                                        role.default = [role.default];
                                    }

                                    // 이전 담당자가 있으면 제거
                                    if (previousUserId && role.default.includes(previousUserId)) {
                                        role.default = role.default.filter((id) => id !== previousUserId);
                                    }
                                    // 새 담당자가 없으면 추가
                                    if (!role.default.includes(userIdForBackend)) {
                                        role.default.push(userIdForBackend);
                                        updated = true;
                                        console.log(`역할 '${role.name}'의 default에 담당자 추가됨`);
                                    }
                                }

                                if (role.endpoint) {
                                    // endpoint가 배열이 아니면 배열로 변환
                                    if (!Array.isArray(role.endpoint)) {
                                        role.endpoint = [role.endpoint];
                                    }

                                    // 이전 담당자가 있으면 제거
                                    if (previousUserId && role.endpoint.includes(previousUserId)) {
                                        role.endpoint = role.endpoint.filter((id) => id !== previousUserId);
                                    }
                                    // 새 담당자가 없으면 추가
                                    if (!role.endpoint.includes(userIdForBackend)) {
                                        role.endpoint.push(userIdForBackend);
                                        updated = true;
                                        console.log(`역할 '${role.name}'의 endpoint에 담당자 추가됨`);
                                    }
                                }
                            });

                            if (updated) {
                                await this.backend.putObject('bpm_proc_inst', {
                                    proc_inst_id: me.workItem.worklist.instId,
                                    role_bindings: roleBindings
                                });
                                console.log('역할 바인딩 업데이트 완료');
                            }
                        }

                        await Promise.all([
                            this.backend.updateInstanceChat(me.workItem.worklist.instId, {
                                name: localStorage.getItem('userName'),
                                role: 'user',
                                email: localStorage.getItem('email'),
                                image: '',
                                content: notificationMessage,
                                timeStamp: new Date().toISOString()
                            }),
                            this.backend.putWorkItem(me.workItem.worklist.taskId, {
                                user_id: userIdForBackend,
                                username: delegateUser.username
                            })
                        ]);

                        me.workItem.worklist.endpoint = userIdForBackend;
                    }

                    // 위임 이력 저장
                    try {
                        await this.backend.addDelegationHistory({
                            task_id: me.workItem.worklist.taskId,
                            from_user_id: previousUserId || localStorage.getItem('uid'),
                            from_username: previousUsername || localStorage.getItem('userName'),
                            to_user_id: delegateUser.uid || delegateUser.id,
                            to_username: delegateUser.username,
                            reason: reason || null,
                            status: 'COMPLETED'
                        });
                    } catch (historyError) {
                        console.error('위임 이력 저장 실패:', historyError);
                    }

                    me.updatedKey++;
                    me.closeDelegateTask();
                    me.loadAssigneeInfo();
                },
                successMsg: this.$t('DelegateTask.successMsg')
            });
        },
        goBackToPreviousPage() {
            // 칸반보드 탭 상태를 localStorage에 미리 저장
            localStorage.setItem('instanceCard-lastTab', 'todo');
            this.$router.go(-1);
        },
        loadInputData(data) {
            this.inputData = data;
        },
        handleReworkDialog(action) {
            var me = this;
            if (action == 'open') {
                me.$try({
                    context: me,
                    action: async () => {
                        await me.loadReworkActivities();
                        me.reworkDialog = true;
                    }
                });
            } else if (action == 'close') {
                this.reworkDialog = false;
            }
        },
        async loadReworkActivities() {
            this.reworkActivities = {
                current: [
                    {
                        id: this.workItem.activity.tracingTag,
                        name: this.workItem.activity.name
                    }
                ],
                reference: [],
                all: []
            };
            const options = {
                instanceId: this.workItem.worklist.instId,
                activityId: this.workItem.activity.tracingTag
            };
            const result = await this.backend.getReworkActivities(options);
            if (result.reference) {
                this.reworkActivities.reference = result.reference;
            }
            if (result.all) {
                this.reworkActivities.all = result.all;
            }
        },
        submitRework(activities) {
            var me = this;

            this.backend
                .reWorkItem({
                    instanceId: me.workItem.worklist.instId,
                    activities: activities,
                    activityId: me.workItem.activity.tracingTag
                })
                .then((data) => {
                    if (data) {
                        const instId = me.workItem.worklist.instId.replace(/\./g, '_DOT_');
                        me.$router.push(`/instancelist/${instId}`);
                    }
                })
                .catch((err) => {
                    console.error('재작업 요청 중 오류:', err);
                });

            me.$try({
                context: me,
                action: () => {
                    me.reworkDialog = false;
                },
                successMsg: '재작업이 요청되었습니다.'
            });
        },
        handleBrowserUseCompleted(data) {
            if (this.workItemStatus == 'COMPLETED' || this.workItemStatus == 'DONE') return;

            console.log('[WorkItem] Browser-use completed:', data);

            // generated_files 데이터를 inputData로 설정
            if (data.generatedFiles) {
                this.inputData = data.generatedFiles;
                console.log('[WorkItem] inputData 설정됨:', this.inputData);

                // ✅ 브라우저 유즈 완료 후 자동 초안 생성 제거
                // 파일이 자동으로 첨부되므로 초안 생성 시 파일이 삭제되는 문제 방지
                // this.$nextTick(() => {
                //     this.beforeGenerateExample();
                // });
                console.log('[WorkItem] 브라우저 유즈 완료 - 자동 초안 생성 스킵');
            }
        },

        // 「에이전트에 맡기기」 한 번으로 바로 시작한다 — 고르는 화면을 거치지 않는다.
        async delegateToAgent() {
            if (!this.isOwnWorkItem) return;
            const choice = pickAgentDelegation({ selected: this.selectedAgent, last: readLastAgentDelegation() });
            if (choice.orchestration === 'default') {
                this.beforeGenerateExample(null);
                return;
            }
            const run = { ...choice, agentMode: choice.agentMode.toUpperCase() };
            this.selectedTab = 'agent-monitor';
            await this.$nextTick();
            if (this.$refs.agentMonitor) {
                this.$refs.agentMonitor.selectOrchestrationMethod(run);
                await this.$refs.agentMonitor.startTask(run);
            }
        },

        triggerBasicLlmAgentFromResearchMethod() {
            const defaultSetting = useDefaultSetting();
            const basicLlmAgent = defaultSetting.getAgentList.find((agent) => agent.alias === 'default' && agent.agent_type === 'pgagent');
            if (basicLlmAgent) {
                this.updateWorkItem({
                    ...this.selectedAgent,
                    agent: basicLlmAgent.id,
                    agentMode: 'draft',
                    orchestration: basicLlmAgent.alias
                });
            }
        },

        async updateWorkItem(newVal) {
            const oldVal = {
                agent: this.workItem.worklist.agent,
                agentMode: this.workItem.worklist.agentMode,
                orchestration: this.workItem.worklist.orchestration
            };
            let changed = false;

            // oldVal과 newVal 비교
            if (newVal) {
                if (
                    oldVal.agent !== newVal.agent ||
                    oldVal.agentMode !== newVal.agentMode ||
                    oldVal.orchestration !== newVal.orchestration
                ) {
                    changed = true;
                }
            }

            if (!changed) {
                this.researchMethodMenu = false;
                return;
            }

            if (newVal && newVal.agentMode) {
                if (newVal.agentMode === 'none') {
                    this.researchMethodMenu = false;
                    return;
                }
                if (newVal.orchestration === 'default') {
                    this.researchMethodMenu = false;
                    this.beforeGenerateExample(null);
                    return;
                } else {
                    newVal.agentMode = newVal.agentMode.toUpperCase();
                }
            }

            // 탭을 agent-monitor로 변경
            this.selectedTab = 'agent-monitor';

            // AgentMonitor가 렌더링될 때까지 대기
            await this.$nextTick();

            // AgentMonitor의 메서드 호출
            if (this.$refs.agentMonitor) {
                this.$refs.agentMonitor.selectOrchestrationMethod(newVal);
                // startTask 호출
                await this.$refs.agentMonitor.startTask(newVal);
            }

            // 메뉴 닫기
            this.researchMethodMenu = false;
        }
    }
};
</script>
<style>
.primary-border {
    border-color: rgb(var(--v-theme-primary)) !important;
}

.feedback-container {
    position: absolute;
    bottom: 3px;
    right: 35px;
    display: flex;
    align-items: flex-end;
    z-index: 100;
}

.research-method-item {
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.research-method-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

.research-method-item .v-list-item-subtitle {
    white-space: normal;
    line-height: 1.4;
    margin-top: 4px;
}

.detail-component-enabled {
    pointer-events: auto !important;
    opacity: 1 !important;
}

.v-list-item--disabled .detail-component-enabled {
    pointer-events: auto !important;
    opacity: 1 !important;
}

/* 받아쓰기 막대 — 머리 줄(flex-wrap) 안에서 새 줄을 통째로 차지해 머리 바로 아래에 온다 */
.workitem-dictation-bar {
    flex: 0 0 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-top: 8px;
    padding: 6px 8px 6px 12px;
    border: 1px solid var(--cds-border);
    border-radius: 8px;
    background: var(--cds-surface-2, rgba(0, 0, 0, 0.02));
    font-size: 0.875rem;
    line-height: 1.4;
}

.workitem-dictation-bar--error {
    border-color: rgba(var(--v-theme-error), 0.35);
    background: rgba(var(--v-theme-error), 0.05);
}

/* 한 줄 — 길면 말줄임(미리 보기는 끝부분만 넘겨받는다) */
.workitem-dictation-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.workitem-dictation-time {
    flex: none;
    font-variant-numeric: tabular-nums;
    color: rgb(var(--v-theme-error));
}

.workitem-dictation-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgb(var(--v-theme-error));
}

.workitem-dictation-mic--on {
    color: rgb(var(--v-theme-error)) !important;
    border-color: rgb(var(--v-theme-error)) !important;
}

@media (prefers-reduced-motion: no-preference) {
    .workitem-dictation-dot {
        animation: workitem-dictation-pulse 1.2s ease-in-out infinite;
    }
    @keyframes workitem-dictation-pulse {
        50% {
            opacity: 0.3;
        }
    }
}
</style>

<template>
    <div v-if="!workAssistantAgentMode" style="background-color: rgba(255, 255, 255, 1)" class="chat-info-view-wrapper">
        <div class="chat-info-view-wrapper" style="min-height: 0">
            <div class="chat-info-view-area" style="min-height: 0">
                <div class="chat-info-view-area" style="position: relative; min-height: 0">
                    <slot name="custom-chat-top"></slot>
                    <slot name="custom-title" v-if="!workAssistantAgentMode">
                        <div v-if="(name && name !== '') || chatInfo">
                            <div v-if="name && name !== ''" class="d-flex gap-2 align-center">
                                <div>
                                    <h5 class="text-h5 mb-n1">{{ name }}</h5>
                                </div>
                            </div>
                            <div v-else-if="chatInfo" class="d-flex gap-2 align-center">
                                <v-avatar v-if="chatInfo.img">
                                    <img :src="chatInfo.img" width="50" />
                                </v-avatar>
                                <div class="pa-4 pb-0">
                                    <h5 class="text-h5 mb-n1">{{ $t(chatInfo.title) }}</h5>
                                    <small class="textPrimary"> {{ chatInfo.subtitle }} </small>
                                </div>
                            </div>
                            <slot name="custom-tools"></slot>
                        </div>
                        <v-divider style="margin: 0px" v-if="(name && name !== '') || chatInfo || type == 'form'" />
                    </slot>

                    <!-- 스크롤 상하단 이동 아이콘 -->
                    <div
                        v-if="showScrollTopButton"
                        style="
                            position: absolute;
                            bottom: 8px;
                            right: 8px;
                            z-index: 1000;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            pointer-events: auto;
                        "
                    >
                        <!-- 최상단 이동 -->
                        <v-icon @click="scrollToTop" color="primary" size="28" style="cursor: pointer; border-radius: 50%; padding: 4px">
                            mdi-arrow-up-circle
                            <v-tooltip activator="parent" location="left">{{ $t('chat.moveTop') }}</v-tooltip>
                        </v-icon>

                        <!-- 최하단 이동 -->
                        <v-icon @click="scrollToBottom" color="primary" size="28" style="cursor: pointer; border-radius: 50%; padding: 4px">
                            mdi-arrow-down-circle
                            <v-tooltip activator="parent" location="left">{{ $t('chat.moveBottom') }}</v-tooltip>
                        </v-icon>
                    </div>

                    <div
                        v-if="!workAssistantAgentMode"
                        ref="chatSplitContainer"
                        class="chat-split-container"
                        :class="{ 'chat-split-active': showAgentMessagePanel }"
                    >
                        <perfect-scrollbar
                            :class="[
                                'h-100 chat-view-box',
                                { 'chat-room-mode': chatRoomMode },
                                showAgentMessagePanel ? 'chat-view-box-split-left' : ''
                            ]"
                            ref="scrollContainer"
                            @scroll="handleScroll"
                        >
                            <div class="d-flex w-100" :style="$globalState.state.isRightZoomed ? 'height:100vh;' : ''">
                                <v-col class="chat-view-box-col pa-0">
                                    <!-- 커스텀 콘텐츠 슬롯 -->
                                    <slot name="custom-content"></slot>

                                    <InfoAlert :howToUseInfo="howToUseInfo" :chatInfo="chatInfo" />

                                    <!-- 참여자 현황 UI -->
                                    <div v-if="participantUsers.length > 0" class="pa-4 chat-participants-box">
                                        <h6 class="text-subtitle-1 font-weight-bold mb-2" style="color: #333">
                                            {{ $t('chat.participants') }}
                                        </h6>
                                        <v-row class="ma-0 pa-0">
                                            <div v-for="participant in participantUsers" :key="participant.id" class="mr-4">
                                                <div class="d-flex align-center">
                                                    <v-avatar size="24" class="mr-2">
                                                        <v-img
                                                            :src="participant.profile || '/images/defaultUser.png'"
                                                            :alt="participant.username"
                                                            cover
                                                        >
                                                            <template v-slot:error>
                                                                <v-img src="/images/defaultUser.png" cover>
                                                                    <template v-slot:error>
                                                                        <v-icon size="small" style="color: #666">mdi-account</v-icon>
                                                                    </template>
                                                                </v-img>
                                                            </template>
                                                        </v-img>
                                                    </v-avatar>
                                                    <div class="flex-grow-1">
                                                        <div class="text-body-2 font-weight-medium" style="color: #444">
                                                            {{ participant.username || '이름 없음' }}
                                                        </div>
                                                        <div class="text-caption" style="color: #666">
                                                            {{ participant.email || 'ID: ' + participant.id }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </v-row>
                                    </div>

                                    <div
                                        v-for="(message, index) in userFilteredMessages"
                                        :key="index"
                                        class="py-1 px-3 chat-message-row"
                                        :class="{
                                            'chat-message-row--highlight':
                                                highlightedMessageUuid && message && message.uuid === highlightedMessageUuid
                                        }"
                                        :data-msg-uuid="message && message.uuid ? message.uuid : ''"
                                    >
                                        <!-- 날짜 구분선 표시 -->
                                        <div v-if="shouldDisplayDateSeparator(message, index)" class="date-separator-container">
                                            <v-divider class="date-separator-line"></v-divider>
                                            <div class="date-separator-text">
                                                {{ formatDateSeparator(message.timeStamp) }}
                                            </div>
                                            <v-divider class="date-separator-line"></v-divider>
                                        </div>

                                        <!--
                                            HITL 생성형 UI (PDF2BPMN 워커 시작 전 단계 등 일반 ask_user)
                                            - pdf2bpmnProgress.isActive 와 무관하게 메시지에 __humanFeedback 이 첨부되면 렌더
                                            - 워커 진행 중 'waiting_for_user' 패널과 중복 회피
                                            - 제출 후에도 패널은 mounted 상태를 유지해(:submitted=true) 사용자가 무엇을 골랐는지 보이도록 함.
                                              패널 내부 selectedIds 가 보존되므로 체크 상태가 그대로 표시되고, 클릭은 비활성화된다.
                                            - questions 배열이 있으면 multi-question 모드: 각 질문을 inline 패널로 렌더하고
                                              하나의 통합 "응답 제출" 버튼으로 모든 응답을 batch 전송 (사용자 개입 1회).
                                        -->

                                        <!-- multi-question 모드: questions 배열이 있을 때 -->
                                        <div
                                            v-if="
                                                message &&
                                                message.__humanFeedback &&
                                                Array.isArray(message.__humanFeedback.questions) &&
                                                message.__humanFeedback.questions.length > 0 &&
                                                !(
                                                    pdf2bpmnProgress &&
                                                    pdf2bpmnProgress.isActive &&
                                                    (pdf2bpmnProgress.status === 'waiting_for_user' ||
                                                        (pdf2bpmnProgress.message || '').includes('사용자 확인 대기'))
                                                )
                                            "
                                            class="hitl-feedback-multi-wrap mb-2 mt-2"
                                        >
                                            <div class="hitl-multi-header">
                                                <v-icon size="18" color="primary">mdi-comment-question-outline</v-icon>
                                                <span class="hitl-multi-title">
                                                    {{ message.__humanFeedback.question || '아래 항목들에 한 번에 응답해 주세요.' }}
                                                </span>
                                                <v-chip size="x-small" variant="tonal" color="primary" class="ml-2">
                                                    {{ message.__humanFeedback.questions.length }}개 질문
                                                </v-chip>
                                            </div>

                                            <div
                                                v-for="(q, qIdx) in message.__humanFeedback.questions"
                                                :key="q.question_id || qIdx"
                                                class="hitl-multi-section"
                                            >
                                                <HumanFeedbackPanel
                                                    :ref="(el) => registerMultiPanelRef(message.uuid, qIdx, el)"
                                                    :feedbackType="q.feedback_type || 'select_items'"
                                                    :question="q.prompt || '선택해 주세요.'"
                                                    :context="q.context || ''"
                                                    :items="Array.isArray(q.items) ? q.items : []"
                                                    :suggestions="Array.isArray(q.suggestions) ? q.suggestions : (Array.isArray(q.choices) ? q.choices : [])"
                                                    :evidenceSpans="Array.isArray(q.evidence_spans) ? q.evidence_spans : []"
                                                    :impactPreview="Array.isArray(q.impact_preview) ? q.impact_preview : []"
                                                    :allowMultiple="!!q.allow_multiple"
                                                    :minSelect="typeof q.min_select === 'number' ? q.min_select : (q.feedback_type === 'select_items' ? 0 : 1)"
                                                    :allowSkip="false"
                                                    :allowOther="!!q.allow_other"
                                                    :submitted="!!message.__humanFeedback.__submitted"
                                                    :submittedText="getMultiSectionSubmittedText(message, qIdx)"
                                                    :initialSelectedIds="getMultiInitialSelectedIds(message, qIdx)"
                                                    :initialCustomText="getMultiInitialCustomText(message, qIdx)"
                                                    :hideSubmit="true"
                                                    :headerIcon="'mdi-help-circle-outline'"
                                                />
                                            </div>

                                            <div v-if="!message.__humanFeedback.__submitted" class="hitl-multi-actions">
                                                <v-spacer />
                                                <v-btn
                                                    color="primary"
                                                    size="small"
                                                    variant="flat"
                                                    @click="submitMultiHumanFeedback(message)"
                                                >
                                                    응답 제출
                                                </v-btn>
                                            </div>
                                            <div v-else class="hitl-multi-submitted">
                                                <v-icon size="14" color="success">mdi-check-circle</v-icon>
                                                <span>{{ message.__humanFeedback.__submittedText || '응답 완료' }}</span>
                                            </div>
                                        </div>

                                        <!-- single-question 모드 (기존): questions 배열이 없을 때 -->
                                        <div
                                            v-else-if="
                                                message &&
                                                message.__humanFeedback &&
                                                !(
                                                    pdf2bpmnProgress &&
                                                    pdf2bpmnProgress.isActive &&
                                                    (pdf2bpmnProgress.status === 'waiting_for_user' ||
                                                        (pdf2bpmnProgress.message || '').includes('사용자 확인 대기'))
                                                )
                                            "
                                            class="hitl-feedback-wrap mb-2 mt-2"
                                        >
                                            <HumanFeedbackPanel
                                                :feedbackType="
                                                    message.__humanFeedback.feedback_type ||
                                                    message.__humanFeedback.user_request_type ||
                                                    'approve_reject_with_edit'
                                                "
                                                :question="message.__humanFeedback.question || '확인이 필요합니다.'"
                                                :context="message.__humanFeedback.context || ''"
                                                :items="message.__humanFeedback.items || []"
                                                :suggestions="message.__humanFeedback.suggestions || []"
                                                :evidenceSpans="message.__humanFeedback.evidence_spans || []"
                                                :impactPreview="message.__humanFeedback.impact_preview || []"
                                                :allowMultiple="message.__humanFeedback.allow_multiple !== false"
                                                :minSelect="message.__humanFeedback.min_select || 1"
                                                :allowSkip="message.__humanFeedback.allow_skip || false"
                                                :allowOther="!!message.__humanFeedback.allow_other"
                                                :submitted="!!message.__humanFeedback.__submitted"
                                                :submittedText="message.__humanFeedback.__submittedText || '응답 완료'"
                                                :initialSelectedIds="message.__humanFeedback.__selectedIds || []"
                                                :initialSelectedSuggestion="message.__humanFeedback.__selectedSuggestion || null"
                                                :initialDecision="message.__humanFeedback.__decision || ''"
                                                :initialFreeText="message.__humanFeedback.__freeText || ''"
                                                :initialCustomText="message.__humanFeedback.__customText || ''"
                                                :headerIcon="'mdi-comment-question-outline'"
                                                :submitLabel="'응답 제출'"
                                                @submit="(fb) => emitHumanFeedbackSubmit(fb, message)"
                                                @skip="emitHumanFeedbackSkip"
                                            />
                                        </div>

                                        <!-- PDF2BPMN 진행 카드 (마지막 메시지 하단) -->
                                        <div
                                            v-if="
                                                chatRoomMode &&
                                                pdf2bpmnProgress &&
                                                pdf2bpmnProgress.isActive &&
                                                index === userFilteredMessages.length - 1
                                            "
                                            class="pdf2bpmn-progress-wrap mb-2"
                                        >
                                            <div class="d-flex align-center mb-1">
                                                <v-icon size="16" color="primary" class="mr-1">mdi-file-pdf-box</v-icon>
                                                <span class="text-caption font-weight-bold">PDF → BPMN 변환</span>
                                                <v-chip
                                                    size="x-small"
                                                    class="ml-2"
                                                    :color="getProgressChipColor(pdf2bpmnProgress.status)"
                                                    variant="tonal"
                                                >
                                                    {{ pdf2bpmnProgress.status }}
                                                </v-chip>
                                            </div>
                                            <v-card class="pa-3" variant="tonal">
                                                <v-progress-linear
                                                    :model-value="pdf2bpmnProgress.progress || 0"
                                                    height="8"
                                                    rounded
                                                    class="mb-2"
                                                    :color="pdf2bpmnProgress.status === 'completed' ? 'success' : 'primary'"
                                                />
                                                <div class="d-flex align-center justify-space-between">
                                                    <div class="text-caption text-medium-emphasis" style="max-width: 75%">
                                                        {{ pdf2bpmnProgress.message || '' }}
                                                    </div>
                                                    <div class="text-caption font-weight-bold">
                                                        {{ pdf2bpmnProgress.progress || 0 }}%
                                                        <v-progress-circular
                                                            v-if="pdf2bpmnProgress.status === 'processing'"
                                                            style="margin-left: 3px; margin-bottom: 3px"
                                                            indeterminate
                                                            size="12"
                                                            width="2"
                                                            color="primary"
                                                        />
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="pdf2bpmnProgress.generatedBpmns && pdf2bpmnProgress.generatedBpmns.length > 0"
                                                    class="mt-2"
                                                >
                                                    <div class="text-caption font-weight-bold mb-1">
                                                        생성된 프로세스 ({{ pdf2bpmnProgress.generatedBpmns.length }})
                                                    </div>
                                                    <div class="d-flex flex-wrap" style="gap: 8px">
                                                        <v-chip
                                                            v-for="(bpmn, bIdx) in pdf2bpmnProgress.generatedBpmns"
                                                            :key="bIdx"
                                                            size="small"
                                                            variant="tonal"
                                                            color="success"
                                                            @click="emitPreviewBpmn(bpmn)"
                                                            style="cursor: pointer"
                                                        >
                                                            <v-icon start size="14">mdi-sitemap</v-icon>
                                                            {{ bpmn.process_name || bpmn.process_id }}
                                                        </v-chip>
                                                    </div>
                                                </div>

                                                <!-- HITL 질문 카드: PDF2BPMN 로딩 UI 내부.
                                                     제출 후에도 카드는 유지(:submitted=true) — 어떤 옵션을 골랐는지 보이도록 -->
                                                <div
                                                    v-if="
                                                        pendingHumanFeedback &&
                                                        (pdf2bpmnProgress.status === 'waiting_for_user' ||
                                                            (pdf2bpmnProgress.message || '').includes('사용자 확인 대기'))
                                                    "
                                                    class="mt-3"
                                                >
                                                    <HumanFeedbackPanel
                                                        :feedbackType="
                                                            pendingHumanFeedback.feedback_type ||
                                                            pendingHumanFeedback.user_request_type ||
                                                            'approve_reject_with_edit'
                                                        "
                                                        :question="pendingHumanFeedback.question || '확인이 필요합니다.'"
                                                        :context="pendingHumanFeedback.context || ''"
                                                        :items="pendingHumanFeedback.items || []"
                                                        :suggestions="pendingHumanFeedback.suggestions || []"
                                                        :evidenceSpans="pendingHumanFeedback.evidence_spans || []"
                                                        :impactPreview="pendingHumanFeedback.impact_preview || []"
                                                        :allowMultiple="pendingHumanFeedback.allow_multiple !== false"
                                                        :minSelect="pendingHumanFeedback.min_select || 1"
                                                        :allowSkip="pendingHumanFeedback.allow_skip || false"
                                                        :allowOther="!!pendingHumanFeedback.allow_other"
                                                        :submitted="!!pendingHumanFeedback.__submitted"
                                                        :submittedText="pendingHumanFeedback.__submittedText || '응답 완료'"
                                                        :initialSelectedIds="pendingHumanFeedback.__selectedIds || []"
                                                        :initialSelectedSuggestion="pendingHumanFeedback.__selectedSuggestion || null"
                                                        :initialDecision="pendingHumanFeedback.__decision || ''"
                                                        :initialFreeText="pendingHumanFeedback.__freeText || ''"
                                                        :initialCustomText="pendingHumanFeedback.__customText || ''"
                                                        :headerIcon="'mdi-file-document-edit-outline'"
                                                        :submitLabel="'응답 제출'"
                                                        @submit="emitHumanFeedbackSubmit"
                                                        @skip="emitHumanFeedbackSkip"
                                                    />
                                                </div>
                                            </v-card>
                                        </div>

                                        <!-- 라우팅(에이전트 선정) 로딩: 아바타/헤더 없이 '...' 버블만 표시(상대방 버블 색상과 동일) -->
                                        <div v-if="message && message.__routingLoading">
                                            <div class="message-bubble-wrap message-bubble-wrap--other">
                                                <v-sheet class="other-message rounded-md pa-0 chat-message-bubble">
                                                    <div class="pa-2">
                                                        <pre class="text-body-1 routing-loading-text">{{ message.content || '...' }}</pre>
                                                    </div>
                                                </v-sheet>
                                            </div>
                                        </div>

                                        <div v-else>
                                            <!-- 라우팅(에이전트 선정) 로딩: 아바타/헤더 없이 '...' 버블만 표시(상대방 버블 색상과 동일) -->
                                            <div v-if="message && message.__routingLoading">
                                                <div class="message-bubble-wrap message-bubble-wrap--other">
                                                    <v-sheet class="other-message rounded-md pa-0 chat-message-bubble">
                                                        <div class="pa-2">
                                                            <pre class="text-body-1 routing-loading-text">{{
                                                                message.content || '...'
                                                            }}</pre>
                                                        </div>
                                                    </v-sheet>
                                                </div>
                                            </div>

                                            <!-- 자동 추천(초대) 카드 -->
                                            <div
                                                v-else-if="
                                                    message &&
                                                    message.__agentInviteRecommendation &&
                                                    Array.isArray(message.__agentInviteRecommendation.recommendedAgents) &&
                                                    message.__agentInviteRecommendation.recommendedAgents.length > 0
                                                "
                                            >
                                                <div class="message-bubble-wrap message-bubble-wrap--other">
                                                    <v-sheet class="other-message rounded-md pa-0 chat-message-bubble">
                                                        <div class="pa-3">
                                                            <div class="text-body-2 font-weight-bold mb-1">
                                                                적절한 담당자를 초대해볼까요?
                                                            </div>
                                                            <div
                                                                v-if="
                                                                    (message?.__agentInviteRecommendation?.reason || '').toString().trim()
                                                                "
                                                                class="text-caption text-medium-emphasis mb-3"
                                                            >
                                                                {{ message?.__agentInviteRecommendation?.reason }}
                                                            </div>

                                                            <div
                                                                v-for="agent in message?.__agentInviteRecommendation?.recommendedAgents ||
                                                                []"
                                                                :key="agent.id"
                                                                class="d-flex align-center justify-space-between mb-2"
                                                                style="gap: 12px"
                                                            >
                                                                <div class="d-flex align-center" style="gap: 10px; min-width: 0">
                                                                    <v-avatar size="26" color="grey-lighten-3">
                                                                        <v-img :src="agent.profile || '/images/chat-icon.png'" cover />
                                                                    </v-avatar>
                                                                    <div style="min-width: 0">
                                                                        <div class="text-body-2 font-weight-medium">
                                                                            {{ agent.username || agent.id }}
                                                                        </div>
                                                                        <div
                                                                            class="text-caption text-medium-emphasis"
                                                                            style="
                                                                                white-space: nowrap;
                                                                                overflow: hidden;
                                                                                text-overflow: ellipsis;
                                                                            "
                                                                        >
                                                                            {{ agent.role || agent.description || agent.goal || '' }}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <v-btn
                                                                    size="small"
                                                                    variant="tonal"
                                                                    color="primary"
                                                                    :disabled="isRecommendationInvited(message, agent.id)"
                                                                    @click="inviteAgentFromRecommendation(message, agent)"
                                                                >
                                                                    {{ isRecommendationInvited(message, agent.id) ? '초대됨' : '초대' }}
                                                                </v-btn>
                                                            </div>

                                                            <div class="text-caption text-medium-emphasis mt-1">
                                                                초대하면 에이전트가 준비된 뒤 방금 요청을 자동으로 처리합니다.
                                                            </div>
                                                        </div>
                                                    </v-sheet>
                                                </div>
                                            </div>

                                            <AgentsChat
                                                v-else-if="message && message._template === 'agent'"
                                                :message="message"
                                                :agentInfo="agentInfo"
                                                :totalSize="userFilteredMessages.length"
                                                :currentIndex="index"
                                            />
                                            <div v-else>
                                                <div>
                                                    <div v-if="message.email == userInfo.email && message.role != 'system'">
                                                        <div v-if="editIndex === index" class="d-flex justify-end">
                                                            <div class="bg-lightprimary chat-room-edit-wrap" style="border-radius: 10px">
                                                                <v-textarea
                                                                    v-model="messages[index].content"
                                                                    variant="solo"
                                                                    hide-details
                                                                    bg-color="lightprimary"
                                                                    class="shadow-none"
                                                                    density="compact"
                                                                    auto-grow
                                                                    rows="1"
                                                                    autofocus
                                                                >
                                                                </v-textarea>
                                                                <v-row class="pa-0 ma-0 mr-2 pb-2">
                                                                    <v-spacer></v-spacer>
                                                                    <v-btn
                                                                        @click="send"
                                                                        class="text-medium-emphasis"
                                                                        icon
                                                                        variant="text"
                                                                        size="x-small"
                                                                        style="background-color: white !important; margin-right: 5px"
                                                                    >
                                                                        <SendIcon size="20" />
                                                                    </v-btn>
                                                                    <v-btn
                                                                        @click="cancel"
                                                                        class="text-medium-emphasis"
                                                                        icon
                                                                        variant="text"
                                                                        size="x-small"
                                                                        style="background-color: white !important"
                                                                    >
                                                                        <Icons :icon="'backspace-bold'" :size="20" />
                                                                    </v-btn>
                                                                </v-row>
                                                            </div>
                                                        </div>

                                                        <div v-else>
                                                            <div class="d-flex justify-end">
                                                                <slot name="custom-message-actions" :message="message"></slot>
                                                                <div
                                                                    v-if="chatRoomMode"
                                                                    class="message-bubble-wrap message-bubble-wrap--mine"
                                                                    @mouseenter="hoverIndex = index"
                                                                    @mouseleave="hoverIndex = -1"
                                                                >
                                                                    <div
                                                                        class="chat-room-timestamp-action my-timestamp"
                                                                        :class="{ 'is-hover': hoverIndex === index, 'is-mobile': isMobile }"
                                                                    >
                                                                        <span
                                                                            class="chat-room-timestamp-text"
                                                                            :style="
                                                                                shouldDisplayMessageTimestamp(message, index)
                                                                                    ? ''
                                                                                    : 'opacity:0;'
                                                                            "
                                                                        >
                                                                            {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                        </span>
                                                                        <div
                                                                            class="chat-room-actions-overlay chat-room-actions-overlay--mine"
                                                                        >
                                                                            <v-btn
                                                                                v-if="!disableChat"
                                                                                @click="beforeReply(message)"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-subdirectory-arrow-right</v-icon>
                                                                            </v-btn>
                                                                            <v-btn
                                                                                v-if="!disableChat"
                                                                                @click="editMessage(index)"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-pencil</v-icon>
                                                                            </v-btn>
                                                                            <v-btn
                                                                                v-if="
                                                                                    shouldDisplayGeneratedWorkList(
                                                                                        type,
                                                                                        userFilteredMessages,
                                                                                        generatedWorkList,
                                                                                        index
                                                                                    )
                                                                                "
                                                                                @click="showGeneratedWorkList = !showGeneratedWorkList"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-text-box-search-outline</v-icon>
                                                                            </v-btn>
                                                                        </div>
                                                                    </div>
                                                                    <v-sheet
                                                                        class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1"
                                                                    >
                                                                        <div>
                                                                            <div
                                                                                v-if="message.replyUserName || message.replyContent"
                                                                                class="reply-quote reply-quote--mine"
                                                                                role="button"
                                                                                tabindex="0"
                                                                                @click.stop="scrollToOriginalMessage(message.replyUuid)"
                                                                            >
                                                                                <div class="reply-quote__body">
                                                                                    <div class="reply-quote__title">
                                                                                        {{ (message.replyUserName || '').toString()
                                                                                        }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                                    </div>
                                                                                    <div class="reply-quote__text">
                                                                                        {{ message.replyContent || '' }}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <!-- 첨부(이미지/파일): content가 비어도 메시지 박스로 표시/답장 가능 -->
                                                                            <div
                                                                                v-if="
                                                                                    message.image ||
                                                                                    (message.images && message.images.length > 0) ||
                                                                                    getMessageFiles(message).length > 0
                                                                                "
                                                                                class="mb-2"
                                                                            >
                                                                                <!-- 단일 이미지 표시 (기존 호환성) -->
                                                                                <v-sheet
                                                                                    v-if="message.image && !message.images"
                                                                                    class="mb-1"
                                                                                >
                                                                                    <img
                                                                                        :src="message.image"
                                                                                        class="rounded-md"
                                                                                        alt="pro"
                                                                                        width="250"
                                                                                        style="cursor: pointer"
                                                                                        @click="emitPreviewImage(message.image)"
                                                                                    />
                                                                                </v-sheet>

                                                                                <!-- 다중 이미지 표시 -->
                                                                                <div
                                                                                    v-if="message.images && message.images.length > 0"
                                                                                    class="d-flex flex-wrap mb-1"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(image, imgIndex) in message.images"
                                                                                        :key="imgIndex"
                                                                                        class="ma-1"
                                                                                    >
                                                                                        <img
                                                                                            :src="image.url || image"
                                                                                            class="rounded-md"
                                                                                            alt="pro"
                                                                                            width="250"
                                                                                            style="cursor: pointer"
                                                                                            @click="emitPreviewImage(image.url || image)"
                                                                                        />
                                                                                    </v-sheet>
                                                                                </div>

                                                                                <!-- 파일 첨부(다중 지원) -->
                                                                                <div
                                                                                    v-if="getMessageFiles(message).length > 0"
                                                                                    class="mb-1 d-flex justify-end flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(attachedFile, fileIdx) in getMessageFiles(
                                                                                            message
                                                                                        )"
                                                                                        :key="`msg-file-${index}-${fileIdx}`"
                                                                                        rounded="lg"
                                                                                        class="pa-2 d-inline-flex align-center"
                                                                                        style="
                                                                                            gap: 10px;
                                                                                            cursor: pointer;
                                                                                            border: 1px solid rgba(0, 0, 0, 0.08);
                                                                                            background: white;
                                                                                            max-width: min(520px, 80vw);
                                                                                        "
                                                                                        @click="
                                                                                            emitOpenExternalUrl(
                                                                                                attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                            )
                                                                                        "
                                                                                    >
                                                                                        <div
                                                                                            style="
                                                                                                width: 28px;
                                                                                                height: 28px;
                                                                                                border-radius: 10px;
                                                                                                display: flex;
                                                                                                align-items: center;
                                                                                                justify-content: center;
                                                                                                background: rgba(
                                                                                                    var(--v-theme-primary),
                                                                                                    0.12
                                                                                                );
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="18" color="primary"
                                                                                                >mdi-file-outline</v-icon
                                                                                            >
                                                                                        </div>
                                                                                        <div style="min-width: 0; flex: 1 1 auto">
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 13px;
                                                                                                    font-weight: 700;
                                                                                                    color: rgba(0, 0, 0, 0.78);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{
                                                                                                    attachedFile.name ||
                                                                                                    attachedFile.fileName ||
                                                                                                    '첨부파일'
                                                                                                }}
                                                                                            </div>
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 11px;
                                                                                                    color: rgba(0, 0, 0, 0.55);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{ formatAttachmentSub(attachedFile) }}
                                                                                            </div>
                                                                                        </div>
                                                                                        <v-btn
                                                                                            icon
                                                                                            size="x-small"
                                                                                            variant="tonal"
                                                                                            :disabled="
                                                                                                !(
                                                                                                    attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                                )
                                                                                            "
                                                                                            @click.stop="
                                                                                                downloadAttachment(
                                                                                                    attachedFile.url ||
                                                                                                        attachedFile.fileUrl ||
                                                                                                        attachedFile.publicUrl ||
                                                                                                        attachedFile.signedUrl,
                                                                                                    attachedFile.name ||
                                                                                                        attachedFile.fileName
                                                                                                )
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="14">mdi-download</v-icon>
                                                                                        </v-btn>
                                                                                    </v-sheet>
                                                                                </div>
                                                                            </div>

                                                                            <div
                                                                                v-if="message.contentType && message.contentType == 'html'"
                                                                                class="w-100"
                                                                            >
                                                                                <SummaryButton>
                                                                                    <DynamicForm
                                                                                        ref="dynamicForm"
                                                                                        :formHTML="message.htmlContent"
                                                                                        v-model="message.jsonContent"
                                                                                        :readonly="true"
                                                                                    ></DynamicForm>
                                                                                </SummaryButton>
                                                                            </div>

                                                                            <!-- 메시지 내 멘션 표시(Primary) -->
                                                                            <div
                                                                                v-if="
                                                                                    message.mentionedUsers &&
                                                                                    message.mentionedUsers.length > 0
                                                                                "
                                                                                class="message-mention-chip-row"
                                                                            >
                                                                                <v-chip
                                                                                    v-for="u in message.mentionedUsers"
                                                                                    :key="u.id || u.email || u.username"
                                                                                    color="primary"
                                                                                    variant="tonal"
                                                                                    size="x-small"
                                                                                    class="message-mention-chip"
                                                                                >
                                                                                    {{ u.username || u.mentionText || u.email || u.id }}
                                                                                </v-chip>
                                                                            </div>
                                                                            <pre
                                                                                v-if="message.content && message.contentType != 'html'"
                                                                                class="text-body-1"
                                                                                v-html="linkify(message.content)"
                                                                            ></pre>
                                                                            <div v-if="message.openuiLang" class="mt-2">
                                                                                <OpenUiRenderer
                                                                                    :response="message.openuiLang"
                                                                                    :isStreaming="Boolean(message.openuiIsStreaming)"
                                                                                    @action="handleOpenUiAction(message, $event)"
                                                                                    @state-update="handleOpenUiStateUpdate(message, $event)"
                                                                                    @parse-result="handleOpenUiParseResult(message, $event)"
                                                                                />
                                                                            </div>

                                                                            <pre
                                                                                v-if="message.jsonContent && message.contentType != 'html'"
                                                                                class="text-body-1"
                                                                                >{{ message.jsonContent }}</pre
                                                                            >
                                                                            <v-row class="ma-0 pa-0">
                                                                                <v-spacer></v-spacer>
                                                                            </v-row>
                                                                        </div>
                                                                    </v-sheet>
                                                                </div>
                                                                <div v-else class="message-bubble-wrap message-bubble-wrap--mine">
                                                                    <v-sheet
                                                                        class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1"
                                                                    >
                                                                        <div @mouseover="hoverIndex = index" @mouseleave="hoverIndex = -1">
                                                                            <div
                                                                                v-if="message.replyUserName || message.replyContent"
                                                                                class="reply-quote reply-quote--mine"
                                                                                role="button"
                                                                                tabindex="0"
                                                                                @click.stop="scrollToOriginalMessage(message.replyUuid)"
                                                                            >
                                                                                <div class="reply-quote__body">
                                                                                    <div class="reply-quote__title">
                                                                                        {{ (message.replyUserName || '').toString()
                                                                                        }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                                    </div>
                                                                                    <div class="reply-quote__text">
                                                                                        {{ message.replyContent || '' }}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <!-- 첨부(이미지/파일): content가 비어도 메시지 박스로 표시 -->
                                                                            <div
                                                                                v-if="
                                                                                    message.image ||
                                                                                    (message.images && message.images.length > 0) ||
                                                                                    getMessageFiles(message).length > 0
                                                                                "
                                                                                class="mb-2"
                                                                            >
                                                                                <v-sheet
                                                                                    v-if="message.image && !message.images"
                                                                                    class="mb-1"
                                                                                >
                                                                                    <img
                                                                                        :src="message.image"
                                                                                        class="rounded-md"
                                                                                        alt="pro"
                                                                                        width="250"
                                                                                        style="cursor: pointer"
                                                                                        @click="emitPreviewImage(message.image)"
                                                                                    />
                                                                                </v-sheet>
                                                                                <div
                                                                                    v-if="message.images && message.images.length > 0"
                                                                                    class="d-flex flex-wrap mb-1"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(image, imgIndex) in message.images"
                                                                                        :key="imgIndex"
                                                                                        class="ma-1"
                                                                                    >
                                                                                        <img
                                                                                            :src="image.url || image"
                                                                                            class="rounded-md"
                                                                                            alt="pro"
                                                                                            width="250"
                                                                                            style="cursor: pointer"
                                                                                            @click="emitPreviewImage(image.url || image)"
                                                                                        />
                                                                                    </v-sheet>
                                                                                </div>
                                                                                <div
                                                                                    v-if="getMessageFiles(message).length > 0"
                                                                                    class="mb-1 d-flex justify-end flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(attachedFile, fileIdx) in getMessageFiles(
                                                                                            message
                                                                                        )"
                                                                                        :key="`msg-file-mine-${index}-${fileIdx}`"
                                                                                        rounded="lg"
                                                                                        class="pa-2 d-inline-flex align-center"
                                                                                        style="
                                                                                            gap: 10px;
                                                                                            cursor: pointer;
                                                                                            border: 1px solid rgba(0, 0, 0, 0.08);
                                                                                            background: rgba(var(--v-theme-primary), 0.06);
                                                                                            max-width: min(520px, 80vw);
                                                                                        "
                                                                                        @click="
                                                                                            emitOpenExternalUrl(
                                                                                                attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                            )
                                                                                        "
                                                                                    >
                                                                                        <div
                                                                                            style="
                                                                                                width: 28px;
                                                                                                height: 28px;
                                                                                                border-radius: 10px;
                                                                                                display: flex;
                                                                                                align-items: center;
                                                                                                justify-content: center;
                                                                                                background: rgba(
                                                                                                    var(--v-theme-primary),
                                                                                                    0.12
                                                                                                );
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="18" color="primary"
                                                                                                >mdi-file-outline</v-icon
                                                                                            >
                                                                                        </div>
                                                                                        <div style="min-width: 0; flex: 1 1 auto">
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 13px;
                                                                                                    font-weight: 700;
                                                                                                    color: rgba(0, 0, 0, 0.78);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{
                                                                                                    attachedFile.name ||
                                                                                                    attachedFile.fileName ||
                                                                                                    '첨부파일'
                                                                                                }}
                                                                                            </div>
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 11px;
                                                                                                    color: rgba(0, 0, 0, 0.55);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{ formatAttachmentSub(attachedFile) }}
                                                                                            </div>
                                                                                        </div>
                                                                                        <v-btn
                                                                                            icon
                                                                                            size="x-small"
                                                                                            variant="tonal"
                                                                                            :disabled="
                                                                                                !(
                                                                                                    attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                                )
                                                                                            "
                                                                                            @click.stop="
                                                                                                downloadAttachment(
                                                                                                    attachedFile.url ||
                                                                                                        attachedFile.fileUrl ||
                                                                                                        attachedFile.publicUrl ||
                                                                                                        attachedFile.signedUrl,
                                                                                                    attachedFile.name ||
                                                                                                        attachedFile.fileName
                                                                                                )
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="14">mdi-download</v-icon>
                                                                                        </v-btn>
                                                                                    </v-sheet>
                                                                                </div>
                                                                            </div>

                                                                            <div
                                                                                v-if="message.contentType && message.contentType == 'html'"
                                                                                class="w-100"
                                                                            >
                                                                                <SummaryButton>
                                                                                    <DynamicForm
                                                                                        ref="dynamicForm"
                                                                                        :formHTML="message.htmlContent"
                                                                                        v-model="message.jsonContent"
                                                                                        :readonly="true"
                                                                                    ></DynamicForm>
                                                                                </SummaryButton>
                                                                            </div>

                                                                            <!-- 메시지 내 멘션 표시(Primary) -->
                                                                            <div
                                                                                v-if="
                                                                                    message.mentionedUsers &&
                                                                                    message.mentionedUsers.length > 0
                                                                                "
                                                                                class="message-mention-chip-row"
                                                                            >
                                                                                <v-chip
                                                                                    v-for="u in message.mentionedUsers"
                                                                                    :key="u.id || u.email || u.username"
                                                                                    color="primary"
                                                                                    variant="tonal"
                                                                                    size="x-small"
                                                                                    class="message-mention-chip"
                                                                                >
                                                                                    {{ u.username || u.mentionText || u.email || u.id }}
                                                                                </v-chip>
                                                                            </div>
                                                                            <pre
                                                                                v-if="message.content && message.contentType != 'html'"
                                                                                class="text-body-1"
                                                                                v-html="linkify(message.content)"
                                                                            ></pre>

                                                                            <pre
                                                                                v-if="message.jsonContent && message.contentType != 'html'"
                                                                                class="text-body-1"
                                                                                >{{ message.jsonContent }}</pre
                                                                            >
                                                                            <v-row class="ma-0 pa-0">
                                                                                <v-spacer></v-spacer>
                                                                                <v-btn
                                                                                    v-if="hoverIndex === index && !disableChat"
                                                                                    @click="editMessage(index)"
                                                                                    icon
                                                                                    variant="text"
                                                                                    size="x-small"
                                                                                    class="float-left edit-btn action-btn"
                                                                                    style="background-color: white"
                                                                                >
                                                                                    <icons :icon="'pencil'" :size="20" />
                                                                                </v-btn>

                                                                                <div
                                                                                    v-if="
                                                                                        shouldDisplayGeneratedWorkList(
                                                                                            type,
                                                                                            userFilteredMessages,
                                                                                            generatedWorkList,
                                                                                            index
                                                                                        )
                                                                                    "
                                                                                    :key="isRender"
                                                                                >
                                                                                    <div
                                                                                        @click="
                                                                                            showGeneratedWorkList = !showGeneratedWorkList
                                                                                        "
                                                                                        class="find-message"
                                                                                        :class="
                                                                                            generatedWorkList.length > 0
                                                                                                ? 'find-message-on'
                                                                                                : 'find-message-off'
                                                                                        "
                                                                                    >
                                                                                        <img
                                                                                            src="@/assets/images/chat/chat-icon.png"
                                                                                            style="height: 30px"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            </v-row>
                                                                        </div>
                                                                    </v-sheet>
                                                                    <div
                                                                        v-if="shouldDisplayMessageTimestamp(message, index)"
                                                                        class="message-timestamp my-timestamp"
                                                                    >
                                                                        {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <v-card
                                                            v-if="
                                                                showGeneratedWorkList &&
                                                                shouldDisplayGeneratedWorkList(
                                                                    type,
                                                                    userFilteredMessages,
                                                                    generatedWorkList,
                                                                    index
                                                                ) &&
                                                                generatedWorkList.length > 0
                                                            "
                                                            class="mt-3"
                                                        >
                                                            <v-btn
                                                                @click="deleteAllWorkList()"
                                                                size="small"
                                                                icon
                                                                density="comfortable"
                                                                style="position: absolute; right: 5px; top: 5px; z-index: 1"
                                                            >
                                                                <Icons :icon="'trash'" />
                                                            </v-btn>
                                                            <v-list>
                                                                <div>
                                                                    <v-list-item
                                                                        v-for="(work, index) in generatedWorkList"
                                                                        :key="index"
                                                                        class="d-flex align-items-center"
                                                                    >
                                                                        <div
                                                                            v-if="work.messageForUser"
                                                                            class="flex-grow-1 d-flex align-items-center"
                                                                        >
                                                                            <div class="w-100">
                                                                                <v-row class="ma-0 pa-3">
                                                                                    <template v-if="!workIcons[work.work]">
                                                                                        <img
                                                                                            :src="defaultWorkIcon"
                                                                                            alt="Default Icon"
                                                                                            style="width: 20px; height: 20px"
                                                                                        />
                                                                                    </template>
                                                                                    <template v-else>
                                                                                        <div style="padding-top: 2px">
                                                                                            <Icons :icon="getWorkIcon(work.work)" />
                                                                                        </div>
                                                                                    </template>
                                                                                    <div style="margin-left: 5px; margin-top: 0px">
                                                                                        {{ work.messageForUser }}
                                                                                    </div>
                                                                                    <div>
                                                                                        <v-tooltip
                                                                                            v-if="!isViewMode"
                                                                                            :text="$t('chat.viewDetails')"
                                                                                        >
                                                                                            <template v-slot:activator="{ props }">
                                                                                                <v-btn
                                                                                                    v-bind="props"
                                                                                                    @click="work.expanded = !work.expanded"
                                                                                                    class="ml-2"
                                                                                                    size="small"
                                                                                                    icon
                                                                                                    variant="text"
                                                                                                    density="comfortable"
                                                                                                >
                                                                                                    <icons
                                                                                                        :icon="
                                                                                                            work.expanded
                                                                                                                ? 'arrow-up-2'
                                                                                                                : 'arrow-down-2'
                                                                                                        "
                                                                                                    />
                                                                                                </v-btn>
                                                                                            </template>
                                                                                        </v-tooltip>
                                                                                        <v-tooltip
                                                                                            v-if="!isViewMode"
                                                                                            :text="$t('chat.executeProcess')"
                                                                                        >
                                                                                            <template v-slot:activator="{ props }">
                                                                                                <v-btn
                                                                                                    v-bind="props"
                                                                                                    @click="startProcess(work, index)"
                                                                                                    class="ml-2"
                                                                                                    size="small"
                                                                                                    icon
                                                                                                    variant="text"
                                                                                                    density="comfortable"
                                                                                                >
                                                                                                    <Icons
                                                                                                        :icon="'play'"
                                                                                                        :color="'rgb(var(--v-theme-primary))'"
                                                                                                    />
                                                                                                </v-btn>
                                                                                            </template>
                                                                                        </v-tooltip>
                                                                                    </div>
                                                                                </v-row>
                                                                                <v-expand-transition>
                                                                                    <div v-if="work.expanded" class="mt-2 w-100">
                                                                                        <pre>{{ work }}</pre>
                                                                                    </div>
                                                                                </v-expand-transition>
                                                                                <!-- <v-img
                                                                            v-if="work.work == 'CreateProcessDefinition'"
                                                                            :width="300"
                                                                            aspect-ratio="16/9"
                                                                            cover
                                                                            src="https://github.com/jhyg/project-shop-test/assets/65217813/1b551056-0428-41b6-9b90-76dd7942affc"
                                                                        ></v-img> -->
                                                                            </div>
                                                                        </div>
                                                                        <v-divider v-if="index < generatedWorkList.length - 1"></v-divider>
                                                                    </v-list-item>
                                                                </div>
                                                            </v-list>
                                                        </v-card>
                                                    </div>
                                                    <!-- chat 관련 UI가 위 아래 붙기때문에 적용했던 스타일 필요시 다시 삽입 :style="shouldDisplayUserInfo(message, index) ? '' : 'margin-top: -20px;'" -->
                                                    <div v-else-if="!message.disableMsg || message.isLoading">
                                                        <v-row v-if="shouldDisplayUserInfo(message, index)" class="ma-0 pa-0">
                                                            <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                                                <v-avatar size="28" style="margin-right: 8px">
                                                                    <img
                                                                        v-if="message.role == 'system'"
                                                                        src="@/assets/images/chat/chat-icon.png"
                                                                        height="28"
                                                                        width="28"
                                                                    />
                                                                    <v-img
                                                                        v-else
                                                                        :src="getProfile(message)"
                                                                        :alt="
                                                                            message.name ||
                                                                            message.userName ||
                                                                            message.username ||
                                                                            message.email ||
                                                                            'User'
                                                                        "
                                                                        height="28"
                                                                        width="28"
                                                                    />
                                                                </v-avatar>
                                                                <div class="user-name">
                                                                    {{
                                                                        message.role == 'system'
                                                                            ? 'System'
                                                                            : message.name ||
                                                                              message.userName ||
                                                                              message.username ||
                                                                              message.email
                                                                    }}
                                                                </div>
                                                            </v-row>
                                                        </v-row>

                                                        <div
                                                            v-if="message.contentType && message.contentType == 'html'"
                                                            style="margin-bottom: 15px"
                                                        >
                                                            <DynamicForm
                                                                ref="dynamicForm"
                                                                :formHTML="message.htmlContent"
                                                                v-model="message.jsonContent"
                                                                :readonly="true"
                                                            ></DynamicForm>
                                                        </div>

                                                        <div
                                                            v-else-if="
                                                                message.contentType && message.contentType == 'json' && type == 'instances'
                                                            "
                                                        >
                                                            <ProcessWorkResult :message="message" />
                                                        </div>

                                                        <!-- markdown message -->
                                                        <div
                                                            v-else-if="
                                                                markdownEnabled &&
                                                                ((message.contentType && message.contentType == 'markdown') ||
                                                                    (message.role == 'system' && !message.contentType))
                                                            "
                                                            :class="
                                                                agentMessage || message.role == 'system' ? 'agent-message' : 'other-message'
                                                            "
                                                        >
                                                            <div
                                                                v-if="message.content"
                                                                v-html="renderedMarkdown(message.content)"
                                                                class="markdown-content"
                                                            ></div>
                                                            <div v-if="message.openuiLang" class="mt-2">
                                                                <OpenUiRenderer
                                                                    :response="message.openuiLang"
                                                                    :isStreaming="Boolean(message.openuiIsStreaming)"
                                                                    @action="handleOpenUiAction(message, $event)"
                                                                    @state-update="handleOpenUiStateUpdate(message, $event)"
                                                                    @parse-result="handleOpenUiParseResult(message, $event)"
                                                                />
                                                            </div>

                                                            <div
                                                                v-if="shouldDisplayMessageTimestamp(message, index)"
                                                                class="markdown-timestamp"
                                                            >
                                                                {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                            </div>

                                                            <!-- 프로세스 실행 폼 -->
                                                            <div
                                                                v-if="message.work === 'StartProcessInstance' && message.firstActivityForm"
                                                                class="mt-3 pl-3 pr-3"
                                                            >
                                                                <v-card variant="outlined" class="mb-3">
                                                                    <v-card-title class="text-subtitle-1 py-2">
                                                                        {{ message.firstActivityForm.activityName || '초기 정보 입력' }}
                                                                    </v-card-title>
                                                                    <v-divider></v-divider>
                                                                    <v-card-text class="pa-3">
                                                                        <!-- formHtml이 있는 경우 DynamicForm 사용 -->
                                                                        <div
                                                                            v-if="message.firstActivityForm.formHtml"
                                                                            class="form-container"
                                                                        >
                                                                            <DynamicForm
                                                                                :formHTML="message.firstActivityForm.formHtml"
                                                                                v-model="message.formValues"
                                                                                :readonly="false"
                                                                            ></DynamicForm>
                                                                        </div>

                                                                        <!-- 폼 정보가 없는 경우 -->
                                                                        <div v-else class="text-caption text-grey">
                                                                            추가 입력 정보가 필요하지 않습니다.
                                                                        </div>
                                                                    </v-card-text>
                                                                </v-card>

                                                                <v-btn
                                                                    color="primary"
                                                                    variant="elevated"
                                                                    size="default"
                                                                    @click="executeProcessInstance(message, index)"
                                                                    :loading="message.executing"
                                                                    :disabled="message.executed"
                                                                >
                                                                    <v-icon left class="mr-1">{{
                                                                        message.executed ? 'mdi-check' : 'mdi-play'
                                                                    }}</v-icon>
                                                                    {{ message.executed ? '실행 완료' : '프로세스 실행' }}
                                                                </v-btn>
                                                            </div>

                                                            <!-- 회사 정보 조회 결과에 확인하기 버튼 추가 -->
                                                            <div v-if="message.companyQueryUrl" class="mt-3 pl-3">
                                                                <v-btn
                                                                    color="primary"
                                                                    variant="elevated"
                                                                    size="small"
                                                                    @click="navigateToCompanyQuery(message.companyQueryUrl)"
                                                                >
                                                                    <v-icon left small class="mr-1">mdi-open-in-new</v-icon>
                                                                    확인하기
                                                                </v-btn>
                                                            </div>
                                                        </div>

                                                        <div v-else class="w-100 pb-3">
                                                            <div class="progress-border" :class="{ animate: borderCompletedAnimated }">
                                                                <template
                                                                    v-if="
                                                                        message.role == 'system' && userFilteredMessages.length - 1 == index
                                                                    "
                                                                >
                                                                    <div
                                                                        class="progress-border-span"
                                                                        :class="{ opacity: !borderCompletedAnimated }"
                                                                        v-for="n in 5"
                                                                        :key="n"
                                                                    ></div>
                                                                </template>
                                                                <div
                                                                    v-if="shouldRenderMessageBubble(message)"
                                                                    class="message-bubble-wrap message-bubble-wrap--other"
                                                                    @mouseenter="replyIndex = index"
                                                                    @mouseleave="replyIndex = -1"
                                                                >
                                                                    <div
                                                                        v-if="
                                                                            chatRoomMode &&
                                                                            (message.role === 'assistant' || message.role === 'agent') &&
                                                                            message.isLoading
                                                                        "
                                                                        class="chat-room-loading-indicator"
                                                                    >
                                                                        <template v-if="getRunningToolCall(message)">
                                                                            <div class="chat-room-tool-calls">
                                                                                <div class="chat-room-tool-call-item">
                                                                                    <v-icon size="14" color="primary" class="mr-1"
                                                                                        >mdi-wrench</v-icon
                                                                                    >
                                                                                    <span class="tool-name">{{
                                                                                        formatToolName(getRunningToolCall(message).name)
                                                                                    }}</span>
                                                                                    <v-progress-circular
                                                                                        indeterminate
                                                                                        size="14"
                                                                                        width="2"
                                                                                        color="primary"
                                                                                        class="ml-2"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </template>
                                                                        <template v-else>
                                                                            <v-progress-circular
                                                                                indeterminate
                                                                                size="14"
                                                                                width="2"
                                                                                color="primary"
                                                                            />
                                                                            <div
                                                                                class="ml-2 markdown-content streaming-content"
                                                                                v-html="renderStreamingMarkdown(message)"
                                                                            ></div>
                                                                        </template>
                                                                        <div
                                                                            v-if="getAgentPlanSummary(message)"
                                                                            class="mt-1 text-caption text-medium-emphasis"
                                                                        >
                                                                            플랜: {{ getAgentPlanSummary(message) }}
                                                                        </div>
                                                                    </div>

                                                                    <v-sheet
                                                                        v-else
                                                                        class="other-message rounded-md pa-0"
                                                                        :class="
                                                                            showTeamMemberSelector === index
                                                                                ? 'chat-message-bubble-select-team-member'
                                                                                : 'chat-message-bubble'
                                                                        "
                                                                    >
                                                                        <div class="pa-2">
                                                                            <!-- <div v-if="chatRoomMode && hasAgentLogs(message)" class="mb-2">
                                                                            <v-expansion-panels variant="accordion">
                                                                                <v-expansion-panel>
                                                                                    <v-expansion-panel-title class="text-caption py-1">
                                                                                        DeepAgent 플랜/로그 ({{ getRecentAgentLogs(message).length }})
                                                                                    </v-expansion-panel-title>
                                                                                    <v-expansion-panel-text>
                                                                                        <div v-if="getAgentPlanSteps(message).length" class="text-caption mb-2">
                                                                                            <div class="font-weight-bold mb-1">실행 플랜</div>
                                                                                            <div
                                                                                                v-for="(step, stepIdx) in getAgentPlanSteps(message)"
                                                                                                :key="`agent-plan-${index}-${stepIdx}`"
                                                                                                class="mb-1"
                                                                                            >
                                                                                                - {{ step }}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="text-caption font-weight-bold mb-1">실행 로그</div>
                                                                                        <div
                                                                                            v-for="(log, logIdx) in getRecentAgentLogs(message)"
                                                                                            :key="`agent-log-${index}-${logIdx}`"
                                                                                            class="text-caption mb-1"
                                                                                        >
                                                                                            • {{ formatAgentLogSummary(log) }}
                                                                                        </div>
                                                                                    </v-expansion-panel-text>
                                                                                </v-expansion-panel>
                                                                            </v-expansion-panels>
                                                                        </div> -->
                                                                            <!-- 첨부(이미지/파일): content가 비어도 메시지로 렌더링 + 답장 가능 -->
                                                                            <div
                                                                                v-if="
                                                                                    message.image ||
                                                                                    (message.images && message.images.length > 0) ||
                                                                                    getMessageFiles(message).length > 0
                                                                                "
                                                                                class="mb-2"
                                                                            >
                                                                                <!-- 단일 이미지 표시 (기존 호환성) -->
                                                                                <v-sheet
                                                                                    v-if="message.image && !message.images"
                                                                                    class="mb-1"
                                                                                >
                                                                                    <img
                                                                                        :src="message.image"
                                                                                        class="rounded-md"
                                                                                        alt="pro"
                                                                                        width="250"
                                                                                        style="cursor: pointer"
                                                                                        @click="emitPreviewImage(message.image)"
                                                                                    />
                                                                                </v-sheet>

                                                                                <!-- 다중 이미지 표시 -->
                                                                                <div
                                                                                    v-if="message.images && message.images.length > 0"
                                                                                    class="d-flex flex-wrap mb-1"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(image, imgIndex) in message.images"
                                                                                        :key="imgIndex"
                                                                                        class="ma-1"
                                                                                    >
                                                                                        <img
                                                                                            :src="image.url || image"
                                                                                            class="rounded-md"
                                                                                            alt="pro"
                                                                                            width="250"
                                                                                            style="cursor: pointer"
                                                                                            @click="emitPreviewImage(image.url || image)"
                                                                                        />
                                                                                    </v-sheet>
                                                                                </div>

                                                                                <!-- 파일 첨부(다중 지원) -->
                                                                                <div
                                                                                    v-if="getMessageFiles(message).length > 0"
                                                                                    class="mb-1 d-flex flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-sheet
                                                                                        v-for="(attachedFile, fileIdx) in getMessageFiles(
                                                                                            message
                                                                                        )"
                                                                                        :key="`msg-file-other-${index}-${fileIdx}`"
                                                                                        rounded="lg"
                                                                                        class="pa-2 d-inline-flex align-center"
                                                                                        style="
                                                                                            gap: 10px;
                                                                                            cursor: pointer;
                                                                                            border: 1px solid rgba(0, 0, 0, 0.08);
                                                                                            background: rgba(var(--v-theme-primary), 0.06);
                                                                                            max-width: min(520px, 80vw);
                                                                                        "
                                                                                        @click="
                                                                                            emitOpenExternalUrl(
                                                                                                attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                            )
                                                                                        "
                                                                                    >
                                                                                        <div
                                                                                            style="
                                                                                                width: 28px;
                                                                                                height: 28px;
                                                                                                border-radius: 10px;
                                                                                                display: flex;
                                                                                                align-items: center;
                                                                                                justify-content: center;
                                                                                                background: rgba(
                                                                                                    var(--v-theme-primary),
                                                                                                    0.12
                                                                                                );
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="18" color="primary"
                                                                                                >mdi-file-outline</v-icon
                                                                                            >
                                                                                        </div>
                                                                                        <div style="min-width: 0; flex: 1 1 auto">
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 13px;
                                                                                                    font-weight: 700;
                                                                                                    color: rgba(0, 0, 0, 0.78);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{
                                                                                                    attachedFile.name ||
                                                                                                    attachedFile.fileName ||
                                                                                                    '첨부파일'
                                                                                                }}
                                                                                            </div>
                                                                                            <div
                                                                                                style="
                                                                                                    font-size: 11px;
                                                                                                    color: rgba(0, 0, 0, 0.55);
                                                                                                    overflow: hidden;
                                                                                                    text-overflow: ellipsis;
                                                                                                    white-space: nowrap;
                                                                                                "
                                                                                            >
                                                                                                {{ formatAttachmentSub(attachedFile) }}
                                                                                            </div>
                                                                                        </div>
                                                                                        <v-btn
                                                                                            icon
                                                                                            size="x-small"
                                                                                            variant="tonal"
                                                                                            :disabled="
                                                                                                !(
                                                                                                    attachedFile.url ||
                                                                                                    attachedFile.fileUrl ||
                                                                                                    attachedFile.publicUrl ||
                                                                                                    attachedFile.signedUrl
                                                                                                )
                                                                                            "
                                                                                            @click.stop="
                                                                                                downloadAttachment(
                                                                                                    attachedFile.url ||
                                                                                                        attachedFile.fileUrl ||
                                                                                                        attachedFile.publicUrl ||
                                                                                                        attachedFile.signedUrl,
                                                                                                    attachedFile.name ||
                                                                                                        attachedFile.fileName
                                                                                                )
                                                                                            "
                                                                                        >
                                                                                            <v-icon size="14">mdi-download</v-icon>
                                                                                        </v-btn>
                                                                                    </v-sheet>
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                v-if="message.replyUserName || message.replyContent"
                                                                                class="reply-quote reply-quote--other"
                                                                                role="button"
                                                                                tabindex="0"
                                                                                @click.stop="scrollToOriginalMessage(message.replyUuid)"
                                                                            >
                                                                                <div class="reply-quote__body">
                                                                                    <div class="reply-quote__title">
                                                                                        {{ (message.replyUserName || '').toString()
                                                                                        }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                                    </div>
                                                                                    <div class="reply-quote__text">
                                                                                        {{ message.replyContent || '' }}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <pre v-if="message.disableMsg" class="text-body-1">{{
                                                                                '...'
                                                                            }}</pre>
                                                                            <div
                                                                                v-else-if="message.htmlContent"
                                                                                v-html="message.htmlContent"
                                                                                class="text-body-1"
                                                                            ></div>
                                                                            <div
                                                                                v-else
                                                                                class="text-body-1 markdown-content"
                                                                                v-html="
                                                                                    setMessageForUser(
                                                                                        getDisplayMessageContent(message, index)
                                                                                    )
                                                                                "
                                                                            ></div>
                                                                            <div
                                                                                v-if="message.openuiLang"
                                                                                class="mt-2"
                                                                            >
                                                                                <OpenUiRenderer
                                                                                    :response="message.openuiLang"
                                                                                    :isStreaming="Boolean(message.openuiIsStreaming)"
                                                                                    @action="handleOpenUiAction(message, $event)"
                                                                                    @state-update="handleOpenUiStateUpdate(message, $event)"
                                                                                    @parse-result="handleOpenUiParseResult(message, $event)"
                                                                                />
                                                                            </div>
                                                                            <!-- <div
                                                                                v-if="isInlineProcessPreviewTarget(message, index)"
                                                                                class="mt-2"
                                                                            >
                                                                                <div class="d-flex align-center" style="gap: 8px">
                                                                                    <v-btn
                                                                                        size="small"
                                                                                        variant="tonal"
                                                                                        color="primary"
                                                                                        @click="openInlineProcessPreview(message)"
                                                                                    >
                                                                                        <v-icon start size="14">mdi-sitemap</v-icon>
                                                                                        {{ getInlineProcessButtonLabel() }}
                                                                                    </v-btn>
                                                                                </div>
                                                                            </div> -->

                                                                            <!-- PDF2BPMN 결과 카드 -->
                                                                            <div
                                                                                v-if="hasPdf2bpmnResultSections(message)"
                                                                                class="pdf2bpmn-result-container mt-3"
                                                                            >
                                                                                <div class="d-flex align-center mb-2">
                                                                                    <v-icon size="16" color="success" class="mr-1"
                                                                                        >mdi-check-circle</v-icon
                                                                                    >
                                                                                    <span class="text-caption font-weight-bold">
                                                                                        PDF2BPMN 생성 결과
                                                                                    </span>
                                                                                    <v-spacer />
                                                                                    <v-btn
                                                                                        v-if="message.pdf2bpmnResult.taskId"
                                                                                        size="x-small"
                                                                                        variant="tonal"
                                                                                        color="primary"
                                                                                        @click.stop="
                                                                                            emitPreviewIntegratedGraph(
                                                                                                message.pdf2bpmnResult.taskId
                                                                                            )
                                                                                        "
                                                                                    >
                                                                                        <v-icon start size="14">mdi-graph-outline</v-icon>
                                                                                        전체 그래프
                                                                                    </v-btn>
                                                                                </div>
                                                                                <div
                                                                                    v-if="
                                                                                        getPdf2bpmnBpmns(message) &&
                                                                                        getPdf2bpmnBpmns(message).length > 0
                                                                                    "
                                                                                    class="text-caption font-weight-bold mb-1"
                                                                                >
                                                                                    생성된 BPMN 프로세스 ({{
                                                                                        getPdf2bpmnBpmns(message).length
                                                                                    }}개)
                                                                                </div>
                                                                                <div
                                                                                    v-if="
                                                                                        getPdf2bpmnBpmns(message) &&
                                                                                        getPdf2bpmnBpmns(message).length > 0
                                                                                    "
                                                                                    class="d-flex flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-card
                                                                                        v-for="(bpmn, bIdx) in getPdf2bpmnBpmns(message)"
                                                                                        :key="bIdx"
                                                                                        class="pa-2 pdf2bpmn-bpmn-card"
                                                                                        variant="outlined"
                                                                                        @click="emitPreviewBpmn(bpmn)"
                                                                                    >
                                                                                        <div class="d-flex align-center">
                                                                                            <v-icon size="18" color="primary" class="mr-2"
                                                                                                >mdi-sitemap</v-icon
                                                                                            >
                                                                                            <div class="flex-grow-1">
                                                                                                <div class="text-body-2 font-weight-bold">
                                                                                                    {{
                                                                                                        bpmn.process_name ||
                                                                                                        'Unnamed Process'
                                                                                                    }}
                                                                                                </div>
                                                                                                <div
                                                                                                    class="text-caption text-medium-emphasis"
                                                                                                >
                                                                                                    ID: {{ bpmn.process_id }}
                                                                                                </div>
                                                                                            </div>
                                                                                            <v-icon size="16" color="grey">mdi-eye</v-icon>
                                                                                        </div>
                                                                                    </v-card>
                                                                                </div>
                                                                                <div
                                                                                    v-if="getPdf2bpmnSavedSkills(message).length > 0"
                                                                                    class="text-caption font-weight-bold mt-3 mb-1"
                                                                                >
                                                                                    생성된 스킬 ({{
                                                                                        getPdf2bpmnSavedSkills(message).length
                                                                                    }}개)
                                                                                </div>
                                                                                <div
                                                                                    v-if="getPdf2bpmnSavedSkills(message).length > 0"
                                                                                    class="d-flex flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-card
                                                                                        v-for="(skill, sIdx) in getPdf2bpmnSavedSkills(
                                                                                            message
                                                                                        )"
                                                                                        :key="`skill-${sIdx}`"
                                                                                        class="pa-2 pdf2bpmn-bpmn-card"
                                                                                        variant="outlined"
                                                                                        @click="emitOpenExternalUrl(resolveSkillUrl(skill))"
                                                                                    >
                                                                                        <div class="d-flex align-center">
                                                                                            <v-icon
                                                                                                size="18"
                                                                                                color="deep-orange"
                                                                                                class="mr-2"
                                                                                                >mdi-lightning-bolt-outline</v-icon
                                                                                            >
                                                                                            <div class="flex-grow-1">
                                                                                                <div class="text-body-2 font-weight-bold">
                                                                                                    {{
                                                                                                        skill.name ||
                                                                                                        skill.safe_name ||
                                                                                                        'Unnamed Skill'
                                                                                                    }}
                                                                                                </div>
                                                                                            </div>
                                                                                            <v-icon size="16" color="grey"
                                                                                                >mdi-open-in-new</v-icon
                                                                                            >
                                                                                        </div>
                                                                                    </v-card>
                                                                                </div>
                                                                                <div
                                                                                    v-if="getPdf2bpmnSavedAgents(message).length > 0"
                                                                                    class="text-caption font-weight-bold mt-3 mb-1"
                                                                                >
                                                                                    생성된 에이전트 ({{
                                                                                        getPdf2bpmnSavedAgents(message).length
                                                                                    }}개)
                                                                                </div>
                                                                                <div
                                                                                    v-if="getPdf2bpmnSavedAgents(message).length > 0"
                                                                                    class="d-flex flex-column"
                                                                                    style="gap: 8px"
                                                                                >
                                                                                    <v-card
                                                                                        v-for="(agent, aIdx) in getPdf2bpmnSavedAgents(
                                                                                            message
                                                                                        )"
                                                                                        :key="`agent-${aIdx}`"
                                                                                        class="pa-2 pdf2bpmn-bpmn-card"
                                                                                        variant="outlined"
                                                                                        @click="emitOpenExternalUrl(resolveAgentUrl(agent))"
                                                                                    >
                                                                                        <div class="d-flex align-center">
                                                                                            <v-icon size="18" color="primary" class="mr-2"
                                                                                                >mdi-account-tie</v-icon
                                                                                            >
                                                                                            <div class="flex-grow-1">
                                                                                                <div class="text-body-2 font-weight-bold">
                                                                                                    {{
                                                                                                        agent.name ||
                                                                                                        agent.id ||
                                                                                                        'Unnamed Agent'
                                                                                                    }}
                                                                                                </div>
                                                                                                <div
                                                                                                    class="text-caption text-medium-emphasis"
                                                                                                >
                                                                                                    UID: {{ agent.id }}
                                                                                                </div>
                                                                                            </div>
                                                                                            <v-icon size="16" color="grey"
                                                                                                >mdi-open-in-new</v-icon
                                                                                            >
                                                                                        </div>
                                                                                    </v-card>
                                                                                </div>
                                                                            </div>

                                                                            <div
                                                                                v-if="message.type && message.type === 'add_team'"
                                                                                class="mt-2"
                                                                            >
                                                                                <v-btn
                                                                                    style="
                                                                                        border: 1px solid #e0e0e0;
                                                                                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                                                                                    "
                                                                                    :style="
                                                                                        replyIndex === index ? 'margin-bottom: 10px;' : ''
                                                                                    "
                                                                                    color="white"
                                                                                    variant="elevated"
                                                                                    size="small"
                                                                                    class="mr-2"
                                                                                    @click="addTeam(message, index)"
                                                                                    :disabled="message.added || message.adding"
                                                                                >
                                                                                    <template v-if="message.adding">
                                                                                        <v-progress-circular
                                                                                            indeterminate
                                                                                            color="primary"
                                                                                            size="16"
                                                                                            width="2"
                                                                                            style="margin-right: 5px"
                                                                                        ></v-progress-circular>
                                                                                    </template>
                                                                                    <template v-else-if="message.added">
                                                                                        <v-icon style="margin-right: 3px">mdi-check</v-icon>
                                                                                        추가됨
                                                                                    </template>
                                                                                    <template v-else> 추가 </template>
                                                                                </v-btn>

                                                                                <v-btn
                                                                                    v-if="message.added"
                                                                                    style="
                                                                                        border: 1px solid #e0e0e0;
                                                                                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                                                                                    "
                                                                                    color="white"
                                                                                    variant="elevated"
                                                                                    size="small"
                                                                                    @click="toggleTeamMemberSelector(index)"
                                                                                >
                                                                                    <v-icon style="margin-right: 3px"
                                                                                        >mdi-account-edit</v-icon
                                                                                    >
                                                                                    팀원 관리({{
                                                                                        (selectedTeamMembersByMessage[index] || []).length
                                                                                    }})
                                                                                </v-btn>
                                                                            </div>

                                                                            <v-row v-if="!chatRoomMode" class="pa-0 ma-0 message-actions">
                                                                                <div v-if="isMobile || replyIndex === index" class="d-flex">
                                                                                    <v-btn
                                                                                        v-if="type != 'AssistantChats' && message.specific"
                                                                                        @click="viewWork(index)"
                                                                                        variant="text"
                                                                                        size="x-small"
                                                                                        icon
                                                                                        class="action-btn"
                                                                                    >
                                                                                        <Icons :icon="'document'" :size="20" />
                                                                                    </v-btn>
                                                                                    <v-btn
                                                                                        @click="beforeReply(message)"
                                                                                        variant="text"
                                                                                        size="x-small"
                                                                                        icon
                                                                                        class="action-btn"
                                                                                    >
                                                                                        <Icons :icon="'reply'" :size="20" />
                                                                                    </v-btn>
                                                                                    <v-btn
                                                                                        @click="viewJSON(index)"
                                                                                        variant="text"
                                                                                        size="x-small"
                                                                                        icon
                                                                                        class="action-btn"
                                                                                    >
                                                                                        <Icons
                                                                                            v-if="message.jsonContent && isviewJSONStatus"
                                                                                            :icon="'arrow-up-2'"
                                                                                            :size="20"
                                                                                        />
                                                                                        <Icons v-else :icon="'arrow-down-2'" :size="20" />
                                                                                    </v-btn>
                                                                                </div>
                                                                            </v-row>

                                                                            <!-- 팀원 선택 UI -->
                                                                            <v-card
                                                                                v-if="showTeamMemberSelector === index"
                                                                                class="mt-3"
                                                                                outlined
                                                                            >
                                                                                <v-card-title class="pb-2">
                                                                                    <div class="d-flex align-center justify-space-between">
                                                                                        <span>팀원 선택</span>
                                                                                        <v-btn
                                                                                            @click="closeTeamMemberSelector()"
                                                                                            variant="text"
                                                                                            size="small"
                                                                                            icon
                                                                                        >
                                                                                            <v-icon>mdi-close</v-icon>
                                                                                        </v-btn>
                                                                                    </div>
                                                                                </v-card-title>

                                                                                <v-card-text>
                                                                                    <v-text-field
                                                                                        v-model="teamMemberSearch"
                                                                                        label="팀원 검색"
                                                                                        prepend-inner-icon="mdi-magnify"
                                                                                        variant="outlined"
                                                                                        density="compact"
                                                                                        hide-details
                                                                                        class="mb-3"
                                                                                    ></v-text-field>

                                                                                    <div
                                                                                        class="team-member-list"
                                                                                        style="max-height: 200px; overflow-y: auto"
                                                                                    >
                                                                                        <v-list density="compact">
                                                                                            <v-list-item
                                                                                                v-for="user in filteredTeamMembers"
                                                                                                :key="user.id"
                                                                                                @click="
                                                                                                    toggleTeamMemberSelection(user, index)
                                                                                                "
                                                                                                class="team-member-item"
                                                                                                :class="{
                                                                                                    selected: (
                                                                                                        selectedTeamMembersByMessage[
                                                                                                            index
                                                                                                        ] || []
                                                                                                    ).includes(user.id)
                                                                                                }"
                                                                                            >
                                                                                                <template v-slot:prepend>
                                                                                                    <v-avatar size="32">
                                                                                                        <img
                                                                                                            :src="
                                                                                                                user.profile ||
                                                                                                                '/images/defaultUser.png'
                                                                                                            "
                                                                                                        />
                                                                                                    </v-avatar>
                                                                                                </template>

                                                                                                <v-list-item-title>{{
                                                                                                    user.username
                                                                                                }}</v-list-item-title>
                                                                                                <v-list-item-subtitle>{{
                                                                                                    user.email
                                                                                                }}</v-list-item-subtitle>

                                                                                                <template v-slot:append>
                                                                                                    <v-checkbox
                                                                                                        :model-value="
                                                                                                            (
                                                                                                                selectedTeamMembersByMessage[
                                                                                                                    index
                                                                                                                ] || []
                                                                                                            ).includes(user.id)
                                                                                                        "
                                                                                                        @update:model-value="
                                                                                                            toggleTeamMemberSelection(
                                                                                                                user,
                                                                                                                index
                                                                                                            )
                                                                                                        "
                                                                                                        hide-details
                                                                                                    ></v-checkbox>
                                                                                                </template>
                                                                                            </v-list-item>
                                                                                        </v-list>
                                                                                    </div>
                                                                                </v-card-text>

                                                                                <v-card-actions>
                                                                                    <v-spacer></v-spacer>
                                                                                    <v-btn
                                                                                        @click="closeTeamMemberSelector()"
                                                                                        variant="text"
                                                                                        size="small"
                                                                                    >
                                                                                        닫기
                                                                                    </v-btn>
                                                                                    <v-btn
                                                                                        @click="addSelectedTeamMembers(message, index)"
                                                                                        color="primary"
                                                                                        variant="elevated"
                                                                                        size="small"
                                                                                        :disabled="
                                                                                            (selectedTeamMembersByMessage[index] || [])
                                                                                                .length === 0
                                                                                        "
                                                                                    >
                                                                                        확인 ({{
                                                                                            (selectedTeamMembersByMessage[index] || [])
                                                                                                .length
                                                                                        }})
                                                                                    </v-btn>
                                                                                </v-card-actions>
                                                                            </v-card>

                                                                            <v-row v-if="message.tableData" class="my-5">
                                                                                <v-col cols="12">
                                                                                    <v-card outlined>
                                                                                        <v-card-title>{{
                                                                                            setTableName(message.content)
                                                                                        }}</v-card-title>
                                                                                        <v-card-text>
                                                                                            <div
                                                                                                v-html="message.tableData"
                                                                                                class="table-responsive"
                                                                                            ></div>
                                                                                        </v-card-text>
                                                                                    </v-card>
                                                                                </v-col>
                                                                            </v-row>

                                                                            <v-row v-if="message.searchResults" class="my-5">
                                                                                <v-col
                                                                                    v-for="(searchResult, index) in message.searchResults"
                                                                                    :key="index"
                                                                                    cols="4"
                                                                                >
                                                                                    <v-card outlined>
                                                                                        <v-card-title class="d-flex justify-space-between">
                                                                                            <span>{{ searchResult.score }}</span>
                                                                                            <span>{{ searchResult.index }}</span>
                                                                                        </v-card-title>
                                                                                        <v-card-text>{{ searchResult.memory }}</v-card-text>
                                                                                    </v-card>
                                                                                </v-col>
                                                                            </v-row>

                                                                            <v-row
                                                                                v-if="
                                                                                    message.memento &&
                                                                                    message.memento.sources &&
                                                                                    message.memento.sources.length > 0
                                                                                "
                                                                                class="my-5"
                                                                            >
                                                                                <v-col cols="12">
                                                                                    <v-card outlined>
                                                                                        <v-card-title>Memento</v-card-title>
                                                                                        <v-card-text>
                                                                                            <v-textarea
                                                                                                hide-details
                                                                                                v-model="message.memento.response"
                                                                                                auto-grow
                                                                                                readonly
                                                                                                variant="solo-filled"
                                                                                            ></v-textarea>
                                                                                            <div
                                                                                                class="chips-container"
                                                                                                style="margin-top: 5px"
                                                                                            >
                                                                                                <v-chip
                                                                                                    v-for="(source, index) in message
                                                                                                        .memento.sources"
                                                                                                    :key="index"
                                                                                                    variant="outlined"
                                                                                                    size="x-small"
                                                                                                    text-color="primary"
                                                                                                    style="margin-bottom: 1px"
                                                                                                    @click="downloadFile(source)"
                                                                                                >
                                                                                                    <v-icon
                                                                                                        start
                                                                                                        icon="mdi-label"
                                                                                                        x-small
                                                                                                    ></v-icon>
                                                                                                    {{ source.file_name }}
                                                                                                </v-chip>
                                                                                            </div>
                                                                                        </v-card-text>
                                                                                    </v-card>
                                                                                </v-col>
                                                                            </v-row>
                                                                            <pre v-if="isViewJSON.includes(index)" class="text-body-1"
                                                                                >{{ message.jsonContent }}
                                                                        </pre
                                                                            >
                                                                            <v-card
                                                                                v-if="
                                                                                    (type == 'AssistantChats' &&
                                                                                        isMobile &&
                                                                                        index === userFilteredMessages.length - 1) ||
                                                                                    isViewWork == index
                                                                                "
                                                                            >
                                                                                <div v-if="message.specific">
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Title:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-textarea
                                                                                            readonly
                                                                                            rows="1"
                                                                                            v-model="message.title"
                                                                                            auto-grow
                                                                                        ></v-textarea>
                                                                                    </v-card-text>
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Specific:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-textarea
                                                                                            readonly
                                                                                            rows="1"
                                                                                            v-model="message.specific"
                                                                                            auto-grow
                                                                                        ></v-textarea>
                                                                                    </v-card-text>
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Measurable:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-textarea
                                                                                            readonly
                                                                                            rows="1"
                                                                                            v-model="message.measurable"
                                                                                            auto-grow
                                                                                        ></v-textarea>
                                                                                    </v-card-text>
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Attainable:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-textarea
                                                                                            readonly
                                                                                            rows="1"
                                                                                            v-model="message.attainable"
                                                                                            auto-grow
                                                                                        ></v-textarea>
                                                                                    </v-card-text>
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Relevant:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-textarea
                                                                                            readonly
                                                                                            rows="1"
                                                                                            v-model="message.relevant"
                                                                                            auto-grow
                                                                                        ></v-textarea>
                                                                                    </v-card-text>
                                                                                    <v-card-title style="margin-bottom: -10px"
                                                                                        ><h3>Time-bound:</h3></v-card-title
                                                                                    >
                                                                                    <v-card-text>
                                                                                        <v-col
                                                                                            style="max-width: 100%"
                                                                                            cols="12"
                                                                                            sm="6"
                                                                                            md="4"
                                                                                        >
                                                                                            <v-menu
                                                                                                v-model="timeBoundMenu"
                                                                                                :close-on-content-click="false"
                                                                                                :nudge-right="40"
                                                                                                transition="scale-transition"
                                                                                                offset-y
                                                                                                min-width="auto"
                                                                                            >
                                                                                                <template v-slot:activator="{ on, attrs }">
                                                                                                    <v-text-field
                                                                                                        v-model="message.time_bound"
                                                                                                        prepend-icon="mdi-calendar"
                                                                                                        readonly
                                                                                                        v-bind="attrs"
                                                                                                        v-on="on"
                                                                                                    ></v-text-field>
                                                                                                </template>
                                                                                                <v-date-picker
                                                                                                    v-model="message.time_bound"
                                                                                                    @input="timeBoundMenu = false"
                                                                                                ></v-date-picker>
                                                                                            </v-menu>
                                                                                        </v-col>
                                                                                    </v-card-text>
                                                                                    <v-card-title>Descriptions</v-card-title>
                                                                                    <v-card-text>
                                                                                        <div
                                                                                            v-for="(desc, index) in message.descriptions"
                                                                                            :key="index"
                                                                                        >
                                                                                            <h3>{{ desc.word }}</h3>
                                                                                            <p>{{ desc.description }}</p>
                                                                                        </div>
                                                                                    </v-card-text>
                                                                                    <v-card-title>CheckList</v-card-title>
                                                                                    <v-card-text>
                                                                                        <v-checkbox
                                                                                            v-for="(check, index) in message.checkPoints"
                                                                                            :key="index"
                                                                                            :label="check"
                                                                                            readonly
                                                                                            v-model="checked"
                                                                                        ></v-checkbox>
                                                                                    </v-card-text>
                                                                                    <div
                                                                                        v-if="type == 'AssistantChats' && isMobile"
                                                                                        class="d-flex justify-center"
                                                                                        style="margin-bottom: 10px"
                                                                                    >
                                                                                        <v-btn @click="clickedWorkOrder" color="primary"
                                                                                            >업무 지시하기</v-btn
                                                                                        >
                                                                                    </div>
                                                                                </div>
                                                                            </v-card>
                                                                        </div>
                                                                        <!--   -->
                                                                        <v-progress-linear
                                                                            v-if="userFilteredMessages.length - 1 == index && isLoading"
                                                                            style="
                                                                                margin-top: -4px;
                                                                                border-radius: 0 0 10px 10px;
                                                                                width: 99%;
                                                                            "
                                                                            indeterminate
                                                                            class="my-progress-linear"
                                                                        >
                                                                        </v-progress-linear>
                                                                    </v-sheet>
                                                                    <div
                                                                        v-if="chatRoomMode || shouldDisplayMessageTimestamp(message, index)"
                                                                        class="chat-room-timestamp-action other-timestamp"
                                                                        :class="{ 'is-hover': replyIndex === index, 'is-mobile': isMobile }"
                                                                    >
                                                                        <span
                                                                            class="chat-room-timestamp-text"
                                                                            :style="
                                                                                shouldDisplayMessageTimestamp(message, index)
                                                                                    ? ''
                                                                                    : 'opacity:0;'
                                                                            "
                                                                        >
                                                                            {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                        </span>
                                                                        <div
                                                                            v-if="chatRoomMode"
                                                                            class="chat-room-actions-overlay chat-room-actions-overlay--other"
                                                                        >
                                                                            <v-btn
                                                                                v-if="!disableChat"
                                                                                @click="beforeReply(message)"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-subdirectory-arrow-right</v-icon>
                                                                            </v-btn>
                                                                            <v-btn
                                                                                v-if="message && message.jsonContent"
                                                                                @click="viewJSON(index)"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-code-json</v-icon>
                                                                            </v-btn>
                                                                            <v-btn
                                                                                v-if="
                                                                                    type != 'AssistantChats' && message && message.specific
                                                                                "
                                                                                @click="viewWork(index)"
                                                                                icon
                                                                                variant="text"
                                                                                size="x-small"
                                                                                class="chat-room-action-btn"
                                                                            >
                                                                                <v-icon size="18">mdi-file-document-outline</v-icon>
                                                                            </v-btn>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <AgentsChat
                                                v-if="type == 'instances' && agentInfo.isRunning && userFilteredMessages.length == 0"
                                                class="px-5 py-1"
                                                :agentInfo="agentInfo"
                                                :totalSize="userFilteredMessages.length"
                                                :currentIndex="-1"
                                            />
                                        </div>
                                        <AgentsChat
                                            v-if="type == 'instances' && agentInfo.isRunning && userFilteredMessages.length == 0"
                                            class="px-5 py-1"
                                            :agentInfo="agentInfo"
                                            :totalSize="userFilteredMessages.length"
                                            :currentIndex="-1"
                                        />
                                    </div>
                                    <slot name="custom-chat"></slot>
                                </v-col>
                            </div>
                        </perfect-scrollbar>
                        <div v-if="showAgentMessagePanel" class="chat-split-resize-handle" @mousedown="startAgentPanelResize"></div>
                        <AgentMessagePanel
                            v-if="showAgentMessagePanel"
                            class="chat-view-box-split-right"
                            :style="{ width: agentPanelWidth + 'px' }"
                            :messages="agentFilteredMessages"
                            :agentInfo="agentInfo"
                            :userInfo="userInfo"
                            :userList="userList"
                            @invite-agent="(payload) => $emit('invite-agent', payload)"
                            @preview-image="(url) => $emit('preview-image', url)"
                            @preview-bpmn="(bpmn) => $emit('preview-bpmn', bpmn)"
                        />
                    </div>
                    <div v-if="!workAssistantAgentMode" style="position: relative; z-index: 9999">
                        <v-row class="pa-0 ma-0">
                            <div v-if="isOpenedChatMenu" class="chat-menu-background">
                                <v-tooltip :text="$t('chat.addFile')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="
                                                openChatMenu();
                                                uploadImage();
                                            "
                                            v-bind="props"
                                            style="width: 30px; height: 30px"
                                            :disabled="disableChat"
                                        >
                                            <v-icon size="20">mdi-attachment</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip text="Draft Agent">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-if="(type == 'instances' || type == 'chats') && agentInfo && !agentInfo.isRunning"
                                            :disabled="!(newMessage || agentInfo.draftPrompt)"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="
                                                openChatMenu();
                                                requestDraftAgent();
                                            "
                                            v-bind="props"
                                            style="width: 30px; height: 30px; margin: 1px 0px 0px 5px"
                                        >
                                            <Icons :icon="'document-sparkle'" :size="20" />
                                        </v-btn>
                                        <v-btn
                                            v-if="(type == 'instances' || type == 'chats') && agentInfo && agentInfo.isRunning"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            style="width: 30px; height: 30px"
                                        >
                                            <v-progress-circular :size="20" indeterminate color="primary"></v-progress-circular>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-form
                                    v-if="
                                        (type == 'instances' || type == 'chats' || type == 'consulting' || type == 'monitor') &&
                                        agentInfo &&
                                        !agentInfo.isRunning
                                    "
                                    ref="uploadForm"
                                    @submit.prevent="
                                        openChatMenu();
                                        submitFile();
                                    "
                                    style="height: 30px"
                                    class="chat-selected-file"
                                >
                                    <v-row class="ma-0 pa-0" :style="file && file.length > 0 ? 'margin:-13px 0px 0px 7px !important;' : ''">
                                        <v-tooltip :text="$t('chat.fileUpLoad')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    v-if="file && file.length > 0"
                                                    type="submit"
                                                    v-bind="props"
                                                    icon
                                                    variant="text"
                                                    class="text-medium-emphasis"
                                                    style="width: 30px; height: 30px; margin: 12.5px 0px 0px 0px"
                                                >
                                                    <Icons :icon="'upload'" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-file-input
                                            class="chat-file-up-load"
                                            :class="{ 'chat-file-up-load-display': file && file.length > 0 }"
                                            :style="
                                                file && file.length > 0
                                                    ? ''
                                                    : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'
                                            "
                                            v-model="file"
                                            label="Choose a file"
                                            prepend-icon="mdi-paperclip"
                                            outlined
                                            :disabled="disableChat"
                                        ></v-file-input>
                                        <v-tooltip
                                            v-if="type == 'chats' && !isSystemChat"
                                            :text="ProcessGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    icon
                                                    variant="text"
                                                    class="text-medium-emphasis"
                                                    @click="
                                                        openChatMenu();
                                                        toggleProcessGPTActive();
                                                    "
                                                    v-bind="props"
                                                    style="width: 30px; height: 30px; margin-left: 12px"
                                                    :disabled="disableChat"
                                                >
                                                    <img
                                                        :style="ProcessGPTActive ? 'opacity:1' : 'opacity:0.5'"
                                                        src="@/assets/images/chat/chat-icon.png"
                                                        style="height: 24px"
                                                    />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </v-row>
                                </v-form>
                            </div>
                        </v-row>
                    </div>
                </div>
                <v-divider v-if="!hideInput && !workAssistantAgentMode && !inputOnly" />
            </div>

            <div
                v-if="!hideInput && !workAssistantAgentMode && !inputOnly"
                style="position: absolute; bottom: 15.1%; left: 24.3%; right: 0px; width: 75%"
            >
                <div class="message-info-box" v-if="isReply || (!isAtBottom && previewMessage)">
                    <div class="message-info-content">
                        <template v-if="isReply">
                            <div class="reply-banner reply-banner--primary">
                                <div class="reply-banner__main">
                                    <div class="reply-banner__top">
                                        <div class="reply-banner__to">
                                            {{ replyUser?.name || replyUser?.userName || replyUser?.email || ''
                                            }}{{ replyUser?.name || replyUser?.userName || replyUser?.email ? '에게 답장' : '답장' }}
                                        </div>
                                        <v-btn icon variant="text" size="x-small" @click="cancelReply()" class="reply-banner__close">
                                            <v-icon size="16">mdi-close</v-icon>
                                        </v-btn>
                                    </div>
                                    <div class="reply-banner__text">{{ replyPreviewText(replyUser) }}</div>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <div class="message-info-header">
                                <div>{{ previewMessage.name }}</div>
                                <v-icon @click="scrollToBottom()" color="primary" size="small">mdi-arrow-down-circle</v-icon>
                            </div>
                            <div class="message-info-text">{{ previewMessage.content }}</div>
                        </template>
                    </div>
                </div>
            </div>
            <v-divider v-if="!hideInput && !workAssistantAgentMode && !inputOnly" />

            <div v-if="!hideInput" class="chat-info-message-input-box">
                <!-- 답장 UI: inputOnly/workAssistantAgentMode에서도 정상 표시 -->
                <div class="message-info-box message-info-box--reply" v-if="isReply">
                    <div class="message-info-content message-info-content--reply">
                        <div class="reply-banner reply-banner--primary">
                            <div class="reply-banner__main">
                                <div class="reply-banner__top">
                                    <div class="reply-banner__to">
                                        {{ replyUser?.name || replyUser?.userName || replyUser?.email || ''
                                        }}{{ replyUser?.name || replyUser?.userName || replyUser?.email ? '에게 답장' : '답장' }}
                                    </div>
                                    <v-btn icon variant="text" size="x-small" @click="cancelReply()" class="reply-banner__close">
                                        <v-icon size="16">mdi-close</v-icon>
                                    </v-btn>
                                </div>
                                <div class="reply-banner__text">{{ replyPreviewText(replyUser) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage" />
                <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage" />
                <div style="z-index: 9999" class="d-flex flex-wrap">
                    <!-- 이미지 미리보기 -->
                    <div v-for="(image, index) in attachedImages" :key="index" class="image-preview-item">
                        <img :src="image.url" width="56" height="56" style="border: 1px solid #ccc; border-radius: 10px; margin: 8px" />
                        <v-btn
                            @click="deleteImage(index)"
                            density="compact"
                            icon
                            size="16"
                            style="
                                background-color: black !important;
                                margin: 4px 0px 0px -20px !important;
                                position: absolute;
                                top: 4px;
                                right: 4px;
                            "
                        >
                            <v-icon color="white" size="14">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </div>
                <form
                    :style="type == 'consulting' ? 'position:relative; z-index: 9999;' : 'position:relative;'"
                    class="d-flex flex-column align-center pa-0"
                >
                    <div class="mention-autocomplete-wrap">
                        <!-- 선택된 멘션 표시(Primary) -->
                        <div v-if="mentionedUsers && mentionedUsers.length > 0" class="mention-chip-row">
                            <v-chip
                                v-for="u in mentionedUsers"
                                :key="u.id || u.email || u.username"
                                color="primary"
                                variant="tonal"
                                size="small"
                                closable
                                @click:close="removeMentionedUser(u)"
                                class="mention-chip"
                            >
                                {{ u.username || u.mentionText || u.email || u.id }}
                            </v-chip>
                        </div>
                        <v-textarea
                            variant="solo"
                            hide-details
                            v-model="newMessage"
                            color="primary"
                            :class="[
                                'shadow-none message-input-box delete-input-details cp-chat',
                                { 'textarea-drag-over': isDragOverTextarea }
                            ]"
                            density="compact"
                            :placeholder="$t('chat.inputMessage')"
                            auto-grow
                            rows="1"
                            @keypress.enter="beforeSend"
                            :disabled="disableChat"
                            @input="handleTextareaInput"
                            @keydown="handleTextareaKeydown"
                            @keyup="handleTextareaCaretMove"
                            @click="handleTextareaCaretMove"
                            @paste="handlePaste"
                            @dragover.prevent="isDragOverTextarea = true"
                            @dragleave="isDragOverTextarea = false"
                            @drop.prevent.stop="handleTextareaDrop"
                        >
                        </v-textarea>

                        <div v-if="showUserList" class="user-list mention-autocomplete-list" :style="mentionDropdownStyle">
                            <template v-if="!filteredUserList || filteredUserList.length === 0">
                                <div class="mention-autocomplete-empty">멘션할 수 있는 참여자가 없습니다.</div>
                            </template>
                            <template v-else>
                                <div
                                    v-for="(user, idx) in filteredUserList"
                                    :key="user.id"
                                    @click="selectUser(user)"
                                    :class="[
                                        'user-item mention-autocomplete-item',
                                        { 'mention-autocomplete-item--active': idx === mentionActiveIndex }
                                    ]"
                                >
                                    <img :src="user.profile" alt="profile" class="mention-autocomplete-avatar" />
                                    <div class="mention-autocomplete-meta">
                                        <div class="mention-autocomplete-name">{{ user.username }}</div>
                                        <div class="mention-autocomplete-sub">{{ user.email }}</div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>

                    <div class="d-flex justify-space-between align-center w-100 pa-2">
                        <v-row class="ma-0 pa-0 align-center">
                            <v-btn
                                @click="openChatMenu()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important"
                            >
                                <v-icon v-if="!isOpenedChatMenu">mdi-plus</v-icon>
                                <v-icon v-else>mdi-close</v-icon>
                            </v-btn>
                            <slot name="custom-input-tools"></slot>
                        </v-row>

                        <div>
                            <v-btn
                                v-if="!isMicRecording && !isMicRecorderLoading"
                                @click="startVoiceRecording()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important"
                            >
                                <Icons :icon="'sharp-mic'" :size="'16'" />
                            </v-btn>
                            <v-btn
                                v-else-if="!isMicRecorderLoading"
                                @click="stopVoiceRecording()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important"
                            >
                                <Icons :icon="'stop'" :size="'16'" />
                            </v-btn>
                            <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" style="flex-shrink: 0" />
                            <v-tooltip :text="enableDesktopVoice ? $t('chat.headset') : '에이전트와 1:1 대화에서만 사용할 수 있습니다'">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        @click="enableDesktopVoice && (openChatMenu(), handleVoiceButtonClick())"
                                        v-bind="props"
                                        class="mr-1 text-medium-emphasis"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        :disabled="!enableDesktopVoice"
                                        :color="desktopVoiceActive ? 'primary' : undefined"
                                        :style="
                                            desktopVoiceActive
                                                ? 'border-color: rgb(var(--v-theme-primary)) !important;'
                                                : 'border-color: #e0e0e0 !important;'
                                        "
                                    >
                                        <Icons :icon="'voice'" :size="16" />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <v-btn
                                v-if="!(showStopButton || isLoading)"
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                @click.prevent="beforeSend"
                                :disabled="disableBtn"
                            >
                                <icons :icon="'send-outline'" :size="16" />
                            </v-btn>
                            <v-btn
                                v-else
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                @click="handleStopClick"
                            >
                                <Icons :icon="'outline-stop-circle'" :size="16" />
                            </v-btn>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <!-- 프로세스 정의 체계도 상단 chat UI -->
    <div v-else>
        <v-card
            flat
            :class="['chat-input-card', inputOnly ? 'pa-0 chat-input-card--inline' : 'pa-4']"
            :style="inputOnly ? 'background: transparent; border-radius: 0; box-shadow: none;' : ''"
        >
            <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage" />
            <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                ref="unifiedFileInput"
                class="d-none"
                multiple
                @change="changeImage"
            />
            <div style="z-index: 9999" class="d-flex flex-wrap">
                <div v-for="(image, index) in attachedImages" :key="index" class="image-preview-item">
                    <img :src="image.url" width="56" height="56" style="border: 1px solid #ccc; border-radius: 10px; margin: 8px" />
                    <v-btn
                        @click="deleteImage(index)"
                        density="compact"
                        icon
                        size="16"
                        style="
                            background-color: black !important;
                            margin: 4px 0px 0px -20px !important;
                            position: absolute;
                            top: 4px;
                            right: 4px;
                        "
                    >
                        <v-icon color="white" size="14">mdi-close</v-icon>
                    </v-btn>
                </div>
                <!-- 문서 미리보기(다중 선택 지원) -->
                <div
                    v-for="(docFile, fileIdx) in selectedPdfFiles"
                    :key="`doc-${fileIdx}-${docFile?.name || 'file'}`"
                    class="pdf-preview-item"
                    style="position: relative; margin: 8px"
                >
                    <v-chip closable color="primary" variant="tonal" @click:close="clearSelectedPdf(fileIdx)">
                        <v-icon start size="16">mdi-file-outline</v-icon>
                        {{ docFile?.name || '첨부파일' }}
                    </v-chip>
                </div>
            </div>
            <form
                :style="type == 'consulting' ? 'position:relative; z-index: 9999;' : 'position:relative;'"
                class="d-flex flex-column align-center pa-0"
            >
                <!-- 답장 UI (workAssistantAgentMode/inputOnly에서도 표시) -->
                <div class="message-info-box message-info-box--reply" v-if="isReply" style="width: 100%; margin-bottom: 8px">
                    <div class="message-info-content message-info-content--reply">
                        <div class="reply-banner reply-banner--primary">
                            <div class="reply-banner__main">
                                <div class="reply-banner__top">
                                    <div class="reply-banner__to">
                                        {{ replyUser?.name || replyUser?.userName || replyUser?.email || ''
                                        }}{{ replyUser?.name || replyUser?.userName || replyUser?.email ? '에게 답장' : '답장' }}
                                    </div>
                                    <v-btn icon variant="text" size="x-small" @click="cancelReply()" class="reply-banner__close">
                                        <v-icon size="16">mdi-close</v-icon>
                                    </v-btn>
                                </div>
                                <div class="reply-banner__text">{{ replyPreviewText(replyUser) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mention-autocomplete-wrap">
                    <!-- 선택된 멘션 표시(Primary) -->
                    <div v-if="mentionedUsers && mentionedUsers.length > 0" class="mention-chip-row">
                        <v-chip
                            v-for="u in mentionedUsers"
                            :key="u.id || u.email || u.username"
                            color="primary"
                            variant="tonal"
                            size="small"
                            closable
                            @click:close="removeMentionedUser(u)"
                            class="mention-chip"
                        >
                            {{ u.username || u.mentionText || u.email || u.id }}
                        </v-chip>
                    </div>
                    <v-textarea
                        variant="solo"
                        hide-details
                        v-model="newMessage"
                        color="primary"
                        class="shadow-none message-input-box delete-input-details cp-chat"
                        density="compact"
                        :placeholder="resolvedPlaceholder"
                        auto-grow
                        rows="1"
                        @keypress.enter="beforeSend"
                        :disabled="disableChat || isGenerationFinished"
                        @input="handleTextareaInput"
                        @keydown="handleTextareaKeydown"
                        @keyup="handleTextareaCaretMove"
                        @click="handleTextareaCaretMove"
                        @paste="handlePaste"
                    >
                    </v-textarea>

                    <div v-if="showUserList" class="user-list mention-autocomplete-list" :style="mentionDropdownStyle">
                        <template v-if="!filteredUserList || filteredUserList.length === 0">
                            <div class="mention-autocomplete-empty">멘션할 수 있는 참여자가 없습니다.</div>
                        </template>
                        <template v-else>
                            <div
                                v-for="(user, idx) in filteredUserList"
                                :key="user.id"
                                @click="selectUser(user)"
                                :class="[
                                    'user-item mention-autocomplete-item',
                                    { 'mention-autocomplete-item--active': idx === mentionActiveIndex }
                                ]"
                            >
                                <img :src="user.profile" alt="profile" class="mention-autocomplete-avatar" />
                                <div class="mention-autocomplete-meta">
                                    <div class="mention-autocomplete-name">{{ user.username }}</div>
                                    <div class="mention-autocomplete-sub">{{ user.email }}</div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
                <div class="d-flex justify-space-between align-center w-100 pl-1">
                    <div :style="type == 'consulting' ? 'position:relative; z-index: 9999;' : 'position:relative;'">
                        <v-row class="pa-0 ma-0">
                            <div class="definition-map-chat-menu-background">
                                <DetailComponent
                                    v-if="showDetailInfo"
                                    :iconSize="20"
                                    :title="$t('chat.helpTitle')"
                                    :details="chatDocumentHelpDetails"
                                />
                                <!-- <v-tooltip v-if="type != 'AssistantChats'" :text="$t('chat.document')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); startWorkOrder()" v-bind="props"
                                            style="width:30px; height:30px;" :disabled="disableChat || isGenerationFinished">
                                            <Icons :icon="'document'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip> -->
                                <!-- <v-tooltip v-if="isMobile" :text="$t('chat.camera')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); capture()" v-bind="props"
                                            style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat || isGenerationFinished">
                                            <Icons :icon="'camera'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip> -->
                                <v-tooltip :text="$t('chat.addFile')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="
                                                openChatMenu();
                                                uploadImage();
                                            "
                                            v-bind="props"
                                            style="width: 30px; height: 30px; margin-left: 5px"
                                            :disabled="disableChat || isGenerationFinished"
                                        >
                                            <v-icon size="20">mdi-attachment</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-select
                                    v-if="selectableOrchestration"
                                    v-model="orchestration"
                                    :items="orchestrationOptions"
                                    item-title="label"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    class="ml-2 orchestration-select"
                                    style="max-width: 150px"
                                />
                                <!-- <v-btn v-if="orchestration === 'langchain-react'" icon variant="text" class="text-medium-emphasis" @click="openController()" v-bind="props"
                                    style="width:30px; height:30px;">
                                    <Icons :icon="'filter'" :size="20" />
                                </v-btn> -->
                                <v-tooltip text="Draft Agent">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-if="(type == 'instances' || type == 'chats') && agentInfo && !agentInfo.isRunning"
                                            :disabled="!(newMessage || agentInfo.draftPrompt)"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="
                                                openChatMenu();
                                                requestDraftAgent();
                                            "
                                            v-bind="props"
                                            style="width: 30px; height: 30px; margin: 1px 0px 0px 5px"
                                        >
                                            <Icons :icon="'document-sparkle'" :size="20" />
                                        </v-btn>
                                        <v-btn
                                            v-if="(type == 'instances' || type == 'chats') && agentInfo && agentInfo.isRunning"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            style="width: 30px; height: 30px"
                                        >
                                            <v-progress-circular :size="20" indeterminate color="primary"></v-progress-circular>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-form
                                    v-if="
                                        (type == 'instances' || type == 'chats' || type == 'consulting') &&
                                        agentInfo &&
                                        !agentInfo.isRunning
                                    "
                                    ref="uploadForm"
                                    @submit.prevent="
                                        openChatMenu();
                                        submitFile();
                                    "
                                    style="height: 30px"
                                    class="chat-selected-file"
                                >
                                    <v-row class="ma-0 pa-0" :style="file && file.length > 0 ? 'margin:-13px 0px 0px 7px !important;' : ''">
                                        <v-tooltip :text="$t('chat.fileUpLoad')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    v-if="file && file.length > 0"
                                                    type="submit"
                                                    v-bind="props"
                                                    icon
                                                    variant="text"
                                                    class="text-medium-emphasis"
                                                    style="width: 30px; height: 30px; margin: 12.5px 0px 0px 0px"
                                                >
                                                    <Icons :icon="'upload'" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-file-input
                                            class="chat-file-up-load"
                                            :class="{ 'chat-file-up-load-display': file && file.length > 0 }"
                                            :style="
                                                file && file.length > 0
                                                    ? ''
                                                    : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'
                                            "
                                            v-model="file"
                                            label="Choose a file"
                                            prepend-icon="mdi-paperclip"
                                            outlined
                                            :disabled="disableChat"
                                        ></v-file-input>
                                        <v-tooltip
                                            v-if="type == 'chats' && !isSystemChat"
                                            :text="ProcessGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    icon
                                                    variant="text"
                                                    class="text-medium-emphasis"
                                                    @click="
                                                        openChatMenu();
                                                        toggleProcessGPTActive();
                                                    "
                                                    v-bind="props"
                                                    style="width: 30px; height: 30px; margin-left: 12px"
                                                    :disabled="disableChat"
                                                >
                                                    <img
                                                        :style="ProcessGPTActive ? 'opacity:1' : 'opacity:0.5'"
                                                        src="@/assets/images/chat/chat-icon.png"
                                                        style="height: 24px"
                                                    />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </v-row>
                                </v-form>
                                <slot name="custom-input-tools"></slot>
                            </div>
                        </v-row>
                    </div>

                    <div>
                        <template v-if="stopButtonOnly && inputOnly && (showStopButton || isLoading)">
                            <v-btn
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                @click="handleStopClick"
                            >
                                <Icons :icon="'outline-stop-circle'" :size="16" />
                            </v-btn>
                        </template>
                        <template v-else>
                            <v-btn
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important"
                                :disabled="isGenerationFinished || isMicRecorderLoading"
                                @click="isMicRecording ? stopVoiceRecording() : startVoiceRecording()"
                            >
                                <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" :size="'16'" />
                                <Icons v-else-if="isMicRecording" :icon="'stop'" :size="'16'" />
                                <Icons v-else :icon="'sharp-mic'" :size="'16'" />
                            </v-btn>

                            <v-tooltip :text="enableDesktopVoice ? $t('chat.headset') : '에이전트와 1:1 대화에서만 사용할 수 있습니다'">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        @click="enableDesktopVoice && !isGenerationFinished && (openChatMenu(), handleVoiceButtonClick())"
                                        class="mr-1 text-medium-emphasis"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        v-bind="props"
                                        :disabled="!enableDesktopVoice || isGenerationFinished"
                                        :color="desktopVoiceActive ? 'primary' : undefined"
                                        :style="
                                            desktopVoiceActive
                                                ? 'border-color: rgb(var(--v-theme-primary)) !important;'
                                                : 'border-color: #e0e0e0 !important;'
                                        "
                                    >
                                        <Icons :icon="'voice'" :size="'16'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <v-btn
                                v-if="!(showStopButton || isLoading) && !isGenerationFinished"
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                @click.prevent="beforeSend"
                                :disabled="disableBtn"
                            >
                                <icons :icon="'send-outline'" :size="16" />
                            </v-btn>
                            <v-btn
                                v-else-if="isGenerationFinished"
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                disabled
                            >
                                <v-progress-circular indeterminate color="primary" size="16"></v-progress-circular>
                            </v-btn>
                            <v-btn
                                v-else
                                class="cp-send text-medium-emphasis"
                                color="primary"
                                variant="outlined"
                                density="comfortable"
                                icon
                                size="small"
                                style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                                @click="handleStopClick"
                            >
                                <Icons :icon="'outline-stop-circle'" :size="16" />
                            </v-btn>
                        </template>
                    </div>
                </div>
            </form>
        </v-card>
    </div>
    <Record
        @close="recordingModeChange()"
        @start="startRecording()"
        @stop="stopRecording()"
        :audioResponse="newMessage"
        :chatRoomId="chatRoomId"
        :recordingMode="recordingMode"
    />

    <!-- 도구 설정 다이얼로그 (ChatRoomPage 등 부모에서도 ref.openToolsSettings() 로 호출) -->
    <v-dialog v-model="toolsSettingsDialog" max-width="560" persistent>
        <v-card class="pa-2" style="border-radius: 16px">
            <v-card-title class="d-flex align-center pa-3 pb-1">
                <div class="text-subtitle-1 font-weight-bold">
                    {{ $t('chatListing.toolsSettings') || '도구 설정' }}
                </div>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" @click="closeToolsSettingsDialog">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text class="pa-3 pt-2">
                <div class="text-caption text-medium-emphasis mb-3">
                    도구별 처리 강도를 조절합니다. 변경한 설정은 이 브라우저에 저장되며, 이후 처리부터 반영됩니다.
                </div>

                <!-- pdf2bpmn 섹션 -->
                <div class="d-flex align-center mb-2" style="gap: 6px">
                    <div class="text-subtitle-2 font-weight-medium">pdf2bpmn</div>
                    <v-tooltip location="top" max-width="380">
                        <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" size="16" color="grey">mdi-help-circle-outline</v-icon>
                        </template>
                        <div class="text-caption" style="white-space: normal; line-height: 1.5">
                            <div class="font-weight-bold mb-1">처리 강도 안내</div>
                            <div class="mb-1">
                                <b>간결</b> — 유사도 평가를 관대하게 적용합니다. 표현이 조금 다른 단계도 같은 활동으로 묶어 흐름을 압축해서 보여줍니다. 핵심 골격만 빠르게 파악하고 싶을 때 적합합니다.
                            </div>
                            <div class="mb-1">
                                <b>표준</b> — 권장 기본값입니다. 명백히 같은 단계만 합치고, 지침/설명이 다르면 분리해 균형 잡힌 결과를 보여줍니다.
                            </div>
                            <div>
                                <b>상세</b> — 엄격하게 분리합니다. 이름이 같아도 지침/설명이 조금이라도 다르면 별개 단계로 유지하여, 원문 절차에 가장 가까운 자세한 결과를 보여줍니다.
                            </div>
                        </div>
                    </v-tooltip>
                </div>
                <div class="text-caption text-medium-emphasis mb-2">
                    문서에서 추출한 단계와 역할의 정규화·중복 제거 강도입니다.
                </div>
                <v-btn-toggle
                    v-model="toolsSettingsDraft.pdf2bpmnLevel"
                    mandatory
                    color="primary"
                    density="comfortable"
                    variant="outlined"
                    divided
                    class="d-flex"
                >
                    <v-btn
                        v-for="opt in pdf2bpmnLevelOptions"
                        :key="opt.value"
                        :value="opt.value"
                        class="flex-grow-1"
                        style="text-transform: none"
                    >
                        <div class="d-flex flex-column align-center" style="gap: 2px">
                            <span class="text-body-2">{{ opt.label }}</span>
                            <span class="text-caption text-medium-emphasis">{{ opt.short }}</span>
                        </div>
                    </v-btn>
                </v-btn-toggle>
                <div class="text-caption text-medium-emphasis mt-3" style="line-height: 1.5">
                    {{ pdf2bpmnLevelOptions.find(o => o.value === toolsSettingsDraft.pdf2bpmnLevel)?.detail }}
                </div>
            </v-card-text>
            <v-card-actions class="pa-3 pt-0">
                <v-btn variant="text" size="small" @click="resetToolsSettingsDraft">
                    기본값
                </v-btn>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="closeToolsSettingsDialog">취소</v-btn>
                <v-btn color="primary" variant="flat" rounded @click="confirmToolsSettings">
                    {{ $t('chatListing.save') || '저장' }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { Icon } from '@iconify/vue';
import RetrievalBox from '../retrieval/RetrievalBox.vue';
import partialParse from 'partial-json-parser';
import ProgressAnimated from '@/components/ui/ProgressAnimated.vue';
import ScrollBottomHandle from '@/components/ui/ScrollBottomHandle.vue';
import AgentsChat from './AgentsChat.vue';
import HumanFeedbackPanel from './HumanFeedbackPanel.vue';
import axios from 'axios';
import { HistoryIcon } from 'vue-tabler-icons';
import Record from './Record.vue';
import SummaryButton from '@/components/ui/SummaryButton.vue';
import defaultWorkIcon from '@/assets/images/chat/chat-icon.png';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import ChatRoomNameGenerator from '@/components/ai/ChatRoomNameGenerator.js';
import ProcessWorkResult from './ProcessWorkResult.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import AgentMessagePanel from '@/components/ui/AgentMessagePanel.vue';
import { marked } from 'marked';
import OpenUiRenderer from '@/components/openui/OpenUiRenderer.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        Icon,
        RetrievalBox,
        AgentsChat,
        HumanFeedbackPanel,
        Record,
        DynamicForm,
        SummaryButton,
        ProcessWorkResult,
        DetailComponent,
        AgentMessagePanel,
        OpenUiRenderer
    },
    mixins: [ProgressAnimated, ScrollBottomHandle],
    props: {
        prompt: String,
        name: String,
        messages: Array,
        userInfo: Object,
        chatInfo: Object,
        disableChat: Boolean,
        isChanged: Boolean,
        type: String,
        agentInfo: Object,
        userList: Array,
        currentChatRoom: Object,
        lock: Boolean,
        generatedWorkList: Array,
        ProcessGPTActive: Boolean,
        isSystemChat: Boolean,
        isAgentMode: Boolean,
        chatRoomId: String,
        isMobile: Boolean,
        // 데스크탑 음성 에이전트 모드 활성화 여부 (ChatRoomPage에서 제어)
        desktopVoiceActive: {
            type: Boolean,
            default: false
        },
        // 말하기/듣기 버튼 노출 여부 (1:1 에이전트 대화일 때만 true)
        enableDesktopVoice: {
            type: Boolean,
            default: false
        },
        newMessageInfo: Object,
        hideInput: {
            type: Boolean,
            default: false
        },
        workAssistantAgentMode: {
            type: Boolean,
            default: false
        },
        // UnifiedChatInput에서 채팅방 내부(inline) 입력으로 사용할 때:
        // workAssistantAgentMode UI를 쓰되 외곽 v-card(박스 한 겹)를 제거하기 위한 플래그
        inputOnly: {
            type: Boolean,
            default: false
        },
        allUserList: {
            type: Array,
            default: []
        },
        participantUsers: {
            type: Array,
            default: () => []
        },
        howToUseInfo: {
            type: Object,
            default: null
        },
        showScrollTopButton: {
            type: Boolean,
            default: false
        },
        agentMessage: {
            type: Boolean,
            default: false
        },
        markdownEnabled: {
            type: Boolean,
            default: true
        },
        // ChatRoomPage에서 사용할 때: reply/json 액션/시간 배치 등 채팅방 전용 UI
        chatRoomMode: {
            type: Boolean,
            default: false
        },
        showDetailInfo: {
            type: Boolean,
            default: false
        },
        // workAssistantAgentMode 등에서 외부(부모) 로딩 상태에 따라
        // 전송 버튼 위치에 "중지" 버튼을 표시하기 위한 플래그
        showStopButton: {
            type: Boolean,
            default: false
        },
        // UnifiedChatInput(inline)에서 에이전트 동작 중 UI를 "중지 버튼만"으로 단순화
        stopButtonOnly: {
            type: Boolean,
            default: true
        },
        // true면 전송 시 파일 업로드를 여기서 기다리지 않고 부모로 위임
        deferFileUploadToParent: {
            type: Boolean,
            default: false
        },
        // ChatRoomPage/WorkAssistantChatPanel: PDF2BPMN 진행 상태 표시
        pdf2bpmnProgress: {
            type: Object,
            default: null
        },
        processGenerationProgress: {
            type: Object,
            default: null
        },
        // ChatRoomPage가 계산한 현재 HITL 질문
        pendingHumanFeedback: {
            type: Object,
            default: null
        }
    },
    emits: [
        'stopMessage',
        'clickedWorkOrder',
        'startWorkOrder',
        'toggleProcessGPTActive',
        'openVerMangerDialog',
        'requestDraftAgent',
        'viewProcess',
        'startProcess',
        'deleteWorkList',
        'cancelProcess',
        'deleteAllWorkList',
        'getMoreChat',
        'beforeReply',
        'sendEditedMessage',
        'sendMessage',
        'addTeam',
        'addTeamMembers',
        'requestFile',
        // 미리보기/외부 링크 오픈 (ChatRoomPage에서 다이얼로그 처리)
        'preview-bpmn',
        'preview-integrated-graph',
        'preview-image',
        'open-external-url',
        // 데스크탑 음성 에이전트 모드 토글
        'desktop-voice-toggle',
        'recording-mode-change',
        'invite-agent',
        'human-feedback-submit',
        'human-feedback-skip',
        // OpenUI 폼 상태/액션 전달
        'openui-state-update',
        'openui-action',
        'openui-parse-result'
    ],
    data() {
        return {
            workIcons: {
                ScheduleQuery: 'calendar-line-duotone', // 달력 아이콘
                ScheduleRegistration: 'calendar-line-duotone', // 달력 아이콘
                TodoListRegistration: 'overview', // TODO 리스트 아이콘
                StartProcessInstance: 'ibm-process-mining'
                // "CreateProcessDefinition" : "device-imac-cog"
            },
            recordingMode: false,
            defaultWorkIcon: defaultWorkIcon,
            displayGeneratedWorkList: false, // 애니메이션 후에 표시하기 위한 상태
            showGeneratedWorkList: false,
            mediaRecorder: null,
            audioChunks: [],
            isRecording: false,
            isMicRecording: false,
            micRecorder: null,
            micAudioChunks: [],
            isMicRecorderLoading: false,
            isReply: false,
            newMessage: '',
            hoverIndex: -1,
            editIndex: -1,
            editText: null,
            replyIndex: -1,
            replyUser: null,
            isViewJSON: [],
            isviewJSONStatus: false,
            attachedImages: [],
            delImgBtn: false,
            // PDF 업로드(정의체계도/패널 공통)
            selectedPdfFile: null,
            selectedPdfFiles: [],
            uploadedPdfInfo: null,
            uploadedPdfInfos: [],
            isPdfUploading: false,
            // orchestration: which chat server/runtime to use
            orchestration: 'langchain-react',
            selectableOrchestration: false,
            isDragOverTextarea: false,
            showNewMessageNoti: false,
            lastMessage: { name: '', content: '' },
            showNewMessageNotiTimer: null,
            showUserList: false,
            mentionStartIndex: null,
            mentionQuery: '',
            mentionedUsers: [], // Mention된 유저들의 정보를 저장할 배열
            file: null,
            isRender: false,
            highlightedMessageUuid: null,
            _highlightTimer: null,

            // assistantChat
            checked: true,
            isOpenedChatMenu: false,
            isViewWork: null,

            //preview-message
            previewMessage: null,

            agentPanelWidth: 380,
            isResizingAgentPanel: false,

            // 채팅창 높이 관련 변수
            windowWidth: window.innerWidth,

            generator: null,
            isGenerationFinished: false,

            // 메시지 히스토리 탐색 관련 변수
            messageHistoryIndex: -1,
            originalMessage: '', // 사용자가 타이핑하던 원본 메시지 저장

            // 팀원 추가 관련 상태
            showTeamMemberSelector: null, // 팀원 선택 UI를 표시할 메시지 인덱스
            selectedTeamMembersByMessage: {}, // 메시지별 선택된 팀원들
            teamMemberSearch: '', // 팀원 검색 텍스트

            // mention dropdown position (anchored near '@')
            mentionDropdownStyle: {},
            mentionActiveIndex: 0,

            // 사용자 정보
            currentUserName: localStorage.getItem('userName') || '사용자',
            currentUserPicture: localStorage.getItem('picture') || '/images/defaultUser.png',

            // 메시지 전송 중 플래그
            isSending: false,

            // 문서 도움말 상세정보
            chatDocumentHelpDetails: [
                { title: 'chat.helpIntro' },
                { title: 'chat.helpScheduleRegistration' },
                { title: 'chat.helpScheduleQuery' },
                { title: 'chat.helpProcessStart' },
                { title: 'chat.helpDocumentQuery' },
                { title: 'chat.helpDocumentGeneration' },
                { title: 'chat.helpTodoRegistration' },
                { title: 'chat.helpNote' }
            ],

            // 도구 설정 (브라우저 localStorage 기반 영구 상태).
            // - 채팅방/사용자가 아닌 "이 브라우저"에 저장하여 모든 Chat 인스턴스가 동일 키를 공유한다.
            // - 다이얼로그 UI/영속화/draft 관리까지 모두 Chat 내부에서 처리한다.
            // - 외부(ChatRoomPage 등)는 `$refs.<chat>.openToolsSettings()` 로 열기만 하면 되고,
            //   백엔드 전송 시에는 동일한 localStorage 키를 직접 읽으면 항상 최신값을 얻는다.
            toolsSettings: {
                pdf2bpmnLevel: 'standard'
            },
            toolsSettingsDialog: false,
            toolsSettingsDraft: {
                pdf2bpmnLevel: 'standard'
            },
            pdf2bpmnLevelOptions: [
                {
                    value: 'concise',
                    label: '간결',
                    short: '간략한 결과',
                    detail:
                        '유사도 평가를 관대하게 적용해 표현이 조금 다른 단계도 같은 활동으로 묶습니다. 결과 BPMN 의 단계 수가 줄어 핵심 흐름만 빠르게 파악할 수 있습니다.'
                },
                {
                    value: 'standard',
                    label: '표준',
                    short: '권장 기본값',
                    detail:
                        '지침/설명이 유사한 단계만 병합하고, 지침/설명이 다르면 분리합니다. 정확성과 가독성의 균형을 잡은 권장 설정입니다.'
                },
                {
                    value: 'detailed',
                    label: '상세',
                    short: '원문에 가까운 결과',
                    detail:
                        '엄격하게 분리합니다. 문서 내 지침/설명이 조금이라도 다르면 별개 단계로 유지하여 원문 절차에 가장 가까운 자세한 결과를 보여줍니다.'
                }
            ]
        };
    },
    created() {
        // 창 크기 변경 시 높이 조정을 위한 이벤트 리스너 추가
        window.addEventListener('resize', this.handleResize);
        // 도구 설정은 채팅방/사용자가 아닌 "이 브라우저" 설정 → 컴포넌트 생성 직후 localStorage 에서 로드.
        this.loadToolsSettings();
    },
    mounted() {
        var me = this;
        document.addEventListener('click', (event) => {
            if (event.target.matches('.request-file-link')) {
                event.preventDefault();
                me.$emit('requestFile', event.target.getAttribute('data-filename'));
            }
        });

        this.EventBus.on('scroll_update', () => {
            if (this.$refs && this.$refs.scrollContainer) {
                setTimeout(() => {
                    this.$refs.scrollContainer.update();
                }, 1000);
            }
        });

        this.$nextTick(() => {
            this.scrollToBottom();
        });
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.handleResize);
        this.stopAgentPanelResize();
        try {
            if (this._highlightTimer) clearTimeout(this._highlightTimer);
        } catch (e) {}
        this._highlightTimer = null;
    },
    watch: {
        prompt(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.newMessage = newVal;
                this.beforeSend();
            }
        },
        currentChatRoom: {
            immediate: true,
            handler(newRoom, oldRoom) {
                try {
                    const newId = newRoom?.id != null ? String(newRoom.id) : '';
                    const oldId = oldRoom?.id != null ? String(oldRoom.id) : '';
                    // 같은 방에 대한 메시지/미리보기 갱신마다 실행되므로, 방 전환 시에만 서버 값으로 동기화한다.
                    // (매 갱신마다 덮어쓰면 컴포저에서 선택한 orchestration 이 전송 전에 초기화됨)
                    if (newId && oldId && newId === oldId) {
                        return;
                    }
                    const ctx = newRoom?.context ?? newRoom?.room_context ?? newRoom?.roomContext ?? null;
                    const v = (ctx?.orchestration || '').toString().trim();
                    if (v == '' || v == null) {
                        this.selectableOrchestration = true;
                    } else {
                        this.selectableOrchestration = false;
                    }
                    this.orchestration = v === 'deepagents' ? 'deepagents' : 'langchain-react';
                } catch (e) {}
            }
        },
        newMessageInfo(newVal) {
            if (newVal && !this.isAtBottom) {
                this.previewMessage = newVal;
            }
        },
        isAtBottom(newVal) {
            if (newVal) {
                this.previewMessage = null;
            }
        }
    },
    computed: {
        orchestrationOptions() {
            return [
                { label: this.$t('chats.basicAgent'), value: 'langchain-react' },
                { label: this.$t('chats.deepAgent'), value: 'deepagents' }
            ];
        },
        isSystemMentioned() {
            return (
                this.mentionedUsers.some((user) => user.id === 'system_id') ||
                this.newMessage.startsWith('>') ||
                this.newMessage.startsWith('!')
            );
        },
        filteredUserList() {
            if (!this.showUserList || this.mentionStartIndex === null || !this.userList || !this.currentChatRoom) {
                return [];
            }
            const participants = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            // participants는 {id,email} 객체 배열일 수도 있고, id(string) 배열일 수도 있음
            const participantIds = new Set();
            const participantEmails = new Set();
            participants.forEach((p) => {
                if (!p) return;
                if (typeof p === 'string') {
                    const s = p.toString();
                    // 간단한 이메일 형태면 email로도 추가
                    if (s.includes('@')) participantEmails.add(s);
                    participantIds.add(s);
                    return;
                }
                if (p?.id) participantIds.add(p.id);
                if (p?.email) participantEmails.add(p.email);
            });
            const myEmail = this.userInfo?.email || null;
            const myId = this.userInfo?.id || this.userInfo?.uid || null;

            let userList = (Array.isArray(this.userList) ? this.userList : []).filter((user) => {
                const id = user?.id || null;
                const email = user?.email || null;
                const isParticipant = (id && participantIds.has(id)) || (email && participantEmails.has(email));
                if (!isParticipant) return false;
                // 나는 후보에서 제외
                if (myId && id && myId === id) return false;
                if (myEmail && email && myEmail === email) return false;
                return true;
            });

            // system은 '참여자'에 있을 때만 노출
            const hasSystem = participants.some((p) => p?.id === 'system_id' || p?.email === 'system@uengine.org');
            if (hasSystem) {
                userList = [
                    ...userList,
                    {
                        email: 'system@uengine.org',
                        id: 'system_id',
                        profile: '/images/chat-icon.png',
                        username: 'System'
                    }
                ];
            }

            const query = (this.mentionQuery || '').toString().toLowerCase().replace(/\s+/g, '');
            // 이미 mention된 유저는 리스트에서 제외
            return userList.filter((user) => {
                const username = (user?.username || '').toString();
                const normalized = username.toLowerCase().replace(/\s+/g, '');
                const okQuery = query ? normalized.includes(query) : true;
                const notMentioned = !this.mentionedUsers.some((mentionedUser) => mentionedUser.id === user.id);
                return okQuery && notMentioned;
            });
        },
        filteredMessages() {
            var list = [];
            const myEmail = localStorage.getItem('email');
            if (this.messages && this.messages.length > 0) {
                this.messages.forEach((item) => {
                    // __hidden 플래그: HITL 도구 옵션 응답("standard" 같은 id) 등 화면 표시가 불필요한 메시지.
                    // upsertMessageByKeys 는 hideUserMessage 일 때 호출되지 않지만, 다른 경로로 들어온 경우의 안전망.
                    if (item && item.__hidden) {
                        return;
                    }
                    let data = JSON.parse(JSON.stringify(item));
                    // CRITICAL: __humanFeedback 은 deep copy 하면 안 된다.
                    // 인라인 HumanFeedbackPanel 이 사용자의 제출 결과(__submitted, __selectedIds 등)를
                    // 이 객체에 직접 기록하는데, deep copy 본이면 원본(this.messages[i]) 에 반영이 안 되어
                    // computed 재실행 시 매번 새 deep copy 가 만들어져 readonly 상태가 사라진다.
                    // → __humanFeedback 만 원본 참조를 그대로 유지해 모든 갱신이 원본에 반영되게 한다.
                    if (item && item.__humanFeedback) {
                        data.__humanFeedback = item.__humanFeedback;
                    }

                    // 프로세스 실행 메시지에 formValues 초기화
                    if (data.work === 'StartProcessInstance' && data.firstActivityForm && !data.formValues) {
                        data.formValues = {};
                    }

                    const hasText = !!data.content || !!data.jsonContent || !!data.htmlContent;
                    const hasImage = !!data.image;
                    const hasImages = Array.isArray(data.images) && data.images.length > 0;
                    const files = this.getMessageFiles(data);
                    const hasFile = files.length > 0;

                    if (hasText || hasImage || hasImages || hasFile) {
                        list.push(data);
                    }
                });
            }
            if (list.length > 0 && list[list.length - 1].email == myEmail) {
                this.setRenderTime();
            }
            const seenRecommendationKeys = new Set();
            list = list.filter((m) => {
                if (!m || !m.__agentInviteRecommendation) return true;
                const agents = m.__agentInviteRecommendation.recommendedAgents || [];
                const key = agents
                    .map((a) => a.id)
                    .sort()
                    .join(',');
                if (!key || seenRecommendationKeys.has(key)) return false;
                seenRecommendationKeys.add(key);
                return true;
            });
            return list;
        },
        isMultiHumanChatRoom() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            const humanParticipants = parts.filter((p) => {
                if (!p) return false;
                if (p.isAgent === true || p.agent === true || p.is_agent === true) return false;
                const at = (p.agent_type || p.agentType || '').toString().toLowerCase();
                if (at === 'agent') return false;
                if (p.id === 'system_id' || p.email === 'system@uengine.org') return false;
                const roleOrType = (p.role || p.type || '').toString().toLowerCase();
                if (roleOrType === 'agent' || roleOrType === 'assistant') return false;
                return true;
            });
            return humanParticipants.length >= 2;
        },
        agentFilteredMessages() {
            return this.filteredMessages.filter((m) => this.isAgentRelatedMessage(m));
        },
        userFilteredMessages() {
            if (!this.showAgentMessagePanel) {
                return this.filteredMessages;
            }
            return this.filteredMessages.filter((m) => !this.isAgentRelatedMessage(m));
        },
        isAgentPanelWidthAvailable() {
            return this.windowWidth >= 1279;
        },
        showAgentMessagePanel() {
            return this.isMultiHumanChatRoom && this.agentFilteredMessages.length > 0 && this.isAgentPanelWidthAvailable;
        },
        // isLoading 상태의 변화를 감시합니다.
        isLoading: {
            get() {
                var res = false;
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach((item) => {
                        if (item.isLoading) {
                            res = item.isLoading;
                        }
                    });
                }
                return res;
            },
            set(val) {
                if (!val) {
                    // isLoading이 false로 변경되면 animateBorder 메서드를 호출합니다.
                    this.animateBorder();
                    this.$emit('stopMessage');
                }
            }
        },
        disableBtn() {
            if (this.workAssistantAgentMode) {
                // workAssistantAgentMode에서는 "텍스트/이미지/PDF" 중 하나라도 있으면 전송 활성화
                const hasText = !!this.newMessage && this.newMessage.trim() !== '';
                const hasImages = !!this.attachedImages && this.attachedImages.length > 0;
                const hasPdf = Array.isArray(this.selectedPdfFiles) ? this.selectedPdfFiles.length > 0 : !!this.selectedPdfFile;
                return !(hasText || hasImages || hasPdf);
            }
            if (this.disableChat) {
                return true;
            } else {
                if (this.newMessage !== '' || this.attachedImages.length > 0) {
                    return false;
                } else {
                    return true;
                }
            }
        },
        // 내가 보낸 메시지들만 필터링
        myMessages() {
            if (!this.messages || this.messages.length === 0) return [];
            return this.messages
                .filter((message) => message.email === this.userInfo.email && message.content && message.content.trim() !== '')
                .reverse(); // 최신 메시지가 먼저 오도록
        },
        // 팀원 검색 필터링
        filteredTeamMembers() {
            if (!this.allUserList) return [];

            let users = this.allUserList;

            // 검색 텍스트로 필터링
            if (this.teamMemberSearch) {
                const searchLower = this.teamMemberSearch.toLowerCase();
                users = users.filter(
                    (user) => user.username.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower)
                );
            }

            return users;
        },
        resolvedPlaceholder() {
            // definition-map 에서만 긴 예시 placeholder 사용
            try {
                const path = this.$route?.path || '';
                const isDefinitionMap = path.includes('definition-map');
                return this.$t(isDefinitionMap ? 'chat.definitionMapInputMessage' : 'chat.inputMessage');
            } catch (e) {
                return this.$t('chat.inputMessage');
            }
        }
    },
    methods: {
        openController() {
            this.openToolsSettings();
        },
        // ===== 도구 설정 (브라우저 localStorage) =====
        // 키 네임스페이스: "process-gpt"
        // 저장 형태: { pdf2bpmnLevel: "concise" | "standard" | "detailed", ... }
        // - 모든 Chat 인스턴스가 동일 키를 공유하므로, open 시점에 항상 재로드하여 동기화한다.
        // - 백엔드 전송측(ChatRoomPage 의 send payload 등)도 동일 키를 직접 읽으면 항상 최신값을 얻는다.
        loadToolsSettings() {
            const STORAGE_KEY = 'process-gpt:toolsSettings';
            const allowedLevels = new Set(['concise', 'standard', 'detailed']);
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    const lv = parsed.pdf2bpmnLevel;
                    if (typeof lv === 'string' && allowedLevels.has(lv)) {
                        this.toolsSettings.pdf2bpmnLevel = lv;
                    }
                }
            } catch (e) {
                // localStorage 접근 불가 환경(시크릿 모드 등)에서는 기본값 유지.
            }
        },
        persistToolsSettings() {
            const STORAGE_KEY = 'process-gpt:toolsSettings';
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toolsSettings));
            } catch (e) {
                // 저장 실패는 사용자 경험을 막지 않는다 (메모리 상태는 이미 갱신됨).
            }
        },
        // 외부(ChatRoomPage 등)에서 ref 로 호출하는 공개 메서드.
        // 다른 Chat 인스턴스가 변경했을 가능성이 있으므로 매번 localStorage 에서 재로드.
        openToolsSettings() {
            this.loadToolsSettings();
            this.toolsSettingsDraft = {
                pdf2bpmnLevel: this.toolsSettings?.pdf2bpmnLevel || 'standard'
            };
            this.toolsSettingsDialog = true;
        },
        closeToolsSettingsDialog() {
            this.toolsSettingsDialog = false;
        },
        resetToolsSettingsDraft() {
            this.toolsSettingsDraft = { pdf2bpmnLevel: 'standard' };
        },
        confirmToolsSettings() {
            const lv = this.toolsSettingsDraft?.pdf2bpmnLevel || 'standard';
            const allowed = new Set(['concise', 'standard', 'detailed']);
            this.toolsSettings = {
                ...(this.toolsSettings || {}),
                pdf2bpmnLevel: allowed.has(lv) ? lv : 'standard'
            };
            this.persistToolsSettings();
            this.toolsSettingsDialog = false;
        },
        emitHumanFeedbackSubmit(feedbackResult, message = null) {
            // 메시지가 명시적으로 전달된 경우(메시지 인라인 HITL 패널) 그 메시지 객체를 emit 첫 인자로.
            // 부모(ChatRoomPage.handleHumanFeedbackSubmit)가 .__humanFeedback 으로 정확한 매칭 가능.
            // 메시지가 없으면 기존 동작 유지(pendingHumanFeedback - 가장 최근 미제출 피드백).
            const firstArg = (message && message.__humanFeedback) ? message : (this.pendingHumanFeedback || null);
            this.$emit('human-feedback-submit', firstArg, feedbackResult);
        },
        emitHumanFeedbackSkip(message = null) {
            const firstArg = (message && message.__humanFeedback) ? message : (this.pendingHumanFeedback || null);
            this.$emit('human-feedback-skip', firstArg);
        },

        // ===================================================================
        // multi-question (통합) HITL 패널 — 사용자 개입 1회로 모든 질문 응답
        // ===================================================================
        registerMultiPanelRef(messageUuid, qIdx, el) {
            // Vue 3 ref callback. el 이 null 이면 unmount 시 정리.
            if (!this._multiPanelRefs) this._multiPanelRefs = {};
            if (!this._multiPanelRefs[messageUuid]) this._multiPanelRefs[messageUuid] = {};
            if (el == null) {
                delete this._multiPanelRefs[messageUuid][qIdx];
            } else {
                this._multiPanelRefs[messageUuid][qIdx] = el;
            }
        },
        getMultiInitialSelectedIds(message, qIdx) {
            const responses = message?.__humanFeedback?.__responses;
            if (!Array.isArray(responses)) return [];
            const r = responses[qIdx];
            return (r && Array.isArray(r.selectedIds)) ? r.selectedIds : [];
        },
        getMultiInitialCustomText(message, qIdx) {
            const responses = message?.__humanFeedback?.__responses;
            if (!Array.isArray(responses)) return '';
            const r = responses[qIdx];
            return (r && r.customText) ? String(r.customText) : '';
        },
        getMultiSectionSubmittedText(message, qIdx) {
            const responses = message?.__humanFeedback?.__responses;
            if (!Array.isArray(responses)) return '응답 완료';
            const r = responses[qIdx];
            if (!r) return '응답 완료';
            const items = r.selectedItems || [];
            const labels = items.map((it) => it?.label).filter(Boolean);
            let summary = labels.length > 0 ? `선택됨: ${labels.join(', ')}` : '응답 완료';
            if (r.customText) {
                const preview = r.customText.length > 30 ? r.customText.slice(0, 30) + '…' : r.customText;
                summary = summary === '응답 완료' ? `직접 입력: "${preview}"` : `${summary} · 직접 입력: "${preview}"`;
            }
            return summary;
        },
        submitMultiHumanFeedback(message) {
            const refs = (this._multiPanelRefs || {})[message.uuid] || {};
            const questions = message?.__humanFeedback?.questions || [];
            const responses = [];
            for (let i = 0; i < questions.length; i++) {
                const panel = refs[i];
                if (!panel || typeof panel.getResponse !== 'function') {
                    responses.push({ question_id: questions[i]?.question_id || '', skipped: true });
                    continue;
                }
                const resp = panel.getResponse();
                if (!resp) {
                    // canSubmit=false (필수 입력 누락 등) — empty 로 보냄. 백엔드는 hitl_is_skipped 처리.
                    responses.push({ question_id: questions[i]?.question_id || '', skipped: true });
                    continue;
                }
                responses.push({ ...resp, question_id: questions[i]?.question_id || '' });
            }
            // 부모(ChatRoomPage)로 multi 응답 전달
            this.$emit('human-feedback-submit', message, { type: 'multi', responses });
        },
        startAgentPanelResize(e) {
            e.preventDefault();
            this.isResizingAgentPanel = true;
            document.addEventListener('mousemove', this.onAgentPanelResize);
            document.addEventListener('mouseup', this.stopAgentPanelResize);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        },
        onAgentPanelResize(e) {
            if (!this.isResizingAgentPanel) return;
            const container = this.$refs.chatSplitContainer;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const newWidth = containerRect.right - e.clientX;
            const maxWidth = containerRect.width * 0.8;
            this.agentPanelWidth = Math.max(280, Math.min(newWidth, maxWidth));
        },
        stopAgentPanelResize() {
            this.isResizingAgentPanel = false;
            document.removeEventListener('mousemove', this.onAgentPanelResize);
            document.removeEventListener('mouseup', this.stopAgentPanelResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        },
        isAgentRelatedMessage(message) {
            if (!message) return false;
            return !!(
                message.__routingLoading ||
                message.__agentInviteRecommendation ||
                message._template === 'agent' ||
                message.role === 'agent' ||
                message.role === 'assistant'
            );
        },
        getLoadingLabel(message) {
            return message?.content || '생각 중...';
        },
        /**
         * 스트리밍 중(isLoading=true) 단계의 마크다운 렌더.
         * 토큰이 도착하기 전이거나 placeholder 만 있는 경우엔 회색 안내 텍스트,
         * 실제 콘텐츠가 들어오면 marked() + linkify 로 마크다운 렌더링.
         */
        renderStreamingMarkdown(message) {
            const raw = (message?.content || '').toString();
            const t = raw.trim();
            if (!t || t === '...' || t === '….' || t === '생각 중...' || t === '생각 중…' || t === 'AI 생성중...' || t === 'AI 생성 중...') {
                return '<span style="color:rgba(0,0,0,0.55)">생각 중...</span>';
            }
            marked.setOptions({ breaks: true, gfm: true });
            return marked(this.linkify(raw));
        },
        getRunningToolCall(message) {
            try {
                const tools = Array.isArray(message?.toolCalls) ? message.toolCalls : [];
                return tools.find((t) => t?.status === 'running') || null;
            } catch (e) {
                return null;
            }
        },
        hasAgentLogs(message) {
            return Array.isArray(message?.agentLogs) && message.agentLogs.length > 0;
        },
        getAgentPlanSummary(message) {
            const summary = (message?.agentPlan?.summary || '').toString().trim();
            if (summary) return summary;
            const logs = this.getRecentAgentLogs(message);
            const planLike = logs.find((l) => (l?.category || '').toString().toLowerCase() === 'plan');
            return (planLike?.message || '').toString().trim();
        },
        getAgentPlanSteps(message) {
            const steps = Array.isArray(message?.agentPlan?.steps) ? message.agentPlan.steps : [];
            return steps.filter((x) => (x || '').toString().trim().length > 0).slice(-6);
        },
        getRecentAgentLogs(message) {
            const logs = Array.isArray(message?.agentLogs) ? message.agentLogs : [];
            return logs.slice(-12).reverse();
        },
        formatAgentLogSummary(log) {
            if (!log || typeof log !== 'object') return '';
            const level = (log.level || 'info').toString().toUpperCase();
            const category = (log.category || 'runtime').toString();
            const message = (log.message || '').toString();
            return `[${level}/${category}] ${message}`;
        },
        emitPreviewImage(url) {
            if (!url) return;
            this.$emit('preview-image', url);
        },
        emitPreviewBpmn(bpmn) {
            if (!bpmn) return;
            this.$emit('preview-bpmn', bpmn);
        },
        isInlineProcessPreviewTarget(message, index) {
            if (!this.chatRoomMode) return false;
            if (!message || !['assistant', 'agent'].includes(String(message.role || '').toLowerCase())) return false;
            const status = String(this.processGenerationProgress?.status || '')
                .trim()
                .toLowerCase();
            const hasProgress =
                !!this.processGenerationProgress &&
                (['generating', 'completed'].includes(status) || !!this.processGenerationProgress?.bpmn_xml);
            return hasProgress || this.isProcessJsonMessage(message, index);
        },
        getInlineProcessName() {
            const progress = this.processGenerationProgress || {};
            return String(progress.process_name || progress.process_id || '프로세스').trim() || '프로세스';
        },
        getInlineProcessButtonLabel() {
            const processName = this.getInlineProcessName();
            const ready = !!(this.processGenerationProgress && this.processGenerationProgress.bpmn_xml);
            return ready ? `${processName}` : `${processName} 생성중...`;
        },
        isProcessJsonMessage(message, index) {
            const text = String(message?.content || '').trim();
            if (!text) return false;
            const hasShape = text.includes('"processDefinitionId"') && text.includes('"elements"');
            const looksJson = text.includes('{') && text.includes('}');
            return looksJson && hasShape;
        },
        _extractProcessJsonBlock(text) {
            const source = String(text || '');
            if (!source) return '';
            const fenceMatch = source.match(/```json\s*([\s\S]*?)```/i) || source.match(/```\s*([\s\S]*?)```/);
            if (fenceMatch?.[1]) {
                const candidate = String(fenceMatch[1] || '').trim();
                try {
                    const parsed = JSON.parse(candidate);
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements) && parsed.processDefinitionId) {
                        return fenceMatch[0];
                    }
                } catch (e) {
                    // ignore
                }
            }
            const firstBrace = source.indexOf('{');
            const lastBrace = source.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                const candidate = source.slice(firstBrace, lastBrace + 1).trim();
                try {
                    const parsed = JSON.parse(candidate);
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements) && parsed.processDefinitionId) {
                        return candidate;
                    }
                } catch (e) {
                    // ignore
                }
            }
            return '';
        },
        getDisplayMessageContent(message, index) {
            const original = String(message?.content || '');
            if (!this.isProcessJsonMessage(message, index)) return original;
            const jsonBlock = this._extractProcessJsonBlock(original);
            if (!jsonBlock) return original;
            const stripped = original.replace(jsonBlock, '').trim();
            return stripped || '프로세스가 생성되었습니다.';
        },
        _extractProcessDefinitionFromText(text) {
            const source = String(text || '').trim();
            if (!source) return null;
            const candidates = [];
            const fenceMatch = source.match(/```json\s*([\s\S]*?)```/i) || source.match(/```\s*([\s\S]*?)```/);
            if (fenceMatch?.[1]) candidates.push(fenceMatch[1]);
            candidates.push(source);
            const firstBrace = source.indexOf('{');
            const lastBrace = source.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                candidates.push(source.slice(firstBrace, lastBrace + 1));
            }
            for (const candidate of candidates) {
                try {
                    const parsed = JSON.parse(candidate);
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements)) {
                        return parsed;
                    }
                } catch (e) {
                    // ignore
                }
            }
            return null;
        },
        openInlineProcessPreview(message) {
            const progress = this.processGenerationProgress || {};
            const fallbackDefinition =
                progress.definition && typeof progress.definition === 'object'
                    ? progress.definition
                    : this._extractProcessDefinitionFromText(message?.content || '');
            this.emitPreviewBpmn({
                process_name: this.getInlineProcessName(),
                process_id: progress.process_id || '',
                bpmn_xml: progress.bpmn_xml || '',
                definition: fallbackDefinition || null
            });
        },
        emitPreviewIntegratedGraph(taskId) {
            const resolvedTaskId = String(taskId || '').trim();
            if (!resolvedTaskId) return;
            this.$emit('preview-integrated-graph', resolvedTaskId);
        },
        getPdf2bpmnBpmns(message) {
            const result = message?.pdf2bpmnResult || {};
            const generated = Array.isArray(result.generatedBpmns) ? result.generatedBpmns : [];
            if (generated.length > 0) return generated;

            const saved = Array.isArray(result.savedProcesses) ? result.savedProcesses : [];
            if (saved.length === 0) return [];

            return saved.map((proc) => ({
                process_id: proc?.process_id || proc?.id || '',
                process_name: proc?.process_name || proc?.name || 'Unnamed Process',
                bpmn_xml: proc?.bpmn_xml || ''
            }));
        },
        hasPdf2bpmnResultSections(message) {
            const bpmns = this.getPdf2bpmnBpmns(message);
            const skills = this.getPdf2bpmnSavedSkills(message);
            const agents = this.getPdf2bpmnSavedAgents(message);
            return bpmns.length > 0 || skills.length > 0 || agents.length > 0;
        },
        getPdf2bpmnSavedSkills(message) {
            const result = message?.pdf2bpmnResult || {};
            const list = Array.isArray(result.savedSkills)
                ? result.savedSkills
                : Array.isArray(result.saved_skills)
                ? result.saved_skills
                : [];
            return list.filter((x) => x && (x.name || x.safe_name));
        },
        getPdf2bpmnSavedAgents(message) {
            const result = message?.pdf2bpmnResult || {};
            const list = Array.isArray(result.savedAgents)
                ? result.savedAgents
                : Array.isArray(result.saved_agents)
                ? result.saved_agents
                : [];
            return list.filter((x) => x && x.id);
        },
        resolveSkillUrl(skill) {
            const directPath = String(skill?.url_path || '').trim();
            if (directPath) return `${window.location.origin}${directPath}`;
            const name = String(skill?.name || skill?.safe_name || '').trim();
            return name ? `${window.location.origin}/skills/${encodeURIComponent(name)}` : '';
        },
        resolveAgentUrl(agent) {
            const id = String(agent?.id || '').trim();
            return id ? `${window.location.origin}/agent-chat/${encodeURIComponent(id)}` : '';
        },
        emitOpenExternalUrl(url) {
            if (!url) return;
            this.$emit('open-external-url', url);
        },
        handleOpenUiStateUpdate(message, state) {
            try {
                if (!message) return;
                message.openuiState = state || null;
                this.$emit('openui-state-update', {
                    messageUuid: message.uuid || null,
                    state: state || null
                });
            } catch (e) {
                // ignore
            }
        },
        handleOpenUiAction(message, actionEvent) {
            try {
                if (!message) return;
                message.openuiLastAction = actionEvent || null;
                this.$emit('openui-action', {
                    messageUuid: message.uuid || null,
                    action: actionEvent || null,
                    state: message.openuiState || null
                });
            } catch (e) {
                // ignore
            }
        },
        handleOpenUiParseResult(message, parseResult) {
            try {
                if (!message) return;
                message.openuiParseResult = parseResult || null;
                message.openuiParseErrors = parseResult?.meta?.errors || [];
                this.$emit('openui-parse-result', {
                    messageUuid: message.uuid || null,
                    parseResult: parseResult || null
                });
            } catch (e) {
                // ignore
            }
        },
        isRecommendationInvited(message, agentId) {
            try {
                const rec = message?.__agentInviteRecommendation || null;
                const invited = rec?.invited || {};
                const id = (agentId || '').toString();
                if (!id) return false;
                return !!invited?.[id];
            } catch (e) {
                return false;
            }
        },
        inviteAgentFromRecommendation(message, agent) {
            try {
                const agentId = (agent?.id || '').toString();
                if (!agentId) return;
                // optimistic UI update: mark invited immediately
                if (message && message.__agentInviteRecommendation) {
                    if (!message.__agentInviteRecommendation.invited) message.__agentInviteRecommendation.invited = {};
                    message.__agentInviteRecommendation.invited[agentId] = true;
                }
                this.$emit('invite-agent', { messageUuid: message?.uuid || null, agentId });
            } catch (e) {
                // ignore
            }
        },
        formatBytes(bytes) {
            const b = Number(bytes);
            if (!Number.isFinite(b) || b <= 0) return '';
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
            const v = b / Math.pow(1024, i);
            const fixed = v >= 10 || i === 0 ? 0 : 1;
            return `${v.toFixed(fixed)}${units[i]}`;
        },
        formatAttachmentSub(fileObj) {
            try {
                const size = this.formatBytes(fileObj?.size || fileObj?.fileSize);
                const type = (fileObj?.type || fileObj?.fileType || '').toString();
                const parts = [size, type].filter(Boolean);
                return parts.join(' · ') || ' ';
            } catch (e) {
                return ' ';
            }
        },
        getMessageFiles(message) {
            const list = [];
            const arr = Array.isArray(message?.pdfFiles) ? message.pdfFiles : [];
            const single = message?.pdfFile ? [message.pdfFile] : [];
            for (const f of [...arr, ...single]) {
                if (!f) continue;
                const url = f.url || f.fileUrl || f.publicUrl || f.signedUrl || '';
                const name = f.name || f.fileName || '';
                if (!url && !name) continue;
                list.push(f);
            }
            const uniq = [];
            const seen = new Set();
            for (const f of list) {
                const key = `${f.url || f.fileUrl || f.publicUrl || f.signedUrl || ''}|${f.name || f.fileName || ''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                uniq.push(f);
            }
            return uniq;
        },
        shouldRenderMessageBubble(message) {
            try {
                const text = (message?.content ?? '').toString().trim();
                const hasText = !!text || !!message?.htmlContent || !!message?.jsonContent;
                const hasImage = !!message?.image;
                const hasImages = Array.isArray(message?.images) && message.images.length > 0;
                const hasFile = this.getMessageFiles(message).length > 0;
                const hasOpenUi = !!(message?.openuiLang && String(message.openuiLang).trim());
                return hasText || hasImage || hasImages || hasFile || hasOpenUi;
            } catch (e) {
                return (
                    !!message?.content ||
                    !!(message?.openuiLang && String(message.openuiLang).trim())
                );
            }
        },
        getFilenameFromUrl(url) {
            try {
                const u = new URL(url);
                const pathname = (u.pathname || '').toString();
                const last = pathname.split('/').filter(Boolean).pop();
                return last ? decodeURIComponent(last) : '';
            } catch (e) {
                return '';
            }
        },
        async downloadAttachment(url, filename) {
            if (!url) return;
            const name = filename || this.getFilenameFromUrl(url) || 'download';
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = name;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();

                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            } catch (e) {
                this.emitOpenExternalUrl(url);
            }
        },
        getProgressChipColor(status) {
            if (status === 'completed') return 'success';
            if (status === 'failed' || status === 'error') return 'error';
            if (status === 'processing') return 'primary';
            if (status === 'started') return 'blue';
            return 'grey';
        },
        handleStopClick() {
            // 전송 버튼 위치의 "중지" 버튼 클릭 처리
            // - 기존 Chat 로직(animateBorder + stopMessage emit)을 트리거
            // - 부모(WorkAssistantChatPanel 등)에서 stopMessage를 받아 실제 Abort 처리
            try {
                this.isLoading = false;
            } catch (e) {
                // ignore
            }
            if (this.showStopButton) {
                this.$emit('stopMessage');
            }
        },
        scrollToTop() {
            if (this.$refs.scrollContainer) {
                this.$refs.scrollContainer.$el.scrollTop = 0;
            }
        },
        renderedMarkdown(text) {
            if (!text) return '';

            const trimmedText = text.trim();
            // 스트리밍 placeholder/생성중 문구는 채팅 메시지 영역에 표시하지 않음
            if (trimmedText === '...' || trimmedText === '….') return '';
            if (trimmedText === 'AI 생성중...' || trimmedText === 'AI 생성 중...') return '';

            marked.setOptions({
                breaks: true,
                gfm: true
            });

            return marked(text);
        },
        handleResize() {
            // 화면 크기 변경 시 즉시 높이 업데이트
            this.windowWidth = window.innerWidth;

            // 스크롤 컨테이너가 존재하면 업데이트
            if (this.$refs && this.$refs.scrollContainer) {
                this.$refs.scrollContainer.update();
            }
        },
        clickedWorkOrder() {
            this.$emit('clickedWorkOrder');
        },
        startWorkOrder() {
            if (this.workAssistantAgentMode) {
                // 정의 맵에서는 chats로 이동하면서 업무지시 다이얼로그 열기
                this.$router.push({
                    path: '/chats',
                    query: {
                        openWorkOrder: 'true'
                    }
                });
            } else {
                // 일반 채팅에서는 기존대로 이벤트 emit
                this.$emit('startWorkOrder');
            }
            this.isOpenedChatMenu = false;
        },
        openChatMenu() {
            this.isOpenedChatMenu = !this.isOpenedChatMenu;
        },
        recordingModeChange() {
            this.recordingMode = !this.recordingMode;
            this.$emit('recording-mode-change', this.recordingMode);
            // this.$globalState.methods.toggleRightZoom();
        },
        handleVoiceButtonClick() {
            const isMobileViewport = window.innerWidth < 768;
            if (isMobileViewport) {
                // 모바일: 기존 풀스크린 Record.vue 열기
                this.recordingModeChange();
            } else {
                // 데스크탑: 인라인 텍스트 음성 모드 토글
                this.$emit('desktop-voice-toggle');
            }
        },
        // 애니메이션 표시를 위해 system의 답변이 있더라도 표시 가능하게 하려고 만든 methods
        shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index) {
            var resultIndex = 0;
            var oldIndex = 0;

            const myEmail = localStorage.getItem('email');
            for (let i = 0; i < filteredMessages.length; i++) {
                if (!filteredMessages[i].email) continue;
                if (filteredMessages[i].email == myEmail) {
                    oldIndex = resultIndex;
                    resultIndex = i;
                }
            }
            if (!this.isRender) {
                resultIndex = oldIndex;
            }
            return type == 'chats' && resultIndex == index && this.ProcessGPTActive && !this.isSystemChat;
        },
        setRenderTime() {
            this.isRender = false;
            setTimeout(() => {
                this.isRender = true;
            }, 3000);
        },
        getWorkIcon(workType) {
            return this.workIcons[workType] || this.defaultWorkIcon;
        },
        toggleProcessGPTActive() {
            this.$emit('toggleProcessGPTActive');
        },
        linkify(inputText) {
            var replacedText, replacePattern1, replacePattern2, replacePattern3;

            //URLs starting with http://, https://, or ftp://
            replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
            replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

            //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
            replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
            replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

            //Change email addresses to mailto:: links.
            replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
            replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

            return replacedText;
        },
        async startRecording() {
            this.isRecording = true;

            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start();
        },
        stopRecording() {
            this.isRecording = false;
            // MediaRecorder의 상태가 'recording'인 경우에만 stop 메서드를 호출
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                this.mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    this.uploadAudio(audioBlob);
                };
            }
        },
        async startVoiceRecording() {
            if (!navigator.mediaDevices) {
                this.$try({
                    action: async () => {
                        throw new Error();
                    },
                    errorMsg: this.$t('chat.micPermission.notSupported')
                });
                return;
            }
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                if (permissionStatus.state === 'denied') {
                    this.$try({
                        action: async () => {
                            throw new Error();
                        },
                        errorMsg: this.$t('chat.micPermission.denied')
                    });
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.isMicRecording = true;
                this.micRecorder = new MediaRecorder(stream);
                this.micAudioChunks = [];
                this.micRecorder.ondataavailable = (e) => {
                    this.micAudioChunks.push(e.data);
                };
                this.micRecorder.start();
            } catch (error) {
                this.isMicRecording = false;
                this.$try({
                    action: async () => {
                        throw new Error();
                    },
                    errorMsg: this.$t('chat.micPermission.denied')
                });
            }
        },
        stopVoiceRecording() {
            this.isMicRecording = false;
            // MediaRecorder의 상태가 'recording'인 경우에만 stop 메서드를 호출
            if (this.micRecorder && this.micRecorder.state === 'recording') {
                this.micRecorder.stop();
                this.micRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.micAudioChunks, { type: 'audio/wav' });
                    await this.uploadAudio(audioBlob);
                };
            }
        },
        async uploadAudio(audioBlob) {
            this.isMicRecorderLoading = true; // 로딩 상태 시작

            const formData = new FormData();
            formData.append('audio', audioBlob);

            try {
                const response = await axios.post(`/completion/upload`, formData);
                const data = response.data;
                this.newMessage = data.transcript;
            } catch (error) {
                console.error('Error:', error);
            } finally {
                this.isMicRecorderLoading = false; // 로딩 상태 종료
            }
        },
        submitFile() {
            var me = this;
            if (!me.file) return;
            const fileName = me.file[0].name;
            backend.uploadFile(fileName, me.file[0]).then((response) => {
                me.$try({
                    action: async () => {
                        me.$emit('uploadedFile', response);
                        this.file = null;
                    },
                    successMsg: '파일 업로드가 완료되었습니다.'
                });
            });
            // me.$try({
            //     action: async () => {
            //         if (!me.file) return;
            //         const fileName = me.file[0].name;
            //         const fileObj = {
            //             chat_room_id: me.chatRoomId,
            //             user_name: me.userInfo.name
            //         }
            //         const response = await backend.uploadFile(fileName, me.file[0], 'drive', fileObj);
            //         console.log(response);
            //         this.file = null
            //     },
            //     successMsg: '파일 업로드가 완료되었습니다.'
            // })
        },
        async downloadFile(source) {
            let filePath = null;
            if (source.storage_type == 'drive') {
                const options = {
                    storageType: 'drive'
                };
                filePath = await backend.getFileUrl(source.file_id, options);
            } else if (source.storage_type == 'storage') {
                filePath = await backend.getFileUrl(source.file_path);
            }
            if (filePath) {
                window.open(filePath, '_blank');
            } else {
                alert('파일을 찾을 수 없습니다.');
            }
        },
        openVerMangerDialog() {
            this.$emit('openVerMangerDialog', true);
        },
        handleTextareaInput(event) {
            // Vuetify/Vue 이벤트 형태가 케이스별로 다름:
            // - native input event: event.target.value
            // - update:modelValue 형태로 값(string)이 직접 넘어오는 경우도 있음
            const text = typeof event === 'string' ? event : event?.target?.value ?? this.newMessage ?? '';
            const textarea = this.getActiveTextareaEl(event);
            const caretPos = textarea && Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : text.length;
            const ctx = this.getMentionContext(text, caretPos);
            if (ctx) {
                this.mentionStartIndex = ctx.startIndex;
                this.mentionQuery = ctx.query;
                this.mentionActiveIndex = 0;
                // 위치 계산 전에 showUserList가 켜지면 (스타일 비어있는 상태로) 좌상단에 잠깐 뜨는 플래시가 발생할 수 있음
                this.showUserList = false;
                this.mentionDropdownStyle = { visibility: 'hidden' };
                this.$nextTick(() => {
                    this.updateMentionDropdownPosition(event);
                    this.showUserList = true;
                });
            } else {
                this.mentionStartIndex = null;
                this.mentionQuery = '';
                this.showUserList = false;
                this.mentionDropdownStyle = {};
            }

            // NOTE: 현재 UX는 "멘션은 chip으로만 표시" (텍스트에 @token을 넣지 않음)
            // 따라서 타이핑할 때마다 텍스트 기반으로 mentionedUsers를 자동 제거하면 chip이 사라지는 버그가 발생한다.
            // 멘션 제거는 chip의 X 버튼(`removeMentionedUser`)로만 처리한다.

            if (text.startsWith('>') || text.startsWith('!')) {
                // 명령어 목록 표시 로직 추가
            }

            // 사용자가 직접 입력하는 경우 히스토리 인덱스 초기화
            // if (this.messageHistoryIndex !== -1 && text !== this.myMessages[this.messageHistoryIndex]?.content) {
            //     this.resetMessageHistory();
            // }
        },
        handleTextareaCaretMove(event) {
            // caret 이동/클릭 시에도 위치 업데이트
            if (!this.showUserList) return;
            this.$nextTick(() => {
                this.updateMentionDropdownPosition(event);
            });
        },
        handleTextareaKeydown(event) {
            if (!this.showUserList) return;
            const key = (event?.key || '').toString();
            const list = Array.isArray(this.filteredUserList) ? this.filteredUserList : [];
            if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === 'Escape' || key === 'Tab') {
                event.preventDefault?.();
                event.stopPropagation?.();
            } else {
                return;
            }

            if (key === 'Escape' || key === 'Tab') {
                this.showUserList = false;
                this.mentionDropdownStyle = {};
                return;
            }

            if (list.length === 0) return;

            if (key === 'ArrowDown') {
                this.mentionActiveIndex = (this.mentionActiveIndex + 1) % list.length;
                this.$nextTick(() => this.scrollActiveMentionIntoView());
                return;
            }
            if (key === 'ArrowUp') {
                this.mentionActiveIndex = (this.mentionActiveIndex - 1 + list.length) % list.length;
                this.$nextTick(() => this.scrollActiveMentionIntoView());
                return;
            }
            if (key === 'Enter') {
                const picked = list[this.mentionActiveIndex] || null;
                if (picked) this.selectUser(picked);
                return;
            }
        },
        scrollActiveMentionIntoView() {
            try {
                const wrap = this.$el?.querySelector?.('.mention-autocomplete-wrap');
                const listEl = wrap?.querySelector?.('.mention-autocomplete-list');
                const items = listEl?.querySelectorAll?.('.mention-autocomplete-item');
                const el = items?.[this.mentionActiveIndex];
                el?.scrollIntoView?.({ block: 'nearest' });
            } catch (e) {}
        },
        getActiveTextareaEl(event) {
            if (event?.target && (event.target.tagName || '').toLowerCase() === 'textarea') return event.target;
            // Vuetify v-textarea 내부 textarea를 현재 wrap 기준으로 탐색
            try {
                const wrap = this.$el?.querySelector?.('.mention-autocomplete-wrap');
                const ta = wrap?.querySelector?.('textarea');
                return ta || null;
            } catch (e) {
                return null;
            }
        },
        getTextareaCaretCoordinates(textarea, position) {
            if (!textarea) return { left: 0, top: 0, height: 0 };
            const pos = Math.max(0, Math.min(position ?? 0, (textarea.value || '').length));
            const style = window.getComputedStyle(textarea);

            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.visibility = 'hidden';
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordWrap = 'break-word';
            div.style.top = '0';
            div.style.left = '-9999px';

            // mirror textarea styles that affect layout
            const props = [
                'boxSizing',
                'width',
                'height',
                'overflowX',
                'overflowY',
                'borderTopWidth',
                'borderRightWidth',
                'borderBottomWidth',
                'borderLeftWidth',
                'paddingTop',
                'paddingRight',
                'paddingBottom',
                'paddingLeft',
                'fontStyle',
                'fontVariant',
                'fontWeight',
                'fontStretch',
                'fontSize',
                'fontSizeAdjust',
                'lineHeight',
                'fontFamily',
                'textAlign',
                'textTransform',
                'textIndent',
                'textDecoration',
                'letterSpacing',
                'wordSpacing',
                'tabSize',
                'MozTabSize'
            ];
            props.forEach((p) => {
                try {
                    div.style[p] = style[p];
                } catch (e) {}
            });

            // content up to position
            const before = (textarea.value || '').substring(0, pos);
            div.textContent = before;

            const span = document.createElement('span');
            // ensure span has some content so it has dimensions
            span.textContent = (textarea.value || '').substring(pos) || '.';
            div.appendChild(span);

            document.body.appendChild(div);
            // reflect scroll
            div.scrollTop = textarea.scrollTop;
            div.scrollLeft = textarea.scrollLeft;

            const left = span.offsetLeft;
            const top = span.offsetTop;
            const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;

            document.body.removeChild(div);
            return { left, top, height: lh };
        },
        updateMentionDropdownPosition(event) {
            // showUserList가 true가 되기 전에도 위치 계산이 가능해야 플래시를 방지할 수 있음
            if (this.mentionStartIndex == null) return;
            const textarea = this.getActiveTextareaEl(event);
            if (!textarea) return;

            const wrap = textarea.closest?.('.mention-autocomplete-wrap') || this.$el?.querySelector?.('.mention-autocomplete-wrap');
            if (!wrap) return;

            // anchor at '@' position (not at current caret)
            const anchorPos = Math.max(0, Math.min(this.mentionStartIndex, (textarea.value || '').length));
            const caret = this.getTextareaCaretCoordinates(textarea, anchorPos);

            const wrapRect = wrap.getBoundingClientRect();
            const taRect = textarea.getBoundingClientRect();

            // position in wrap's coordinate space
            let left = taRect.left - wrapRect.left + caret.left - textarea.scrollLeft;
            let top = taRect.top - wrapRect.top - 20 + caret.top - textarea.scrollTop + caret.height;

            // clamp horizontally within wrap
            const maxLeft = Math.max(0, (wrap.clientWidth || 0) - 80);
            left = Math.max(8, Math.min(left, maxLeft));

            this.mentionDropdownStyle = {
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                transform: 'translateY(-100%)',
                marginTop: '-8px',
                visibility: 'visible'
            };
        },
        escapeRegExp(str) {
            return (str || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },
        getMentionContext(text, caretPos) {
            const s = (text || '').toString();
            const pos = Math.max(0, Math.min(Number(caretPos ?? 0), s.length));
            const beforeCaret = s.slice(0, pos);
            // "@..."는 공백/줄바꿈 등으로 끊긴다. 문장 중간에서도 직전 토큰이 @로 시작할 때만 활성화.
            // 예: "안녕 @jae" (활성), "안녕 @jae " (비활성), "안녕@jae" (비활성)
            const m = /(^|[\s([{"'`])@([0-9A-Za-z가-힣._-]*)$/.exec(beforeCaret);
            if (!m) return null;
            const at = beforeCaret.lastIndexOf('@');
            if (at < 0) return null;
            const query = (m[2] || '').toString();
            return { startIndex: at, query };
        },
        removeMentionedUser(user) {
            if (!user) return;
            const id = user?.id;
            this.mentionedUsers = (Array.isArray(this.mentionedUsers) ? this.mentionedUsers : []).filter((u) => u?.id !== id);
            const mentionText = (user?.mentionText || user?.username || '').toString();
            if (mentionText) {
                // "@token" 제거 (토큰 뒤 공백도 같이 정리)
                // NOTE: RegExp with 'u' flag disallows IdentityEscape like \`
                const re = new RegExp(
                    `(^|\\s)@${this.escapeRegExp(mentionText)}(?=$|[\\s\\n\\r\\t.,;:!?()\\[\\]{}"'` + '`' + `~<>/\\\\|])\\s*`,
                    'gu'
                );
                this.newMessage = (this.newMessage || '')
                    .replace(re, '$1')
                    .replace(/\s{2,}/g, ' ')
                    .trimStart();
            }
            this.showUserList = false;
            this.mentionStartIndex = null;
            this.mentionQuery = '';
            this.mentionDropdownStyle = {};
        },
        selectUser(user) {
            if (!user) return;
            if (this.mentionStartIndex == null) return;

            const textarea = this.getActiveTextareaEl();
            const caretPos =
                textarea && Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : (this.newMessage || '').length;

            const start = Math.max(0, Math.min(this.mentionStartIndex, (this.newMessage || '').length));
            const before = (this.newMessage || '').substring(0, start);
            const after = (this.newMessage || '').substring(caretPos);

            // UX: 텍스트 안에 "@이름"을 중복 표시하지 않고, chip으로만 표시한다.
            // (라우팅은 payload.mentionedUsers 기반)
            const mentionText = (user.username || user.email || user.id || '')
                .toString()
                .replace(/[@\r\n]/g, '')
                .trim();
            this.newMessage = `${before}${after}`.replace(/\s{2,}/g, ' ');

            this.showUserList = false;
            this.mentionStartIndex = null;
            this.mentionQuery = '';
            this.mentionDropdownStyle = {};
            this.mentionActiveIndex = 0;

            // Mention된 유저의 정보를 mentionedUsers 배열에 추가
            if (!this.mentionedUsers.some((mentionedUser) => mentionedUser.id === user.id)) {
                this.mentionedUsers.push({ ...user, mentionText });
            }

            // caret를 멘션 뒤로 이동
            this.$nextTick(() => {
                try {
                    const ta = this.getActiveTextareaEl();
                    if (!ta) return;
                    const nextPos = Math.min(before.length, (ta.value || '').length);
                    ta.focus?.();
                    ta.setSelectionRange?.(nextPos, nextPos);
                } catch (e) {}
            });
        },
        clickToScroll() {
            this.isAtBottom = true;
            this.scrollToBottom();
            this.showNewMessageNoti = false;
            this.lastMessage = {
                name: '',
                content: ''
            };
        },
        showNewMessage() {
            if (this.messages.length > 0) {
                if (this.userInfo.email != this.messages[this.messages.length - 1].email) {
                    this.lastMessage = {
                        name: this.messages[this.messages.length - 1].name,
                        content:
                            this.messages[this.messages.length - 1].content && this.messages[this.messages.length - 1].content.length > 130
                                ? this.messages[this.messages.length - 1].content.substring(0, 130) + '...'
                                : this.messages[this.messages.length - 1].content
                    };
                    this.showNewMessageNoti = true;

                    if (this.showNewMessageNotiTimer) {
                        clearTimeout(this.showNewMessageNotiTimer);
                    }

                    this.showNewMessageNotiTimer = setTimeout(() => {
                        this.showNewMessageNoti = false;
                    }, 5000);
                }
            }
        },
        getProfile(message) {
            if (!message) return '/images/defaultUser.png';
            if (message.role == 'system') return '/images/chat-icon.png';

            // agent/assistant 우선: 메시지에 profile이 있으면 사용
            if ((message.role == 'agent' || message.role == 'assistant') && message.profile) {
                return message.profile;
            }

            // agentId가 있으면 기본 아이콘으로 fallback
            if (message.agentId) {
                return message.profile ? message.profile : '/images/chat-icon.png';
            }

            if (!this.userList) return '/images/defaultUser.png';
            const list = Array.isArray(this.userList) ? this.userList : [];
            const user = message.email ? list.find((user) => user.email === message.email) : null;
            const profile = user && user.profile ? user.profile : null;
            return profile ? (profile.includes('defaultUser.png') ? '/images/defaultUser.png' : profile) : '/images/defaultUser.png';
        },
        requestDraftAgent() {
            this.$emit('requestDraftAgent', this.newMessage);
        },
        setMessageForUser(content) {
            if (content && typeof content == 'string') {
                let displayContent = content;

                if (content.includes(`"messageForUser":`)) {
                    let contentObj = partialParse(content);
                    displayContent = contentObj.messageForUser || content;
                } else if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
                    try {
                        let jsonObj = JSON.parse(content.trim());
                        if (jsonObj.user_message) {
                            displayContent = jsonObj.user_message;
                        }
                    } catch (e) {
                        // JSON 파싱 실패 시 원본 유지
                    }
                }

                marked.setOptions({ breaks: true, gfm: true });
                return marked(this.linkify(displayContent));
            }
        },
        setTableName(content) {
            let contentObj = partialParse(content);
            return contentObj.content || content;
        },
        viewProcess() {
            this.$emit('viewProcess');
        },
        formatTime(timeStamp) {
            var date = new Date(timeStamp);
            var dateString = date.toString();
            var timeString = dateString.split(' ')[4].substring(0, 5);
            return timeString;
        },
        formatToolName(name) {
            if (!name) return '';
            const raw = name.toString();
            const key = raw.split('__').pop();
            // WorkAssistantChatPanel의 매핑 일부를 재사용 (없으면 key 그대로)
            const toolNameMap = {
                get_process_list: '프로세스 목록 조회',
                get_process_detail: '프로세스 상세 조회',
                get_form_fields: '폼 필드 조회',
                execute_process: '프로세스 실행',
                get_instance_list: '인스턴스 목록 조회',
                get_todolist: '할일 목록 조회',
                get_organization: '조직도 조회',
                start_process_consulting: '프로세스 컨설팅 시작',
                generate_process: '프로세스 생성',
                create_pdf2bpmn_workitem: 'PDF→BPMN 변환 요청'
            };
            return toolNameMap[key] || key;
        },
        startProcess(messageObj, index) {
            this.$emit('startProcess', messageObj);
            if (this.ProcessGPTActive) {
                this.$emit('deleteWorkList', index);
            }
        },
        async executeProcessInstance(message, index) {
            const me = this;
            try {
                message.executing = true;

                // 폼 데이터 수집
                const formValues = message.formValues || {};

                // 프로세스 실행
                await me.$emit('executeProcess', {
                    processDefinitionId: message.processDefinitionId,
                    processDefinitionName: message.processDefinitionName,
                    formValues: formValues,
                    processDefinition: message.processDefinition,
                    firstActivityForm: message.firstActivityForm
                });

                message.executing = false;
                message.executed = true;
            } catch (error) {
                console.error('프로세스 실행 중 오류:', error);
                message.executing = false;
                alert('프로세스 실행 중 오류가 발생했습니다.');
            }
        },
        cancelProcess(messageObj) {
            this.$emit('cancelProcess', messageObj);
        },
        deleteAllWorkList() {
            this.$emit('deleteAllWorkList');
        },
        deleteWorkList(index) {
            this.$emit('deleteWorkList', index);
        },
        getMoreChat() {
            this.$emit('getMoreChat');
        },
        cancelReply() {
            this.isReply = false;
            this.replyUser = null;
            this.$emit('beforeReply', false);
        },
        beforeReply(message) {
            this.$emit('beforeReply', message);
            this.isReply = true;
            this.replyUser = message;
        },
        replyPreviewText(message) {
            try {
                const text = (message?.content || '').toString().trim();
                if (text) return text;
                const files = this.getMessageFiles(message);
                if (files.length > 0) {
                    const first = files[0];
                    const firstName = (first?.name || first?.fileName || '첨부파일').toString();
                    return files.length > 1 ? `[첨부파일] ${firstName} 외 ${files.length - 1}개` : `[첨부파일] ${firstName}`;
                }
                const images = Array.isArray(message?.images) ? message.images : [];
                if (images.length > 0) return `[이미지] ${images.length}장`;
                if (message?.image) return `[이미지] 1장`;
                return '';
            } catch (e) {
                return (message?.content || '').toString();
            }
        },
        scrollToOriginalMessage(uuid) {
            const targetUuid = (uuid || '').toString();
            if (!targetUuid) return;

            try {
                const container = this.$refs?.scrollContainer?.$el || this.$refs?.scrollContainer || null;
                if (!container || typeof container.querySelector !== 'function') return;

                const el = container.querySelector(`[data-msg-uuid="${CSS.escape(targetUuid)}"]`);
                if (!el) return;

                // 스크롤(컨테이너 기준) - 중앙에 오도록
                const cRect = container.getBoundingClientRect();
                const eRect = el.getBoundingClientRect();
                const currentTop = container.scrollTop || 0;
                const delta = eRect.top - cRect.top - (container.clientHeight / 2 - eRect.height / 2);
                const nextTop = currentTop + delta;
                if (typeof container.scrollTo === 'function') {
                    container.scrollTo({ top: nextTop, behavior: 'smooth' });
                } else {
                    container.scrollTop = nextTop;
                }

                // 하이라이트
                this.highlightedMessageUuid = targetUuid;
                if (this._highlightTimer) clearTimeout(this._highlightTimer);
                this._highlightTimer = setTimeout(() => {
                    this.highlightedMessageUuid = null;
                    this._highlightTimer = null;
                }, 2200);
            } catch (e) {
                // ignore
            }
        },
        beforeSend($event) {
            // 이미 전송 중이면 무시
            if (this.isSending) {
                return;
            }

            // keypress 이벤트인 경우 기본 동작 방지
            if ($event && $event.type === 'keypress') {
                // Shift+Enter는 줄바꿈 허용 (keypress.enter가 자동 처리)
                if ($event.shiftKey) {
                    return;
                }

                // 기본 동작 방지
                $event.preventDefault();
                $event.stopPropagation();
            }

            if (this.isAgentMode) {
                this.isSending = true;
                this.requestDraftAgent();
                setTimeout(() => {
                    this.newMessage = '';
                    this.isSending = false;
                }, 100);
            } else {
                if (this.isLoading) {
                    this.isLoading = false;
                    this.$emit('stopMessage');
                }
                var copyMsg = this.newMessage.replace(/(?:\r\n|\r|\n)/g, '');
                const hasPdf = Array.isArray(this.selectedPdfFiles) ? this.selectedPdfFiles.length > 0 : !!this.selectedPdfFile;
                if (copyMsg.length > 0 || this.attachedImages.length > 0 || hasPdf) {
                    this.isSending = true;
                    this.send();
                }
            }
        },
        async send() {
            if (this.editIndex >= 0) {
                // ChatRoomPage 등 DB 기반 채팅에서는 수정 내용을 저장까지 수행
                try {
                    const msg = this.messages?.[this.editIndex] || null;
                    const uuid = msg?.uuid || null;
                    const roomId = (this.chatRoomId || '').toString();
                    if (uuid && roomId) {
                        // 기존 shape 유지: { uuid, id, messages }
                        await backend.putObject(`db://chats/${uuid}`, {
                            uuid,
                            id: roomId,
                            messages: {
                                ...msg,
                                editedAt: new Date().toISOString()
                            }
                        });
                    }
                } catch (e) {
                    // ignore (저장 실패해도 UI는 유지)
                }
                this.$emit('sendEditedMessage', this.editIndex + 1);
                this.editIndex = -1;
            } else {
                const roomId = (this.chatRoomId || this.currentChatRoom?.id || '').toString();
                const hasRawFiles = Array.isArray(this.selectedPdfFiles) && this.selectedPdfFiles.length > 0;

                // roomId가 있으면 즉시 memento 경유 업로드, 없으면 raw File을 부모에 위임
                if (hasRawFiles && roomId && !this.deferFileUploadToParent) {
                    if (!Array.isArray(this.uploadedPdfInfos) || this.uploadedPdfInfos.length === 0) {
                        await this.ensurePdfUploadedFiles();
                    }
                }

                const uploadedFiles = Array.isArray(this.uploadedPdfInfos) ? this.uploadedPdfInfos : [];
                const rawFiles = hasRawFiles ? [...this.selectedPdfFiles] : [];
                const fallbackFiles = rawFiles.map((f) => ({
                    fileName: f?.name || '',
                    name: f?.name || '',
                    fileUrl: '',
                    publicUrl: '',
                    fullPath: '',
                    path: '',
                    fileType: f?.type || '',
                    fileSize: Number.isFinite(f?.size) ? f.size : null
                }));
                const filesForMessage = uploadedFiles.length > 0 ? uploadedFiles : fallbackFiles;

                this.$emit('sendMessage', {
                    images: this.attachedImages,
                    text: this.newMessage,
                    mentionedUsers: this.mentionedUsers,
                    orchestration: (this.orchestration || '').toString().trim() === 'deepagents' ? 'deepagents' : 'langchain-react',
                    file: filesForMessage[0] || null,
                    files: filesForMessage,
                    rawFiles,
                    reply: this.isReply
                        ? {
                              uuid: this.replyUser?.uuid || null,
                              name: this.replyUser?.name || this.replyUser?.userName || this.replyUser?.email || '',
                              content: this.replyPreviewText(this.replyUser)
                          }
                        : null
                });
            }
            if (this.isReply) this.isReply = false;
            this.attachedImages = [];
            this.selectedPdfFile = null;
            this.selectedPdfFiles = [];
            this.uploadedPdfInfo = null;
            this.uploadedPdfInfos = [];
            this.delImgBtn = false;
            this.isAtBottom = true;
            setTimeout(() => {
                // workAssistantAgentMode 여부와 관계없이 항상 메시지 초기화
                this.newMessage = '';
                this.mentionedUsers = [];
                this.mentionStartIndex = null;
                this.mentionQuery = '';
                this.showUserList = false;
                this.isSending = false;
            }, 100);
        },

        // ===== PDF (공통) =====
        triggerPdfSelect() {
            if (this.$refs.pdfUploader) {
                this.$refs.pdfUploader.value = '';
                this.$refs.pdfUploader.click();
            }
        },
        handlePdfSelect(e) {
            const selected = Array.from(e?.target?.files || []);
            if (!selected.length) return;

            // Allow PDF + common Office + image formats (stored to Supabase, converted/OCR’d server-side).
            const allowedExt = [
                '.pdf',
                '.doc',
                '.docx',
                '.hwp',
                '.hwpx',
                '.xls',
                '.xlsx',
                '.ppt',
                '.pptx',
                '.txt',
                '.csv',
                '.jpg',
                '.jpeg',
                '.png',
                '.gif',
                '.webp',
                '.bmp',
                '.tiff'
            ];
            const invalid = selected.find((f) => {
                const name = (f?.name || '').toLowerCase();
                return !allowedExt.some((ext) => name.endsWith(ext));
            });
            if (invalid) {
                alert('지원되는 파일 형식이 아닙니다. (PDF/Office/Image/Text)');
                if (this.$refs.pdfUploader) this.$refs.pdfUploader.value = '';
                if (this.$refs.unifiedFileInput) this.$refs.unifiedFileInput.value = '';
                return;
            }
            const current = Array.isArray(this.selectedPdfFiles) ? this.selectedPdfFiles : [];
            const merged = [...current];
            for (const f of selected) {
                const key = `${f.name}|${f.size}|${f.lastModified}`;
                const exists = merged.some((x) => `${x.name}|${x.size}|${x.lastModified}` === key);
                if (!exists) merged.push(f);
            }
            this.selectedPdfFiles = merged;
            this.selectedPdfFile = merged[0] || null;
            this.uploadedPdfInfo = null;
            this.uploadedPdfInfos = [];
        },
        clearSelectedPdf(index) {
            if (typeof index === 'number') {
                const list = Array.isArray(this.selectedPdfFiles) ? [...this.selectedPdfFiles] : [];
                if (index >= 0 && index < list.length) list.splice(index, 1);
                this.selectedPdfFiles = list;
            } else {
                this.selectedPdfFiles = [];
            }
            this.selectedPdfFile = this.selectedPdfFiles[0] || null;
            this.uploadedPdfInfo = null;
            this.uploadedPdfInfos = [];
            if (this.$refs.pdfUploader) this.$refs.pdfUploader.value = '';
            if (this.$refs.unifiedFileInput) this.$refs.unifiedFileInput.value = '';
        },
        async ensurePdfUploadedFiles() {
            const files = Array.isArray(this.selectedPdfFiles) ? this.selectedPdfFiles : [];
            if (!files.length) return [];
            if (Array.isArray(this.uploadedPdfInfos) && this.uploadedPdfInfos.length === files.length) {
                return this.uploadedPdfInfos;
            }
            if (this.isPdfUploading) return [];

            this.isPdfUploading = true;
            try {
                const uploaded = [];
                const uploadErrors = [];
                const roomId = (this.chatRoomId || this.currentChatRoom?.id || '').toString();
                for (const f of files) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        let uploadResult;
                        // memento /save-to-storage 경유 (임베딩 + 벡터 저장)
                        const options = {};
                        if (roomId) options.room_id = roomId;
                        uploadResult = await backend.uploadFileToStorage(f, options);
                        const resolvedUrl =
                            uploadResult?.public_url ||
                            uploadResult?.publicUrl ||
                            uploadResult?.fullPath ||
                            uploadResult?.fileUrl ||
                            uploadResult?.url ||
                            uploadResult?.path ||
                            null;
                        if (uploadResult && resolvedUrl) {
                            uploaded.push({
                                fileName: f.name,
                                fileUrl: resolvedUrl,
                                publicUrl: uploadResult?.publicUrl || resolvedUrl,
                                fullPath: uploadResult?.fullPath || resolvedUrl,
                                path: uploadResult?.path || '',
                                fileType: f.type,
                                fileSize: f.size
                            });
                        } else {
                            // 업로드 실패해도 UI에는 선택 파일을 유지해서 "몇 개 선택되었는지" 보이게 함
                            uploaded.push({
                                fileName: f.name,
                                fileUrl: '',
                                publicUrl: '',
                                fullPath: '',
                                path: '',
                                fileType: f.type,
                                fileSize: f.size,
                                uploadError: true,
                                uploadErrorMessage: '파일 URL을 생성하지 못했습니다.'
                            });
                            uploadErrors.push(`[${f.name}] 파일 URL 생성 실패`);
                        }
                    } catch (e) {
                        const msg = (e && (e.message || e.toString())) || '파일 업로드 실패';
                        uploaded.push({
                            fileName: f.name,
                            fileUrl: '',
                            publicUrl: '',
                            fullPath: '',
                            path: '',
                            fileType: f.type,
                            fileSize: f.size,
                            uploadError: true,
                            uploadErrorMessage: msg
                        });
                        uploadErrors.push(`[${f.name}] ${msg}`);
                    }
                }
                if (uploadErrors.length > 0) {
                    alert(`첨부 파일 처리 중 오류가 발생했습니다.\n${uploadErrors.join('\n')}`);
                }
                this.uploadedPdfInfos = uploaded;
                this.uploadedPdfInfo = uploaded[0] || null;
                return uploaded;
            } catch (error) {
                console.error('[Chat] 파일 업로드 오류:', error);
                return [];
            } finally {
                this.isPdfUploading = false;
            }
        },
        async ensurePdfUploaded() {
            const uploaded = await this.ensurePdfUploadedFiles();
            return uploaded[0] || null;
        },
        cancel() {
            // eslint-disable-next-line vue/no-mutating-props
            this.messages[this.editIndex].content = this.editText;
            this.editIndex = -1;
        },
        editMessage(index) {
            if (index && index >= 0) {
                this.editIndex = index;
            } else {
                this.editIndex = -1;
            }
            this.editIndex = index;
            this.editText = this.messages[this.editIndex].content;
        },
        viewWork(idx) {
            if (this.isViewWork) {
                this.isViewWork = null;
            } else {
                this.isViewWork = idx;
            }
            this.$nextTick(() => {
                this.$refs.scrollContainer.update();
            });
        },
        viewJSON(index) {
            this.isviewJSONStatus = !this.isviewJSONStatus;
            if (!this.isViewJSON.includes(index)) {
                this.isViewJSON.push(index);
            } else {
                this.isViewJSON = this.isViewJSON.filter((idx) => idx != index);
            }
            this.$nextTick(() => {
                this.$refs.scrollContainer.update();
            });
        },
        uploadImage() {
            const input = this.$refs.unifiedFileInput || this.$refs.uploader;
            if (!input) return;
            input.value = '';
            input.click();
        },
        async changeImage(e) {
            const me = this;
            const selectedFiles = Array.from(e?.target?.files || []);
            if (!selectedFiles.length) return;

            const imageFiles = selectedFiles.filter((f) => (f?.type || '').startsWith('image/'));
            const docFiles = selectedFiles.filter((f) => !(f?.type || '').startsWith('image/'));

            // 문서/오피스 파일은 기존 PDF 선택 경로로 일괄 처리
            if (docFiles.length > 0) {
                this.handlePdfSelect({ target: { files: docFiles } });
            }

            const toDataUrl = (file) =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event?.target?.result || '');
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(file);
                });

            const toCompressedPreview = (src) =>
                new Promise((resolve) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = src;
                    imgElement.onload = () => {
                        const canvas = document.createElement('canvas');
                        // AI Vision 분석을 위해 고해상도 유지 (최대 2048px)
                        const max_width = 2048;
                        const scaleSize = imgElement.width > max_width ? max_width / imgElement.width : 1;
                        canvas.width = imgElement.width * scaleSize;
                        canvas.height = imgElement.height * scaleSize;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                        resolve(ctx.canvas.toDataURL('image/jpeg', 0.9));
                    };
                    imgElement.onerror = () => resolve(src);
                });

            for (const imageFile of imageFiles) {
                if (window.location.hostname !== 'localhost') {
                    const originalName = imageFile.name || '';
                    const lastDot = originalName.lastIndexOf('.');
                    const extRaw = lastDot > -1 ? originalName.slice(lastDot) : '';
                    const ext = /^\.[0-9A-Za-z]+$/.test(extRaw) ? extRaw : '';
                    // supabase 저장 경로에 한글/특수문자(공백 포함)가 있으면 400 오류가 발생할 수 있어 UUID로 대체
                    const hasUnsafeChars = !originalName || /[^0-9A-Za-z._-]/.test(originalName);
                    const uuid = (() => {
                        try {
                            if (typeof crypto !== 'undefined') {
                                if (crypto.randomUUID) return crypto.randomUUID();
                                if (crypto.getRandomValues) {
                                    const buf = new Uint8Array(16);
                                    crypto.getRandomValues(buf);
                                    // RFC4122 v4
                                    buf[6] = (buf[6] & 0x0f) | 0x40;
                                    buf[8] = (buf[8] & 0x3f) | 0x80;
                                    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0'));
                                    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
                                        .slice(8, 10)
                                        .join('')}-${hex.slice(10, 16).join('')}`;
                                }
                            }
                        } catch (err) {
                            // ignore
                        }
                        // 최후 fallback (형식만 UUID v4 형태)
                        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                            const r = (Math.random() * 16) | 0;
                            const v = c === 'x' ? r : (r & 0x3) | 0x8;
                            return v.toString(16);
                        });
                    })();

                    const fileName = hasUnsafeChars ? `uploads/${uuid}${ext}` : `uploads/${originalName}`;
                    // eslint-disable-next-line no-await-in-loop
                    const data = await backend.uploadImage(fileName, imageFile);
                    if (data && data.path) {
                        // eslint-disable-next-line no-await-in-loop
                        const imageUrl = await backend.getImageUrl(data.path);
                        me.attachedImages.push({
                            id: `${Date.now()}-${Math.random()}`,
                            url: imageUrl,
                            file: imageFile
                        });
                    }
                } else {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const src = await toDataUrl(imageFile);
                        // eslint-disable-next-line no-await-in-loop
                        const srcEncoded = await toCompressedPreview(src);
                        me.attachedImages.push({
                            id: `${Date.now()}-${Math.random()}`,
                            url: srcEncoded,
                            file: imageFile
                        });
                    } catch (err) {
                        // ignore per-file preview error
                    }
                }
            }
        },
        capture() {
            this.$refs.captureImg.value = '';
            this.$refs.captureImg.click();
        },
        deleteImage(index) {
            this.attachedImages.splice(index, 1);
        },
        shouldDisplayUserInfo(message, index) {
            if (index === 0) return true;

            const prevMessage = this.userFilteredMessages[index - 1];

            // 이전 메시지와 보낸 사람이 다르면 유저 정보 표시
            if (message.email !== prevMessage.email) return true;

            // 같은 사람이 보낸 메시지라도 분 단위 시간이 다르면 유저 정보 표시
            const currentTime = new Date(message.timeStamp);
            const prevTime = new Date(prevMessage.timeStamp);

            // 분 단위로 비교 (년, 월, 일, 시, 분이 같은지 확인)
            if (
                currentTime.getFullYear() !== prevTime.getFullYear() ||
                currentTime.getMonth() !== prevTime.getMonth() ||
                currentTime.getDate() !== prevTime.getDate() ||
                currentTime.getHours() !== prevTime.getHours() ||
                currentTime.getMinutes() !== prevTime.getMinutes()
            ) {
                return true;
            }

            return false;
        },
        shouldDisplayMessageTimestamp(message, index) {
            const prevMessage = this.userFilteredMessages[index - 1];

            const nextMessage = index < this.userFilteredMessages.length - 1 ? this.userFilteredMessages[index + 1] : null;

            // 다음 메시지가 없거나, 다음 메시지의 이메일이 현재 메시지와 다르면 true 반환
            if (!nextMessage || message.email !== nextMessage.email) return true;

            // 다음 메시지와 현재 메시지의 시간이 분 단위까지 같은지 확인
            const currentTime = new Date(message.timeStamp);
            const nextTime = new Date(nextMessage.timeStamp);

            // 분 단위로 비교 (년, 월, 일, 시, 분이 같은지 확인)
            if (
                currentTime.getFullYear() !== nextTime.getFullYear() ||
                currentTime.getMonth() !== nextTime.getMonth() ||
                currentTime.getDate() !== nextTime.getDate() ||
                currentTime.getHours() !== nextTime.getHours() ||
                currentTime.getMinutes() !== nextTime.getMinutes()
            ) {
                return true;
            }

            return false;
        },
        handleTextareaDrop(e) {
            this.isDragOverTextarea = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                alert(this.$t('chat.onlyImageAllowed'));
                return;
            }
            this.changeImage({ target: { files } });
        },
        handlePaste(event) {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            let imageFound = false;

            for (const item of items) {
                // 이미지 형식인지 확인
                if (item.type.indexOf('image') === 0) {
                    const blob = item.getAsFile();
                    imageFound = true;

                    // 파일리더로 이미지 데이터 읽기
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const imgElement = document.createElement('img');
                        imgElement.src = e.target.result;
                        imgElement.onload = () => {
                            const canvas = document.createElement('canvas');
                            // AI Vision 분석을 위해 고해상도 유지 (최대 2048px)
                            const max_width = 2048;
                            const scaleSize = imgElement.width > max_width ? max_width / imgElement.width : 1;
                            canvas.width = imgElement.width * scaleSize;
                            canvas.height = imgElement.height * scaleSize;

                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                            // AI가 이미지를 제대로 인식할 수 있도록 높은 품질 유지 (0.9 = 90% 품질)
                            const srcEncoded = ctx.canvas.toDataURL('image/jpeg', 0.9);

                            // 이미지 배열에 추가
                            this.attachedImages.push({
                                id: Date.now(),
                                url: srcEncoded,
                                file: blob
                            });
                        };
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }

            // 이미지가 있으면 기본 텍스트 붙여넣기를 방지하지 않음
            if (!imageFound) {
                return true;
            }
        },
        shouldDisplayDateSeparator(message, index) {
            if (!message.timeStamp) return false;

            if (index === 0) {
                const currentDate = new Date(message.timeStamp);
                const today = new Date();

                // 첫 메시지가 오늘 날짜인 경우
                if (currentDate.toDateString() === today.toDateString()) {
                    // 오늘이 아닌 이전 메시지가 있는지 확인
                    const hasOlderMessages = this.userFilteredMessages.some((msg, idx) => {
                        if (!msg.timeStamp || idx === 0) return false;
                        const msgDate = new Date(msg.timeStamp);
                        return msgDate.toDateString() !== today.toDateString();
                    });
                    return hasOlderMessages;
                }
                return true;
            }

            if (index > 0) {
                const prevMessage = this.userFilteredMessages[index - 1];
                const currentDate = new Date(message.timeStamp);
                const prevDate = new Date(prevMessage.timeStamp);

                // 년, 월, 일이 다르면 날짜 구분선 표시
                return (
                    currentDate.getFullYear() !== prevDate.getFullYear() ||
                    currentDate.getMonth() !== prevDate.getMonth() ||
                    currentDate.getDate() !== prevDate.getDate()
                );
            }
            return false;
        },
        formatDateSeparator(timeStamp) {
            const date = new Date(timeStamp);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();

            // 요일명을 국제화 키로 가져오기
            const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = this.$t(`chats.${dayKeys[date.getDay()]}`);

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            // 오늘인지 확인
            if (date.toDateString() === today.toDateString()) {
                return this.$t('chats.today');
            }

            // 어제인지 확인
            if (date.toDateString() === yesterday.toDateString()) {
                return this.$t('chats.yesterday');
            }

            // 올해인지 확인
            if (date.getFullYear() === today.getFullYear()) {
                return this.$t('chats.thisYear', { month: month, day: day, dayName: dayName });
            }

            // 다른 해
            return this.$t('chats.otherYear', { year: year, month: month, day: day, dayName: dayName });
        },
        addTeam(message, index) {
            const data = {
                teamInfo: message.newTeamInfo,
                index: index
            };
            this.$emit('addTeam', data);
        },
        onGenerationFinished(responseObj) {
            if (responseObj && responseObj.includes('{')) {
                try {
                    responseObj = JSON.parse(responseObj);
                } catch (e) {
                    responseObj = partialParse(responseObj);
                }
            }
            if (responseObj.createdNewChatRoomName) {
                this.defMapMsgData.chatRoomName = responseObj.createdNewChatRoomName;
                this.isGenerationFinished = false;
                this.$router.push({
                    path: '/chats',
                    query: {
                        processMessage: encodeURIComponent(JSON.stringify(this.defMapMsgData))
                    }
                });
            }
        },
        // 메시지 히스토리 탐색 관련 메서드
        handleMessageHistoryNavigation(event) {
            // 방향키 위/아래 처리
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.navigateMessageHistory('up');
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.navigateMessageHistory('down');
            }
        },
        navigateMessageHistory(direction) {
            if (this.myMessages.length === 0) return;

            // 처음 탐색 시작할 때 현재 입력 메시지 저장
            if (this.messageHistoryIndex === -1) {
                this.originalMessage = this.newMessage;
            }

            if (direction === 'up') {
                // 위 방향키: 이전 메시지로 (인덱스 증가)
                if (this.messageHistoryIndex < this.myMessages.length - 1) {
                    this.messageHistoryIndex++;
                    this.newMessage = this.myMessages[this.messageHistoryIndex].content;
                }
            } else if (direction === 'down') {
                // 아래 방향키: 다음 메시지로 (인덱스 감소)
                if (this.messageHistoryIndex > 0) {
                    this.messageHistoryIndex--;
                    this.newMessage = this.myMessages[this.messageHistoryIndex].content;
                } else if (this.messageHistoryIndex === 0) {
                    // 맨 아래로 가면 원본 메시지 복원
                    this.messageHistoryIndex = -1;
                    this.newMessage = this.originalMessage;
                }
            }
        },
        // 메시지 입력 시 히스토리 인덱스 초기화
        resetMessageHistory() {
            this.messageHistoryIndex = -1;
            this.originalMessage = '';
        },
        // 팀원 선택 UI 토글
        toggleTeamMemberSelector(index) {
            if (this.showTeamMemberSelector === index) {
                this.closeTeamMemberSelector();
            } else {
                this.showTeamMemberSelector = index;
                // 해당 메시지에 대한 선택된 팀원이 없으면 빈 배열로 초기화
                if (!this.selectedTeamMembersByMessage[index]) {
                    this.selectedTeamMembersByMessage[index] = [];
                }
                this.teamMemberSearch = '';
            }
        },
        // 팀원 선택 UI 닫기
        closeTeamMemberSelector() {
            this.showTeamMemberSelector = null;
            this.teamMemberSearch = '';
        },
        // 팀원 선택 토글
        toggleTeamMemberSelection(user, messageIndex) {
            if (!this.selectedTeamMembersByMessage[messageIndex]) {
                this.selectedTeamMembersByMessage[messageIndex] = [];
            }

            const selectedList = this.selectedTeamMembersByMessage[messageIndex];
            const index = selectedList.indexOf(user.id);
            if (index > -1) {
                selectedList.splice(index, 1);
            } else {
                selectedList.push(user.id);
            }
        },
        // 선택된 팀원들 추가
        addSelectedTeamMembers(message, index) {
            const selectedList = this.selectedTeamMembersByMessage[index] || [];
            if (selectedList.length === 0) return;

            const selectedUsers = this.allUserList.filter((user) => selectedList.includes(user.id));

            const teamMemberData = {
                selectedTeamMembers: selectedUsers,
                selectedTeamInfo: message.newTeamInfo
            };

            this.$emit('addTeamMembers', teamMemberData);
            this.closeTeamMemberSelector();
        },
        navigateToCompanyQuery(url) {
            if (url) {
                this.$router.push(url);
            }
        }
    }
};
</script>

<style lang="scss">
@keyframes breathe {
    0%,
    100% {
        transform: scale(0.9);
    }
    50% {
        transform: scale(1.1);
    }
}

.find-message {
    animation: breathe 1.5s infinite ease-in-out;
}

.find-message-on {
    opacity: 1;
    cursor: pointer;
}
.find-message-off {
    opacity: 0.4;
}

.chat-file-up-load .v-input__control {
    display: none;
    margin-top: -20px;
}

.chat-file-up-load-display .v-input__control {
    display: block;
}

.chat-file-up-load-display .v-input__prepend {
    display: none;
}

.message-input-box .v-field__input {
    font-size: 16px;
    padding-left: 12px;
}

.message-input-box .v-field {
    padding: 0px;
}

.message-input-box .v-field__append-inner,
.v-field__prepend-inner {
    padding: 0px !important;
}

.textarea-drag-over .v-field {
    outline: 2px dashed rgb(var(--v-theme-primary));
    outline-offset: -2px;
    background-color: rgba(var(--v-theme-primary), 0.04);
}

/* 라우터 로딩(에이전트 선정 중) - '...'만 표시 */
.routing-loading-text {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.72);
    letter-spacing: 1px;
    animation: routingDotsPulse 1.1s infinite ease-in-out;
}

@keyframes routingDotsPulse {
    0%,
    100% {
        opacity: 0.35;
    }
    50% {
        opacity: 0.9;
    }
}

.prompt-edit-textarea textarea {
    padding: 5px !important;
}

.chat-reply-icon {
    position: absolute;
    bottom: -5px;
    right: 0px;
    z-index: 1;
    background-color: white;
}

.w-90 {
    width: 90% !important;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.badg-dotDetail {
    left: -9px;
    position: relative;
    bottom: -10px;
}

.toggleLeft {
    position: absolute;
    right: 15px;
    top: 15px;
}

.HideLeftPart {
    display: none;
}

@media (max-width: 960px) {
    .right-sidebar {
        position: absolute;
        right: -320px;

        &.showLeftPart {
            right: 0;
            z-index: 2;
            box-shadow: 2px 1px 20px rgba(0, 0, 0, 0.1);
        }
    }

    .boxoverlay {
        position: absolute;
        height: 100%;
        width: 100%;
        z-index: 1;
        background: rgba(0, 0, 0, 0.2);
    }
}

.shadow-none .v-field--no-label {
    --v-field-padding-top: -7px;
}

.user-list {
    border: 1px solid #ddd;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    background-color: white;
    z-index: 1000;
}

.user-list--dropup {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 8px);
}

.mention-autocomplete-wrap {
    position: relative;
    width: 100%;
    overflow: visible;
}

.mention-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
}

.mention-chip {
    max-width: 100%;
}

.message-mention-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
}

.message-mention-chip {
    max-width: 100%;
}

.mention-autocomplete-list {
    border-radius: 12px;
    padding: 6px 0;
    z-index: 20000;
    background: white;
    width: max-content;
    min-width: 220px;
    max-width: min(320px, 90vw);
}

.mention-autocomplete-empty {
    padding: 10px 12px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
}

.mention-autocomplete-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
}
.mention-autocomplete-item:hover {
    background: rgba(0, 0, 0, 0.04);
}
.mention-autocomplete-item--active {
    background: rgba(var(--v-theme-primary), 0.1);
}
.mention-autocomplete-avatar {
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    object-fit: cover;
    flex: 0 0 auto;
}
.mention-autocomplete-meta {
    min-width: 0;
    flex: 1 1 auto;
}
.mention-autocomplete-name {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.78);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mention-autocomplete-sub {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.definition-map-chat-menu-background {
    // background-color: rgb(var(--v-theme-primary), 0.15) !important;
    padding: 0px;
    display: flex;
    align-items: center;
}

.chat-menu-background {
    // background-color: rgb(var(--v-theme-primary), 0.15) !important;
    background-color: aliceblue !important;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    margin-left: 10px;
}

.message-info-box {
    margin: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(5px);
    border-radius: 4px 4px 0 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-bottom: none;
    width: 100%;
}

.message-info-content {
    padding: 8px 16px;
}

.message-info-box--reply {
    border-radius: 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.message-info-content--reply {
    padding: 10px 12px;
}

.reply-banner {
    display: flex;
    gap: 10px;
    align-items: stretch;
}

.reply-banner__main {
    min-width: 0;
    flex: 1 1 auto;
}

.reply-banner__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 2px;
}

.reply-banner__to {
    font-size: 12px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.75);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reply-banner--primary .reply-banner__to {
    color: rgb(var(--v-theme-primary));
}

.reply-banner__text {
    margin-top: 2px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.62);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reply-banner__close {
    color: rgba(0, 0, 0, 0.55);
}

.reply-quote {
    display: flex;
    gap: 10px;
    align-items: stretch;
    padding: 8px 10px;
    border-radius: 10px;
    margin-bottom: 10px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.72);
    cursor: pointer;
}

.reply-quote__body {
    min-width: 0;
    flex: 1 1 auto;
}

.reply-quote__title {
    font-size: 12px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reply-quote__text {
    margin-top: 2px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-message-row--highlight {
    animation: chatMessageHighlight 2.2s ease-out;
}

@keyframes chatMessageHighlight {
    0% {
        background: rgba(var(--v-theme-primary), 0.18);
        box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.28) inset;
        border-radius: 12px;
    }
    60% {
        background: rgba(var(--v-theme-primary), 0.08);
        box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.18) inset;
        border-radius: 12px;
    }
    100% {
        background: transparent;
        box-shadow: none;
        border-radius: 12px;
    }
}

.message-info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
    font-size: 0.875rem;
}

.message-info-text {
    color: rgba(0, 0, 0, 0.87);
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.user-name {
    font-weight: 500;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.87);
}

.chat-message-bubble-select-team-member {
    position: relative;
    max-width: 100%;
    margin-bottom: 4px;
}

.chat-message-bubble {
    position: relative;
    max-width: min(720px, 80vw);
    width: fit-content;
    display: inline-block;
    word-break: break-word;
}

.chat-message-bubble pre,
.other-message pre,
.agent-message pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.my-message {
    margin-left: auto;
    background-color: rgb(var(--v-theme-primary), 0.15) !important;
    border-radius: 15px 3px 15px 15px !important;
}

.other-message {
    margin-right: auto;
    border-radius: 8px !important;
    background-color: #f5f5f5 !important;
    max-width: min(720px, 80vw);
}

.agent-message {
    width: 100%;
    margin-right: auto;
    background-color: #f5f5f5 !important;
    border-radius: 8px !important;
    padding: 10px 12px;
    display: inline-block;
    max-width: min(720px, 80vw);
}

.markdown-content :deep(pre),
.markdown-content :deep(code) {
    white-space: pre-wrap;
}

.markdown-content :deep(pre) {
    white-space: pre;
    overflow-x: auto;
}

.markdown-timestamp {
    margin-top: 6px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    text-align: right;
}

.chat-input-card--inline {
    border: none !important;
    box-shadow: none !important;
    overflow: visible !important;
}

.chat-input-card {
    overflow: visible !important;
}

.message-timestamp {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 6px;
    display: block;
    position: static;
}

.message-bubble-wrap {
    display: inline-flex;
    flex-direction: column;
    max-width: min(720px, 80vw);
}

.chat-room-mode .message-bubble-wrap {
    flex-direction: row;
    align-items: flex-end;
    gap: 2px;
}

.chat-room-mode .message-timestamp {
    margin-top: 0;
    white-space: nowrap;
}

.chat-room-timestamp-action {
    position: relative;
    min-width: 34px;
    height: 14px;
    display: inline-flex;
    align-items: flex-end;
    justify-content: flex-end;
    margin-bottom: 1px;
}

.chat-room-timestamp-text {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    transition: opacity 120ms ease;
    white-space: nowrap;
    line-height: 1;
}

.chat-room-actions-overlay {
    position: absolute;
    bottom: -1px;
    display: inline-flex;
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
}

.chat-room-actions-overlay--mine {
    right: 0;
    justify-content: flex-end;
}

.chat-room-actions-overlay--other {
    left: 0;
    justify-content: flex-start;
}

.chat-room-action-btn {
    width: 26px;
    height: 26px;
    background-color: white !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.chat-room-stream-cursor {
    display: inline-block;
    margin-left: 2px;
    opacity: 0.75;
    animation: chat-room-cursor-blink 1s steps(1) infinite;
}

@keyframes chat-room-cursor-blink {
    50% {
        opacity: 0;
    }
}

.chat-room-tool-calls {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.chat-room-tool-call-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-family: inherit;
    color: rgba(0, 0, 0, 0.87);
}

.chat-room-tool-call-item .tool-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: min(520px, 70vw);
}

.chat-room-edit-wrap {
    max-width: min(720px, 80vw);
    width: fit-content;
}

.chat-room-loading-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #f5f5f5;
    max-width: min(720px, 80vw);
    color: rgba(0, 0, 0, 0.87);
    font-size: 13px;
    line-height: 1.45;
    font-family: inherit;
}

.chat-room-mode.chat-view-box {
    padding-bottom: 40px;
    box-sizing: border-box;
}

.chat-room-timestamp-action.is-hover .chat-room-timestamp-text,
.chat-room-timestamp-action.is-mobile .chat-room-timestamp-text {
    opacity: 0 !important;
}

.chat-room-timestamp-action.is-hover .chat-room-actions-overlay,
.chat-room-timestamp-action.is-mobile .chat-room-actions-overlay {
    opacity: 1;
    pointer-events: auto;
}

.message-bubble-wrap--mine .message-timestamp {
    text-align: left; /* 내 메시지: 버블 좌측 하단 */
}

.message-bubble-wrap--other .message-timestamp {
    text-align: right; /* 상대 메시지: 버블 우측 하단 */
}

.my-timestamp {
    text-align: left;
}

.other-timestamp {
    text-align: right;
}

.message-actions {
    position: relative;
    top: 17px;
    transform: translateY(-50%);
    display: none;
}

.chat-message-bubble-select-team-member:hover .message-actions {
    display: flex;
}

.chat-message-bubble:hover .message-actions {
    display: flex;
}

.action-btn {
    background-color: white !important;
    margin: 0 2px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

// 스크롤바 스타일링
.ps {
    &:hover {
        .ps__rail-y {
            opacity: 0.6;
        }
    }
}

.ps__rail-y {
    width: 8px !important;
    opacity: 0.3;
    background-color: transparent !important;

    .ps__thumb-y {
        width: 6px !important;
        background-color: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
    }
}

// 수정된 메서드에 맞게 스타일 수정
.progress-border {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    &[style*='flex-end'] {
        align-items: flex-end;
    }
}

// 기존 스타일은 유지하며 추가적인 스타일만 더함

// agent chat
.search-result {
    font-weight: bold;
}
.search-result-index {
    font-size: 10px;
    font-weight: bold;
    margin: 0 3px;
    vertical-align: top;
    line-height: normal;
}

.date-separator-container {
    display: flex;
    align-items: center;
    margin: 20px 0;
    padding: 0 16px;
}

.date-separator-line {
    flex: 1;
    opacity: 0.3;
}

/* HITL — multi-question 통합 패널 컨테이너 */
.hitl-feedback-multi-wrap {
    background: rgba(var(--v-theme-surface-variant), 0.05);
    border: 1px solid rgba(var(--v-theme-primary), 0.2);
    border-radius: 14px;
    padding: 12px 14px;
    max-width: 520px;
    margin-right: auto;
}
.hitl-multi-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: rgb(var(--v-theme-on-surface));
}
.hitl-multi-title {
    flex: 1;
    line-height: 1.3;
}
.hitl-multi-section {
    margin-bottom: 6px;
}
.hitl-multi-section + .hitl-multi-section {
    border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.1);
    padding-top: 6px;
}
.hitl-multi-section :deep(.human-feedback-panel) {
    /* 각 섹션 내부 패널은 외곽선 제거 — 컨테이너가 외곽선 갖고 있음 */
    border: none;
    background: transparent;
    padding: 6px 4px;
    margin: 0;
    max-width: none;
}
.hitl-multi-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.hitl-multi-submitted {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.date-separator-text {
    margin: 0 16px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    background-color: rgba(255, 255, 255, 0.9);
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
    text-align: center;
    min-width: fit-content;
}

// 팀원 선택 UI 스타일
.team-member-item {
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
        background-color: rgba(0, 0, 0, 0.04);
    }

    &.selected {
        background-color: rgba(var(--v-theme-primary), 0.1);
    }
}

.image-preview-item {
    position: relative;
    display: inline-block;
}

.image-preview-item .v-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 10;
}

.chat-participants-box {
    background-color: #f8f9fa;
    border-radius: 8px;
    margin: 8px;
    border: 1px solid #e9ecef;
}

// PDF2BPMN (ChatRoomPage)
.pdf2bpmn-progress-wrap {
    border-radius: 12px;
}

.pdf2bpmn-result-container {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    padding-top: 10px;
}

.pdf2bpmn-bpmn-card {
    cursor: pointer;
    border-radius: 12px;
}

.chat-split-container {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}
.chat-split-container.chat-split-active {
    flex-direction: row;
}
.chat-split-active .chat-view-box-split-left {
    flex: 1;
    min-width: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.06);
}
.chat-view-box-split-right {
    min-width: 280px;
    flex-shrink: 0;
}
.chat-split-resize-handle {
    width: 4px;
    cursor: col-resize;
    background-color: transparent;
    flex-shrink: 0;
    transition: background-color 0.15s;
    position: relative;
    z-index: 10;
}
.chat-split-resize-handle:hover,
.chat-split-resize-handle:active {
    background-color: rgba(var(--v-theme-primary), 0.3);
}

// Orchestration select (definition-map main input)
.orchestration-select {
    width: 150px;
    min-width: 120px;
}

.orchestration-select .v-field {
    border-radius: 10px;
}

.orchestration-select .v-field__input {
    min-height: 30px;
    padding-top: 2px;
    padding-bottom: 2px;
    font-size: 12px;
}

.orchestration-select .v-field__append-inner {
    padding-top: 0;
    padding-bottom: 0;
}
</style>

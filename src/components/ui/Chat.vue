<template>
    <div v-if="!workAssistantAgentMode" style="background-color: rgba( 255, 255, 255, 1 );"
        class="chat-info-view-wrapper"
    >
        <div class="chat-info-view-wrapper">
            <div class="chat-info-view-area">
                <div class="chat-info-view-area" style="position: relative;">
                    <slot name="custom-chat-top"></slot>
                    <slot name="custom-title" v-if="!workAssistantAgentMode">
                        <div v-if="name && name !== '' || chatInfo">
                            <div v-if="name && name !== ''" class="d-flex gap-2 align-center">
                                <div>
                                    <h5 class="text-h5 mb-n1">{{ name }}</h5>
                                </div>
                            </div>
                            <div v-else-if="chatInfo" class="d-flex gap-2 align-center">
                                <v-avatar v-if="chatInfo.img">
                                    <img :src="chatInfo.img" width="50" />
                                </v-avatar>
                                <div>
                                    <h5 class="text-h5 mb-n1">{{ $t(chatInfo.title) }}</h5>
                                    <small class="textPrimary"> {{ chatInfo.subtitle }} </small>
                                </div>
                            </div>
                            <slot name="custom-tools"></slot>
                        </div>
                        <v-divider style="margin:0px;" v-if="name && name !== '' || chatInfo || type == 'form'" />
                    </slot>

                    <!-- 스크롤 상하단 이동 아이콘 -->
                    <div v-if="showScrollTopButton" 
                        style="position: absolute; bottom: 8px; right: 8px; z-index: 1000; display: flex; flex-direction: column; gap: 8px; pointer-events: auto;"
                    >
                        <!-- 최상단 이동 -->
                        <v-icon
                            @click="scrollToTop"
                            color="primary"
                            size="28"
                            style="cursor: pointer; border-radius: 50%; padding: 4px;"
                        >
                            mdi-arrow-up-circle
                            <v-tooltip activator="parent" location="left">{{ $t('chat.moveTop') }}</v-tooltip>
                        </v-icon>
                        
                        <!-- 최하단 이동 -->
                        <v-icon
                            @click="scrollToBottom"
                            color="primary"
                            size="28"
                            style="cursor: pointer; border-radius: 50%; padding: 4px;"
                        >
                            mdi-arrow-down-circle
                            <v-tooltip activator="parent" location="left">{{ $t('chat.moveBottom') }}</v-tooltip>
                        </v-icon>
                    </div>

                    <perfect-scrollbar v-if="!workAssistantAgentMode"
                        :class="['h-100 chat-view-box', { 'chat-room-mode': chatRoomMode }]"
                        ref="scrollContainer"
                        @scroll="handleScroll"
                    >

                        <div class="d-flex w-100"
                            :style="$globalState.state.isRightZoomed ? 'height:100vh;' : ''"
                        >
                            <v-col class="chat-view-box-col pa-0">

                                <!-- 커스텀 콘텐츠 슬롯 -->
                                <slot name="custom-content"></slot>
                                
                                <InfoAlert :howToUseInfo="howToUseInfo"
                                    :chatInfo="chatInfo"
                                />

                                <!-- 참여자 현황 UI -->
                                <div v-if="participantUsers.length > 0"
                                    class="pa-4 chat-participants-box"
                                >
                                    <h6 class="text-subtitle-1 font-weight-bold mb-2" style="color: #333;">{{ $t('chat.participants') }}</h6>
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
                                                                    <v-icon size="small" style="color: #666;">mdi-account</v-icon>
                                                                </template>
                                                            </v-img>
                                                        </template>
                                                    </v-img>
                                                </v-avatar>
                                                <div class="flex-grow-1">
                                                    <div class="text-body-2 font-weight-medium" style="color: #444;">{{ participant.username || '이름 없음' }}</div>
                                                    <div class="text-caption" style="color: #666;">{{ participant.email || 'ID: ' + participant.id }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </v-row>
                                </div>
                                
                                <div
                                    v-for="(message, index) in filteredMessages"
                                    :key="index"
                                    class="py-1 px-3 chat-message-row"
                                    :class="{ 'chat-message-row--highlight': highlightedMessageUuid && message && message.uuid === highlightedMessageUuid }"
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
                                    
                                    <!-- PDF2BPMN 진행 카드 (마지막 메시지 하단) -->
                                    <div
                                        v-if="chatRoomMode && pdf2bpmnProgress && pdf2bpmnProgress.isActive && index === filteredMessages.length - 1"
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
                                                :color="(pdf2bpmnProgress.status === 'completed') ? 'success' : 'primary'"
                                            />
                                            <div class="d-flex align-center justify-space-between">
                                                <div class="text-caption text-medium-emphasis" style="max-width: 75%;">
                                                    {{ pdf2bpmnProgress.message || '' }}
                                                </div>
                                                <div class="text-caption font-weight-bold">
                                                    {{ pdf2bpmnProgress.progress || 0 }}%
                                                    <v-progress-circular
                                                        v-if="pdf2bpmnProgress.status === 'processing'"
                                                        style="margin-left: 3px; margin-bottom: 3px;"
                                                        indeterminate
                                                        size="12"
                                                        width="2"
                                                        color="primary"
                                                    />
                                                </div>
                                            </div>
                                            <div v-if="pdf2bpmnProgress.generatedBpmns && pdf2bpmnProgress.generatedBpmns.length > 0" class="mt-2">
                                                <div class="text-caption font-weight-bold mb-1">
                                                    생성된 프로세스 ({{ pdf2bpmnProgress.generatedBpmns.length }})
                                                </div>
                                                <div class="d-flex flex-wrap" style="gap: 8px;">
                                                    <v-chip
                                                        v-for="(bpmn, bIdx) in pdf2bpmnProgress.generatedBpmns"
                                                        :key="bIdx"
                                                        size="small"
                                                        variant="tonal"
                                                        color="success"
                                                        @click="emitPreviewBpmn(bpmn)"
                                                        style="cursor: pointer;"
                                                    >
                                                        <v-icon start size="14">mdi-sitemap</v-icon>
                                                        {{ bpmn.process_name || bpmn.process_id }}
                                                    </v-chip>
                                                </div>
                                            </div>
                                        </v-card>
                                    </div>
                                    
                                    <!-- 라우팅(에이전트 선정) 로딩: 아바타/헤더 없이 '...' 버블만 표시(상대방 버블 색상과 동일) -->
                                    <div v-if="message && message.__routingLoading">
                                        <div class="message-bubble-wrap message-bubble-wrap--other">
                                            <v-sheet class="other-message rounded-md pa-0 chat-message-bubble">
                                                <div class="pa-2">
                                                    <pre class="text-body-1 routing-loading-text">{{ (message.content || '...') }}</pre>
                                                </div>
                                            </v-sheet>
                                        </div>
                                    </div>

                                    <!-- 자동 추천(초대) 카드 -->
                                    <div v-else-if="message && message.__agentInviteRecommendation">
                                        <div class="message-bubble-wrap message-bubble-wrap--other">
                                            <v-sheet class="other-message rounded-md pa-0 chat-message-bubble">
                                                <div class="pa-3">
                                                    <div class="text-body-2 font-weight-bold mb-1">적절한 담당자를 초대해볼까요?</div>
                                                    <div
                                                        v-if="(message.__agentInviteRecommendation.reason || '').toString().trim()"
                                                        class="text-caption text-medium-emphasis mb-3"
                                                    >
                                                        {{ message.__agentInviteRecommendation.reason }}
                                                    </div>

                                                    <div
                                                        v-for="agent in (message.__agentInviteRecommendation.recommendedAgents || [])"
                                                        :key="agent.id"
                                                        class="d-flex align-center justify-space-between mb-2"
                                                        style="gap: 12px;"
                                                    >
                                                        <div class="d-flex align-center" style="gap: 10px; min-width: 0;">
                                                            <v-avatar size="26" color="grey-lighten-3">
                                                                <v-img :src="agent.profile || '/images/chat-icon.png'" cover />
                                                            </v-avatar>
                                                            <div style="min-width: 0;">
                                                                <div class="text-body-2 font-weight-medium">
                                                                    {{ agent.username || agent.id }}
                                                                </div>
                                                                <div
                                                                    class="text-caption text-medium-emphasis"
                                                                    style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
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

                                    <AgentsChat v-else-if="message && message._template === 'agent'" :message="message"
                                        :agentInfo="agentInfo" :totalSize="filteredMessages.length" :currentIndex="index"
                                    />
                                    <div v-else>
                                        <div>
                                            <div v-if="message.email == userInfo.email && message.role != 'system'">
                                                <div v-if="editIndex === index" class="d-flex justify-end">
                                                    <div class="bg-lightprimary chat-room-edit-wrap" style="border-radius:10px;">
                                                        <v-textarea v-model="messages[index].content"
                                                            variant="solo" hide-details bg-color="lightprimary" class="shadow-none"
                                                            density="compact" auto-grow rows="1"
                                                            autofocus
                                                        >
                                                        </v-textarea>
                                                        <v-row class="pa-0 ma-0 mr-2 pb-2">
                                                            <v-spacer></v-spacer>
                                                            <v-btn @click="send"
                                                                class="text-medium-emphasis"
                                                                icon variant="text" size="x-small"  
                                                                style="background-color:white !important; margin-right:5px;" 
                                                            >
                                                                <SendIcon size="20" />
                                                            </v-btn>
                                                            <v-btn @click="cancel"
                                                                class="text-medium-emphasis"
                                                                icon variant="text" size="x-small"  
                                                                style="background-color:white !important;"
                                                            >
                                                                <Icons :icon="'backspace-bold'" :size="20"  />
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
                                                                    :style="shouldDisplayMessageTimestamp(message, index) ? '' : 'opacity:0;'"
                                                                >
                                                                    {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                </span>
                                                                <div class="chat-room-actions-overlay chat-room-actions-overlay--mine">
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
                                                                        v-if="shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index)"
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
                                                            <v-sheet class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1">
                                                                <div 
                                                                >
                                                                    <div
                                                                        v-if="message.replyUserName || message.replyContent"
                                                                        class="reply-quote reply-quote--mine"
                                                                        role="button"
                                                                        tabindex="0"
                                                                        @click.stop="scrollToOriginalMessage(message.replyUuid)"
                                                                    >
                                                                        <div class="reply-quote__body">
                                                                            <div class="reply-quote__title">
                                                                                {{ (message.replyUserName || '').toString() }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                            </div>
                                                                            <div class="reply-quote__text">
                                                                                {{ message.replyContent || '' }}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <!-- 첨부(이미지/파일): content가 비어도 메시지 박스로 표시/답장 가능 -->
                                                                    <div v-if="message.image || (message.images && message.images.length > 0) || (message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl))" class="mb-2">
                                                                        <!-- 단일 이미지 표시 (기존 호환성) -->
                                                                        <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                                            <img
                                                                                :src="message.image"
                                                                                class="rounded-md"
                                                                                alt="pro"
                                                                                width="250"
                                                                                style="cursor: pointer;"
                                                                                @click="emitPreviewImage(message.image)"
                                                                            />
                                                                        </v-sheet>

                                                                        <!-- 다중 이미지 표시 -->
                                                                        <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                                            <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                                                <img
                                                                                    :src="image.url || image"
                                                                                    class="rounded-md"
                                                                                    alt="pro"
                                                                                    width="250"
                                                                                    style="cursor: pointer;"
                                                                                    @click="emitPreviewImage(image.url || image)"
                                                                                />
                                                                            </v-sheet>
                                                                        </div>

                                                                        <!-- 파일 첨부 -->
                                                                        <div v-if="message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl)" class="mb-1 d-flex justify-end">
                                                                            <v-sheet
                                                                                rounded="lg"
                                                                                class="pa-2 d-inline-flex align-center"
                                                                                style="gap: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08); background: white; max-width: min(520px, 80vw);"
                                                                                @click="emitOpenExternalUrl(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                            >
                                                                                <div style="width:28px; height:28px; border-radius:10px; display:flex; align-items:center; justify-content:center; background: rgba(var(--v-theme-primary), 0.12);">
                                                                                    <v-icon size="18" color="primary">mdi-file-outline</v-icon>
                                                                                </div>
                                                                                <div style="min-width:0; flex:1 1 auto;">
                                                                                    <div style="font-size:13px; font-weight:700; color: rgba(0,0,0,0.78); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                        {{ message.pdfFile.name || message.pdfFile.fileName || '첨부파일' }}
                                                                                    </div>
                                                                                    <div style="font-size:11px; color: rgba(0,0,0,0.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                        {{ formatAttachmentSub(message.pdfFile) }}
                                                                                    </div>
                                                                                </div>
                                                                                <v-btn
                                                                                    icon
                                                                                    size="x-small"
                                                                                    variant="tonal"
                                                                                    :disabled="!(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                                    @click.stop="downloadAttachment(message.pdfFile.url || message.pdfFile.fileUrl, message.pdfFile.name || message.pdfFile.fileName)"
                                                                                >
                                                                                    <v-icon size="14">mdi-download</v-icon>
                                                                                </v-btn>
                                                                            </v-sheet>
                                                                        </div>
                                                                    </div>
        
                                                                    <div v-if="message.contentType && message.contentType == 'html'" class="w-100">
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
                                                                        v-if="message.mentionedUsers && message.mentionedUsers.length > 0"
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
                                                                    <pre v-if="message.content && message.contentType != 'html'" class="text-body-1" v-html="linkify(message.content)"></pre>

                                                                    <pre v-if="message.jsonContent && message.contentType != 'html'"
                                                                        class="text-body-1">{{ message.jsonContent }}</pre>
                                                                    <v-row class="ma-0 pa-0">
                                                                        <v-spacer></v-spacer>
                                                                    </v-row>
                                                                </div>
                                                            </v-sheet>
                                                        </div>
                                                        <div v-else class="message-bubble-wrap message-bubble-wrap--mine">
                                                            <v-sheet class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1">
                                                                <div 
                                                                    @mouseover="hoverIndex = index"
                                                                    @mouseleave="hoverIndex = -1"
                                                                >
                                                                <div
                                                                        v-if="message.replyUserName || message.replyContent"
                                                                        class="reply-quote reply-quote--mine"
                                                                    role="button"
                                                                    tabindex="0"
                                                                    @click.stop="scrollToOriginalMessage(message.replyUuid)"
                                                                    >
                                                                        <div class="reply-quote__body">
                                                                            <div class="reply-quote__title">
                                                                            {{ (message.replyUserName || '').toString() }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                            </div>
                                                                            <div class="reply-quote__text">
                                                                                {{ message.replyContent || '' }}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <!-- 첨부(이미지/파일): content가 비어도 메시지 박스로 표시 -->
                                                                    <div v-if="message.image || (message.images && message.images.length > 0) || (message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl))" class="mb-2">
                                                                        <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                                            <img
                                                                                :src="message.image"
                                                                                class="rounded-md"
                                                                                alt="pro"
                                                                                width="250"
                                                                                style="cursor: pointer;"
                                                                                @click="emitPreviewImage(message.image)"
                                                                            />
                                                                        </v-sheet>
                                                                        <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                                            <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                                                <img
                                                                                    :src="image.url || image"
                                                                                    class="rounded-md"
                                                                                    alt="pro"
                                                                                    width="250"
                                                                                    style="cursor: pointer;"
                                                                                    @click="emitPreviewImage(image.url || image)"
                                                                                />
                                                                            </v-sheet>
                                                                        </div>
                                                                        <div v-if="message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl)" class="mb-1 d-flex justify-end">
                                                                            <v-sheet
                                                                                rounded="lg"
                                                                                class="pa-2 d-inline-flex align-center"
                                                                                style="gap: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08); background: rgba(var(--v-theme-primary), 0.06); max-width: min(520px, 80vw);"
                                                                                @click="emitOpenExternalUrl(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                            >
                                                                                <div style="width:28px; height:28px; border-radius:10px; display:flex; align-items:center; justify-content:center; background: rgba(var(--v-theme-primary), 0.12);">
                                                                                    <v-icon size="18" color="primary">mdi-file-outline</v-icon>
                                                                                </div>
                                                                                <div style="min-width:0; flex:1 1 auto;">
                                                                                    <div style="font-size:13px; font-weight:700; color: rgba(0,0,0,0.78); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                        {{ message.pdfFile.name || message.pdfFile.fileName || '첨부파일' }}
                                                                                    </div>
                                                                                    <div style="font-size:11px; color: rgba(0,0,0,0.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                        {{ formatAttachmentSub(message.pdfFile) }}
                                                                                    </div>
                                                                                </div>
                                                                                <v-btn
                                                                                    icon
                                                                                    size="x-small"
                                                                                    variant="tonal"
                                                                                    :disabled="!(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                                    @click.stop="downloadAttachment(message.pdfFile.url || message.pdfFile.fileUrl, message.pdfFile.name || message.pdfFile.fileName)"
                                                                                >
                                                                                    <v-icon size="14">mdi-download</v-icon>
                                                                                </v-btn>
                                                                            </v-sheet>
                                                                        </div>
                                                                    </div>
        
                                                                    <div v-if="message.contentType && message.contentType == 'html'" class="w-100">
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
                                                                        v-if="message.mentionedUsers && message.mentionedUsers.length > 0"
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
                                                                    <pre v-if="message.content && message.contentType != 'html'" class="text-body-1" v-html="linkify(message.content)"></pre>

                                                                    <pre v-if="message.jsonContent && message.contentType != 'html'"
                                                                        class="text-body-1">{{ message.jsonContent }}</pre>
                                                                    <v-row class="ma-0 pa-0">
                                                                        <v-spacer></v-spacer>
                                                                        <v-btn v-if="hoverIndex === index && !disableChat"
                                                                            @click="editMessage(index)" icon variant="text" size="x-small"
                                                                            class="float-left edit-btn action-btn"
                                                                            style="background-color:white;"
                                                                        >
                                                                            <icons :icon="'pencil'" :size="20"  />
                                                                        </v-btn>
            
                                                                        <div v-if="shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index)"
                                                                            :key="isRender"
                                                                        >
                                                                            <div @click="showGeneratedWorkList = !showGeneratedWorkList"
                                                                                class="find-message"
                                                                                :class="generatedWorkList.length > 0 ? 'find-message-on' : 'find-message-off'"
                                                                            >
                                                                                <img src="@/assets/images/chat/chat-icon.png"
                                                                                    style="height:30px;"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </v-row>
                                                                </div>
                                                            </v-sheet>
                                                            <div v-if="shouldDisplayMessageTimestamp(message, index)" class="message-timestamp my-timestamp">
                                                                {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <v-card v-if="showGeneratedWorkList && shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index) && generatedWorkList.length > 0" class="mt-3">
                                                    <v-btn @click="deleteAllWorkList()"
                                                        size="small" icon density="comfortable"
                                                        style="position:absolute; right:5px; top:5px; z-index:1;"
                                                    >
                                                        <Icons :icon="'trash'" />
                                                    </v-btn>
                                                    <v-list>
                                                        <div>
                                                            <v-list-item v-for="(work, index) in generatedWorkList" :key="index" class="d-flex align-items-center">
                                                                <div v-if="work.messageForUser" class="flex-grow-1 d-flex align-items-center">
                                                                    <div class="w-100">
                                                                        <v-row class="ma-0 pa-3">
                                                                            <template v-if="!workIcons[work.work]">
                                                                                <img :src="defaultWorkIcon" alt="Default Icon"
                                                                                    style="width:20px; height:20px;"
                                                                                />
                                                                            </template>
                                                                            <template v-else>
                                                                                <div style="padding-top:2px;">
                                                                                    <Icons :icon="getWorkIcon(work.work)" />
                                                                                </div>
                                                                            </template>
                                                                            <div style="margin-left:5px; margin-top:0px;">{{ work.messageForUser }}</div>
                                                                            <div>
                                                                                <v-tooltip v-if="!isViewMode" :text="$t('chat.viewDetails')">
                                                                                    <template v-slot:activator="{ props }">
                                                                                        <v-btn v-bind="props"
                                                                                            @click="work.expanded = !work.expanded"
                                                                                            class="ml-2"
                                                                                            size="small" icon variant="text" density="comfortable"
                                                                                        >
                                                                                        <icons :icon="work.expanded ? 'arrow-up-2' : 'arrow-down-2'" />
                                                                                        </v-btn>
                                                                                    </template>
                                                                                </v-tooltip>
                                                                                <v-tooltip v-if="!isViewMode" :text="$t('chat.executeProcess')">
                                                                                    <template v-slot:activator="{ props }">
                                                                                        <v-btn v-bind="props"
                                                                                            @click="startProcess(work, index)"
                                                                                            class="ml-2"
                                                                                            size="small" icon variant="text" density="comfortable"
                                                                                        >
                                                                                            <Icons :icon="'play'" :color="'rgb(var(--v-theme-primary))'"/>
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
                                            <div v-else-if="!message.disableMsg || message.isLoading" >
                                                <v-row v-if="shouldDisplayUserInfo(message, index)"
                                                    class="ma-0 pa-0"
                                                >
                                                    <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                                        <v-avatar size="28" style="margin-right:8px;">
                                                            <img v-if="message.role == 'system'"
                                                                src="@/assets/images/chat/chat-icon.png" height="28"
                                                                width="28" />
                                                            <v-img
                                                                v-else
                                                                :src="getProfile(message)"
                                                                :alt="(message.name || message.userName || message.username || message.email || 'User')"
                                                                height="28"
                                                                width="28"
                                                            />
                                                        </v-avatar>
                                                        <div class="user-name">
                                                            {{ message.role == 'system' ? 'System' : (message.name || message.userName || message.username || message.email) }}
                                                        </div>
                                                    </v-row>
                                                </v-row>

                                                <div v-if="message.contentType && message.contentType == 'html'" style="margin-bottom: 15px;">
                                                    <DynamicForm 
                                                        ref="dynamicForm" 
                                                        :formHTML="message.htmlContent" 
                                                        v-model="message.jsonContent"
                                                        :readonly="true"
                                                    ></DynamicForm>
                                                </div>

                                                <div v-else-if="message.contentType && message.contentType == 'json' && type == 'instances'">
                                                    <ProcessWorkResult :message="message" />
                                                </div>

                                                <!-- markdown message -->
                                                <div v-else-if="markdownEnabled && ((message.contentType && message.contentType == 'markdown') || (message.role == 'system' && !message.contentType))" 
                                                    :class="agentMessage || message.role == 'system' ? 'agent-message' : 'other-message'"
                                                >
                                                    <div v-html="renderedMarkdown(message.content)" 
                                                        class="markdown-content"
                                                    ></div>

                                                    <div
                                                        v-if="shouldDisplayMessageTimestamp(message, index)"
                                                        class="markdown-timestamp"
                                                    >
                                                        {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                    </div>
                                                    
                                                    <!-- 프로세스 실행 폼 -->
                                                    <div v-if="message.work === 'StartProcessInstance' && message.firstActivityForm" class="mt-3 pl-3 pr-3">
                                                        <v-card variant="outlined" class="mb-3">
                                                            <v-card-title class="text-subtitle-1 py-2">
                                                                {{ message.firstActivityForm.activityName || '초기 정보 입력' }}
                                                            </v-card-title>
                                                            <v-divider></v-divider>
                                                            <v-card-text class="pa-3">
                                                                <!-- formHtml이 있는 경우 DynamicForm 사용 -->
                                                                <div v-if="message.firstActivityForm.formHtml" class="form-container">
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
                                                            <v-icon left class="mr-1">{{ message.executed ? 'mdi-check' : 'mdi-play' }}</v-icon>
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
                                                    <div class="progress-border" :class="{ 'animate': borderCompletedAnimated }" >
                                                        <template
                                                            v-if="message.role == 'system' && filteredMessages.length - 1 == index">
                                                            <div class="progress-border-span"
                                                                :class="{ 'opacity': !borderCompletedAnimated }" v-for="n in 5"
                                                                :key="n"></div>
                                                        </template>
                                                        <div
                                                            v-if="shouldRenderMessageBubble(message)"
                                                            class="message-bubble-wrap message-bubble-wrap--other"
                                                            @mouseenter="replyIndex = index"
                                                            @mouseleave="replyIndex = -1"
                                                        >
                                                        <div
                                                            v-if="chatRoomMode && (message.role === 'assistant' || message.role === 'agent') && message.isLoading"
                                                            class="chat-room-loading-indicator"
                                                        >
                                                            <template v-if="getRunningToolCall(message)">
                                                                <div class="chat-room-tool-calls">
                                                                    <div class="chat-room-tool-call-item">
                                                                        <v-icon size="14" color="primary" class="mr-1">mdi-wrench</v-icon>
                                                                        <span class="tool-name">{{ formatToolName(getRunningToolCall(message).name) }}</span>
                                                                        <v-progress-circular indeterminate size="14" width="2" color="primary" class="ml-2" />
                                                                    </div>
                                                                </div>
                                                            </template>
                                                            <template v-else>
                                                                <v-progress-circular indeterminate size="14" width="2" color="primary" />
                                                                <span class="ml-2">{{ getLoadingLabel(message) }}</span>
                                                            </template>
                                                        </div>

                                                        <v-sheet v-else class="other-message rounded-md pa-0"
                                                            :class="showTeamMemberSelector === index ? 'chat-message-bubble-select-team-member' : 'chat-message-bubble'"
                                                        >
                                                            <div class="pa-2">
                                                                <!-- 첨부(이미지/파일): content가 비어도 메시지로 렌더링 + 답장 가능 -->
                                                                <div v-if="message.image || (message.images && message.images.length > 0) || (message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl))" class="mb-2">
                                                                    <!-- 단일 이미지 표시 (기존 호환성) -->
                                                                    <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                                        <img
                                                                            :src="message.image"
                                                                            class="rounded-md"
                                                                            alt="pro"
                                                                            width="250"
                                                                            style="cursor: pointer;"
                                                                            @click="emitPreviewImage(message.image)"
                                                                        />
                                                                    </v-sheet>
                                                                    
                                                                    <!-- 다중 이미지 표시 -->
                                                                    <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                                        <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                                            <img
                                                                                :src="image.url || image"
                                                                                class="rounded-md"
                                                                                alt="pro"
                                                                                width="250"
                                                                                style="cursor: pointer;"
                                                                                @click="emitPreviewImage(image.url || image)"
                                                                            />
                                                                        </v-sheet>
                                                                    </div>
                                                                    
                                                                    <!-- 파일 첨부 -->
                                                                    <div v-if="message.pdfFile && (message.pdfFile.url || message.pdfFile.fileUrl)" class="mb-1">
                                                                        <v-sheet
                                                                            rounded="lg"
                                                                            class="pa-2 d-inline-flex align-center"
                                                                            style="gap: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08); background: rgba(var(--v-theme-primary), 0.06); max-width: min(520px, 80vw);"
                                                                            @click="emitOpenExternalUrl(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                        >
                                                                            <div style="width:28px; height:28px; border-radius:10px; display:flex; align-items:center; justify-content:center; background: rgba(var(--v-theme-primary), 0.12);">
                                                                                <v-icon size="18" color="primary">mdi-file-outline</v-icon>
                                                                            </div>
                                                                            <div style="min-width:0; flex:1 1 auto;">
                                                                                <div style="font-size:13px; font-weight:700; color: rgba(0,0,0,0.78); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                    {{ message.pdfFile.name || message.pdfFile.fileName || '첨부파일' }}
                                                                                </div>
                                                                                <div style="font-size:11px; color: rgba(0,0,0,0.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                                                    {{ formatAttachmentSub(message.pdfFile) }}
                                                                                </div>
                                                                            </div>
                                                                            <v-btn
                                                                                icon
                                                                                size="x-small"
                                                                                variant="tonal"
                                                                                :disabled="!(message.pdfFile.url || message.pdfFile.fileUrl)"
                                                                                @click.stop="downloadAttachment(message.pdfFile.url || message.pdfFile.fileUrl, message.pdfFile.name || message.pdfFile.fileName)"
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
                                                                            {{ (message.replyUserName || '').toString() }}{{ message.replyUserName ? '에게 답장' : '답장' }}
                                                                        </div>
                                                                        <div class="reply-quote__text">
                                                                            {{ message.replyContent || '' }}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <pre v-if="message.disableMsg" class="text-body-1">{{ "..." }}</pre>
                                                                <div v-else-if="message.htmlContent" v-html="message.htmlContent" class="text-body-1"></div>
                                                                <pre v-else class="text-body-1" v-html="setMessageForUser(message.content)"></pre>

                                                                <!-- PDF2BPMN 결과 카드 -->
                                                                <div
                                                                    v-if="message.pdf2bpmnResult && message.pdf2bpmnResult.generatedBpmns && message.pdf2bpmnResult.generatedBpmns.length > 0"
                                                                    class="pdf2bpmn-result-container mt-3"
                                                                >
                                                                    <div class="d-flex align-center mb-2">
                                                                        <v-icon size="16" color="success" class="mr-1">mdi-check-circle</v-icon>
                                                                        <span class="text-caption font-weight-bold">
                                                                            생성된 BPMN 프로세스 ({{ message.pdf2bpmnResult.generatedBpmns.length }}개)
                                                                        </span>
                                                                    </div>
                                                                    <div class="d-flex flex-column" style="gap: 8px;">
                                                                        <v-card
                                                                            v-for="(bpmn, bIdx) in message.pdf2bpmnResult.generatedBpmns"
                                                                            :key="bIdx"
                                                                            class="pa-2 pdf2bpmn-bpmn-card"
                                                                            variant="outlined"
                                                                            @click="emitPreviewBpmn(bpmn)"
                                                                        >
                                                                            <div class="d-flex align-center">
                                                                                <v-icon size="18" color="primary" class="mr-2">mdi-sitemap</v-icon>
                                                                                <div class="flex-grow-1">
                                                                                    <div class="text-body-2 font-weight-bold">
                                                                                        {{ bpmn.process_name || 'Unnamed Process' }}
                                                                                    </div>
                                                                                    <div class="text-caption text-medium-emphasis">
                                                                                        ID: {{ bpmn.process_id }}
                                                                                    </div>
                                                                                </div>
                                                                                <v-icon size="16" color="grey">mdi-eye</v-icon>
                                                                            </div>
                                                                        </v-card>
                                                                    </div>
                                                                </div>

                                                                <div v-if="message.type && message.type === 'add_team'" class="mt-2">
                                                                    <v-btn 
                                                                        style="border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                                                                        :style="replyIndex === index ? 'margin-bottom: 10px;' : ''"
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
                                                                                style="margin-right: 5px;"
                                                                            ></v-progress-circular>
                                                                        </template>
                                                                        <template v-else-if="message.added">
                                                                            <v-icon style="margin-right: 3px;">mdi-check</v-icon>
                                                                            추가됨
                                                                        </template>
                                                                        <template v-else>
                                                                            추가
                                                                        </template>
                                                                    </v-btn>
                                                                    
                                                                    <v-btn v-if="message.added"
                                                                        style="border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                                                                        color="white"
                                                                        variant="elevated" 
                                                                        size="small"
                                                                        @click="toggleTeamMemberSelector(index)"
                                                                    >
                                                                        <v-icon style="margin-right: 3px;">mdi-account-edit</v-icon>
                                                                        팀원 관리({{ (selectedTeamMembersByMessage[index] || []).length }})
                                                                    </v-btn>
                                                                </div>

                                                                <v-row v-if="!chatRoomMode" class="pa-0 ma-0 message-actions">
                                                                    <div v-if="isMobile || replyIndex === index" class="d-flex">
                                                                        <v-btn v-if="type != 'AssistantChats' && message.specific" 
                                                                            @click="viewWork(index)"
                                                                            variant="text" size="x-small" icon
                                                                            class="action-btn"
                                                                        >
                                                                            <Icons :icon="'document'" :size="20" />
                                                                        </v-btn>
                                                                        <v-btn @click="beforeReply(message)"
                                                                            variant="text" size="x-small" icon
                                                                            class="action-btn"
                                                                        >
                                                                            <Icons :icon="'reply'" :size="20" />
                                                                        </v-btn>
                                                                        <v-btn @click="viewJSON(index)"
                                                                            variant="text" size="x-small" icon
                                                                            class="action-btn"
                                                                        >
                                                                            <Icons v-if="message.jsonContent && isviewJSONStatus"
                                                                                :icon="'arrow-up-2'" :size="20"
                                                                            />
                                                                            <Icons v-else
                                                                                :icon="'arrow-down-2'" :size="20"
                                                                            />
                                                                        </v-btn>
                                                                    </div>
                                                                </v-row>
                                                                
                                                                <!-- 팀원 선택 UI -->
                                                                <v-card v-if="showTeamMemberSelector === index" class="mt-3" outlined>
                                                                    <v-card-title class="pb-2">
                                                                        <div class="d-flex align-center justify-space-between">
                                                                            <span>팀원 선택</span>
                                                                            <v-btn @click="closeTeamMemberSelector()" 
                                                                                variant="text" size="small" icon>
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
                                                                        
                                                                        <div class="team-member-list" style="max-height: 200px; overflow-y: auto;">
                                                                            <v-list density="compact">
                                                                                <v-list-item
                                                                                    v-for="user in filteredTeamMembers"
                                                                                    :key="user.id"
                                                                                    @click="toggleTeamMemberSelection(user, index)"
                                                                                    class="team-member-item"
                                                                                    :class="{ 'selected': (selectedTeamMembersByMessage[index] || []).includes(user.id) }"
                                                                                >
                                                                                    <template v-slot:prepend>
                                                                                        <v-avatar size="32">
                                                                                            <img :src="user.profile || '/images/defaultUser.png'" />
                                                                                        </v-avatar>
                                                                                    </template>
                                                                                    
                                                                                    <v-list-item-title>{{ user.username }}</v-list-item-title>
                                                                                    <v-list-item-subtitle>{{ user.email }}</v-list-item-subtitle>
                                                                                    
                                                                                    <template v-slot:append>
                                                                                        <v-checkbox
                                                                                            :model-value="(selectedTeamMembersByMessage[index] || []).includes(user.id)"
                                                                                            @update:model-value="toggleTeamMemberSelection(user, index)"
                                                                                            hide-details
                                                                                        ></v-checkbox>
                                                                                    </template>
                                                                                </v-list-item>
                                                                            </v-list>
                                                                        </div>
                                                                    </v-card-text>
                                                                    
                                                                    <v-card-actions>
                                                                        <v-spacer></v-spacer>
                                                                        <v-btn @click="closeTeamMemberSelector()" 
                                                                            variant="text" size="small">
                                                                            닫기
                                                                        </v-btn>
                                                                        <v-btn @click="addSelectedTeamMembers(message, index)" 
                                                                            color="primary" variant="elevated" size="small"
                                                                            :disabled="(selectedTeamMembersByMessage[index] || []).length === 0">
                                                                            확인 ({{ (selectedTeamMembersByMessage[index] || []).length }})
                                                                        </v-btn>
                                                                    </v-card-actions>
                                                                </v-card>

                                                                <v-row v-if="message.tableData" class="my-5">
                                                                    <v-col cols="12">
                                                                        <v-card outlined>
                                                                            <v-card-title>{{ setTableName(message.content)
                                                                                }}</v-card-title>
                                                                            <v-card-text>
                                                                                <div v-html="message.tableData"
                                                                                    class="table-responsive">
                                                                                </div>
                                                                            </v-card-text>
                                                                        </v-card>
                                                                    </v-col>
                                                                </v-row>

                                                                <v-row v-if="message.searchResults" class="my-5">
                                                                    <v-col v-for="(searchResult, index) in message.searchResults" :key="index" cols="4">
                                                                        <v-card outlined>
                                                                            <v-card-title class="d-flex justify-space-between">
                                                                                <span>{{ searchResult.score }}</span>
                                                                                <span>{{ searchResult.index }}</span>
                                                                            </v-card-title>
                                                                            <v-card-text>{{ searchResult.memory }}</v-card-text>
                                                                        </v-card>
                                                                    </v-col>
                                                                </v-row>
                                                                
                                                                <v-row v-if="message.memento && (message.memento.sources && message.memento.sources.length > 0)" class="my-5">
                                                                    <v-col cols="12">
                                                                        <v-card outlined>
                                                                            <v-card-title>Memento</v-card-title>
                                                                            <v-card-text>
                                                                                <v-textarea hide-details
                                                                                    v-model="message.memento.response" auto-grow
                                                                                    readonly variant="solo-filled"></v-textarea>
                                                                                <div class="chips-container" style="margin-top: 5px;">
                                                                                    <v-chip
                                                                                        v-for="(source, index) in message.memento.sources"
                                                                                        :key="index" variant="outlined" size="x-small"
                                                                                        text-color="primary"
                                                                                        style="margin-bottom: 1px;"
                                                                                        @click="downloadFile(source)"
                                                                                    >
                                                                                        <v-icon start icon="mdi-label" x-small></v-icon>
                                                                                        {{source.file_name }}
                                                                                    </v-chip>
                                                                                </div>
                                                                            </v-card-text>
                                                                        </v-card>
                                                                    </v-col>
                                                                </v-row>
                                                                <pre v-if="isViewJSON.includes(index)"
                                                                    class="text-body-1"
                                                                    >{{ message.jsonContent }}
                                                                </pre>
                                                                <v-card v-if="(type == 'AssistantChats' && isMobile && index === filteredMessages.length - 1) || isViewWork == index">
                                                                    <div v-if="message.specific">
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Title:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea readonly rows="1" v-model="message.title" auto-grow></v-textarea>
                                                                        </v-card-text>
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Specific:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea readonly rows="1" v-model="message.specific" auto-grow></v-textarea>
                                                                        </v-card-text>
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Measurable:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea readonly rows="1" v-model="message.measurable" auto-grow></v-textarea>
                                                                        </v-card-text>
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Attainable:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea readonly rows="1" v-model="message.attainable" auto-grow></v-textarea>
                                                                        </v-card-text>
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Relevant:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea readonly rows="1" v-model="message.relevant" auto-grow></v-textarea>
                                                                        </v-card-text>
                                                                        <v-card-title style="margin-bottom: -10px;"><h3>Time-bound:</h3></v-card-title>
                                                                        <v-card-text>
                                                                            <v-col style="max-width: 100%;" cols="12" sm="6" md="4">
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
                                                                            <div v-for="(desc, index) in message.descriptions" :key="index">
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
                                                                        <div v-if="type == 'AssistantChats' && isMobile" class="d-flex justify-center" style="margin-bottom: 10px;">
                                                                            <v-btn
                                                                                @click="clickedWorkOrder" color="primary">업무 지시하기</v-btn>
                                                                        </div>
                                                                    </div>
                                                                </v-card>
                                                            </div>
                                                            <!--   -->
                                                            <v-progress-linear v-if="filteredMessages.length - 1 == index && isLoading"
                                                                style="margin-top: -4px; border-radius: 0 0 10px 10px; width: 99%;"
                                                                indeterminate class="my-progress-linear">
                                                            </v-progress-linear>
                                                        </v-sheet>
                                                        <div
                                                            v-if="chatRoomMode || shouldDisplayMessageTimestamp(message, index)"
                                                            class="chat-room-timestamp-action other-timestamp"
                                                            :class="{ 'is-hover': replyIndex === index, 'is-mobile': isMobile }"
                                                        >
                                                            <span
                                                                class="chat-room-timestamp-text"
                                                                :style="shouldDisplayMessageTimestamp(message, index) ? '' : 'opacity:0;'"
                                                            >
                                                                {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                            </span>
                                                            <div v-if="chatRoomMode" class="chat-room-actions-overlay chat-room-actions-overlay--other">
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
                                                                    v-if="type != 'AssistantChats' && message && message.specific"
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
                                        v-if="type == 'instances' && agentInfo.isRunning && filteredMessages.length == 0"
                                        class="px-5 py-1" :agentInfo="agentInfo" :totalSize="filteredMessages.length"
                                        :currentIndex="-1" />

                                </div>
                                <slot name="custom-chat"></slot>
                            </v-col>
                        </div>
                    </perfect-scrollbar>
                    <div v-if="!workAssistantAgentMode" style="position:relative; z-index: 9999; margin-bottom: 10px;">
                        <v-row class="pa-0 ma-0">
                            <div v-if="isOpenedChatMenu" class="chat-menu-background">
                                <v-tooltip :text="$t('chat.addImage')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); uploadImage()" v-bind="props"
                                            style="width:30px; height:30px;" :disabled="disableChat">
                                            <Icons :icon="'add-media-image'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip text="Draft Agent">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-if="(type == 'instances' || type == 'chats') && (agentInfo && !agentInfo.isRunning)"
                                            :disabled="!(newMessage || agentInfo.draftPrompt)" icon variant="text"
                                            class="text-medium-emphasis" @click="openChatMenu(); requestDraftAgent()" v-bind="props"
                                            style="width:30px; height:30px; margin:1px 0px 0px 5px;">
                                            <Icons :icon="'document-sparkle'" :size="20"  />
                                        </v-btn>
                                        <v-btn v-if="(type == 'instances' || type == 'chats') && (agentInfo && agentInfo.isRunning)" icon variant="text"
                                            class="text-medium-emphasis" style="width:30px; height:30px;">
                                            <v-progress-circular :size="20" indeterminate color="primary"></v-progress-circular>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-form v-if="(type == 'instances' || type == 'chats' || type == 'consulting' || type == 'monitor') && (agentInfo && !agentInfo.isRunning)"
                                    ref="uploadForm" @submit.prevent="openChatMenu(); submitFile()"
                                    style="height:30px;"
                                    class="chat-selected-file"
                                >
                                    <v-row class="ma-0 pa-0"
                                        :style="file && file.length > 0 ? 'margin:-13px 0px 0px 7px !important;' : ''"
                                    >
                                        <v-tooltip :text="$t('chat.fileUpLoad')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn v-if="file && file.length > 0" type="submit" 
                                                    v-bind="props"
                                                    icon variant="text"
                                                    class="text-medium-emphasis"
                                                    style="width:30px;
                                                        height:30px;
                                                        margin:12.5px 0px 0px 0px;"
                                                >
                                                    <Icons :icon="'upload'" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-file-input class="chat-file-up-load"
                                            :class="{'chat-file-up-load-display': file && file.length > 0}"
                                            :style="file && file.length > 0 ? '' : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'"
                                            v-model="file"
                                            label="Choose a file"
                                            prepend-icon="mdi-paperclip"
                                            outlined
                                            :disabled="disableChat"
                                        ></v-file-input>
                                        <v-tooltip v-if="type == 'chats' && !isSystemChat" :text="ProcessGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); toggleProcessGPTActive()" v-bind="props"
                                                    style="width:30px; height:30px; margin-left:12px;" :disabled="disableChat">
                                                    <img :style="ProcessGPTActive ? 'opacity:1' : 'opacity:0.5'"
                                                        src="@/assets/images/chat/chat-icon.png"
                                                        style="height:24px;"
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

            <div v-if="!hideInput && !workAssistantAgentMode && !inputOnly" style="position: absolute; bottom: 15.1%; left: 24.3%; right: 0px; width: 75%;">
                <div class="message-info-box" v-if="isReply || (!isAtBottom && previewMessage)">
                    <div class="message-info-content">
                        <template v-if="isReply">
                            <div class="reply-banner reply-banner--primary">
                                <div class="reply-banner__main">
                                    <div class="reply-banner__top">
                                        <div class="reply-banner__to">
                                            {{ (replyUser?.name || replyUser?.userName || replyUser?.email || '') }}{{ (replyUser?.name || replyUser?.userName || replyUser?.email) ? '에게 답장' : '답장' }}
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
                                        {{ (replyUser?.name || replyUser?.userName || replyUser?.email || '') }}{{ (replyUser?.name || replyUser?.userName || replyUser?.email) ? '에게 답장' : '답장' }}
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
                <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage">
                <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
                <div style="z-index: 9999;" class="d-flex flex-wrap">
                    <!-- 이미지 미리보기 -->
                    <div v-for="(image, index) in attachedImages" :key="index" class="image-preview-item">
                        <img :src="image.url" width="56" height="56" style="border:1px solid #ccc; border-radius:10px; margin: 8px;" />
                        <v-btn
                            @click="deleteImage(index)"
                            density="compact"
                            icon
                            size="16"
                            style="background-color: black !important; margin: 4px 0px 0px -20px !important; position: absolute; top: 4px; right: 4px;"
                        >
                            <v-icon color="white" size="14">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </div>
                <form :style="type == 'consulting' ? 'position:relative; z-index: 9999;' : 'position:relative;'" class="d-flex flex-column align-center pa-0">
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
                        <v-textarea variant="solo" hide-details v-model="newMessage" color="primary"
                            class="shadow-none message-input-box delete-input-details cp-chat" density="compact" :placeholder="$t('chat.inputMessage')"
                            auto-grow rows="1" @keypress.enter="beforeSend" :disabled="disableChat"
                            @input="handleTextareaInput"
                            @keydown="handleTextareaKeydown"
                            @keyup="handleTextareaCaretMove"
                            @click="handleTextareaCaretMove"
                            @paste="handlePaste"
                        >
                        </v-textarea>
                        
                        <div v-if="showUserList" class="user-list mention-autocomplete-list" :style="mentionDropdownStyle">
                            <template v-if="!filteredUserList || filteredUserList.length === 0">
                                <div class="mention-autocomplete-empty">
                                    멘션할 수 있는 참여자가 없습니다.
                                </div>
                            </template>
                            <template v-else>
                                <div
                                    v-for="(user, idx) in filteredUserList"
                                    :key="user.id"
                                    @click="selectUser(user)"
                                    :class="['user-item mention-autocomplete-item', { 'mention-autocomplete-item--active': idx === mentionActiveIndex }]"
                                >
                                    <img :src="user.profile" alt="profile" class="mention-autocomplete-avatar">
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
                            <v-btn @click="openChatMenu()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important;"
                            >
                                <v-icon v-if="!isOpenedChatMenu">mdi-plus</v-icon>
                                <v-icon v-else>mdi-close</v-icon>
                            </v-btn>
                            <slot name="custom-input-tools"></slot>
                        </v-row >
                        
                        <div>
                            <v-btn v-if="!isMicRecording && !isMicRecorderLoading" @click="startVoiceRecording()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important;"
                            >
                                <Icons :icon="'sharp-mic'" :size="'16'" />
                            </v-btn>
                            <v-btn v-else-if="!isMicRecorderLoading" @click="stopVoiceRecording()"
                                class="mr-1 text-medium-emphasis"
                                density="comfortable"
                                icon
                                variant="outlined"
                                size="small"
                                style="border-color: #e0e0e0 !important;"
                            >
                                <Icons :icon="'stop'" :size="'16'" />
                            </v-btn>
                            <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" style="flex-shrink: 0;" />
                            <v-tooltip :text="$t('chat.headset')">
                                <template v-slot:activator="{ props }">
                                    <v-btn @click="openChatMenu(); recordingModeChange()"
                                        v-bind="props"
                                        class="mr-1 text-medium-emphasis"
                                        density="comfortable"
                                        icon
                                        variant="outlined"
                                        size="small"
                                        style="border-color: #e0e0e0 !important;"
                                    >
                                        <Icons :icon="'voice'" :size="16"  />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <v-btn v-if="!(showStopButton || isLoading)"
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
                            <v-btn v-else 
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
            :elevation="inputOnly ? 0 : 10"
            :class="['chat-input-card', inputOnly ? 'pa-0 chat-input-card--inline' : 'pa-4']"
            :style="inputOnly ? 'background: transparent; border-radius: 0; box-shadow: none;' : ''"
        >
            <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage">
            <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
            <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                ref="pdfUploader"
                class="d-none"
                @change="handlePdfSelect"
            >
            <div style="z-index: 9999;" class="d-flex flex-wrap">
                <div v-for="(image, index) in attachedImages" :key="index" class="image-preview-item">
                    <img :src="image.url" width="56" height="56" style="border:1px solid #ccc; border-radius:10px; margin: 8px;" />
                    <v-btn
                        @click="deleteImage(index)"
                        density="compact"
                        icon
                        size="16"
                        style="background-color: black !important; margin: 4px 0px 0px -20px !important; position: absolute; top: 4px; right: 4px;"
                    >
                        <v-icon color="white" size="14">mdi-close</v-icon>
                    </v-btn>
                </div>
                <!-- PDF 미리보기(선택된 파일) -->
                <div v-if="selectedPdfFile" class="pdf-preview-item" style="position: relative; margin: 8px;">
                    <v-chip
                        closable
                        color="primary"
                        variant="tonal"
                        @click:close="clearSelectedPdf"
                    >
                        <v-icon start size="16">mdi-file-outline</v-icon>
                        {{ selectedPdfFile.name }}
                    </v-chip>
                </div>
            </div>
            <form :style="type == 'consulting' ? 'position:relative; z-index: 9999;' : 'position:relative;'" class="d-flex flex-column align-center pa-0">
                <!-- 답장 UI (workAssistantAgentMode/inputOnly에서도 표시) -->
                <div class="message-info-box message-info-box--reply" v-if="isReply" style="width: 100%; margin-bottom: 8px;">
                    <div class="message-info-content message-info-content--reply">
                        <div class="reply-banner reply-banner--primary">
                            <div class="reply-banner__main">
                                <div class="reply-banner__top">
                                    <div class="reply-banner__to">
                                        {{ (replyUser?.name || replyUser?.userName || replyUser?.email || '') }}{{ (replyUser?.name || replyUser?.userName || replyUser?.email) ? '에게 답장' : '답장' }}
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
                    <v-textarea variant="solo" hide-details v-model="newMessage" color="primary"
                        class="shadow-none message-input-box delete-input-details cp-chat" density="compact" :placeholder="resolvedPlaceholder"
                        auto-grow rows="1" @keypress.enter="beforeSend" :disabled="disableChat || isGenerationFinished"
                        @input="handleTextareaInput"
                        @keydown="handleTextareaKeydown"
                        @keyup="handleTextareaCaretMove"
                        @click="handleTextareaCaretMove"
                        @paste="handlePaste"
                    >
                    </v-textarea>
                    
                    <div v-if="showUserList" class="user-list mention-autocomplete-list" :style="mentionDropdownStyle">
                        <template v-if="!filteredUserList || filteredUserList.length === 0">
                            <div class="mention-autocomplete-empty">
                                멘션할 수 있는 참여자가 없습니다.
                            </div>
                        </template>
                        <template v-else>
                            <div
                                v-for="(user, idx) in filteredUserList"
                                :key="user.id"
                                @click="selectUser(user)"
                                :class="['user-item mention-autocomplete-item', { 'mention-autocomplete-item--active': idx === mentionActiveIndex }]"
                            >
                                <img :src="user.profile" alt="profile" class="mention-autocomplete-avatar">
                                <div class="mention-autocomplete-meta">
                                    <div class="mention-autocomplete-name">{{ user.username }}</div>
                                    <div class="mention-autocomplete-sub">{{ user.email }}</div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
                <div class="d-flex justify-space-between align-center w-100 pl-1">
                    <div :style="type == 'consulting' ? 'position:relative; z-index: 9999;':'position:relative;'">
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
                                <v-tooltip :text="$t('chat.addImage')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); uploadImage()" v-bind="props"
                                            style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat || isGenerationFinished">
                                            <Icons :icon="'add-media-image'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <!-- PDF 업로드 버튼: 메인/패널 공통으로 Chat 내부에서 처리 -->
                                <v-tooltip text="파일 업로드">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            v-bind="props"
                                            style="width:30px; height:30px; margin-left:5px;"
                                            :disabled="disableChat || isGenerationFinished"
                                            @click="openChatMenu(); triggerPdfSelect()"
                                        >
                                            <v-icon size="20">mdi-file-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip text="Draft Agent">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-if="(type == 'instances' || type == 'chats') && (agentInfo && !agentInfo.isRunning)"
                                            :disabled="!(newMessage || agentInfo.draftPrompt)" icon variant="text"
                                            class="text-medium-emphasis" @click="openChatMenu(); requestDraftAgent()" v-bind="props"
                                            style="width:30px; height:30px; margin:1px 0px 0px 5px;">
                                            <Icons :icon="'document-sparkle'" :size="20"  />
                                        </v-btn>
                                        <v-btn v-if="(type == 'instances' || type == 'chats') && (agentInfo && agentInfo.isRunning)" icon variant="text"
                                            class="text-medium-emphasis" style="width:30px; height:30px;">
                                            <v-progress-circular :size="20" indeterminate color="primary"></v-progress-circular>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-form v-if="(type == 'instances' || type == 'chats' || type == 'consulting') && (agentInfo && !agentInfo.isRunning)"
                                    ref="uploadForm" @submit.prevent="openChatMenu(); submitFile()"
                                    style="height:30px;"
                                    class="chat-selected-file"
                                >
                                    <v-row class="ma-0 pa-0"
                                        :style="file && file.length > 0 ? 'margin:-13px 0px 0px 7px !important;' : ''"
                                    >
                                        <v-tooltip :text="$t('chat.fileUpLoad')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn v-if="file && file.length > 0" type="submit" 
                                                    v-bind="props"
                                                    icon variant="text"
                                                    class="text-medium-emphasis"
                                                    style="width:30px;
                                                        height:30px;
                                                        margin:12.5px 0px 0px 0px;"
                                                >
                                                    <Icons :icon="'upload'" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-file-input class="chat-file-up-load"
                                            :class="{'chat-file-up-load-display': file && file.length > 0}"
                                            :style="file && file.length > 0 ? '' : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'"
                                            v-model="file"
                                            label="Choose a file"
                                            prepend-icon="mdi-paperclip"
                                            outlined
                                            :disabled="disableChat"
                                        ></v-file-input>
                                        <v-tooltip v-if="type == 'chats' && !isSystemChat" :text="ProcessGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); toggleProcessGPTActive()" v-bind="props"
                                                    style="width:30px; height:30px; margin-left:12px;" :disabled="disableChat">
                                                    <img :style="ProcessGPTActive ? 'opacity:1' : 'opacity:0.5'"
                                                        src="@/assets/images/chat/chat-icon.png"
                                                        style="height:24px;"
                                                    />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </v-row>
                                </v-form>
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
                            style="border-color: #e0e0e0 !important;"
                            :disabled="isGenerationFinished || isMicRecorderLoading"
                            @click="isMicRecording ? stopVoiceRecording() : startVoiceRecording()"
                        >
                            <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" :size="'16'" />
                            <Icons v-else-if="isMicRecording" :icon="'stop'" :size="'16'" />
                            <Icons v-else :icon="'sharp-mic'" :size="'16'" />
                        </v-btn>
                        
                        <v-tooltip :text="$t('chat.headset')">
                            <template v-slot:activator="{ props }">
                                <v-btn @click="openChatMenu(); recordingModeChange()"
                                    class="mr-1 text-medium-emphasis"
                                    density="comfortable"
                                    icon
                                    variant="outlined"
                                    size="small"
                                    v-bind="props"
                                    style="border-color: #e0e0e0 !important;"
                                    :disabled="isGenerationFinished"
                                >
                                    <Icons :icon="'voice'" :size="'16'"  />
                                </v-btn>
                            </template>
                        </v-tooltip>
                        
                        <v-btn v-if="!(showStopButton || isLoading) && !isGenerationFinished"
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
                        <v-btn v-else-if="isGenerationFinished"
                            class="cp-send text-medium-emphasis"
                            color="primary" 
                            variant="outlined" 
                            density="comfortable"
                            icon
                            size="small"
                            style="border-color: rgb(var(--v-theme-primary), 0.3) !important"
                            disabled
                        >
                            <v-progress-circular 
                                indeterminate 
                                color="primary" 
                                size="16"
                            ></v-progress-circular>
                        </v-btn>
                        <v-btn v-else 
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
    <Record @close="recordingModeChange()" @start="startRecording()" @stop="stopRecording()"
        :audioResponse="newMessage" :chatRoomId="chatRoomId" :recordingMode="recordingMode" />
</template>

<script>
import { Icon } from '@iconify/vue';
import RetrievalBox from '../retrieval/RetrievalBox.vue'
import partialParse from "partial-json-parser";
import ProgressAnimated from '@/components/ui/ProgressAnimated.vue';
import ScrollBottomHandle from '@/components/ui/ScrollBottomHandle.vue';
import AgentsChat from './AgentsChat.vue';
import axios from 'axios';
import { HistoryIcon } from 'vue-tabler-icons';
import Record from './Record.vue';
import SummaryButton from '@/components/ui/SummaryButton.vue';
import defaultWorkIcon from '@/assets/images/chat/chat-icon.png';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import ChatRoomNameGenerator from "@/components/ai/ChatRoomNameGenerator.js";
import ProcessWorkResult from './ProcessWorkResult.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import { marked } from 'marked';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        Icon,
        RetrievalBox,
        AgentsChat,
        Record,
        DynamicForm,
        SummaryButton,
        ProcessWorkResult,
        DetailComponent
    },
    mixins: [
        ProgressAnimated,
        ScrollBottomHandle
    ],
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
        // ChatRoomPage/WorkAssistantChatPanel: PDF2BPMN 진행 상태 표시
        pdf2bpmnProgress: {
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
        'preview-image',
        'open-external-url'
    ],
    data() {
        return {
            workIcons: {
                "ScheduleQuery" : "calendar-line-duotone", // 달력 아이콘
                "ScheduleRegistration" : "calendar-line-duotone", // 달력 아이콘
                "TodoListRegistration" : "overview", // TODO 리스트 아이콘
                "StartProcessInstance" : "ibm-process-mining",
                // "CreateProcessDefinition" : "device-imac-cog"
            },
            recordingMode: false,
            defaultWorkIcon: defaultWorkIcon,
            displayGeneratedWorkList: false,  // 애니메이션 후에 표시하기 위한 상태
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
            uploadedPdfInfo: null,
            isPdfUploading: false,
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
                { title: "chat.helpIntro" },
                { title: "chat.helpScheduleRegistration" },
                { title: "chat.helpScheduleQuery" },
                { title: "chat.helpProcessStart" },
                { title: "chat.helpDocumentQuery" },
                { title: "chat.helpDocumentGeneration" },
                { title: "chat.helpTodoRegistration" },
                { title: "chat.helpNote" }
            ]
        };
    },
    created() {
        // 창 크기 변경 시 높이 조정을 위한 이벤트 리스너 추가
        window.addEventListener('resize', this.handleResize);
    },
    mounted() {
        var me = this
        document.addEventListener('click', (event) => {
            if (event.target.matches('.request-file-link')) {
                event.preventDefault();
                me.$emit("requestFile", event.target.getAttribute('data-filename'));
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
        // 컴포넌트 제거 시 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        try {
            if (this._highlightTimer) clearTimeout(this._highlightTimer);
        } catch (e) {}
        this._highlightTimer = null;
    },
    watch: {
        prompt(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.newMessage = newVal
                this.beforeSend()
            }
        },
        newMessageInfo(newVal) {
            if (newVal && !this.isAtBottom) {
                this.previewMessage = newVal
            }
        },
        isAtBottom(newVal) {
            if (newVal) {
                this.previewMessage = null;
            }
        },
    },
    computed: {
        isSystemMentioned() {
            return this.mentionedUsers.some(user => user.id === 'system_id') || this.newMessage.startsWith('>') || this.newMessage.startsWith('!')
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

            let userList = (Array.isArray(this.userList) ? this.userList : []).filter(user => {
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
            const hasSystem = participants.some(p => p?.id === 'system_id' || p?.email === 'system@uengine.org');
            if (hasSystem) {
                userList = [
                    ...userList,
                    {
                        email: "system@uengine.org",
                        id: "system_id",
                        profile: "/images/chat-icon.png",
                        username: "System",
                    }
                ];
            }

            const query = (this.mentionQuery || '').toString().toLowerCase().replace(/\s+/g, '');
            // 이미 mention된 유저는 리스트에서 제외
            return userList.filter(user => {
                const username = (user?.username || '').toString();
                const normalized = username.toLowerCase().replace(/\s+/g, '');
                const okQuery = query ? normalized.includes(query) : true;
                const notMentioned = !this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id);
                return okQuery && notMentioned;
            });
        },
        filteredMessages() {
            var list = [];
            const myEmail = localStorage.getItem('email');
            if (this.messages && this.messages.length > 0) {
                this.messages.forEach((item) => {
                    let data = JSON.parse(JSON.stringify(item));
                    
                    // 프로세스 실행 메시지에 formValues 초기화
                    if (data.work === 'StartProcessInstance' && data.firstActivityForm && !data.formValues) {
                        data.formValues = {};
                    }
                    
                    const hasText = !!data.content || !!data.jsonContent || !!data.htmlContent;
                    const hasImage = !!data.image;
                    const hasImages = Array.isArray(data.images) && data.images.length > 0;
                    const f = data.pdfFile;
                    const hasFile = !!f && !!(f.url || f.fileUrl || f.publicUrl || f.signedUrl || f.name || f.fileName);

                    if (hasText || hasImage || hasImages || hasFile) {
                        list.push(data);
                    }
                });
            }
            if(list.length > 0 && list[list.length - 1].email == myEmail) {
                this.setRenderTime();
            }
            return list;
        },
        // isLoading 상태의 변화를 감시합니다.
        isLoading: {
            get() {
                var res = false;
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach(item => {
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
                    this.$emit("stopMessage");
                }
            }
        },
        disableBtn() {
            if (this.workAssistantAgentMode) {
                // workAssistantAgentMode에서는 "텍스트/이미지/PDF" 중 하나라도 있으면 전송 활성화
                const hasText = !!this.newMessage && this.newMessage.trim() !== '';
                const hasImages = !!this.attachedImages && this.attachedImages.length > 0;
                const hasPdf = !!this.selectedPdfFile;
                return !(hasText || hasImages || hasPdf);
            }
            if (this.disableChat) {
                return true
            } else {
                if (this.newMessage !== '' || this.attachedImages.length > 0) {
                    return false
                } else {
                    return true
                }
            }
        },
        // 내가 보낸 메시지들만 필터링
        myMessages() {
            if (!this.messages || this.messages.length === 0) return [];
            return this.messages
                .filter(message => message.email === this.userInfo.email && message.content && message.content.trim() !== '')
                .reverse(); // 최신 메시지가 먼저 오도록
        },
        // 팀원 검색 필터링
        filteredTeamMembers() {
            if (!this.allUserList) return [];
            
            let users = this.allUserList;
            
            // 검색 텍스트로 필터링
            if (this.teamMemberSearch) {
                const searchLower = this.teamMemberSearch.toLowerCase();
                users = users.filter(user => 
                    user.username.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower)
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
        getLoadingLabel(message) {
            return (message?.content || '생각 중...');
        },
        getRunningToolCall(message) {
            try {
                const tools = Array.isArray(message?.toolCalls) ? message.toolCalls : [];
                return tools.find(t => t?.status === 'running') || null;
            } catch (e) {
                return null;
            }
        },
        emitPreviewImage(url) {
            if (!url) return;
            this.$emit('preview-image', url);
        },
        emitPreviewBpmn(bpmn) {
            if (!bpmn) return;
            this.$emit('preview-bpmn', bpmn);
        },
        emitOpenExternalUrl(url) {
            if (!url) return;
            this.$emit('open-external-url', url);
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
        shouldRenderMessageBubble(message) {
            try {
                const text = (message?.content ?? '').toString().trim();
                const hasText = !!text || !!message?.htmlContent || !!message?.jsonContent;
                const hasImage = !!message?.image;
                const hasImages = Array.isArray(message?.images) && message.images.length > 0;
                const f = message?.pdfFile;
                const hasFile = !!f && !!(f.url || f.fileUrl || f.publicUrl || f.signedUrl || f.name || f.fileName);
                return hasText || hasImage || hasImages || hasFile;
            } catch (e) {
                return !!message?.content;
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
        clickedWorkOrder(){
            this.$emit('clickedWorkOrder');
        },
        startWorkOrder(){
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
            this.isOpenedChatMenu = false
        },
        openChatMenu(){
            this.isOpenedChatMenu = !this.isOpenedChatMenu
        },
        recordingModeChange() {
            this.recordingMode = !this.recordingMode
            // this.$globalState.methods.toggleRightZoom();
        },
        // 애니메이션 표시를 위해 system의 답변이 있더라도 표시 가능하게 하려고 만든 methods
        shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index) {
            var resultIndex = 0;
            var oldIndex = 0;

            const myEmail = localStorage.getItem('email');
            for (let i = 0; i < filteredMessages.length; i++) {
                if(!filteredMessages[i].email) continue;
                if (filteredMessages[i].email == myEmail) {
                    oldIndex = resultIndex;
                    resultIndex = i;
                }
            }
            if(!this.isRender) {
                resultIndex = oldIndex;
            }
            return type == 'chats' && resultIndex == index && this.ProcessGPTActive && !this.isSystemChat;
        },
        setRenderTime() {
                this.isRender = false
            setTimeout(() => {
                this.isRender = true
            },3000)
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
            this.mediaRecorder.ondataavailable = e => {
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
                    action: async () => { throw new Error(); },
                    errorMsg: this.$t('chat.micPermission.notSupported')
                });
                return;
            }
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                if (permissionStatus.state === 'denied') {
                    this.$try({
                        action: async () => { throw new Error(); },
                        errorMsg: this.$t('chat.micPermission.denied')
                    });
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.isMicRecording = true;
                this.micRecorder = new MediaRecorder(stream);
                this.micAudioChunks = [];
                this.micRecorder.ondataavailable = e => {
                    this.micAudioChunks.push(e.data);
                };
                this.micRecorder.start();
            } catch (error) {
                this.isMicRecording = false;
                this.$try({
                    action: async () => { throw new Error(); },
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
            var me = this
            if (!me.file) return;
            const fileName = me.file[0].name;
            backend.uploadFile(fileName, me.file[0]).then((response) => {
                me.$try({
                    action: async () => {
                        me.$emit('uploadedFile', response);
                        this.file = null
                    },
                    successMsg: '파일 업로드가 완료되었습니다.'
                })
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
                    storageType: 'drive',
                }
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
            this.$emit('openVerMangerDialog', true)
        },
        handleTextareaInput(event) {
            // Vuetify/Vue 이벤트 형태가 케이스별로 다름:
            // - native input event: event.target.value
            // - update:modelValue 형태로 값(string)이 직접 넘어오는 경우도 있음
            const text = (typeof event === 'string')
                ? event
                : (event?.target?.value ?? this.newMessage ?? '');
            const textarea = this.getActiveTextareaEl(event);
            const caretPos = (textarea && Number.isFinite(textarea.selectionStart)) ? textarea.selectionStart : text.length;
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
            const lh = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.2) || 16;

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
            let left = (taRect.left - wrapRect.left) + caret.left - textarea.scrollLeft;
            let top = (taRect.top - wrapRect.top - 20) + caret.top - textarea.scrollTop + caret.height;

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
            this.mentionedUsers = (Array.isArray(this.mentionedUsers) ? this.mentionedUsers : []).filter(u => u?.id !== id);
            const mentionText = (user?.mentionText || user?.username || '').toString();
            if (mentionText) {
                // "@token" 제거 (토큰 뒤 공백도 같이 정리)
                // NOTE: RegExp with 'u' flag disallows IdentityEscape like \`
                const re = new RegExp(`(^|\\s)@${this.escapeRegExp(mentionText)}(?=$|[\\s\\n\\r\\t.,;:!?()\\[\\]{}"'` + '`' + `~<>/\\\\|])\\s*`, 'gu');
                this.newMessage = (this.newMessage || '').replace(re, '$1').replace(/\s{2,}/g, ' ').trimStart();
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
            const caretPos = (textarea && Number.isFinite(textarea.selectionStart)) ? textarea.selectionStart : (this.newMessage || '').length;

            const start = Math.max(0, Math.min(this.mentionStartIndex, (this.newMessage || '').length));
            const before = (this.newMessage || '').substring(0, start);
            const after = (this.newMessage || '').substring(caretPos);

            // UX: 텍스트 안에 "@이름"을 중복 표시하지 않고, chip으로만 표시한다.
            // (라우팅은 payload.mentionedUsers 기반)
            const mentionText = (user.username || user.email || user.id || '').toString().replace(/[@\r\n]/g, '').trim();
            this.newMessage = `${before}${after}`.replace(/\s{2,}/g, ' ');

            this.showUserList = false;
            this.mentionStartIndex = null;
            this.mentionQuery = '';
            this.mentionDropdownStyle = {};
            this.mentionActiveIndex = 0;

            // Mention된 유저의 정보를 mentionedUsers 배열에 추가
            if (!this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id)) {
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
            this.isAtBottom = true
            this.scrollToBottom();
            this.showNewMessageNoti = false
            this.lastMessage = {
                name: '',
                content: ''
            }
        },
        showNewMessage() {
            if (this.messages.length > 0) {
                if (this.userInfo.email != this.messages[this.messages.length - 1].email) {
                    this.lastMessage = {
                        name: this.messages[this.messages.length - 1].name,
                        content: this.messages[this.messages.length - 1].content && this.messages[this.messages.length - 1].content.length > 130 ? this.messages[this.messages.length - 1].content.substring(0, 130) + '...' : this.messages[this.messages.length - 1].content
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
            const user = message.email
                ? list.find(user => user.email === message.email)
                : null;
            const profile = user && user.profile ? user.profile : null;
            return profile ? (profile.includes('defaultUser.png') ? '/images/defaultUser.png' : profile) : '/images/defaultUser.png';
        },
        requestDraftAgent() {
            this.$emit('requestDraftAgent', this.newMessage);
        },
        setMessageForUser(content) {
            if(content && typeof content == 'string'){
                if (content.includes(`"messageForUser":`)) {
                    let contentObj = partialParse(content);
                    let messageForUserContent = contentObj.messageForUser || content;
                    return this.linkify(messageForUserContent); // URL을 하이퍼링크로 변환
                } else {
                    return this.linkify(content); // URL을 하이퍼링크로 변환
                }
            }
        },
        setTableName(content) {
            let contentObj = partialParse(content)
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
            this.$emit('startProcess', messageObj)
            if(this.ProcessGPTActive){
                this.$emit('deleteWorkList', index)
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
            this.$emit('cancelProcess', messageObj)
        },
        deleteAllWorkList() {
            this.$emit('deleteAllWorkList')
        },
        deleteWorkList(index) {
            this.$emit('deleteWorkList', index)
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
                const f = message?.pdfFile;
                if (f && (f.name || f.fileName)) return `[첨부파일] ${(f.name || f.fileName).toString()}`;
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
                const delta = (eRect.top - cRect.top) - (container.clientHeight / 2 - eRect.height / 2);
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
            
            if(this.isAgentMode){
                this.isSending = true;
                this.requestDraftAgent();
                setTimeout(() => {
                    this.newMessage = "";
                    this.isSending = false;
                }, 100);
            } else {
                if (this.isLoading) {
                    this.isLoading = false;
                    this.$emit('stopMessage');
                }
                var copyMsg = this.newMessage.replace(/(?:\r\n|\r|\n)/g, '');
                const hasPdf = !!this.selectedPdfFile;
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
                // PDF가 선택된 경우: 전송 직전 업로드하여 fileInfo 생성
                if (this.selectedPdfFile && !this.uploadedPdfInfo) {
                    await this.ensurePdfUploaded();
                }
                // 부모 컴포넌트로 메시지 전달 (기존 방식 유지: images에 url(base64 가능) 포함)
                this.$emit('sendMessage', {
                    images: this.attachedImages,
                    text: this.newMessage,
                    mentionedUsers: this.mentionedUsers,
                    // PDF는 전송 직전 업로드된 fileInfo 형태로 전달
                    file: this.uploadedPdfInfo,
                    // reply 메타데이터 (ChatRoomPage에서 저장/표시)
                    reply: this.isReply ? {
                        uuid: this.replyUser?.uuid || null,
                        name: this.replyUser?.name || this.replyUser?.userName || this.replyUser?.email || '',
                        content: this.replyPreviewText(this.replyUser)
                    } : null
                });
            }
            if (this.isReply) this.isReply = false;
            this.attachedImages = [];
            this.selectedPdfFile = null;
            this.uploadedPdfInfo = null;
            this.delImgBtn = false;
            this.isAtBottom = true
            setTimeout(() => {
                // workAssistantAgentMode 여부와 관계없이 항상 메시지 초기화
                this.newMessage = "";
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
            const file = e.target.files?.[0];
            if (!file) return;

            // Allow PDF + common Office + image formats (stored to Supabase, converted/OCR’d server-side).
            const name = (file.name || '').toLowerCase();
            const allowedExt = [
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.txt', '.csv',
                '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'
            ];
            const ok = allowedExt.some(ext => name.endsWith(ext));
            if (!ok) {
                alert('지원되는 파일 형식이 아닙니다. (PDF/Office/Image/Text)');
                if (this.$refs.pdfUploader) this.$refs.pdfUploader.value = '';
                return;
            }
            this.selectedPdfFile = file;
            this.uploadedPdfInfo = null; // 새 파일 선택 시 업로드 정보 초기화
        },
        clearSelectedPdf() {
            this.selectedPdfFile = null;
            this.uploadedPdfInfo = null;
            if (this.$refs.pdfUploader) this.$refs.pdfUploader.value = '';
        },
        async ensurePdfUploaded() {
            if (!this.selectedPdfFile) return null;
            if (this.uploadedPdfInfo) return this.uploadedPdfInfo;
            if (this.isPdfUploading) return null;

            this.isPdfUploading = true;
            try {
                const uploadResult = await backend.uploadFile(this.selectedPdfFile.name, this.selectedPdfFile);
                if (uploadResult && uploadResult.publicUrl) {
                    this.uploadedPdfInfo = {
                        fileName: this.selectedPdfFile.name,
                        fileUrl: uploadResult.publicUrl,
                        fileType: this.selectedPdfFile.type,
                        fileSize: this.selectedPdfFile.size
                    };
                    return this.uploadedPdfInfo;
                }
                return null;
            } catch (error) {
                console.error('[Chat] PDF 업로드 오류:', error);
                return null;
            } finally {
                this.isPdfUploading = false;
            }
        },
        cancel() {
            this.messages[this.editIndex].content = this.editText
            this.editIndex = -1;
        },
        editMessage(index) {
            if (index && index >= 0) {
                this.editIndex = index;
            } else {
                this.editIndex = -1;
            }
            this.editIndex = index;
            this.editText = this.messages[this.editIndex].content
        },
        viewWork(idx){
            if(this.isViewWork){
                this.isViewWork = null
            } else {
                this.isViewWork = idx
            }
            this.$nextTick(() => {
                this.$refs.scrollContainer.update(); 
            });
        },
        viewJSON(index) {
            this.isviewJSONStatus = !this.isviewJSONStatus
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
            this.$refs.uploader.value = '';
            this.$refs.uploader.click();
        },
        async changeImage(e) {
            const me = this;
            const imageFile = e?.target?.files?.[0];
            if (!imageFile) return;
            
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
                                return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
                            }
                        }
                    } catch (err) {}
                    // 최후 fallback (형식만 UUID v4 형태)
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                        const r = (Math.random() * 16) | 0;
                        const v = c === 'x' ? r : (r & 0x3) | 0x8;
                        return v.toString(16);
                    });
                })();

                const fileName = hasUnsafeChars
                    ? `uploads/${uuid}${ext}`
                    : `uploads/${originalName}`;
                const data = await backend.uploadImage(fileName, imageFile);
                if (data && data.path) {
                    const imageUrl = await backend.getImageUrl(data.path);
                    me.attachedImages.push({
                        id: Date.now(),
                        url: imageUrl,
                        file: imageFile
                    });
                }
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgElement = document.createElement("img");
                    imgElement.src = event.target.result;
                    imgElement.onload = () => {
                        const canvas = document.createElement("canvas");
                        // AI Vision 분석을 위해 고해상도 유지 (최대 2048px)
                        const max_width = 2048;
                        const scaleSize = imgElement.width > max_width ? max_width / imgElement.width : 1;
                        canvas.width = imgElement.width * scaleSize;
                        canvas.height = imgElement.height * scaleSize;

                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                        // AI가 이미지를 제대로 인식할 수 있도록 높은 품질 유지 (0.9 = 90% 품질)
                        const srcEncoded = ctx.canvas.toDataURL("image/jpeg", 0.9);

                        // 이미지 배열에 추가
                        me.attachedImages.push({
                            id: Date.now(),
                            url: srcEncoded,
                            file: imageFile
                        });
                    };
                };
                if (imageFile) {
                    reader.readAsDataURL(imageFile);
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
            if (index === 0) return true; // 첫 번째 메시지는 항상 유저 정보 표시
            
            const prevMessage = this.filteredMessages[index - 1];
            
            // 이전 메시지와 보낸 사람이 다르면 유저 정보 표시
            if (message.email !== prevMessage.email) return true;
            
            // 같은 사람이 보낸 메시지라도 분 단위 시간이 다르면 유저 정보 표시
            const currentTime = new Date(message.timeStamp);
            const prevTime = new Date(prevMessage.timeStamp);
            
            // 분 단위로 비교 (년, 월, 일, 시, 분이 같은지 확인)
            if (currentTime.getFullYear() !== prevTime.getFullYear() ||
                currentTime.getMonth() !== prevTime.getMonth() ||
                currentTime.getDate() !== prevTime.getDate() ||
                currentTime.getHours() !== prevTime.getHours() ||
                currentTime.getMinutes() !== prevTime.getMinutes()) {
                return true;
            }

            return false;
        },
        shouldDisplayMessageTimestamp(message, index) {
            
            const prevMessage = this.filteredMessages[index - 1];
            
            // 다음 메시지가 있는지 확인
            const nextMessage = index < this.filteredMessages.length - 1 ? this.filteredMessages[index + 1] : null;
            
            // 다음 메시지가 없거나, 다음 메시지의 이메일이 현재 메시지와 다르면 true 반환
            if (!nextMessage || message.email !== nextMessage.email) return true;
            
            // 다음 메시지와 현재 메시지의 시간이 분 단위까지 같은지 확인
            const currentTime = new Date(message.timeStamp);
            const nextTime = new Date(nextMessage.timeStamp);
            
            // 분 단위로 비교 (년, 월, 일, 시, 분이 같은지 확인)
            if (currentTime.getFullYear() !== nextTime.getFullYear() ||
                currentTime.getMonth() !== nextTime.getMonth() ||
                currentTime.getDate() !== nextTime.getDate() ||
                currentTime.getHours() !== nextTime.getHours() ||
                currentTime.getMinutes() !== nextTime.getMinutes()) {
                return true;
            }
            
            return false;
        },
        // 클립보드에서 이미지 붙여넣기 처리 함수
        handlePaste(event) {
            // 클립보드 데이터 확인
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
                        const imgElement = document.createElement("img");
                        imgElement.src = e.target.result;
                        imgElement.onload = () => {
                            const canvas = document.createElement("canvas");
                            // AI Vision 분석을 위해 고해상도 유지 (최대 2048px)
                            const max_width = 2048;
                            const scaleSize = imgElement.width > max_width ? max_width / imgElement.width : 1;
                            canvas.width = imgElement.width * scaleSize;
                            canvas.height = imgElement.height * scaleSize;

                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                            // AI가 이미지를 제대로 인식할 수 있도록 높은 품질 유지 (0.9 = 90% 품질)
                            const srcEncoded = ctx.canvas.toDataURL("image/jpeg", 0.9);

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
            if(!message.timeStamp) return false;
            
            if (index === 0) {
                const currentDate = new Date(message.timeStamp);
                const today = new Date();
                
                // 첫 메시지가 오늘 날짜인 경우
                if (currentDate.toDateString() === today.toDateString()) {
                    // 오늘이 아닌 이전 메시지가 있는지 확인
                    const hasOlderMessages = this.filteredMessages.some((msg, idx) => {
                        if (!msg.timeStamp || idx === 0) return false;
                        const msgDate = new Date(msg.timeStamp);
                        return msgDate.toDateString() !== today.toDateString();
                    });
                    // 오늘이 아닌 메시지가 있을 때만 "오늘" 구분선 표시
                    return hasOlderMessages;
                }
                return true;
            }
            
            if (index > 0) {
                const prevMessage = this.filteredMessages[index - 1];
                const currentDate = new Date(message.timeStamp);
                const prevDate = new Date(prevMessage.timeStamp);
                
                // 년, 월, 일이 다르면 날짜 구분선 표시
                return currentDate.getFullYear() !== prevDate.getFullYear() ||
                       currentDate.getMonth() !== prevDate.getMonth() ||
                       currentDate.getDate() !== prevDate.getDate();
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
            }
            this.$emit('addTeam', data);
        },
        onGenerationFinished(responseObj) {
            if(responseObj && responseObj.includes('{')){
                try {
                    responseObj = JSON.parse(responseObj);
                } catch(e) {
                    responseObj = partialParse(responseObj)
                }
            }
            if(responseObj.createdNewChatRoomName) {
                this.defMapMsgData.chatRoomName = responseObj.createdNewChatRoomName
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
            
            const selectedUsers = this.allUserList.filter(user => 
                selectedList.includes(user.id)
            );

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
        },
    }
};
</script>

<style lang="scss">
@keyframes breathe {
  0%, 100% {
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
    margin-top:-20px;
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

/* 라우터 로딩(에이전트 선정 중) - '...'만 표시 */
.routing-loading-text {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.72);
    letter-spacing: 1px;
    animation: routingDotsPulse 1.1s infinite ease-in-out;
}

@keyframes routingDotsPulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.9; }
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
    color: rgba(0,0,0,0.55);
}

.mention-autocomplete-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
}
.mention-autocomplete-item:hover {
    background: rgba(0,0,0,0.04);
}
.mention-autocomplete-item--active {
    background: rgba(var(--v-theme-primary), 0.10);
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
    color: rgba(0,0,0,0.78);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mention-autocomplete-sub {
    font-size: 11px;
    color: rgba(0,0,0,0.55);
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
    box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
    border: 1px solid rgba(0,0,0,0.1);
    border-bottom: none;
    width: 100%;
}

.message-info-content {
    padding: 8px 16px;
}

.message-info-box--reply {
    border-radius: 10px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
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
    color: rgba(0,0,0,0.75);
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
    color: rgba(0,0,0,0.62);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reply-banner__close {
    color: rgba(0,0,0,0.55);
}

.reply-quote {
    display: flex;
    gap: 10px;
    align-items: stretch;
    padding: 8px 10px;
    border-radius: 10px;
    margin-bottom: 10px;
    border: 1px solid rgba(0,0,0,0.08);
    background: rgba(255,255,255,0.72);
    cursor: pointer;
}

.reply-quote__body {
    min-width: 0;
    flex: 1 1 auto;
}

.reply-quote__title {
    font-size: 12px;
    font-weight: 800;
    color: rgba(0,0,0,0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reply-quote__text {
    margin-top: 2px;
    font-size: 12px;
    color: rgba(0,0,0,0.6);
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
    color: rgba(0,0,0,0.87);
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
  50% { opacity: 0; }
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
  
  &[style*="flex-end"] {
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
</style>

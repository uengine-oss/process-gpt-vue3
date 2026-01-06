<template>
    <div v-if="!definitionMapOnlyInput" style="background-color: rgba( 255, 255, 255, 1 );"
        class="chat-info-view-wrapper"
    >
        <div class="chat-info-view-wrapper">
            <div class="chat-info-view-area">
                <div class="chat-info-view-area" style="position: relative;">
                    <slot name="custom-chat-top"></slot>
                    <slot name="custom-title" v-if="!definitionMapOnlyInput">
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

                    <perfect-scrollbar v-if="!definitionMapOnlyInput"
                        class="h-100 chat-view-box"
                        ref="scrollContainer"
                        @scroll="handleScroll"
                    >
                        <!-- 상단 hover 영역 및 프로세스 생성 버튼 -->
                        <div 
                            v-if="type === 'chats' && !isSystemChat"
                            class="process-create-hover-area"
                            @mouseenter="showProcessButton = true"
                            @mouseleave="showProcessButton = false"
                        >
                            <transition name="slide-down">
                                <div v-if="showProcessButton" class="process-create-button-container">
                                    <v-btn 
                                        @click="checkProcessFromChat"
                                        color="primary"
                                        variant="flat"
                                        size="small"
                                        :loading="isAnalyzingChat"
                                        class="process-create-btn"
                                    >
                                        <v-icon size="small" class="mr-1">mdi-file-document-edit</v-icon>
                                        프로세스 생성
                                    </v-btn>
                                </div>
                            </transition>
                        </div>

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
                                
                                <div v-for="(message, index) in filteredMessages" :key="index" class="py-1 px-3"
                                    v-if="!shouldHideAgentInterventionResponse(message)">
                                    <!-- 날짜 구분선 표시 -->
                                    <div v-if="shouldDisplayDateSeparator(message, index)" class="date-separator-container">
                                        <v-divider class="date-separator-line"></v-divider>
                                        <div class="date-separator-text">
                                            {{ formatDateSeparator(message.timeStamp) }}
                                        </div>
                                        <v-divider class="date-separator-line"></v-divider>
                                    </div>
                                    
                                    <AgentsChat v-if="message && message._template === 'agent'" :message="message"
                                        :agentInfo="agentInfo" :totalSize="filteredMessages.length" :currentIndex="index"
                                    />
                                    <div v-else>
                                        <div>
                                            <div v-if="message.email == userInfo.email && message.role != 'system'">
                                                <v-row class="ma-0 pa-0">
                                                    <v-spacer></v-spacer>
                                                    
                                                    <!-- 단일 이미지 표시 (기존 호환성) -->
                                                    <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                        <img :src="message.image" class="rounded-md" alt="pro" width="250" />
                                                    </v-sheet>
                                                    
                                                    <!-- 다중 이미지 표시 -->
                                                    <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                        <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                            <img :src="image.url || image" class="rounded-md" alt="pro" width="250" />
                                                        </v-sheet>
                                                    </div>
                                                </v-row>

                                                <div v-if="editIndex === index" class="bg-lightprimary"
                                                    style="border-radius:10px;"
                                                > 
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

                                                <div v-else>
                                                    <div class="d-flex justify-end align-center mb-1">
                                                        <v-avatar size="32" class="mr-2">
                                                            <v-img :src="currentUserPicture" :alt="currentUserName" />
                                                        </v-avatar>
                                                        <div class="user-name">
                                                            {{ currentUserName }}
                                                        </div>
                                                    </div>
                                                    <div class="d-flex justify-end">
                                                        <slot name="custom-message-actions" :message="message"></slot>
                                                        <v-sheet 
                                                            class="chat-message-bubble bg-lightprimary rounded-md px-3 py-3 mb-1"
                                                            :class="{
                                                                'intervention-pending': message.jsonContent?.intervention?.should_intervene && isWaitingForLLMResponse(message, index)
                                                            }"
                                                            :style="{
                                                                position: 'relative',
                                                                overflow: 'visible'
                                                            }"
                                                            @click="(e) => {
                                                                if (console && console.log) {
                                                                    console.log('🎨 [시각적 효과 체크]', {
                                                                        index,
                                                                        messageId: message.id || message.uuid,
                                                                        hasIntervention: !!message.jsonContent?.intervention,
                                                                        should_intervene: message.jsonContent?.intervention?.should_intervene,
                                                                        status: message.jsonContent?.intervention?.status,
                                                                        isWaiting: isWaitingForLLMResponse(message, index),
                                                                        hasPendingClass: message.jsonContent?.intervention?.should_intervene && isWaitingForLLMResponse(message, index),
                                                                        fullJsonContent: message.jsonContent
                                                                    });
                                                                }
                                                            }"
                                                        >
                                                            <!-- 개입 대기 중 펄스 애니메이션 효과 -->
                                                            <div 
                                                                v-if="message.jsonContent?.intervention?.should_intervene && isWaitingForLLMResponse(message, index)"
                                                                class="intervention-pulse-overlay"
                                                            ></div>
                                                            <div 
                                                                @mouseover="hoverIndex = index"
                                                                @mouseleave="hoverIndex = -1"
                                                                style="position: relative; z-index: 1; overflow: hidden;"
                                                            >
                                                                <pre class="text-body-1"
                                                                    v-if="message.replyUserName">{{ message.replyUserName }}</pre>
                                                                <pre class="text-body-1"
                                                                    v-if="message.replyContent">{{ message.replyContent }}</pre>
                                                                <v-divider v-if="message.replyContent"></v-divider>
    
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

                                                                <pre v-if="message.content && message.contentType != 'html'" class="text-body-1" v-html="linkifyWithMentions(message.content)"></pre>

                                                                <!-- 개입 정보 표시 (GroupChat 전용) - 개입이 통과된 경우에만 표시 -->
                                                                <div v-if="message.jsonContent && message.jsonContent.intervention && message.jsonContent.intervention.should_intervene" 
                                                                    class="mt-2"
                                                                >
                                                                    <!-- 접힌 상태: 작은 배지 형태 -->
                                                                    <div v-if="!expandedInterventions[index]" 
                                                                        class="intervention-badge intervention-yes"
                                                                        @click.stop="toggleInterventionExpansion(index)"
                                                                        style="cursor: pointer; display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; transition: all 0.2s ease;"
                                                                    >
                                                                        <v-icon 
                                                                            color="success"
                                                                            size="14"
                                                                            class="mr-1"
                                                                        >
                                                                            mdi-check-circle
                                                                        </v-icon>
                                                                        <span class="font-weight-medium">
                                                                            에이전트 개입됨
                                                                        </span>
                                                                        <!-- LLM 답변 대기 중일 때 로딩 아이콘 표시 -->
                                                                        <v-progress-circular 
                                                                            v-if="isWaitingForLLMResponse(message, index)"
                                                                            indeterminate 
                                                                            color="success" 
                                                                            size="12"
                                                                            width="2"
                                                                            class="ml-1"
                                                                        ></v-progress-circular>
                                                                        <v-icon size="14" class="ml-1">mdi-chevron-down</v-icon>
                                                                    </div>
                                                                    
                                                                    <!-- 펼쳐진 상태: 전체 정보 표시 -->
                                                                    <div v-else
                                                                        class="intervention-info pa-2 intervention-yes"
                                                                        :style="{
                                                                            'border-radius': '6px', 
                                                                            'font-size': '0.75rem',
                                                                            'position': 'relative',
                                                                            'overflow': 'hidden'
                                                                        }"
                                                                    >
                                                                        <!-- LLM 답변 대기 중일 때 펄스 애니메이션 효과 -->
                                                                        <div v-if="isWaitingForLLMResponse(message, index)" 
                                                                            style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.1), transparent); animation: pulse 2s ease-in-out infinite; pointer-events: none;"
                                                                        ></div>
                                                                        
                                                                        <!-- LLM 응답 표시 -->
                                                                        <div v-if="getInterventionResponseMessage(index)">
                                                                            <div class="d-flex align-center mb-2" style="position: relative; z-index: 1;">
                                                                                <v-avatar size="24" style="margin-right:8px;">
                                                                                    <img src="@/assets/images/chat/chat-icon.png" height="24" width="24" />
                                                                                </v-avatar>
                                                                                <span style="font-size: 0.875rem; font-weight: 500; color: rgba(0,0,0,0.7);">AI 어시스턴트</span>
                                                                                <v-spacer></v-spacer>
                                                                                <v-icon 
                                                                                    size="14" 
                                                                                    color="grey" 
                                                                                    style="cursor: pointer;"
                                                                                    @click.stop="toggleInterventionExpansion(index)"
                                                                                >
                                                                                    mdi-chevron-up
                                                                                </v-icon>
                                                                            </div>
                                                                            <div class="agent-message-content" style="font-size: 0.875rem; line-height: 1.5;">
                                                                                <div v-html="renderedMarkdown(getInterventionResponseMessage(index).content)" 
                                                                                    class="markdown-content pl-2 py-1"
                                                                                ></div>
                                                                            </div>
                                                                        </div>
                                                                        <!-- LLM 답변 대기 중일 때 -->
                                                                        <div v-else-if="isWaitingForLLMResponse(message, index)" class="d-flex align-center" style="position: relative; z-index: 1;">
                                                                            <v-progress-circular 
                                                                                indeterminate 
                                                                                color="success" 
                                                                                size="16"
                                                                                width="2"
                                                                                class="mr-2"
                                                                            ></v-progress-circular>
                                                                            <span style="font-size: 0.875rem; color: rgba(0,0,0,0.6);">AI 응답 대기 중...</span>
                                                                            <v-spacer></v-spacer>
                                                                            <v-icon 
                                                                                size="14" 
                                                                                color="grey" 
                                                                                style="cursor: pointer;"
                                                                                @click.stop="toggleInterventionExpansion(index)"
                                                                            >
                                                                                mdi-chevron-up
                                                                            </v-icon>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div v-if="shouldDisplayMessageTimestamp(message, index)" class="message-timestamp my-timestamp">
                                                                    {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                </div>

                                                                <pre v-if="message.jsonContent && message.contentType != 'html' && !message.jsonContent.intervention"
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
                                                <v-row v-if="shouldDisplayUserInfo(message, index) && !agentMessage"
                                                    class="ma-0 pa-0"
                                                >
                                                    <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                                        <v-avatar size="40" style="margin-right:10px;">
                                                            <img v-if="message.role == 'system'"
                                                                src="@/assets/images/chat/chat-icon.png" height="40"
                                                                width="40" />
                                                            <v-img v-else :src="getProfile(message)" :alt="message.name"
                                                                height="40" width="40" />
                                                        </v-avatar>
                                                        <div class="user-name">
                                                            {{ message.role == 'system' ? 'System' : message.name }}
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
                                                <div v-else-if="(message.contentType && message.contentType == 'markdown') || (message.role == 'system' && !message.contentType)" 
                                                    :class="agentMessage || message.role == 'system' ? 'agent-message' : 'other-message'"
                                                >
                                                    <!-- system/agent 메시지 접힌 상태: 작은 배지 형태 -->
                                                    <div v-if="(message.role == 'system' || message.role == 'agent') && !expandedSystemMessages[index]" 
                                                        class="system-message-badge"
                                                        @click.stop="toggleSystemMessageExpansion(index)"
                                                        style="cursor: pointer; display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 16px; font-size: 0.75rem; transition: all 0.2s ease; margin: 8px 0; background-color: rgba(25, 118, 210, 0.1); border: 1px solid rgba(25, 118, 210, 0.3); color: #1565c0;"
                                                    >
                                                        <v-icon 
                                                            color="primary"
                                                            size="16"
                                                            class="mr-2"
                                                        >
                                                            mdi-robot
                                                        </v-icon>
                                                        <span class="font-weight-medium">
                                                            AI 어시스턴트 응답
                                                        </span>
                                                        <v-icon size="14" class="ml-2">mdi-chevron-down</v-icon>
                                                    </div>
                                                    
                                                    <!-- system/agent 메시지 펼쳐진 상태: 전체 내용 표시 -->
                                                    <div v-else>
                                                        <div v-if="(message.role == 'system' || message.role == 'agent') && expandedSystemMessages[index]" 
                                                            class="d-flex justify-end mb-1"
                                                        >
                                                            <v-icon 
                                                                size="14" 
                                                                color="grey" 
                                                                style="cursor: pointer;"
                                                                @click.stop="toggleSystemMessageExpansion(index)"
                                                            >
                                                                mdi-chevron-up
                                                            </v-icon>
                                                        </div>
                                                        <div v-html="renderedMarkdown(message.content, filteredMessages.length - 1 == index && isLoading)" 
                                                            class="markdown-content pl-3 py-2"
                                                        ></div>
                                                        
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
                                                </div>

                                                <div v-else class="w-100 pb-3">
                                                    <!-- 단일 이미지 표시 (기존 호환성) -->
                                                    <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                        <img :src="message.image" class="rounded-md" alt="pro" width="250" />
                                                    </v-sheet>
                                                    
                                                    <!-- 다중 이미지 표시 -->
                                                    <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                        <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                            <img :src="image.url || image" class="rounded-md" alt="pro" width="250" />
                                                        </v-sheet>
                                                    </div>

                                                    <div class="progress-border" :class="{ 'animate': borderCompletedAnimated }" >
                                                        <template
                                                            v-if="message.role == 'system' && filteredMessages.length - 1 == index">
                                                            <div class="progress-border-span"
                                                                :class="{ 'opacity': !borderCompletedAnimated }" v-for="n in 5"
                                                                :key="n"></div>
                                                        </template>
                                                        <v-sheet v-if="message.content" class="other-message rounded-md pa-0"
                                                            :class="showTeamMemberSelector === index ? 'chat-message-bubble-select-team-member' : 'chat-message-bubble'"
                                                            @mouseover="replyIndex = index" @mouseleave="replyIndex = -1"
                                                        >
                                                            <div class="pa-2">
                                                                <pre class="text-body-1" v-if="message.replyUserName">{{ message.replyUserName }}</pre>
                                                                <pre class="text-body-1" v-if="message.replyContent">{{ message.replyContent }}</pre>
                                                                <v-divider v-if="message.replyContent"></v-divider>

                                                                <pre v-if="message.disableMsg" class="text-body-1">{{ "..." }}</pre>
                                                                <div v-else-if="message.htmlContent" v-html="message.htmlContent" class="text-body-1"></div>
                                                                <pre v-else class="text-body-1" v-html="linkifyWithMentions(setMessageForUser(message.content))"></pre>
                                                                
                                                                <!-- 개입 정보 표시 (다른 사용자 메시지, GroupChat 전용) - 개입이 통과된 경우에만 표시 -->
                                                                <div v-if="message.jsonContent && message.jsonContent.intervention && message.jsonContent.intervention.should_intervene && message.role !== 'system'" 
                                                                    class="mt-2"
                                                                >
                                                                    <!-- 접힌 상태: 작은 배지 형태 -->
                                                                    <div v-if="!expandedInterventions[index]" 
                                                                        class="intervention-badge intervention-yes"
                                                                        @click.stop="toggleInterventionExpansion(index)"
                                                                        style="cursor: pointer; display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; transition: all 0.2s ease;"
                                                                    >
                                                                        <v-icon 
                                                                            color="success"
                                                                            size="14"
                                                                            class="mr-1"
                                                                        >
                                                                            mdi-check-circle
                                                                        </v-icon>
                                                                        <span class="font-weight-medium">
                                                                            에이전트 개입됨
                                                                        </span>
                                                                        <!-- LLM 답변 대기 중일 때 로딩 아이콘 표시 -->
                                                                        <v-progress-circular 
                                                                            v-if="isWaitingForLLMResponse(message, index)"
                                                                            indeterminate 
                                                                            color="success" 
                                                                            size="12"
                                                                            width="2"
                                                                            class="ml-1"
                                                                        ></v-progress-circular>
                                                                        <v-icon size="14" class="ml-1">mdi-chevron-down</v-icon>
                                                                    </div>
                                                                    
                                                                    <!-- 펼쳐진 상태: 전체 정보 표시 -->
                                                                    <div v-else
                                                                        class="intervention-info pa-2 intervention-yes"
                                                                        :style="{
                                                                            'border-radius': '6px', 
                                                                            'font-size': '0.75rem',
                                                                            'position': 'relative',
                                                                            'overflow': 'hidden'
                                                                        }"
                                                                    >
                                                                        <!-- LLM 답변 대기 중일 때 펄스 애니메이션 효과 -->
                                                                        <div v-if="isWaitingForLLMResponse(message, index)" 
                                                                            style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.1), transparent); animation: pulse 2s ease-in-out infinite; pointer-events: none;"
                                                                        ></div>
                                                                        
                                                                        <!-- LLM 응답 표시 -->
                                                                        <div v-if="getInterventionResponseMessage(index)">
                                                                            <div class="d-flex align-center mb-2" style="position: relative; z-index: 1;">
                                                                                <v-avatar size="24" style="margin-right:8px;">
                                                                                    <img src="@/assets/images/chat/chat-icon.png" height="24" width="24" />
                                                                                </v-avatar>
                                                                                <span style="font-size: 0.875rem; font-weight: 500; color: rgba(0,0,0,0.7);">AI 어시스턴트</span>
                                                                                <v-spacer></v-spacer>
                                                                                <v-icon 
                                                                                    size="14" 
                                                                                    color="grey" 
                                                                                    style="cursor: pointer;"
                                                                                    @click.stop="toggleInterventionExpansion(index)"
                                                                                >
                                                                                    mdi-chevron-up
                                                                                </v-icon>
                                                                            </div>
                                                                            <div class="agent-message-content" style="font-size: 0.875rem; line-height: 1.5;">
                                                                                <div v-html="renderedMarkdown(getInterventionResponseMessage(index).content)" 
                                                                                    class="markdown-content pl-2 py-1"
                                                                                ></div>
                                                                            </div>
                                                                        </div>
                                                                        <!-- LLM 답변 대기 중일 때 -->
                                                                        <div v-else-if="isWaitingForLLMResponse(message, index)" class="d-flex align-center" style="position: relative; z-index: 1;">
                                                                            <v-progress-circular 
                                                                                indeterminate 
                                                                                color="success" 
                                                                                size="16"
                                                                                width="2"
                                                                                class="mr-2"
                                                                            ></v-progress-circular>
                                                                            <span style="font-size: 0.875rem; color: rgba(0,0,0,0.6);">AI 응답 대기 중...</span>
                                                                            <v-spacer></v-spacer>
                                                                            <v-icon 
                                                                                size="14" 
                                                                                color="grey" 
                                                                                style="cursor: pointer;"
                                                                                @click.stop="toggleInterventionExpansion(index)"
                                                                            >
                                                                                mdi-chevron-up
                                                                            </v-icon>
                                                                        </div>
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

                                                                <div v-if="shouldDisplayMessageTimestamp(message, index)" class="message-timestamp other-timestamp">
                                                                    {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                                                </div>

                                                                <v-row class="pa-0 ma-0 message-actions">
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
                    <div v-if="!definitionMapOnlyInput" style="position:relative; z-index: 9999;">
                        <v-row class="pa-0 ma-0" style="position: absolute; bottom:0px; left:0px;">
                            <div v-if="isOpenedChatMenu" class="chat-menu-background">
                                <!-- <v-tooltip v-if="type != 'AssistantChats'" :text="$t('chat.document')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); startWorkOrder()" v-bind="props"
                                            style="width:30px; height:30px;" :disabled="disableChat">
                                            <Icons :icon="'document'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip> -->
                                <!-- <v-tooltip v-if="isMobile" :text="$t('chat.camera')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); capture()" v-bind="props"
                                            style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat">
                                            <Icons :icon="'camera'" :size="20" />
                                        </v-btn>
                                    </template>
                                </v-tooltip> -->
                                <v-tooltip :text="$t('chat.addImage')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="openChatMenu(); uploadImage()" v-bind="props"
                                            style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat">
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
                </div>
                <v-divider v-if="!hideInput && !definitionMapOnlyInput" />
            </div>

            <div v-if="!hideInput && !definitionMapOnlyInput" style="position: absolute; bottom: 15.1%; left: 24.3%; right: 0px; width: 75%;">
                <div class="message-info-box" v-if="isReply || (!isAtBottom && previewMessage)">
                    <div class="message-info-content">
                        <template v-if="isReply">
                            <div class="message-info-header">
                                <div>{{ replyUser.role == 'system' ? $t('chat.systemReply') : $t('chat.userReply', { name: replyUser.name }) }}</div>
                                <v-icon @click="cancelReply()" size="small">mdi-close</v-icon>
                            </div>
                            <div class="message-info-text">{{ replyUser.content }}</div>
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
            <v-divider v-if="!hideInput && !definitionMapOnlyInput" />

            <div v-if="!hideInput" class="chat-info-message-input-box">
                <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage">
                <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
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
                </div>
                <form :style="type == 'consulting' ? 'position:relative; z-index: 9999;':''" class="d-flex flex-column align-center pa-0">
                    <!-- 멘션 태그 표시 영역 -->
                    <div v-if="mentionedUsers.length > 0" 
                        class="d-flex flex-wrap align-center pa-2"
                        style="width: 100%; gap: 8px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); background-color: rgba(25, 118, 210, 0.04); border-radius: 4px 4px 0 0;"
                    >
                        <v-chip
                            v-for="user in mentionedUsers"
                            :key="user.id"
                            size="small"
                            color="primary"
                            variant="tonal"
                            closable
                            @click:close="removeMention(user.id)"
                            style="height: 28px; font-size: 13px; font-weight: 500;"
                        >
                            <v-avatar size="18" class="mr-2">
                                <img :src="user.profile || '/images/defaultUser.png'" :alt="user.username" />
                            </v-avatar>
                            {{ user.username }}
                            <v-chip v-if="user.is_agent" size="x-small" color="primary" variant="outlined" class="ml-2" style="height: 14px; font-size: 9px; font-weight: 600;">
                                에이전트
                            </v-chip>
                        </v-chip>
                    </div>
                    
                    <v-textarea 
                        variant="solo" 
                        hide-details 
                        v-model="newMessage" 
                        color="primary"
                        class="shadow-none message-input-box delete-input-details cp-chat" 
                        density="compact" 
                        :placeholder="$t('chat.inputMessage')"
                        auto-grow 
                        rows="1" 
                        @keypress.enter="beforeSend" 
                        :disabled="disableChat"
                        @input="handleTextareaInput"
                        @paste="handlePaste"
                        @keydown="handleKeydown"
                    >
                    </v-textarea>
                    
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
                            <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" />
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

                            <v-btn v-if="!isLoading"
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
                                @click="isLoading = !isLoading"
                            >
                                <Icons :icon="'outline-stop-circle'" :size="16" />
                            </v-btn>
                        </div>
                    </div>
                    
                    <div v-if="showUserList" class="user-list"
                        style="position: absolute; bottom: 16%; left: 0; background-color: white; z-index: 100; max-height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div v-for="(user, index) in filteredUserList" :key="user.id" @click="selectUser(user)" class="user-item"
                            :style="{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: selectedUserIndex === index ? '#e3f2fd' : 'white'
                            }"
                            @mouseenter="selectedUserIndex = index"
                            @mouseleave="selectedUserIndex = -1">
                            <img :src="user.profile || '/images/defaultUser.png'" alt="profile"
                                style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span>{{ user.username }}</span>
                                    <v-chip v-if="user.is_agent" size="x-small" color="primary" variant="outlined" style="height: 18px; font-size: 10px;">
                                        에이전트
                                    </v-chip>
                                </div>
                                <div style="font-size: 0.8em; color: #666;">{{ user.email || '에이전트' }}</div>
                            </div>
                        </div>
                    </div>
                    
                </form>
            </div>
        </div>
    </div>
    <!-- 프로세스 정의 체계도 상단 chat UI -->
    <div v-else>
        <v-card elevation="10" class="pa-4">
            <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage">
            <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
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
            </div>
            <form :style="type == 'consulting' ? 'position:relative; z-index: 9999;':''" class="d-flex flex-column align-center pa-0">
                <!-- 멘션 태그 표시 영역 -->
                <div v-if="mentionedUsers.length > 0" 
                    class="d-flex flex-wrap align-center pa-2"
                    style="width: 100%; gap: 8px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); background-color: rgba(25, 118, 210, 0.04); border-radius: 4px 4px 0 0;"
                >
                    <v-chip
                        v-for="user in mentionedUsers"
                        :key="user.id"
                        size="small"
                        color="primary"
                        variant="tonal"
                        closable
                        @click:close="removeMention(user.id)"
                        style="height: 28px; font-size: 13px; font-weight: 500;"
                    >
                        <v-avatar size="18" class="mr-2">
                            <img :src="user.profile || '/images/defaultUser.png'" :alt="user.username" />
                        </v-avatar>
                        {{ user.username }}
                        <v-chip v-if="user.is_agent" size="x-small" color="primary" variant="outlined" class="ml-2" style="height: 14px; font-size: 9px; font-weight: 600;">
                            에이전트
                        </v-chip>
                    </v-chip>
                </div>
                
                <v-textarea 
                    variant="solo" 
                    hide-details 
                    v-model="newMessage" 
                    color="primary"
                    class="shadow-none message-input-box delete-input-details cp-chat" 
                    density="compact" 
                    :placeholder="$t('chat.definitionMapInputMessage')"
                    auto-grow 
                    rows="1" 
                    @keypress.enter="beforeSend" 
                    :disabled="disableChat || isGenerationFinished"
                    @input="handleTextareaInput"
                    @keydown="handleKeydown"
                    @paste="handlePaste"
                >
                </v-textarea>
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
                        <v-btn v-if="!isMicRecording && !isMicRecorderLoading" @click="startVoiceRecording()"
                            class="mr-1 text-medium-emphasis"
                            density="comfortable"
                            icon
                            variant="outlined"
                            size="small"
                            style="border-color: #e0e0e0 !important;"
                            :disabled="isGenerationFinished"
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
                            :disabled="isGenerationFinished"
                        >
                            <Icons :icon="'stop'" :size="'16'" />
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
                        <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" />

                        <v-btn v-if="!isLoading && !isGenerationFinished"
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
                            @click="isLoading = !isLoading"
                        >
                            <Icons :icon="'outline-stop-circle'" :size="16" />
                        </v-btn>
                    </div>
                </div>
                
                <div v-if="showUserList" class="user-list"
                    style="position: absolute; bottom: 16%; left: 0; background-color: white; z-index: 100; max-height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div v-for="(user, index) in filteredUserList" :key="user.id" @click="selectUser(user)" class="user-item"
                        :style="{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            backgroundColor: selectedUserIndex === index ? '#e3f2fd' : 'white'
                        }"
                        @mouseenter="selectedUserIndex = index"
                        @mouseleave="selectedUserIndex = -1">
                        <img :src="user.profile" alt="profile"
                            style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                        <div>
                            <div>{{ user.username }}</div>
                            <div style="font-size: 0.8em; color: #666;">{{ user.email }}</div>
                        </div>
                    </div>
                </div>
                
            </form>
        </v-card>
    </div>
    <Record @close="recordingModeChange()" @start="startRecording()" @stop="stopRecording()"
        :audioResponse="newMessage" :chatRoomId="chatRoomId" :recordingMode="recordingMode" />
    
    <!-- 프로세스 생성 확인 다이얼로그 -->
    <v-dialog v-model="processCreationDialog" persistent max-width="600px">
        <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
                <span>프로세스 생성 확인</span>
                <v-btn icon variant="text" @click="processCreationDialog = false" size="small">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text>
                <div v-if="isAnalyzingChat" class="text-center py-4">
                    <v-progress-circular indeterminate color="primary" class="mb-2"></v-progress-circular>
                    <div>채팅 이력을 분석 중입니다...</div>
                </div>
                <div v-else-if="processAnalysisResult">
                    <div v-if="processAnalysisResult.can_create_process" class="mb-4">
                        <v-alert type="success" variant="tonal" class="mb-3">
                            채팅 이력에서 프로세스로 만들만한 내용을 발견했습니다!
                        </v-alert>
                        <div class="mb-3">
                            <strong>제안된 프로세스 이름:</strong>
                            <div class="mt-1">{{ processAnalysisResult.suggested_process_name }}</div>
                        </div>
                        <div class="mb-3">
                            <strong>프로세스 설명:</strong>
                            <div class="mt-1">{{ processAnalysisResult.suggested_process_description }}</div>
                        </div>
                        <div class="mb-3">
                            <strong>판단 이유:</strong>
                            <div class="mt-1">{{ processAnalysisResult.reason }}</div>
                        </div>
                        <div class="text-caption text-grey">
                            신뢰도: {{ (processAnalysisResult.confidence * 100).toFixed(0) }}%
                        </div>
                    </div>
                    <div v-else>
                        <v-alert type="info" variant="tonal" class="mb-3">
                            채팅 이력에서 프로세스로 만들만한 내용을 찾지 못했습니다.
                        </v-alert>
                        <div class="mb-3">
                            <strong>이유:</strong>
                            <div class="mt-1">{{ processAnalysisResult.reason }}</div>
                        </div>
                    </div>
                </div>
            </v-card-text>
            <v-card-actions v-if="processAnalysisResult && processAnalysisResult.can_create_process">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="processCreationDialog = false">취소</v-btn>
                <v-btn 
                    color="primary" 
                    variant="flat" 
                    @click="createProcessFromChat"
                    :loading="isCreatingProcess"
                >
                    프로세스 생성
                </v-btn>
            </v-card-actions>
            <v-card-actions v-else-if="processAnalysisResult && !processAnalysisResult.can_create_process">
                <v-spacer></v-spacer>
                <v-btn variant="flat" @click="processCreationDialog = false">확인</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
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
import ProcessDefinitionGenerator from '@/components/ai/ProcessDefinitionGenerator.js';
import BPMNXmlGenerator from '@/components/BPMNXmlGenerator.vue';

import BackendFactory from '@/components/api/BackendFactory';
import { useDefaultSetting } from '@/stores/defaultSetting';
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
        ScrollBottomHandle,
        BPMNXmlGenerator
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
        definitionMapOnlyInput: {
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
        showDetailInfo: {
            type: Boolean,
            default: false
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
        'executeProcess'
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
            showNewMessageNoti: false,
            lastMessage: { name: '', content: '' },
            showNewMessageNotiTimer: null,
            showUserList: false,
            mentionStartIndex: null,
            mentionedUsers: [],
            selectedUserIndex: -1, // 키보드로 선택된 사용자 인덱스
            file: null,
            isRender: false,
            
            // assistantChat
            checked: true,
            isOpenedChatMenu: false,
            isViewWork: null,

            previewMessage: null,
            windowWidth: window.innerWidth,
            processCreationDialog: false,
            isAnalyzingChat: false,
            isCreatingProcess: false,
            processAnalysisResult: null,
            showProcessButton: false,
            generator: null,
            isGenerationFinished: false,
            messageHistoryIndex: -1,
            originalMessage: '',
            showTeamMemberSelector: null,
            selectedTeamMembersByMessage: {},
            teamMemberSearch: '',
            currentUserName: localStorage.getItem('userName') || '사용자',
            currentUserPicture: localStorage.getItem('picture') || '/images/defaultUser.png',
            isSending: false,
            expandedInterventions: {},
            expandedSystemMessages: {},
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
        window.removeEventListener('resize', this.handleResize);
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
            if (!this.showUserList || this.mentionStartIndex === null || !this.userList) {
                return [];
            }
            let userList = this.userList.filter(user => this.currentChatRoom.participants.some(participant => participant.id === user.id));
            
            const defaultSetting = useDefaultSetting();
            const agentList = defaultSetting.getAgentList;
            
            if (this.participantUsers && this.participantUsers.length > 0) {
                agentList.forEach(agent => {
                    if (agent.is_hidden) {
                        return;
                    }
                    
                    const existsInUserList = userList.some(u => u.id === agent.id);
                    const isParticipant = this.participantUsers.some(participant => {
                        if (participant.id === agent.id) {
                            return true;
                        }
                        if (participant.is_agent && participant.agent_type === agent.agent_type && participant.alias === agent.alias) {
                            return true;
                        }
                        if (participant.email && agent.email && participant.email === agent.email) {
                            return true;
                        }
                        return false;
                    });
                    
                    if (!existsInUserList && isParticipant) {
                        userList.push({
                            id: agent.id,
                            username: agent.username,
                            email: agent.email || `${agent.alias}@agent`,
                            profile: agent.profile || '/images/chat-icon.png',
                            is_agent: true,
                            agent_type: agent.agent_type,
                            alias: agent.alias
                        });
                    }
                });
            }
            
            userList.push({
                email: "system@uengine.org",
                id: "system_id",
                profile: "/images/chat-icon.png",
                username: "System",
            })
            userList.reverse()
            const query = this.newMessage.substring(this.mentionStartIndex + 1).toLowerCase();
            return userList.filter(user => user.username.toLowerCase().includes(query) && !this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id));
        },
        filteredMessages() {
            var list = [];
            const myEmail = localStorage.getItem('email');
            if (this.messages && this.messages.length > 0) {
                this.messages.forEach((item, index) => {
                    let data = JSON.parse(JSON.stringify(item));
                    
                    // 프로세스 실행 메시지에 formValues 초기화
                    if (data.work === 'StartProcessInstance' && data.firstActivityForm && !data.formValues) {
                        data.formValues = {};
                    }
                    
                    // 에이전트 개입 응답 메시지는 필터링에서 제외 (채팅창에 표시하지 않음)
                    if (this.shouldHideAgentInterventionResponse(data)) {
                        return;
                    }
                    
                    // 개입 정보가 있는 메시지도 표시 (content가 없어도)
                    // content가 있거나, jsonContent가 있거나, image가 있거나, 개입 정보가 있는 경우 표시
                    if (data.content || data.jsonContent || data.image || 
                        (data.jsonContent && data.jsonContent.intervention)) {
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
        isGroupChat() {
            return this.participantUsers && this.participantUsers.length >= 2;
        }
    },
    methods: {
        toggleInterventionExpansion(index) {
            this.expandedInterventions[index] = !this.expandedInterventions[index];
        },
        toggleSystemMessageExpansion(index) {
            this.expandedSystemMessages[index] = !this.expandedSystemMessages[index];
        },
        getInterventionResponseMessage(index) {
            const currentMessage = this.filteredMessages[index];
            
            console.log('🔍 getInterventionResponseMessage 호출:', {
                index,
                currentMessage: currentMessage ? {
                    id: currentMessage.id,
                    uuid: currentMessage.uuid,
                    content: currentMessage.content?.substring(0, 50),
                    hasJsonContent: !!currentMessage.jsonContent,
                    jsonContent: currentMessage.jsonContent,
                    intervention: currentMessage.jsonContent?.intervention,
                    timeStamp: currentMessage.timeStamp,
                    email: currentMessage.email
                } : null
            });
            
            if (!currentMessage) {
                console.log('❌ currentMessage가 없음');
                return null;
            }
            
            if (!currentMessage.jsonContent) {
                console.log('❌ jsonContent가 없음');
                return null;
            }
            
            if (!currentMessage.jsonContent.intervention) {
                console.log('❌ intervention이 없음');
                return null;
            }
            
            if (!currentMessage.jsonContent.intervention.should_intervene) {
                console.log('❌ should_intervene이 false');
                return null;
            }
            
            // UUID를 여러 방법으로 찾기 시도
            let userMessageUuid = currentMessage.uuid || currentMessage.id;
            
            // uuid가 없으면 messages 배열에서 원본 메시지를 찾아서 uuid 가져오기
            if (!userMessageUuid) {
                console.log('🔍 this.messages에서 원본 메시지 찾기 시도...', {
                    filteredMessageIndex: index,
                    totalMessages: this.messages.length,
                    currentMessageTimeStamp: currentMessage.timeStamp,
                    currentMessageContent: currentMessage.content?.substring(0, 50)
                });
                
                for (let i = 0; i < this.messages.length; i++) {
                    const msg = this.messages[i];
                    // 같은 메시지인지 확인 (content, timeStamp, email 등으로)
                    // timeStamp가 정확히 일치하거나, content와 email이 일치하는 경우
                    const timeMatch = msg.timeStamp === currentMessage.timeStamp;
                    const contentMatch = msg.content === currentMessage.content || 
                                       (msg.content && currentMessage.content && 
                                        msg.content.trim() === currentMessage.content.trim());
                    const emailMatch = msg.email === currentMessage.email;
                    
                    if (timeMatch && contentMatch && emailMatch) {
                        userMessageUuid = msg.uuid || msg.id;
                        console.log('✅ 원본 메시지 찾음:', {
                            index: i,
                            uuid: msg.uuid,
                            id: msg.id,
                            foundUuid: userMessageUuid
                        });
                        break;
                    }
                }
            }
            
            if (!userMessageUuid) {
                console.log('❌ userMessageUuid를 찾을 수 없음:', {
                    currentMessage: {
                        id: currentMessage.id,
                        uuid: currentMessage.uuid,
                        content: currentMessage.content?.substring(0, 50),
                        timeStamp: currentMessage.timeStamp,
                        email: currentMessage.email
                    },
                    messagesSample: this.messages.slice(0, 3).map(m => ({
                        id: m.id,
                        uuid: m.uuid,
                        content: m.content?.substring(0, 50),
                        timeStamp: m.timeStamp,
                        email: m.email
                    }))
                });
                // UUID가 없어도 시간 기반으로 찾기 시도 (하위 호환성)
                console.log('⚠️ UUID 없이 시간 기반으로 찾기 시도...');
            }
            
            console.log('✅ 조건 통과, 메시지 찾기 시작:', { userMessageUuid });
            
            // 방법 1: user_message_uuid로 직접 연결된 에이전트 메시지 찾기 (가장 정확)
            // UUID가 있을 때만 시도
            if (userMessageUuid) {
                for (let i = 0; i < this.messages.length; i++) {
                    const msg = this.messages[i];
                    if ((msg.role === 'system' || msg.role === 'agent')) {
                        // jsonContent가 문자열일 수도 있으므로 파싱 시도
                        let jsonContent = msg.jsonContent;
                        if (typeof jsonContent === 'string') {
                            try {
                                jsonContent = JSON.parse(jsonContent);
                            } catch (e) {
                                jsonContent = null;
                            }
                        }
                        
                        if (jsonContent && jsonContent.user_message_uuid) {
                            const userMessageUuidInResponse = jsonContent.user_message_uuid;
                            if (String(userMessageUuidInResponse) === String(userMessageUuid)) {
                                console.log('✅ 개입 응답 메시지 찾음 (UUID 매칭):', {
                                    userMessageUuid,
                                    agentMessageUuid: msg.uuid,
                                    agentMessageContent: msg.content?.substring(0, 50)
                                });
                                return msg;
                            }
                        }
                    }
                }
            }
            
            // 디버깅: 찾지 못한 경우 로그 출력
            console.log('⚠️ UUID 매칭 실패, 다른 방법 시도:', {
                userMessageUuid,
                userMessageContent: currentMessage.content?.substring(0, 50),
                userMessageTimeStamp: currentMessage.timeStamp,
                availableAgentMessages: this.messages
                    .filter(m => (m.role === 'system' || m.role === 'agent'))
                    .map(m => ({
                        uuid: m.uuid,
                        role: m.role,
                        content: m.content?.substring(0, 50),
                        timeStamp: m.timeStamp,
                        jsonContent: m.jsonContent
                    }))
            });
            
            // 방법 2: 바로 다음 메시지 확인 (하위 호환성)
            // UUID가 없어도 timeStamp로 원본 메시지 찾기
            let originalIndex = -1;
            if (!userMessageUuid) {
                // timeStamp로 찾기
                for (let i = 0; i < this.messages.length; i++) {
                    const msg = this.messages[i];
                    if (msg.timeStamp === currentMessage.timeStamp &&
                        msg.email === currentMessage.email &&
                        msg.content === currentMessage.content) {
                        originalIndex = i;
                        userMessageUuid = msg.uuid || msg.id;
                        console.log('✅ timeStamp로 원본 메시지 찾음:', {
                            index: i,
                            uuid: msg.uuid,
                            id: msg.id
                        });
                        break;
                    }
                }
            } else {
                // UUID가 있으면 UUID로 찾기
                for (let i = 0; i < this.messages.length; i++) {
                    const msg = this.messages[i];
                    if (msg.id && String(msg.id) === String(userMessageUuid)) {
                        originalIndex = i;
                        break;
                    }
                    if (msg.uuid && String(msg.uuid) === String(userMessageUuid)) {
                        originalIndex = i;
                        break;
                    }
                }
            }
            
            if (originalIndex >= 0 && originalIndex < this.messages.length - 1) {
                const nextMessage = this.messages[originalIndex + 1];
                if (nextMessage && (nextMessage.role === 'system' || nextMessage.role === 'agent') && nextMessage.content) {
                    console.log('✅ 개입 응답 메시지 찾음 (바로 다음 메시지):', {
                        userMessageUuid,
                        agentMessageUuid: nextMessage.uuid,
                        agentMessageContent: nextMessage.content?.substring(0, 50),
                        agentMessageJsonContent: nextMessage.jsonContent
                    });
                    return nextMessage;
                }
            }
            
            // 방법 3: 시간 기반으로 사용자 메시지 이후의 에이전트 메시지 찾기 (하위 호환성)
            if (originalIndex >= 0 && currentMessage.timeStamp) {
                const userTimeStamp = currentMessage.timeStamp;
                for (let i = originalIndex + 1; i < this.messages.length; i++) {
                    const msg = this.messages[i];
                    // 사용자 메시지 이후의 에이전트/시스템 메시지 찾기
                    if (msg.timeStamp && msg.timeStamp > userTimeStamp && 
                        (msg.timeStamp - userTimeStamp) < 60000 && // 60초 이내
                        (msg.role === 'system' || msg.role === 'agent') && 
                        msg.content && msg.content.trim() !== '') {
                        console.log('✅ 개입 응답 메시지 찾음 (시간 기반):', {
                            userMessageUuid,
                            agentMessageUuid: msg.uuid,
                            agentMessageContent: msg.content?.substring(0, 50),
                            timeDiff: msg.timeStamp - userTimeStamp,
                            agentMessageJsonContent: msg.jsonContent
                        });
                        return msg;
                    }
                    // 너무 오래된 메시지는 무시 (다음 사용자 메시지가 나오면 중단)
                    if (msg.email && msg.email === currentMessage.email && msg.timeStamp > userTimeStamp) {
                        break;
                    }
                }
            }
            
            console.log('❌ 개입 응답 메시지를 찾지 못함 (모든 방법 시도 후):', {
                userMessageUuid,
                userMessageContent: currentMessage.content?.substring(0, 50),
                originalIndex,
                totalMessages: this.messages.length
            });
            return null;
        },
        isInterventionResponse(index) {
            if (index > 0) {
                const prevMessage = this.filteredMessages[index - 1];
                if (prevMessage && prevMessage.jsonContent && prevMessage.jsonContent.intervention && 
                    prevMessage.jsonContent.intervention.should_intervene) {
                    return true;
                }
            }
            return false;
        },
        shouldHideAgentInterventionResponse(message) {
            // 에이전트 개입 응답 메시지는 채팅창에서 숨김 (개입 배지 안에서만 표시)
            if (!message) {
                return false;
            }
            
            // role이 'system' 또는 'agent'인 메시지 확인
            if (message.role === 'system' || message.role === 'agent') {
                // jsonContent가 문자열일 수도 있으므로 파싱 시도
                let jsonContent = message.jsonContent;
                if (typeof jsonContent === 'string') {
                    try {
                        jsonContent = JSON.parse(jsonContent);
                    } catch (e) {
                        jsonContent = null;
                    }
                }
                
                // user_message_uuid가 있으면 개입 응답 메시지이므로 숨김
                if (jsonContent && jsonContent.user_message_uuid) {
                    console.log('🚫 에이전트 개입 응답 메시지 숨김:', {
                        messageUuid: message.uuid,
                        userMessageUuid: jsonContent.user_message_uuid,
                        content: message.content?.substring(0, 50)
                    });
                    return true;
                }
            }
            return false;
        },
        scrollToTop() {
            if (this.$refs.scrollContainer) {
                this.$refs.scrollContainer.$el.scrollTop = 0;
            }
        },
        renderedMarkdown(text, isGenerating = false) {
            if (!text) return '';
            
            const trimmedText = text.trim();
            
            // "AI 생성중..." 텍스트를 감지하면 띵킹 애니메이션 반환
            if (trimmedText === 'AI 생성중...') {
                const loadingText = 'AI 생성 중...';
                const animatedChars = loadingText.split('').map((char, index) => {
                    const safeChar = char === ' ' ? '&nbsp;' : char;
                    return `<span class="thinking-char" style="animation-delay: ${index * 0.1}s">${safeChar}</span>`;
                }).join('');
                
                return `<div class="thinking-wave-text" style="font-weight: bold;">${animatedChars}</div>`;
            }
            
            const isLoadingPlaceholder = trimmedText === '...' || trimmedText === '….';
            
            let processedText = text;
            let hasJsonBlock = false;
            
            if (!isLoadingPlaceholder && (text.includes('processDefinitionId') || text.includes('elements'))) {
                const codeBlockStart = text.indexOf('```');
                if (codeBlockStart !== -1) {
                    hasJsonBlock = true;
                    processedText = text.substring(0, codeBlockStart).trim();
                }
            }
            
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            
            let renderedHtml = isLoadingPlaceholder ? '' : marked(processedText);
            
            if ((hasJsonBlock && isGenerating) || isLoadingPlaceholder) {
                const loadingText = 'AI 생성 중...';
                const animatedChars = loadingText.split('').map((char, index) => {
                    const safeChar = char === ' ' ? '&nbsp;' : char;
                    return `<span class="thinking-char" style="animation-delay: ${index * 0.1}s">${safeChar}</span>`;
                }).join('');
                
                const marginTop = hasJsonBlock ? 'margin-top: 16px;' : '';
                renderedHtml += `<div class="thinking-wave-text" style="${marginTop} font-weight: bold;">${animatedChars}</div>`;
            }
            
            return renderedHtml;
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
            if (this.definitionMapOnlyInput) {
                // 정의 맵에서는 chats로 이동하면서 업무지시 다이얼로그 열기
                this.$router.push({
                    path: '/chats',
                    query: {
                        openWorkOrder: 'true'
                    }
                });
            } else {
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
        linkifyWithMentions(inputText) {
            if (!inputText) return '';
            
            let text = inputText;
            const allUsers = [];
            
            if (this.userList) {
                allUsers.push(...this.userList);
            }
            
            if (this.participantUsers) {
                this.participantUsers.forEach(participant => {
                    if (participant.is_agent && !allUsers.find(u => u.id === participant.id)) {
                        allUsers.push(participant);
                    }
                });
            }
            
            allUsers.push({
                email: "system@uengine.org",
                id: "system_id",
                username: "System"
            });
            
            allUsers.forEach(user => {
                if (user.username) {
                    const mentionPattern = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
                    const mentionHtml = `<span class="mention-highlight" style="color: #1976d2; font-weight: 600; background-color: rgba(25, 118, 210, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.95em;">@${user.username}</span>`;
                    text = text.replace(mentionPattern, mentionHtml);
                }
            });
            
            return this.linkify(text);
        },
        formatMentionsInPreview(inputText) {
            if (!inputText) return '';
            
            let text = this.escapeHtml(inputText);
            const sortedUsers = [...this.mentionedUsers].sort((a, b) => (b.username || '').length - (a.username || '').length);
            
            sortedUsers.forEach(user => {
                if (user.username) {
                    const escapedUsername = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const mentionPattern = new RegExp(`@${escapedUsername}(?=\\s|$)`, 'g');
                    const mentionHtml = `<span style="color: #1976d2 !important; font-weight: 600 !important; background-color: rgba(25, 118, 210, 0.2) !important; padding: 2px 6px !important; border-radius: 4px !important; display: inline-block !important;">@${this.escapeHtml(user.username)}</span>`;
                    text = text.replace(mentionPattern, mentionHtml);
                }
            });
            
            return text;
        },
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        hasMentionsInText(text) {
            if (!text || !this.mentionedUsers || this.mentionedUsers.length === 0) {
                return false;
            }
            return this.mentionedUsers.some(user => {
                if (user.username) {
                    const mentionPattern = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'g');
                    return text.match(mentionPattern);
                }
                return false;
            });
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
            this.isMicRecording = true;

            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micRecorder = new MediaRecorder(stream);
            this.micAudioChunks = [];
            this.micRecorder.ondataavailable = e => {
                this.micAudioChunks.push(e.data);
            };
            this.micRecorder.start();
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
        async checkProcessFromChat() {
            if (!this.chatRoomId) {
                alert('채팅방 ID가 없습니다.');
                return;
            }
            
            this.processCreationDialog = true;
            this.isAnalyzingChat = true;
            this.processAnalysisResult = null;
            
            try {
                const response = await axios.post('/langchain-chat/process/analyze', {
                    chat_room_id: this.chatRoomId
                });
                
                this.processAnalysisResult = response.data;
            } catch (error) {
                console.error('채팅 분석 실패:', error);
                this.processAnalysisResult = {
                    can_create_process: false,
                    reason: `분석 중 오류가 발생했습니다: ${error.response?.data?.detail || error.message}`
                };
            } finally {
                this.isAnalyzingChat = false;
            }
        },
        async createProcessFromChat() {
            if (!this.processAnalysisResult || !this.processAnalysisResult.can_create_process) {
                return;
            }
            
            this.isCreatingProcess = true;
            
            try {
                // 1. 채팅 이력 가져오기
                const historyResponse = await axios.post('/langchain-chat/process/chat-history', {
                    chat_room_id: this.chatRoomId
                });
                
                const chatHistory = historyResponse.data.raw_history || [];
                const formattedHistory = historyResponse.data.chat_history || '';
                
                // 2. ProcessDefinitionGenerator 생성 및 설정
                const generator = new ProcessDefinitionGenerator(this, {
                    isStream: false,
                    preferredLanguage: 'Korean'
                });
                
                // 채팅 이력을 previousMessages에 추가
                // 시스템 메시지는 이미 previousMessages[0]에 있음
                if (chatHistory && chatHistory.length > 0) {
                    // 채팅 이력을 사용자/어시스턴트 메시지로 추가
                    chatHistory.forEach(msg => {
                        if (msg.role && msg.content) {
                            generator.previousMessages.push({
                                role: msg.role,
                                content: msg.content
                            });
                        }
                    });
                }
                
                // 프로세스 생성 요청을 마지막 사용자 메시지로 추가
                const processCreationPrompt = `아래 대화 내용을 바탕으로 프로세스 정의를 생성해주세요. 이때 가능한 프로세스를 일반화하여 작성해주세요.

프로세스 이름: ${this.processAnalysisResult.suggested_process_name || '새 프로세스'}
프로세스 설명: ${this.processAnalysisResult.suggested_process_description || ''}

위 대화 내용을 분석하여 프로세스 정의 JSON을 생성해주세요.`;
                
                generator.previousMessages.push({
                    role: 'user',
                    content: processCreationPrompt
                });
                
                generator.newMessage = '';
                
                const responsePromise = new Promise((resolve, reject) => {
                    const originalOnGenerationFinished = generator.client.onGenerationFinished;
                    
                    generator.client.onGenerationFinished = (model) => {
                        console.log('[createProcessFromChat] onGenerationFinished 호출됨', { model, modelJson: generator.modelJson });
                        
                        if (originalOnGenerationFinished) {
                            try {
                                originalOnGenerationFinished.call(generator.client, model);
                            } catch (error) {
                                console.warn('[createProcessFromChat] originalOnGenerationFinished에서 오류 발생 (무시):', error);
                            }
                        }
                        
                        const response = generator.modelJson || model;
                        resolve(response);
                    };
                    
                    generator.client.onError = (error) => {
                        console.error('[createProcessFromChat] 생성 중 오류:', error);
                        reject(error);
                    };
                });
                
                generator.generate();
                const response = await responsePromise;
                console.log('[createProcessFromChat] LLM 응답 받음:', { response, type: typeof response });
                
                let jsonProcess;
                try {
                    let responseText = typeof response === 'string' ? response : String(response);
                    
                    if (typeof response === 'object' && response !== null && !Array.isArray(response) && response.processDefinitionId) {
                        jsonProcess = response;
                    } else {
                        console.log('[createProcessFromChat] 원본 응답 텍스트 (처음 500자):', responseText.substring(0, 500));
                        
                        let jsonString = null;
                        const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i);
                        if (jsonBlockMatch) {
                            jsonString = jsonBlockMatch[1].trim();
                        } else {
                            const codeBlockMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
                            if (codeBlockMatch) {
                                jsonString = codeBlockMatch[1].trim();
                            } else {
                                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    jsonString = jsonMatch[0];
                                }
                            }
                        }
                        
                        if (!jsonString) {
                            console.error('[createProcessFromChat] JSON을 찾을 수 없음. 전체 응답:', responseText);
                            throw new Error('응답에서 JSON을 찾을 수 없습니다.');
                        }
                        
                        console.log('[createProcessFromChat] 추출된 JSON 문자열 (처음 500자):', jsonString.substring(0, 500));
                        
                        try {
                            jsonProcess = JSON.parse(jsonString);
                        } catch (parseError) {
                            console.log('[createProcessFromChat] 일반 파싱 실패, partialParse 시도. 오류:', parseError.message);
                            try {
                                // partialParse 시도 (불완전한 JSON도 파싱 가능)
                                jsonProcess = partialParse(jsonString);
                            } catch (partialError) {
                                console.warn('[createProcessFromChat] partialParse 실패 (계속 시도):', partialError.message);
                                // 마지막 시도: 닫는 중괄호가 누락된 경우 추가
                                let fixedJson = jsonString.trim();
                                
                                // 중괄호 개수 확인
                                const openBraces = (fixedJson.match(/\{/g) || []).length;
                                const closeBraces = (fixedJson.match(/\}/g) || []).length;
                                const missingBraces = openBraces - closeBraces;
                                
                                if (missingBraces > 0) {
                                    // 누락된 닫는 중괄호 추가
                                    fixedJson += '\n' + '}'.repeat(missingBraces);
                                    console.log('[createProcessFromChat] 중괄호 추가 시도. 누락된 개수:', missingBraces);
                                }
                                
                                try {
                                    jsonProcess = JSON.parse(fixedJson);
                                } catch (finalError) {
                                    console.error('[createProcessFromChat] 최종 파싱 실패:', finalError);
                                    console.error('[createProcessFromChat] 시도한 JSON (처음 1000자):', fixedJson.substring(0, 1000));
                                    throw new Error(`JSON 파싱 실패: ${finalError.message}`);
                                }
                            }
                        }
                    }
                    
                    console.log('[createProcessFromChat] 파싱된 JSON:', jsonProcess);
                } catch (error) {
                    console.error('[createProcessFromChat] JSON 파싱 실패:', error);
                    console.error('[createProcessFromChat] 원본 응답 (처음 1000자):', typeof response === 'string' ? response.substring(0, 1000) : response);
                    throw new Error(`프로세스 정의 파싱에 실패했습니다: ${error.message}`);
                }
                
                if (!jsonProcess || !jsonProcess.processDefinitionId) {
                    console.error('[createProcessFromChat] 유효하지 않은 프로세스 정의:', jsonProcess);
                    throw new Error('유효한 프로세스 정의를 생성하지 못했습니다. processDefinitionId가 없습니다.');
                }
                
                const bpmnXml = this.createBpmnXml(jsonProcess, true); // isHorizontal = true
                
                const saveResponse = await axios.post('/langchain-chat/process/save', {
                    process_definition: jsonProcess,
                    bpmn_xml: bpmnXml
                });
                
                if (saveResponse.data.success) {
                    alert('프로세스가 성공적으로 생성되었습니다!');
                    this.processCreationDialog = false;
                    this.processAnalysisResult = null;
                    
                    if (this.EventBus) {
                        this.EventBus.emit('definitions-updated');
                    } else if (window.EventBus) {
                        window.EventBus.emit('definitions-updated');
                    }
                } else {
                    alert('프로세스 저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('프로세스 생성 실패:', error);
                alert(`프로세스 생성 중 오류가 발생했습니다: ${error.response?.data?.detail || error.message}`);
            } finally {
                this.isCreatingProcess = false;
            }
        },
        submitFile() {
            var me = this
            if (!me.file) return;
            const fileName = me.file[0].name;
            const fileObj = {
                chat_room_id: me.chatRoomId,
                user_name: me.userInfo.name
            }
            backend.uploadFile(fileName, me.file[0], fileObj).then((response) => {
                me.$try({
                    action: async () => {
                        console.log(response);
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
        // contenteditable div에서 텍스트 추출
        getPlainTextFromDiv(element) {
            if (!element) return '';
            return element.innerText || element.textContent || '';
        },
        formatMentionsInInput(text) {
            if (!text) return '';
            let html = this.escapeHtml(text);
            const sortedUsers = [...this.mentionedUsers].sort((a, b) => (b.username || '').length - (a.username || '').length);
            
            sortedUsers.forEach(user => {
                if (user.username) {
                    const escapedUsername = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const mentionPattern = new RegExp(`@${escapedUsername}(?=\\s|$)`, 'g');
                    const mentionHtml = `<span class="mention-tag" data-mention-id="${user.id}" style="color: #1976d2; font-weight: 600; background-color: rgba(25, 118, 210, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.95em; display: inline-block;">@${this.escapeHtml(user.username)}</span>`;
                    html = html.replace(mentionPattern, mentionHtml);
                }
            });
            
            return html;
        },
        handleMentionInput(event) {
            const element = event.target;
            const plainText = this.getPlainTextFromDiv(element);
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            const cursorPosition = range ? range.startOffset : 0;
            
            this.newMessage = plainText;
            const usersToRemove = [];
            let textToUpdate = null;
            let shouldUpdateHtml = false;
            
            this.mentionedUsers.forEach(user => {
                const mentionText = `@${user.username}`;
                const fullMentionIndex = plainText.indexOf(mentionText);
                
                let hasCompleteMention = false;
                if (fullMentionIndex !== -1) {
                    const afterMentionChar = plainText.substring(fullMentionIndex + mentionText.length, fullMentionIndex + mentionText.length + 1);
                    if (afterMentionChar === ' ' || afterMentionChar === '' || fullMentionIndex + mentionText.length === plainText.length) {
                        hasCompleteMention = true;
                    }
                }
                
                // 완전한 멘션이 없으면 제거 대상
                if (!hasCompleteMention) {
                    const mentionPattern = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                    if (!mentionPattern.test(plainText)) {
                        usersToRemove.push(user.id);
                        shouldUpdateHtml = true;
                    } else {
                        const atIndex = plainText.lastIndexOf('@');
                        if (atIndex !== -1) {
                            const afterAt = plainText.substring(atIndex + 1);
                            // 사용자 이름의 시작 부분과 일치하는지 확인
                            const usernameStart = user.username.toLowerCase().substring(0, Math.min(afterAt.length, user.username.length));
                            const afterAtLower = afterAt.toLowerCase();
                            
                            // 사용자 이름의 시작 부분과 일치하거나, 사용자 이름이 afterAt으로 시작하는 경우
                            if (usernameStart === afterAtLower || user.username.toLowerCase().startsWith(afterAtLower) || afterAtLower.startsWith(usernameStart)) {
                                // 커서가 멘션 부분에 있거나, 멘션이 불완전한 경우 전체 삭제
                                const mentionEndIndex = atIndex + 1 + afterAt.length;
                                if (cursorPosition >= atIndex && cursorPosition <= mentionEndIndex + 1) {
                                    // @부터 다음 공백까지 삭제
                                    const beforeMention = plainText.substring(0, atIndex);
                                    const afterMention = plainText.substring(mentionEndIndex).replace(/^\s+/, '');
                                    textToUpdate = beforeMention + afterMention;
                                    usersToRemove.push(user.id);
                                    shouldUpdateHtml = true;
                                } else if (afterAt.length < user.username.length) {
                                    // 멘션이 불완전하게 남아있고 커서가 멘션 부분에 있지 않더라도, 멘션의 일부가 남아있으면 전체 삭제
                                    // 단, 커서가 멘션 바로 뒤에 있는 경우에만
                                    if (cursorPosition === mentionEndIndex || cursorPosition === mentionEndIndex + 1) {
                                        const beforeMention = plainText.substring(0, atIndex);
                                        const afterMention = plainText.substring(mentionEndIndex).replace(/^\s+/, '');
                                        textToUpdate = beforeMention + afterMention;
                                        usersToRemove.push(user.id);
                                        shouldUpdateHtml = true;
                                    }
                                }
                            }
                        }
                    }
                }
            });
            
            // mentionedUsers에서 제거
            if (usersToRemove.length > 0) {
                this.mentionedUsers = this.mentionedUsers.filter(u => !usersToRemove.includes(u.id));
            }
            
            // 텍스트 업데이트가 필요한 경우
            if (textToUpdate !== null) {
                this.newMessage = textToUpdate;
                shouldUpdateHtml = true;
            }
            
            // HTML 업데이트
            if (shouldUpdateHtml) {
                this.$nextTick(() => {
                    const html = this.formatMentionsInInput(this.newMessage);
                    element.innerHTML = html;
                    // 커서 위치 복원
                    this.restoreCursorPosition(element, textToUpdate !== null ? textToUpdate.length : cursorPosition);
                });
                return;
            }
            
            // 멘션 하이라이트 업데이트
            this.$nextTick(() => {
                const html = this.formatMentionsInInput(plainText);
                if (element.innerHTML !== html) {
                    const savedCursor = this.saveCursorPosition(element);
                    element.innerHTML = html;
                    this.restoreCursorPosition(element, savedCursor);
                }
            });
            
            // @ 입력 감지하여 멘션 리스트 표시
            const atIndex = plainText.lastIndexOf('@');
            if (atIndex !== -1) {
                const afterAt = plainText.substring(atIndex + 1);
                const hasSpace = afterAt.includes(' ');
                const isCompleteMention = this.mentionedUsers.some(user => {
                    const mentionText = `@${user.username}`;
                    return plainText.substring(atIndex).startsWith(mentionText + ' ') || plainText.substring(atIndex).startsWith(mentionText);
                });
                
                if (!hasSpace && !isCompleteMention) {
                    this.showUserList = true;
                    this.mentionStartIndex = atIndex;
                    this.selectedUserIndex = -1;
                } else {
                    this.showUserList = false;
                    this.selectedUserIndex = -1;
                }
            } else {
                this.showUserList = false;
                this.selectedUserIndex = -1;
            }
            
            // 텍스트에서 멘션이 완전히 제거된 경우 mentionedUsers에서도 제거
            this.mentionedUsers = this.mentionedUsers.filter(user => {
                const regex = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'g');
                return plainText.match(regex);
            });
        },
        saveCursorPosition(element) {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return 0;
            
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            return preCaretRange.toString().length;
        },
        // 커서 위치 복원
        restoreCursorPosition(element, position) {
            const range = document.createRange();
            const selection = window.getSelection();
            let charCount = 0;
            let nodeStack = [element];
            let node, foundStart = false, stop = false;
            
            while (!stop && (node = nodeStack.pop())) {
                if (node.nodeType === 3) {
                    const nextCharCount = charCount + node.textContent.length;
                    if (!foundStart && position >= charCount && position <= nextCharCount) {
                        range.setStart(node, position - charCount);
                        range.setEnd(node, position - charCount);
                        foundStart = true;
                        stop = true;
                    }
                    charCount = nextCharCount;
                } else {
                    let i = node.childNodes.length;
                    while (i--) {
                        nodeStack.push(node.childNodes[i]);
                    }
                }
            }
            
            selection.removeAllRanges();
            selection.addRange(range);
        },
        handleMentionKeydown(event) {
            // 백스페이스 키 처리
            if (event.key === 'Backspace') {
                const element = event.target;
                const selection = window.getSelection();
                if (selection.rangeCount === 0) return;
                
                const range = selection.getRangeAt(0);
                const cursorPosition = this.saveCursorPosition(element);
                const plainText = this.getPlainTextFromDiv(element);
                
                // 커서 앞에 멘션이 있는지 확인
                for (let i = 0; i < this.mentionedUsers.length; i++) {
                    const user = this.mentionedUsers[i];
                    const mentionText = `@${user.username}`;
                    
                    // 커서 위치 기준으로 멘션 확인
                    if (cursorPosition > 0) {
                        const beforeCursor = plainText.substring(0, cursorPosition);
                        const atIndex = beforeCursor.lastIndexOf('@');
                        
                        if (atIndex !== -1) {
                            // @ 이후의 텍스트 확인
                            const afterAt = plainText.substring(atIndex + 1);
                            const spaceIndex = afterAt.indexOf(' ');
                            
                            // 멘션의 예상 끝 위치
                            const expectedMentionEnd = atIndex + 1 + user.username.length;
                            
                            // 커서가 멘션 범위 내에 있는지 확인
                            // 백스페이스를 누르면 한 글자가 지워지므로, 커서 위치가 멘션 끝 바로 뒤거나 멘션 내부에 있으면
                            // 백스페이스 전에는 완전한 멘션이었을 가능성이 높음
                            if (cursorPosition > atIndex && cursorPosition <= expectedMentionEnd + 1) {
                                // 경우 1: 완전한 멘션이 있는 경우 (백스페이스 전 상태)
                                // 커서가 멘션 끝 바로 뒤에 있거나, 멘션 내부에 있는 경우
                                const currentMentionPart = plainText.substring(atIndex + 1, Math.min(cursorPosition, atIndex + 1 + user.username.length));
                                
                                // 현재 텍스트에 완전한 멘션이 있거나, 커서가 멘션 끝 바로 뒤에 있는 경우
                                if (cursorPosition === expectedMentionEnd + 1 || 
                                    (cursorPosition <= expectedMentionEnd && currentMentionPart.length > 0 && 
                                     user.username.toLowerCase().startsWith(currentMentionPart.toLowerCase()))) {
                                    event.preventDefault();
                                    const beforeMention = plainText.substring(0, atIndex);
                                    const afterMention = plainText.substring(expectedMentionEnd).replace(/^\s+/, '');
                                    const newText = beforeMention + afterMention;
                                    
                                    this.newMessage = newText;
                                    this.mentionedUsers = this.mentionedUsers.filter(u => u.id !== user.id);
                                    
                                    this.$nextTick(() => {
                                        const html = this.formatMentionsInInput(newText);
                                        element.innerHTML = html;
                                        this.restoreCursorPosition(element, atIndex);
                                    });
                                    return;
                                }
                            }
                            
                            // 경우 2: 불완전한 멘션 (이미 일부가 지워진 상태)
                            // @ 이후 텍스트가 사용자 이름의 일부인지 확인
                            if (spaceIndex === -1 || spaceIndex > user.username.length) {
                                const mentionPart = spaceIndex !== -1 ? afterAt.substring(0, spaceIndex) : afterAt;
                                
                                // mentionPart가 사용자 이름의 시작 부분과 일치하는지 확인
                                if (mentionPart.length > 0 && user.username.toLowerCase().startsWith(mentionPart.toLowerCase())) {
                                    // 커서가 멘션 부분에 있으면 전체 멘션 삭제
                                    const mentionEndIndex = atIndex + 1 + (spaceIndex !== -1 ? spaceIndex : afterAt.length);
                                    if (cursorPosition > atIndex && cursorPosition <= mentionEndIndex) {
                                        event.preventDefault();
                                        const beforeMention = plainText.substring(0, atIndex);
                                        const afterMention = plainText.substring(mentionEndIndex).replace(/^\s+/, '');
                                        const newText = beforeMention + afterMention;
                                        
                                        this.newMessage = newText;
                                        this.mentionedUsers = this.mentionedUsers.filter(u => u.id !== user.id);
                                        
                                        this.$nextTick(() => {
                                            const html = this.formatMentionsInInput(newText);
                                            element.innerHTML = html;
                                            this.restoreCursorPosition(element, atIndex);
                                        });
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // 멘션 리스트가 표시되고 있을 때만 키보드 네비게이션 처리
            if (!this.showUserList || this.filteredUserList.length === 0) {
                return;
            }
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.selectedUserIndex = (this.selectedUserIndex + 1) % this.filteredUserList.length;
                    this.$nextTick(() => {
                        const userListElement = document.querySelector('.user-list');
                        if (userListElement) {
                            const selectedElement = userListElement.children[this.selectedUserIndex];
                            if (selectedElement) {
                                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                        }
                    });
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (this.selectedUserIndex <= 0) {
                        this.selectedUserIndex = this.filteredUserList.length - 1;
                    } else {
                        this.selectedUserIndex--;
                    }
                    this.$nextTick(() => {
                        const userListElement = document.querySelector('.user-list');
                        if (userListElement) {
                            const selectedElement = userListElement.children[this.selectedUserIndex];
                            if (selectedElement) {
                                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                        }
                    });
                    break;
                case 'Enter':
                    if (this.selectedUserIndex >= 0 && this.selectedUserIndex < this.filteredUserList.length) {
                        event.preventDefault();
                        this.selectUser(this.filteredUserList[this.selectedUserIndex]);
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.showUserList = false;
                    this.selectedUserIndex = -1;
                    break;
            }
        },
        // Enter 키 처리
        handleEnterKey(event) {
            if (!event.shiftKey) {
                this.beforeSend();
            }
        },
        handleTextareaInput(event) {
            const text = event.target.value;
            const textarea = event.target;
            const cursorPosition = textarea.selectionStart;
            
            // @ 입력 감지하여 멘션 리스트 표시
            const atIndex = text.lastIndexOf('@');
            if (atIndex !== -1) {
                // @ 다음에 공백이 없고, 이미 완성된 멘션이 아닌 경우에만 리스트 표시
                const afterAt = text.substring(atIndex + 1);
                const hasSpace = afterAt.includes(' ');
                
                // mentionedUsers에 있는 사용자 이름과 일치하는지 확인
                const isCompleteMention = this.mentionedUsers.some(user => {
                    const mentionText = `@${user.username}`;
                    return text.substring(atIndex).startsWith(mentionText + ' ') || text.substring(atIndex).startsWith(mentionText);
                });
                
                if (!hasSpace && !isCompleteMention) {
                    this.showUserList = true;
                    this.mentionStartIndex = atIndex;
                    this.selectedUserIndex = -1;
                } else {
                    this.showUserList = false;
                    this.selectedUserIndex = -1;
                }
            } else {
                this.showUserList = false;
                this.selectedUserIndex = -1;
            }

            if (text.startsWith('>') || text.startsWith('!')) {
                // 명령어 목록 표시 로직 추가
            }
            
            // 사용자가 직접 입력하는 경우 히스토리 인덱스 초기화
            // if (this.messageHistoryIndex !== -1 && text !== this.myMessages[this.messageHistoryIndex]?.content) {
            //     this.resetMessageHistory();
            // }
        },
        selectUser(user) {
            // 입력창에서 @ 부분 제거 (멘션 텍스트는 입력창에 표시하지 않음)
            const beforeMention = this.newMessage.substring(0, this.mentionStartIndex);
            const afterMention = this.newMessage.substring(this.mentionStartIndex);
            // @ 다음 공백까지 제거
            const spaceIndex = afterMention.indexOf(' ');
            if (spaceIndex !== -1) {
                this.newMessage = beforeMention + afterMention.substring(spaceIndex + 1);
            } else {
                this.newMessage = beforeMention;
            }
            
            this.showUserList = false;
            this.selectedUserIndex = -1;
            
            // Mention된 유저의 정보를 mentionedUsers 배열에만 추가 (입력창에는 텍스트 표시 안함)
            if (!this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id)) {
                this.mentionedUsers.push(user);
            }
        },
        // 멘션 제거 메서드
        removeMention(userId) {
            // mentionedUsers에서만 제거 (입력창에는 멘션 텍스트가 없으므로 텍스트 수정 불필요)
            this.mentionedUsers = this.mentionedUsers.filter(u => u.id !== userId);
        },
        handleKeydown(event) {
            // 멘션 리스트가 표시되고 있을 때만 키보드 네비게이션 처리
            if (!this.showUserList || this.filteredUserList.length === 0) {
                return;
            }
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.selectedUserIndex = (this.selectedUserIndex + 1) % this.filteredUserList.length;
                    // 선택된 항목이 보이도록 스크롤
                    this.$nextTick(() => {
                        const userListElement = document.querySelector('.user-list');
                        if (userListElement) {
                            const selectedElement = userListElement.children[this.selectedUserIndex];
                            if (selectedElement) {
                                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                        }
                    });
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (this.selectedUserIndex <= 0) {
                        this.selectedUserIndex = this.filteredUserList.length - 1;
                    } else {
                        this.selectedUserIndex--;
                    }
                    // 선택된 항목이 보이도록 스크롤
                    this.$nextTick(() => {
                        const userListElement = document.querySelector('.user-list');
                        if (userListElement) {
                            const selectedElement = userListElement.children[this.selectedUserIndex];
                            if (selectedElement) {
                                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                        }
                    });
                    break;
                case 'Enter':
                    // Enter 키는 기본 동작(메시지 전송)을 막지 않지만, 선택된 사용자가 있으면 선택
                    if (this.selectedUserIndex >= 0 && this.selectedUserIndex < this.filteredUserList.length) {
                        event.preventDefault();
                        this.selectUser(this.filteredUserList[this.selectedUserIndex]);
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.showUserList = false;
                    this.selectedUserIndex = -1;
                    break;
            }
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
            if (message.role == 'agent') {
                return message.profile ? message.profile : '/images/chat-icon.png';
            }
            if (!this.userList) return '/images/defaultUser.png';
            const user = this.userList.find(user => user.email === message.email);
            return user && user.profile ? (user.profile.includes('defaultUser.png') ? '/images/defaultUser.png' : user.profile) : '/images/defaultUser.png';
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
            
            const mentionedAgent = this.mentionedUsers.find(user => user.is_agent);
            
            if (mentionedAgent) {
                this.isSending = true;
                const messageText = this.newMessage;
                
                // 멘션된 사용자들을 메시지 텍스트 앞에 추가
                let fullMessageText = messageText;
                if (this.mentionedUsers && this.mentionedUsers.length > 0) {
                    const mentionText = this.mentionedUsers.map(user => `@${user.username}`).join(' ');
                    fullMessageText = mentionText + (messageText ? ' ' + messageText : '');
                }
                
                const cleanMessage = messageText.replace(/@[^\s@]+\s*/g, '').trim();
                
                if (fullMessageText.length > 0 || this.attachedImages.length > 0) {
                    this.$emit('sendMessage', {
                        images: this.attachedImages,
                        text: fullMessageText,
                        mentionedUsers: this.mentionedUsers
                    });
                    
                    this.attachedImages = [];
                }
                
                const agentMessage = cleanMessage || messageText;
                this.$emit('requestDraftAgent', agentMessage, mentionedAgent);
                
                setTimeout(() => {
                    this.newMessage = "";
                    this.mentionedUsers = [];
                    this.showUserList = false;
                    this.isSending = false;
                }, 100);
                return;
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
                if (copyMsg.length > 0 || this.attachedImages.length > 0) {
                    this.isSending = true;
                    this.send();
                }
            }
        },
        async send() {
            if (this.editIndex >= 0) {
                this.$emit('sendEditedMessage', this.editIndex + 1);
                this.editIndex = -1;
            } else {
                // 멘션된 사용자들을 메시지 텍스트 앞에 추가
                let messageText = this.newMessage;
                if (this.mentionedUsers && this.mentionedUsers.length > 0) {
                    const mentionText = this.mentionedUsers.map(user => `@${user.username}`).join(' ');
                    messageText = mentionText + (messageText ? ' ' + messageText : '');
                }
                
                if (this.definitionMapOnlyInput) {
                    this.$emit('sendMessage', {
                        images: this.attachedImages,
                        text: messageText,
                        mentionedUsers: this.mentionedUsers
                    });

                } else {
                    this.$emit('sendMessage', {
                        images: this.attachedImages,
                        text: messageText,
                        mentionedUsers: this.mentionedUsers
                    });
                }
            }
            if (this.isReply) this.isReply = false;
            this.attachedImages = [];
            this.delImgBtn = false;
            this.isAtBottom = true
            setTimeout(() => {
                if(!this.definitionMapOnlyInput) {
                    this.newMessage = "";
                    this.mentionedUsers = [];
                    this.showUserList = false;
                    // this.resetMessageHistory(); // 메시지 전송 후 히스토리 초기화
                }
                this.isSending = false;
            }, 100);
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
            const imageFile = e.target.files[0];
            
            if (window.location.hostname !== 'localhost') {
                const fileName = `uploads/${Date.now()}_${imageFile.name}`;
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
            
            // 이메일(보낸사람)이 다르면 true 반환
            if (prevMessage && message.email !== prevMessage.email) return true;
            
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
        // LLM 답변을 기다리는 상태인지 확인 (개입이 통과된 경우에만)
        isWaitingForLLMResponse(message, index) {
            // 개입 정보가 있고 should_intervene이 true인 경우만 확인
            if (message.jsonContent && message.jsonContent.intervention) {
                const intervention = message.jsonContent.intervention;
                
                // 개입이 통과되지 않은 경우는 false
                if (!intervention.should_intervene) {
                    return false;
                }
                
                const status = intervention.status;
                
                // completed 상태면 LLM 응답이 완료된 것이므로 false
                if (status === 'completed') {
                    return false;
                }
                
                // checking 또는 intervening 상태면 대기 중
                if (status === 'checking' || status === 'intervening') {
                    return true;
                }
                
                // status가 없거나 다른 상태인 경우 (하위 호환성)
                // 다음 메시지 확인
                const nextMessage = index < this.filteredMessages.length - 1 ? this.filteredMessages[index + 1] : null;
                
                // 다음 메시지가 없거나, system/agent role의 답변이 아직 없는 경우
                if (!nextMessage || (nextMessage.role !== 'system' && nextMessage.role !== 'agent')) {
                    return true;
                }
                
                // 다음 메시지가 system/agent이지만 내용이 비어있거나 로딩 중인 경우
                if ((nextMessage.role === 'system' || nextMessage.role === 'agent') && 
                    (!nextMessage.content || nextMessage.content.trim() === '' || nextMessage.isLoading)) {
                    return true;
                }
                
                // 다음 메시지가 system/agent이고 내용이 있으면 응답 완료
                return false;
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

@keyframes pulse {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
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

.my-message {
  margin-left: auto;
  background-color: rgb(var(--v-theme-primary), 0.15) !important;
  border-radius: 15px 3px 15px 15px !important;
}

.other-message {
  margin-right: auto;
  border-radius: 8px !important;
  background-color: #f5f5f5 !important;
}

.agent-message {
  margin-right: auto;
  background-color: transparent !important;
  border-radius: 8px !important;
}

.message-timestamp {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
  margin-top: 4px;
  display: inline-block;
  position: absolute;
  bottom: 5px;
}

.my-timestamp {
    bottom: 1px;
    left: -35px;
}

.other-timestamp {
    right: -35px;
    bottom: 1px;
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

// 개입 정보 스타일
.intervention-info {
    transition: all 0.3s ease;
    
    &.intervention-yes {
        background-color: rgba(76, 175, 80, 0.1);
        border: 1px solid rgba(76, 175, 80, 0.3);
    }
    
    &.intervention-no {
        background-color: rgba(158, 158, 158, 0.1);
        border: 1px solid rgba(158, 158, 158, 0.3);
    }
}

// 개입 정보 배지 (접힌 상태)
.intervention-badge {
    transition: all 0.2s ease;
    
    &:hover {
        opacity: 0.8;
        transform: translateY(-1px);
    }
    
    &.intervention-yes {
        background-color: rgba(76, 175, 80, 0.15);
        border: 1px solid rgba(76, 175, 80, 0.4);
        color: #2e7d32;
    }
    
    &.intervention-no {
        background-color: rgba(158, 158, 158, 0.15);
        border: 1px solid rgba(158, 158, 158, 0.4);
        color: #616161;
    }
}

// system/agent 메시지 배지 (접힌 상태)
.system-message-badge {
    transition: all 0.2s ease;
    
    &:hover {
        opacity: 0.8;
        transform: translateY(-1px);
        background-color: rgba(25, 118, 210, 0.15) !important;
    }
}

// 개입 대기 중 메시지 카드 시각적 효과
.intervention-pending {
    border: 2px solid rgba(76, 175, 80, 0.5) !important;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3) !important;
    animation: intervention-glow 2s ease-in-out infinite;
}

.intervention-pulse-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, 
        transparent, 
        rgba(76, 175, 80, 0.15), 
        transparent
    );
    animation: pulse-sweep 2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
}

@keyframes intervention-glow {
    0%, 100% {
        box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
    }
    50% {
        box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
    }
}

@keyframes pulse-sweep {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}

// 프로세스 생성 버튼 hover 영역
.process-create-hover-area {
    position: sticky;
    top: 0;
    width: 100%;
    height: 50px;
    z-index: 100;
    pointer-events: auto;
    margin-bottom: -50px; /* 실제 공간 차지하지 않도록 */
}

.process-create-button-container {
    position: sticky;
    top: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    z-index: 101;
    pointer-events: none;
}

.process-create-btn {
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
}

// 버튼 나타나는 애니메이션
.slide-down-enter-active {
    transition: all 0.3s ease-out;
}

.slide-down-leave-active {
    transition: all 0.2s ease-in;
}

.slide-down-enter-from {
    opacity: 0;
    transform: translateY(-20px);
}

.slide-down-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>

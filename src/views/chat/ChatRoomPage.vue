<template>
    <v-card elevation="10" class="is-work-height chat-room-page-card">
        <div class="chat-room-page">
            <div v-if="!roomId && !userId && !isAnyDraftContextView" class="empty-state">
                <v-icon size="40" color="grey-lighten-1">mdi-message-text-outline</v-icon>
                <div class="text-subtitle-1 mt-2">대화를 선택해주세요</div>
                <div class="text-caption text-medium-emphasis">좌측 사이드바의 대화목록에서 대화를 선택하거나 새 대화를 만들어주세요.</div>
            </div>

            <div v-else-if="isLoadingRoom" class="loading-state">
                <v-progress-circular indeterminate color="primary" :size="28" />
                <span class="ml-2 text-caption">채팅을 불러오는 중...</span>
            </div>

            <div v-else-if="roomId" class="chat-container">
                <div class="chat-body">
                    <div class="chat-main">
                        <div class="messages-area">
                            <div class="header-bar">
                                <div class="header-left">
                                    <div class="avatar-wrap">
                                        <template v-if="displayParticipants.length === 1">
                                            <v-avatar size="28" color="grey-lighten-3">
                                                <img
                                                    :src="getParticipantProfile(displayParticipants[0])"
                                                    :alt="getParticipantAlt(displayParticipants[0])"
                                                    class="avatar-img"
                                                />
                                            </v-avatar>
                                        </template>
                                        <template v-else>
                                            <v-avatar size="28" color="grey-lighten-3">
                                                <div class="avatar-grid">
                                                    <div
                                                        v-for="(p, idx) in displayParticipants.slice(0, 4)"
                                                        :key="(p && (p.id || p.email)) || idx"
                                                        class="avatar-grid__cell"
                                                    >
                                                        <img
                                                            :src="getParticipantProfile(p)"
                                                            :alt="getParticipantAlt(p)"
                                                            class="avatar-img"
                                                        />
                                                    </div>
                                                </div>
                                            </v-avatar>
                                        </template>
                                    </div>
                                    <div class="header-title">
                                        <div class="room-name">{{ currentChatRoom?.name || $t('chatListing.chat') }}</div>
                                        <div class="room-subtitle text-caption text-medium-emphasis d-flex align-center" style="gap: 8px">
                                            <v-btn
                                                variant="text"
                                                density="compact"
                                                class="participants-summary-btn"
                                                @click="openParticipantsView"
                                            >
                                                <v-icon size="16" class="mr-1">mdi-account-multiple</v-icon>
                                                <span class="participants-count">{{ (currentChatRoom?.participants || []).length }}</span>
                                                <v-icon v-if="hasAgentFailure" size="16" color="error" class="ml-1">mdi-alert</v-icon>
                                            </v-btn>
                                            <span
                                                v-if="participantsPreviewText"
                                                class="participants-preview"
                                                role="button"
                                                tabindex="0"
                                                :title="participantsPreviewTooltip"
                                                @click="openParticipantsView"
                                                @keydown.enter.stop.prevent="openParticipantsView"
                                                @keydown.space.stop.prevent="openParticipantsView"
                                            >
                                                {{ participantsPreviewText }}
                                            </span>
                                            <!-- 에이전트 연결중(웜업) 표시: 참가자 옆 원형 로딩 -->
                                            <template v-if="hasAgentWarming">
                                                <v-progress-circular indeterminate color="primary" :size="14" :width="2" />
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <div class="header-right">
                                    <v-btn
                                        v-if="hasArtifactPanel"
                                        icon
                                        variant="text"
                                        density="comfortable"
                                        size="small"
                                        :color="artifactSidebarVisible ? 'primary' : undefined"
                                        @click="toggleArtifactSidebar"
                                    >
                                        <v-icon size="18">mdi-file-document-outline</v-icon>
                                    </v-btn>
                                    <v-menu v-model="settingsMenu" location="bottom end" :close-on-content-click="true">
                                        <template v-slot:activator="{ props }">
                                            <v-btn v-bind="props" icon variant="text" density="comfortable" size="small">
                                                <v-icon size="18">mdi-cog-outline</v-icon>
                                            </v-btn>
                                        </template>
                                        <v-card min-width="260" class="pa-2">
                                            <div class="text-caption text-medium-emphasis px-2 pt-1 pb-1">
                                                {{ $t('chatListing.setting') || '설정' }}
                                            </div>
                                            <v-list density="compact" class="pa-0">
                                                <v-list-item @click="openRenameDialog">
                                                    <template v-slot:prepend>
                                                        <v-icon size="18">mdi-pencil-outline</v-icon>
                                                    </template>
                                                    <v-list-item-title>
                                                        {{ $t('chatListing.chatRoomName') || '채팅방 이름 변경' }}
                                                    </v-list-item-title>
                                                </v-list-item>
                                                <v-list-item @click="openParticipantsDialog">
                                                    <template v-slot:prepend>
                                                        <v-icon size="18">mdi-account-multiple-plus-outline</v-icon>
                                                    </template>
                                                    <v-list-item-title>
                                                        {{ $t('chatListing.selectParticipants') || '참여자 변경' }}
                                                    </v-list-item-title>
                                                </v-list-item>
                                                <v-list-item @click="openToolsSettingsDialog">
                                                    <template v-slot:prepend>
                                                        <v-icon size="18">mdi-tune-variant</v-icon>
                                                    </template>
                                                    <v-list-item-title>
                                                        {{ $t('chatListing.toolsSettings') || '도구 설정' }}
                                                    </v-list-item-title>
                                                </v-list-item>
                                                <v-divider class="my-1" />
                                                <v-list-item @click="openDeleteConfirm">
                                                    <template v-slot:prepend>
                                                        <v-icon size="18" color="error">mdi-delete-outline</v-icon>
                                                    </template>
                                                    <v-list-item-title class="text-error">
                                                        {{ $t('chatListing.delete') || '삭제' }}
                                                    </v-list-item-title>
                                                </v-list-item>
                                            </v-list>
                                        </v-card>
                                    </v-menu>
                                </div>
                            </div>
                            <v-divider class="header-divider" />

                            <Chat
                                ref="chatView"
                                :messages="displayMessages"
                                :userInfo="userInfo"
                                :userList="userList"
                                :currentChatRoom="currentChatRoom"
                                :chatRoomId="roomId || ''"
                                type="chats"
                                :disableChat="false"
                                :markdownEnabled="false"
                                :chatRoomMode="true"
                                :hideInput="true"
                                :pdf2bpmnProgress="currentPdf2bpmnProgress"
                                :processGenerationProgress="currentProcessGenerationProgress"
                                :pendingHumanFeedback="pendingHumanFeedback"
                                @preview-bpmn="showBpmnPreview"
                                @save-generated-process="handleSaveGeneratedProcess"
                                @preview-integrated-graph="showIntegratedGraphByTask"
                                @preview-image="openImagePreview"
                                @open-external-url="openExternalUrl"
                                @openui-action="handleOpenUiAction"
                                @openui-state-update="handleOpenUiStateUpdate"
                                @openui-parse-result="handleOpenUiParseResult"
                                @beforeReply="handleBeforeReply"
                                @invite-agent="handleInviteAgent"
                                @getMoreChat="loadMoreMessages"
                                @human-feedback-submit="handleHumanFeedbackSubmit"
                                @human-feedback-skip="handleHumanFeedbackSkip"
                                @sendMessage="handleSendMessage"
                            />
                        </div>

                        <!-- 입력 영역 -->
                        <div class="input-area">
                            <!-- 음성 상태 바 (공용 컴포넌트가 위에서 렌더링) -->
                            <div v-if="isDesktopVoiceActive" class="voice-mode-bar" :class="{ 'is-error': voiceStatus === 'error' }">
                                <div
                                    class="voice-pulse-dot"
                                    :class="{
                                        'is-speaking': voiceUserSpeaking,
                                        'is-responding': voiceStatus === 'responding',
                                        'is-playing': voiceStatus === 'playing',
                                        'is-connecting': voiceStatus === 'connecting',
                                        'is-error': voiceStatus === 'error'
                                    }"
                                ></div>
                                <span class="voice-status-label" :class="{ 'is-error-text': voiceStatus === 'error' }">
                                    <template v-if="voiceStatus === 'error'">서버에 연결할 수 없습니다</template>
                                    <template v-else-if="voiceStatus === 'connecting'">서버 연결 중...</template>
                                    <template v-else-if="voiceStatus === 'playing'">AI 말하는 중...</template>
                                    <template v-else-if="voiceStatus === 'responding'">AI 응답 생성 중...</template>
                                    <template v-else-if="voiceUserSpeaking">음성 인식 중...</template>
                                    <template v-else>음성 대기 중 — 말씀해 주세요</template>
                                </span>
                                <v-btn icon variant="text" density="compact" size="small" class="ml-auto" @click="stopDesktopVoice">
                                    <v-icon size="16">mdi-close</v-icon>
                                </v-btn>
                            </div>
                            <UnifiedChatInput
                                ref="composer"
                                variant="inline"
                                :showExamples="false"
                                :disableChat="false"
                                :showStopButton="hasAbortableStream"
                                :deferFileUploadToParent="true"
                                :userList="userList"
                                :currentChatRoom="currentChatRoom"
                                :desktopVoiceActive="isDesktopVoiceActive"
                                :enableDesktopVoice="isVoiceEnabled"
                                :enableKnowledgeBase="true"
                                :knowledgeDocs="selectedKnowledgeDocs"
                                @update:knowledgeDocs="onKnowledgeDocsUpdate"
                                @sendMessage="handleSendMessage"
                                @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
                                @desktop-voice-toggle="toggleDesktopVoice"
                            />
                        </div>
                    </div>

                    <div
                        v-if="hasArtifactPanel && artifactSidebarVisible"
                        class="right-sidebar is-open"
                        :style="{ width: `${artifactSidebarWidth}px` }"
                    >
                        <div class="right-sidebar__resizer" @mousedown.prevent="startArtifactSidebarResize"></div>
                        <ArtifactPanel
                            ref="artifactPanel"
                            :panels="artifactPanels"
                            :activeId="activeArtifactId"
                            @update:activeId="activeArtifactId = $event"
                            @close="closeArtifactSidebar"
                            @close-panel="closeArtifactPanel"
                            @panel-action="handleArtifactAction"
                        />
                    </div>
                </div>
            </div>

            <div v-else-if="userId" class="chat-container">
                <div v-if="isLoadingTargetUser" class="loading-state">
                    <v-progress-circular indeterminate color="primary" :size="28" />
                    <span class="ml-2 text-caption">{{ $t('chatListing.loadingUserInfo') }}</span>
                </div>

                <template v-else-if="targetUser">
                    <div class="messages-area">
                        <div class="header-bar">
                            <div class="header-left">
                                <div class="avatar-wrap">
                                    <v-avatar size="28" color="grey-lighten-3">
                                        <img
                                            :src="getParticipantProfile(targetUser)"
                                            :alt="getParticipantAlt(targetUser)"
                                            class="avatar-img"
                                        />
                                    </v-avatar>
                                </div>
                                <div class="header-title">
                                    <div class="room-name">{{ draftName || $t('chatListing.newChat') }}</div>
                                    <div class="room-subtitle text-caption text-medium-emphasis">
                                        {{ targetUser?.username || targetUser?.email || $t('chatListing.defaultUser') }}
                                    </div>
                                </div>
                            </div>
                            <div class="header-right">
                                <v-menu v-model="settingsMenu" location="bottom end" :close-on-content-click="true">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" density="comfortable" size="small">
                                            <v-icon size="18">mdi-cog-outline</v-icon>
                                        </v-btn>
                                    </template>
                                    <v-card min-width="260" class="pa-2">
                                        <div class="text-caption text-medium-emphasis px-2 pt-1 pb-1">
                                            {{ $t('chatListing.setting') }}
                                        </div>
                                        <v-list density="compact" class="pa-0">
                                            <v-list-item @click="openRenameDialog">
                                                <template v-slot:prepend>
                                                    <v-icon size="18">mdi-pencil-outline</v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ $t('chatListing.renameChatRoom') }}
                                                </v-list-item-title>
                                            </v-list-item>
                                            <v-list-item @click="openParticipantsDialog">
                                                <template v-slot:prepend>
                                                    <v-icon size="18">mdi-account-multiple-plus-outline</v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ $t('chatListing.changeParticipants') }}
                                                </v-list-item-title>
                                            </v-list-item>
                                            <v-list-item @click="openToolsSettingsDialog">
                                                <template v-slot:prepend>
                                                    <v-icon size="18">mdi-tune-variant</v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ $t('chatListing.toolsSettings') || '도구 설정' }}
                                                </v-list-item-title>
                                            </v-list-item>
                                        </v-list>
                                    </v-card>
                                </v-menu>
                            </div>
                        </div>
                        <v-divider class="header-divider" />

                        <Chat
                            ref="chatView"
                            :messages="displayMessages"
                            :userInfo="userInfo"
                            :userList="userList"
                            :currentChatRoom="draftUserContextRoom"
                            :chatRoomId="''"
                            type="chats"
                            :disableChat="false"
                            :markdownEnabled="false"
                            :chatRoomMode="true"
                            :hideInput="true"
                            :pdf2bpmnProgress="currentPdf2bpmnProgress"
                            :processGenerationProgress="currentProcessGenerationProgress"
                            :pendingHumanFeedback="pendingHumanFeedback"
                            @preview-bpmn="showBpmnPreview"
                            @preview-integrated-graph="showIntegratedGraphByTask"
                            @preview-image="openImagePreview"
                            @open-external-url="openExternalUrl"
                            @openui-action="handleOpenUiAction"
                            @openui-state-update="handleOpenUiStateUpdate"
                            @openui-parse-result="handleOpenUiParseResult"
                            @beforeReply="handleBeforeReply"
                            @invite-agent="handleInviteAgent"
                            @getMoreChat="loadMoreMessages"
                            @human-feedback-submit="handleHumanFeedbackSubmit"
                            @human-feedback-skip="handleHumanFeedbackSkip"
                            @sendMessage="handleSendMessage"
                        />
                    </div>

                    <div class="input-area">
                        <div v-if="isDesktopVoiceActive" class="voice-mode-bar" :class="{ 'is-error': voiceStatus === 'error' }">
                            <div
                                class="voice-pulse-dot"
                                :class="{
                                    'is-speaking': voiceUserSpeaking,
                                    'is-responding': voiceStatus === 'responding',
                                    'is-playing': voiceStatus === 'playing',
                                    'is-connecting': voiceStatus === 'connecting',
                                    'is-error': voiceStatus === 'error'
                                }"
                            ></div>
                            <span class="voice-status-label" :class="{ 'is-error-text': voiceStatus === 'error' }">
                                <template v-if="voiceStatus === 'error'">서버에 연결할 수 없습니다</template>
                                <template v-else-if="voiceStatus === 'connecting'">서버 연결 중...</template>
                                <template v-else-if="voiceStatus === 'playing'">AI 말하는 중...</template>
                                <template v-else-if="voiceStatus === 'responding'">AI 응답 생성 중...</template>
                                <template v-else-if="voiceUserSpeaking">음성 인식 중...</template>
                                <template v-else>음성 대기 중 — 말씀해 주세요</template>
                            </span>
                            <v-btn icon variant="text" density="compact" size="small" class="ml-auto" @click="stopDesktopVoice">
                                <v-icon size="16">mdi-close</v-icon>
                            </v-btn>
                        </div>
                        <UnifiedChatInput
                            ref="composer"
                            variant="inline"
                            :showExamples="false"
                            :disableChat="false"
                            :showStopButton="hasAbortableStream"
                            :deferFileUploadToParent="true"
                            :userList="userList"
                            :currentChatRoom="draftUserContextRoom"
                            :desktopVoiceActive="isDesktopVoiceActive"
                            :enableDesktopVoice="isVoiceEnabled"
                            @sendMessage="handleSendMessageUserContextDraft"
                            @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
                            @desktop-voice-toggle="toggleDesktopVoice"
                        />
                    </div>
                </template>

                <div v-else class="empty-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-account-outline</v-icon>
                    <div class="text-subtitle-1 mt-2">유저 정보를 찾을 수 없습니다</div>
                </div>
            </div>

            <div v-else-if="isDraftContextView" class="chat-container">
                <div class="messages-area">
                    <div class="header-bar">
                        <div class="header-left">
                            <div class="avatar-wrap">
                                <v-avatar size="28" color="grey-lighten-3">
                                    <img
                                        :src="getParticipantProfile(contextAgent)"
                                        :alt="getParticipantAlt(contextAgent)"
                                        class="avatar-img"
                                    />
                                </v-avatar>
                            </div>
                            <div class="header-title">
                                <div class="room-name">{{ draftName || $t('chatListing.newChat') }}</div>
                                <div class="room-subtitle text-caption text-medium-emphasis">
                                    {{ contextAgent?.username || contextAgent?.email || contextAgentId }}
                                </div>
                            </div>
                        </div>
                        <div class="header-right">
                            <v-menu v-model="settingsMenu" location="bottom end" :close-on-content-click="true">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" density="comfortable" size="small">
                                        <v-icon size="18">mdi-cog-outline</v-icon>
                                    </v-btn>
                                </template>
                                <v-card min-width="260" class="pa-2">
                                    <div class="text-caption text-medium-emphasis px-2 pt-1 pb-1">
                                        {{ $t('chatListing.setting') || '설정' }}
                                    </div>
                                    <v-list density="compact" class="pa-0">
                                        <v-list-item @click="openRenameDialog">
                                            <template v-slot:prepend>
                                                <v-icon size="18">mdi-pencil-outline</v-icon>
                                            </template>
                                            <v-list-item-title>
                                                {{ $t('chatListing.chatRoomName') || '채팅방 이름 변경' }}
                                            </v-list-item-title>
                                        </v-list-item>
                                        <v-list-item @click="openParticipantsDialog">
                                            <template v-slot:prepend>
                                                <v-icon size="18">mdi-account-multiple-plus-outline</v-icon>
                                            </template>
                                            <v-list-item-title>
                                                {{ $t('chatListing.selectParticipants') || '참여자 변경' }}
                                            </v-list-item-title>
                                        </v-list-item>
                                        <v-list-item @click="openToolsSettingsDialog">
                                            <template v-slot:prepend>
                                                <v-icon size="18">mdi-tune-variant</v-icon>
                                            </template>
                                            <v-list-item-title>
                                                {{ $t('chatListing.toolsSettings') || '도구 설정' }}
                                            </v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-card>
                            </v-menu>
                        </div>
                    </div>
                    <v-divider class="header-divider" />

                    <Chat
                        ref="chatView"
                        :messages="displayMessages"
                        :userInfo="userInfo"
                        :userList="userList"
                        :currentChatRoom="draftContextRoom"
                        :chatRoomId="''"
                        type="chats"
                        :disableChat="false"
                        :markdownEnabled="false"
                        :chatRoomMode="true"
                        :hideInput="true"
                        :pdf2bpmnProgress="currentPdf2bpmnProgress"
                        :processGenerationProgress="currentProcessGenerationProgress"
                        :pendingHumanFeedback="pendingHumanFeedback"
                        @preview-bpmn="showBpmnPreview"
                        @preview-integrated-graph="showIntegratedGraphByTask"
                        @preview-image="openImagePreview"
                        @open-external-url="openExternalUrl"
                        @openui-action="handleOpenUiAction"
                        @openui-state-update="handleOpenUiStateUpdate"
                        @openui-parse-result="handleOpenUiParseResult"
                        @beforeReply="handleBeforeReply"
                        @invite-agent="handleInviteAgent"
                        @getMoreChat="loadMoreMessages"
                        @human-feedback-submit="handleHumanFeedbackSubmit"
                        @human-feedback-skip="handleHumanFeedbackSkip"
                    />
                </div>

                <div class="input-area">
                    <div v-if="isDesktopVoiceActive" class="voice-mode-bar" :class="{ 'is-error': voiceStatus === 'error' }">
                        <div
                            class="voice-pulse-dot"
                            :class="{
                                'is-speaking': voiceUserSpeaking,
                                'is-responding': voiceStatus === 'responding',
                                'is-playing': voiceStatus === 'playing',
                                'is-connecting': voiceStatus === 'connecting',
                                'is-error': voiceStatus === 'error'
                            }"
                        ></div>
                        <span class="voice-status-label" :class="{ 'is-error-text': voiceStatus === 'error' }">
                            <template v-if="voiceStatus === 'error'">서버에 연결할 수 없습니다</template>
                            <template v-else-if="voiceStatus === 'connecting'">서버 연결 중...</template>
                            <template v-else-if="voiceStatus === 'playing'">AI 말하는 중...</template>
                            <template v-else-if="voiceStatus === 'responding'">AI 응답 생성 중...</template>
                            <template v-else-if="voiceUserSpeaking">음성 인식 중...</template>
                            <template v-else>음성 대기 중 — 말씀해 주세요</template>
                        </span>
                        <v-btn icon variant="text" density="compact" size="small" class="ml-auto" @click="stopDesktopVoice">
                            <v-icon size="16">mdi-close</v-icon>
                        </v-btn>
                    </div>
                    <UnifiedChatInput
                        ref="composer"
                        variant="inline"
                        :showExamples="false"
                        :disableChat="false"
                        :showStopButton="hasAbortableStream"
                        :deferFileUploadToParent="true"
                        :userList="userList"
                        :currentChatRoom="draftContextRoom"
                        :desktopVoiceActive="isDesktopVoiceActive"
                        :enableDesktopVoice="isVoiceEnabled"
                        @sendMessage="handleSendMessageContextDraft"
                        @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
                        @desktop-voice-toggle="toggleDesktopVoice"
                    />
                </div>
            </div>

            <!-- 음성 에이전트 (단일 인스턴스: 뷰 전환 시에도 유지) -->
            <VoiceAgentDesktopMode
                :active="isDesktopVoiceActive"
                :chatRoomId="currentChatRoom?.id || ''"
                :agentInfo="currentVoiceAgentInfo"
                :conversationHistory="currentVoiceHistory"
                @user-transcript="onVoiceUserTranscript"
                @ai-transcript-delta="onVoiceAiDelta"
                @ai-transcript-done="onVoiceAiDone"
                @speaking-start="voiceUserSpeaking = true"
                @speaking-stop="
                    voiceUserSpeaking = false;
                    voiceStatus = 'responding';
                "
                @ai-audio-start="voiceStatus = 'playing'"
                @ai-audio-stop="voiceStatus = 'listening'"
                @ai-interrupted="onVoiceAiInterrupted"
                @started="voiceStatus = 'listening'"
                @stopped="
                    voiceStatus = 'idle';
                    voiceUserSpeaking = false;
                "
                @error="onVoiceError"
            />
        </div>

        <!-- 참여자 보기 -->
        <v-dialog v-model="participantsViewDialog" max-width="520">
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('chat.participants') || '참여자' }}
                        <span class="text-caption text-medium-emphasis ml-2">
                            {{ (currentChatRoom?.participants || []).length }}
                        </span>
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="participantsViewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    <v-list density="compact" class="pa-0">
                        <v-list-item v-for="(p, idx) in participantUsersForView" :key="(p && (p.id || p.email)) || idx">
                            <template v-slot:prepend>
                                <v-avatar size="28" color="grey-lighten-3">
                                    <img :src="getParticipantProfile(p)" :alt="getParticipantAlt(p)" class="avatar-img" />
                                </v-avatar>
                            </template>
                            <v-list-item-title>{{ p.username || p.name || p.email || p.id }}</v-list-item-title>
                            <v-list-item-subtitle>{{ p.email || (p.id ? 'ID: ' + p.id : '') }}</v-list-item-subtitle>
                            <template v-slot:append>
                                <v-chip
                                    v-if="defaultSetting?.getAgentById?.(p.id) || p.agent_type === 'agent' || p.is_agent === true"
                                    size="x-small"
                                    :color="statusColor(getAgentStatus(p.id).state)"
                                    variant="tonal"
                                >
                                    {{ statusLabel(getAgentStatus(p.id).state) }}
                                </v-chip>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- 이름 변경 -->
        <v-dialog v-model="renameDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('chatListing.chatRoomName') || '채팅방 이름' }}
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="renameDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    <v-text-field
                        v-model="renameDraft"
                        :label="$t('chatListing.chatRoomName') || '채팅방 이름'"
                        density="compact"
                        variant="outlined"
                        hide-details
                        autofocus
                    />
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="renameDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" rounded @click="confirmRename">
                        {{ $t('chatListing.save') || '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 도구 설정 다이얼로그는 Chat.vue 내부로 이동.
             ChatRoomPage 의 설정 메뉴에서는 $refs.chatView.openToolsSettings() 로 open 신호만 보낸다.
             영속화(localStorage)는 Chat.vue 가 담당하며, 백엔드 전송 시에는 동일 키에서 직접 읽는다. -->

        <!-- 참여자 변경 -->
        <v-dialog v-model="participantsDialog" persistent max-width="600px">
            <v-card class="pa-4">
                <v-row class="ma-0 pa-0">
                    <v-card-title class="pa-0">
                        {{ $t('chatListing.selectParticipants') || '참여자 변경' }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="participantsDialog = false" icon variant="text" density="comfortable" style="margin-top: -8px">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-card-text class="ma-0 pa-0 pb-2 pt-4">
                    <v-autocomplete
                        v-model="participantsDraft"
                        :items="userList"
                        chips
                        closable-chips
                        item-title="username"
                        :item-value="(item) => item"
                        multiple
                        :label="$t('chatListing.selectParticipants') || '참여자 선택'"
                        small-chips
                        :loading="isLoadingUsers"
                    >
                        <template v-slot:chip="{ props, item }">
                            <v-chip
                                v-if="item.raw.profile"
                                v-bind="props"
                                :prepend-avatar="item.raw.profile"
                                :text="item.raw.username ? item.raw.username : item.raw.email"
                            />
                            <v-chip
                                v-else-if="item.raw.id === 'system_id'"
                                v-bind="props"
                                prepend-avatar="/images/chat-icon.png"
                                text="System"
                            />
                            <v-chip
                                v-else
                                v-bind="props"
                                prepend-icon="mdi-account-circle"
                                :text="item.raw.username ? item.raw.username : item.raw.email"
                            />
                        </template>
                    </v-autocomplete>
                    <div class="text-caption text-grey mt-2">- 내 계정은 자동으로 포함됩니다.</div>
                </v-card-text>
                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" rounded @click="saveParticipants" variant="flat">
                        {{ $t('chatListing.save') || '저장' }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>

        <!-- 삭제 확인 -->
        <v-dialog v-model="deleteDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('chatListing.deleteChatRoom') || '채팅방 삭제' }}
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="deleteDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    "{{ currentChatRoom?.name || $t('chatListing.chat') }}" {{ $t('chatListing.confirmDeleteChatRoom') }}
                    <div class="text-caption text-medium-emphasis mt-2">{{ $t('chatListing.deleteWarning') }}</div>
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog = false">취소</v-btn>
                    <v-btn color="error" variant="flat" rounded @click="confirmDelete">
                        {{ $t('chatListing.delete') || '삭제' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- BPMN 미리보기 (WorkAssistantChatPanel과 동일 UX) -->
        <v-dialog v-model="bpmnPreviewDialog" max-width="900" scrollable>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2">mdi-sitemap</v-icon>
                    {{ selectedBpmn?.process_name || 'BPMN Preview' }}
                    <v-spacer></v-spacer>
                    <v-btn-toggle v-if="!isIntegratedGraphPreview" v-model="bpmnViewMode" mandatory density="compact" class="mr-2">
                        <v-btn value="diagram" size="small">
                            <v-icon size="18" :color="bpmnViewMode === 'diagram' ? 'primary' : undefined">mdi-sitemap</v-icon>
                        </v-btn>
                        <v-btn value="xml" size="small">
                            <v-icon size="18" :color="bpmnViewMode === 'xml' ? 'primary' : undefined">mdi-xml</v-icon>
                        </v-btn>
                        <v-btn value="ontology" size="small">
                            <v-icon size="18" :color="bpmnViewMode === 'ontology' ? 'primary' : undefined">mdi-graph-outline</v-icon>
                        </v-btn>
                    </v-btn-toggle>
                    <v-btn icon variant="text" @click="bpmnPreviewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <div v-if="isIntegratedGraphPreview" class="bpmn-ontology-container">
                        <div v-if="neo4jGraphLoading" class="bpmn-ontology-state">
                            <v-progress-circular indeterminate size="22" class="mr-2" />
                            통합 그래프 로딩 중...
                        </div>
                        <div v-else-if="neo4jGraphError" class="bpmn-ontology-state">
                            {{ neo4jGraphError }}
                        </div>
                        <OntologyGraphViewer v-else :elements="neo4jGraphElements" />
                    </div>
                    <div v-else-if="bpmnViewMode === 'diagram'" class="bpmn-diagram-container">
                        <ProcessDefinition
                            v-if="selectedBpmn?.bpmn_xml"
                            :bpmn="selectedBpmn.bpmn_xml"
                            :key="bpmnPreviewRenderKey"
                            isViewMode="true"
                            isAIGenerated="true"
                        />
                    </div>
                    <div v-else-if="bpmnViewMode === 'xml'" class="bpmn-preview-container">
                        <pre class="bpmn-xml-content">{{ selectedBpmn?.bpmn_xml }}</pre>
                    </div>
                    <div v-else class="bpmn-ontology-container">
                        <div v-if="neo4jGraphLoading" class="bpmn-ontology-state">
                            <v-progress-circular indeterminate size="22" class="mr-2" />
                            Neo4j 그래프 로딩 중...
                        </div>
                        <div v-else-if="neo4jGraphError" class="bpmn-ontology-state">
                            {{ neo4jGraphError }}
                        </div>
                        <OntologyGraphViewer v-else :elements="neo4jGraphElements" />
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-btn v-if="!isIntegratedGraphPreview && bpmnViewMode === 'xml'" variant="tonal" @click="copyBpmnToClipboard">
                        <v-icon class="mr-1">mdi-content-copy</v-icon>
                        XML 복사
                    </v-btn>
                    <!-- 저장 전(__unsaved)에는 모델러로 이동할 대상이 DB 에 없으므로 '프로세스 수정' 숨김.
                         저장 후 다시 표시되어 모델러로 이동/수정 가능. -->
                    <v-btn
                        v-if="!isIntegratedGraphPreview && bpmnViewMode === 'diagram' && !selectedBpmn?.__unsaved"
                        variant="tonal"
                        @click="openInModeler"
                    >
                        <v-icon class="mr-1">mdi-pencil</v-icon>
                        프로세스 수정
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 이미지 미리보기 -->
        <v-dialog v-model="imagePreviewDialog" max-width="900">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2">mdi-image</v-icon>
                    이미지 미리보기
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="imagePreviewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-2">
                    <v-img v-if="previewImageUrl" :src="previewImageUrl" max-height="600" contain />
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { agentStableId, isUuid as isUuidStable, slugToUuid } from '@/utils/agentId.js';
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';
import Chat from '@/components/ui/Chat.vue';
import VoiceAgentDesktopMode from '@/components/ui/VoiceAgentDesktopMode.vue';
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import BPMNXmlGenerator from '@/components/BPMNXmlGenerator.vue';
import OntologyGraphViewer from '@/components/ui/OntologyGraphViewer.vue';
import ArtifactPanel from '@/components/ArtifactPanel.vue';
import { buildProcessPanelFromMessage, processIdFromResult } from '@/utils/processArtifactPanel.js';
import { AGENT_CHAT_ROOM_CONTEXT_TYPES } from '@/components/AgentChatRoomContext.vue';
import { useDefaultSetting } from '@/stores/defaultSetting';
import agentRouterService from '@/services/AgentRouterService';
import deepAgentRouterService from '@/services/DeepAgentRouterService';
import FixedBaseWorkAssistantAgentService from '@/services/FixedBaseWorkAssistantAgentService';
import { getValidToken } from '@/utils/supabaseAuth';
import { isLegacyProcessDefinition, convertLegacyProcessDefinitionToElements } from '@/utils/legacyProcessDefinition';
import { processGptAgent } from '@/constants/processGptAgent';
import { PROCESS_GPT_AGENT_ID } from '@/constants/processGptAgent';

const backend = BackendFactory.createBackend();
const fixedLangchainMainAgentService = new FixedBaseWorkAssistantAgentService('/agent');
const fixedDeepagentsMainAgentService = new FixedBaseWorkAssistantAgentService('/process-gpt-deepagents');

// 메인 에이전트(process-gpt-agent)는 별도 메타 설정이 필요함(항상 기본 파드로 실행)
const MAIN_PROCESS_GPT_AGENT_META = {
    id: PROCESS_GPT_AGENT_ID,
    username: 'Process GPT Agent',
    alias: 'processgpt',
    role: '업무 지원 메인 에이전트',
    goal: '프로세스 생성/실행/조회 및 조직/인스턴스 기반 업무 지원',
    description: [
        '프로세스 정의 생성/컨설팅',
        '프로세스 실행(폼 필드 조회 포함)',
        '프로세스/인스턴스/할 일/결과 조회',
        '조직도 조회',
        'BPMN 프로세스 생성 작업 감지/추적',
        '이미지 분석'
    ].join(', '),
    tools: 'get_process_list, get_process_detail, get_form_fields, execute_process, get_instance_list, get_todolist, get_organization, ask_user, create_consulting_process_workitem, create_pdf2bpmn_workitem'
};

export default {
    name: 'ChatRoomPage',
    props: {
        embedded: { type: Boolean, default: false },
        contextAgentId: { type: String, default: null },
        contextUserId: { type: String, default: null },
        initialRoomId: { type: String, default: null }
    },
    components: {
        UnifiedChatInput,
        Chat,
        ProcessDefinition,
        OntologyGraphViewer,
        VoiceAgentDesktopMode,
        ArtifactPanel
    },
    data() {
        return {
            defaultSetting: useDefaultSetting(),
            userInfo: null,
            userList: [],
            isLoadingUsers: false,

            isLoadingRoom: false,
            currentChatRoom: null,
            messages: [],
            activeStreams: {}, // 스트리밍 중인 assistant 메시지 { [agentId]: msgObject }
            // deepagent HITL(request_human_input)로 멈춘 방의 run_state 보관.
            // 사용자가 패널 대신 일반 입력창으로 답해도 같은 그래프 세션으로 resume 되게 하는 안전망.
            // { [roomId]: run_state }
            pendingHitlRunState: {},
            chatsWatchRef: null,
            attachmentsWatchRef: null,

            // history pagination (10개씩)
            historyPageSize: 10,
            isLoadingHistory: false,
            hasMoreHistory: true,
            oldestLoadedTimeStamp: null,

            isSending: false,
            // 메시지 전송 중복 방지(더블 submit 등)
            _lastClientSendKey: null,
            _lastClientSendAt: 0,

            // 전체 에이전트 디렉토리 캐시(추천 기능용)
            _agentDirectoryCache: null,
            _agentDirectoryCacheAt: 0,

            // draft settings (새 채팅)
            draftName: '',
            draftParticipants: [],

            // embedded context (agent/user) rooms
            isLoadingContextRooms: false,
            contextRoomTabs: [], // [{ roomId, title }]
            activeRoomId: null,
            contextTabIndex: 0,
            contextAgent: null,

            // userId 모드 (유저 선택 -> 탭 화면)
            isLoadingTargetUser: false,
            targetUser: null,
            draftChatRoom: null,

            // participants view
            participantsViewDialog: false,

            // agent 상태(채팅방 내 표시)
            agentStatusById: {},

            // ConsultingGenerator 관련 (WorkAssistantChatPanel과 동일: start_process_consulting 도구 호출 시마다 1회 생성)
            generator: null,
            isConsultingMode: false,
            lastSendMessage: null,
            _consultingTargetRoomId: null,

            // PDF2BPMN 진행/구독 (WorkAssistantChatPanel과 동일)
            pdf2bpmnProgressByRoomId: {},
            pdf2bpmnTaskIdByRoomId: {},
            pdf2bpmnEventsChannelByTaskId: {},
            processGenerationByRoomId: {},

            // 프리뷰 UI (BPMN/이미지) - WorkAssistantChatPanel과 동일한 UX를 ChatRoomPage에서 제공
            bpmnPreviewDialog: false,
            bpmnViewMode: 'diagram', // diagram | xml | ontology
            selectedBpmn: null,
            neo4jGraphLoading: false,
            neo4jGraphError: '',
            neo4jGraphElements: [],
            pdf2bpmnApiBaseResolved: '',
            // pdf2bpmn 워커가 처리 종료 직전에 전달한 그래프 미리보기 payload 캐시.
            //   { [taskId]: { integratedGraph, processGraphs, graphName } }
            // ScaledJob 환경에서는 처리 후 AGE 그래프가 drop 되므로,
            // 프론트는 이 캐시(또는 메시지 pdf2bpmnResult.integratedGraph/processGraphs)
            // 를 우선 사용해 외부 API 호출 없이 그래프를 렌더링한다.
            pdf2bpmnGraphCache: {},
            imagePreviewDialog: false,
            previewImageUrl: null,

            // 산출물 미리보기 패널 (공통)
            artifactPanels: [], // [{ id, type, label, data: { htmlUrl, fileUrl, messageId } }]
            roomWorkspaceFilesByGroup: {}, // 프로세스 폴더(process-<uuid>)별 산출물 파일 누적 — 프로세스마다 탭
            workspaceSaveStateByGroup: {}, // 프로세스별 DB 저장 상태 { [group]: {saving,saved,error} }
            selectedKnowledgeDocs: [], // 지식 베이스(Google Drive) RAG 컨텍스트로 선택된 문서
            activeArtifactId: null, // 현재 활성 탭 ID
            artifactSidebarVisible: false,
            artifactSidebarWidth: 820,
            artifactSidebarResizing: false,
            artifactSidebarResizeStartX: 0,
            artifactSidebarResizeStartWidth: 0,
            artifactDownloadLoading: false,

            // 예정/사용 도구 목록(우측 패널)
            plannedToolsById: {}, // { [id]: { id, tool, name, displayName, args, status, input, output } }
            plannedSkills: [], // ["skill-name", ...] (or normalized objects)
            plannedConnectors: [], // ["server-name", ...]
            plannedTodos: [], // [{ content, status, ... }]
            /** chat_attachments 테이블에서 읽은 첨부 목록 */
            plannedAttachments: [],
            /** 우측 사이드바 활동(현재 실행 중인 tool / 서브에이전트) — id 키 기반 */
            plannedActivityById: {},
            /** 활동 패널의 시각적 정렬용 단조 증가 카운터 */
            _activityOrder: 0,
            planSideInfoEnabled: {
                activity: false,
                tools: false,
                skills: false,
                connectors: false,
                todos: false,
                attachments: false,
                knowledge: true
            },
            // 우측 사이드바 폭 정책
            artifactSidebarWideWidth: 820,
            artifactSidebarNarrowWidth: 360,

            // 스트리밍 중지(Abort) 컨트롤러: roomId:agentId 단위
            agentAbortControllers: {},

            // 데스크탑 음성 에이전트 모드
            isDesktopVoiceActive: false,
            voiceAiMsgId: null, // 스트리밍 중인 AI 메시지 uuid
            voiceStatus: 'idle', // idle | connecting | listening | speaking | responding | playing | error
            voiceUserSpeaking: false,

            // settings UI
            settingsMenu: false,
            renameDialog: false,
            renameDraft: '',
            participantsDialog: false,
            participantsDraft: [],
            deleteDialog: false,
            chatAccessHeartbeatTimer: null
        };
    },
    computed: {
        // DB 확정 메시지 + 현재 스트리밍 중인 임시 메시지를 합쳐 Chat 컴포넌트에 전달
        displayMessages() {
            const streams = Object.values(this.activeStreams);
            if (streams.length === 0) return this.messages;
            return [...this.messages, ...streams];
        },
        /**
         * 마지막 메시지에서 미제출 __humanFeedback 추출
         * 입력부 상단에 표시할 human feedback 데이터
         */
        pendingHumanFeedback() {
            // activeStreams 포함 전체 표시 메시지에서 미제출 HITL 피드백 탐색
            const allMsgs = [...this.messages, ...Object.values(this.activeStreams)];
            for (let i = allMsgs.length - 1; i >= 0; i--) {
                const msg = allMsgs[i];
                const feedback = msg && msg.__humanFeedback ? msg.__humanFeedback : null;
                const hasOptions =
                    (Array.isArray(feedback?.questions) && feedback.questions.length > 0) ||
                    (Array.isArray(feedback?.items) && feedback.items.length > 0) ||
                    (Array.isArray(feedback?.suggestions) && feedback.suggestions.length > 0) ||
                    feedback?.user_request_type === 'approve_reject_with_edit' ||
                    feedback?.user_request_type === 'confirm';
                if (feedback && hasOptions && !feedback.__submitted) {
                    return msg.__humanFeedback;
                }
            }
            return null;
        },
        /**
         * pendingHumanFeedback가 속한 메시지 객체 (submit 시 참조)
         */
        pendingHumanFeedbackMessage() {
            if (!this.messages || this.messages.length === 0) return null;
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                const feedback = msg && msg.__humanFeedback ? msg.__humanFeedback : null;
                const hasOptions =
                    (Array.isArray(feedback?.questions) && feedback.questions.length > 0) ||
                    (Array.isArray(feedback?.items) && feedback.items.length > 0) ||
                    (Array.isArray(feedback?.suggestions) && feedback.suggestions.length > 0) ||
                    feedback?.user_request_type === 'approve_reject_with_edit' ||
                    feedback?.user_request_type === 'confirm';
                if (feedback && hasOptions && !feedback.__submitted) {
                    return msg;
                }
            }
            return null;
        },
        roomId() {
            if (this.embedded) return this.activeRoomId || null;
            const rid = this.$route?.query?.roomId || null;
            if (rid) return rid;
            // /chat?userId= 컨텍스트에서는 내부 선택(activeRoomId)로 방을 연다
            if (this.$route?.query?.userId) return this.activeRoomId || null;
            return null;
        },
        userId() {
            if (this.embedded) return this.contextUserId || null;
            return this.$route?.query?.userId || null;
        },
        isAgentContextEmbedded() {
            return !!this.embedded && !!this.contextAgentId;
        },
        isUserContextRouted() {
            return !this.embedded && !!this.userId;
        },
        contextParticipantId() {
            if (this.isAgentContextEmbedded) return this.contextAgentId;
            if (this.isUserContextRouted) return this.targetUser?.id || this.targetUser?.uid || this.userId || null;
            return null;
        },
        contextParticipant() {
            if (this.isAgentContextEmbedded) return this.contextAgent;
            if (this.isUserContextRouted) return this.targetUser;
            return null;
        },
        isContextTabsMode() {
            return this.isAgentContextEmbedded || this.isUserContextRouted;
        },
        hasArtifactPanel() {
            return this.artifactPanels.length > 0;
        },
        isDraftContextView() {
            // embedded agent 컨텍스트에서 roomId가 없으면 드래프트 화면
            return this.isAgentContextEmbedded && !this.roomId;
        },
        isDraftUserContextView() {
            return this.isUserContextRouted && !this.roomId && !!this.targetUser && !this.isLoadingTargetUser;
        },
        isAnyDraftContextView() {
            return this.isDraftContextView || this.isDraftUserContextView;
        },
        draftContextRoom() {
            if (!this.isAgentContextEmbedded) return null;
            const me = this.normalizeParticipant(this.userInfo);
            const ag = this.normalizeParticipant(this.contextAgent);
            return {
                id: null,
                name: '새 채팅방',
                participants: [me, ag].filter(Boolean)
            };
        },
        draftUserContextRoom() {
            if (!this.isUserContextRouted) return null;
            const me = this.normalizeParticipant(this.userInfo);
            const tu = this.normalizeParticipant(this.targetUser);
            return {
                id: null,
                name: '새 채팅방',
                participants: [me, tu].filter(Boolean)
            };
        },
        participantUsersForView() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            if (!parts || parts.length === 0) return [];
            const me = this.normalizeParticipant(this.userInfo);
            // userList와 merge해서 username/profile 보강
            const merged = parts.map((p, idx) => {
                const np = this.normalizeParticipant(p) || p || {};
                const found = Array.isArray(this.userList) ? this.userList.find((u) => this.participantMatches(u, np)) : null;
                return {
                    ...(found ? { ...np, ...found } : np),
                    __idx: idx
                };
            });
            // 참여자 목록 정렬:
            // 1) 나(본인) 최상단
            // 2) 일반 유저: 이름(가나다/알파벳) 오름차순
            // 3) 에이전트: 이름(가나다/알파벳) 오름차순
            const collator = new Intl.Collator(['ko', 'en'], {
                sensitivity: 'base',
                numeric: true,
                ignorePunctuation: true
            });

            const getDisplayName = (p) => (p?.username || p?.name || p?.userName || p?.email || p?.id || '').toString().trim();

            const isMe = (p) => !!(me && this.participantMatches(p, me));

            const isAgent = (p) => {
                if (!p) return false;
                // defaultSetting 기반 에이전트
                if (p?.id && this.defaultSetting?.getAgentById?.(p.id)) return true;
                // participant flags (다양한 소스 호환)
                if (p?.isAgent === true) return true;
                if (p?.agent === true) return true;
                if (p?.is_agent === true) return true;
                const at = (p?.agent_type || p?.agentType || '').toString().toLowerCase();
                if (at === 'agent') return true;
                // system은 agent 그룹으로 간주
                if (p?.id === 'system_id' || p?.email === 'system@uengine.org') return true;
                const roleOrType = (p?.role || p?.type || '').toString().toLowerCase();
                if (roleOrType === 'agent' || roleOrType === 'assistant') return true;
                return false;
            };

            const byName = (a, b) => {
                const an = getDisplayName(a);
                const bn = getDisplayName(b);
                const c = collator.compare(an, bn);
                if (c !== 0) return c;
                // 동률이면 id/email로 한번 더, 그래도 동률이면 원래 순서
                const ak = (a?.id || a?.email || an || '').toString();
                const bk = (b?.id || b?.email || bn || '').toString();
                const c2 = collator.compare(ak, bk);
                if (c2 !== 0) return c2;
                return (a.__idx ?? 0) - (b.__idx ?? 0);
            };

            merged.sort((a, b) => {
                const aIsMe = isMe(a);
                const bIsMe = isMe(b);
                if (aIsMe && !bIsMe) return -1;
                if (!aIsMe && bIsMe) return 1;

                const aIsAgent = isAgent(a);
                const bIsAgent = isAgent(b);
                if (!aIsAgent && bIsAgent) return -1; // 일반 유저 먼저
                if (aIsAgent && !bIsAgent) return 1; // 에이전트는 뒤로
                return byName(a, b);
            });
            return merged.map(({ __idx, ...rest }) => rest);
        },
        agentParticipants() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            const uniq = new Map();
            parts.forEach((p) => {
                const np = this.normalizeParticipant(p);
                if (!np?.id) return;
                const agent = this.defaultSetting?.getAgentById?.(np.id);
                const isProcessGpt = np.id === PROCESS_GPT_AGENT_ID;
                const isAgent = isProcessGpt || np.agent_type === 'agent' || np.is_agent === true || !!agent;
                if (!isAgent) return;
                if (!uniq.has(np.id)) uniq.set(np.id, { ...np, ...agent, id: np.id });
            });
            return Array.from(uniq.values());
        },
        // 참가자 영역 "연결중" 로딩바용 (warmup 중인 에이전트가 있는가)
        hasAgentWarming() {
            return (this.agentParticipants || []).some((a) => this.getAgentStatus(a.id)?.state === 'warming');
        },
        failedAgentParticipants() {
            return (this.agentParticipants || []).filter((a) => this.getAgentStatus(a.id)?.state === 'error');
        },
        hasAgentFailure() {
            return (this.failedAgentParticipants || []).length > 0;
        },
        isIntegratedGraphPreview() {
            return !!this.selectedBpmn?.isIntegratedGraph;
        },
        bpmnPreviewRenderKey() {
            const processId = this.selectedBpmn?.process_id || 'no-process-id';
            const processName = this.selectedBpmn?.process_name || 'no-process-name';
            const xmlLength = this.selectedBpmn?.bpmn_xml ? String(this.selectedBpmn.bpmn_xml.length) : '0';
            const updatedAt = this.selectedBpmn?.updatedAt || '';
            return `${processId}::${processName}::${xmlLength}::${updatedAt}`;
        },
        // 실제로 "중지(Abort)" 가능한 스트림이 현재 방에 존재하는가
        hasAbortableStream() {
            const rid = this.currentChatRoom?.id || this.roomId || null;
            if (!rid) return false;
            const map = this.agentAbortControllers || {};
            return Object.keys(map).some((k) => k.startsWith(`${rid}:`));
        },
        currentPdf2bpmnProgress() {
            const roomId = this.currentChatRoom?.id || this.roomId || null;
            const state = roomId ? this.pdf2bpmnProgressByRoomId?.[roomId] : null;
            return (
                state || {
                    isActive: false,
                    taskId: null,
                    status: '',
                    progress: 0,
                    message: '',
                    generatedBpmns: []
                }
            );
        },
        currentProcessGenerationProgress() {
            const roomId = this.currentChatRoom?.id || this.roomId || null;
            const state = roomId ? this.processGenerationByRoomId?.[roomId] : null;
            return (
                state || {
                    isActive: false,
                    status: '',
                    message: '',
                    process_name: '',
                    process_id: '',
                    definition: null,
                    bpmn_xml: '',
                    updatedAt: ''
                }
            );
        },
        displayParticipants() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            if (!this.userInfo) return parts.filter(Boolean);
            const meEmail = this.userInfo?.email || null;
            const meId = this.userInfo?.id || this.userInfo?.uid || null;
            const others = parts.filter((p) => {
                if (!p) return false;
                if (meEmail && p.email && p.email === meEmail) return false;
                if (meId && p.id && p.id === meId) return false;
                return true;
            });
            return others.length > 0 ? others : parts.filter(Boolean);
        },
        participantsPreviewText() {
            const parts = Array.isArray(this.participantUsersForView) ? this.participantUsersForView : [];
            if (parts.length === 0) return '';

            const me = this.normalizeParticipant(this.userInfo);
            const others = me ? parts.filter((p) => p && !this.participantMatches(p, me)) : parts.filter(Boolean);
            const base = (others.length > 0 ? others : parts).filter(Boolean);

            const getName = (p) => (p?.username || p?.name || p?.userName || p?.email || p?.id || '').toString().trim();
            const seen = new Set();
            const names = [];
            for (const p of base) {
                const n = getName(p);
                if (!n) continue;
                const key = n.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                names.push(n);
            }
            if (names.length === 0) return '';

            const maxNames = 2;
            const shown = names.slice(0, maxNames);
            const rest = names.length - shown.length;
            return rest > 0 ? `${shown.join(', ')} 외 ${rest}` : shown.join(', ');
        },
        participantsPreviewTooltip() {
            const parts = Array.isArray(this.participantUsersForView) ? this.participantUsersForView : [];
            if (parts.length === 0) return '';

            const me = this.normalizeParticipant(this.userInfo);
            const others = me ? parts.filter((p) => p && !this.participantMatches(p, me)) : parts.filter(Boolean);
            const base = (others.length > 0 ? others : parts).filter(Boolean);

            const getName = (p) => (p?.username || p?.name || p?.userName || p?.email || p?.id || '').toString().trim();
            const seen = new Set();
            const names = [];
            for (const p of base) {
                const n = getName(p);
                if (!n) continue;
                const key = n.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                names.push(n);
            }
            return names.join(', ');
        },
        // 음성 세션 시작 시 서버에 주입할 대화 히스토리 (최근 20턴)
        currentVoiceHistory() {
            const msgs = Array.isArray(this.messages) ? this.messages : [];
            return msgs
                .filter((m) => m && !m.isLoading && (m.role === 'user' || m.role === 'assistant') && (m.content || '').trim())
                .slice(-20)
                .map((m) => ({ role: m.role, content: (m.content || '').trim() }));
        },
        // 현재 음성 세션에 사용할 에이전트 메타데이터
        // 에이전트 컨텍스트 모드: contextAgent + defaultSetting 병합
        // 일반 채팅방: 첫 번째 에이전트 참가자 메타데이터
        // 1:1 에이전트 대화일 때만 말하기/듣기 버튼 활성화
        isVoiceEnabled() {
            // embedded 에이전트 컨텍스트(에이전트 목록에서 선택) → 항상 1:1 에이전트 대화
            if (this.isAgentContextEmbedded) return true;
            // 일반 채팅방: 참가자가 정확히 2명(나 + 상대방)이고 상대방이 에이전트인 경우
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            if (parts.length === 2 && this.agentParticipants.length === 1) return true;
            return false;
        },
        currentVoiceAgentInfo() {
            if (this.contextAgentId && this.contextAgent) {
                const stored = this.defaultSetting?.getAgentById?.(this.contextAgent.id || this.contextAgentId) || {};
                return {
                    id: stored.id || this.contextAgent.id || this.contextAgentId,
                    username: stored.username || this.contextAgent.username || this.contextAgent.name || '',
                    role: stored.role || this.contextAgent.role || '',
                    goal: stored.goal || this.contextAgent.goal || '',
                    persona: stored.persona || this.contextAgent.persona || '',
                    description: stored.description || this.contextAgent.description || '',
                    tools: stored.tools || this.contextAgent.tools || ''
                };
            }
            const candidates = this.getAgentCandidates();
            if (candidates.length > 0) {
                const first = candidates[0];
                const meta = this.defaultSetting?.getAgentById?.(first.id) || {};
                return {
                    id: first.id,
                    username: meta.username || first.username || '',
                    role: meta.role || '',
                    goal: meta.goal || '',
                    persona: meta.persona || '',
                    description: meta.description || '',
                    tools: meta.tools || ''
                };
            }
            return null;
        }
    },
    async mounted() {
        try {
            if (!this.userInfo) this.userInfo = await backend.getUserInfo();
        } catch (e) {
            // ignore
        }

        // embedded agent 컨텍스트는 roomId가 없어도 탭/드래프트를 구성해야 함
        if (this.isAgentContextEmbedded) {
            // 에이전트 목록에서 진입 시 항상 새 채팅으로 시작
            this.activeRoomId = null;
            try {
                const a = this.defaultSetting?.getAgentById?.(this.contextAgentId);
                this.contextAgent = a || (await backend.getUserById(this.contextAgentId));
            } catch (e) {
                this.contextAgent = this.defaultSetting?.getAgentById?.(this.contextAgentId) || {
                    id: this.contextAgentId,
                    username: 'Agent'
                };
            }
            this.resetDraft();
        }
    },
    watch: {
        roomId: {
            immediate: true,
            async handler(newRoomId, oldRoomId) {
                if (!newRoomId) {
                    this.stopChatAccessHeartbeat();
                    this.EventBus.emit('chat-room-unselected');
                    return;
                }
                if (newRoomId === oldRoomId) return;

                const isVoiceDraftTransition = this.isDesktopVoiceActive && !oldRoomId;
                const isDifferentRoom = !!oldRoomId && oldRoomId !== newRoomId;

                if (isDifferentRoom) {
                    // 완전히 다른 방으로 이동: 음성 종료 후 정상 bootstrap
                    this.stopDesktopVoice();
                    await this.bootstrapRoom(newRoomId);
                } else if (isVoiceDraftTransition) {
                    // 음성 중 드래프트→방 전환: 메시지 초기화 없이 구독·에이전트 워밍업만
                    await this._bootstrapRoomForVoice(newRoomId);
                } else {
                    await this.bootstrapRoom(newRoomId);
                }
            }
        },
        userId: {
            immediate: true,
            async handler(newUserId, oldUserId) {
                if (!newUserId || newUserId === 'undefined') return;
                if (newUserId === oldUserId) return;
                // room 모드 상태 초기화
                this.currentChatRoom = null;
                this.messages = [];
                await this.bootstrapTargetUser(newUserId);
            }
        },
        bpmnViewMode(newVal) {
            if (newVal === 'ontology') {
                if (this.isIntegratedGraphPreview) return;
                this.ensureNeo4jGraphLoaded();
            }
        }
    },
    async beforeUnmount() {
        this.stopChatAccessHeartbeat();
        this.EventBus.emit('chat-room-unselected');
        try {
            if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                this.chatsWatchRef.unsubscribe();
            }
        } catch (e) {}
        this.chatsWatchRef = null;
        try {
            if (this.attachmentsWatchRef && typeof this.attachmentsWatchRef.unsubscribe === 'function') {
                this.attachmentsWatchRef.unsubscribe();
            }
        } catch (e) {}
        this.attachmentsWatchRef = null;

        // PDF2BPMN events 구독 해제
        this.unsubscribeAllPdf2bpmnEvents();

        // 진행 중인 스트리밍 중지
        this.abortAllAgentStreams();

        // 사이드바 리사이즈 리스너 해제
        window.removeEventListener('mousemove', this.onArtifactSidebarResizeMove);
        window.removeEventListener('mouseup', this.stopArtifactSidebarResize);
    },
    methods: {
        handleOpenUiStateUpdate(payload) {
            try {
                // payload: { messageUuid, state }
                const messageUuid = payload?.messageUuid || null;
                const idx = messageUuid ? this.messages.findIndex((m) => m?.uuid === messageUuid) : -1;
                if (idx !== -1) {
                    this.messages[idx].openuiState = payload?.state ?? null;
                }
            } catch (e) {
                // ignore
            }
        },
        handleOpenUiParseResult(payload) {
            try {
                // payload: { messageUuid, parseResult }
                const messageUuid = payload?.messageUuid || null;
                const idx = messageUuid ? this.messages.findIndex((m) => m?.uuid === messageUuid) : -1;
                if (idx !== -1) {
                    this.messages[idx].openuiParseResult = payload?.parseResult ?? null;
                    this.messages[idx].openuiParseErrors = payload?.parseResult?.meta?.errors || [];
                }
            } catch (e) {
                // ignore
            }
        },
        async handleOpenUiAction(payload) {
            try {
                // payload: { messageUuid, action, state }
                const messageUuid = payload?.messageUuid || null;
                const idx = messageUuid ? this.messages.findIndex((m) => m?.uuid === messageUuid) : -1;
                if (idx !== -1) {
                    this.messages[idx].openuiLastAction = payload?.action ?? null;
                }

                const action = payload?.action || null;
                const state = payload?.state || null;
                const actionType = (action?.type || '').toString();
                const formState = action?.formState ?? state ?? null;
                const isFormSubmit =
                    actionType === 'continue_conversation' ||
                    !!(action && typeof action.formState === 'object') ||
                    (action?.humanFriendlyMessage || '').toString().trim() === '제출';

                if (!isFormSubmit || !formState || typeof formState !== 'object') return;
                if (!this.currentChatRoom?.id) return;

                const assistantMsg = idx !== -1 ? this.messages[idx] : null;
                const agentIdForMention = assistantMsg?.agentId || null;
                let mentionedUsers = [];
                if (agentIdForMention) {
                    const candidates = (typeof this.getAgentCandidates === 'function' && this.getAgentCandidates()) || [];
                    const hit = Array.isArray(candidates) ? candidates.find((a) => a?.id === agentIdForMention) : null;
                    if (hit) {
                        mentionedUsers = [
                            {
                                id: hit.id,
                                username: hit.username || hit.name || hit.id,
                                mentionText: hit.username || hit.alias || hit.name || hit.id
                            }
                        ];
                    } else {
                        mentionedUsers = [
                            {
                                id: agentIdForMention,
                                username: agentIdForMention,
                                mentionText: agentIdForMention
                            }
                        ];
                    }
                }

                const simplifiedFormState = this.simplifyOpenUiFormState(formState);
                const submission = {
                    type: actionType || 'continue_conversation',
                    formName: action?.formName || null,
                    params: action?.params && typeof action.params === 'object' ? action.params : {},
                    formState: simplifiedFormState
                };

                const text = (action?.humanFriendlyMessage || '제출').toString().trim() || '제출';

                const streamMetadata = { openui_form_submission: submission };
                const runStateForMeta = this.getMessageRunStateForOpenUi(assistantMsg);
                if (runStateForMeta) {
                    streamMetadata.run_state = runStateForMeta;
                }

                await this.handleSendMessage({
                    text,
                    mentionedUsers,
                    orchestration: this.getRoomOrchestration(),
                    metadata: streamMetadata,
                    openuiFormSubmission: submission
                });
            } catch (e) {
                // ignore
            }
        },
        focusComposerInput() {
            try {
                const composer = this.$refs?.composer;
                const composerEl = composer?.$el || null;
                if (!composerEl) return;

                const activeEl = document?.activeElement || null;
                const focusedOutsideComposer =
                    !!activeEl && activeEl !== document.body && activeEl !== document.documentElement && !composerEl.contains(activeEl);

                // 사용자가 의도적으로 다른 영역을 클릭한 경우에는 포커스를 강제로 가져오지 않음
                if (focusedOutsideComposer) return;

                this.$nextTick(() => {
                    try {
                        const textarea = composerEl.querySelector('textarea:not([disabled])');
                        if (!textarea) return;
                        textarea.focus({ preventScroll: true });
                        const len = (textarea.value || '').length;
                        if (typeof textarea.setSelectionRange === 'function') {
                            textarea.setSelectionRange(len, len);
                        }
                    } catch (e) {}
                });
            } catch (e) {}
        },
        async updateChatAccessPage(roomId) {
            try {
                const rid = (roomId || this.currentChatRoom?.id || this.roomId || '').toString();
                const email = this.userInfo?.email || null;
                if (!rid || !email) return;
                if (backend?.saveAccessPage) {
                    await backend.saveAccessPage(email, `chat:${rid}`);
                }
            } catch (e) {
                // 알림 억제 보조 기능: 실패해도 채팅 UX는 유지
            }
        },
        startChatAccessHeartbeat(roomId) {
            this.stopChatAccessHeartbeat();
            const rid = (roomId || this.currentChatRoom?.id || this.roomId || '').toString();
            if (!rid) return;

            this.updateChatAccessPage(rid);
            this.chatAccessHeartbeatTimer = setInterval(() => {
                this.updateChatAccessPage(rid);
            }, 60 * 1000);
        },
        stopChatAccessHeartbeat() {
            if (this.chatAccessHeartbeatTimer) {
                clearInterval(this.chatAccessHeartbeatTimer);
                this.chatAccessHeartbeatTimer = null;
            }
        },
        handleBeforeReply(message) {
            try {
                this.$refs.composer?.setReply?.(message);
            } catch (e) {}
        },
        async loadContextRooms() {
            if (!this.isAgentContextEmbedded) return;
            this.isLoadingContextRooms = true;
            try {
                if (!this.userInfo) this.userInfo = await backend.getUserInfo();
                const rooms = await backend.getChatRoomList('chat_rooms');
                const list = Array.isArray(rooms) ? rooms : [];
                const meEmail = this.userInfo?.email || null;
                const meId = this.userInfo?.id || this.userInfo?.uid || null;

                const filtered = list.filter((r) => {
                    const parts = Array.isArray(r?.participants) ? r.participants : [];
                    if (!parts || parts.length === 0) return false;
                    const hasAgent = parts.some((p) => (p?.id || p?.uid) === this.contextAgentId);
                    if (!hasAgent) return false;
                    const hasMe = parts.some((p) => {
                        const id = p?.id || p?.uid || null;
                        const email = p?.email || null;
                        if (meId && id && meId === id) return true;
                        if (meEmail && email && meEmail === email) return true;
                        return false;
                    });
                    return hasMe;
                });

                filtered.sort((a, b) => {
                    const at = new Date(a?.message?.createdAt || 0).getTime();
                    const bt = new Date(b?.message?.createdAt || 0).getTime();
                    return bt - at;
                });

                this.contextRoomTabs = filtered.map((r) => ({
                    roomId: r.id,
                    title: r.name || this.$t('chatListing.chat')
                }));

                const initial = this.initialRoomId || null;
                const existsInitial = initial && this.contextRoomTabs.some((t) => t.roomId === initial);
                if (existsInitial) {
                    this.activeRoomId = initial;
                    this.contextTabIndex = Math.max(
                        0,
                        this.contextRoomTabs.findIndex((t) => t.roomId === initial)
                    );
                } else if (this.contextRoomTabs.length > 0) {
                    this.activeRoomId = this.contextRoomTabs[0].roomId;
                    this.contextTabIndex = 0;
                } else {
                    this.activeRoomId = null;
                    this.contextTabIndex = 0;
                    this.currentChatRoom = null;
                    this.messages = [];
                }
            } catch (e) {
                this.contextRoomTabs = [];
                this.activeRoomId = null;
            } finally {
                this.isLoadingContextRooms = false;
            }
        },
        selectContextRoomByIndex(idx) {
            const t = this.contextRoomTabs?.[idx] || null;
            if (!t?.roomId) return;
            this.contextTabIndex = idx;
            this.activeRoomId = t.roomId;
        },
        startNewContextDraft() {
            this.activeRoomId = null;
            this.currentChatRoom = null;
            this.messages = [];
        },
        openParticipantsView() {
            this.participantsViewDialog = true;
        },
        getAgentStatus(agentId) {
            // process-gpt-agent는 별도 파드(메인)로 항상 연결됨으로 표시
            if (agentId === PROCESS_GPT_AGENT_ID) {
                return this.agentStatusById?.[agentId] || { state: 'ready', message: '' };
            }
            return this.agentStatusById?.[agentId] || { state: 'idle', message: '' };
        },
        setAgentStatus(agentId, next) {
            if (!agentId) return;
            const cur = this.getAgentStatus(agentId);
            this.agentStatusById = {
                ...(this.agentStatusById || {}),
                [agentId]: { ...cur, ...(next || {}) }
            };
        },
        statusColor(state) {
            const s = state || 'idle';
            if (s === 'ready') return 'success';
            if (s === 'streaming') return 'primary';
            if (s === 'error') return 'error';
            // warming/idle/기타(미정) 상태는 모두 "연결중" 색상으로 통일
            return 'warning';
        },
        statusLabel(state) {
            if (state === 'ready') return '준비됨';
            if (state === 'warming') return '연결중';
            if (state === 'streaming') return '응답중';
            if (state === 'error') return '연결 실패';
            // idle 등 나머지는 연결중으로 통일
            return '연결중';
        },
        scrollToBottomSafe() {
            try {
                this.$refs.chatView?.scrollToBottom?.();
            } catch (e) {}
        },
        /** chat_rooms.context (구 room_context / roomContext). 읽기만 하위 호환 */
        readChatRoomContext(room) {
            const r = room !== undefined && room !== null ? room : this.currentChatRoom;
            if (!r || typeof r !== 'object') return null;
            const ctx = r.context ?? r.room_context ?? r.roomContext;
            return ctx != null && typeof ctx === 'object' ? ctx : null;
        },
        shouldClientWriteChatDb(_orchestration) {
            return true;
        },
        /** DB/putObject용: context 단일 필드로 쓰고 구 키는 제거 */
        writeChatRoomContext(nextCtx, room) {
            const r = room !== undefined && room !== null ? room : this.currentChatRoom;
            if (!r || typeof r !== 'object') return;
            r.context = nextCtx;
            delete r.room_context;
            delete r.roomContext;
        },
        normalizeRoomContext(ctx) {
            if (ctx == null) return {};
            if (typeof ctx === 'string') {
                try {
                    const parsed = JSON.parse(ctx);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (e) {
                    return {};
                }
            }
            return ctx && typeof ctx === 'object' && !Array.isArray(ctx) ? ctx : {};
        },
        isPlainObject(v) {
            return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.prototype.toString.call(v) === '[object Object]';
        },
        deepMergeObjects(base, patch) {
            const a = this.isPlainObject(base) ? base : {};
            const b = this.isPlainObject(patch) ? patch : {};
            const out = { ...a };
            Object.keys(b).forEach((k) => {
                const bv = b[k];
                const av = a[k];
                if (this.isPlainObject(av) && this.isPlainObject(bv)) {
                    out[k] = this.deepMergeObjects(av, bv);
                } else {
                    out[k] = bv;
                }
            });
            return out;
        },
        /**
         * chat_rooms 업데이트 시, 서버에서 갱신한 context(예: tool 호출 내역)가
         * 오래된 클라이언트 payload로 덮어써지지 않도록 DB 최신 context를 읽어 merge 후 저장한다.
         */
        async putChatRoomMerged(room) {
            const r = room !== undefined && room !== null ? room : this.currentChatRoom;
            if (!r || !r.id) return;
            try {
                const { data: existing, error } = await window.$supabase
                    .from('chat_rooms')
                    .select('context')
                    .eq('id', r.id)
                    .maybeSingle();
                if (!error) {
                    const existingCtx = this.normalizeRoomContext(existing?.context);
                    const incomingCtx = this.normalizeRoomContext(r.context);
                    const merged = this.deepMergeObjects(existingCtx, incomingCtx);
                    this.writeChatRoomContext(merged, r);
                }
            } catch (e) {
                // ignore: merge 실패해도 아래 저장은 진행
            }
            await backend.putObject('db://chat_rooms', r);
        },
        normalizePayloadFiles(payload) {
            const files = [];
            const pushIfFile = (candidate) => {
                if (!candidate) return;
                if (Array.isArray(candidate)) {
                    for (const c of candidate) pushIfFile(c);
                    return;
                }
                if (
                    candidate.fileUrl ||
                    candidate.url ||
                    candidate.publicUrl ||
                    candidate.fullPath ||
                    candidate.path ||
                    candidate.fileName ||
                    candidate.name
                ) {
                    files.push(candidate);
                }
            };

            const single = payload?.file;
            pushIfFile(single);
            pushIfFile(payload?.files);
            pushIfFile(payload?.attachments);
            pushIfFile(payload?.fileList);
            pushIfFile(payload?.uploadedFiles);
            // 일부 payload는 file 객체 안에 다시 files 배열을 담는다.
            pushIfFile(single?.files);
            pushIfFile(single?.attachments);

            const uniq = [];
            const seen = new Set();
            for (const f of files) {
                const key = `${f.fileUrl || f.url || f.publicUrl || f.fullPath || f.path || ''}|${f.fileName || f.name || ''}`;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                uniq.push(f);
            }
            return uniq;
        },
        getPayloadFileSummary(payload) {
            const files = this.normalizePayloadFiles(payload);
            const primary = files[0] || null;
            return {
                files,
                primary,
                hasFile: files.length > 0,
                fileCount: files.length,
                firstFileName: (primary?.name || primary?.fileName || '').toString()
            };
        },
        getPayloadRawFiles(payload) {
            const src = Array.isArray(payload?.rawFiles) ? payload.rawFiles : [];
            return src.filter((f) => f && typeof f === 'object' && (f?.name || f?.fileName));
        },
        mapRawFilesToDisplayInfos(rawFiles) {
            const list = Array.isArray(rawFiles) ? rawFiles : [];
            return list.map((f) => ({
                fileName: (f?.name || f?.fileName || '').toString(),
                name: (f?.name || f?.fileName || '').toString(),
                fileUrl: '',
                publicUrl: '',
                fullPath: '',
                path: '',
                fileType: (f?.type || '').toString(),
                fileSize: Number.isFinite(f?.size) ? f.size : null
            }));
        },
        async uploadRawFilesForRoom(roomId, rawFiles) {
            const uploaded = [];
            const list = Array.isArray(rawFiles) ? rawFiles : [];
            for (const f of list) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const uploadResult = await backend.uploadFileToStorage(f, roomId ? { room_id: roomId } : {});
                    const resolvedUrl =
                        uploadResult?.public_url ||
                        uploadResult?.publicUrl ||
                        uploadResult?.fullPath ||
                        uploadResult?.fileUrl ||
                        uploadResult?.url ||
                        uploadResult?.path ||
                        '';
                    // memento 는 청크 file_id 를 storage 경로(=응답 file_path, 예: 'files/<uuid>.pdf')로 저장한다.
                    // 그 값을 fileId 로 잡아둬야 deepagent 의 knowledge_doc_ids 로 전달돼 문서 조회가 된다.
                    const mementoFileId = uploadResult?.file_path || uploadResult?.file_id || uploadResult?.fullPath || '';
                    uploaded.push({
                        fileName: (f?.name || '').toString(),
                        name: (f?.name || '').toString(),
                        fileUrl: resolvedUrl,
                        publicUrl: uploadResult?.publicUrl || resolvedUrl,
                        fullPath: uploadResult?.fullPath || resolvedUrl,
                        path: uploadResult?.path || uploadResult?.file_path || '',
                        fileId: mementoFileId,
                        file_id: mementoFileId,
                        filePath: uploadResult?.file_path || '',
                        fileType: (f?.type || '').toString(),
                        fileSize: Number.isFinite(f?.size) ? f.size : null
                    });
                } catch (e) {
                    uploaded.push({
                        fileName: (f?.name || '').toString(),
                        name: (f?.name || '').toString(),
                        fileUrl: '',
                        publicUrl: '',
                        fullPath: '',
                        path: '',
                        fileType: (f?.type || '').toString(),
                        fileSize: Number.isFinite(f?.size) ? f.size : null,
                        uploadError: true
                    });
                }
            }
            return uploaded;
        },
        normalizeChatAttachmentRow(file, roomId) {
            if (!file || typeof file !== 'object') return null;
            const fileName = (file.fileName || file.name || '').toString().trim();
            const filePath =
                (file.fileUrl || file.url || file.publicUrl || file.fullPath || file.path || '').toString() || '';
            if (!fileName && !filePath) return null;
            return {
                id: this.uuid(),
                file_name: fileName || (filePath ? String(filePath).split('/').pop() : '') || 'attachment',
                file_path: filePath,
                chat_room_id: (roomId || '').toString(),
                user_name: this.userInfo?.name || this.userInfo?.username || this.userInfo?.email || '',
                tenant_id: window.$tenantName || localStorage.getItem('tenantId') || 'process-gpt'
            };
        },
        async saveChatAttachments(roomId, rawFiles) {
            try {
                const files = this.normalizePayloadFiles({ files: rawFiles });
                if (!roomId || files.length === 0) return;
                const list = Array.isArray(this.plannedAttachments) ? this.plannedAttachments : [];
                const seen = new Set(
                    list.map((a) => `${a?.file_path || ''}|${a?.file_name || ''}`).filter(Boolean)
                );
                const localAdded = [];
                for (const f of files) {
                    const row = this.normalizeChatAttachmentRow(f, roomId);
                    if (!row) continue;
                    const key = `${row.file_path || ''}|${row.file_name || ''}`;
                    if (key && seen.has(key)) continue;
                    seen.add(key);
                    localAdded.push(row);
                    // eslint-disable-next-line no-await-in-loop
                    await backend.putObject('db://chat_attachments', row);
                }
                // realtime 구독 콜백을 기다리지 않고 즉시 사이드바 반영
                if (localAdded.length > 0) {
                    this.plannedAttachments = [...list, ...localAdded];
                    this.planSideInfoEnabled.attachments = true;
                    this.upsertAttachmentsPanel();
                }
            } catch (e) {
                // 첨부 저장 실패해도 메시지는 진행 (단, 디버깅 위해 로그는 남긴다)
                try {
                    // eslint-disable-next-line no-console
                    console.warn('[chat_attachments] save failed:', e?.message || e, e);
                } catch (e2) {}
            }
        },
        async bootstrapTargetUser(userId) {
            this.isLoadingTargetUser = true;
            try {
                this.userInfo = await backend.getUserInfo();
                const u = await backend.getUserById(userId);
                this.targetUser = u || null;
                // 유저 목록에서 진입 시 항상 새 채팅으로 시작 (기존 방이 있어도 자동 오픈하지 않음)
                this.activeRoomId = null;
                this.resetDraft();
            } catch (e) {
                this.targetUser = null;
                this.contextRoomTabs = [];
                this.activeRoomId = null;
            } finally {
                this.isLoadingTargetUser = false;
            }
        },
        // userId 컨텍스트에서 드래프트 첫 전송 -> 방 생성 후 (라우팅 없이) 탭/방으로 전환
        async handleSendMessageUserContextDraft(payload) {
            const fileMeta = this.getPayloadFileSummary(payload);
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !fileMeta.hasFile)) return;
            if (!this.userInfo || !this.targetUser) return;
            if (this.isSending) return;

            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = fileMeta.hasFile;
            if (!text && !hasImages && !hasFile) return;

            this.isSending = true;
            try {
                const me = this.normalizeParticipant(this.userInfo);
                const tu = this.normalizeParticipant(this.targetUser);
                const roomId = this.uuid();
                const nowIso = new Date().toISOString();

                const orchestration = (payload?.orchestration || '').toString().trim() || this.getRoomOrchestration();
                const canWrite = this.shouldClientWriteChatDb(orchestration);
                const room = {
                    id: roomId,
                    name:
                        String(this.draftName || this.$t('chatListing.newChat'))
                            .trim()
                            .substring(0, 50) || this.$t('chatListing.newChat'),
                    participants: this.getDraftParticipantsFallback([me, tu]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso },
                    context: {
                        orchestration: orchestration
                    }
                };
                if (canWrite) {
                    await backend.putObject('db://chat_rooms', room);
                }

                const msgUuid = this.uuid();
                const msg = {
                    uuid: msgUuid,
                    // 클라이언트에서 생성한 안정적인 ID(optimistic/realtime dedupe에 사용)
                    clientUuid: msgUuid,
                    role: 'user',
                    // 첨부만 있을 때 자동 문구를 넣지 않음 (메시지는 첨부 UI로만 표시)
                    content: text || '',
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: fileMeta.primary || null,
                    pdfFiles: fileMeta.files
                };
                if (canWrite) {
                    await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });
                }

                // room last message
                const fileName = (fileMeta.firstFileName || '').toString();
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileMeta.fileCount > 1 ? `${fileName} 외 ${fileMeta.fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                if (hasFile) {
                    await this.saveChatAttachments(roomId, fileMeta.files);
                }
                room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                if (canWrite) {
                    await backend.putObject('db://chat_rooms', room);
                }
                this.EventBus.emit('chat-rooms-updated');

                // userId 컨텍스트 유지: 라우팅 없이 내부 상태로 전환
                this.activeRoomId = roomId;
                // UI 즉시 반영(이후 roomId watcher가 bootstrapRoom으로 동기화)
                this.currentChatRoom = room;
                this.upsertMessageByKeys(msg);
                this.$nextTick(() => this.scrollToBottomSafe());

                if (orchestration) {
                    payload.orchestration = orchestration;
                    payload.message_uuid = msgUuid;

                    // roomId watcher에 의해 bootstrapRoom이 실행되어 this.messages가 초기화되는 것을
                    // 기다린 후 streamAgents를 호출해야 '생각 중...' 로딩 메시지가 사라지지 않음
                    await this.$nextTick();
                    if (this.isLoadingRoom) {
                        await new Promise((resolve) => {
                            const unwatch = this.$watch('isLoadingRoom', (newVal) => {
                                if (!newVal) {
                                    unwatch();
                                    resolve();
                                }
                            });
                        });
                    }

                    const agentTargets = await this.resolveAgentTargetsForMessage(msg.content || '', payload.mentionedUsers || []);
                    if (agentTargets.length > 0) {
                        await this.streamAgents(agentTargets, msg.content || '', payload);
                    }
                }
            } catch (e) {
                // ignore
            } finally {
                this.isSending = false;
                this.focusComposerInput();
            }
        },
        async handleSendMessageContextDraft(payload) {
            const fileMeta = this.getPayloadFileSummary(payload);
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !fileMeta.hasFile)) return;
            if (!this.userInfo || !this.contextAgentId) return;
            if (this.isSending) return;

            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = fileMeta.hasFile;
            if (!text && !hasImages && !hasFile) return;

            this.isSending = true;
            try {
                if (!this.contextAgent) {
                    const a = this.defaultSetting?.getAgentById?.(this.contextAgentId);
                    this.contextAgent = a || (await backend.getUserById(this.contextAgentId));
                }

                const me = this.normalizeParticipant(this.userInfo);
                const ag = this.normalizeParticipant(this.contextAgent);
                const roomId = this.uuid();
                const nowIso = new Date().toISOString();

                const orchestration = (payload?.orchestration || '').toString().trim() || this.getRoomOrchestration();
                const canWrite = this.shouldClientWriteChatDb(orchestration);
                const room = {
                    id: roomId,
                    name:
                        String(this.draftName || this.$t('chatListing.newChat'))
                            .trim()
                            .substring(0, 50) || this.$t('chatListing.newChat'),
                    participants: this.getDraftParticipantsFallback([me, ag]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso },
                    context: {
                        orchestration: orchestration
                    }
                };

                if (canWrite) {
                    await backend.putObject('db://chat_rooms', room);
                }

                const msgUuid = this.uuid();
                const msg = {
                    uuid: msgUuid,
                    // 클라이언트에서 생성한 안정적인 ID(optimistic/realtime dedupe에 사용)
                    clientUuid: msgUuid,
                    role: 'user',
                    // 첨부만 있을 때 자동 문구를 넣지 않음 (메시지는 첨부 UI로만 표시)
                    content: text || '',
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: fileMeta.primary || null,
                    pdfFiles: fileMeta.files
                };
                if (canWrite) {
                    await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });
                }

                const fileName = (fileMeta.firstFileName || '').toString();
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileMeta.fileCount > 1 ? `${fileName} 외 ${fileMeta.fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                if (hasFile) {
                    await this.saveChatAttachments(roomId, fileMeta.files);
                }
                room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                if (canWrite) {
                    await backend.putObject('db://chat_rooms', room);
                }
                this.EventBus.emit('chat-rooms-updated');

                // embedded에서는 라우팅하지 않고 내부 state로 전환
                this.activeRoomId = roomId;
                // UI 즉시 반영(이후 roomId watcher가 bootstrapRoom으로 동기화)
                this.currentChatRoom = room;
                this.upsertMessageByKeys(msg);
                this.$nextTick(() => this.scrollToBottomSafe());

                if (orchestration) {
                    payload.orchestration = orchestration;
                    payload.message_uuid = msgUuid;

                    // roomId watcher에 의해 bootstrapRoom이 실행되어 this.messages가 초기화되는 것을
                    // 기다린 후 streamAgents를 호출해야 '생각 중...' 로딩 메시지가 사라지지 않음
                    await this.$nextTick();
                    if (this.isLoadingRoom) {
                        await new Promise((resolve) => {
                            const unwatch = this.$watch('isLoadingRoom', (newVal) => {
                                if (!newVal) {
                                    unwatch();
                                    resolve();
                                }
                            });
                        });
                    }

                    const agentTargets = await this.resolveAgentTargetsForMessage(msg.content || '', payload.mentionedUsers || []);
                    if (agentTargets.length > 0) {
                        await this.streamAgents(agentTargets, msg.content || '', payload);
                    }
                }
            } catch (e) {
                // ignore
            } finally {
                this.isSending = false;
                this.focusComposerInput();
            }
        },
        resetDraft() {
            this.draftName = this.$t('chatListing.newChat');
            const me = this.normalizeParticipant(this.userInfo);
            const target = this.isDraftContextView
                ? this.normalizeParticipant(this.contextAgent)
                : this.normalizeParticipant(this.targetUser);
            this.draftParticipants = [me, target].filter(Boolean);
        },
        getDraftParticipantsFallback(fallbackParts) {
            const me = this.normalizeParticipant(this.userInfo);
            const normalized = (this.draftParticipants || []).map(this.normalizeParticipant).filter(Boolean);
            const base = normalized.length > 0 ? normalized : (fallbackParts || []).filter(Boolean);
            const ensureMe = me && !base.some((p) => this.participantMatches(p, me)) ? [...base, me] : base;
            // 최소 2명(나+상대) 보장
            return ensureMe.filter(Boolean);
        },
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },
        getBasePath() {
            try {
                return window.location.port === '' ? window.location.origin : '';
            } catch (e) {
                return '';
            }
        },
        getParticipantProfile(participant) {
            const basePath = this.getBasePath();
            if (!participant) return `${basePath}/images/defaultUser.png`;
            if (participant?.id === 'system_id' || participant?.email === 'system@uengine.org') return `${basePath}/images/chat-icon.png`;
            const agent = participant?.id ? this.defaultSetting?.getAgentById?.(participant.id) : null;
            const agentProfile = agent?.profile || null;
            const profile = participant?.profile || agentProfile || null;
            if (profile) {
                if (String(profile).includes('defaultUser.png')) return `${basePath}/images/defaultUser.png`;
                return profile;
            }
            return `${basePath}/images/defaultUser.png`;
        },
        getParticipantAlt(participant) {
            if (!participant) return 'participant';
            return participant?.username || participant?.name || participant?.email || participant?.id || 'participant';
        },
        normalizeParticipant(p) {
            if (!p) return null;
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null,
                agent_type: p?.agent_type || p?.agentType || null,
                is_agent: p?.is_agent ?? p?.isAgent ?? null
            };
        },
        participantMatches(a, b) {
            if (!a || !b) return false;
            if (a.email && b.email && a.email === b.email) return true;
            if (a.id && b.id && a.id === b.id) return true;
            return false;
        },
        async loadUserList() {
            this.isLoadingUsers = true;
            try {
                const list = await backend.getUserList(null);
                const base = Array.isArray(list) ? list : [];
                const meEmail = this.userInfo?.email || null;
                const meId = this.userInfo?.id || this.userInfo?.uid || null;
                const withoutMe = base.filter((u) => {
                    const id = u?.id || u?.uid || null;
                    const email = u?.email || null;
                    if (meId && id && meId === id) return false;
                    if (meEmail && email && meEmail === email) return false;
                    return true;
                });

                // Process GPT Agent 최상단 고정
                this.userList = [processGptAgent, ...withoutMe.filter((u) => (u?.id || u?.uid) !== processGptAgent.id)];
            } catch (e) {
                this.userList = [processGptAgent];
            } finally {
                this.isLoadingUsers = false;
            }
        },
        // 음성 모드에서 드래프트 → 방 전환 시: messages 초기화 없이 구독만 설정
        async _bootstrapRoomForVoice(roomId) {
            try {
                if (!this.userInfo) this.userInfo = await backend.getUserInfo();
                if (!this.userList || this.userList.length === 0) {
                    await this.loadUserList();
                }
                // 방 정보는 _ensureRoomForVoice에서 이미 세팅됨 — 구독·워밍업만 수행
                await this.subscribeToRoom(roomId);
                this.EventBus.emit('chat-room-selected', roomId);
                this.startChatAccessHeartbeat(roomId);
                this.warmupAgentsForCurrentRoom();
                this.$nextTick(() => this.scrollToBottomSafe?.());
                this.focusComposerInput();
            } catch (e) {
                // ignore — 실패해도 음성 대화는 계속
            }
        },

        async bootstrapRoom(roomId) {
            this.isLoadingRoom = true;
            let bootstrapSucceeded = false;
            // 방 전환 시 아티팩트 패널 초기화
            this.artifactPanels = [];
            this.roomWorkspaceFilesByGroup = {};
            this.workspaceSaveStateByGroup = {};
            this.activeArtifactId = null;
            this.artifactSidebarVisible = false;
            this.artifactSidebarWidth = this.artifactSidebarWideWidth;
            // 방 전환 시 plan_* 사이드 정보 초기화
            this.plannedToolsById = {};
            this.plannedSkills = [];
            this.plannedConnectors = [];
            this.plannedTodos = [];
            this.plannedAttachments = [];
            this.planSideInfoEnabled = { activity: false, tools: false, skills: false, connectors: false, todos: false, attachments: false, knowledge: true };
            this.plannedActivityById = {};
            this._activityOrder = 0;
            // 방 전환 시 지식 베이스 선택 상태도 초기화 (kickoff에서 새로 세팅 가능)
            this.selectedKnowledgeDocs = [];
            try {
                // 방 전환 시 히스토리 페이지네이션 상태 초기화
                this.resetHistoryPagination();
                this.userInfo = await backend.getUserInfo();
                if (!this.userList || this.userList.length === 0) {
                    await this.loadUserList();
                }
                await this.loadRoom(roomId);
                this.restoreSideInfoFromRoomContext();
                await this.loadMessages(roomId);
                this.EventBus.emit('chat-room-selected', roomId);
                this.startChatAccessHeartbeat(roomId);
                this.warmupAgentsForCurrentRoom();
                this.$nextTick(() => this.scrollToBottomSafe());
                this.focusComposerInput();
                bootstrapSucceeded = true;
            } catch (e) {
                this.currentChatRoom = null;
                this.messages = [];
            } finally {
                this.isLoadingRoom = false;
            }

            // 실시간 구독은 화면 렌더를 막지 않도록 백그라운드에서 시작
            if (bootstrapSucceeded) {
                Promise.allSettled([this.subscribeToRoom(roomId), this.subscribeToAttachments(roomId)]).catch(() => {});
            }

            // definition-map 메인 채팅에서 생성된 방:
            // 화면 로딩을 막지 않도록 kickoff는 백그라운드로 시작한다.
            this.$nextTick(() => {
                this.maybeKickoffFromSession(roomId).catch(() => {});
            });

            try {
                this.maybeStartAssistantRecoveryPoll(roomId);
            } catch (e) {}
        },
        _roomHasAssistantRow(messages) {
            const list = Array.isArray(messages) ? messages : [];
            return list.some((m) => (m?.role || '').toString() === 'assistant');
        },
        _roomLooksInFlight(messages) {
            const list = Array.isArray(messages) ? messages : [];
            if (list.length === 0) return false;
            const last = list[list.length - 1] || null;
            const lastRole = (last?.role || '').toString();
            if (lastRole !== 'user') {
                if (lastRole === 'assistant' && last?.isLoading) return true;
                return false;
            }
            return !this._roomHasAssistantRow(list);
        },
        async maybeStartAssistantRecoveryPoll(roomId) {
            const targetRoomId = (roomId || this.currentChatRoom?.id || '').toString();
            if (!targetRoomId) return;
            if (!this._roomLooksInFlight(this.messages)) return;
            await this.pollForAssistantRow(targetRoomId, { timeoutMs: 60_000, intervalMs: 1_200, pageSize: 20 });
        },
        async pollForAssistantRow(roomId, options = {}) {
            const targetRoomId = (roomId || '').toString();
            if (!targetRoomId) return;

            this._assistantRecoveryPollSeq = (this._assistantRecoveryPollSeq || 0) + 1;
            const seq = this._assistantRecoveryPollSeq;

            const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 60_000;
            const intervalMs = Number.isFinite(options.intervalMs) ? Number(options.intervalMs) : 1_200;
            const pageSize = Number.isFinite(options.pageSize) ? Number(options.pageSize) : 20;
            const startedAt = Date.now();

            const sleep = (ms) =>
                new Promise((resolve) => {
                    setTimeout(resolve, Math.max(50, ms || 0));
                });

            while (true) {
                if (seq !== this._assistantRecoveryPollSeq) return;
                const stillSameRoom = (this.currentChatRoom?.id || this.roomId || '').toString() === targetRoomId;
                if (!stillSameRoom) return;
                if (Date.now() - startedAt > timeoutMs) return;

                try {
                    const rows = await backend.getMessages(targetRoomId, {
                        size: pageSize,
                        orderBy: `messages->>timeStamp`,
                        sort: 'desc'
                    });
                    const list = Array.isArray(rows) ? rows : [];
                    const hasAssistant = list.some((row) => (row?.messages?.role || '').toString() === 'assistant');
                    if (hasAssistant) {
                        await this.loadMessages(targetRoomId);
                        return;
                    }
                } catch (e) {}

                // eslint-disable-next-line no-await-in-loop
                await sleep(intervalMs);
            }
        },
        async maybeKickoffFromSession(roomId) {
            try {
                const raw = sessionStorage.getItem(`chatKickoff:${roomId}`);
                if (!raw) return;
                const payload = JSON.parse(raw);
                if (!payload || payload.roomId !== roomId) return;

                // 이미 메시지가 존재하는지 확인(중복 방지)
                const exists = this.messages.find((m) => m?.uuid === payload.msgUuid);
                if (!exists) return;

                // 내가 보낸 메시지인지 확인
                const myEmail = this.userInfo?.email || null;
                if (myEmail && exists?.email && exists.email !== myEmail) return;

                // 1회만 실행
                sessionStorage.removeItem(`chatKickoff:${roomId}`);

                // 메인 화면에서 선택한 지식 베이스 문서를 채팅방으로 인계 — 입력창 칩 + 사이드 컨텍스트 표시
                if (Array.isArray(payload?.knowledgeDocs) && payload.knowledgeDocs.length > 0) {
                    this.selectedKnowledgeDocs = payload.knowledgeDocs;
                    this.upsertKnowledgePanel();
                }

                // 메인 화면에서 전달된 raw File이 있으면 memento 경유 업로드 (임베딩 + 벡터 저장)
                const pendingFiles = window.__pendingMementoFiles;
                if (pendingFiles && pendingFiles.roomId === roomId && Array.isArray(pendingFiles.files) && pendingFiles.files.length > 0) {
                    delete window.__pendingMementoFiles;
                    const embeddingMsgUuid = this.uuid();
                    const fileNames = pendingFiles.files.map((f) => f.name).join(', ');
                    this.upsertMessageByKeys({
                        uuid: embeddingMsgUuid,
                        role: 'assistant',
                        content: `📄 문서 임베딩 중... (${fileNames})`,
                        timeStamp: new Date().toISOString(),
                        isLoading: true
                    });
                    this.$nextTick(() => this.scrollToBottomSafe());

                    const uploadedKickoffFiles = [];
                    for (const f of pendingFiles.files) {
                        try {
                            // eslint-disable-next-line no-await-in-loop
                            const uploadResult = await backend.uploadFileToStorage(f, { room_id: roomId });
                            const resolvedUrl = uploadResult?.public_url || uploadResult?.publicUrl || '';
                            if (resolvedUrl) {
                                uploadedKickoffFiles.push({
                                    fileName: f.name,
                                    fileUrl: resolvedUrl,
                                    publicUrl: resolvedUrl,
                                    fullPath: resolvedUrl,
                                    fileType: f.type,
                                    fileSize: f.size
                                });
                            }
                        } catch (e) {
                            console.error('[ChatRoomPage] memento 임베딩 실패:', e);
                        }
                    }

                    // definition-map kickoff에서는 placeholder 파일(다운로드 비활성)과
                    // 업로드 완료 파일(다운로드 활성)이 중복되지 않도록 "교체"한다.
                    if (uploadedKickoffFiles.length > 0) {
                        payload.files = uploadedKickoffFiles;
                        payload.file = uploadedKickoffFiles[0] || null;
                    }

                    // 임베딩 완료 → 상태 메시지 제거
                    this.messages = this.messages.filter((m) => m?.uuid !== embeddingMsgUuid);
                }

                // kickoff payload와 context.orchestration을 동일하게 맞춘 뒤 스트림
                try {
                    const effectiveOrchestration =
                        ((payload?.orchestration != null ? String(payload.orchestration) : '') || '').trim() ||
                        this.getRoomOrchestration();
                    if (this.shouldClientWriteChatDb(effectiveOrchestration)) {
                        await this.setRoomOrchestration(effectiveOrchestration);
                    }
                    payload.orchestration = effectiveOrchestration;
                } catch (e) {}

                // kickoff 업로드로 파일 정보가 생긴 경우: 기존 사용자 메시지 버블에도 즉시 반영
                try {
                    const kickoffFilesForUserMsg = this.normalizePayloadFiles(payload);
                    if (kickoffFilesForUserMsg.length > 0 && payload?.msgUuid) {
                        const idx = this.messages.findIndex((m) => m?.uuid === payload.msgUuid);
                        if (idx !== -1) {
                            const updated = {
                                ...(this.messages[idx] || {}),
                                pdfFile: kickoffFilesForUserMsg[0] || null,
                                pdfFiles: kickoffFilesForUserMsg
                            };
                            this.messages[idx] = updated;
                            if (this.shouldClientWriteChatDb(payload?.orchestration || this.getRoomOrchestration())) {
                                await backend.putObject(`db://chats/${payload.msgUuid}`, {
                                    uuid: payload.msgUuid,
                                    id: roomId,
                                    messages: updated
                                });
                            }
                        }
                    }
                } catch (e) {}

                // 서버 dedupe용: kickoff payload에 message_uuid가 없으면 msgUuid로 보강
                try {
                    if (!payload.message_uuid && payload.msgUuid) {
                        payload.message_uuid = payload.msgUuid;
                    }
                } catch (e) {}

                const agentTargets = await this.resolveAgentTargetsForMessage(payload.text || '');
                if (agentTargets.length > 0) {
                    const kickoffFiles = this.normalizePayloadFiles(payload);
                    // definition-map kickoff 등 handleSendMessage를 거치지 않는 경로에서도 첨부를 chat_attachments에 저장
                    if (kickoffFiles.length > 0) {
                        try {
                            await this.saveChatAttachments(roomId, kickoffFiles);
                        } catch (e) {}
                    }
                    await this.streamAgents(agentTargets, payload.text || '', {
                        images: payload.images || [],
                        file: kickoffFiles[0] || null,
                        files: kickoffFiles,
                        orchestration: payload.orchestration,
                        // 서버 dedupe용: kickoff 최초 user message uuid 전달
                        message_uuid: payload.message_uuid || payload.msgUuid || null
                    });
                }
            } catch (e) {}
        },
        async loadRoom(roomId) {
            // 우선 로컬 인덱스 사용
            let cachedRoom = null;
            try {
                const raw = localStorage.getItem('chatRoomIndex');
                if (raw) {
                    const idx = JSON.parse(raw);
                    const cached = idx?.[roomId] || null;
                    if (cached) {
                        cachedRoom = cached;
                        this.currentChatRoom = cached;
                    }
                }
            } catch (e) {}

            const rooms = await backend.getChatRoomList('chat_rooms');
            const found = (rooms || []).find((r) => r.id === roomId) || null;
            this.currentChatRoom = found || cachedRoom || { id: roomId, name: this.$t('chatListing.chat'), participants: [] };

            // 최신 context 등을 위해 로컬 인덱스 갱신(가능하면)
            try {
                if (this.currentChatRoom && this.currentChatRoom.id) {
                    const raw = localStorage.getItem('chatRoomIndex');
                    const idx = raw ? JSON.parse(raw) : {};
                    idx[this.currentChatRoom.id] = this.currentChatRoom;
                    localStorage.setItem('chatRoomIndex', JSON.stringify(idx));
                }
            } catch (e) {}
        },

        /** chat_rooms.context → 우측 plan_* 박스 복원 (첨부는 chat_attachments에서 복원) */
        restoreSideInfoFromRoomContext() {
            try {
                const ctx = this.readChatRoomContext(this.currentChatRoom);
                if (!ctx || typeof ctx !== 'object') return;

                const tools = Array.isArray(ctx.tools) ? ctx.tools : [];
                const skills = Array.isArray(ctx.skills) ? ctx.skills : [];
                const todos = Array.isArray(ctx.todos) ? ctx.todos : [];
                const connectors = Array.isArray(ctx.connectors) ? ctx.connectors : [];

                // enabled.* 플래그는 실사용 여부와 무관하게 세팅될 수 있으므로,
                // 실제 항목이 존재할 때만 패널을 활성화한다.
                const enabledSkills = skills.length > 0;
                const enabledTodos = todos.length > 0;

                // ctx.tools → 활동 패널 복원 (도구·서브에이전트 실행 내역)
                if (tools.length > 0) {
                    this._activityOrder = 0;
                    this.plannedActivityById = {};
                    for (let i = 0; i < tools.length; i++) {
                        const t = tools[i] || {};
                        const toolName = (t.tool || t.name || '').toString();
                        if (!toolName) continue;
                        this.recordActivity({
                            id: (t.id || '').toString() || `restored-${i}`,
                            tool: toolName,
                            name: toolName,
                            displayName: (t.displayName || t.display_name || '').toString() || this.formatToolName(toolName),
                            kind: toolName === 'task' ? 'subagent' : 'tool',
                            subagentType: (t.subagentType || t.subagent_type || '').toString(),
                            status: (t.status || 'done').toString()
                        });
                    }
                }

                // ctx.knowledgeDocs → 지식 베이스 패널 복원
                const knowledgeDocs = Array.isArray(ctx.knowledgeDocs) ? ctx.knowledgeDocs : [];
                if (knowledgeDocs.length > 0) {
                    this.selectedKnowledgeDocs = knowledgeDocs;
                    this.upsertKnowledgePanel();
                }

                if (enabledSkills) {
                    this.planSideInfoEnabled.skills = true;
                    this.plannedSkills = skills;
                    this.upsertSkillsPanel();
                }

                if (connectors.length > 0) {
                    this.planSideInfoEnabled.connectors = true;
                    this.plannedConnectors = connectors;
                    this.upsertConnectorsPanel();
                }

                if (enabledTodos) {
                    this.planSideInfoEnabled.todos = true;
                    this.plannedTodos = todos;
                    this.upsertTodosPanel();
                }
            } catch (e) {
                // ignore
            }
        },

        getRoomOrchestration() {
            try {
                const ctx = this.readChatRoomContext(this.currentChatRoom);
                const value = (ctx?.orchestration || '').toString().trim();
                return value || 'langchain-react';
            } catch (e) {
                return 'langchain-react';
            }
        },
        getAgentRouterForOrchestration(orchestration) {
            const o = (orchestration || '').toString().trim();
            return o === 'deepagents' ? deepAgentRouterService : agentRouterService;
        },
        getMainAgentServiceForOrchestration(orchestration) {
            const o = (orchestration || '').toString().trim();
            return o === 'deepagents' ? fixedDeepagentsMainAgentService : fixedLangchainMainAgentService;
        },
        async setRoomOrchestration(orchestration) {
            try {
                if (!this.currentChatRoom?.id) return;
                const nextValue = (orchestration || '').toString().trim();
                if (!nextValue) return;
                const prevCtx = this.readChatRoomContext(this.currentChatRoom);
                const nextCtx = {
                    ...(prevCtx && typeof prevCtx === 'object' ? prevCtx : {}),
                    orchestration: nextValue,
                    updatedAt: new Date().toISOString()
                };
                this.writeChatRoomContext(nextCtx, this.currentChatRoom);
                await this.putChatRoomMerged(this.currentChatRoom);
            } catch (e) {
                // ignore
            }
        },

        async loadMessages(roomId) {
            this.messages = [];
            this.resetHistoryPagination();
            if (!roomId) return;

            this.isLoadingHistory = true;
            try {
                // 최신 10개만 불러오기 (최신 desc -> 화면은 asc로 보여주기 위해 reverse)
                const rows = await backend.getMessages(roomId, {
                    size: this.historyPageSize,
                    orderBy: `messages->>timeStamp`,
                    sort: 'desc'
                });
                const list = Array.isArray(rows) ? rows : [];
                const mapped = list.map((row) => {
                    const raw = row?.messages || {};
                    // NOTE: row.uuid(DB row key)와 메시지 uuid(클라 생성/메시지 식별자)를 분리해서 보관한다.
                    // 과거에는 row.uuid로 m.uuid를 덮어써서 optimistic uuid와 불일치 시 중복 표시가 발생할 수 있었다.
                    const m = { ...(raw || {}) };
                    m.rowUuid = row?.uuid || null;
                    m.uuid = m.uuid || m.clientUuid || m.rowUuid || this.uuid();
                    m.clientUuid = m.clientUuid || m.uuid;
                    return this.normalizeAssistantMessageForDisplay(m);
                });
                // desc로 받아왔으니 asc로 정렬된 형태가 되도록 reverse
                const asc = mapped.reverse();
                // ===== 시간순 정렬 보강 =====
                // chats 테이블은 created_at 컬럼이 없고 timeStamp 는 messages JSONB 내부에 저장된다.
                // 과거 SDK 가 timeStamp 를 넣지 않은 메시지들(NULL timeStamp)이 섞여 있으면
                // ORDER BY messages->>timeStamp DESC NULLS FIRST 결과를 reverse 했을 때
                // NULL timeStamp 가 항상 배열 끝으로 밀려나 순서가 어긋난다.
                // 1) NULL timeStamp 항목은 양쪽 이웃의 timeStamp 사이로 보간(neighbor interpolation).
                // 2) 그 후 (timeStamp, rowUuid) 기준으로 안정 정렬해 결정성을 보장한다.
                this._backfillMissingTimeStamps(asc);
                this._stableSortMessages(asc);
                this.messages = asc;

                // 채팅 메시지에 박혀있는 pdf2bpmn 그래프 payload 를 캐시로 hydrate.
                // 새로고침/방 재진입 시 외부 API 호출 없이 그래프 미리보기가 가능해진다.
                try {
                    for (const m of this.messages || []) {
                        const r = m && m.pdf2bpmnResult;
                        if (!r) continue;
                        if (!r.taskId) continue;
                        if (!r.integratedGraph && !(r.processGraphs && Object.keys(r.processGraphs).length)) continue;
                        this._cachePdf2bpmnGraphPayload({
                            taskId: r.taskId,
                            integratedGraph: r.integratedGraph,
                            processGraphs: r.processGraphs,
                            graphName: r.graphName
                        });
                    }
                } catch (e) {
                    // ignore
                }

                this.hasMoreHistory = mapped.length >= this.historyPageSize;
                this.oldestLoadedTimeStamp = this.messages?.[0]?.timeStamp || null;
            } catch (e) {
                this.messages = [];
                this.hasMoreHistory = false;
                this.oldestLoadedTimeStamp = null;
            } finally {
                this.isLoadingHistory = false;
            }
            await this.backfillPdf2bpmnTaskIds(roomId);
            // 기존 채팅방 재진입 시: 이전 pdf2bpmn 작업 감지/구독 복구
            await this.checkExistingPdf2BpmnTask(roomId);
            this.processLoadedHwpxMessages();
            this.checkExistingArtifactPanels();
            this.$nextTick(() => this.scrollToBottomSafe());
        },

        _extractTaskIdFromRunId(runId) {
            const text = String(runId || '').trim();
            if (!text) return '';
            const m = text.match(/^([a-f0-9-]{36})(?:-|$)/i);
            return m ? String(m[1]).trim() : '';
        },

        async backfillPdf2bpmnTaskIds(roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            if (!window.$supabase) return;
            if (!Array.isArray(me.messages) || me.messages.length === 0) return;

            for (const msg of me.messages) {
                try {
                    const result = msg?.pdf2bpmnResult;
                    if (!result) continue;
                    if (String(result.taskId || '').trim()) continue;
                    const saved = Array.isArray(result.savedProcesses) ? result.savedProcesses : [];
                    const firstProcId = String(saved?.[0]?.id || '').trim();
                    if (!firstProcId) continue;

                    const { data: procDef, error } = await window.$supabase
                        .from('proc_def')
                        .select('id, definition')
                        .eq('id', firstProcId)
                        .single();
                    if (error || !procDef) continue;

                    const def = procDef.definition || {};
                    const ex = def.extraction || {};
                    const runId = ex?.integrated_graph_ref?.run_id || ex?.graph_run_id || ex?.graph_snapshot_ref?.run_id || '';
                    const taskId = me._extractTaskIdFromRunId(runId);
                    if (!taskId) continue;

                    result.taskId = taskId;
                    me.pdf2bpmnTaskIdByRoomId[targetRoomId] = taskId;
                    const st = me._getOrInitPdf2bpmnProgress(targetRoomId);
                    if (st && !st.taskId) st.taskId = taskId;
                    await me.saveMessageToRoom(msg, targetRoomId);
                } catch (e) {
                    // ignore
                }
            }
        },

        resetHistoryPagination() {
            this.isLoadingHistory = false;
            this.hasMoreHistory = true;
            this.oldestLoadedTimeStamp = null;
        },

        async loadMoreMessages() {
            // Chat.vue(스크롤)에서 상단 도달 시 emit(getMoreChat)
            const targetRoomId = this.currentChatRoom?.id || this.roomId || null;
            if (!targetRoomId) return;
            if (this.isLoadingHistory) return;
            if (!this.hasMoreHistory) return;

            const cursorTs = this.oldestLoadedTimeStamp;
            if (!cursorTs) return;

            // 현재 스크롤 위치 고정(상단 prepend 시 점프 방지)
            let container = null;
            try {
                container = this.$refs?.chatView?.$refs?.scrollContainer?.$el || null;
            } catch (e) {
                container = null;
            }
            const prevScrollHeight = container?.scrollHeight || 0;
            const prevScrollTop = container?.scrollTop || 0;

            this.isLoadingHistory = true;
            try {
                const rows = await backend.getMessages(targetRoomId, {
                    size: this.historyPageSize,
                    orderBy: `messages->>timeStamp`,
                    sort: 'desc',
                    endBefore: cursorTs
                });
                const list = Array.isArray(rows) ? rows : [];
                if (list.length === 0) {
                    this.hasMoreHistory = false;
                    return;
                }

                const mapped = list
                    .map((row) => {
                        const raw = row?.messages || {};
                        const m = { ...(raw || {}) };
                        m.rowUuid = row?.uuid || null;
                        m.uuid = m.uuid || m.clientUuid || m.rowUuid || this.uuid();
                        m.clientUuid = m.clientUuid || m.uuid;
                        return this.normalizeAssistantMessageForDisplay(m);
                    })
                    .reverse(); // asc

                // 중복 방지(uuid 기준)
                const existingKeys = new Set((this.messages || []).flatMap((m) => [m?.uuid, m?.clientUuid, m?.rowUuid]).filter(Boolean));
                const toPrepend = mapped.filter((m) => {
                    const keys = [m?.uuid, m?.clientUuid, m?.rowUuid].filter(Boolean);
                    return !keys.some((k) => existingKeys.has(k));
                });
                if (toPrepend.length > 0) {
                    // legacy 메시지(timeStamp 없음)는 backfill 후 (timeStamp asc, rowUuid asc) 로 안정 정렬
                    const merged = [...toPrepend, ...(this.messages || [])];
                    this._backfillMissingTimeStamps(merged);
                    this._stableSortMessages(merged);
                    this.messages = merged;
                    this.oldestLoadedTimeStamp = this.messages?.[0]?.timeStamp || this.oldestLoadedTimeStamp;
                }

                this.hasMoreHistory = list.length >= this.historyPageSize;
                this.processLoadedHwpxMessages();

                // prepend 후 스크롤 위치 복구
                this.$nextTick(() => {
                    try {
                        const c = container || this.$refs?.chatView?.$refs?.scrollContainer?.$el;
                        if (!c) return;
                        const nextScrollHeight = c.scrollHeight || 0;
                        const delta = nextScrollHeight - prevScrollHeight;
                        c.scrollTop = prevScrollTop + delta;
                    } catch (e) {}
                });
            } catch (e) {
                // 네트워크/쿼리 오류 시에는 더 불러오기를 멈추지 않고 다음 시도 가능하게 둔다.
            } finally {
                this.isLoadingHistory = false;
            }
        },
        async subscribeToRoom(roomId) {
            try {
                if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                    await this.chatsWatchRef.unsubscribe();
                }
            } catch (e) {}
            this.chatsWatchRef = null;
            if (!roomId) return;
            this.chatsWatchRef = await backend.watchChats(
                (payload) => {
                    this.handleRealtimeMessage(payload);
                },
                { filter: `id=eq.${roomId}` }
            );
        },
        async subscribeToAttachments(roomId) {
            try {
                if (this.attachmentsWatchRef && typeof this.attachmentsWatchRef.unsubscribe === 'function') {
                    await this.attachmentsWatchRef.unsubscribe();
                }
            } catch (e) {}
            this.attachmentsWatchRef = null;
            if (!roomId) return;
            this.plannedAttachments = [];
            this.planSideInfoEnabled.attachments = false;
            this.attachmentsWatchRef = await backend.getAttachments(roomId, (attachment) => {
                try {
                    if (!attachment) return;
                    const list = Array.isArray(this.plannedAttachments) ? this.plannedAttachments : [];
                    const id = (attachment?.id || '').toString();
                    const exists = id ? list.some((a) => (a?.id || '').toString() === id) : false;
                    const next = exists ? list : [...list, attachment];
                    this.plannedAttachments = next;
                    this.planSideInfoEnabled.attachments = next.length > 0;
                    if (this.planSideInfoEnabled.attachments) this.upsertAttachmentsPanel();
                } catch (e) {}
            });
        },
        handleRealtimeMessage(payload) {
            try {
                if (!payload) return;
                if (payload.eventType === 'DELETE') {
                    const oldUuid = payload.old?.uuid;
                    if (!oldUuid) return;
                    const idx = this.messages.findIndex((m) => m?.rowUuid === oldUuid || m?.uuid === oldUuid || m?.clientUuid === oldUuid);
                    if (idx !== -1) this.messages.splice(idx, 1);
                    return;
                }
                if (!payload.new) return;
                const roomId = payload.new.id;
                if (!this.roomId || roomId !== this.roomId) return;
                const incomingRaw = payload.new.messages;
                if (!incomingRaw) return;

                // incoming 메시지의 uuid(클라 생성/메시지 식별자)를 우선으로 사용해서 optimistic 메시지와 동일 키로 매칭되게 한다.
                const rowUuid = payload.new.uuid || null;
                const incoming = typeof incomingRaw === 'object' ? { ...(incomingRaw || {}) } : incomingRaw;
                const logicalUuid = incoming?.uuid || incoming?.clientUuid || rowUuid;
                if (!logicalUuid) return;

                if (typeof incoming === 'object') {
                    incoming.rowUuid = rowUuid || incoming.rowUuid || null;
                    incoming.uuid = incoming.uuid || logicalUuid;
                    incoming.clientUuid = incoming.clientUuid || incoming.uuid;
                    this.normalizeAssistantMessageForDisplay(incoming);
                }

                const keys = new Set([logicalUuid, rowUuid, incoming?.uuid, incoming?.clientUuid].filter(Boolean));
                const exists = this.messages.findIndex((m) => {
                    if (!m) return false;
                    return keys.has(m?.uuid) || keys.has(m?.clientUuid) || keys.has(m?.rowUuid);
                });
                if (exists !== -1) {
                    // 기존 optimistic 메시지를 실시간 데이터로 최신화(필드 merge)
                    const prevSnapshot = this.messages[exists] || {};
                    this.messages[exists] =
                        typeof incoming === 'object'
                            ? this.normalizeAssistantMessageForDisplay({ ...prevSnapshot, ...incoming })
                            : incoming;
                    // optimistic 에만 있던 프런트엔드 전용 상태(__humanFeedback / toolCalls /
                    // pdf2bpmnResult 등) 가 merge 로 살아남았다면, 같은 row 를 UPDATE 해
                    // 새로고침 후에도 HITL 패널·진행상황·미리보기가 유지되게 한다.
                    this.persistMessageFrontendState(this.messages[exists], roomId);
                    return;
                }
                // activeStreams에서 이 realtime 메시지에 대응하는 스트리밍 항목을 찾아 제거한다.
                // 프런트엔드 전용 상태(__humanFeedback / toolCalls 등)는 incoming으로 이관해
                // 새로고침 후에도 HITL 패널이 유지되도록 한다.
                try {
                    if (typeof incoming === 'object' && (incoming.role || '').toString() === 'assistant') {
                        const inAgentId = (incoming.agentId || '').toString();
                        const inEmail = (incoming.email || '').toString();

                        const activeKeys = Object.keys(this.activeStreams);
                        const matchKey = activeKeys.find((k) => {
                            const s = this.activeStreams[k];
                            if (inAgentId && s.agentId && s.agentId.toString() === inAgentId) return true;
                            if (inEmail && s.email && s.email.toString() === inEmail) return true;
                            return false;
                        }) ?? (activeKeys.length === 1 ? activeKeys[0] : null);

                        if (matchKey) {
                            this.carryOptimisticOnlyFields(this.activeStreams[matchKey], incoming);
                            delete this.activeStreams[matchKey];
                            this.persistMessageFrontendState(incoming, roomId);
                        }
                    }
                } catch (e) {
                    console.error('activeStreams cleanup error:', e);
                }
                // uuid가 다르게 들어오는 경우(또는 이중 submit)로 인한 중복 방지: 내용/작성자/시간이 거의 동일하면 덮어쓰기
                try {
                    const inRole = (incoming.role || '').toString();
                    const inEmail = (incoming.email || '').toString();
                    const inContent = (incoming.content || '').toString();
                    const inTs = new Date(incoming.timeStamp || 0).getTime();
                    const dupIdx = this.messages.findIndex((m) => {
                        if (!m) return false;
                        if ((m.role || '').toString() !== inRole) return false;
                        if ((m.email || '').toString() !== inEmail) return false;
                        if ((m.content || '').toString() !== inContent) return false;
                        const mts = new Date(m.timeStamp || 0).getTime();
                        return Math.abs(mts - inTs) <= 1500;
                    });
                    if (dupIdx !== -1) {
                        // 들어온 것을 기준으로 최신화(단, uuid는 메시지 uuid를 유지)
                        if (typeof incoming === 'object') {
                            this.messages[dupIdx] = this.normalizeAssistantMessageForDisplay({
                                ...(this.messages[dupIdx] || {}),
                                ...incoming
                            });
                        } else {
                            this.messages[dupIdx] = incoming;
                        }
                        // dupe 머지 시에도 carry 된 프런트엔드 상태를 jsonb 에 영속화.
                        this.persistMessageFrontendState(this.messages[dupIdx], roomId);
                        return;
                    }
                } catch (e) {}
                // 새로 들어온 메시지에 timeStamp 가 없으면 현재 시각으로 설정해
                // 실시간 도착 순서가 유지되도록 한다(legacy SDK 응답 대비 안전망).
                if (incoming && typeof incoming === 'object' && !incoming.timeStamp) {
                    incoming.timeStamp = new Date().toISOString();
                    incoming.__synthTimeStamp = true;
                }
                // deepagent interrupt 패널 보존:
                // interrupt turn 은 (1) 프론트가 _applyDeepagentHitlStop 으로 본문 비운 패널 메시지를 push 하고,
                // (2) SDK(persist_chat_to_db)가 같은 assistant turn 의 '초안 평문'을 별도 uuid 로 INSERT 한다.
                // uuid 가 달라 이 초안 INSERT 가 여기(push-new)로 빠지면, 패널 메시지가 밀려나고 초안 텍스트만 남는다.
                // → 미제출 패널 메시지가 있으면 새 메시지를 추가하지 말고, 패널 메시지에 DB row 식별자만 입혀
                //   (이후 동기화가 패널 메시지로 매칭되게) 본문은 빈 채 유지한다(승인/체크박스 패널만 표시).
                if (typeof incoming === 'object' && (incoming.role || '').toString() === 'assistant') {
                    const inAgentId = (incoming.agentId || '').toString();
                    let panelIdx = -1;
                    for (let i = this.messages.length - 1; i >= 0; i--) {
                        const m = this.messages[i];
                        if (!m || !m.__humanFeedback || m.__humanFeedback.__submitted) continue;
                        if ((m.role || '').toString() !== 'assistant') continue;
                        if (inAgentId && (m.agentId || '').toString() && (m.agentId || '').toString() !== inAgentId) continue;
                        panelIdx = i;
                        break;
                    }
                    if (panelIdx !== -1) {
                        const panelMsg = this.messages[panelIdx];
                        panelMsg.rowUuid = incoming.rowUuid || incoming.uuid || panelMsg.rowUuid || null;
                        if (incoming.uuid) panelMsg.uuid = incoming.uuid;
                        if (incoming.clientUuid) panelMsg.clientUuid = incoming.clientUuid;
                        if (!panelMsg.timeStamp && incoming.timeStamp) panelMsg.timeStamp = incoming.timeStamp;
                        // 본문은 비운 채 유지(초안은 패널 context 로만 표시) — DB 의 초안 평문을 덮어쓰지 않는다.
                        this.persistMessageFrontendState(panelMsg, roomId);
                        return;
                    }
                }
                this.messages.push(incoming);
                this._stableSortMessages(this.messages);
                this.$nextTick(() => this.scrollToBottomSafe());
            } catch (e) {}
        },
        upsertMessageByKeys(message) {
            if (!message) return;
            const keys = [message?.uuid, message?.clientUuid, message?.rowUuid].filter(Boolean);
            const existingIndex = (this.messages || []).findIndex((m) => {
                if (!m) return false;
                if (keys.length > 0) {
                    return keys.includes(m?.uuid) || keys.includes(m?.clientUuid) || keys.includes(m?.rowUuid);
                }
                // 키가 없을 때만 fallback: 동일 작성자/내용/근접 시각이면 동일 메시지로 취급
                const sameRole = (m?.role || '').toString() === (message?.role || '').toString();
                const sameEmail = (m?.email || '').toString() === (message?.email || '').toString();
                const sameContent = (m?.content || '').toString() === (message?.content || '').toString();
                const mts = new Date(m?.timeStamp || 0).getTime();
                const nts = new Date(message?.timeStamp || 0).getTime();
                return sameRole && sameEmail && sameContent && Math.abs(mts - nts) <= 1500;
            });

            if (existingIndex !== -1) {
                this.messages[existingIndex] = this.normalizeAssistantMessageForDisplay({
                    ...(this.messages[existingIndex] || {}),
                    ...message
                });
                return;
            }

            this.messages.push(this.normalizeAssistantMessageForDisplay(message));
        },
        openRenameDialog() {
            this.settingsMenu = false;
            this.renameDraft = (
                this.currentChatRoom?.id ? this.currentChatRoom?.name || '' : this.draftName || this.$t('chatListing.newChat')
            ).toString();
            this.renameDialog = true;
        },
        async confirmRename() {
            const trimmed = String(this.renameDraft || '')
                .trim()
                .substring(0, 50);
            if (!trimmed) {
                this.renameDialog = false;
                return;
            }
            try {
                if (this.currentChatRoom?.id) {
                    this.currentChatRoom.name = trimmed;
                    await this.putChatRoomMerged(this.currentChatRoom);
                    this.EventBus.emit('chat-rooms-updated');
                } else {
                    // draft
                    this.draftName = trimmed;
                }
            } catch (e) {}
            this.renameDialog = false;
        },
        async openParticipantsDialog() {
            this.settingsMenu = false;
            if (!this.userList || this.userList.length === 0) await this.loadUserList();
            const parts = this.currentChatRoom?.id
                ? Array.isArray(this.currentChatRoom?.participants)
                    ? this.currentChatRoom.participants
                    : []
                : Array.isArray(this.draftParticipants)
                ? this.draftParticipants
                : [];
            const me = this.normalizeParticipant(this.userInfo);
            const normalized = parts.map(this.normalizeParticipant).filter(Boolean);
            const hasMe = me ? normalized.some((p) => this.participantMatches(p, me)) : false;
            const withMe = hasMe ? normalized : [...normalized, me].filter(Boolean);
            // autocomplete items와 shape 맞추기
            this.participantsDraft = withMe.map((p) => {
                const u = this.userList.find((x) => this.participantMatches(x, p));
                return u || p;
            });
            this.participantsDialog = true;
        },
        async saveParticipants() {
            try {
                const me = this.normalizeParticipant(this.userInfo);
                const normalized = (this.participantsDraft || []).map(this.normalizeParticipant).filter(Boolean);
                const ensureMe = me && !normalized.some((p) => this.participantMatches(p, me)) ? [...normalized, me] : normalized;
                if (this.currentChatRoom?.id) {
                    this.currentChatRoom.participants = ensureMe;
                    await this.putChatRoomMerged(this.currentChatRoom);
                    this.EventBus.emit('chat-rooms-updated');
                    this.warmupAgentsForCurrentRoom();
                } else {
                    // draft
                    this.draftParticipants = ensureMe;
                }
            } catch (e) {}
            this.participantsDialog = false;
        },
        async warmupAgentsForCurrentRoom() {
            const agents = this.agentParticipants || [];
            const router = this.getAgentRouterForOrchestration(this.getRoomOrchestration());
            await Promise.all(
                agents.map(async (a) => {
                    const id = a?.id;
                    if (!id) return;
                    const cur = this.getAgentStatus(id);
                    if (cur.state === 'warming' || cur.state === 'ready' || cur.state === 'streaming') return;
                    // process-gpt-agent는 router warmup이 아니라 agents endpoint를 쓰므로 즉시 준비됨 처리
                    if (id === PROCESS_GPT_AGENT_ID) {
                        this.setAgentStatus(id, { state: 'ready', message: '' });
                        return;
                    }
                    this.setAgentStatus(id, { state: 'warming', message: '' });
                    try {
                        await router.warmup(id);
                        this.setAgentStatus(id, { state: 'ready', message: '' });
                    } catch (e) {
                        console.error('warmupAgentsForCurrentRoom', e);
                        this.setAgentStatus(id, { state: 'error', message: '준비 실패' });
                    }
                })
            );
        },
        openDeleteConfirm() {
            this.settingsMenu = false;
            this.deleteDialog = true;
        },
        async confirmDelete() {
            const id = this.currentChatRoom?.id || this.roomId;
            this.deleteDialog = false;
            if (!id) return;
            try {
                await backend.delete(`db://chats/${id}`, { key: 'id' });
                await backend.delete(`db://chat_rooms/${id}`, { key: 'id' });
            } catch (e) {}
            this.EventBus.emit('chat-rooms-updated');
            this.EventBus.emit('chat-room-unselected');
            await this.$router.replace({ path: '/chat' });
        },

        // 설정 메뉴의 [도구 설정] 클릭 핸들러.
        // 다이얼로그 UI/영속화는 모두 Chat.vue 내부에서 처리하므로, ref 로 open 신호만 보낸다.
        // (v-menu close-on-content-click 으로 메뉴가 닫히는 시점과 겹칠 수 있어 nextTick 사용)
        openToolsSettingsDialog() {
            this.settingsMenu = false;
            this.$nextTick(() => {
                const chatView = this.$refs.chatView;
                if (chatView && typeof chatView.openToolsSettings === 'function') {
                    chatView.openToolsSettings();
                }
            });
        },
        // 백엔드 전송 시 메타데이터로 실어보낼 도구 설정값 — Chat.vue 와 동일한 localStorage 키에서 직접 읽는다.
        // (Chat 인스턴스가 어느 곳에서 변경했든 항상 최신값이 보장된다)
        readToolsSettingsFromStorage() {
            const STORAGE_KEY = 'process-gpt:toolsSettings';
            const allowedLevels = new Set(['concise', 'standard', 'detailed']);
            const fallback = { pdf2bpmnLevel: 'standard' };
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return fallback;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return fallback;
                const lv = typeof parsed.pdf2bpmnLevel === 'string' && allowedLevels.has(parsed.pdf2bpmnLevel)
                    ? parsed.pdf2bpmnLevel
                    : 'standard';
                return { ...parsed, pdf2bpmnLevel: lv };
            } catch (e) {
                return fallback;
            }
        },

        // ===== 데스크탑 음성 에이전트 =====
        toggleDesktopVoice() {
            if (this.isDesktopVoiceActive) {
                this.stopDesktopVoice();
            } else {
                this.isDesktopVoiceActive = true;
                this.voiceStatus = 'connecting';
            }
        },
        stopDesktopVoice() {
            this.isDesktopVoiceActive = false;
            this.voiceStatus = 'idle';
            this.voiceUserSpeaking = false;
            this.voiceAiMsgId = null;
        },

        // 드래프트 모드(에이전트/유저 선택 후 아직 방이 없는 상태)에서 첫 발화 시 방을 생성
        async _ensureRoomForVoice() {
            if (this.currentChatRoom?.id) return this.currentChatRoom.id;

            const nowIso = new Date().toISOString();
            const roomId = this.uuid();
            let participants = [];

            if (this.isDraftContextView) {
                // 에이전트 드래프트
                if (!this.contextAgent) {
                    try {
                        const a = this.defaultSetting?.getAgentById?.(this.contextAgentId);
                        this.contextAgent = a || (await backend.getUserById(this.contextAgentId));
                    } catch (e) {
                        this.contextAgent = { id: this.contextAgentId, username: 'Agent' };
                    }
                }
                const me = this.normalizeParticipant(this.userInfo);
                const ag = this.normalizeParticipant(this.contextAgent);
                participants = this.getDraftParticipantsFallback([me, ag]);
            } else if (this.isUserContextRouted && this.targetUser) {
                // 유저 드래프트
                const me = this.normalizeParticipant(this.userInfo);
                const tu = this.normalizeParticipant(this.targetUser);
                participants = this.getDraftParticipantsFallback([me, tu]);
            } else {
                return null;
            }

            const room = {
                id: roomId,
                name:
                    String(this.draftName || this.$t('chatListing.newChat'))
                        .trim()
                        .substring(0, 50) || this.$t('chatListing.newChat'),
                participants,
                message: { msg: 'NEW', type: 'text', createdAt: nowIso }
            };
            await backend.putObject('db://chat_rooms', room);
            this.activeRoomId = roomId;
            this.currentChatRoom = room;
            this.EventBus.emit('chat-rooms-updated');
            return roomId;
        },

        async onVoiceUserTranscript(transcript) {
            if (!transcript) return;

            // 사용자 메시지를 async 작업 전에 즉시 UI에 표시
            // (await 중 AI 메시지가 먼저 push되는 순서 역전 방지)
            const nowIso = new Date().toISOString();
            const msgUuid = this.uuid();
            const msg = {
                uuid: msgUuid,
                clientUuid: msgUuid,
                role: 'user',
                content: transcript,
                contentType: 'voice',
                timeStamp: nowIso,
                email: this.userInfo?.email || null,
                name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                images: [],
                pdfFile: null,
                mentionedUsers: [],
                isVoiceMessage: true
            };
            // OpenAI Realtime API는 response.audio_transcript.delta(AI 텍스트)가
            // conversation.item.input_audio_transcription.completed(사용자 전사)보다
            // 먼저 도착하는 것이 정상 스펙이므로, AI 메시지가 이미 push된 경우 그 앞에 삽입
            if (this.voiceAiMsgId) {
                const aiIdx = this.messages.findIndex((m) => m.uuid === this.voiceAiMsgId);
                if (aiIdx !== -1) {
                    this.messages.splice(aiIdx, 0, msg);
                } else {
                    this.messages.push(msg);
                }
            } else {
                this.messages.push(msg);
            }
            this.$nextTick(() => this.scrollToBottomSafe?.());

            // 방이 없으면(드래프트 모드) 생성 — 이후 async 작업
            if (!this.currentChatRoom?.id) {
                const created = await this._ensureRoomForVoice();
                if (!created) return;
            }

            // DB 저장
            try {
                await backend.putObject(`db://chats/${msgUuid}`, {
                    uuid: msgUuid,
                    id: this.currentChatRoom.id,
                    messages: msg
                });
            } catch (e) {
                /* ignore persistence error */
            }
        },
        onVoiceAiDelta(delta) {
            if (!delta) return;
            this.voiceStatus = 'responding';
            if (!this.voiceAiMsgId) {
                // 첫 번째 delta: 새 AI 메시지 생성
                const nowIso = new Date().toISOString();
                const msgUuid = this.uuid();
                const agentName = this.currentVoiceAgentInfo?.username || 'AI';
                const agentEmail = this.currentVoiceAgentInfo?.email || 'voice-agent@system';
                this.voiceAiMsgId = msgUuid;
                this.messages.push({
                    uuid: msgUuid,
                    role: 'assistant',
                    content: delta,
                    contentType: 'text',
                    isLoading: false,
                    isVoiceResponse: true,
                    timeStamp: nowIso,
                    email: agentEmail,
                    name: agentName,
                    userName: agentName
                });
                this.$nextTick(() => this.scrollToBottomSafe?.());
            } else {
                // 이후 delta: 기존 메시지에 텍스트 추가
                const idx = this.messages.findIndex((m) => m?.uuid === this.voiceAiMsgId);
                if (idx !== -1) {
                    this.messages[idx] = {
                        ...this.messages[idx],
                        content: (this.messages[idx].content || '') + delta
                    };
                }
            }
        },
        async onVoiceAiDone(finalText) {
            this.voiceStatus = 'listening';
            const text = (finalText || '').trim();
            if (!text) return;

            // delta 없이 done만 온 경우(API 버전에 따라 발생): 메시지를 여기서 생성
            if (!this.voiceAiMsgId) {
                const nowIso = new Date().toISOString();
                const msgUuid = this.uuid();
                const agentName = this.currentVoiceAgentInfo?.username || 'AI';
                const agentEmail = this.currentVoiceAgentInfo?.email || 'voice-agent@system';
                this.voiceAiMsgId = msgUuid;
                this.messages.push({
                    uuid: msgUuid,
                    role: 'assistant',
                    content: text,
                    contentType: 'text',
                    isLoading: false,
                    isVoiceResponse: true,
                    timeStamp: nowIso,
                    email: agentEmail,
                    name: agentName,
                    userName: agentName
                });
                this.$nextTick(() => this.scrollToBottomSafe?.());
            } else {
                // delta로 스트리밍되다가 done이 온 경우: 최종 텍스트로 확정
                const idx = this.messages.findIndex((m) => m?.uuid === this.voiceAiMsgId);
                if (idx !== -1) {
                    this.messages[idx] = {
                        ...this.messages[idx],
                        content: text || this.messages[idx].content || '',
                        isLoading: false
                    };
                }
            }

            // 완성된 AI 메시지 DB 저장
            if (!this.currentChatRoom?.id) {
                await this._ensureRoomForVoice();
            }
            try {
                const savedIdx = this.messages.findIndex((m) => m?.uuid === this.voiceAiMsgId);
                if (savedIdx !== -1 && this.currentChatRoom?.id) {
                    // AI 메시지 timestamp를 현재 시각으로 갱신한다.
                    // user transcript (T1) 이후에 onVoiceAiDone(T2)이 호출되므로
                    // T2 > T1 이 보장되어 DB 로드 시에도 사용자 → AI 순서가 유지된다.
                    const aiTimestamp = new Date().toISOString();
                    this.messages[savedIdx] = { ...this.messages[savedIdx], timeStamp: aiTimestamp };
                    const msg = this.messages[savedIdx];
                    await backend.putObject(`db://chats/${msg.uuid}`, {
                        uuid: msg.uuid,
                        id: this.currentChatRoom.id,
                        messages: msg
                    });
                }
            } catch (e) {
                /* ignore */
            }

            this.voiceAiMsgId = null;
        },
        onVoiceError(err) {
            console.error('[VoiceAgent] error:', err);
            this.voiceStatus = 'error';
            this.voiceAiMsgId = null;
            // 3초 후 자동으로 바 닫기
            setTimeout(() => {
                if (this.voiceStatus === 'error') {
                    this.stopDesktopVoice();
                }
            }, 3000);
        },

        // 사용자 발화로 AI 응답이 인터럽트됐을 때 — partial 메시지 확정
        onVoiceAiInterrupted() {
            if (this.voiceAiMsgId) {
                const msg = this.messages.find((m) => m.uuid === this.voiceAiMsgId);
                if (msg) {
                    if (msg.content && msg.content.trim()) {
                        // 내용이 있으면 로딩 상태만 해제 (부분 텍스트 유지)
                        msg.isLoading = false;
                    } else {
                        // 내용이 없으면 빈 메시지 제거
                        const idx = this.messages.findIndex((m) => m.uuid === this.voiceAiMsgId);
                        if (idx !== -1) this.messages.splice(idx, 1);
                    }
                }
                this.voiceAiMsgId = null;
            }
            this.voiceStatus = 'listening';
        },
        // ===== 데스크탑 음성 에이전트 끝 =====

        /**
         * HumanFeedbackPanel에서 사용자가 선택을 완료했을 때 호출
         * 선택 결과를 사용자 메시지로 변환하여 에이전트에게 전송
         */
        async _submitOnePdf2bpmnHitlResponse(hitl, taskId, q, r) {
            const qid = r.question_id || q.question_id || '';
            if (!qid) return;
            if (r.skipped) {
                await this.submitPdf2BpmnHumanFeedback(taskId, {
                    question_id: qid,
                    action: 'skip',
                    answer: '응답 없음',
                    reason: '',
                    target_type: q.target_type || (q.option_meta && q.option_meta.stage) || '',
                    target_id: q.target_id || ''
                });
                return;
            }
            if (r.type === 'select_items') {
                const ids = (r.selectedIds || []).map((x) => String(x));
                const items = r.selectedItems || [];
                const labels = items.map((it) => it?.label).filter(Boolean);
                await this.submitPdf2BpmnHumanFeedback(taskId, {
                    question_id: qid,
                    action: 'select_items',
                    selected_ids: ids,
                    selected_items: items,
                    custom_text: r.customText || '',
                    answer: labels.length ? labels.join(', ') : (ids.join(', ') || '선택 없음'),
                    reason: r.customText || '',
                    target_type: q.target_type || (q.option_meta && q.option_meta.stage) || '',
                    target_id: q.target_id || ''
                });
                return;
            }
            if (r.type === 'approve_reject_with_edit') {
                await this.submitPdf2BpmnHumanFeedback(taskId, {
                    question_id: qid,
                    action: r.decision === 'approve' ? 'approve' : 'reject',
                    answer: r.answer || (r.decision === 'approve' ? '승인' : '반려'),
                    reason: r.reason || r.selectedSuggestion || '',
                    target_type: q.target_type || '',
                    target_id: q.target_id || ''
                });
                return;
            }
            if (r.type === 'suggestions') {
                await this.submitPdf2BpmnHumanFeedback(taskId, {
                    question_id: qid,
                    action: 'suggestions',
                    answer: r.selected || '',
                    reason: r.customText || '',
                    target_type: q.target_type || '',
                    target_id: q.target_id || ''
                });
                return;
            }
            await this.submitPdf2BpmnHumanFeedback(taskId, {
                question_id: qid,
                action: 'confirm',
                answer: '확인',
                reason: '',
                target_type: q.target_type || '',
                target_id: q.target_id || ''
            });
        },

        /**
         * deepagent `request_human_input` 의 자유텍스트 질문을 선택 패널용 구조로 파싱.
         * 스킬(03 elicit-artifacts) 포맷을 인식한다:
         *   [프로세스] 질문...            ← 질문 헤더(대괄호 뒤 텍스트 있음)
         *   [스킬 — ...]                  ← 섹션(대괄호만)
         *   • 라벨: 설명                  ← 선택 항목
         * 항목이 하나도 없으면 items=[] 로 두고 자유입력(allow_other)만으로 응답하게 한다.
         */
        /**
         * 멀티프로세스 일괄 HITL 페이로드 파싱.
         * 에이전트가 request_human_input 의 question/context 에 아래 JSON 을 넣으면 프로세스별 페이지 질문으로 변환.
         *  consult:    {"multi_process":true,"stage":"consult","processes":[{"name","draft"},...]}
         *  candidates: {"multi_process":true,"stage":"candidates","processes":[{"name","skills":[{label,desc}],"agents":[...],"dmn":[...]},...]}
         */
        _parseMultiProcessHitl(text) {
            const raw = (text || '').toString();
            if (raw.indexOf('multi_process') === -1) return null;
            // "multi_process" 를 감싸는 첫 번째 '균형 잡힌' { ... } 객체만 추출(배열 래핑·중복 출력에도 견고).
            let obj = null;
            const key = raw.indexOf('"multi_process"');
            const start = key >= 0 ? raw.lastIndexOf('{', key) : -1;
            if (start >= 0) {
                let depth = 0;
                let end = -1;
                let inStr = false;
                let esc = false;
                for (let j = start; j < raw.length; j++) {
                    const c = raw[j];
                    if (inStr) {
                        if (esc) esc = false;
                        else if (c === '\\') esc = true;
                        else if (c === '"') inStr = false;
                    } else if (c === '"') inStr = true;
                    else if (c === '{') depth++;
                    else if (c === '}') {
                        depth--;
                        if (depth === 0) {
                            end = j;
                            break;
                        }
                    }
                }
                if (end > start) {
                    try {
                        obj = JSON.parse(raw.slice(start, end + 1));
                    } catch (e) {
                        obj = null;
                    }
                }
            }
            if (!obj || !obj.multi_process || !Array.isArray(obj.processes) || obj.processes.length < 2) return null;
            const stage = obj.stage === 'candidates' ? 'candidates' : 'consult';
            const questions = [];
            obj.processes.forEach((p, pi) => {
                const name = (p?.name || `프로세스 ${pi + 1}`).toString().trim();
                if (stage === 'consult') {
                    questions.push({
                        question_id: `mp-${pi}-consult`,
                        process: name,
                        prompt: `[${name}] 초안 검토`,
                        context: (p?.draft || '').toString(),
                        feedback_type: 'approve_reject_with_edit',
                        target_type: 'consult'
                    });
                } else {
                    const addKind = (kind, label, arr) => {
                        const items = (Array.isArray(arr) ? arr : [])
                            .map((c, ci) => {
                                const lab = (typeof c === 'string' ? c : c?.label || c?.name || '').toString().trim();
                                if (!lab) return null;
                                return {
                                    id: `${name}::${kind}::${ci}::${lab}`,
                                    label: lab,
                                    description: (typeof c === 'object' ? c?.desc || c?.description || '' : '').toString()
                                };
                            })
                            .filter(Boolean);
                        if (!items.length) return;
                        questions.push({
                            question_id: `mp-${pi}-${kind}`,
                            process: name,
                            prompt: `[${name}] ${label}`,
                            feedback_type: 'select_items',
                            items,
                            allow_multiple: true,
                            min_select: 0,
                            allow_other: true,
                            target_type: kind
                        });
                    };
                    addKind('skills', '스킬', p?.skills);
                    addKind('agents', '에이전트', p?.agents);
                    addKind('dmn', 'DMN', p?.dmn);
                }
            });
            if (!questions.length) return null;
            return { stage, questions };
        },

        parseHumanInputQuestion(raw) {
            const text = String(raw || '');
            const lines = text.split('\n');
            let question = '';
            let category = '';
            const items = [];
            for (const line of lines) {
                const t = (line || '').trim();
                if (!t) continue;
                if (/^[•\-*]\s+/.test(t)) {
                    const body = t.replace(/^[•\-*]\s+/, '');
                    const ci = body.indexOf(':');
                    const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
                    const desc = ci >= 0 ? body.slice(ci + 1).trim() : '';
                    if (label) {
                        // id 에 인덱스를 포함해 라벨이 같아도 항상 고유하게(같은 이름이면 한 번에 다 선택되던 버그 방지).
                        items.push({
                            id: `${category || 'opt'}::${items.length}::${label}`,
                            label,
                            description: category ? (desc ? `${desc}` : '') : desc,
                            category
                        });
                    }
                    continue;
                }
                // 섹션 헤더: `[스킬]`, `[스킬]:`, `[에이전트] :` 등 뒤따르는 콜론/공백 허용.
                const secMatch = t.match(/^\[([^\]]+)\]\s*:?\s*$/);
                if (secMatch) {
                    category = secMatch[1].split(/[—\-:]/)[0].trim();
                    continue;
                }
                if (!question) question = t; // 첫 일반/질문 라인
            }
            return { question: question || text.trim(), items };
        },

        /** request_human_input 호출을 스트리밍 중인 어시스턴트 메시지에 HITL 패널로 부착(plan_tools 경로). */
        attachDeepagentHitlPanel(agentId, args) {
            const msg = this.activeStreams?.[agentId];
            if (!msg || msg.__humanFeedback) return;
            this._buildDeepagentHitlPanel(msg, {
                question: (args?.question || '').toString(),
                context: (args?.context || '').toString()
            });
        },

        /**
         * deepagent interrupt(request_human_input)용 HITL 패널을 메시지에 구성한다.
         * - `• 라벨: 설명` 후보가 있으면 select_items(복수 선택) 패널.
         * - 후보가 없으면(컨설팅 초안 승인 등) approve_reject_with_edit(승인/반려 + 자유 수정) 패널.
         * 두 경우 모두 같은 그래프 세션 resume 용 run_state 를 메시지와 방(pending)에 보관한다.
         */
        _buildDeepagentHitlPanel(msg, { question, context, runState } = {}) {
            if (!msg) return;
            const convId = (this.currentChatRoom?.id || this.roomId || '').toString();
            const headerQ = (question || '').toString().trim();
            const bodyText = (context || '').toString().trim();
            // 모델이 초안/후보를 question 또는 context 어디에 넣든 잡을 수 있게 둘을 합쳐 파싱한다.
            const combined = [headerQ, bodyText].filter(Boolean).join('\n\n');
            const parsed = this.parseHumanInputQuestion(combined);
            msg.runState = {
                ...(msg.runState || {}),
                tool_name: 'request_human_input',
                pending_field: 'human_response',
                last_question: headerQ || combined,
                checkpoint_thread_id: convId,
                ...(runState && typeof runState === 'object' ? runState : {})
            };
            // 방 단위 pending 보관(일반 입력창 답변 안전망).
            if (convId) this.pendingHitlRunState[convId] = msg.runState;

            // 멀티프로세스 일괄 HITL: 프로세스별 페이지네이션(컨설팅/후보)을 multi-question 패널로 구성.
            const mp = this._parseMultiProcessHitl(combined);
            if (mp) {
                msg.__humanFeedback = {
                    user_request_type: 'ask_user',
                    context: '',
                    allow_skip: false,
                    question_id: `${msg.uuid || 'hitl'}-mp`,
                    __submittedText: '',
                    question:
                        mp.stage === 'consult'
                            ? '각 프로세스 초안을 검토해 주세요 (다음으로 페이지 이동)'
                            : '각 프로세스에 추가할 스킬·에이전트·DMN을 선택해 주세요 (다음으로 페이지 이동)',
                    questions: mp.questions,
                    __groupBy: 'process',
                    __mpStage: mp.stage,
                    __deepagentHitl: true,
                    __submitted: false
                };
                msg.content = '';
                msg.isLoading = false;
                this.$nextTick(() => this.scrollToBottomSafe && this.scrollToBottomSafe());
                return;
            }

            const baseFeedback = {
                user_request_type: 'ask_user',
                question: headerQ || parsed.question || '확인이 필요합니다.',
                context: '',
                allow_skip: true,
                question_id: `${msg.uuid || 'hitl'}-deepagent`,
                __deepagentHitl: true,
                __submitted: false,
                __submittedText: ''
            };
            // select_items 는 후보 형식(`[스킬]/[에이전트]/[DMN]` 섹션 → 카테고리 있는 항목)일 때만.
            // 컨설팅 초안처럼 카테고리 없는 불릿/번호는 선택지가 아니라 본문이므로 approve_reject 로 보여준다.
            const hasCategorizedItems = parsed.items.length > 0 && parsed.items.some((it) => (it.category || '').toString().trim());
            if (hasCategorizedItems) {
                msg.__humanFeedback = {
                    ...baseFeedback,
                    // 후보가 question 전체에 들어온 경우 headerQ 는 후보까지 포함하므로,
                    // 패널 헤더는 첫 줄(제목)인 parsed.question 을 쓴다(후보는 items 로 표시).
                    question: parsed.question || headerQ || '추가할 항목을 골라주세요',
                    feedback_type: 'select_items',
                    items: parsed.items.map((it) => ({
                        id: it.id,
                        label: it.category ? `[${it.category}] ${it.label}` : it.label,
                        description: it.description || ''
                    })),
                    suggestions: [],
                    allow_multiple: true,
                    min_select: 0,
                    allow_other: true
                };
                msg.content = ''; // 후보는 패널 목록으로 보여주므로 본문 비움
            } else {
                // 후보 없음 → 컨설팅 승인형: 승인/반려 버튼 + 자유 수정 입력.
                // 초안은 패널 context 로만 보여주고 메시지 본문은 비운다(본문+패널 중복 표시 방지).
                const draft = combined;
                msg.content = '';
                msg.__humanFeedback = {
                    ...baseFeedback,
                    question: headerQ || '이대로 진행할까요?',
                    context: draft,
                    feedback_type: 'approve_reject_with_edit',
                    items: [],
                    suggestions: []
                };
            }
            msg.isLoading = false;
            this.$nextTick(() => this.scrollToBottomSafe && this.scrollToBottomSafe());
        },

        /**
         * 백엔드가 interrupt 종료 마커(done: {type:'human_input_required', ...})를 보낸 경우의 텍스트를 파싱.
         * 순수 JSON 또는 ```json 블록/본문 내 객체를 허용. 마커가 아니면 null.
         */
        _parseDeepagentHitlMarker(text) {
            const raw = (text || '').toString().trim();
            if (!raw || raw.indexOf('human_input_required') === -1) return null;
            const tryParse = (s) => {
                try {
                    const o = JSON.parse(s);
                    return o && typeof o === 'object' && o.type === 'human_input_required' ? o : null;
                } catch (e) {
                    return null;
                }
            };
            let hit = tryParse(raw);
            if (hit) return hit;
            // ```json ... ``` 또는 본문에 박힌 JSON 객체 추출 시도
            const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fence && fence[1]) {
                hit = tryParse(fence[1].trim());
                if (hit) return hit;
            }
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start >= 0 && end > start) {
                hit = tryParse(raw.slice(start, end + 1));
                if (hit) return hit;
            }
            return null;
        },

        /**
         * deepagent 가 emit 한 **출력계약 JSON**(process-definition-result: processDefinition/forms/
         * agents/skills)을 결과 카드 스키마(message.pdf2bpmnResult)로 매핑한다.
         * - 카드 표시용: savedProcesses/savedSkills/savedAgents
         * - 저장용: __contract(전체 계약) 보관 + __saved=false (사용자가 '저장' 버튼 클릭 시 사용)
         * (구버전 호환: data 가 saved_processes 요약이면 그대로 카드만.)
         */
        _mapPostprocessToPdf2bpmnResult(data) {
            if (!data || typeof data !== 'object') return null;

            const pd = data.processDefinition && typeof data.processDefinition === 'object' ? data.processDefinition : null;

            let savedProcesses = [];
            let skills = [];
            let agents = [];
            let contract = null;

            if (pd) {
                // 출력계약(전체) — 저장 가능
                const procId = (pd.processDefinitionId || pd.id || '').toString();
                const procName = (pd.processDefinitionName || pd.name || procId || 'Unnamed Process').toString();
                if (procId || procName) {
                    savedProcesses = [{ process_id: procId, process_name: procName, bpmn_xml: '' }];
                }
                skills = Array.isArray(data.skills) ? data.skills : [];
                agents = Array.isArray(data.agents) ? data.agents : [];
                contract = data;
            } else {
                // 구버전 요약(saved_*) 호환 — 카드만
                const procs = Array.isArray(data.saved_processes) ? data.saved_processes : Array.isArray(data.savedProcesses) ? data.savedProcesses : [];
                skills = Array.isArray(data.saved_skills) ? data.saved_skills : Array.isArray(data.savedSkills) ? data.savedSkills : [];
                agents = Array.isArray(data.saved_agents) ? data.saved_agents : Array.isArray(data.savedAgents) ? data.savedAgents : [];
                savedProcesses = procs
                    .map((p) => ({
                        process_id: (p?.id || p?.process_id || '').toString(),
                        process_name: (p?.name || p?.process_name || 'Unnamed Process').toString(),
                        bpmn_xml: p?.bpmn_xml || ''
                    }))
                    .filter((p) => p.process_id || (p.process_name && p.process_name !== 'Unnamed Process'));
            }

            const savedSkills = skills
                .map((s) => (typeof s === 'string' ? { name: s } : s))
                .filter((s) => s && (s.name || s.safe_name));
            const savedAgents = agents.filter((a) => a && a.id);

            if (!savedProcesses.length && !savedSkills.length && !savedAgents.length && !contract) return null;
            return {
                savedProcesses,
                savedSkills,
                savedAgents,
                __contract: contract, // 전체 출력계약(있으면 저장 가능)
                __saved: false,
                __saving: false
            };
        },

        /**
         * 사용자가 '저장' 버튼을 클릭하면 호출. deepagent 가 emit 한 출력계약을 프론트(사용자 권한)에서
         * proc_def + form_def 로 저장한다(pdf2bpmn 스키마 동일). 시스템이 직접 저장하지 않는 보안 정책.
         */
        async handleSaveGeneratedProcess(message) {
            const result = message?.pdf2bpmnResult || null;
            const contract = result && result.__contract;
            if (!result || !contract || !contract.processDefinition) {
                if (result) result.__saveError = '저장할 프로세스 정보가 없습니다.';
                return;
            }
            if (result.__saved || result.__saving) return;
            result.__saving = true;
            result.__saveError = '';
            try {
                const { elementsToFlattenedDefinition } = await import('@/utils/elementsToFlattened.js');
                const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';
                const pd = contract.processDefinition;
                const procId = (pd.processDefinitionId || pd.id || '').toString().trim();
                const procName = (pd.processDefinitionName || pd.name || procId || '새 프로세스').toString();
                if (!procId) throw new Error('processDefinitionId 가 없습니다.');

                const flat = elementsToFlattenedDefinition(pd);

                // 1) proc_def 저장 (definition=flattened, bpmn=null)
                await backend.putObject(
                    'proc_def',
                    {
                        id: procId,
                        name: procName,
                        definition: flat,
                        bpmn: null,
                        type: 'bpmn',
                        isdeleted: false,
                        tenant_id: tenantId
                    },
                    { onConflict: 'id,tenant_id' }
                );

                // 2) form_def 저장 (각 UserActivity 폼) — putRawDefinition 이 fields_json 추출 + tenant 처리
                const forms = Array.isArray(contract.forms) ? contract.forms : [];
                let formsSaved = 0;
                for (const form of forms) {
                    const activityId = (form?.activity_id || '').toString();
                    const html = (form?.html || '').toString();
                    if (!activityId || !html) continue;
                    const formId = (form?.form_id || `${procId}_${activityId.toLowerCase()}_form`).toString();
                    try {
                        await backend.putRawDefinition(html, formId, {
                            type: 'form',
                            proc_def_id: procId,
                            activity_id: activityId
                        });
                        formsSaved += 1;
                    } catch (formErr) {
                        console.warn('[SaveProcess] form 저장 실패:', activityId, formErr);
                    }
                }

                // 3) proc_map(미분류) 등록 — 프로세스 목록에 보이도록 (best-effort)
                try {
                    await this._upsertProcMapEntry(procId, procName, tenantId);
                } catch (pmErr) {
                    console.warn('[SaveProcess] proc_map 등록 실패(무시):', pmErr);
                }

                result.__saved = true;
                result.__saving = false;
                result.__saveError = '';
                result.__formsSaved = formsSaved;
                result.process_id = procId;
                result.process_name = procName;
                if (Array.isArray(result.savedProcesses) && result.savedProcesses[0]) {
                    result.savedProcesses[0].process_id = procId;
                    result.savedProcesses[0].process_name = procName;
                }
                // 메시지 객체 갱신을 화면에 반영 (Vue3 반응성)
                if (message) message.pdf2bpmnResult = { ...result };
            } catch (e) {
                result.__saving = false;
                result.__saveError = (e && (e.message || e.toString())) || '저장 실패';
                if (message) message.pdf2bpmnResult = { ...result };
                console.error('[SaveProcess] 저장 실패:', e);
            }
        },

        /** configuration.proc_map 에 프로세스를 '미분류'로 등록(없으면 추가). pdf2bpmn _save_proc_map 동일. */
        async _upsertProcMapEntry(procId, procName, tenantId) {
            let row = null;
            try {
                row = await backend.getData('configuration', { match: { key: 'proc_map', tenant_id: tenantId } });
            } catch (e) {
                row = null;
            }
            const subEntry = { id: procId, name: procName, path: procId, new: true };
            const ensure = (procMap) => {
                const mega = (procMap.mega_proc_list = procMap.mega_proc_list || []);
                if (!mega.length) mega.push({ id: 'unclassified', name: '미분류', major_proc_list: [] });
                const major = (mega[0].major_proc_list = mega[0].major_proc_list || []);
                if (!major.length) major.push({ id: 'unclassified_major', name: '미분류', sub_proc_list: [] });
                const sub = (major[0].sub_proc_list = major[0].sub_proc_list || []);
                if (!sub.some((s) => s && s.id === procId)) sub.push(subEntry);
                return procMap;
            };
            if (row && row.value) {
                const procMap = ensure(typeof row.value === 'object' ? row.value : {});
                await backend.putObject(
                    'configuration',
                    { uuid: row.uuid, key: 'proc_map', value: procMap, tenant_id: tenantId },
                    { match: { key: 'proc_map', tenant_id: tenantId } }
                );
            } else {
                const procMap = ensure({});
                await backend.putObject('configuration', { key: 'proc_map', value: procMap, tenant_id: tenantId });
            }
        },

        /** interrupt 종료 마커를 받아 HITL 패널을 띄우고(또는 갱신) 같은 세션 resume 을 준비. */
        _applyDeepagentHitlStop(agentId, hitl) {
            const msg = this.activeStreams?.[agentId];
            if (!msg) return;
            const question = (hitl?.question || '').toString();
            const context = (hitl?.context || '').toString();
            const runState = hitl?.run_state && typeof hitl.run_state === 'object' ? hitl.run_state : null;

            // done 마커의 question 이 전체 초안/질문(권위)이므로, plan_tools 로 미리 붙은
            // (부분적일 수 있는) 패널이 있어도 이 값으로 항상 (재)구성한다 — 초안 누락 방지.
            this._buildDeepagentHitlPanel(msg, { question, context, runState });
            msg.isLoading = false;

            // interrupt 메시지는 DB 에 저장되지 않고(최종 artifact 아님), 다음 턴이 activeStreams 를
            // 덮어쓰므로, 패널이 붙은 이 메시지를 messages 로 이관해 대기/응답 후에도 유지되게 한다.
            this.messages.push(this.normalizeAssistantMessageForDisplay(msg));
            delete this.activeStreams[agentId];
            if (typeof this._stableSortMessages === 'function') this._stableSortMessages(this.messages);
            this.$nextTick(() => this.scrollToBottomSafe && this.scrollToBottomSafe());
        },

        /** deepagent HITL 응답을 run_state + human_response_answer 로 재전송해 interrupt 재개. */
        async _submitDeepagentHitl(message, feedbackResult) {
            let answer = '';
            const r = feedbackResult || {};
            if (r.type === 'multi') {
                // 멀티프로세스 일괄 응답 → 프로세스별로 묶어 "[프로세스명] ..." 줄로 에이전트에 전달.
                const qs = (message?.__humanFeedback?.questions || []);
                const stage = message?.__humanFeedback?.__mpStage || 'consult';
                const byId = {};
                qs.forEach((q) => {
                    byId[q.question_id] = q;
                });
                const perProc = {};
                const order = [];
                (r.responses || []).forEach((resp) => {
                    const q = byId[resp.question_id] || {};
                    const proc = (q.process || '프로세스').toString();
                    if (!perProc[proc]) {
                        perProc[proc] = [];
                        order.push(proc);
                    }
                    if (stage === 'consult') {
                        const dec = resp.decision === 'approve' ? '승인' : resp.decision === 'reject' ? '반려' : (resp.reason ? '수정요청' : '승인');
                        const reason = (resp.reason || '').toString().trim();
                        perProc[proc].push(reason ? `${dec} - ${reason}` : dec);
                    } else {
                        const kind = q.target_type;
                        const kindLabel = kind === 'skills' ? '스킬' : kind === 'agents' ? '에이전트' : kind === 'dmn' ? 'DMN' : (kind || '항목');
                        const labels = (resp.selectedItems || []).map((it) => it?.label).filter(Boolean);
                        const custom = (resp.customText || '').toString().trim();
                        let v = labels.length ? labels.join(', ') : '(없음)';
                        if (custom && custom !== 'skipped') v += ` / 추가: ${custom}`;
                        perProc[proc].push(`${kindLabel}: ${v}`);
                    }
                });
                answer = order.map((proc) => `[${proc}] ${perProc[proc].join(' / ')}`).join('\n');
            } else if (r.type === 'select_items') {
                const labels = (r.selectedItems || []).map((it) => it?.label).filter(Boolean);
                const custom = (r.customText || '').toString().trim();
                if (labels.length && custom) answer = `${labels.join(', ')} / 추가 요청: ${custom}`;
                else if (labels.length) answer = labels.join(', ');
                else if (custom) answer = custom;
                else answer = '없음';
            } else if (r.type === 'suggestions') {
                answer = (r.selected || (r.customText || '').trim() || '없음').toString();
            } else if (r.type === 'approve_reject_with_edit') {
                // 컨설팅 승인형: 표시·전달 모두 '승인'/'반려'(+의견). 승인/반려 미선택 시엔 입력한 의견만 전달.
                const reason = (r.reason || '').toString().trim();
                if (r.decision === 'approve') {
                    answer = reason ? `승인 - ${reason}` : '승인';
                } else if (r.decision === 'reject') {
                    answer = reason ? `반려 - ${reason}` : '반려';
                } else {
                    answer = reason || '확인';
                }
            } else if (r.__skip) {
                answer = '없음';
            } else {
                answer = '확인';
            }

            const runState = message?.runState || {
                tool_name: 'request_human_input',
                pending_field: 'human_response'
            };
            const agentIdForMention = message?.agentId || null;
            let mentionedUsers = [];
            if (agentIdForMention) {
                const candidates = (typeof this.getAgentCandidates === 'function' && this.getAgentCandidates()) || [];
                const hit = Array.isArray(candidates) ? candidates.find((a) => a?.id === agentIdForMention) : null;
                mentionedUsers = [
                    {
                        id: agentIdForMention,
                        username: (hit?.username || hit?.name || agentIdForMention).toString(),
                        mentionText: (hit?.username || hit?.alias || hit?.name || agentIdForMention).toString()
                    }
                ];
            }
            await this.handleSendMessage({
                text: answer,
                mentionedUsers,
                orchestration: this.getRoomOrchestration(),
                metadata: { run_state: runState, human_response_answer: answer }
            });
        },

        handleHumanFeedbackSkip(messageOrFeedback) {
            const message = messageOrFeedback && messageOrFeedback.__humanFeedback ? messageOrFeedback : this.pendingHumanFeedbackMessage;
            const feedback = messageOrFeedback && !messageOrFeedback.__humanFeedback ? messageOrFeedback : message?.__humanFeedback;

            if (message && message.__humanFeedback) {
                message.__humanFeedback.__submitted = true;
                message.__humanFeedback.__submittedText = '건너뜀';
            } else if (feedback) {
                feedback.__submitted = true;
                feedback.__submittedText = '건너뜀';
            }

            // deepagent HITL 은 건너뛰어도 '없음' 답변으로 interrupt 를 재개해야 멈추지 않는다.
            const fbForSkip = (message && message.__humanFeedback) ? message.__humanFeedback : feedback;
            if (fbForSkip && fbForSkip.__deepagentHitl) {
                const targetMsg = (message && message.__humanFeedback)
                    ? message
                    : this.pendingHumanFeedbackMessage;
                this._submitDeepagentHitl(targetMsg, { __skip: true });
            }
        },

        async handleHumanFeedbackSubmit(messageOrFeedback, feedbackResult) {
            // Chat.vue에서 emit한 경우: (humanFeedback, feedbackResult)
            // 기존 호출(로컬 패널) 대비 호환: (message, feedbackResult)
            if (!feedbackResult && messageOrFeedback && messageOrFeedback.type) {
                feedbackResult = messageOrFeedback;
                messageOrFeedback = null;
            }
            if (!feedbackResult) return;
            console.log('[HumanFeedback] handleHumanFeedbackSubmit:', feedbackResult);

            const messageRef = messageOrFeedback && messageOrFeedback.__humanFeedback ? messageOrFeedback : this.pendingHumanFeedbackMessage;
            const feedback = messageOrFeedback && !messageOrFeedback.__humanFeedback ? messageOrFeedback : messageRef?.__humanFeedback;

            // CRITICAL: 인라인 패널의 message 는 filteredMessages 의 deep copy 일 수 있으므로,
            // 원본 this.messages 에서 같은 uuid 를 찾아 그 객체를 갱신해야 readonly 상태가 보존된다.
            const realMessage = (messageRef && messageRef.uuid)
                ? this.messages.find((m) => m && m.uuid === messageRef.uuid) || messageRef
                : messageRef;
            const targetMessage = realMessage || messageRef;

            // 메시지를 제출 완료 상태로 변경 + 사용자가 무엇을 골랐는지 저장 (readonly 표시용)
            if (targetMessage && targetMessage.__humanFeedback) {
                const fb = targetMessage.__humanFeedback;
                fb.__submitted = true;
                if (feedbackResult.type === 'multi') {
                    // multi 응답: __responses 에 각 섹션 응답 저장 + 워커에 batch 전송
                    fb.__responses = (feedbackResult.responses || []).slice();
                    const total = (feedbackResult.responses || []).length;
                    const answered = (feedbackResult.responses || []).filter((r) => !r.skipped).length;
                    fb.__submittedText = `${answered}/${total}개 응답 완료`;
                } else if (feedbackResult.type === 'select_items') {
                    fb.__selectedIds = (feedbackResult.selectedIds || []).slice();
                    fb.__selectedItems = (feedbackResult.selectedItems || []).slice();
                    fb.__customText = (feedbackResult.customText || '').toString();
                    const labels = (feedbackResult.selectedItems || [])
                        .map((it) => it?.label)
                        .filter(Boolean);
                    let summary = '';
                    if (labels.length > 0) summary = `선택됨: ${labels.join(', ')}`;
                    else if (feedbackResult.selectedItems?.length) summary = `${feedbackResult.selectedItems.length}개 선택됨`;
                    if (fb.__customText) {
                        const preview = fb.__customText.length > 30
                            ? fb.__customText.slice(0, 30) + '…'
                            : fb.__customText;
                        summary = summary
                            ? `${summary} · 직접 입력: "${preview}"`
                            : `직접 입력: "${preview}"`;
                    }
                    fb.__submittedText = summary || '응답 완료';
                } else if (feedbackResult.type === 'approve_reject_with_edit') {
                    fb.__decision = feedbackResult.decision || '';
                    fb.__freeText = (feedbackResult.reason || '').toString();
                    fb.__selectedSuggestion = feedbackResult.selectedSuggestion || null;
                    const _rsn = fb.__freeText.trim();
                    if (feedbackResult.decision === 'approve') fb.__submittedText = _rsn ? `승인 - ${_rsn}` : '승인';
                    else if (feedbackResult.decision === 'reject') fb.__submittedText = _rsn ? `반려 - ${_rsn}` : '반려';
                    else fb.__submittedText = _rsn ? `의견: ${_rsn}` : '응답 완료';
                } else if (feedbackResult.type === 'suggestions') {
                    fb.__selectedSuggestion = feedbackResult.selected || null;
                    fb.__submittedText = feedbackResult.selected ? `선택됨: ${feedbackResult.selected}` : '응답 완료';
                } else {
                    fb.__submittedText = '응답 완료';
                }

                // DB 저장: __submitted/__selectedIds 등이 reload 후에도 살아남도록 chats 에 putObject.
                // (assistant 메시지가 이미 DB 에 저장된 상태에서 __humanFeedback 만 갱신해 덮어쓴다)
                try {
                    const roomId = this.currentChatRoom?.id || null;
                    const canWrite = this.shouldClientWriteChatDb(this.getRoomOrchestration());
                    const msgUuid = targetMessage.uuid;
                    if (canWrite && roomId && msgUuid) {
                        await backend.putObject(`db://chats/${msgUuid}`, {
                            uuid: msgUuid,
                            id: roomId,
                            messages: { ...targetMessage }
                        });
                    }
                } catch (persistErr) {
                    console.warn('[HumanFeedback] 제출 상태 DB 저장 실패:', persistErr);
                }
            }

            // 사용했던 변수명 유지 (이후 코드 호환)
            const message = targetMessage;

            // deepagent(request_human_input) HITL → run_state + human_response_answer 재전송으로 interrupt 재개
            if (feedback && feedback.__deepagentHitl) {
                await this._submitDeepagentHitl(message, feedbackResult);
                return;
            }

            // ============================================================
            // PDF2BPMN 워커 HITL 응답을 todolist.output 에 기록 (워커 폴링이 이를 감지해 재개)
            // - approve_reject_with_edit  : 기존 (gateway/모호성 검토)
            // - select_items              : 스킬 승인 / DMN 생성 여부 등
            // - multi                     : 여러 question 을 한 번에 batch 전송 (사용자 개입 1회)
            //   option_meta.tool === 'pdf2bpmn' 또는 task_id 가 있으면 워커 응답으로 라우팅
            // ============================================================
            const hitl = feedback || {};
            const optMeta = (hitl.option_meta && typeof hitl.option_meta === 'object') ? hitl.option_meta : null;
            const isWorkerHitl =
                !!hitl.task_id ||
                (optMeta && optMeta.tool === 'pdf2bpmn' && optMeta.task_id);

            // multi 응답: 최종 제출 시에만 todolist.output.hitl_feedbacks 에 일괄 기록
            if (feedbackResult.type === 'multi') {
                const taskId = hitl.task_id || optMeta?.task_id || this._resolvePdf2bpmnTaskId({}, this.currentChatRoom?.id);
                const questions = Array.isArray(hitl.questions) ? hitl.questions : [];
                const responses = Array.isArray(feedbackResult.responses) ? feedbackResult.responses : [];
                for (let i = 0; i < responses.length; i++) {
                    const r = responses[i] || {};
                    const q = questions[i] || {};
                    const qid = r.question_id || q.question_id || '';
                    if (!qid) continue;
                    await this._submitOnePdf2bpmnHitlResponse(hitl, taskId, q, r.skipped ? { ...r, skipped: true } : r);
                }
                const allQids = questions
                    .map((q) => String(q?.question_id || '').trim())
                    .filter(Boolean);
                await this.requestPdf2BpmnWorkerResume(taskId, allQids);
                return;
            }

            if (feedbackResult.type === 'approve_reject_with_edit') {
                const taskId = hitl.task_id || optMeta?.task_id || this._resolvePdf2bpmnTaskId({}, this.currentChatRoom?.id);
                const payload = {
                    question_id: hitl.question_id || hitl.id || '',
                    action: feedbackResult.decision === 'approve' ? 'approve' : 'reject',
                    answer: feedbackResult.answer || (feedbackResult.decision === 'approve' ? '승인' : '반려'),
                    reason: feedbackResult.reason || feedbackResult.selectedSuggestion || '',
                    target_type: hitl.target_type || '',
                    target_id: hitl.target_id || ''
                };
                await this.submitPdf2BpmnHumanFeedback(taskId, payload);
                const approveQid = String(payload.question_id || '').trim();
                if (approveQid) {
                    await this.requestPdf2BpmnWorkerResume(taskId, [approveQid]);
                }
                return;
            }

            if (feedbackResult.type === 'select_items' && isWorkerHitl) {
                const taskId = hitl.task_id || optMeta?.task_id;
                const ids = (feedbackResult.selectedIds || []).map((x) => String(x));
                const items = feedbackResult.selectedItems || [];
                const customText = (feedbackResult.customText || '').toString();
                const labels = items.map((it) => it?.label).filter(Boolean);
                const payload = {
                    question_id: hitl.question_id || optMeta?.question_id || '',
                    action: 'select_items',
                    selected_ids: ids,
                    selected_items: items,
                    custom_text: customText,
                    answer: labels.length ? labels.join(', ') : (ids.join(', ') || '선택 없음'),
                    reason: customText,
                    target_type: hitl.target_type || optMeta?.stage || '',
                    target_id: hitl.target_id || ''
                };
                await this.submitPdf2BpmnHumanFeedback(taskId, payload);
                const singleQid = String(payload.question_id || '').trim();
                if (singleQid) {
                    await this.requestPdf2BpmnWorkerResume(taskId, [singleQid]);
                }
                return;
            }

            let userText = '';
            // 옵션 응답인지 식별: 백엔드가 ask_user 응답에 option_meta = {tool, key} 를 실어 보낸다.
            // 옵션 응답이면 본문은 선택 id 만 보내고, localStorage 의 tool_settings[key] 도 함께 갱신해
            // 다음 /chat/stream 요청의 metadata.tool_settings 에 자동 포함되게 한다.
            const optionMeta = (feedback && typeof feedback.option_meta === 'object') ? feedback.option_meta : null;
            // 도구 옵션 응답(예: pdf2bpmnLevel="standard")은 채팅 본문에 노출하지 않는다.
            // HumanFeedbackPanel 의 readonly 상태가 이미 사용자에게 무엇을 골랐는지 보여주므로 중복 표시 불필요.
            let hideUserMessage = false;

            if (feedbackResult.type === 'select_items') {
                const selectedItems = Array.isArray(feedbackResult.selectedItems) ? feedbackResult.selectedItems : [];

                if (optionMeta && optionMeta.tool && optionMeta.key && selectedItems.length > 0) {
                    // === 제너릭 도구 옵션 응답 처리 (PDF2BPMN 레벨/언어/노드수 등 어떤 옵션이든 동일하게 동작) ===
                    const valueId = String(selectedItems[0]?.id || '').toLowerCase();
                    userText = valueId;
                    hideUserMessage = true; // id 텍스트("standard")는 채팅에 노출하지 않음
                    // localStorage 갱신: 'process-gpt:toolsSettings'.<key> = valueId
                    try {
                        const STORAGE_KEY = 'process-gpt:toolsSettings';
                        const raw = localStorage.getItem(STORAGE_KEY);
                        const prev = raw ? (JSON.parse(raw) || {}) : {};
                        const next = { ...(typeof prev === 'object' && prev ? prev : {}), [optionMeta.key]: valueId };
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                    } catch (e) {
                        // 백엔드 pending_action 으로도 진행되므로 비치명 — 경고만
                        console.warn('[HumanFeedback] tool_settings localStorage 갱신 실패:', e);
                    }
                } else {
                    // 기존 문서 선택 케이스(예: list_reference_documents) — label 들을 합쳐 본문 구성
                    const selectedLabels = selectedItems.map((item) => item.label);
                    userText = `다음 문서를 참고해서 작성해 주세요: ${selectedLabels.join(', ')}`;
                }
            } else if (feedbackResult.type === 'suggestions') {
                // 선택지 + "직접 입력"(allowOther) 자유 의견을 모두 반영해 에이전트로 전달.
                // (컨설팅 패널: "이대로 생성" 선택 또는 자유 의견 입력이 모두 가능)
                const sel = (feedbackResult.selected || '').toString().trim();
                const custom = (feedbackResult.customText || '').toString().trim();
                userText = [sel, custom].filter(Boolean).join('\n');
                if (!userText) userText = '확인';
            } else {
                userText = '확인';
            }

            // handleSendMessage를 통해 에이전트에 전송 (hideUserMessage=true 면 채팅 본문/DB 모두 스킵)
            await this.handleSendMessage({ text: userText, hideUserMessage });
        },

        /**
         * pdf2bpmn HITL: 모든 question_id 에 응답이 있으면 워커 재개(FB_REQUESTED) 트리거.
         */
        async requestPdf2BpmnWorkerResume(taskId, questionIds) {
            const tid = String(taskId || '').trim();
            const qids = (Array.isArray(questionIds) ? questionIds : [])
                .map((q) => String(q || '').trim())
                .filter(Boolean);
            if (!tid || !qids.length || !window.$supabase) return false;

            try {
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('id, output, status, draft_status')
                    .eq('id', tid)
                    .limit(1);
                if (error) throw error;
                const row = Array.isArray(data) && data.length ? data[0] : null;
                if (!row || String(row.status || '').toUpperCase() === 'DONE') return false;

                let output = row.output;
                if (typeof output === 'string') {
                    try {
                        output = JSON.parse(output);
                    } catch (e) {
                        output = {};
                    }
                }
                if (!output || typeof output !== 'object') output = {};

                const waitStarted = String(output.hitl_wait_started_at || '');
                const feedbacks = Array.isArray(output.hitl_feedbacks) ? output.hitl_feedbacks : [];
                const waitTs = waitStarted ? Date.parse(waitStarted) : NaN;

                const hasValid = (fb) => {
                    if (!fb || typeof fb !== 'object') return false;
                    const submitted = String(fb.submitted_at || '');
                    if (waitStarted && submitted) {
                        const subTs = Date.parse(submitted);
                        if (!Number.isNaN(waitTs) && !Number.isNaN(subTs) && subTs < waitTs) {
                            return false;
                        }
                    }
                    return true;
                };

                const answered = new Set(
                    feedbacks
                        .filter(hasValid)
                        .map((fb) => String(fb.question_id || '').trim())
                        .filter(Boolean)
                );
                const allAnswered = qids.every((qid) => answered.has(qid));
                if (!allAnswered) return false;

                const { error: updateError } = await window.$supabase
                    .from('todolist')
                    .update({ draft_status: 'FB_REQUESTED' })
                    .eq('id', tid);
                if (updateError) throw updateError;
                return true;
            } catch (e) {
                console.warn('[HITL] requestPdf2BpmnWorkerResume failed:', e);
                return false;
            }
        },

        async submitPdf2BpmnHumanFeedback(taskId, payload) {
            const tid = String(taskId || '').trim();
            if (!tid || !window.$supabase) return;
            try {
                const { data, error } = await window.$supabase.from('todolist').select('id, output').eq('id', tid).limit(1);
                if (error) throw error;

                const row = Array.isArray(data) && data.length ? data[0] : null;
                let output = row?.output;
                if (typeof output === 'string') {
                    try {
                        output = JSON.parse(output);
                    } catch (e) {
                        output = {};
                    }
                }
                if (!output || typeof output !== 'object') output = {};

                const current = Array.isArray(output.hitl_feedbacks) ? output.hitl_feedbacks : [];
                const next = current.filter((x) => x?.question_id !== payload.question_id);
                const feedbackEntry = {
                    ...payload,
                    submitted_at: new Date().toISOString()
                };
                next.push(feedbackEntry);
                output.hitl_feedbacks = next;
                output.hitl_last_feedback = feedbackEntry;

                const { error: updateError } = await window.$supabase.from('todolist').update({ output }).eq('id', tid);
                if (updateError) throw updateError;

                // HumanFeedbackPanel 의 readonly 상태가 이미 사용자 선택을 보여주므로, 채팅에는 간결한 알림만.
                // 도구 옵션성 응답(action='select_items') 은 본문 노출 없이 조용히 처리.
                if (payload.action !== 'select_items') {
                    const text = `HITL 응답 전달: ${feedbackEntry.answer}${feedbackEntry.reason ? ` (${feedbackEntry.reason})` : ''}`;
                    const msgObj = this.createMessageObj(text, 'user');
                    if (this.currentChatRoom?.id) {
                        this.messages.push(msgObj);
                        await this.saveMessageToRoom(msgObj, this.currentChatRoom.id);
                    }
                }
            } catch (e) {
                console.warn('[HITL] submitPdf2BpmnHumanFeedback failed:', e);
                const errMsg = this.createMessageObj('HITL 응답 전달 중 오류가 발생했습니다. 다시 시도해 주세요.', 'assistant');
                this.messages.push(errMsg);
            }
        },

        async handleSendMessage(payload) {
            const fileMeta = this.getPayloadFileSummary(payload);
            const rawFiles = this.getPayloadRawFiles(payload);
            const fallbackRawFileInfos = this.mapRawFilesToDisplayInfos(rawFiles);
            const initialFiles = fileMeta.hasFile ? fileMeta.files : fallbackRawFileInfos;
            const hasRawFiles = rawFiles.length > 0;
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && initialFiles.length === 0 && !hasRawFiles)) return;
            if (!this.currentChatRoom?.id) return;
            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = initialFiles.length > 0 || hasRawFiles;
            if (!text && !hasImages && !hasFile) return;

            try {
                // UI(또는 기존 방) 기준 orchestration을 먼저 확정하고 context에 반영한 뒤, 동일 값으로 스트림 호출
                const effectiveOrchestration =
                    ((payload?.orchestration != null ? String(payload.orchestration) : '') || '').trim() || this.getRoomOrchestration();
                if (this.shouldClientWriteChatDb(effectiveOrchestration)) {
                    await this.setRoomOrchestration(effectiveOrchestration);
                }
                payload.orchestration = effectiveOrchestration;

                const keyObj = {
                    text: text || '',
                    imgCount: hasImages ? (payload.images || []).length : 0,
                    fileNames: hasFile ? initialFiles.map((f) => f?.name || f?.fileName || '').filter(Boolean) : []
                };
                if (payload?.openuiFormSubmission && typeof payload.openuiFormSubmission === 'object') {
                    keyObj.openuiFormSubmission = JSON.stringify(payload.openuiFormSubmission);
                }
                const key = JSON.stringify(keyObj);
                const now = Date.now();
                if (this._lastClientSendKey === key && now - (this._lastClientSendAt || 0) < 800) {
                    return;
                }
                this._lastClientSendKey = key;
                this._lastClientSendAt = now;
            } catch (e) {}

            this.isSending = true;
            try {
                const roomId = this.currentChatRoom.id;
                const canWrite = this.shouldClientWriteChatDb(payload?.orchestration || this.getRoomOrchestration());
                const nowIso = new Date().toISOString();
                const msgUuid = this.uuid();
                // hideUserMessage 플래그: HITL 옵션 응답("standard" 같은 id) 처럼 사용자에게
                // 채팅 본문으로 노출할 필요가 없는 메시지를 가릴 때 사용한다.
                // - 화면: filteredMessages 가 __hidden 항목을 걸러냄
                // - DB: 사용자 메시지 저장 스킵 (리로드 시 다시 안 보이게)
                // - 백엔드: streamAgents 에는 그대로 text 가 전달되어 정상 동작
                const hideUserMessage = !!payload?.hideUserMessage;
                const msg = {
                    uuid: msgUuid,
                    // 클라이언트에서 생성한 안정적인 ID(optimistic/realtime dedupe에 사용)
                    clientUuid: msgUuid,
                    role: 'user',
                    // 첨부만 있을 때 자동 문구를 넣지 않음 (메시지는 첨부 UI로만 표시)
                    content: text || '',
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: initialFiles[0] || null,
                    pdfFiles: initialFiles,
                    // mention 메타데이터 (UI 표시 + 라우팅에 사용)
                    mentionedUsers: Array.isArray(payload?.mentionedUsers) ? payload.mentionedUsers : [],
                    // reply 메타데이터 (UI에서 표시)
                    replyUuid: payload?.reply?.uuid || null,
                    replyUserName: payload?.reply?.name || null,
                    replyContent: payload?.reply?.content || null,
                    // 채팅 본문에 노출하지 않음 (filteredMessages 에서 걸러진다)
                    __hidden: hideUserMessage
                };
                // 서버 dedupe용: 클라이언트에서 생성한 user 메시지 UUID를 스트리밍 요청에 전달
                payload.message_uuid = msgUuid;

                // 입력창은 즉시 초기화되므로, 사용자 메시지를 먼저 화면에 반영한다.
                // 다만 hideUserMessage=true 인 경우는 messages 배열에 추가하지 않아 UI 에도 표시 안 됨.
                if (!hideUserMessage) {
                    this.upsertMessageByKeys(msg);
                }
                this.$nextTick(() => this.scrollToBottomSafe());
                this.focusComposerInput();
                this.updateChatAccessPage(roomId);

                if (canWrite && !hideUserMessage) {
                    await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });
                }

                // raw File이 있으면 전송 이후 백그라운드 업로드를 수행하고,
                // 업로드 완료 시 사용자 메시지/요청 payload를 URL 기반 정보로 교체한다.
                if (hasRawFiles) {
                    const embeddingMsgUuid = this.uuid();
                    const fileNames = rawFiles.map((f) => (f?.name || '').toString()).filter(Boolean).join(', ');
                    this.upsertMessageByKeys({
                        uuid: embeddingMsgUuid,
                        role: 'assistant',
                        content: `📄 문서 임베딩 중... (${fileNames})`,
                        timeStamp: new Date().toISOString(),
                        isLoading: true
                    });
                    this.$nextTick(() => this.scrollToBottomSafe());
                    try {
                        const uploadedInfos = await this.uploadRawFilesForRoom(roomId, rawFiles);
                        const uploadedUsable = uploadedInfos.filter(
                            (f) => !!(f?.fileUrl || f?.url || f?.publicUrl || f?.fullPath || f?.path)
                        );
                        if (uploadedUsable.length > 0) {
                            payload.file = uploadedUsable[0] || null;
                            payload.files = uploadedUsable;
                            msg.pdfFile = uploadedUsable[0] || null;
                            msg.pdfFiles = uploadedUsable;
                            this.upsertMessageByKeys(msg);
                            if (canWrite) {
                                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });
                            }
                        }
                    } finally {
                        this.messages = this.messages.filter((m) => m?.uuid !== embeddingMsgUuid);
                    }
                }

                const requestFiles = this.normalizePayloadFiles(payload);
                const requestUsableFiles = requestFiles.filter((f) => !!(f?.fileUrl || f?.url || f?.publicUrl || f?.fullPath || f?.path));
                payload.file = requestUsableFiles[0] || null;
                payload.files = requestUsableFiles;
                if (requestUsableFiles.length > 0) {
                    await this.saveChatAttachments(roomId, requestUsableFiles);
                }

                // last message update
                const firstFile = (requestUsableFiles[0] || requestFiles[0] || initialFiles[0] || null);
                const fileName = (firstFile?.name || firstFile?.fileName || '').toString();
                const fileCount = requestFiles.length > 0 ? requestFiles.length : initialFiles.length;
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileCount > 1 ? `${fileName} 외 ${fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                this.currentChatRoom.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                if (canWrite) {
                    await this.putChatRoomMerged(this.currentChatRoom);
                }
                this.EventBus.emit('chat-rooms-updated');

                const pageEdit = this.parseHwpxPageInstruction(msg.content || '');
                if (pageEdit) {
                    const hwpxPanel = [...this.artifactPanels].reverse().find((p) => p.type === 'hwpx' && p.data?.fileUrl);
                    if (hwpxPanel) {
                        payload.hwpxUrl = hwpxPanel.data.fileUrl;
                        payload.hwpxEdit = {
                            page_number: pageEdit.pageNumber,
                            instruction: pageEdit.instruction
                        };
                    }
                }

                // ---- 멀티 에이전트 라우팅/스트리밍 ----
                const agentTargets = await this.resolveAgentTargetsForMessage(msg.content || '', msg.mentionedUsers || []);
                if (agentTargets.length > 0) {
                    await this.streamAgents(agentTargets, msg.content || '', payload);
                }
            } catch (e) {
                // ignore
            } finally {
                this.isSending = false;
                this.focusComposerInput();
            }
        },

        // ===== 자동 추천(초대) =====
        _tokenizeForRecommend(text) {
            const s = (text || '').toString().toLowerCase();
            const tokens = s
                .split(/[\s,.;:(){}\[\]"'`~!@#$%^&*+=<>/?\\|]+/g)
                .map((t) => t.trim())
                .filter((t) => t.length >= 2)
                .slice(0, 12);
            // uniq preserve order
            const seen = new Set();
            const out = [];
            for (const t of tokens) {
                if (seen.has(t)) continue;
                seen.add(t);
                out.push(t);
            }
            return out;
        },

        _agentHaystackForRecommend(agent) {
            const a = agent || {};
            const parts = [
                a.username,
                a.name,
                a.alias,
                a.role,
                a.goal,
                a.persona,
                a.description,
                a.tools,
                typeof a.skills === 'string' ? a.skills : a.skills ? JSON.stringify(a.skills) : ''
            ]
                .filter(Boolean)
                .map((v) => (v || '').toString().toLowerCase());
            return parts.join(' | ');
        },

        _scoreAgentForRecommend(agent, tokens) {
            const hay = this._agentHaystackForRecommend(agent);
            if (!hay) return 0;
            const ts = Array.isArray(tokens) ? tokens : [];
            let score = 0;
            for (const t of ts) {
                if (t && hay.includes(t)) score += 1;
            }
            return score;
        },

        _pickRecommendationCandidates(allAgents, userText, excludeIds, limit = 80) {
            const list = Array.isArray(allAgents) ? allAgents : [];
            const exclude = new Set((excludeIds || []).map((x) => (x || '').toString()).filter(Boolean));
            const tokens = this._tokenizeForRecommend(userText);

            const filtered = list.filter((a) => {
                const id = (a?.id || a?.uid || '').toString();
                if (!id) return false;
                if (exclude.has(id)) return false;
                if (a?.is_hidden === true) return false;
                // 안전장치: is_agent가 명시된 경우만 통과
                if (a?.is_agent === false) return false;
                return true;
            });

            const scored = filtered.map((a, idx) => ({
                a,
                idx,
                score: this._scoreAgentForRecommend(a, tokens)
            }));

            scored.sort((x, y) => {
                if (y.score !== x.score) return y.score - x.score;
                return x.idx - y.idx; // stable
            });

            const top = scored.slice(0, Math.max(10, Math.min(120, limit))).map((x) => x.a);
            return top;
        },

        async _getAgentDirectoryCached(ttlMs = 60_000) {
            const now = Date.now();
            if (this._agentDirectoryCache && now - (this._agentDirectoryCacheAt || 0) < ttlMs) {
                return Array.isArray(this._agentDirectoryCache) ? this._agentDirectoryCache : [];
            }
            try {
                const list = await backend.getAgentList?.();
                const out = Array.isArray(list) ? list : [];
                this._agentDirectoryCache = out;
                this._agentDirectoryCacheAt = now;
                return out;
            } catch (e) {
                return [];
            }
        },

        async handleInviteAgent(_payload) {
            try {
                if (!this.currentChatRoom?.id) return;
                const roomId = this.currentChatRoom.id;
                const messageUuid = (_payload?.messageUuid || '').toString();
                const agentId = (_payload?.agentId || '').toString();
                if (!messageUuid || !agentId) return;

                // 1) 추천 메시지(invited 상태) 업데이트 + 저장
                const recIdx = this.messages.findIndex((m) => m?.uuid === messageUuid);
                if (recIdx !== -1) {
                    const recMsg = this.messages[recIdx];
                    const rec = recMsg?.__agentInviteRecommendation || null;
                    if (rec) {
                        if (!rec.invited) rec.invited = {};
                        if (rec.invited[agentId] === true) {
                            // 이미 처리됨(중복 클릭 방지)
                        } else {
                            rec.invited[agentId] = true;
                        }
                    }
                    await backend.putObject(`db://chats/${messageUuid}`, {
                        uuid: messageUuid,
                        id: roomId,
                        messages: this.messages[recIdx]
                    });
                }

                // 2) 채팅방 참가자에 에이전트 추가 + 저장
                let agentMeta = null;
                try {
                    agentMeta = this.defaultSetting?.getAgentById?.(agentId) || null;
                } catch (e) {}
                if (!agentMeta) {
                    try {
                        agentMeta = await backend.getUserById(agentId);
                    } catch (e) {
                        agentMeta = null;
                    }
                }
                const agentPart = this.normalizeParticipant(agentMeta || { id: agentId, username: agentId });

                const curParts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
                const normalized = curParts.map((p) => this.normalizeParticipant(p)).filter(Boolean);
                const exists = normalized.some((p) => this.participantMatches(p, agentPart));
                if (!exists) {
                    this.currentChatRoom.participants = [...curParts, agentPart].filter(Boolean);
                    await this.putChatRoomMerged(this.currentChatRoom);
                    this.EventBus.emit('chat-rooms-updated');
                }

                // 3) 트리거(직전 사용자 요청) 찾아서 해당 에이전트로만 자동 재호출
                let triggerUuid = null;
                try {
                    const recMsg = recIdx !== -1 ? this.messages[recIdx] : null;
                    triggerUuid = recMsg?.__agentInviteRecommendation?.triggerUserUuid || null;
                } catch (e) {}

                let triggerMsg = null;
                if (triggerUuid) {
                    triggerMsg = this.messages.find((m) => m?.uuid === triggerUuid) || null;
                }
                if (!triggerMsg) {
                    // fallback: 마지막 user 메시지
                    const reversed = [...(this.messages || [])].reverse();
                    triggerMsg = reversed.find((m) => (m?.role || '').toString() === 'user') || null;
                }

                const userText = (triggerMsg?.content || '').toString();
                const triggerFiles = Array.isArray(triggerMsg?.pdfFiles)
                    ? triggerMsg.pdfFiles
                    : triggerMsg?.pdfFile
                    ? [triggerMsg.pdfFile]
                    : [];
                const resendPayload = {
                    images: Array.isArray(triggerMsg?.images) ? triggerMsg.images : [],
                    file: triggerFiles[0] || null,
                    files: triggerFiles,
                    metadata: {
                        // deepagents orchestration에서는 "참가(참여) 에이전트 목록"을 메타데이터로 전달한다.
                        // (초대된 에이전트도 participants에 반영된 뒤 이 목록에 포함됨)
                        participant_agent_ids: [agentId]
                    }
                };

                const agentTarget = {
                    id: agentId,
                    username: (agentMeta?.username || agentMeta?.name || agentPart?.username || agentId).toString(),
                    email: agentMeta?.email || agentPart?.email || `agent:${agentId}`,
                    profile: agentMeta?.profile || agentPart?.profile || null,
                    alias: agentMeta?.alias || '',
                    policy: 'must_reply',
                    __routingDecision: {
                        should_intervene: true,
                        reply_mode: 'answer',
                        reason: 'auto_invite_recommendation',
                        confidence: null,
                        agent_selection_reason: null
                    }
                };

                await this.streamAgents([agentTarget], userText, resendPayload);
            } catch (e) {
                // ignore
            }
        },

        getAgentCandidates() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            const candidates = parts
                .map((p) => this.normalizeParticipant(p))
                .filter((p) => p && p.id)
                .map((p) => {
                    const agent = p?.id ? this.defaultSetting?.getAgentById?.(p.id) : null;
                    // 참가자 객체에 is_agent/agent_type가 없을 수 있어 defaultSetting도 활용
                    const isProcessGpt = p.id === PROCESS_GPT_AGENT_ID;
                    const isAgent = isProcessGpt || p.agent_type === 'agent' || p.is_agent === true || !!agent;
                    if (!isAgent) return null;
                    return {
                        id: p.id,
                        username: p.id === PROCESS_GPT_AGENT_ID ? 'Process GPT Agent' : agent?.username || p.username || p.email || p.id,
                        email: agent?.email || p.email || null,
                        profile: agent?.profile || p.profile || null,
                        alias: agent?.alias || ''
                    };
                })
                .filter(Boolean);

            // dedupe by id
            const uniq = new Map();
            candidates.forEach((a) => {
                if (!uniq.has(a.id)) uniq.set(a.id, a);
            });
            return Array.from(uniq.values());
        },

        isSystemParticipant(p) {
            if (!p) return false;
            const id = p.id || p.uid || null;
            const email = (p.email || '').toString().toLowerCase();
            return id === 'system_id' || email === 'system@uengine.org';
        },

        getNormalizedParticipants() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            return parts.map((p) => this.normalizeParticipant(p)).filter(Boolean);
        },

        isOneOnOneWithSingleAgent(agentId) {
            // "나 + 에이전트 1명"만 있는 경우(시스템은 무시)
            const me = this.normalizeParticipant(this.userInfo);
            const parts = this.getNormalizedParticipants().filter((p) => !this.isSystemParticipant(p));
            if (!me?.id && !me?.email) return false;
            const isMe = (p) => {
                if (!p) return false;
                if (me.id && p.id && p.id === me.id) return true;
                if (me.email && p.email && p.email === me.email) return true;
                return false;
            };
            const others = parts.filter((p) => !isMe(p));
            if (others.length !== 1) return false;
            const onlyOther = others[0];
            const otherId = onlyOther?.id || null;
            return !!otherId && otherId === agentId;
        },

        buildRecentHistoryForRouting(limit = 10) {
            const msgs = Array.isArray(this.messages) ? this.messages : [];
            const recent = msgs
                .filter((m) => m && !m.isLoading && (m.content || '').toString().trim())
                .slice(-Math.max(5, Math.min(10, limit)));
            if (recent.length === 0) return '(없음)';
            return recent
                .map((m) => {
                    const role = (m.role || '').toString();
                    const content = (m.content || '').toString().replace(/\s+/g, ' ').trim().substring(0, 600);
                    if (role === 'user') {
                        const name = (m.name || m.userName || m.email || 'user').toString();
                        return `[user][${name}]: ${content}`;
                    }
                    const name = (m.name || m.userName || 'assistant').toString();
                    const agentId = (m.agentId || '').toString();
                    return agentId ? `[assistant][${name}][agentId=${agentId}]: ${content}` : `[assistant][${name}]: ${content}`;
                })
                .join('\n');
        },

        buildAgentsInfoForRouting(agentCandidates) {
            const list = Array.isArray(agentCandidates) ? agentCandidates : [];
            if (list.length === 0) return '(없음)';
            const lines = list
                .map((a) => {
                    const id = a?.id;
                    if (!id) return null;
                    if (id === PROCESS_GPT_AGENT_ID) {
                        const m = MAIN_PROCESS_GPT_AGENT_META;
                        const inRoom = a?.in_room === true;
                        return `- id=${m.id}, in_room=${inRoom}, name=${m.username}, alias=${m.alias}, role=${m.role}, goal=${m.goal}, description=${m.description}, tools=${m.tools}`;
                    }
                    const meta = this.defaultSetting?.getAgentById?.(id) || {};
                    const inRoom = a?.in_room === true;
                    const name = a?.username || a?.name || meta?.username || id;
                    const alias = a?.alias || meta?.alias || '';
                    const role = a?.role || meta?.role || '';
                    const goal = a?.goal || meta?.goal || '';
                    const persona = a?.persona || meta?.persona || '';
                    const description = a?.description || meta?.description || '';
                    const tools = a?.tools || meta?.tools || '';
                    const skillsObj = a?.skills ?? meta?.skills ?? null;
                    const skills = skillsObj ? (typeof skillsObj === 'string' ? skillsObj : JSON.stringify(skillsObj)) : '';
                    return `- id=${id}, in_room=${inRoom}, name=${name}, alias=${alias}, role=${role}, goal=${goal}, persona=${persona}, description=${description}, tools=${tools}, skills=${skills}`;
                })
                .filter(Boolean);
            return lines.length > 0 ? lines.join('\n') : '(없음)';
        },

        extractAssignedSkills(agentTarget) {
            const raw = agentTarget?.skills ?? null;
            if (!raw) return [];
            if (Array.isArray(raw)) {
                return raw.map((v) => String(v || '').trim()).filter(Boolean);
            }
            if (typeof raw === 'string') {
                const s = raw.trim();
                if (!s) return [];
                if (s.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(s);
                        if (Array.isArray(parsed)) {
                            return parsed.map((v) => String(v || '').trim()).filter(Boolean);
                        }
                    } catch (e) {
                        // ignore parse error and fallback to comma split
                    }
                }
                return s
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean);
            }
            if (typeof raw === 'object') {
                try {
                    const values = Object.values(raw || {});
                    return values.map((v) => String(v || '').trim()).filter(Boolean);
                } catch (e) {
                    return [];
                }
            }
            return [];
        },

        addRoutingLoadingMessage() {
            try {
                const uuid = this.uuid();
                const nowIso = new Date().toISOString();
                this.messages.push({
                    uuid,
                    role: 'assistant',
                    content: '...',
                    contentType: 'text',
                    isLoading: true,
                    toolCalls: [],
                    timeStamp: nowIso,
                    email: 'system@uengine.org',
                    name: '',
                    userName: '',
                    agentId: '__router__',
                    __routingLoading: true
                });
                this.$nextTick(() => this.scrollToBottomSafe());
                return uuid;
            } catch (e) {
                return null;
            }
        },

        removeRoutingLoadingMessage(uuid) {
            if (!uuid) return;
            const idx = this.messages.findIndex((m) => m?.uuid === uuid);
            if (idx !== -1) this.messages.splice(idx, 1);
        },

        parseMentions(text) {
            const s = (text || '').toString();
            const mentions = [];
            const re = /@([0-9A-Za-z가-힣._-]+)/g;
            let m;
            while ((m = re.exec(s)) !== null) {
                const raw = (m[1] || '').trim();
                if (raw) mentions.push(raw);
            }
            // uniq
            return Array.from(new Set(mentions));
        },

        async resolveAgentTargetsForMessage(text, mentionedUsers = []) {
            const inRoomAgentsRaw = this.getAgentCandidates();
            // NOTE:
            // - 멘션이 아닌 경우에는 1:1(사람-사람 / 사람-에이전트 포함)이라도 router가 개입 여부/추천을 판단해야 함.
            // - 방에 참여 중인 에이전트가 0명이어도, 조직도(디렉토리) 기반으로 "초대 추천"은 가능해야 함.

            // 0) payload 기반 멘션(정확): 선택된 멘션이 있으면 그것만 응답
            const mentioned = Array.isArray(mentionedUsers) ? mentionedUsers : [];
            if (mentioned.length > 0) {
                const ids = new Set(mentioned.map((u) => (u?.id || '').toString()).filter(Boolean));
                const pickedById = inRoomAgentsRaw.filter((a) => a?.id && ids.has(a.id));
                if (pickedById.length > 0) {
                    return pickedById.map((a) => ({ ...a, policy: 'must_reply' }));
                }

                // fallback: mentionText/username 기반 매칭
                const norm = (v) => (v || '').toString().toLowerCase().replace(/\s+/g, '');
                const mentionKeys = new Set(
                    mentioned
                        .flatMap((u) => [u?.mentionText, u?.username, u?.alias, u?.id])
                        .filter(Boolean)
                        .map(norm)
                );
                const matched = inRoomAgentsRaw.filter((a) => {
                    const keys = [a.username, a.alias, a.id].filter(Boolean).map(norm);
                    return keys.some((k) => mentionKeys.has(k));
                });
                // 멘션은 했지만 에이전트가 아닌 유저만 멘션한 경우 → 에이전트는 응답하지 않음
                return matched.map((a) => ({ ...a, policy: 'must_reply' }));
            }

            // 1) 텍스트 기반 멘션(호환)
            const mentions = this.parseMentions(text);
            if (mentions.length > 0) {
                // 멘션 있음: 멘션된 에이전트만 반드시 응답 (기존 동작 유지)
                const norm = (v) => (v || '').toString().toLowerCase().replace(/\s+/g, '');
                const mentionSet = new Set(mentions.map(norm));
                const matched = inRoomAgentsRaw.filter((a) => {
                    const keys = [a.username, a.alias, a.id].filter(Boolean).map(norm);
                    return keys.some((k) => mentionSet.has(k));
                });
                return matched.map((a) => ({ ...a, policy: 'must_reply' }));
            }

            // 멘션 없음:
            // - 1:1이라도 router가 선별(개입/추천/초대)해야 함
            const routingLoadingUuid = this.addRoutingLoadingMessage();
            const recent_history = this.buildRecentHistoryForRouting(10);
            const inRoomIdSet = new Set((inRoomAgentsRaw || []).map((a) => a?.id).filter(Boolean));
            const excludeIds = Array.from(inRoomIdSet.values());

            // 전체 에이전트(조직도/디렉토리)에서 후보를 일부만 뽑아 라우팅에 포함
            const allAgents = await this._getAgentDirectoryCached(60_000);
            const dirCandidates = this._pickRecommendationCandidates(allAgents, (text || '').toString(), excludeIds, 80);

            const inRoomAgents = (inRoomAgentsRaw || []).map((a) => {
                const meta = a?.id ? this.defaultSetting?.getAgentById?.(a.id) || {} : {};
                return {
                    ...a,
                    // prompt에 넣기 위한 메타(있으면)
                    role: meta?.role || '',
                    goal: meta?.goal || '',
                    persona: meta?.persona || '',
                    description: meta?.description || '',
                    tools: meta?.tools || '',
                    skills: meta?.skills || null,
                    in_room: true
                };
            });

            const directoryAgents = (dirCandidates || [])
                .map((a) => {
                    const id = (a?.id || a?.uid || '').toString();
                    if (!id) return null;
                    return {
                        id,
                        username: (a?.username || a?.name || a?.email || id).toString(),
                        email: a?.email || null,
                        profile: a?.profile || null,
                        alias: a?.alias || '',
                        role: a?.role || '',
                        goal: a?.goal || '',
                        persona: a?.persona || '',
                        description: a?.description || '',
                        tools: a?.tools || '',
                        skills: a?.skills || null,
                        in_room: false
                    };
                })
                .filter(Boolean)
                // dedupe with in-room
                .filter((a) => !inRoomIdSet.has(a.id));

            const allCandidates = [...inRoomAgents, ...directoryAgents];
            const agents_info = this.buildAgentsInfoForRouting(allCandidates);
            const candidate_agent_ids = allCandidates.map((a) => a.id).filter(Boolean);

            // For router rules (e.g., 1:1 room -> current agent must reply)
            const roomParticipants = this.getNormalizedParticipants().filter((p) => !this.isSystemParticipant(p));
            const room_participant_ids = roomParticipants.map((p) => (p?.id || '').toString()).filter(Boolean);
            const room_member_count = roomParticipants.length;
            const current_agent_id =
                room_member_count === 2 && Array.isArray(inRoomAgentsRaw) && inRoomAgentsRaw.length === 1 && inRoomAgentsRaw[0]?.id
                    ? inRoomAgentsRaw[0].id
                    : null;
            try {
                const tenant_id = window.$tenantName || localStorage.getItem('tenantId') || '';
                const user_uid = this.userInfo?.uid || this.userInfo?.id || '';
                const router = this.getAgentRouterForOrchestration(this.getRoomOrchestration());
                const routed = await router.routeAgents({
                    user_message: (text || '').toString(),
                    recent_history,
                    agents_info,
                    candidate_agent_ids,
                    conversation_id: this.currentChatRoom?.id || null,
                    tenant_id,
                    user_uid,
                    room_member_count,
                    room_participant_ids,
                    ...(current_agent_id ? { current_agent_id } : {})
                });
                const should = !!routed?.should_intervene;
                const selected = Array.isArray(routed?.selected_agent_ids) ? routed.selected_agent_ids : [];
                const selectedSet = new Set(selected.map((v) => (v || '').toString()).filter(Boolean));
                if (!should || selectedSet.size === 0) {
                    this.removeRoutingLoadingMessage(routingLoadingUuid);
                    return [];
                }
                // 방 안/밖으로 분리
                const pickedInRoom = inRoomAgentsRaw.filter((a) => selectedSet.has(a.id));
                const pickedOutRoom = directoryAgents.filter((a) => selectedSet.has(a.id));

                const hasPickedInRoom = pickedInRoom.length > 0;

                // 방 밖 후보가 선택된 경우 → 초대 카드 표시
                // (mixed case: 방 안 응답 + 방 밖 추천이 동시에 있으면 둘 다 표시)
                if (pickedOutRoom.length > 0) {
                    // 방 안 응답이 없을 때만 routing loading bubble을 먼저 제거(기존 동작 유지)
                    if (!hasPickedInRoom) this.removeRoutingLoadingMessage(routingLoadingUuid);
                    try {
                        const recommendUuid = this.uuid();
                        const nowIso = new Date().toISOString();
                        const recommendedAgents = pickedOutRoom
                            .slice(0, 3)
                            .map((a) => ({
                                id: a.id,
                                username: a.username || a.id,
                                alias: a.alias || '',
                                profile: a.profile || '/images/chat-icon.png',
                                role: a.role || '',
                                goal: a.goal || '',
                                description: a.description || ''
                            }))
                            .filter((x) => x.id);
                        if (recommendedAgents.length > 0) {
                            const recMsg = {
                                uuid: recommendUuid,
                                role: 'assistant',
                                content: '적절한 담당자를 초대해볼까요?',
                                contentType: 'text',
                                isLoading: false,
                                toolCalls: [],
                                timeStamp: nowIso,
                                email: 'system@uengine.org',
                                name: '',
                                userName: '',
                                agentId: '__router__',
                                __agentInviteRecommendation: {
                                    triggerUserUuid: null, // handleSendMessage에서 주입되는 user msg uuid를 쓰지 못하므로 아래에서 fallback 처리
                                    recommendedAgents,
                                    invited: {},
                                    reason: routed?.agent_selection_reason || routed?.reason || '',
                                    confidence: routed?.confidence ?? null
                                }
                            };
                            // triggerUserUuid를 직전 user 메시지로 설정 (가장 최근 user)
                            try {
                                const lastUser = [...(this.messages || [])].reverse().find((m) => (m?.role || '') === 'user');
                                if (lastUser?.uuid) recMsg.__agentInviteRecommendation.triggerUserUuid = lastUser.uuid;
                            } catch (e) {}

                            this.messages.push(recMsg);
                            this.$nextTick(() => this.scrollToBottomSafe());
                            await backend.putObject(`db://chats/${recommendUuid}`, {
                                uuid: recommendUuid,
                                id: this.currentChatRoom.id,
                                messages: recMsg
                            });
                        }
                    } catch (e) {}
                }

                if (hasPickedInRoom) {
                    return pickedInRoom.map((a) => ({
                        ...a,
                        policy: 'must_reply',
                        __routingLoadingUuid: routingLoadingUuid,
                        __routingDecision: {
                            should_intervene: true,
                            reply_mode: routed?.reply_mode || null,
                            reason: routed?.reason || '',
                            confidence: routed?.confidence ?? null,
                            agent_selection_reason: routed?.agent_selection_reason || null
                        }
                    }));
                }

                // 방 안에 선택된 에이전트가 없고, 방 밖 후보만 선택된 경우
                if (pickedOutRoom.length > 0) {
                    return [];
                }

                this.removeRoutingLoadingMessage(routingLoadingUuid);
                return [];
            } catch (e) {
                // fallback 1) 1:1(나+현재 에이전트)인 경우 → 현재 에이전트 반드시 응답
                if (current_agent_id) {
                    const current = inRoomAgentsRaw.find((a) => a?.id === current_agent_id) || null;
                    if (current) {
                        return [
                            {
                                ...current,
                                policy: 'must_reply',
                                __routingLoadingUuid: routingLoadingUuid,
                                __routingDecision: {
                                    should_intervene: true,
                                    reply_mode: 'answer',
                                    reason: 'router_failed_fallback_to_current_agent',
                                    confidence: null,
                                    agent_selection_reason: null
                                }
                            }
                        ];
                    }
                }
                // fallback: 메인만 호출(단, 방에 참여 중인 경우)
                const main = inRoomAgentsRaw.find((a) => a?.id === PROCESS_GPT_AGENT_ID);
                if (!main) {
                    this.removeRoutingLoadingMessage(routingLoadingUuid);
                    return [];
                }
                return [
                    {
                        ...main,
                        policy: 'must_reply',
                        __routingLoadingUuid: routingLoadingUuid,
                        __routingDecision: {
                            should_intervene: true,
                            reply_mode: 'answer',
                            reason: 'router_failed_fallback_to_main',
                            confidence: null,
                            agent_selection_reason: null
                        }
                    }
                ];
            }
        },

        /** OpenUI state: { formId: { field: { value, componentType } } } → { formId: { field: value } } */
        simplifyOpenUiFormFieldValue(v) {
            if (v == null) return v;
            if (typeof v !== 'object' || Array.isArray(v)) return v;
            if (Object.prototype.hasOwnProperty.call(v, 'value')) return v.value;
            return v;
        },
        simplifyOpenUiFormState(formState) {
            if (!formState || typeof formState !== 'object' || Array.isArray(formState)) return formState;
            const out = {};
            for (const [formId, block] of Object.entries(formState)) {
                if (!block || typeof block !== 'object' || Array.isArray(block)) {
                    out[formId] = block;
                    continue;
                }
                const flat = {};
                for (const [fieldKey, fieldVal] of Object.entries(block)) {
                    flat[fieldKey] = this.simplifyOpenUiFormFieldValue(fieldVal);
                }
                out[formId] = flat;
            }
            return out;
        },

        buildMessageForAgent(userText, payload, policy) {
            let messageForAgent = (userText || '').toString();
            // 첨부 정보는 기존 방식처럼 [InputData]로 전달
            const normalizedFiles = this.normalizePayloadFiles(payload);

            // 방(room)에 누적된 모든 파일을 session_files 로 모아 매 턴 LLM 에게 전달.
            // → 사용자가 "다시 생성" 처럼 파일 재첨부 없이 후속 요청을 보내도 LLM 이 이전 파일 컨텍스트를
            //   알 수 있어 create_pdf2bpmn_workitem 등에서 placeholder([PDF_FILE_URL]) 를 쓰는 사고 방지.
            const sessionFilesMap = {};
            const pushSessionFile = (f) => {
                if (!f || typeof f !== 'object') return;
                const name = f.fileName || f.originalFileName || f.name || '';
                const url = f.fileUrl || f.url || f.publicUrl || f.fullPath || '';
                if (!name || !url) return;
                if (sessionFilesMap[url]) return;
                sessionFilesMap[url] = {
                    fileName: name,
                    fileUrl: url,
                    fileType: f.fileType || f.type || '',
                    fileSize: f.fileSize || f.size || 0,
                };
            };
            try {
                for (const m of this.messages || []) {
                    if (!m || m.role !== 'user') continue;
                    if (m.pdfFile) pushSessionFile(m.pdfFile);
                    if (Array.isArray(m.pdfFiles)) m.pdfFiles.forEach(pushSessionFile);
                }
            } catch (e) {
                // 누적 수집 실패해도 nominal flow 는 유지
            }
            // 현재 턴 첨부도 합쳐 항상 최신 상태가 되게
            normalizedFiles.forEach(pushSessionFile);
            const sessionFiles = Object.values(sessionFilesMap);

            const hasImages = payload?.images && payload.images.length > 0;
            const hasCurrentFile = normalizedFiles.length > 0;
            const hasSessionFile = sessionFiles.length > 0;
            if (hasImages || hasCurrentFile || hasSessionFile || payload?.hwpxUrl || payload?.hwpxEdit) {
                const inputData = {};
                if (hasImages) inputData.images = payload.images;
                if (hasCurrentFile) {
                    // 하위 호환: 첫 파일은 file, 전체는 files
                    inputData.file = normalizedFiles[0];
                    inputData.files = normalizedFiles;
                }
                if (hasSessionFile) inputData.session_files = sessionFiles;
                if (payload?.hwpxUrl) inputData.hwpx_url = payload.hwpxUrl;
                if (payload?.hwpxEdit) inputData.hwpx_edit = payload.hwpxEdit;
                messageForAgent += `\n\n[InputData]\n${JSON.stringify(inputData)}`;
            }

            // OpenUI 폼 제출: message 본문에도 구조화 블록(서버 파싱용) + metadata는 streamAgents에서 병합
            if (payload?.openuiFormSubmission && typeof payload.openuiFormSubmission === 'object') {
                messageForAgent += `\n\n[OpenUIForm]\n${JSON.stringify(payload.openuiFormSubmission)}`;
            }

            // must_reply (침묵 정책 제거)
            return messageForAgent;
        },

        normalizeInputFile(file) {
            if (!file || typeof file !== 'object') return file || null;
            const url = file.url || file.fileUrl || file.publicUrl || file.signedUrl || '';
            const name = file.name || file.fileName || '';
            const contentType = file.contentType || file.fileType || '';
            const size = file.size || file.fileSize || null;
            if (!url && !name && !contentType && !size) return file;
            const normalized = { url, name, contentType };
            if (size) normalized.size = size;
            return normalized;
        },

        extractHwpxPayload(content) {
            const raw = (content || '').toString().trim();
            if (!raw) return null;
            // 마크다운 코드블록(```json ... ```) 안의 JSON도 추출
            const stripped = raw
                .replace(/^```[a-z]*\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();
            // content 전체 or 코드블록 내부에서 { ... } JSON 객체 추출
            const match = stripped.match(/\{[\s\S]*\}/);
            if (!match) return null;
            try {
                const parsed = JSON.parse(match[0]);
                if (!parsed || typeof parsed !== 'object') return null;
                const hasPdfUrl = !!(parsed.pdf_url || parsed.pdfUrl);
                const hasFileUrl = !!(parsed.file_url || parsed.fileUrl);
                const hasBase64 = !!(parsed.base64_data || parsed.base64Data);
                const hasHtmlUrl = !!(parsed.html_url || parsed.htmlUrl || parsed.hwpx_html_url || parsed.hwpxHtmlUrl);
                const hasSlideMarkdown = !!parsed.slide_markdown;
                if (hasPdfUrl || hasFileUrl || hasBase64 || hasHtmlUrl || hasSlideMarkdown) return parsed;
                return null;
            } catch (e) {
                return null;
            }
        },

        toggleArtifactSidebar() {
            if (!this.hasArtifactPanel) return;
            this.artifactSidebarVisible = !this.artifactSidebarVisible;
        },

        closeArtifactSidebar() {
            this.artifactSidebarVisible = false;
        },

        closeArtifactPanel(panelId) {
            const idx = this.artifactPanels.findIndex((p) => p.id === panelId);
            if (idx === -1) return;
            this.artifactPanels.splice(idx, 1);
            if (this.activeArtifactId === panelId) {
                this.activeArtifactId = this.artifactPanels[Math.max(0, idx - 1)]?.id || this.artifactPanels[0]?.id || null;
            }
            if (this.artifactPanels.length === 0) {
                this.artifactSidebarVisible = false;
            }
        },

        /**
         * 패널 등록/갱신. 같은 type+htmlUrl이 있으면 데이터를 업데이트하고 활성화.
         * 새 URL이면 새 탭 추가.
         */
        pushArtifactPanel({ type, label, data }) {
            // 산출물 파일 탭은 **프로세스 이름(label)** 기준으로 합친다 — deepagent 가 한 프로세스를
            // 여러 process-<id> 폴더로 쪼개 보내도(중복) 같은 이름이면 하나의 탭으로 병합(파일은 path 로 union).
            // (단, '산출물 파일'(default/미분류)·서로 다른 프로세스명은 별도 탭 유지.)
            if (type === 'files' && label && label !== '산출물 파일') {
                const sameLabelIdx = this.artifactPanels.findIndex(
                    (p) => p.type === 'files' && p.label === label && p.data?.messageId !== data?.messageId
                );
                if (sameLabelIdx !== -1) {
                    const existing = this.artifactPanels[sameLabelIdx];
                    const byPath = new Map();
                    for (const f of existing.data?.files || []) byPath.set(f.path, f);
                    for (const f of data?.files || []) byPath.set(f.path, f); // 새 파일이 우선(최신 내용)
                    this.artifactPanels[sameLabelIdx] = {
                        ...existing,
                        label,
                        data: { ...existing.data, ...data, files: Array.from(byPath.values()) }
                    };
                    this.activeArtifactId = existing.id;
                    this.artifactSidebarVisible = true;
                    return;
                }
            }
            const existingIdx = this.artifactPanels.findIndex(
                (p) =>
                    p.type === type &&
                    (type === 'slide' || type === 'process' || type === 'files'
                        ? p.data?.messageId === data?.messageId
                        : p.data?.htmlUrl === data?.htmlUrl)
            );
            if (existingIdx !== -1) {
                this.artifactPanels[existingIdx] = { ...this.artifactPanels[existingIdx], label, data };
                this.activeArtifactId = this.artifactPanels[existingIdx].id;
            } else {
                const id = `${type}-${this.uuid()}`;
                this.artifactPanels.push({ id, type, label, data });
                this.activeArtifactId = id;
            }
            // 문서/슬라이드/프로세스/산출물파일 같은 "실제 아티팩트"는 넓게 열기
            if (type === 'hwpx' || type === 'docx' || type === 'slide' || type === 'process' || type === 'files') {
                if ((this.artifactSidebarWidth || 0) < this.artifactSidebarWideWidth) {
                    this.artifactSidebarWidth = this.artifactSidebarWideWidth;
                }
            }
            this.artifactSidebarVisible = true;
        },

        /** 파일 경로에서 프로세스 그룹 키(process-<uuid> 폴더명) 추출. 없으면 'default'. */
        _processGroupKey(path) {
            const m = (path || '').replace(/\\/g, '/').match(/\/(process-[^/]+)\//);
            return m ? m[1] : 'default';
        },
        /** 그룹(프로세스) 파일들에서 표시 라벨 — process-definition.json 의 이름 우선, 없으면 폴더명. */
        _workspaceGroupLabel(group, files) {
            try {
                const pd = (files || []).find((f) => (f.name || '').toLowerCase() === 'process-definition.json');
                if (pd && pd.content) {
                    const obj = JSON.parse(pd.content);
                    const nm = (obj.processDefinitionName || (obj.processDefinition && obj.processDefinition.processDefinitionName) || '').toString().trim();
                    if (nm && nm !== '생성된 프로세스') return nm;
                }
            } catch (e) {
                /* ignore */
            }
            return group === 'default' ? '산출물 파일' : group;
        },
        /** deepagent 산출물 파일 패널 — 프로세스 폴더(process-<uuid>)마다 별도 탭. entry 가 있으면 by-path upsert. */
        upsertWorkspaceFilesPanel(entry) {
            const group = this._processGroupKey(entry && entry.path);
            if (!this.roomWorkspaceFilesByGroup[group]) this.roomWorkspaceFilesByGroup[group] = [];
            const arr = this.roomWorkspaceFilesByGroup[group];
            if (entry && entry.path) {
                const i = arr.findIndex((f) => f.path === entry.path);
                if (i === -1) arr.push(entry);
                else arr.splice(i, 1, { ...arr[i], ...entry });
                // (A) process-definition.json 이면 프론트 createBpmnXml 로 .bpmn 파생 → 같은 그룹에 추가(뷰어 표시용).
                if ((entry.name || '').toLowerCase() === 'process-definition.json' && entry.content) {
                    const bpmn = this._deriveBpmnEntry(entry);
                    if (bpmn) {
                        const bi = arr.findIndex((f) => f.path === bpmn.path);
                        if (bi === -1) arr.push(bpmn);
                        else arr.splice(bi, 1, bpmn);
                    }
                }
            }
            if (arr.length === 0) return;
            if (!this.workspaceSaveStateByGroup[group]) {
                this.workspaceSaveStateByGroup[group] = { saving: false, saved: false, error: '' };
            }
            const roomKey = (this.currentChatRoom?.id || this.roomId || 'room').toString();
            this.pushArtifactPanel({
                type: 'files',
                label: this._workspaceGroupLabel(group, arr),
                data: {
                    files: arr,
                    messageId: `files:${roomKey}:${group}`,
                    saveState: this.workspaceSaveStateByGroup[group],
                    processGroup: group
                }
            });
        },

        /**
         * 산출물 파일 목록에서 skills/<name>/<file> 들을 모아 zip 으로 스킬 서비스에 업로드한다.
         * - draft=true: 파일만 업로드(=/skills/{name} 편집기에서 로드 가능)하고 tenants.skills 목록 등록은 생략.
         * - draft=false(최종 저장): 업로드 + saveSkills 로 목록 승격.
         * SKILL.md frontmatter(name/description)가 없으면 항상 유효본으로 보정(스킬 서버 "No valid skills" 방지).
         * 반환: 등록(또는 업로드)된 스킬명 배열.
         */
        async _uploadSkillsFromFiles(list, { draft = false } = {}) {
            const savedSkillNames = [];
            const skillFilesByName = {};
            for (const f of list || []) {
                const p = (f.path || '').replace(/\\/g, '/');
                const m = p.match(/\/skills\/([^/]+)\/(.+)$/);
                if (!m) continue;
                (skillFilesByName[m[1]] = skillFilesByName[m[1]] || []).push({ relPath: m[2], content: (f.content || '').toString() });
            }
            const skillEntries = Object.entries(skillFilesByName);
            if (!skillEntries.length || !backend.uploadSkills) return savedSkillNames;
            const hasValidSkillFrontmatter = (txt) => {
                const s = (txt || '').toString();
                const mm = s.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
                if (!mm) return false;
                const fm = mm[1];
                return /(^|\n)\s*name\s*:\s*\S/.test(fm) && /(^|\n)\s*description\s*:\s*\S/.test(fm);
            };
            const buildSkillMd = (skillName, existing) => {
                const s = (existing || '').toString();
                let body = s.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
                if (!body) {
                    body =
                        `# ${skillName}\n\n## 개요\n\n'${skillName}' 작업을 표준 절차에 따라 수행하는 스킬입니다.\n\n` +
                        `## 사용 시점\n\n- 해당 업무를 일관된 기준으로 처리해야 할 때\n\n` +
                        `## 절차\n\n1. 입력을 확인한다.\n2. 표준 기준에 따라 처리한다.\n3. 결과를 검토하고 산출물을 남긴다.\n`;
                }
                const desc = `${skillName} 작업을 표준 절차에 따라 수행합니다.`;
                return `---\nname: ${skillName}\ndescription: "${desc}"\n---\n\n${body}\n`;
            };
            try {
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();
                for (const [skillName, sfiles] of skillEntries) {
                    const skillMdFile = sfiles.find((sf) => sf.relPath === 'SKILL.md' || /(^|\/)SKILL\.md$/i.test(sf.relPath));
                    const skillMdValid = skillMdFile && hasValidSkillFrontmatter(skillMdFile.content);
                    for (const sf of sfiles) {
                        if (sf === skillMdFile) continue;
                        zip.file(`${skillName}/${sf.relPath}`, sf.content);
                    }
                    const skillMdContent = skillMdValid ? skillMdFile.content : buildSkillMd(skillName, skillMdFile && skillMdFile.content);
                    zip.file(`${skillName}/SKILL.md`, skillMdContent);
                }
                const blob = await zip.generateAsync({ type: 'blob' });
                const file = new File([blob], 'skills.zip', { type: 'application/zip' });
                let res = null;
                try {
                    // draft 든 최종이든 파일은 업로드(편집기 로드용). 등록(saveSkills)은 draft 면 생략.
                    res = await backend.uploadSkills({ type: 'file', file, skipRegister: true });
                } catch (upErr) {
                    // draft 후 최종 저장 시 이미 업로드돼 있을 수 있음 → 무시하고 등록 단계로.
                    console.warn('[Skills] 업로드 실패(이미 존재 가능, 무시):', upErr);
                }
                const added = Array.isArray(res?.skills_added) && res.skills_added.length ? res.skills_added : skillEntries.map(([n]) => n);
                savedSkillNames.push(...added);
                if (!draft && backend.saveSkills) {
                    try {
                        await backend.saveSkills(savedSkillNames);
                    } catch (e) {
                        console.warn('[Skills] saveSkills 등록 실패(무시):', e);
                    }
                }
            } catch (skErr) {
                console.warn('[Skills] zip 업로드 실패:', skErr);
            }
            return savedSkillNames;
        },

        /** process-definition.json 항목 → createBpmnXml 로 변환한 .bpmn 파일 항목 생성(없으면 null). */
        _deriveBpmnEntry(pdEntry) {
            try {
                let def = JSON.parse(pdEntry.content);
                if (def && def.processDefinition) def = def.processDefinition;
                const hasDef =
                    (Array.isArray(def.elements) && def.elements.length > 0) ||
                    (Array.isArray(def.activities) && def.activities.length > 0);
                if (!hasDef) return null;
                const xml = this._buildBpmnXmlFromDefinition(def);
                if (!xml) return null;
                const dir = (pdEntry.path || '').replace(/\\/g, '/').replace(/process-definition\.json$/, '');
                const base =
                    def.processDefinitionName && def.processDefinitionName !== '생성된 프로세스'
                        ? def.processDefinitionName
                        : 'process';
                const name = `${base}.bpmn`;
                // .bpmn 파일이 연결된 process-definition.json 내용도 함께 들고 다닌다(JSON 탭/편집/AI편집 + 저장용).
                return {
                    path: `${dir}${name}`,
                    name,
                    ext: '.bpmn',
                    content: xml,
                    json: (pdEntry.content || '').toString(),
                    jsonPath: pdEntry.path,
                    op: 'create',
                    status: 'done'
                };
            } catch (e) {
                return null;
            }
        },

        /** 우측 사이드바에 활동(현재 실행 중 tool / 서브에이전트) 패널 생성/갱신 */
        upsertActivityPanel() {
            if (!this.planSideInfoEnabled?.activity) return;
            const items = Object.values(this.plannedActivityById || {})
                .sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0));
            const data = { enabled: true, items };
            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'activity');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: '활동', data };
            } else {
                const id = `activity-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'activity', label: '활동', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },
        /** 활동 패널에 한 항목 추가/갱신. status 변경에도 사용. */
        recordActivity(entry) {
            if (!entry) return;
            const id = (entry.id || `${entry.tool || 'tool'}-${this._activityOrder}`).toString();
            const prev = this.plannedActivityById[id] || null;
            const merged = {
                ...(prev || {}),
                ...entry,
                id,
                __order: prev?.__order ?? ++this._activityOrder
            };
            this.plannedActivityById = { ...this.plannedActivityById, [id]: merged };
            if (!this.planSideInfoEnabled.activity) this.planSideInfoEnabled.activity = true;
            this.upsertActivityPanel();
        },

        /** 우측 사이드바에 Tools 정보 패널(숨김 타입) 생성/갱신 */
        upsertToolsPanel() {
            if (!this.planSideInfoEnabled?.tools) return;
            const items = Object.values(this.plannedToolsById || {});
            // 최신이 아래로 쌓이도록 id 기반 정렬(단순)
            const sorted = items.sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0));
            const data = { enabled: true, items: sorted };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'tools');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: 'Tools', data };
            } else {
                const id = `tools-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'tools', label: 'Tools', data });
            }
            // side-info만 있을 때는 좁게 열기
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            // tools 이벤트가 오면 자동으로 열어줌(요구가 "간단"이므로)
            this.artifactSidebarVisible = true;
        },

        /** 우측 사이드바에 Todos 정보 패널(숨김 타입) 생성/갱신 */
        upsertTodosPanel() {
            if (!this.planSideInfoEnabled?.todos) return;
            const items = Array.isArray(this.plannedTodos) ? this.plannedTodos : [];
            const data = { enabled: true, items };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'todos');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: 'Todos', data };
            } else {
                const id = `todos-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'todos', label: 'Todos', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },

        /** 우측 사이드바에 Skills 정보 패널(숨김 타입) 생성/갱신 */
        upsertSkillsPanel() {
            if (!this.planSideInfoEnabled?.skills) return;
            const raw = Array.isArray(this.plannedSkills) ? this.plannedSkills : [];
            // 서버 포맷: ["korea-econ-indicators"] 처럼 문자열 배열
            const items = raw
                .map((s) => (typeof s === 'string' ? { name: s } : s))
                .filter((s) => s && (s.name || s.label || s.skill));
            const data = { enabled: true, items };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'skills');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: 'Skills', data };
            } else {
                const id = `skills-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'skills', label: 'Skills', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },

        /** 우측 사이드바에 Connectors(MCP 서버) 패널 생성/갱신 */
        upsertConnectorsPanel() {
            if (!this.planSideInfoEnabled?.connectors) return;
            const raw = Array.isArray(this.plannedConnectors) ? this.plannedConnectors : [];
            const items = raw
                .map((s) => (typeof s === 'string' ? { name: s } : s))
                .filter((s) => s && (s.name || s.label));
            const data = { enabled: true, items };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'connectors');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: 'Connectors', data };
            } else {
                const id = `connectors-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'connectors', label: 'Connectors', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },

        /** 우측 사이드바에 첨부(chat_attachments) 패널 생성/갱신 */
        upsertAttachmentsPanel() {
            if (!this.planSideInfoEnabled?.attachments) return;
            const items = Array.isArray(this.plannedAttachments) ? this.plannedAttachments : [];
            const data = { enabled: true, items };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'attachments');
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: '첨부', data };
            } else {
                const id = `attachments-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'attachments', label: '첨부', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },

        /** ArtifactPanel의 panel-action 이벤트 중앙 처리 */
        // 지식 베이스(Google Drive) — 입력창 칩 선택 변경
        onKnowledgeDocsUpdate(docs) {
            this.selectedKnowledgeDocs = Array.isArray(docs) ? docs : [];
            this.upsertKnowledgePanel();
        },

        /** 우측 사이드바에 지식 베이스 컨텍스트 패널 생성/갱신 */
        upsertKnowledgePanel() {
            const items = Array.isArray(this.selectedKnowledgeDocs) ? this.selectedKnowledgeDocs : [];
            const enabled = !!this.planSideInfoEnabled?.knowledge;
            const data = { enabled, items };

            const existingIdx = this.artifactPanels.findIndex((p) => p.type === 'knowledge');
            if (items.length === 0) {
                if (existingIdx !== -1) this.artifactPanels.splice(existingIdx, 1);
                if (this.artifactPanels.length === 0) {
                    this.artifactSidebarVisible = false;
                }
                return;
            }
            if (existingIdx !== -1) {
                const existing = this.artifactPanels[existingIdx];
                this.artifactPanels[existingIdx] = { ...existing, label: '지식 베이스', data };
            } else {
                const id = `knowledge-${this.uuid()}`;
                this.artifactPanels.push({ id, type: 'knowledge', label: '지식 베이스', data });
            }
            const hasRealArtifact = (this.artifactPanels || []).some((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
            if (!hasRealArtifact) this.artifactSidebarWidth = this.artifactSidebarNarrowWidth;
            this.artifactSidebarVisible = true;
        },

        handleArtifactAction({ type, action, panelId, payload }) {
            if (type === 'hwpx') {
                if (action === 'page-edit-request') {
                    this.handleHwpxSectionEdit(panelId, payload);
                } else if (action === 'download') {
                    this.handleHwpxDownload(panelId, payload);
                }
            } else if (type === 'docx') {
                if (action === 'page-edit-request') {
                    this.handleDocxSectionEdit(panelId, payload);
                } else if (action === 'download') {
                    this.handleDocxDownload(panelId, payload);
                }
            } else if (type === 'process') {
                if (action === 'preview-bpmn') {
                    this.showBpmnPreview(payload);
                } else if (action === 'save-generated-process') {
                    // payload 는 mapped 결과 객체 — handleSaveGeneratedProcess 는 message.pdf2bpmnResult 를 기대
                    this.handleSaveGeneratedProcess({ pdf2bpmnResult: payload });
                }
            } else if (type === 'files') {
                if (action === 'save') {
                    this.handleSaveWorkspaceFiles(payload);
                } else if (action === 'edit-file') {
                    this.handleWorkspaceFileEdit(panelId, payload);
                } else if (action === 'ai-edit-file') {
                    this.aiEditWorkspaceFile(panelId, payload);
                } else if (action === 'navigate-process') {
                    // 산출물 '편집' → 내부 편집기로 이동(임시저장 draft 를 수정). kind 별 라우팅.
                    const kind = (payload && payload.kind ? payload.kind : 'process').toString();
                    const id = (payload && (payload.id || payload.name) ? (payload.id || payload.name) : '').toString().trim();
                    if (!id) return;
                    let path = '';
                    if (kind === 'skill') path = `/skills/${encodeURIComponent(id)}`;
                    else if (kind === 'agent') path = `/agent-chat/${id}`;
                    else path = `/definitions/${id}`;
                    this.$router.push({ path }).catch(() => {});
                }
            }
        },

        /** 작업 폴더 파일 AI 편집 — LLM 으로 내용을 지시대로 수정 후 반영(HWP AI편집과 동일 UX). */
        async aiEditWorkspaceFile(panelId, payload) {
            const path = (payload?.path || '').toString();
            const instruction = (payload?.instruction || '').toString().trim();
            const content = (payload?.content ?? '').toString();
            const ext = (payload?.ext || '').toString();
            if (!path || !instruction) return;
            try {
                let edited = await this._aiEditText(content, instruction, ext);
                edited = (edited || '').toString().trim();
                // 모델이 코드펜스로 감싸면 제거
                edited = edited.replace(/^```[a-zA-Z0-9]*\n?/, '').replace(/\n?```$/, '').trim();
                if (edited) {
                    // bpmn 은 JSON 을 수정 대상으로(편집 시 XML 자동 갱신), 그 외는 content.
                    if (payload?.target === 'def-json') {
                        this.handleWorkspaceFileEdit(panelId, { path, json: edited, target: 'def-json' });
                    } else {
                        this.handleWorkspaceFileEdit(panelId, { path, content: edited });
                    }
                } else if (this.$toast?.warning) {
                    this.$toast.warning('AI 편집 결과가 비어 있습니다.');
                }
            } catch (e) {
                if (this.$toast?.error) this.$toast.error('AI 편집 실패: ' + (e?.message || ''));
                console.warn('[aiEditWorkspaceFile] 실패:', e);
            }
        },

        /** AIGenerator 일회성 호출 — 내용+지시 → 수정된 전체 내용 텍스트 반환. */
        async _aiEditText(content, instruction, ext) {
            const AIGen = (await import('@/components/ai/AIGenerator.js')).default;
            return new Promise((resolve, reject) => {
                let acc = '';
                let settle = null;
                let resolved = false;
                const finish = () => {
                    if (resolved) return;
                    resolved = true;
                    if (settle) clearTimeout(settle);
                    resolve(acc);
                };
                const client = {
                    genType: 'edit',
                    onReceived: (joined) => {
                        acc = (joined ?? '').toString();
                        if (settle) clearTimeout(settle);
                        settle = setTimeout(finish, 1500); // 토큰 멈추면 완료로 간주
                    },
                    onModelCreated: () => {},
                    onGenerationFinished: () => finish(),
                    onError: (e) => {
                        if (!resolved) {
                            resolved = true;
                            reject(new Error(e?.message || 'AI 오류'));
                        }
                    }
                };
                const sys =
                    '너는 파일 내용 편집기다. 사용자의 지시대로 수정한 "전체 파일 내용"만 출력한다. ' +
                    '설명/머리말/마무리말/코드펜스(```)를 절대 붙이지 말고 수정된 내용 자체만 출력하라.';
                const userPrompt = `[파일 형식] ${ext || 'text'}\n[수정 지시]\n${instruction}\n\n[현재 내용]\n${content}`;
                try {
                    // AIGenerator 는 previousMessages 가 있으면 user 메시지를 자동 추가하지 않으므로(주석 처리됨),
                    // system + user 를 직접 모두 넣어준다. (안 그러면 'No user query found' 400 발생)
                    const gen = new AIGen(client, {
                        previousMessages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: userPrompt }
                        ],
                        preferredLanguage: 'Korean'
                    });
                    Promise.resolve(gen.generate()).catch((e) => {
                        if (!resolved) {
                            resolved = true;
                            reject(e);
                        }
                    });
                    // 안전 타임아웃(60s)
                    setTimeout(() => finish(), 60_000);
                } catch (e) {
                    reject(e);
                }
            });
        },

        /** 작업 폴더 파일 미리보기에서 내용 편집 → 패널 파일 content 갱신(+process-definition.json 이면 .bpmn 재파생). */
        handleWorkspaceFileEdit(panelId, payload) {
            const path = (payload?.path || '').toString();
            if (!path) return;
            const panel = (this.artifactPanels || []).find((p) => p.id === panelId);
            const files = panel?.data?.files;
            if (!Array.isArray(files)) return;
            const f = files.find((x) => (x.path || '') === path);
            if (!f) return;

            if (payload?.target === 'def-json') {
                // BPMN 파일의 JSON(process-definition) 편집 → json 갱신 + XML/다이어그램 재파생 + 숨긴 원본 동기화.
                const json = (payload.json ?? '').toString();
                f.json = json;
                try {
                    let def = JSON.parse(json);
                    if (def && def.processDefinition) def = def.processDefinition;
                    const xml = this._buildBpmnXmlFromDefinition(def);
                    if (xml) f.content = xml; // 다이어그램/XML 자동 갱신
                } catch (e) {
                    /* 편집 중 파싱 실패 — 무시 */
                }
                // 저장에 쓰이는 실제 process-definition.json 항목도 동기화.
                const pdPath = (f.jsonPath || '').toString();
                const pdEntry = pdPath ? files.find((x) => (x.path || '') === pdPath) : null;
                if (pdEntry) pdEntry.content = json;
            } else {
                const content = (payload?.content ?? '').toString();
                f.content = content; // 편집 내용 반영
                // process-definition.json 을 직접 고쳤으면 같은 그룹 .bpmn 재파생.
                if (/process-definition\.json$/.test(path.replace(/\\/g, '/'))) {
                    try {
                        const def = JSON.parse(content);
                        const xml = this._buildBpmnXmlFromDefinition(def.processDefinition || def);
                        if (xml) {
                            const bpmnEntry = files.find((x) => (x.jsonPath || '') === path || (x.ext || '') === '.bpmn');
                            if (bpmnEntry) {
                                bpmnEntry.content = xml;
                                bpmnEntry.json = content;
                            }
                        }
                    } catch (e) {
                        /* 무시 */
                    }
                }
            }
            if (panel?.data?.saveState) panel.data.saveState.saved = false;
        },

        /**
         * 생성 완료 후(사용자에게 제시되기 전) 산출물 프로세스를 **임시저장(draft)** 하고
         * completion 실행엔진으로 검증 + LLM 자동개선한 뒤, 개선된 정의를 우측 패널에 반영한다.
         * - deepagent 는 DB write 하지 않는다. draft 저장/검증호출은 프론트(사용자 권한)가 한다.
         * - is_draft=true 라 프로세스 목록/맵에는 안 보이며, 최종 저장 버튼 클릭 시에만 승격된다.
         * - 방 단위(roomId) 재생성 시 이전 draft 는 삭제(option A). best-effort — 실패해도 흐름 유지.
         */
        async runDraftValidationForRoom() {
            const groups = Object.keys(this.roomWorkspaceFilesByGroup || {});
            if (!groups.length) return;
            let elementsToFlattenedDefinition;
            try {
                ({ elementsToFlattenedDefinition } = await import('@/utils/elementsToFlattened.js'));
            } catch (e) {
                return;
            }
            const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';
            // 이전 방 draft 정리(option A): 이번에 만들 draft id 집합을 모은 뒤, 추적된 옛 id 중 빠진 것 삭제.
            const prevDraftIds = Array.isArray(this._roomDraftIds) ? this._roomDraftIds.slice() : [];
            const newDraftIds = [];

            for (const group of groups) {
                const files = this.roomWorkspaceFilesByGroup[group] || [];
                const pdFile = files.find(
                    (f) => (f.name || '').toLowerCase() === 'process-definition.json' || (f.path || '').endsWith('process-definition.json')
                );
                if (!pdFile || !pdFile.content) {
                    // 단독 스킬 그룹(프로세스 없음): 스킬만 draft 업로드해 /skills/{name} 편집기에서 로드되게 한다.
                    const hasSkill = files.some((f) => /\/skills\/[^/]+\/SKILL\.md$/i.test((f.path || '').replace(/\\/g, '/')));
                    if (hasSkill) {
                        try {
                            await this._uploadSkillsFromFiles(files, { draft: true });
                        } catch (e) {
                            console.warn('[DraftValidate] 단독 스킬 draft 업로드 실패(무시):', e);
                        }
                    }
                    continue;
                }
                const st = this.workspaceSaveStateByGroup[group] || (this.workspaceSaveStateByGroup[group] = { saving: false, saved: false, error: '' });
                if (st.__validated || st.validating) continue;

                let pd;
                try {
                    pd = JSON.parse(pdFile.content);
                } catch (e) {
                    continue;
                }
                if (pd && pd.processDefinition) pd = pd.processDefinition;
                const definition = Array.isArray(pd.elements) ? elementsToFlattenedDefinition(pd) : pd;
                const procName = (definition.processDefinitionName || pd.processDefinitionName || '새 프로세스').toString();
                // processDefinitionId 가 비어도 draft 저장/검증을 건너뛰지 않도록 이름에서 결정적 uuid 를 파생한다
                // (편집기 이동·검증이 동일 id 를 쓰게 됨). 빈 id 로 skip → 편집기 빈화면/검증 미수행의 주요 원인 제거.
                let procId = (definition.processDefinitionId || pd.processDefinitionId || '').toString().trim();
                if (!procId) {
                    procId = slugToUuid(`${(this.currentChatRoom?.id || this.roomId || 'room')}:${group}:${procName}`);
                    definition.processDefinitionId = procId;
                }
                const bpmnFile = files.find((f) => (f.ext || '').toLowerCase() === '.bpmn');
                const bpmnXml = (bpmnFile && bpmnFile.content) || this._buildBpmnXmlFromDefinition(definition) || null;

                // 검증용 폼 정보(activity_id → {form_id, html}) — 실행 테스트 입력값 생성에 사용.
                const forms = {};
                for (const f of files) {
                    const p = (f.path || '').replace(/\\/g, '/');
                    const m = p.match(/\/forms\/([^/]+)\.(?:html|form)$/i);
                    if (!m) continue;
                    const aid = m[1];
                    forms[aid] = { form_id: `${procId}_${aid.toLowerCase()}_form`, html: (f.content || '').toString() };
                }

                st.validating = true;
                st.validateMsg = '실행 엔진으로 검증 중...';
                this.$forceUpdate && this.$forceUpdate();
                try {
                    // 1) draft proc_def 저장 (is_draft=true) + draft form_def
                    await backend.putRawDefinition(bpmnXml, procId, {
                        name: procName,
                        definition,
                        type: 'bpmn',
                        is_draft: true
                    });
                    newDraftIds.push(procId);
                    for (const aid of Object.keys(forms)) {
                        try {
                            await backend.putRawDefinition(forms[aid].html, forms[aid].form_id, {
                                type: 'form',
                                proc_def_id: procId,
                                activity_id: aid
                            });
                        } catch (fe) {
                            /* 폼 저장 실패는 검증을 막지 않는다 */
                        }
                    }

                    // 1-b) draft 에이전트 저장 (users is_draft=true). id 를 uuid 로 확정하고 해당 파일을 갱신해
                    //      산출물 '편집' 이동·최종 저장 승격이 같은 id 를 쓰게 한다.
                    //      에이전트별 개별 파일 agents/<id>.json(단일 객체) + 레거시 agents.json(배열) 모두 처리.
                    try {
                        if (backend.putAgent) {
                            const saveDraftAgent = async (a) => {
                                try {
                                    await backend.putAgent({
                                        id: a.id,
                                        name: a.name || a.username || '에이전트',
                                        email: a.email || `agent+${a.id}@uengine.org`,
                                        role: a.role || '',
                                        goal: a.goal || a.description || '',
                                        persona: a.persona || '',
                                        description: a.description || '',
                                        model: a.model || '',
                                        isAgent: true,
                                        type: a.type || 'TaskAgent',
                                        is_draft: true
                                    });
                                } catch (ae) {
                                    /* draft 에이전트 저장 실패는 흐름을 막지 않는다 */
                                }
                            };
                            // (1) 개별 파일 agents/<id>.json — 파일 1개 = 에이전트 1명.
                            //     id 는 agentStableId(슬러그→결정적 uuid)로 확정 — 편집기(editTarget)와 동일하므로
                            //     파일을 변형/영속화하지 않아도 reload 후 /agent-chat/{id} 가 같은 에이전트를 로드한다.
                            const perAgentFiles = files.filter((f) => /\/agents\/[^/]+\.json$/i.test((f.path || '').replace(/\\/g, '/')));
                            for (const af of perAgentFiles) {
                                let obj;
                                try {
                                    obj = JSON.parse(af.content);
                                } catch (e) {
                                    obj = null;
                                }
                                if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
                                await saveDraftAgent({ ...obj, id: agentStableId(obj, af.path) });
                            }
                            // (2) 레거시 agents.json(배열/딕셔너리).
                            const agFile = files.find((f) => (f.name || '').toLowerCase() === 'agents.json' || (f.path || '').endsWith('agents.json'));
                            if (agFile) {
                                let parsed;
                                try {
                                    parsed = JSON.parse(agFile.content);
                                } catch (e) {
                                    parsed = null;
                                }
                                const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.agents) ? parsed.agents : [];
                                for (const a of arr) {
                                    if (!a || typeof a !== 'object') continue;
                                    await saveDraftAgent({ ...a, id: isUuidStable(a.id) ? a.id : agentStableId(a, agFile.path) });
                                }
                            }
                        }
                    } catch (age) {
                        console.warn('[DraftValidate] draft 에이전트 저장 실패(무시):', age);
                    }

                    // 1-c) draft 스킬 저장 — 파일을 스킬 서비스에 업로드(=/skills/{name} 편집기에서 내용 로드).
                    //      목록 등록(tenants.skills)은 생략(draft) → 최종 저장 시 승격.
                    try {
                        await this._uploadSkillsFromFiles(files, { draft: true });
                    } catch (ske) {
                        console.warn('[DraftValidate] draft 스킬 업로드 실패(무시):', ske);
                    }

                    // 2) 실엔진 검증 + LLM 자동개선 (completion 이 draft.definition 을 갱신)
                    let report = null;
                    try {
                        report = await backend.validateAndImproveDraft(procId, {
                            processName: procName,
                            forms,
                            // 검증 인스턴스를 현재 사용자에게 귀속 → 완료 인스턴스 목록에서 확인 가능.
                            email: this.userInfo?.email,
                            userUid: this.userInfo?.uid || this.userInfo?.id
                        });
                    } catch (ve) {
                        console.warn('[DraftValidate] /validate-and-improve 실패(검증 생략):', ve);
                    }

                    // 3) 개선된 정의를 우측 패널(process-definition.json + .bpmn)에 반영
                    const improved = report && report.final_definition && typeof report.final_definition === 'object' ? report.final_definition : null;
                    if (improved && (Array.isArray(improved.activities) || Array.isArray(improved.elements))) {
                        const newContent = JSON.stringify(improved, null, 2);
                        pdFile.content = newContent;
                        // upsert 가 process-definition.json → .bpmn 재파생까지 처리.
                        this.upsertWorkspaceFilesPanel({ ...pdFile, content: newContent });
                    }
                    if (report) {
                        st.validatePassed = report.passed === true;
                        st.validateReport = {
                            passed: report.passed,
                            iterations: report.iterations,
                            repaired: report.repaired,
                            remaining: Array.isArray(report.remaining_defects) ? report.remaining_defects.length : 0
                        };
                    }
                    st.__validated = true;
                    // draft id 추적(방 단위) — 새로고침/재진입에도 정리 가능하게 룸에 저장.
                    this._roomDraftIds = newDraftIds.slice();
                    try {
                        if (this.currentChatRoom) {
                            this.currentChatRoom.draftProcDefIds = newDraftIds.slice();
                        }
                    } catch (re) {
                        /* ignore */
                    }
                } catch (e) {
                    // 실패를 침묵시키지 않고 패널에 노출(테스트 시 원인 확인 가능).
                    console.warn('[DraftValidate] 실패:', e);
                    st.error = `임시저장/검증 실패: ${(e && (e.message || e.detail)) || e}`;
                } finally {
                    st.validating = false;
                    st.validateMsg = '';
                    this.$forceUpdate && this.$forceUpdate();
                }
            }

            // 이전 방 draft 중 이번에 재사용되지 않은 것 삭제 (option A)
            const stale = prevDraftIds.filter((id) => id && !newDraftIds.includes(id));
            for (const id of stale) {
                try {
                    await backend.deleteDraftProcDef(id);
                } catch (de) {
                    /* ignore */
                }
            }
        },

        /**
         * deepagent 산출물 파일(우측 파일 UI)을 DB 에 저장한다.
         * - process-definition.json → proc_def (이미 flattened 면 그대로, elements[] 면 변환)
         * - forms/<activity_id>.html → form_def (activity.tool=formHandler:<procId>_<id>_form 와 동일 form_id)
         */
        async handleSaveWorkspaceFiles(files) {
            const list = Array.isArray(files) && files.length ? files : [];
            // 프로세스(탭)별 저장 — 이 탭의 파일들만 해당 프로세스로 저장한다.
            const group = this._processGroupKey((list[0] && list[0].path) || '');
            if (!this.workspaceSaveStateByGroup[group]) {
                this.workspaceSaveStateByGroup[group] = { saving: false, saved: false, error: '' };
            }
            const st = this.workspaceSaveStateByGroup[group];
            if (st.saving || st.saved) return;
            const pdFile = list.find(
                (f) => (f.name || '').toLowerCase() === 'process-definition.json' || (f.path || '').endsWith('process-definition.json')
            );
            if (!pdFile) {
                // 단독 스킬 산출물(프로세스 없음): SKILL.md 만 있으면 스킬만 저장(정식 등록/승격).
                const hasSkill = list.some((f) => /\/skills\/[^/]+\/SKILL\.md$/i.test((f.path || '').replace(/\\/g, '/')) || (f.name || '').toLowerCase() === 'skill.md');
                if (hasSkill) {
                    st.saving = true;
                    st.error = '';
                    try {
                        const saved = await this._uploadSkillsFromFiles(list, { draft: false });
                        st.saved = true;
                        st.saving = false;
                        this.$forceUpdate && this.$forceUpdate();
                        return;
                    } catch (e) {
                        st.saving = false;
                        st.error = `스킬 저장 실패: ${(e && (e.message || e.detail)) || e}`;
                        return;
                    }
                }
                st.error = 'process-definition.json 이 없습니다.';
                return;
            }
            st.saving = true;
            st.error = '';
            try {
                const { elementsToFlattenedDefinition } = await import('@/utils/elementsToFlattened.js');
                let pd;
                try {
                    pd = JSON.parse(pdFile.content);
                } catch (e) {
                    throw new Error('process-definition.json 파싱 실패');
                }
                if (pd && pd.processDefinition) pd = pd.processDefinition;
                // elements[] 형식이면 flatten, 이미 flattened(activities[]) 면 그대로 저장.
                const definition = Array.isArray(pd.elements) ? elementsToFlattenedDefinition(pd) : pd;
                const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';
                const procId = (definition.processDefinitionId || pd.processDefinitionId || '').toString().trim();
                const procName = (definition.processDefinitionName || pd.processDefinitionName || procId || '새 프로세스').toString();
                if (!procId) throw new Error('processDefinitionId 가 없습니다.');

                // .bpmn 파생 파일(createBpmnXml 결과)이 있으면 proc_def.bpmn 에 함께 저장.
                const bpmnFile = list.find((f) => (f.ext || '').toLowerCase() === '.bpmn' || (f.name || '').toLowerCase().endsWith('.bpmn'));
                const bpmnXml = bpmnFile && bpmnFile.content ? bpmnFile.content : this._buildBpmnXmlFromDefinition(definition) || null;

                // 1) proc_def 저장 — 최종 저장(사용자 클릭)이므로 draft 를 승격(is_draft=false)해 목록에 노출.
                await backend.putObject(
                    'proc_def',
                    { id: procId, name: procName, definition, bpmn: bpmnXml, type: 'bpmn', isdeleted: false, is_draft: false, tenant_id: tenantId },
                    { onConflict: 'id,tenant_id' }
                );

                // 파일명(camelCase 등) → activity id 와 동일 규칙(snake)으로 정규화(매핑 일관성)
                const toSnake = (s) =>
                    String(s || '')
                        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                        .replace(/[^a-zA-Z0-9]+/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '')
                        .toLowerCase() || 'node';

                // 2) form_def 저장 (forms/<id>.html → form_def, form_id 는 activity.tool 과 동일 규칙)
                let formsSaved = 0;
                for (const f of list) {
                    const p = (f.path || '').replace(/\\/g, '/');
                    const lname = (f.name || '').toLowerCase();
                    const isForm = /\/forms\//.test(p) && (f.ext === '.html' || f.ext === '.form' || lname.endsWith('.html') || lname.endsWith('.form'));
                    if (!isForm) continue;
                    const activityId = toSnake((f.name || '').replace(/\.(?:html|form)$/i, ''));
                    const html = (f.content || '').toString();
                    if (!activityId || !html) continue;
                    const formId = `${procId}_${activityId}_form`;
                    try {
                        await backend.putRawDefinition(html, formId, { type: 'form', proc_def_id: procId, activity_id: activityId });
                        formsSaved += 1;
                    } catch (formErr) {
                        console.warn('[SaveWS] form 저장 실패:', activityId, formErr);
                    }
                }

                // 3) 스킬 저장(최종) — 파일 업로드 + tenants.skills 목록 승격(draft 해제). 공용 헬퍼 사용.
                const savedSkillNames = await this._uploadSkillsFromFiles(list, { draft: false });

                // 4) 에이전트 저장 (users 테이블, is_agent=true, is_draft=false 승격)
                //    개별 파일 agents/<id>.json(단일 객체) + 레거시 agents.json(배열) 모두 처리.
                const savedAgents = [];
                if (backend.putAgent) {
                    const saveFinalAgent = async (a, filePath) => {
                        if (!a || typeof a !== 'object') return;
                        // draft 저장·편집기(editTarget)와 동일한 결정적 id(슬러그→uuid)로 승격해야
                        // 같은 에이전트가 정식 등록된다(랜덤 uuid 금지).
                        const agentId = isUuidStable(a.id) ? a.id.toString() : agentStableId(a, filePath);
                        try {
                            await backend.putAgent({
                                id: agentId,
                                name: a.name || a.username || '에이전트',
                                email: a.email || `agent+${agentId}@uengine.org`,
                                role: a.role || '',
                                goal: a.goal || a.description || '',
                                persona: a.persona || '',
                                description: a.description || '',
                                model: a.model || '',
                                isAgent: true,
                                type: a.type || 'TaskAgent',
                                is_draft: false // 최종 저장 — draft 였으면 정식 등록으로 승격(목록 노출).
                            });
                            savedAgents.push({ id: agentId, name: a.name || '에이전트', role: a.role || '' });
                        } catch (agErr) {
                            console.warn('[SaveWS] 에이전트 저장 실패:', a.name, agErr);
                        }
                    };
                    // (1) 개별 파일
                    const perAgentFiles = list.filter((f) => /\/agents\/[^/]+\.json$/i.test((f.path || '').replace(/\\/g, '/')));
                    for (const af of perAgentFiles) {
                        let obj;
                        try {
                            obj = JSON.parse(af.content);
                        } catch (e) {
                            obj = null;
                        }
                        if (obj && typeof obj === 'object' && !Array.isArray(obj)) await saveFinalAgent(obj, af.path);
                    }
                    // (2) 레거시 agents.json
                    const agFile = list.find((f) => (f.name || '').toLowerCase() === 'agents.json');
                    if (agFile) {
                        let arr = [];
                        try {
                            const parsed = JSON.parse(agFile.content);
                            arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.agents) ? parsed.agents : [];
                        } catch (e) {
                            arr = [];
                        }
                        for (const a of arr) await saveFinalAgent(a, agFile.path);
                    }
                }

                // 5) proc_map(미분류) 등록 — best-effort
                try {
                    await this._upsertProcMapEntry(procId, procName, tenantId);
                } catch (pmErr) {
                    console.warn('[SaveWS] proc_map 등록 실패(무시):', pmErr);
                }

                st.saved = true;
                st.saving = false;

                // 6) 저장된 정보로 기존 pdf2bpmn 결과 UI(생성된 프로세스/스킬/에이전트) 메시지를 채팅에 추가 → 확인 가능.
                try {
                    const resultUuid = this.uuid();
                    const roomId = (this.currentChatRoom?.id || this.roomId || '').toString();
                    const resultMsg = {
                        // Process GPT Agent 정체성(이름/아바타) 부여 — 빈 유저로 표시되지 않게.
                        ...this.createMessageObj('✅ 저장이 완료되었습니다. 생성된 프로세스·스킬·에이전트를 확인하세요.', 'agent'),
                        uuid: resultUuid,
                        pdf2bpmnResult: {
                            savedProcesses: [{ process_id: procId, process_name: procName, bpmn_xml: bpmnXml || '', definition }],
                            savedSkills: savedSkillNames.map((n) => ({ name: n })),
                            savedAgents,
                            __saved: true,
                            __saving: false
                        }
                    };
                    this.messages.push(resultMsg);
                    this.$nextTick(() => this.scrollToBottomSafe && this.scrollToBottomSafe());
                    if (roomId) {
                        await backend.putObject(`db://chats/${resultUuid}`, { uuid: resultUuid, id: roomId, messages: resultMsg });
                    }
                } catch (msgErr) {
                    console.warn('[SaveWS] 결과 메시지 추가 실패(무시):', msgErr);
                }

                if (this.$toast && this.$toast.success)
                    this.$toast.success(`저장되었습니다(폼 ${formsSaved}개, 스킬 ${savedSkillNames.length}개, 에이전트 ${savedAgents.length}개).`);
            } catch (e) {
                st.saving = false;
                st.error = (e && (e.message || e.toString())) || '저장 실패';
                console.error('[SaveWS] 저장 실패:', e);
            }
        },

        extractHwpxHtmlUrl(payload) {
            if (!payload || typeof payload !== 'object') return '';
            return payload.html_url || payload.htmlUrl || payload.hwpx_html_url || payload.hwpxHtmlUrl || '';
        },

        extractHwpxHtmlUrlFromText(text) {
            const raw = (text || '').toString();
            if (!raw) return '';
            const matches = raw.match(/https?:\/\/[^\s)]+\.html/gi) || [];
            if (matches.length === 0) return '';
            const filled = matches.find((url) => url.includes('filled-'));
            return filled || '';
        },

        extractHwpxFileUrlFromText(text) {
            const raw = (text || '').toString();
            if (!raw) return '';
            const matches = raw.match(/https?:\/\/[^\s)]+\.hwpx/gi) || [];
            return matches[0] || '';
        },

        /**
         * 텍스트 메시지에 raw hwpx/html 마크다운 링크가 있는 경우:
         * - 링크 줄 제거 (정제된 텍스트 반환)
         * - message.pdfFile 세팅 (hwpx 파일 카드)
         * - safeFinal 업데이트용으로 정제 문자열 반환
         */
        cleanupHwpxMessageContent(idx) {
            const msg = this.messages[idx];
            if (!msg) return null;
            const content = (msg.content || '').toString();
            const hwpxFileUrl = this.extractHwpxFileUrlFromText(content);
            // 리스트 마커(- / *) 포함 줄 전체 제거 → 마커만 남는 현상 방지
            // .hwpx: 무조건 제거 / filled-*.html: 미리보기 전용이므로 제거
            const cleaned = content
                // 리스트 항목 전체 줄 (- [text](url) 또는 * [text](url))
                .replace(/^[ \t]*[-*][ \t]*\[.+?\]\(https?:\/\/[^\s)]+\.hwpx[^\s)]*\)[ \t]*$/gim, '')
                .replace(/^[ \t]*[-*][ \t]*\[.+?\]\(https?:\/\/[^\s)]*filled-[^\s)]+\.html[^\s)]*\)[ \t]*$/gim, '')
                // 리스트 항목 전체 줄 (베어 URL)
                .replace(/^[ \t]*[-*][ \t]*https?:\/\/\S+\.hwpx[ \t]*$/gim, '')
                .replace(/^[ \t]*[-*][ \t]*https?:\/\/\S*filled-\S+\.html[ \t]*$/gim, '')
                // 인라인 마크다운 링크 (리스트 아닌 경우)
                .replace(/\[.+?\]\(https?:\/\/[^\s)]+\.hwpx[^\s)]*\)/gi, '')
                .replace(/\[.+?\]\(https?:\/\/[^\s)]*filled-[^\s)]+\.html[^\s)]*\)/gi, '')
                // 베어 URL (인라인)
                .replace(/https?:\/\/\S+\.hwpx/gi, '')
                .replace(/https?:\/\/\S*filled-\S+\.html/gi, '')
                // 빈 줄 3개 이상 → 2개로 정리
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            if (hwpxFileUrl && !msg.pdfFile) {
                const fileName = decodeURIComponent(hwpxFileUrl.split('/').pop() || 'document.hwpx');
                msg.pdfFile = {
                    url: hwpxFileUrl,
                    fileUrl: hwpxFileUrl,
                    name: fileName,
                    fileName: fileName,
                    contentType: 'application/vnd.hancom.hwpx'
                };
            }
            return cleaned;
        },

        /**
         * DB에서 불러온 메시지 중 hwpx 관련 raw 링크가 남아있는 경우 일괄 정리.
         * - content에 raw 마크다운 hwpx/html 링크 → 제거
         * - hwpxFileUrl이 있는데 pdfFile이 없는 경우 → pdfFile 세팅
         * DB를 건드리지 않고 in-memory 메시지만 수정 (표시용).
         */
        processLoadedHwpxMessages() {
            if (!Array.isArray(this.messages)) return;
            for (let i = 0; i < this.messages.length; i++) {
                const msg = this.messages[i];
                if (!msg || msg.role === 'user') continue;
                const content = (msg.content || '').toString();

                // ① 이미 hwpxFileUrl이 확인된 메시지: pdfFile 세팅
                if (msg.hwpxFileUrl && !msg.pdfFile) {
                    const fileName = decodeURIComponent(msg.hwpxFileUrl.split('/').pop() || 'document.hwpx');
                    msg.pdfFile = {
                        url: msg.hwpxFileUrl,
                        fileUrl: msg.hwpxFileUrl,
                        name: fileName,
                        fileName,
                        contentType: 'application/vnd.hancom.hwpx'
                    };
                }

                // ② content 클린업은 hwpx 전용 URL이 있는 경우만 실행
                // 조건: msg.hwpxHtmlUrl이 세팅되어 있거나(스트리밍 시 이미 확인된 경우)
                //       OR content에 .hwpx URL이 있거나
                //       OR content에 filled- 포함 .html URL이 있는 경우
                const isHwpxMessage =
                    !!msg.hwpxHtmlUrl || /https?:\/\/\S+\.hwpx/i.test(content) || /https?:\/\/\S*filled-\S+\.html/i.test(content);
                if (!isHwpxMessage) continue;

                const cleaned = this.cleanupHwpxMessageContent(i);
                if (cleaned !== null && cleaned !== content) {
                    msg.content = cleaned;
                }
            }
        },

        pushHwpxArtifact(parsed, msgIdxOrRef) {
            const url = this.extractHwpxHtmlUrl(parsed);
            if (!url) return;
            const name = (parsed?.html_name || parsed?.htmlName || parsed?.file_name || parsed?.fileName || '').toString();
            const isFilled = name.startsWith('filled-') || url.includes('filled-');
            if (!isFilled) return;
            const msg = typeof msgIdxOrRef === 'number' ? this.messages?.[msgIdxOrRef] : msgIdxOrRef;
            const fileUrl = parsed?.file_url || parsed?.fileUrl || msg?.hwpxFileUrl || '';
            if (msg) {
                msg.hwpxHtmlUrl = url;
                msg.hwpxFileUrl = fileUrl;
                msg.hwpxHtmlName = name;
            }
            this.pushArtifactPanel({
                type: 'hwpx',
                label: name || 'document.hwpx',
                data: { htmlUrl: url, fileUrl, messageId: msg?.uuid || null }
            });
        },

        pushDocxArtifact(parsed, msgIdxOrRef) {
            const url = this.extractHwpxHtmlUrl(parsed);
            if (!url) return;
            const name = (parsed?.html_name || parsed?.htmlName || parsed?.file_name || parsed?.fileName || '').toString();
            const msg = typeof msgIdxOrRef === 'number' ? this.messages?.[msgIdxOrRef] : msgIdxOrRef;
            const fileUrl = parsed?.file_url || parsed?.fileUrl || '';
            this.pushArtifactPanel({
                type: 'docx',
                label: name || 'document.docx',
                data: { htmlUrl: url, fileUrl, messageId: msg?.uuid || null }
            });
        },

        /** slide_markdown이 있는 JSON인지 판별 */
        isSlidePayload(parsed) {
            return !!(parsed && typeof parsed === 'object' && parsed.slide_markdown);
        },

        /** generate_slides 결과를 슬라이드 아티팩트 패널로 등록 */
        pushSlideArtifact(parsed, msgIdxOrRef) {
            const md = parsed?.slide_markdown;
            if (!md) return;
            const msg = typeof msgIdxOrRef === 'number' ? this.messages?.[msgIdxOrRef] : msgIdxOrRef;
            const title = parsed?.deck_title || '슬라이드';
            const imageUrls = parsed?.image_urls || [];
            if (msg) {
                msg.slideMarkdown = md;
                msg.slideImageUrls = imageUrls;
            }
            this.pushArtifactPanel({
                type: 'slide',
                label: title,
                data: { slideMarkdown: md, imageUrls, reportId: parsed?.report_id || '', messageId: msg?.uuid || null }
            });
        },

        isDocxPayload(parsed) {
            if (!parsed || typeof parsed !== 'object') return false;
            const ct = (parsed.content_type || parsed.contentType || '').toString();
            const fn = (parsed.file_name || parsed.fileName || '').toString();
            return ct.includes('wordprocessingml') || fn.toLowerCase().endsWith('.docx');
        },

        startArtifactSidebarResize(event) {
            if (this.artifactSidebarResizing) return;
            this.artifactSidebarResizing = true;
            this.artifactSidebarResizeStartX = event.clientX;
            this.artifactSidebarResizeStartWidth = this.artifactSidebarWidth || 420;
            window.addEventListener('mousemove', this.onArtifactSidebarResizeMove);
            window.addEventListener('mouseup', this.stopArtifactSidebarResize);
        },

        onArtifactSidebarResizeMove(event) {
            if (!this.artifactSidebarResizing) return;
            const delta = this.artifactSidebarResizeStartX - event.clientX;
            const nextWidth = this.artifactSidebarResizeStartWidth + delta;
            const minWidth = 320;
            const maxWidth = 960;
            this.artifactSidebarWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth));
        },

        stopArtifactSidebarResize() {
            if (!this.artifactSidebarResizing) return;
            this.artifactSidebarResizing = false;
            window.removeEventListener('mousemove', this.onArtifactSidebarResizeMove);
            window.removeEventListener('mouseup', this.stopArtifactSidebarResize);
        },

        applyHwpxViewerFromToolCalls(toolCalls, msgIdxOrRef) {
            if (!Array.isArray(toolCalls) || toolCalls.length === 0) return;
            for (let i = toolCalls.length - 1; i >= 0; i--) {
                const outputStr = toolCalls[i]?.output;
                if (!outputStr) continue;
                const parsed = this.parseToolOutput(outputStr);
                // 슬라이드 아티팩트 감지
                if (this.isSlidePayload(parsed)) {
                    this.pushSlideArtifact(parsed, msgIdxOrRef);
                    return;
                }
                const url = this.extractHwpxHtmlUrl(parsed);
                if (url) {
                    if (this.isDocxPayload(parsed)) {
                        this.pushDocxArtifact(parsed, msgIdxOrRef);
                    } else {
                        this.pushHwpxArtifact(parsed, msgIdxOrRef);
                    }
                    return;
                }
                const textUrl = this.extractHwpxHtmlUrlFromText(outputStr);
                if (textUrl) {
                    this.pushHwpxArtifact({ html_url: textUrl }, msgIdxOrRef);
                    return;
                }
            }
        },

        checkExistingArtifactPanels() {
            // deepagent 산출물 파일 복원 — 방 내 모든 메시지의 workspaceFiles 를 by-path 병합 후,
            // 프로세스 폴더(process-<uuid>)별로 그룹핑해 프로세스마다 탭으로 복원한다.
            const mergedByPath = {};
            for (const m of this.messages || []) {
                if (m && Array.isArray(m.workspaceFiles)) {
                    for (const f of m.workspaceFiles) {
                        if (f && f.path) mergedByPath[f.path] = f; // 뒤(최신) 우선
                    }
                }
            }
            const mergedFiles = Object.values(mergedByPath);
            if (mergedFiles.length > 0) {
                this.roomWorkspaceFilesByGroup = {};
                // entry 단위로 upsert → 그룹별 패널 자동 생성(프로세스마다 탭)
                for (const f of mergedFiles) this.upsertWorkspaceFilesPanel(f);
                return;
            }
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if (!msg) continue;
                // BPMN 프로세스 산출물 복원 — 영속된 출력계약(pdf2bpmnResult.__contract)에서 process 패널 재생성.
                // (onProcessResult 와 동일 형태로 push → 새로고침/재진입 후에도 우측 탭에서 다시 열어볼 수 있다.)
                const procPanel = buildProcessPanelFromMessage(msg);
                if (procPanel) {
                    const procResult = msg.pdf2bpmnResult;
                    this.pushArtifactPanel(procPanel);
                    // 같은 id 의 proc_def 가 이미 저장돼 있으면 '저장됨' 으로 표시(영속된 __saved 가 stale 일 수 있어 재확인).
                    const procId = processIdFromResult(procResult);
                    if (procId && !procResult.__saved) {
                        backend
                            .getRawDefinition(procId)
                            .then((def) => {
                                if (def && (def.definition || def.id)) procResult.__saved = true;
                            })
                            .catch(() => {});
                    }
                    return;
                }
                // 슬라이드 아티팩트 복원
                if (msg?.slideMarkdown) {
                    this.pushArtifactPanel({
                        type: 'slide',
                        label: '슬라이드',
                        data: { slideMarkdown: msg.slideMarkdown, imageUrls: msg.slideImageUrls || [], messageId: msg?.uuid || null }
                    });
                    return;
                }
                if (msg?.hwpxHtmlUrl) {
                    this.pushArtifactPanel({
                        type: 'hwpx',
                        label: msg.hwpxHtmlName || 'document.hwpx',
                        data: { htmlUrl: msg.hwpxHtmlUrl, fileUrl: msg.hwpxFileUrl || '', messageId: msg?.uuid || null }
                    });
                    return;
                }
                const urlFromText = this.extractHwpxHtmlUrlFromText(msg?.content);
                if (urlFromText) {
                    this.pushHwpxArtifact({ html_url: urlFromText }, i);
                    return;
                }
                const toolCalls = Array.isArray(msg?.toolCalls) ? msg.toolCalls : [];
                if (toolCalls.length === 0) continue;
                this.applyHwpxViewerFromToolCalls(toolCalls, i);
                if (this.hasArtifactPanel) return;
            }
        },

        parseHwpxPageInstruction(text) {
            const raw = (text || '').toString().trim();
            if (!raw) return null;
            const match = raw.match(/(\d+)\s*페이지\s*(?:에|에서)?\s*(.*)/);
            if (!match) return null;
            const pageNumber = Number(match[1]);
            const instruction = (match[2] || '').trim() || raw;
            if (!pageNumber) return null;
            return { pageNumber, instruction };
        },

        async requestHwpxPageEdit({ hwpxUrl, pageNumber, instruction }) {
            const baseUrl = this.resolveHwpxMcpUrl();
            const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'edit_hwpx_page_html',
                    arguments: {
                        hwpx_url: hwpxUrl,
                        page_number: pageNumber,
                        instruction
                    }
                }
            };
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`HWPX MCP error: ${response.status}`);
            }
            const data = await response.json();
            return this.parseMcpToolResult(data);
        },

        async handleHwpxSectionEdit(panelId, payload) {
            const pageNumber = Number(payload?.pageNumber || 0);
            const instruction = (payload?.instruction || '').toString().trim();
            const contextText = (payload?.contextText || '').toString().trim();
            if (!pageNumber || !instruction) return;
            const panel = this.artifactPanels.find((p) => p.id === panelId);
            const hwpxFileUrl = panel?.data?.fileUrl || '';
            const callMethod = (method, ...args) => this.$refs.artifactPanel?.callPanelMethod?.(panelId, method, ...args);
            if (!hwpxFileUrl) {
                callMethod('showEditNotice', 'HWPX 파일 정보가 없어 수정할 수 없습니다.', 'error');
                return;
            }
            const finalInstruction = contextText ? `${instruction}\n\n선택 영역: ${contextText}` : instruction;
            try {
                const output = await this.requestHwpxPageEdit({
                    hwpxUrl: hwpxFileUrl,
                    pageNumber,
                    instruction: finalInstruction
                });
                const edits = Array.isArray(output?.edits) ? output.edits : [];
                const editedHtml = output?.edited_page_html || output?.editedPageHtml || '';
                const applied = edits.length
                    ? callMethod('applyPageEdits', Number(pageNumber), edits)
                    : callMethod('applyPageEdit', Number(pageNumber), editedHtml);
                if (applied) {
                    if (edits.length) {
                        const ids = edits.map((e) => e?.id).filter(Boolean);
                        callMethod('highlightEdits', ids, Number(pageNumber));
                    }
                    callMethod('showEditNotice', `${pageNumber}페이지 수정 완료`, 'success');
                } else {
                    callMethod('showEditNotice', '페이지 수정에 실패했습니다.', 'error');
                }
            } catch (e) {
                callMethod('showEditNotice', '페이지 수정 중 오류가 발생했습니다.', 'error');
            }
        },

        appendAssistantNotice(text) {
            const nowIso = new Date().toISOString();
            this.messages.push({
                uuid: this.uuid(),
                role: 'assistant',
                content: text,
                contentType: 'text',
                isLoading: false,
                timeStamp: nowIso,
                email: this.contextAgent?.email || 'agent:system',
                name: this.contextAgent?.username || 'assistant',
                userName: this.contextAgent?.username || 'assistant'
            });
            this.$nextTick(() => this.scrollToBottomSafe());
        },

        async handleHwpxDownload(panelId, payload) {
            if (this.artifactDownloadLoading) return;
            const html = payload?.html || '';
            if (!html) return;
            const panel = this.artifactPanels.find((p) => p.id === panelId);
            const hwpxUrl = panel?.data?.fileUrl || this.findLatestHwpxFileUrl();
            if (!hwpxUrl) return;

            this.artifactDownloadLoading = true;
            try {
                const result = await this.requestHwpxSave({ hwpxUrl, html });
                const fileUrl = result?.file_url || result?.fileUrl || '';
                const fileName = result?.file_name || result?.fileName || 'output.hwpx';
                if (fileUrl) {
                    this.triggerFileDownload(fileUrl, fileName);
                }
            } catch (e) {
                console.warn('[ChatRoomPage] HWPX 다운로드 실패:', e);
            } finally {
                this.artifactDownloadLoading = false;
            }
        },

        findLatestHwpxFileUrl() {
            for (let i = this.artifactPanels.length - 1; i >= 0; i--) {
                const url = this.artifactPanels[i]?.data?.fileUrl || '';
                if (url) return url;
            }
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const url = this.messages[i]?.hwpxFileUrl || '';
                if (url) return url;
            }
            return '';
        },

        async requestHwpxSave({ hwpxUrl, html }) {
            const baseUrl = this.resolveHwpxMcpUrl();
            const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'save_hwpx_from_html',
                    arguments: {
                        hwpx_url: hwpxUrl,
                        edited_html: html
                    }
                }
            };

            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HWPX MCP error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseMcpToolResult(data);
        },

        async requestDocxPageEdit({ docxUrl, pageNumber, instruction }) {
            const baseUrl = this.resolveHwpxMcpUrl();
            const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'edit_docx_page_html',
                    arguments: {
                        docx_url: docxUrl,
                        page_number: pageNumber,
                        instruction
                    }
                }
            };
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`DOCX MCP error: ${response.status}`);
            const data = await response.json();
            return this.parseMcpToolResult(data);
        },

        async handleDocxSectionEdit(panelId, payload) {
            const pageNumber = Number(payload?.pageNumber || 0);
            const instruction = (payload?.instruction || '').toString().trim();
            const contextText = (payload?.contextText || '').toString().trim();
            if (!pageNumber || !instruction) return;
            const panel = this.artifactPanels.find((p) => p.id === panelId);
            const docxFileUrl = panel?.data?.fileUrl || '';
            const callMethod = (method, ...args) => this.$refs.artifactPanel?.callPanelMethod?.(panelId, method, ...args);
            if (!docxFileUrl) {
                callMethod('showEditNotice', 'DOCX 파일 정보가 없어 수정할 수 없습니다.', 'error');
                return;
            }
            const finalInstruction = contextText ? `${instruction}\n\n선택 영역: ${contextText}` : instruction;
            try {
                const output = await this.requestDocxPageEdit({
                    docxUrl: docxFileUrl,
                    pageNumber,
                    instruction: finalInstruction
                });
                const edits = Array.isArray(output?.edits) ? output.edits : [];
                const editedHtml = output?.edited_page_html || output?.editedPageHtml || '';
                const applied = edits.length
                    ? callMethod('applyPageEdits', Number(pageNumber), edits)
                    : callMethod('applyPageEdit', Number(pageNumber), editedHtml);
                if (applied) {
                    if (edits.length) {
                        const ids = edits.map((e) => e?.id).filter(Boolean);
                        callMethod('highlightEdits', ids, Number(pageNumber));
                    }
                    callMethod('showEditNotice', `${pageNumber}페이지 수정 완료`, 'success');
                } else {
                    callMethod('showEditNotice', '페이지 수정에 실패했습니다.', 'error');
                }
            } catch (e) {
                callMethod('showEditNotice', '페이지 수정 중 오류가 발생했습니다.', 'error');
            }
        },

        async handleDocxDownload(panelId, payload) {
            if (this.artifactDownloadLoading) return;
            const html = payload?.html || '';
            if (!html) return;
            const panel = this.artifactPanels.find((p) => p.id === panelId);
            const docxUrl = panel?.data?.fileUrl || '';
            if (!docxUrl) return;
            this.artifactDownloadLoading = true;
            try {
                const result = await this.requestDocxSave({ docxUrl, html });
                const fileUrl = result?.file_url || result?.fileUrl || '';
                const fileName = result?.file_name || result?.fileName || 'output.docx';
                const newHtmlUrl = result?.html_url || result?.htmlUrl || '';
                if (fileUrl) {
                    // 패널의 fileUrl/htmlUrl을 저장된 파일로 업데이트 (이후 편집에서도 동일 버전 사용)
                    if (panel) {
                        panel.data.fileUrl = fileUrl;
                        if (newHtmlUrl) panel.data.htmlUrl = newHtmlUrl;
                    }
                    this.triggerFileDownload(fileUrl, fileName);
                }
            } catch (e) {
                console.warn('[ChatRoomPage] DOCX 다운로드 실패:', e);
            } finally {
                this.artifactDownloadLoading = false;
            }
        },

        async requestDocxSave({ docxUrl, html }) {
            const baseUrl = this.resolveHwpxMcpUrl();
            const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'save_docx_from_html',
                    arguments: {
                        docx_url: docxUrl,
                        edited_html: html
                    }
                }
            };
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`DOCX MCP error: ${response.status}`);
            const data = await response.json();
            return this.parseMcpToolResult(data);
        },

        resolveHwpxMcpUrl() {
            const raw = (import.meta.env.PROCESS_GPT_OFFICE_MCP_URL || '').toString().trim();
            if (!raw) return 'http://127.0.0.1:1192/mcp';
            return raw.endsWith('/') ? `${raw}mcp` : raw;
        },

        parseMcpToolResult(result) {
            if (!result) return null;
            const res = result.result || result.data || result;
            if (typeof res === 'string') {
                const parsed = this.parseToolOutput(res);
                return parsed && typeof parsed === 'object' ? parsed : null;
            }
            const content = Array.isArray(res?.content) ? res.content : [];
            for (const item of content) {
                if (!item) continue;
                const text = item.text || item.data || item.json || '';
                if (!text) continue;
                const parsed = this.parseToolOutput(text);
                if (parsed && typeof parsed === 'object') return parsed;
            }
            if (res && typeof res === 'object') return res;
            return null;
        },

        triggerFileDownload(url, filename) {
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename || 'output.hwpx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                try {
                    window.open(url, '_blank');
                } catch (e2) {}
            }
        },

        createBlobUrlFromBase64(base64, contentType) {
            try {
                if (!base64) return '';
                const binary = atob(base64);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i += 1) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' });
                return URL.createObjectURL(blob);
            } catch (e) {
                return '';
            }
        },

        getOrCreateProcessGenerationState(roomId) {
            const rid = roomId || this.currentChatRoom?.id || this.roomId || '';
            if (!rid) return null;
            if (!this.processGenerationByRoomId[rid]) {
                this.processGenerationByRoomId[rid] = {
                    isActive: false,
                    status: '',
                    message: '',
                    process_name: '',
                    process_id: '',
                    definition: null,
                    bpmn_xml: '',
                    updatedAt: ''
                };
            }
            return this.processGenerationByRoomId[rid];
        },

        updateProcessGenerationProgress(roomId, patch = {}) {
            const state = this.getOrCreateProcessGenerationState(roomId);
            if (!state) return;
            const next = {
                ...state,
                ...patch,
                updatedAt: new Date().toISOString()
            };
            this.processGenerationByRoomId[roomId] = next;
        },
        _getBpmnGeneratorContext() {
            if (this.__bpmnGeneratorContext) return this.__bpmnGeneratorContext;
            const methods = BPMNXmlGenerator?.methods || {};
            const defaults = typeof BPMNXmlGenerator?.data === 'function' ? BPMNXmlGenerator.data() : {};
            const ctx = { ...defaults };
            Object.entries(methods).forEach(([name, fn]) => {
                if (typeof fn === 'function') {
                    ctx[name] = fn.bind(ctx);
                }
            });
            this.__bpmnGeneratorContext = ctx;
            return ctx;
        },
        _isLegacyProcessDefinition(definition) {
            if (!definition || typeof definition !== 'object') return false;
            return (
                Array.isArray(definition.activities) ||
                Array.isArray(definition.events) ||
                Array.isArray(definition.gateways) ||
                Array.isArray(definition.sequences)
            );
        },
        _convertLegacyDefinitionToElements(definition) {
            const oldObj = JSON.parse(JSON.stringify(definition || {}));
            oldObj.elements = [];

            const typeMapping = {
                startEvent: 'StartEvent',
                endEvent: 'EndEvent',
                userTask: 'UserActivity',
                serviceTask: 'ServiceActivity',
                scriptTask: 'ScriptActivity',
                sendTask: 'EmailActivity',
                exclusiveGateway: 'ExclusiveGateway',
                parallelGateway: 'ParallelGateway',
                task: 'Activity'
            };
            const normalizeBpmnId = (rawId) => {
                const base = String(rawId || '').trim();
                if (!base) return `id_${Math.random().toString(36).slice(2, 10)}`;
                const safe = base.replace(/[^A-Za-z0-9_.-]/g, '_');
                return /^[A-Za-z_]/.test(safe) ? safe : `id_${safe}`;
            };
            const idMap = {};
            const registerId = (id) => {
                if (!id) return;
                if (!idMap[id]) idMap[id] = normalizeBpmnId(id);
            };

            (oldObj.activities || []).forEach((activity) => registerId(activity.id));
            (oldObj.events || []).forEach((event) => registerId(event.id));
            (oldObj.gateways || []).forEach((gateway) => registerId(gateway.id));
            (oldObj.sequences || []).forEach((sequence) => {
                registerId(sequence.source);
                registerId(sequence.target);
            });

            if (Array.isArray(oldObj.activities)) {
                oldObj.activities.forEach((activity) => {
                    let checkpoints = [];
                    let duration = activity.duration || '5';
                    try {
                        if (activity.properties) {
                            const props = typeof activity.properties === 'string' ? JSON.parse(activity.properties) : activity.properties;
                            if (props?.checkpoints) checkpoints = props.checkpoints;
                            if (props?.duration) duration = props.duration;
                        }
                    } catch (e) {}

                    oldObj.elements.push({
                        elementType: 'Activity',
                        id: idMap[activity.id] || normalizeBpmnId(activity.id),
                        name: activity.name,
                        type: typeMapping[activity.type] || 'UserActivity',
                        source: '',
                        description: activity.description || '',
                        instruction: activity.instruction || '',
                        role: activity.role || '',
                        inputData: activity.inputData || [],
                        outputData: activity.outputData || [],
                        checkpoints,
                        duration
                    });
                });
            }

            if (Array.isArray(oldObj.events)) {
                oldObj.events.forEach((event) => {
                    oldObj.elements.push({
                        elementType: 'Event',
                        id: idMap[event.id] || normalizeBpmnId(event.id),
                        name: event.name,
                        role: event.role || '',
                        source: '',
                        type: typeMapping[event.type] || event.type,
                        description: event.description || '',
                        trigger: event.type === 'startEvent' ? '프로세스 시작' : '프로세스 종료'
                    });
                });
            }

            if (Array.isArray(oldObj.gateways)) {
                oldObj.gateways.forEach((gateway) => {
                    oldObj.elements.push({
                        elementType: 'Gateway',
                        id: idMap[gateway.id] || normalizeBpmnId(gateway.id),
                        name: gateway.name || 'Gateway',
                        role: gateway.role || '',
                        source: '',
                        type: typeMapping[gateway.type] || 'ExclusiveGateway',
                        description: gateway.description || '분기점'
                    });
                });
            }

            if (Array.isArray(oldObj.sequences)) {
                const targetToSourceMap = {};
                oldObj.sequences.forEach((sequence) => {
                    if (!targetToSourceMap[sequence.target]) targetToSourceMap[sequence.target] = [];
                    targetToSourceMap[sequence.target].push(idMap[sequence.source] || normalizeBpmnId(sequence.source));
                });

                oldObj.elements.forEach((element) => {
                    if (targetToSourceMap[element.id] && targetToSourceMap[element.id].length > 0) {
                        element.source = targetToSourceMap[element.id][0];
                    }
                });

                oldObj.sequences.forEach((sequence) => {
                    oldObj.elements.push({
                        elementType: 'Sequence',
                        id: normalizeBpmnId(sequence.id),
                        name: String(sequence.id || '')
                            .replace('SequenceFlow_', '')
                            .replace(/_/g, ' '),
                        source: idMap[sequence.source] || normalizeBpmnId(sequence.source),
                        target: idMap[sequence.target] || normalizeBpmnId(sequence.target),
                        ...(sequence.condition ? { condition: sequence.condition } : {})
                    });
                });
            }

            return oldObj;
        },
        _buildBpmnXmlFromDefinition(definition) {
            if (!definition || typeof definition !== 'object') return '';
            try {
                const ctx = this._getBpmnGeneratorContext();
                let cloned = JSON.parse(JSON.stringify(definition));
                const hasElements = Array.isArray(cloned?.elements) && cloned.elements.length > 0;
                if (!hasElements && isLegacyProcessDefinition(cloned)) {
                    cloned = convertLegacyProcessDefinitionToElements(cloned);
                }
                const horizontal = typeof cloned?.isHorizontal === 'boolean' ? cloned.isHorizontal : undefined;
                const xml = ctx.createBpmnXml(cloned, horizontal);
                return typeof xml === 'string' ? xml : '';
            } catch (e) {
                console.warn('[ProcessPreview] BPMNXmlGenerator createBpmnXml failed:', e);
                return '';
            }
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
                    if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.elements) || isLegacyProcessDefinition(parsed))) {
                        return parsed;
                    }
                } catch (e) {
                    // ignore parse failures
                }
            }
            return null;
        },
        _ensureProcessPreviewPayload(payload = {}) {
            const definitionRaw = payload?.definition;
            const definition =
                typeof definitionRaw === 'string' ? this._extractProcessDefinitionFromText(definitionRaw) : definitionRaw || null;
            const bpmnXmlFromPayload = String(payload?.bpmn_xml || '').trim();
            const bpmn_xml = bpmnXmlFromPayload || this._buildBpmnXmlFromDefinition(definition);
            return {
                process_name: payload?.process_name || definition?.processDefinitionName || '',
                process_id: payload?.process_id || definition?.processDefinitionId || '',
                definition: definition || null,
                bpmn_xml
            };
        },

        appendAgentLogToMessage(assistantUuid, entry) {
            const target =
                Object.values(this.activeStreams).find((s) => s?.uuid === assistantUuid) ??
                this.messages.find((m) => m?.uuid === assistantUuid);
            if (!target) return;
            const logs = Array.isArray(target.agentLogs) ? target.agentLogs : [];
            logs.push({
                ts: new Date().toISOString(),
                level: entry?.level || 'info',
                category: entry?.category || 'runtime',
                message: entry?.message || '',
                detail: entry?.detail ?? null,
                namespace: Array.isArray(entry?.namespace) ? entry.namespace : []
            });
            target.agentLogs = logs.slice(-80);
            this.updateAgentPlanFromLog(target, entry || {});
        },

        updateAgentPlanFromLog(targetMessage, entry) {
            if (!targetMessage || typeof targetMessage !== 'object') return;
            const category = (entry?.category || '').toString().toLowerCase();
            const message = (entry?.message || '').toString().trim();
            const shouldUseAsPlan = category === 'plan' || (category === 'tool' && message.includes('tool_start'));
            if (!shouldUseAsPlan || !message) return;

            const current =
                targetMessage.agentPlan && typeof targetMessage.agentPlan === 'object'
                    ? targetMessage.agentPlan
                    : { summary: '', steps: [] };
            const nextSteps = Array.isArray(current.steps) ? [...current.steps] : [];
            if (nextSteps.length === 0 || nextSteps[nextSteps.length - 1] !== message) {
                nextSteps.push(message);
            }
            targetMessage.agentPlan = {
                summary: message,
                steps: nextSteps.slice(-6)
            };
        },

        /** Chat.vue / WorkAssistantChatPanel과 동일한 도구 표시명 (스트리밍 onToolStart에서 사용) */
        formatToolName(name) {
            if (!name) return '';
            const raw = name.toString();
            const key = raw.split('__').pop();
            const toolNameMap = {
                get_process_list: '프로세스 목록 조회',
                get_process_detail: '프로세스 상세 조회',
                get_form_fields: '폼 필드 조회',
                execute_process: '프로세스 실행',
                get_instance_list: '인스턴스 목록 조회',
                get_todolist: '할일 목록 조회',
                get_organization: '조직도 조회',
                ask_user: '사용자 확인 요청',
                create_consulting_process_workitem: '컨설팅 기반 프로세스 생성',
                create_pdf2bpmn_workitem: 'PDF→BPMN 변환 요청',
                get_current_user: '사용자 정보 조회'
            };
            return toolNameMap[key] || key;
        },

        async streamAgents(agentTargets, userText, payload) {
            const userJwt = (await getValidToken()) || '';
            const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';
            const requestFiles = this.normalizePayloadFiles(payload);
            const requestPrimaryFile = requestFiles[0] || null;
            const orchestration = (payload?.orchestration || this.getRoomOrchestration() || '').toString().trim() || 'langchain-react';
            const canWrite = this.shouldClientWriteChatDb(orchestration);
            const router = this.getAgentRouterForOrchestration(orchestration);
            const mainAgentService = this.getMainAgentServiceForOrchestration(orchestration);

            // remove routing loading bubble once we start calling agents
            const routingUuid = (agentTargets || []).find((t) => t?.__routingLoadingUuid)?.__routingLoadingUuid || null;
            if (routingUuid) this.removeRoutingLoadingMessage(routingUuid);

            let finalTargets = agentTargets;
            if (orchestration === 'deepagents' && agentTargets.length > 0) {
                finalTargets = [agentTargets[0]];
            }

            // deepagent HITL 안전망: 직전 턴이 request_human_input(interrupt)로 멈췄는데
            // 사용자가 패널 대신 일반 입력창으로 답한 경우에도, 보관해 둔 run_state 를 실어
            // 같은 그래프 세션으로 resume 되게 한다. (패널 제출은 이미 metadata.run_state 를 가짐)
            if (orchestration === 'deepagents') {
                const rid = (this.currentChatRoom?.id || this.roomId || '').toString();
                const pending = rid ? this.pendingHitlRunState[rid] : null;
                const hasRunState = !!(payload && typeof payload === 'object' && payload.metadata && payload.metadata.run_state);
                if (pending && !hasRunState) {
                    if (!payload || typeof payload !== 'object') payload = {};
                    payload.metadata = {
                        ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
                        run_state: pending,
                        human_response_answer: (userText || '').toString()
                    };
                }
                // 이번 전송이 resume(run_state 보유)이면 보관값 소비.
                if (rid && payload?.metadata?.run_state) {
                    delete this.pendingHitlRunState[rid];
                }
            }

            const promises = finalTargets.map(async (agentTarget) => {
                const agentId = agentTarget.id;
                if (!agentId) return;

                const assistantUuid = this.uuid();
                // activeStreams[agentId]에 스트리밍 메시지 등록 → displayMessages 통해 렌더됨
                // DB 확정 메시지가 실시간으로 도착하면 handleRealtimeMessage에서 제거
                this.activeStreams[agentId] = {
                    uuid: assistantUuid,
                    role: 'assistant',
                    content: '생각 중...',
                    contentType: 'text',
                    isLoading: true,
                    toolCalls: [],
                    timeStamp: new Date().toISOString(),
                    email: agentTarget.email || `agent:${agentId}`,
                    name: agentTarget.username || agentId,
                    userName: agentTarget.username || agentId,
                    profile: agentTarget.profile || null,
                    agentId,
                    agentPlan: {
                        summary: '',
                        steps: []
                    }
                };

                let full = '';
                let lastScrollAt = 0;
                const messageForAgent = this.buildMessageForAgent(userText, payload, agentTarget.policy);
                const maybeScroll = () => {
                    const now = Date.now();
                    if (now - lastScrollAt < 120) return;
                    lastScrollAt = now;
                    this.$nextTick(() => this.scrollToBottomSafe());
                };

                maybeScroll();

                // warmup (process-gpt-agent는 라우터 warmup 대상이 아님)
                if (agentId === PROCESS_GPT_AGENT_ID) {
                    this.setAgentStatus(agentId, { state: 'ready', message: '' });
                } else {
                    this.setAgentStatus(agentId, { state: 'warming', message: '' });
                    try {
                        await router.warmup(agentId);
                        this.setAgentStatus(agentId, { state: 'ready', message: '' });
                    } catch (e) {
                        console.error('streamAgents warmup error', e);
                        this.setAgentStatus(agentId, { state: 'error', message: '준비 실패' });
                        const warmupMsg = this.activeStreams[agentId];
                        if (warmupMsg) {
                            warmupMsg.content = '(에이전트 준비 실패)';
                            warmupMsg.isLoading = false;
                            this.messages.push(this.normalizeAssistantMessageForDisplay(warmupMsg));
                            delete this.activeStreams[agentId];
                        }
                        return;
                    }
                }

                // 에이전트가 채팅방 맥락을 잡을 수 있도록 최근 대화 10개를 함께 전달
                // (최근 대화 10개 + 벡터검색 결과 하이브리드 컨텍스트에 사용)
                const room_recent_history = this.buildRecentHistoryForRouting(10);
                const assignedSkills = this.extractAssignedSkills(agentTarget);
                const agentProfileForRuntime = {
                    id: agentId,
                    username: agentTarget?.username || agentId,
                    alias: agentTarget?.alias || '',
                    role: agentTarget?.role || '',
                    goal: agentTarget?.goal || '',
                    persona: agentTarget?.persona || '',
                    description: agentTarget?.description || '',
                    tools: agentTarget?.tools || '',
                    skills: assignedSkills
                };

                const commonParams = {
                    message: messageForAgent,
                    // 서버 dedupe용: 클라이언트에서 생성한 user 메시지 UUID
                    message_uuid:
                        (payload?.message_uuid || payload?.messageUuid || '').toString().trim() ||
                        (payload?.metadata?.message_uuid || payload?.metadata?.messageUuid || '').toString().trim() ||
                        null,
                    tenant_id: tenantId,
                    user_uid: this.userInfo?.uid || this.userInfo?.id,
                    user_email: this.userInfo?.email,
                    user_name: this.userInfo?.name || this.userInfo?.username,
                    user_jwt: userJwt,
                    conversation_id: this.currentChatRoom?.id,
                    // 텍스트([InputData]) 파싱 실패를 대비해 구조화 파일 정보를 함께 전달
                    file: requestPrimaryFile,
                    files: requestFiles,
                    file_count: requestFiles.length,
                    metadata: {
                        ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
                        ...(agentTarget?.__routingDecision ? { routing: agentTarget.__routingDecision } : {}),
                        room_recent_history,
                        assigned_skills: assignedSkills,
                        agent_profile: agentProfileForRuntime,
                        tool_settings: this.readToolsSettingsFromStorage(),
                        // 지식 베이스(Google Drive)에서 사용자가 선택한 문서 목록.
                        // 백엔드(memento)는 metadata.file_id 에 prefix 없는 원본 키
                        // (Drive file id 또는 Storage path)를 저장하므로,
                        // picker UI 의 prefix 키(`drive:`/`upload:`)가 아닌
                        // sourceRef 를 그대로 id 로 보낸다.
                        knowledge_docs: (() => {
                            const picked = Array.isArray(this.selectedKnowledgeDocs)
                                ? this.selectedKnowledgeDocs
                                      .filter((d) => d && d.sourceRef)
                                      .map((d) => ({
                                          id: d.sourceRef,
                                          source_type: d.sourceType || 'drive',
                                          file_name: d.file_name || d.name || '',
                                          mime_type: d.mimeType || '',
                                          folder_path: d.folderPath || ''
                                      }))
                                : [];
                            // 이번 메시지에 첨부·업로드된 파일도 memento file_id(=storage path)로
                            // knowledge_docs 에 합쳐, deepagent 가 업로드 즉시 문서를 조회하게 한다.
                            const seen = new Set(picked.map((d) => d.id));
                            for (const f of (requestFiles || [])) {
                                const id = (f?.fileId || f?.file_id || f?.filePath || f?.file_path || '').toString().trim();
                                if (!id || seen.has(id)) continue;
                                seen.add(id);
                                picked.push({
                                    id,
                                    source_type: 'storage',
                                    file_name: (f?.fileName || f?.name || '').toString(),
                                    mime_type: (f?.fileType || '').toString(),
                                    folder_path: ''
                                });
                            }
                            return picked;
                        })(),
                        input_data: {
                            file: requestPrimaryFile,
                            files: requestFiles,
                            fileCount: requestFiles.length
                        },
                        participant_agent_ids: this.agentParticipants.map((p) => p.id).filter(Boolean)
                    }
                };

                // AbortController 등록 (중지 버튼)
                const targetRoomId = this.currentChatRoom?.id || this.roomId || '';
                const abortController = new AbortController();
                const abortKey = `${targetRoomId}:${agentId}:${assistantUuid}`;
                this.agentAbortControllers[abortKey] = abortController;

                let hasHumanFeedback = false;

                const callbacks = {
                    onToken: (token) => {
                        full += token;
                        const msg = this.activeStreams[agentId];
                        if (msg) {
                            // HITL 패널(__humanFeedback)이 이미 붙은 메시지는 본문을 비워 둔다.
                            // (request_human_input 후보/승인 질문이 plan_tools 로 패널화된 뒤에도
                            //  스트리밍 토큰이 계속 와 본문에 질문 텍스트가 남던 문제 방지 — 체크박스 패널만 표시.)
                            msg.content = msg.__humanFeedback
                                ? ''
                                : hasHumanFeedback
                                  ? '참고할 문서를 검색했습니다. 생성 옵션을 선택해 주세요.'
                                  : (full.length === 0 ? '생각 중...' : full);
                            msg.isLoading = !msg.__humanFeedback;
                        }
                        this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                        maybeScroll();
                    },
                    onPlanTools: (tools) => {
                        try {
                            if (!Array.isArray(tools)) return;
                            this.planSideInfoEnabled.tools = true;
                            const baseOrder = Object.keys(this.plannedToolsById || {}).length;
                            for (let i = 0; i < tools.length; i++) {
                                const t = tools[i] || {};
                                const id = (t.id || '').toString();
                                if (!id) continue;
                                const toolRef = (t.tool || t.name || '').toString();
                                const name = (t.name || toolRef || '').toString();
                                const displayName = this.formatToolName(toolRef || name);
                                const prev = this.plannedToolsById?.[id] || null;
                                this.plannedToolsById[id] = {
                                    ...(prev || {}),
                                    id,
                                    tool: toolRef,
                                    name,
                                    displayName,
                                    args: t.args ?? prev?.args ?? null,
                                    status: prev?.status || 'planned',
                                    __order: prev?.__order ?? baseOrder + i
                                };
                            }
                            this.upsertToolsPanel();

                            // deepagent HITL: request_human_input 도구 호출이면 인라인 선택 패널 표시.
                            // (deepagent 는 interrupt 의 human_asked 를 A2A event_queue 로만 보내고
                            //  채팅 streamer 에는 plan_tools 만 보낸다 → 여기서 패널을 구성한다.)
                            try {
                                const hitl = tools.find((t) => {
                                    const n = (t?.tool || t?.name || '').toString();
                                    return n === 'request_human_input' && t?.args && (t.args.question || t.args.context);
                                });
                                if (hitl) this.attachDeepagentHitlPanel(agentId, hitl.args);
                            } catch (e) {}
                        } catch (e) {}
                    },
                    onPlanSkills: (skills) => {
                        try {
                            if (!Array.isArray(skills)) return;
                            this.planSideInfoEnabled.skills = true;
                            this.plannedSkills = skills;
                            this.upsertSkillsPanel();
                        } catch (e) {}
                    },
                    onPlanConnectors: (connectors) => {
                        try {
                            if (!Array.isArray(connectors)) return;
                            this.planSideInfoEnabled.connectors = true;
                            this.plannedConnectors = connectors;
                            this.upsertConnectorsPanel();
                        } catch (e) {}
                    },
                    onPlanTodos: (todos) => {
                        try {
                            if (!Array.isArray(todos)) return;
                            this.planSideInfoEnabled.todos = true;
                            // 서버 포맷: [{ content, status }]
                            this.plannedTodos = todos.map((t) => ({
                                content: (t?.content || '').toString(),
                                status: (t?.status || '').toString()
                            }));
                            this.upsertTodosPanel();
                        } catch (e) {}
                    },
                    onProcessResult: () => {
                        // [deprecated for deepagent] 과거에는 출력계약을 pdf2bpmn 카드(생성된 프로세스/스킬/미리보기)로
                        // 매핑해 표시했으나, 이제 deepagent 산출물은 onFileArtifact 의 샌드박스 파일 UI 로 표시한다.
                        // (PDF→BPMN 업로드 기능은 이 경로를 쓰지 않으므로 영향 없음.)
                    },
                    onFileArtifact: (evt) => {
                        // deepagent 가 샌드박스 workspace 에 만든/수정한 산출물 파일을 Claude Desktop식
                        // '작업 폴더 + 미리보기' UI(type:'files')로 실시간 표시한다.
                        try {
                            const msg = this.activeStreams[agentId];
                            if (!msg) return;
                            const path = ((evt && evt.path) || '').toString();
                            if (!path) return;
                            const entry = {
                                path,
                                name: (evt.name || path.split('/').pop() || path).toString(),
                                ext: (evt.ext || '').toString().toLowerCase(),
                                content: typeof evt.content === 'string' ? evt.content : '',
                                op: evt.op === 'edit' ? 'edit' : 'create',
                                truncated: !!evt.truncated,
                                status: 'done'
                            };
                            // 메시지에 영속(by path) — 새로고침 복원용
                            const files = Array.isArray(msg.workspaceFiles) ? msg.workspaceFiles : [];
                            const mi = files.findIndex((f) => f.path === path);
                            if (mi === -1) files.push(entry);
                            else files[mi] = { ...files[mi], ...entry };
                            msg.workspaceFiles = files;
                            // 방 단위 단일 패널로 통합(메시지가 여러 개여도 탭은 하나) — 같은 방 uuid 디렉터리의 파일을 한 곳에.
                            this.upsertWorkspaceFilesPanel(entry);
                        } catch (e) {}
                    },
                    onToolStart: (tool, input, rawEvent) => {
                        try {
                            const msg = this.activeStreams[agentId];
                            if (!msg) return;
                            const name = (tool?.name || tool || '').toString();
                            if (!name) return;
                            const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
                            // 중복 방지
                            const exists = toolCalls.some((t) => (t?.name || '') === name && (t?.status || '') === 'running');
                            if (!exists) {
                                toolCalls.push({ name, status: 'running', input: input ?? null, startedAt: new Date().toISOString() });
                            }
                            msg.toolCalls = toolCalls;
                            // WorkAssistantChatPanel처럼 현재 동작 텍스트로 표시
                            msg.content = `🔧 ${this.formatToolName(name)} 실행 중...`;
                            this.appendAgentLogToMessage(assistantUuid, {
                                level: 'info',
                                category: 'tool',
                                message: `tool_start: ${name}`,
                                detail: { input }
                            });

                            // 우측 활동 패널 갱신 (모든 tool/subagent 호출 시각화)
                            try {
                                const subagentType =
                                    name === 'task'
                                        ? (input?.subagent_type || input?.subagentType || '').toString()
                                        : '';
                                const activityId =
                                    (rawEvent?.id || rawEvent?.tool_call_id || rawEvent?.run_id || '').toString() ||
                                    `${name}:${Date.now()}`;
                                this.recordActivity({
                                    id: activityId,
                                    tool: name,
                                    name,
                                    displayName: this.formatToolName(name),
                                    kind: name === 'task' ? 'subagent' : 'tool',
                                    subagentType,
                                    status: 'running',
                                    input: input ?? null
                                });
                            } catch (e) {}

                            // 우측 Tools 패널 상태 업데이트 (id 매칭)
                            const toolId = (rawEvent?.id || rawEvent?.tool_call_id || '').toString();
                            if (toolId) {
                                const prev = this.plannedToolsById?.[toolId] || null;
                                this.plannedToolsById[toolId] = {
                                    ...(prev || {}),
                                    id: toolId,
                                    tool: (rawEvent?.tool || rawEvent?.tool_name || rawEvent?.name || name || '').toString(),
                                    name,
                                    displayName: this.formatToolName(
                                        (rawEvent?.tool || rawEvent?.tool_name || rawEvent?.name || name || '').toString()
                                    ),
                                    status: 'running',
                                    input: input ?? prev?.input ?? null
                                };
                                if (this.planSideInfoEnabled?.tools) this.upsertToolsPanel();
                            }

                            const roomId = this.currentChatRoom?.id || this.roomId || null;
                            if (name.includes('create_consulting_process_workitem')) {
                                this.updateProcessGenerationProgress(roomId, {
                                    isActive: true,
                                    status: 'generating',
                                    message: '컨설팅 내용으로 프로세스를 생성 중입니다...'
                                });
                            }
                            this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                            maybeScroll();
                        } catch (e) {}
                    },
                    onToolEnd: (output, rawEvent) => {
                        try {
                            const msg = this.activeStreams[agentId];
                            if (!msg) return;
                            const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
                            // 마지막 running tool을 done 처리
                            let lastRunningTool = null;
                            for (let i = toolCalls.length - 1; i >= 0; i--) {
                                if (toolCalls[i]?.status === 'running') {
                                    toolCalls[i] = {
                                        ...toolCalls[i],
                                        status: 'done',
                                        output: output ?? null,
                                        endedAt: new Date().toISOString()
                                    };
                                    lastRunningTool = toolCalls[i];
                                    break;
                                }
                            }
                            msg.toolCalls = toolCalls;
                            this.appendAgentLogToMessage(assistantUuid, {
                                level: 'info',
                                category: 'tool',
                                message: `tool_end: ${(lastRunningTool?.name || '').toString() || 'unknown'}`,
                                detail: { output }
                            });

                            // 우측 활동 패널 — running 상태인 항목을 done 으로 마감
                            try {
                                const eventId =
                                    (rawEvent?.id || rawEvent?.tool_call_id || rawEvent?.run_id || '').toString();
                                let target = eventId ? this.plannedActivityById[eventId] : null;
                                if (!target) {
                                    // id 매칭 실패 시 가장 최근 running 항목 done 처리
                                    const items = Object.values(this.plannedActivityById || {});
                                    target = items
                                        .filter((x) => x.status === 'running')
                                        .sort((a, b) => (b.__order ?? 0) - (a.__order ?? 0))[0];
                                }
                                if (target) {
                                    const nextStatus = rawEvent?.error ? 'error' : 'done';
                                    this.recordActivity({ ...target, status: nextStatus });
                                }
                            } catch (e) {}

                            // 우측 Tools 패널 상태 업데이트 (id 매칭)
                            const toolId = (rawEvent?.id || rawEvent?.tool_call_id || '').toString();
                            if (toolId) {
                                const prev = this.plannedToolsById?.[toolId] || null;
                                this.plannedToolsById[toolId] = {
                                    ...(prev || {}),
                                    id: toolId,
                                    tool: (rawEvent?.tool || rawEvent?.tool_name || rawEvent?.name || prev?.tool || '').toString(),
                                    name: (prev?.name || rawEvent?.tool || rawEvent?.tool_name || rawEvent?.name || '').toString(),
                                    displayName:
                                        prev?.displayName ||
                                        this.formatToolName((rawEvent?.tool || rawEvent?.tool_name || rawEvent?.name || '').toString()),
                                    status: 'done',
                                    output: output ?? prev?.output ?? null
                                };
                                if (this.planSideInfoEnabled?.tools) this.upsertToolsPanel();
                            }

                            // human feedback 도구 결과 감지 (일반화)
                            if (lastRunningTool && lastRunningTool.name) {
                                try {
                                    const fbParsed = typeof output === 'string' ? JSON.parse(output) : output;
                                    if (fbParsed && typeof fbParsed === 'object') {
                                        const isLegacyListRef =
                                            lastRunningTool.name.includes('list_reference_documents') &&
                                            fbParsed.user_request_type === 'select_items' &&
                                            Array.isArray(fbParsed.items);
                                        const isAskUserWithUI =
                                            fbParsed.user_request_type === 'ask_user' &&
                                            (typeof fbParsed.feedback_type === 'string' ||
                                                Array.isArray(fbParsed.items) ||
                                                (fbParsed.option_meta && typeof fbParsed.option_meta === 'object'));
                                        if (isLegacyListRef || isAskUserWithUI) {
                                            lastRunningTool.__humanFeedback = fbParsed;
                                            hasHumanFeedback = true;
                                            const fallbackText = isLegacyListRef
                                                ? '참고할 문서를 검색했습니다. 생성 옵션을 선택해 주세요.'
                                                : (fbParsed.question || '생성 옵션을 선택해 주세요.');
                                            msg.content = fallbackText;
                                            if (!msg.__humanFeedback) {
                                                msg.__humanFeedback = fbParsed;
                                            }
                                        }
                                    }
                                } catch (e) {}
                            }

                            const parsed = this.parseToolOutput(output);
                            // 슬라이드 아티팩트 감지
                            if (this.isSlidePayload(parsed)) {
                                this.pushSlideArtifact(parsed, msg);
                            } else if (this.isDocxPayload(parsed)) {
                                this.pushDocxArtifact(parsed, msg);
                            } else {
                                this.pushHwpxArtifact(parsed, msg);
                                if (!this.hasArtifactPanel) {
                                    const urlFromText = this.extractHwpxHtmlUrlFromText(output);
                                    if (urlFromText) {
                                        this.pushHwpxArtifact({ html_url: urlFromText }, msg);
                                    }
                                }
                            }
                            maybeScroll();
                        } catch (e) {}
                    },
                    onAgentLog: (event) => {
                        this.appendAgentLogToMessage(assistantUuid, event || {});
                    },
                    onProcessStatus: (event) => {
                        const roomId = this.currentChatRoom?.id || this.roomId || null;
                        const status = String(event?.status || '')
                            .trim()
                            .toLowerCase();
                        const isGenerationStatus = ['generating', 'completed', 'error'].includes(status);
                        if (!isGenerationStatus) return;
                        this.updateProcessGenerationProgress(roomId, {
                            isActive: status !== 'error',
                            status: status || '',
                            message: event?.message || ''
                        });
                    },
                    onProcessPartial: (event) => {
                        const roomId = this.currentChatRoom?.id || this.roomId || null;
                        const preview = this._ensureProcessPreviewPayload({
                            process_name: event?.process_name || '',
                            process_id: event?.process_id || '',
                            definition: event?.definition || null,
                            bpmn_xml: event?.bpmn_xml || ''
                        });
                        const msg = this.activeStreams[agentId];
                        if (msg) {
                            msg.processPreview = { ...preview };
                        }
                        this.updateProcessGenerationProgress(roomId, {
                            isActive: true,
                            status: 'generating',
                            message: '프로세스 초안을 갱신 중입니다...',
                            process_name: preview.process_name || '',
                            process_id: preview.process_id || '',
                            definition: preview.definition || null,
                            bpmn_xml: preview.bpmn_xml || ''
                        });
                    },
                    onProcessPatch: (event) => {
                        const roomId = this.currentChatRoom?.id || this.roomId || null;
                        this.updateProcessGenerationProgress(roomId, {
                            isActive: true,
                            status: 'generating',
                            message: event?.message || '프로세스 패치를 반영 중입니다...'
                        });
                    },
                    onOpenUi: (payload) => {
                        const convFromPayload = (payload?.conversation_id || '').toString();
                        const roomId = (this.currentChatRoom?.id || this.roomId || '').toString();
                        if (convFromPayload && roomId && convFromPayload !== roomId) {
                            return;
                        }

                        const msg = this.activeStreams[agentId];
                        if (!msg) return;
                        const op = String(payload?.op || '').toLowerCase();

                        if (op === 'delta') {
                            const chunk = typeof payload.openui_lang_chunk === 'string' ? payload.openui_lang_chunk : '';
                            const qid = payload?.question_id;
                            const seq = Number(payload?.seq);
                            const newQuestion = qid != null && msg.openuiStreamQuestionId !== qid;
                            if (newQuestion || seq === 0) {
                                if (qid != null) {
                                    msg.openuiStreamQuestionId = qid;
                                }
                                msg.openuiLang = chunk;
                            } else {
                                msg.openuiLang = (msg.openuiLang || '') + chunk;
                            }
                            msg.openuiIsStreaming = true;
                            // done 이벤트 없이 openui만 오는 경우: 로딩 분기가 OpenUI v-sheet를 가림 → 즉시 해제
                            msg.isLoading = false;
                            if (payload?.run_state != null && typeof payload.run_state === 'object') {
                                msg.runState = { ...(msg.runState || {}), ...payload.run_state };
                            }
                        } else if (op === 'end') {
                            const finalLang =
                                (typeof payload.openui_lang === 'string' && payload.openui_lang) ||
                                (typeof payload.run_state?.openui_lang === 'string' && payload.run_state.openui_lang) ||
                                msg.openuiLang ||
                                '';
                            msg.openuiLang = finalLang;
                            msg.openuiIsStreaming = false;
                            msg.isLoading = false;
                            if (payload?.run_state != null && typeof payload.run_state === 'object') {
                                msg.runState = { ...(msg.runState || {}), ...payload.run_state };
                            }
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });
                        }
                    },
                    onDone: async (content) => {
                        const finalContent = (content || full || '').toString().trim();

                        // deepagent interrupt(request_human_input) 종료 마커 처리:
                        // 정상 완료가 아니라 "사용자 입력 대기"이므로, HITL 패널을 띄우고
                        // 답변을 run_state 와 함께 재전송해 같은 그래프 세션을 resume 한다.
                        const hitlMarker = this._parseDeepagentHitlMarker(content);
                        if (hitlMarker) {
                            this._applyDeepagentHitlStop(agentId, hitlMarker);
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });
                            return;
                        }

                        let safeFinal = finalContent === 'NO_RESPONSE' ? '' : finalContent;
                        let displayContent = '';

                        const msg = this.activeStreams[agentId];
                        if (msg) {
                            const msgToolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
                            const feedbackTC = msgToolCalls.find((tc) => tc?.__humanFeedback);
                            if (feedbackTC) {
                                msg.__humanFeedback = feedbackTC.__humanFeedback;
                                safeFinal = '참고할 문서를 검색했습니다. 생성 옵션을 선택해 주세요.';
                                console.log(
                                    '[HumanFeedback] ✅ 메시지에 __humanFeedback 첨부됨, items:',
                                    feedbackTC.__humanFeedback?.items?.length
                                );
                            }

                            const hwpxPayload = this.extractHwpxPayload(safeFinal || full || '');
                            if (hwpxPayload && this.isSlidePayload(hwpxPayload)) {
                                this.pushSlideArtifact(hwpxPayload, msg);
                                safeFinal = '슬라이드를 생성했습니다. 오른쪽 패널에서 확인해주세요.';
                            } else if (hwpxPayload) {
                                const pdfUrl = hwpxPayload.pdf_url || hwpxPayload.pdfUrl || '';
                                const pdfName = (hwpxPayload.pdf_name || hwpxPayload.pdfName || '').toString();
                                const fileUrl = hwpxPayload.file_url || hwpxPayload.fileUrl || '';
                                const fileName = (hwpxPayload.file_name || hwpxPayload.fileName || 'filled.hwpx').toString();
                                const contentType = (
                                    hwpxPayload.content_type ||
                                    hwpxPayload.contentType ||
                                    'application/vnd.hancom.hwpx'
                                ).toString();
                                const htmlUrl = this.extractHwpxHtmlUrl(hwpxPayload);

                                if (pdfUrl) {
                                    msg.pdfFile = {
                                        url: pdfUrl,
                                        fileUrl: pdfUrl,
                                        name: pdfName || 'filled.pdf',
                                        fileName: pdfName || 'filled.pdf',
                                        contentType: hwpxPayload.pdf_content_type || 'application/pdf'
                                    };
                                    safeFinal = 'PDF 미리보기가 준비되었습니다. 아래 첨부 파일을 확인해주세요.';
                                } else if (hwpxPayload.base64_data || hwpxPayload.base64Data) {
                                    const base64 = hwpxPayload.base64_data || hwpxPayload.base64Data;
                                    const blobUrl = this.createBlobUrlFromBase64(base64, contentType);
                                    if (blobUrl) {
                                        msg.pdfFile = { url: blobUrl, fileUrl: blobUrl, name: fileName, fileName, contentType };
                                    }
                                    safeFinal = 'HWPX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.';
                                } else if (fileUrl) {
                                    msg.pdfFile = { url: fileUrl, fileUrl, name: fileName, fileName, contentType };
                                    safeFinal = this.isDocxPayload(hwpxPayload)
                                        ? 'DOCX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.'
                                        : 'HWPX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.';
                                }

                                if (htmlUrl) {
                                    if (this.isDocxPayload(hwpxPayload)) {
                                        this.pushDocxArtifact(hwpxPayload, msg);
                                    } else {
                                        this.pushHwpxArtifact(hwpxPayload, msg);
                                    }
                                }
                            }

                            // HITL 패널(__humanFeedback)이 붙은 메시지는 본문을 비워 둔다.
                            // (interrupt 후 빈 final done 의 onDone 이 본문을 초안 텍스트로 덮어써 패널 대신
                            //  텍스트가 보이던 문제 방지 — 체크박스/승인 패널만 표시.)
                            msg.content = msg.__humanFeedback ? '' : (safeFinal || full || '');
                            displayContent = this.extractDisplayAssistantContent(msg.content);
                            msg.isLoading = false;
                            msg.contentType = 'text';

                            this.applyHwpxViewerFromToolCalls(msg.toolCalls, msg);
                            if (!this.hasArtifactPanel) {
                                const urlFromText = this.extractHwpxHtmlUrlFromText(msg.content);
                                if (urlFromText) {
                                    this.pushHwpxArtifact({ html_url: urlFromText }, msg);
                                }
                            }
                            const hasRawHwpxInContent =
                                /https?:\/\/\S+\.hwpx/i.test(msg.content) ||
                                /https?:\/\/\S*filled-\S+\.html/i.test(msg.content);
                            if (hasRawHwpxInContent) {
                                // cleanupHwpxMessageContent는 messages 인덱스 기반이므로 직접 정리
                                msg.content = msg.content
                                    .replace(/https?:\/\/\S+\.hwpx\S*/gi, '')
                                    .replace(/https?:\/\/\S*filled-\S+\.html\S*/gi, '')
                                    .trim();
                                safeFinal = msg.content;
                            }

                            // realtime INSERT가 오지 않는 경우 대비: 10초 후 messages로 이관
                            setTimeout(() => {
                                if (this.activeStreams[agentId]) {
                                    const stale = this.activeStreams[agentId];
                                    this.messages.push(this.normalizeAssistantMessageForDisplay(stale));
                                    delete this.activeStreams[agentId];
                                    this._stableSortMessages(this.messages);
                                }
                            }, 10000);
                        }
                        if (!displayContent) {
                            displayContent = this.extractDisplayAssistantContent((safeFinal || full || '').toString());
                        }
                        this.setAgentStatus(agentId, { state: 'ready', message: '' });
                        const roomId = this.currentChatRoom?.id || this.roomId || null;
                        const state = this.getOrCreateProcessGenerationState(roomId);
                        const generatedDefinition =
                            state?.definition && typeof state.definition === 'object'
                                ? state.definition
                                : this._extractProcessDefinitionFromText(safeFinal || full || '');
                        const generatedBpmnXml =
                            String(state?.bpmn_xml || '').trim() || this._buildBpmnXmlFromDefinition(generatedDefinition);
                        const shouldKeepProcessState = !!(state?.isActive || generatedDefinition || generatedBpmnXml);
                        if (shouldKeepProcessState) {
                            this.updateProcessGenerationProgress(roomId, {
                                isActive: true,
                                status: 'completed',
                                message: '프로세스 생성 응답이 완료되었습니다.',
                                definition: generatedDefinition || state?.definition || null,
                                bpmn_xml: generatedBpmnXml || state?.bpmn_xml || '',
                                process_name: state?.process_name || generatedDefinition?.processDefinitionName || '',
                                process_id: state?.process_id || generatedDefinition?.processDefinitionId || ''
                            });
                        }

                        if (canWrite && this.currentChatRoom) {
                            this.currentChatRoom.message = {
                                msg: (displayContent || safeFinal || full || '').substring(0, 50),
                                type: 'text',
                                createdAt: new Date().toISOString()
                            };
                            await this.putChatRoomMerged(this.currentChatRoom);
                        }

                        // 생성 완료 → 사용자에게 제시하기 전에 임시저장(draft) + 실엔진 검증/자동개선.
                        // (그룹별 __validated 가드로 idempotent. HITL 중단은 위에서 이미 return 처리됨.)
                        if (shouldKeepProcessState || Object.keys(this.roomWorkspaceFilesByGroup || {}).length) {
                            this.runDraftValidationForRoom().catch((e) => console.warn('[DraftValidate] 오케스트레이션 실패:', e));
                        }

                        this.EventBus.emit('chat-rooms-updated');
                        this.$nextTick(() => this.scrollToBottomSafe());

                        delete this.agentAbortControllers[abortKey];

                        try {
                            await this.handleAgentDirectiveToolCalls({ assistantUuid, userText, agentId });
                        } catch (e) {}

                        try {
                            if (agentId === PROCESS_GPT_AGENT_ID) {
                                const streamMsg = this.activeStreams[agentId];
                                const toolCalls = Array.isArray(streamMsg?.toolCalls) ? streamMsg.toolCalls : [];
                                this.checkAndSubscribePdf2Bpmn(safeFinal || full || '', toolCalls, roomId);
                            }
                        } catch (e) {}
                    },
                    onError: async (err) => {
                        delete this.agentAbortControllers[abortKey];
                        // 백엔드가 보낸 실제 오류 메시지를 화면에 노출한다(오류를 먹지 않음).
                        const errText = (err && (err.message || err.toString())) || '';
                        const partial = (full || '').toString().trim();
                        const display = partial
                            ? `${partial}\n\n⚠️ 오류가 발생했습니다: ${errText || '에이전트 응답 오류'}`
                            : `⚠️ 오류가 발생했습니다: ${errText || '에이전트 응답 오류'}`;
                        const msg = this.activeStreams[agentId];
                        if (msg) {
                            msg.content = display;
                            msg.isLoading = false;
                            msg.openuiIsStreaming = false;
                            msg.isError = true;
                            // 에러 시 서버가 저장하지 않으므로 messages에 직접 이관
                            this.messages.push(this.normalizeAssistantMessageForDisplay(msg));
                            delete this.activeStreams[agentId];
                        } else {
                            // 스트림 메시지 객체가 없으면 새 에러 메시지를 추가해서라도 표시
                            this.messages.push(this.normalizeAssistantMessageForDisplay({
                                uuid: assistantUuid,
                                role: 'assistant',
                                agentId,
                                content: display,
                                isError: true,
                                isLoading: false
                            }));
                        }
                        const roomId = this.currentChatRoom?.id || this.roomId || null;
                        const state = this.getOrCreateProcessGenerationState(roomId);
                        if (state?.isActive) {
                            this.updateProcessGenerationProgress(roomId, {
                                isActive: true,
                                status: 'error',
                                message: `프로세스 생성 중 오류가 발생했습니다: ${errText || ''}`.trim()
                            });
                        }
                        this.setAgentStatus(agentId, { state: 'error', message: '응답 오류' });
                    }
                };

                // 중지 버튼: placeholder면 제거, 부분 응답이 있으면 messages로 이관 후 로딩 해제
                const onAbortHandler = () => {
                    delete this.agentAbortControllers[abortKey];
                    const msg = this.activeStreams[agentId];
                    if (msg) {
                        const content = (msg.content || '').toString().trim();
                        const isPlaceholder =
                            !content ||
                            content === '...' ||
                            content === '생각 중' ||
                            content === '생각 중...' ||
                            content === '생각중...' ||
                            content === '생각중';
                        if (!isPlaceholder) {
                            msg.isLoading = false;
                            msg.openuiIsStreaming = false;
                            this.messages.push(this.normalizeAssistantMessageForDisplay(msg));
                        }
                        delete this.activeStreams[agentId];
                    }
                    this.setAgentStatus(agentId, { state: 'ready', message: '' });
                };

                if (agentId === PROCESS_GPT_AGENT_ID) {
                    await mainAgentService.sendMessageStream(
                        commonParams,
                        {
                            ...callbacks,
                            onAbort: onAbortHandler
                        },
                        { signal: abortController.signal }
                    );
                } else {
                    await router.sendMessageStream(
                        agentId,
                        commonParams,
                        {
                            ...callbacks,
                            onAbort: onAbortHandler
                        },
                        { signal: abortController.signal }
                    );
                }
            });

            await Promise.all(promises);
        },

        /**
         * 도구 호출 기반 후처리
         * - edit_hwpx_page_html: 기존과 동일하게 즉시 반영
         * - 프로세스 컨설팅/생성은 work-assistant-agent 강제 라우팅(컨설팅 흐름)이 직접 처리하므로
         *   프론트 후처리(레거시 start_process_consulting/generate_process)는 제거되었다.
         */
        async handleAgentDirectiveToolCalls({ assistantUuid, userText, agentId }) {
            // onDone 직후에는 activeStreams에 있을 수 있고, realtime 도착 후에는 messages에 있음
            const msg =
                this.activeStreams[agentId] ??
                this.messages.find((m) => m?.uuid === assistantUuid) ??
                {};
            const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
            if (toolCalls.length === 0) return;

            const pageEditToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('edit_hwpx_page_html'));

            // 프로세스 생성 요청 → 클라이언트 컨설팅 모드로 전환 (WorkAssistantChatPanel과 동일 패턴).
            // 배포된 base-agent(work-assistant-agent) 버전이 server-side 프로세스 생성을 하지 않으므로,
            // 최신 프론트에서도 start_process_consulting 도구 호출 시 클라이언트가
            // ConsultingGenerator(/completion/langchain-chat/messages)로 생성 → onModelCreated 에서 proc_def 저장한다.
            const consultingToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('start_process_consulting'));
            if (consultingToolCall?.name) {
                let imageAnalysis = null;
                try {
                    const parsed = this.parseToolOutput(consultingToolCall.output);
                    if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                        imageAnalysis = parsed.image_analysis_result;
                    }
                } catch (e) {}
                let originalMessage;
                if (imageAnalysis) {
                    originalMessage = `${userText || ''}\n\n[이미지 분석 결과]\n${imageAnalysis}`;
                } else {
                    originalMessage =
                        `${userText || ''}\n\n[전체 요청 및 첨부 이미지 분석 내용]: ${JSON.stringify(consultingToolCall.output ?? null)}`;
                }
                await this.switchToConsultingMode(originalMessage);
                return;
            }

            // 컨설팅 후 생성 확정 → definitions 생성 화면으로 전환 (WorkAssistantChatPanel:952-957 과 동일).
            // base-agent 가 generate_process 도구를 호출하면 지금까지의 대화를 store 에 실어
            // /definitions/chat 로 넘겨 실제 proc_def 를 생성/저장하게 한다.
            const generateToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('generate_process'));
            if (generateToolCall?.name) {
                const messagesForDefinition = this.buildMessagesForDefinitionGeneration();
                this.$store.dispatch('updateMessages', messagesForDefinition);
                this.$router.push('/definitions/chat');
                return;
            }

            if (!pageEditToolCall?.name) return;

            if (pageEditToolCall?.name) {
                try {
                    const output = this.parseToolOutput(pageEditToolCall.output);
                    const pageNumber =
                        output?.page_number ||
                        output?.pageNumber ||
                        pageEditToolCall?.input?.page_number ||
                        pageEditToolCall?.input?.pageNumber;
                    const edits = Array.isArray(output?.edits) ? output.edits : [];
                    const editedHtml = output?.edited_page_html || output?.editedPageHtml || '';
                    const applied = edits.length
                        ? this.$refs.hwpxViewer?.applyPageEdits?.(Number(pageNumber), edits)
                        : this.$refs.hwpxViewer?.applyPageEdit?.(Number(pageNumber), editedHtml);
                    if (applied) {
                        if (edits.length) {
                            const ids = edits.map((e) => e?.id).filter(Boolean);
                            this.$refs.hwpxViewer?.highlightEdits?.(ids, Number(pageNumber));
                        }
                        this.$refs.hwpxViewer?.showEditNotice?.(`${pageNumber}페이지 수정 완료`, 'success');
                    } else {
                        this.$refs.hwpxViewer?.showEditNotice?.('페이지 수정에 실패했습니다.', 'error');
                    }
                } catch (e) {
                    this.$refs.hwpxViewer?.showEditNotice?.('페이지 수정 중 오류가 발생했습니다.', 'error');
                }
            }
        },

        // ===== ConsultingGenerator (WorkAssistantChatPanel 방식) =====

        createMessageObj(content, role) {
            const nowIso = new Date().toISOString();
            if (role === 'user') {
                return {
                    uuid: this.uuid(),
                    role: 'user',
                    content: (content ?? '').toString(),
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || ''
                };
            }
            return {
                uuid: this.uuid(),
                role: role || 'assistant',
                content: (content ?? '').toString(),
                timeStamp: nowIso,
                email: 'system@uengine.org',
                name: 'Process GPT Agent',
                userName: 'Process GPT',
                agentId: 'process-gpt-agent',
                profile: '/images/chat-icon.png'
            };
        },

        async saveMessageToRoom(msg, roomId) {
            const targetRoomId = roomId || this.currentChatRoom?.id;
            if (!targetRoomId || !msg?.uuid) return;
            try {
                await backend.putObject(`db://chats/${msg.uuid}`, {
                    uuid: msg.uuid,
                    id: targetRoomId,
                    messages: msg
                });

                // 채팅방 last message 업데이트
                if (this.currentChatRoom && this.currentChatRoom.id === targetRoomId) {
                    this.currentChatRoom.message = {
                        msg: (msg.content || '').toString().substring(0, 50),
                        type: 'text',
                        createdAt: msg.timeStamp
                    };
                    await this.putChatRoomMerged(this.currentChatRoom);
                }
            } catch (e) {
                // ignore
            }
        },

        async saveMessage(msg) {
            await this.saveMessageToRoom(msg, this.currentChatRoom?.id);
        },

        removeBase64ImageData(text) {
            const raw = (text ?? '').toString();
            if (!raw) return '';
            return raw.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '[이미지 데이터 생략]');
        },

        buildMessagesForDefinitionGeneration() {
            const generationPrompt = '위 내용대로 프로세스 생성해줘';
            const sourceMessages = Array.isArray(this.messages) ? this.messages : [];
            const msgs = sourceMessages
                .map((msg) => {
                    if (!msg || typeof msg !== 'object') return null;

                    let content = '';
                    if (typeof msg.content === 'string') {
                        content = msg.content;
                    } else if (Array.isArray(msg.content)) {
                        // 멀티모달 content에서 텍스트만 유지하고 이미지는 플레이스홀더로 치환
                        content = msg.content
                            .map((part) => {
                                if (!part || typeof part !== 'object') return '';
                                if (part.type === 'text') return part.text || '';
                                if (part.type === 'image_url') return '[이미지 첨부]';
                                return '';
                            })
                            .filter(Boolean)
                            .join(' ');
                    } else if (msg.content !== null && msg.content !== undefined) {
                        content = JSON.stringify(msg.content);
                    }

                    content = this.removeBase64ImageData(content).trim();
                    if (!content) return null;

                    return {
                        role: (msg.role || '').toString(),
                        content,
                        timeStamp: msg.timeStamp || new Date().toISOString()
                    };
                })
                .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'));

            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const lastContent = (lastMsg?.content ?? '').toString().trim();

            if (!(lastMsg?.role === 'user' && lastContent === generationPrompt)) {
                msgs.push(this.createMessageObj(generationPrompt, 'user'));
            }

            return msgs;
        },

        // 컨설팅 모드로 전환 (프로세스 생성용) - start_process_consulting 도구 호출 시마다 1회 실행
        async switchToConsultingMode(userMessage, options = {}) {
            const me = this;

            me.generator = new ConsultingGenerator(me, {
                isStream: true,
                preferredLanguage: 'Korean'
            });

            me.isConsultingMode = true;

            // 마지막 assistant 메시지 제거 (에이전트의 start_process_consulting 응답을 대체)
            // 사용자 노출 안내 메시지를 이미 세팅한 경우에는 유지
            const keepLastAssistantMessage = options?.keepLastAssistantMessage === true;
            if (!keepLastAssistantMessage && me.messages.length > 0 && me.messages[me.messages.length - 1].role !== 'user') {
                me.messages.pop();
            }

            // 전체 대화 내역을 previousMessages에 추가 (마지막 사용자 메시지 제외 → 합쳐진 userMessage로 대체)
            let chatMsgs = [];
            if (me.messages && me.messages.length > 0) {
                me.messages.forEach((msg, idx) => {
                    const isLastUserMsg = idx === me.messages.length - 1 && msg.role === 'user';
                    if (msg.content && !msg.isLoading && !isLastUserMsg) {
                        chatMsgs.push({
                            role: msg.role,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                        });
                    }
                });
            }

            chatMsgs.push({ role: 'user', content: (userMessage ?? '').toString() });

            // ConsultingGenerator의 system prompt 유지 + 대화 내용 덧붙이기
            me.generator.previousMessages = [me.generator.previousMessages[0], ...chatMsgs];

            me.lastSendMessage = { text: userMessage };
            await me.startConsultingGenerate();
        },

        async startConsultingGenerate() {
            const me = this;
            if (!me.generator) return;

            const targetRoomId = me.currentChatRoom?.id;
            me._consultingTargetRoomId = targetRoomId;

            // 로딩 메시지 표시
            const loadingMsg = me.createMessageObj('...', 'assistant');
            loadingMsg.isLoading = true;
            me.messages.push(loadingMsg);
            me.$nextTick(() => me.scrollToBottomSafe());

            try {
                await me.generator.generate();
            } catch (error) {
                console.error('컨설팅 생성 오류:', error);

                // 로딩 메시지 제거
                if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {
                    me.messages.pop();
                }
                const errorMsg = me.createMessageObj('죄송합니다. 프로세스 설계 중 오류가 발생했습니다.', 'assistant');
                me.messages.push(errorMsg);
                await me.saveMessage(errorMsg);
            }
        },

        // AIGenerator에서 호출 - 스트리밍 중 토큰 처리
        onModelCreated(response) {
            const me = this;
            if (me.messages && me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                if (lastMsg.isLoading) {
                    if (response?.content) {
                        lastMsg.content = (lastMsg.content === '...' ? '' : lastMsg.content) + response.content;
                    }
                }
            }
            me.$nextTick(() => me.scrollToBottomSafe());
        },

        extractConsultingText(payload) {
            if (payload === null || payload === undefined) return '';
            if (typeof payload === 'string') return payload;
            if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);

            if (Array.isArray(payload)) {
                const parts = payload
                    .map((item) => this.extractConsultingText(item))
                    .filter((v) => typeof v === 'string' && v.trim().length > 0);
                return parts.join('\n');
            }

            if (typeof payload === 'object') {
                const preferredKeys = [
                    'content',
                    'modelJson',
                    'answer',
                    'message',
                    'text',
                    'result',
                    'output',
                    'response',
                    'final_answer',
                    'finalResponse',
                    'data'
                ];

                for (const key of preferredKeys) {
                    if (!(key in payload)) continue;
                    const picked = this.extractConsultingText(payload[key]);
                    if (typeof picked === 'string' && picked.trim().length > 0) {
                        return picked;
                    }
                }

                try {
                    return JSON.stringify(payload, null, 2);
                } catch (e) {
                    return String(payload);
                }
            }

            return String(payload);
        },

        normalizeConsultingResponse(response) {
            if (response === null || response === undefined) return response;
            if (typeof response !== 'string') return response;

            const raw = response.trim();
            if (!raw) return '';

            // 코드펜스(JSON)로 감싸진 경우 제거
            const fencedMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
            const candidate = fencedMatch ? fencedMatch[1].trim() : raw;

            try {
                return JSON.parse(candidate);
            } catch (e1) {
                // ignore
            }

            try {
                const startIdx = candidate.indexOf('{');
                const endIdx = candidate.lastIndexOf('}');
                if (startIdx >= 0 && endIdx > startIdx) {
                    return JSON.parse(candidate.substring(startIdx, endIdx + 1));
                }
            } catch (e2) {
                // ignore
            }

            return response;
        },

        // AIGenerator에서 호출 - 생성 완료
        async onGenerationFinished(response) {
            const me = this;

            // 로딩 상태 제거
            me.messages.forEach((message) => {
                if (message.role === 'assistant') {
                    delete message.isLoading;
                }
            });

            if (me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                lastMsg.timeStamp = new Date().toISOString();
            }

            // JSON 파싱 시도
            const jsonData = me.normalizeConsultingResponse(response);

            await me.afterGenerationFinished(jsonData);

            // 컨설팅 1회 종료: 다음 사용자 메시지는 다시 에이전트에게 라우팅
            me.isConsultingMode = false;
            me.generator = null;
            me._consultingTargetRoomId = null;

            me.$nextTick(() => me.scrollToBottomSafe());
        },

        // AIGenerator에서 호출 - 에러 처리
        async onError(error) {
            const me = this;
            console.error('Generator 에러:', error);

            // 로딩 메시지 제거
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {
                me.messages.pop();
            }
            const errorMsg = me.createMessageObj(error?.message || '죄송합니다. 프로세스 설계 중 오류가 발생했습니다.', 'assistant');
            me.messages.push(errorMsg);
            await me.saveMessage(errorMsg);
        },

        // 컨설팅 응답 처리 (WorkAssistantChatPanel.afterGenerationFinished와 동일)
        async afterGenerationFinished(responseObj) {
            const me = this;
            const normalizedContent = me.extractConsultingText(responseObj);

            if (responseObj && (responseObj.answerType || responseObj.validity)) {
                if (me.messages.length > 0) {
                    const lastMessage = me.messages[me.messages.length - 1];
                    if (lastMessage.role === 'assistant' && !lastMessage.uuid) {
                        lastMessage.uuid = me.uuid();
                    }
                    lastMessage.content =
                        me.extractConsultingText(responseObj.content) ||
                        normalizedContent ||
                        '응답을 받았지만 표시할 텍스트를 찾지 못했습니다.';
                    if (!lastMessage.isLoading) {
                        await me.saveMessage(lastMessage);
                    }
                }

                if (responseObj.answerType === 'generateProcessDef') {
                    const messagesForDefinition = me.buildMessagesForDefinitionGeneration();
                    me.$store.dispatch('updateMessages', messagesForDefinition);
                    me.$router.push('/definitions/chat');
                    return;
                }
            }

            if (me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                if (!lastMsg.uuid) lastMsg.uuid = me.uuid();
                if (lastMsg.role === 'assistant' && (!lastMsg.content || lastMsg.content === '...')) {
                    lastMsg.content = normalizedContent || '응답을 받았지만 표시할 텍스트를 찾지 못했습니다.';
                }
                if (!lastMsg.isLoading) await me.saveMessage(lastMsg);
            } else {
                const fallbackMsg = me.createMessageObj(
                    normalizedContent || '응답을 받았지만 표시할 텍스트를 찾지 못했습니다.',
                    'assistant'
                );
                fallbackMsg.uuid = me.uuid();
                me.messages.push(fallbackMsg);
                await me.saveMessage(fallbackMsg);
            }
        },

        // ===== PDF2BPMN Events Watch (WorkAssistantChatPanel 이식) =====

        _getOrInitPdf2bpmnProgress(roomId) {
            if (!roomId) return null;
            if (!this.pdf2bpmnProgressByRoomId[roomId]) {
                this.pdf2bpmnProgressByRoomId[roomId] = {
                    isActive: false,
                    taskId: null,
                    status: '',
                    progress: 0,
                    message: '',
                    generatedBpmns: []
                };
            }
            return this.pdf2bpmnProgressByRoomId[roomId];
        },

        async checkExistingPdf2BpmnTask(roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;

            for (let i = me.messages.length - 1; i >= 0; i--) {
                const msg = me.messages[i];

                if (msg?.pdf2bpmnResult) {
                    return;
                }

                const toolCalls = Array.isArray(msg?.toolCalls) ? msg.toolCalls : [];
                if (toolCalls.length === 0) continue;

                const pdf2bpmnTool = toolCalls.find(
                    (t) =>
                        t?.name &&
                        (t.name.includes('create_pdf2bpmn_workitem') ||
                            t.name.includes('create_consulting_process_workitem'))
                );
                const outputStr = pdf2bpmnTool?.output;
                if (!outputStr) continue;

                try {
                    const output = me.parseToolOutput(outputStr);
                    const taskId = output?.workitem_id || output?.task_id || output?.todo_id || output?.id;
                    if (taskId) {
                        await me.checkTaskStatusAndSubscribe(taskId, targetRoomId);
                        return;
                    }
                } catch (e) {
                    // ignore
                }
            }
        },

        async checkTaskStatusAndSubscribe(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            if (!window.$supabase) return;

            try {
                const { data: completedEvent, error: eventError } = await window.$supabase
                    .from('events')
                    .select('*')
                    .eq('todo_id', taskId)
                    .eq('event_type', 'task_completed')
                    .single();

                if (completedEvent && !eventError) {
                    const resultData = typeof completedEvent.data === 'string' ? JSON.parse(completedEvent.data) : completedEvent.data;
                    await me.showCompletedTaskResult(resultData, targetRoomId, taskId);
                    return;
                }

                const { data: todo, error } = await window.$supabase.from('todolist').select('id, status').eq('id', taskId).single();

                if (error) return;

                if (todo && (todo.status === 'IN_PROGRESS' || todo.status === 'PENDING')) {
                    me.subscribeToEventsForTask(taskId, targetRoomId);
                    await me.loadExistingEvents(taskId, targetRoomId);
                }
            } catch (e) {
                // ignore
            }
        },

        async loadExistingEvents(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            if (!window.$supabase) return;

            try {
                const { data: events, error } = await window.$supabase
                    .from('events')
                    .select('*')
                    .eq('todo_id', taskId)
                    .eq('crew_type', 'pdf2bpmn')
                    .order('timestamp', { ascending: true });

                if (error) return;
                if (events && events.length > 0) {
                    for (const event of events) {
                        me.handlePdf2BpmnEvent(event, targetRoomId);
                    }
                }
            } catch (e) {
                // ignore
            }
        },

        async showCompletedTaskResult(resultData, roomId, explicitTaskId = '') {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;

            try {
                if (resultData?.saved_processes || resultData?.bpmn_xmls) {
                    let generatedBpmns = [];
                    if (resultData.saved_processes) {
                        for (const proc of resultData.saved_processes) {
                            generatedBpmns.push({
                                process_id: proc.id,
                                process_name: proc.name,
                                bpmn_xml: proc.bpmn_xml || null
                            });
                        }
                    }

                    const hasResult = me.messages.some((m) => m.pdf2bpmnResult);
                    if (!hasResult && generatedBpmns.length > 0) {
                        const processCount = resultData.process_count || generatedBpmns.length;
                        const taskId = String(explicitTaskId || me._resolvePdf2bpmnTaskId(resultData, targetRoomId) || '').trim();
                        let content = `✅ **BPMN 프로세스 생성 완료**\n\n`;
                        content += `${processCount}개의 프로세스가 생성되었습니다.`;

                        const integratedGraph =
                            resultData?.integrated_graph || resultData?.integratedGraph || null;
                        const processGraphs =
                            resultData?.process_graphs || resultData?.processGraphs || {};
                        const graphName = String(resultData?.graph_name || '').trim();

                        const msgObj = me.createMessageObj(content, 'assistant');
                        msgObj.pdf2bpmnResult = {
                            processCount,
                            savedProcesses: resultData.saved_processes || [],
                            generatedBpmns,
                            taskId,
                            savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                            savedAgents: resultData.saved_agents || resultData.savedAgents || [],
                            integratedGraph,
                            processGraphs,
                            graphName,
                            // 완료 경로 = 이미 proc_def 에 저장됨 → 참조 기반 복원 시 '저장됨' 표시.
                            __saved: true
                        };
                        me._cachePdf2bpmnGraphPayload({ taskId, integratedGraph, processGraphs, graphName });
                        if (me.currentChatRoom?.id === targetRoomId) {
                            me.messages.push(msgObj);
                            me.$nextTick(() => me.scrollToBottomSafe());
                        }
                        await me.saveMessageToRoom(msgObj, targetRoomId);
                    }
                }
            } catch (e) {
                // ignore
            }
        },

        async checkAndWatchPdf2BpmnTodo(roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            if (!window.$supabase) return;

            try {
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                // 중요: room 무관 "최신 1건" 구독은 다른 채팅방 작업을 잘못 연결할 수 있어
                // query에 roomId가 포함된 건만 제한적으로 복구한다.
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('id, query, agent_orch, start_date')
                    .eq('agent_orch', 'pdf2bpmn')
                    .gte('start_date', fiveMinAgo)
                    .ilike('query', `%${targetRoomId}%`)
                    .order('start_date', { ascending: false })
                    .limit(1);

                if (error) return;
                if (data && data.length > 0) {
                    const todo = data[0];
                    const currentTaskId = me.pdf2bpmnTaskIdByRoomId[targetRoomId];
                    if (currentTaskId !== todo.id) {
                        me.subscribeToEventsForTask(todo.id, targetRoomId);
                    }
                }
            } catch (e) {
                // ignore
            }
        },

        subscribeToEventsForTask(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            if (!window.$supabase) return;

            if (me.pdf2bpmnEventsChannelByTaskId[taskId]) {
                me.pdf2bpmnTaskIdByRoomId[targetRoomId] = taskId;
                const progress = me._getOrInitPdf2bpmnProgress(targetRoomId);
                if (progress) progress.taskId = taskId;
                return;
            }

            const prevTaskId = me.pdf2bpmnTaskIdByRoomId[targetRoomId];
            if (prevTaskId && prevTaskId !== taskId) {
                me.unsubscribePdf2bpmnEventsForTask(prevTaskId);
            }
            me.pdf2bpmnTaskIdByRoomId[targetRoomId] = taskId;

            const progress = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (progress) {
                progress.isActive = true;
                progress.taskId = taskId;
                progress.status = 'started';
                progress.progress = Math.max(progress.progress || 0, 0);
                progress.message = progress.message || 'BPMN 프로세스 생성 작업 시작 대기 중...';
                progress.generatedBpmns = progress.generatedBpmns || [];
            }

            const channel = window.$supabase
                .channel(`pdf2bpmn-events-${taskId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'events',
                        filter: `todo_id=eq.${taskId}`
                    },
                    (payload) => {
                        me.handlePdf2BpmnEvent(payload.new, targetRoomId);
                    }
                )
                .subscribe();

            me.pdf2bpmnEventsChannelByTaskId[taskId] = channel;
        },

        unsubscribePdf2bpmnEventsForTask(taskId) {
            try {
                const channel = this.pdf2bpmnEventsChannelByTaskId?.[taskId];
                if (channel && window.$supabase) {
                    window.$supabase.removeChannel(channel);
                }
            } catch (e) {
                // ignore
            } finally {
                if (this.pdf2bpmnEventsChannelByTaskId) {
                    delete this.pdf2bpmnEventsChannelByTaskId[taskId];
                }
            }
        },

        unsubscribeAllPdf2bpmnEvents() {
            try {
                const map = this.pdf2bpmnEventsChannelByTaskId || {};
                Object.keys(map).forEach((taskId) => this.unsubscribePdf2bpmnEventsForTask(taskId));
            } catch (e) {
                // ignore
            }
        },

        handlePdf2BpmnEvent(event, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            const progressState = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (!progressState) return;

            try {
                const eventType = event?.event_type;
                const crewType = event?.crew_type;
                if (crewType && crewType !== 'pdf2bpmn') return;
                const eventTaskId = String(event?.todo_id || '').trim();
                if (eventTaskId) {
                    me.pdf2bpmnTaskIdByRoomId[targetRoomId] = eventTaskId;
                    progressState.taskId = eventTaskId;
                }

                let messageData = {};
                try {
                    const dataField = event?.data || {};
                    messageData = typeof dataField === 'string' ? JSON.parse(dataField) : dataField;
                } catch (e) {
                    messageData = {};
                }

                const progress = messageData.progress || 0;
                const message = messageData.message || '';
                const isHitlWaitingText =
                    typeof message === 'string' &&
                    (message.includes('[HITL] 사용자 확인 대기 중:') || message.includes('사용자 확인 대기 중'));

                switch (eventType) {
                    case 'task_started':
                        progressState.isActive = true;
                        progressState.status = 'started';
                        progressState.progress = progress || 5;
                        progressState.message = message || 'BPMN 프로세스 생성 작업 시작됨';
                        break;
                    case 'waiting_for_user': {
                        progressState.isActive = true;
                        progressState.status = 'waiting_for_user';
                        progressState.progress = Math.max(progressState.progress, progress || 72);
                        progressState.message = '사용자 확인이 필요합니다. 아래 질문에 응답해 주세요.';
                        me.addPdf2BpmnHumanQuestionMessage(messageData, targetRoomId, eventTaskId);
                        break;
                    }
                    case 'human_feedback_submitted':
                        progressState.isActive = true;
                        progressState.status = 'processing';
                        progressState.progress = Math.max(progressState.progress, progress || 74);
                        progressState.message = message || '사용자 응답 반영 중...';
                        break;
                    case 'resumed':
                        progressState.isActive = true;
                        progressState.status = 'processing';
                        progressState.progress = Math.max(progressState.progress, progress || 75);
                        progressState.message = message || '작업 재개';
                        break;
                    case 'tool_usage_started':
                        progressState.isActive = true;
                        progressState.status = 'processing';
                        progressState.progress = Math.max(progressState.progress, progress || 10);
                        progressState.message = message || '처리 중...';
                        break;
                    case 'tool_usage_finished':
                        progressState.isActive = true;
                        progressState.progress = Math.max(progressState.progress, progress || 80);
                        progressState.message = message || '처리 완료';
                        if (messageData.bpmn_xml && messageData.process_id) {
                            const existing = progressState.generatedBpmns.find((b) => b.process_id === messageData.process_id);
                            if (!existing) {
                                progressState.generatedBpmns.push({
                                    process_id: messageData.process_id,
                                    process_name: messageData.process_name || 'Unnamed Process',
                                    bpmn_xml: messageData.bpmn_xml
                                });
                            }
                        }
                        break;
                    case 'task_completed':
                    case 'crew_completed':
                        progressState.isActive = true;
                        progressState.status = 'completed';
                        progressState.progress = 100;
                        progressState.message = message || '변환 완료!';
                        me.addPdf2BpmnResultMessage(messageData, targetRoomId, eventTaskId);
                        setTimeout(() => {
                            const st = me._getOrInitPdf2bpmnProgress(targetRoomId);
                            if (st) st.isActive = false;
                        }, 3000);
                        break;
                    case 'error': {
                        progressState.isActive = true;
                        progressState.status = 'failed';
                        progressState.message = messageData.error || message || '작업 실패';
                        const errorMsg = me.createMessageObj(`BPMN 프로세스 생성 실패: ${messageData.error || '알 수 없는 오류'}`, 'assistant');
                        if (me.currentChatRoom?.id === targetRoomId) {
                            me.messages.push(errorMsg);
                        }
                        me.saveMessageToRoom(errorMsg, targetRoomId);
                        break;
                    }
                    default:
                        if (isHitlWaitingText) {
                            progressState.isActive = true;
                            progressState.status = 'waiting_for_user';
                            progressState.progress = Math.max(progressState.progress, progress || 72);
                            progressState.message = '사용자 확인이 필요합니다. 아래 질문에 응답해 주세요.';
                            me.addPdf2BpmnHumanQuestionMessage(
                                {
                                    ...messageData,
                                    message,
                                    question: messageData?.question || {
                                        prompt: String(message || '')
                                            .replace(/^\[HITL\]\s*사용자 확인 대기 중:\s*/g, '')
                                            .trim()
                                    }
                                },
                                targetRoomId,
                                eventTaskId
                            );
                            break;
                        }
                        if (progress > 0) progressState.progress = Math.max(progressState.progress, progress);
                        if (message) progressState.message = message;
                }
            } catch (e) {
                // ignore
            }
        },

        async addPdf2BpmnHumanQuestionMessage(eventData, roomId, explicitTaskId = '') {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            const taskId = String(explicitTaskId || me._resolvePdf2bpmnTaskId(eventData, targetRoomId) || '').trim();

            const allQuestions = Array.isArray(eventData?.questions) ? eventData.questions : [];
            const isMulti = allQuestions.length > 1;
            const question =
                isMulti ? allQuestions[0] : (eventData?.question || allQuestions[0] || {});
            const questionIds = isMulti
                ? allQuestions.map((q) => String(q?.question_id || '').trim()).filter(Boolean)
                : [String(question?.question_id || `${taskId}-q`).trim()].filter(Boolean);
            const batchKey = questionIds.length
                ? `${taskId}::${questionIds.sort().join('|')}`
                : `${taskId}::single`;
            // 같은 질문(batchKey 또는 question_id)이 이미 있으면 추가하지 않는다.
            // __submitted(답변 완료) 여부와 무관하게 검사해야 한다 — 새로고침 시
            // waiting_for_user 이벤트가 재처리되어도, 이미 답변한 질문이 빈 UI 로
            // 중복 생성되지 않도록 한다.
            const hasSame = me.messages.some((m) => {
                const fb = m?.__humanFeedback;
                if (!fb) return false;
                if (batchKey && fb.__hitlBatchKey === batchKey) return true;
                if (!isMulti && questionIds[0] && fb.question_id === questionIds[0]) return true;
                return false;
            });
            if (hasSame) return;

            // 워커가 보낸 question.feedback_type 을 그대로 따름. 없으면 기존 호환 (approve_reject_with_edit).
            const fbType = question?.feedback_type || 'approve_reject_with_edit';
            // select_items 모드면 워커가 items 를 직접 실어 보낸다 (스킬 후보, DMN 옵션 등).
            const incomingItems = Array.isArray(question?.items) ? question.items : [];

            const content =
                isMulti
                    ? (eventData?.message || `${allQuestions.length}개의 질문에 한 번에 응답해 주세요.`)
                    : fbType === 'select_items'
                        ? (question?.prompt || '아래에서 선택해 주세요.')
                        : '모호한 항목이 감지되었습니다. 아래 내용을 확인하고 승인/반려 또는 보정 의견을 입력해 주세요.';
            const msgObj = me.createMessageObj(content, 'assistant');
            msgObj.__humanFeedback = {
                user_request_type: fbType,
                feedback_type: fbType,
                question: isMulti
                    ? (eventData?.message || `${allQuestions.length}개 결정이 필요합니다.`)
                    : (question?.prompt || eventData?.message || '확인이 필요합니다.'),
                context: question?.context || '아래 내용을 확인한 후 응답해 주세요.',
                suggestions: Array.isArray(question?.choices) ? question.choices : (
                    Array.isArray(question?.suggestions) ? question.suggestions : []
                ),
                items: incomingItems,
                allow_multiple: !!question?.allow_multiple,
                min_select: typeof question?.min_select === 'number' ? question.min_select : (fbType === 'select_items' ? 0 : 1),
                allow_other: !!question?.allow_other,
                allow_skip: !!question?.allow_skip,
                // multi 모드: questions 배열 전체를 그대로 보존 → Chat.vue 가 v-for 로 렌더
                questions: isMulti ? allQuestions : null,
                question_id: questionIds[0] || `${taskId}-q`,
                __hitlBatchKey: batchKey,
                target_type: question?.target_type || '',
                target_id: question?.target_id || '',
                evidence_spans: Array.isArray(question?.evidence_spans) ? question.evidence_spans : [],
                impact_preview: Array.isArray(question?.impact_preview) ? question.impact_preview : [],
                task_id: taskId,
                option_meta: question?.option_meta && typeof question.option_meta === 'object'
                    ? question.option_meta
                    : null,
                __submitted: false,
                __submittedText: '',
                // multi 응답 보존용 — 선택 즉시 채움, DB 저장은 최종 제출만
                __responses: isMulti ? allQuestions.map(() => null) : null
            };

            if (me.currentChatRoom?.id === targetRoomId) {
                me.messages.push(msgObj);
                me.$nextTick(() => me.scrollToBottomSafe());
            }
            await me.saveMessageToRoom(msgObj, targetRoomId);
        },

        async addPdf2BpmnResultMessage(resultData, roomId, explicitTaskId = '') {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            const progressState = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (!progressState) return;

            const processCount = resultData.process_count || progressState.generatedBpmns.length;
            const savedProcesses = resultData.saved_processes || [];
            const taskId = String(explicitTaskId || me._resolvePdf2bpmnTaskId(resultData, targetRoomId) || '').trim();

            let content = `✅ **BPMN 프로세스 생성 완료**\n\n`;
            content += `${processCount}개의 프로세스가 생성되었습니다.\n\n`;
            content += `\n프로세스 정의가 저장되었습니다. 왼쪽 메뉴에서 확인할 수 있습니다.`;

            // 워커가 결과 이벤트에 함께 실어준 그래프 미리보기 payload.
            //  - ScaledJob 환경에서는 워커 종료 후 AGE 그래프가 drop 되므로,
            //    프론트는 외부 API 호출 없이 이 데이터를 그대로 렌더링한다.
            //  - integrated_graph: { elements, counts } (todo 단위 통합 그래프)
            //  - process_graphs: { neo4j_proc_id: { elements, counts } } (프로세스별)
            const integratedGraph =
                resultData?.integrated_graph || resultData?.integratedGraph || null;
            const processGraphs =
                resultData?.process_graphs || resultData?.processGraphs || {};
            const graphName = String(resultData?.graph_name || '').trim();

            const msgObj = me.createMessageObj(content, 'assistant');
            msgObj.pdf2bpmnResult = {
                processCount,
                savedProcesses,
                generatedBpmns: progressState.generatedBpmns,
                taskId,
                savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                savedAgents: resultData.saved_agents || resultData.savedAgents || [],
                integratedGraph,
                processGraphs,
                graphName,
                // 완료 경로 = 이미 proc_def 에 저장됨 → 참조 기반 복원 시 '저장됨' 표시.
                __saved: true
            };

            // 동일 todo/프로세스 캐시(이 페이지 내) — 다른 메시지에서도 즉시 재사용
            me._cachePdf2bpmnGraphPayload({ taskId, integratedGraph, processGraphs, graphName });

            if (me.currentChatRoom?.id === targetRoomId) {
                // 중복 결과 메시지 방지
                const hasResult = me.messages.some((m) => m.pdf2bpmnResult);
                if (!hasResult) {
                    me.messages.push(msgObj);
                    me.$nextTick(() => me.scrollToBottomSafe());
                }
            }
            await me.saveMessageToRoom(msgObj, targetRoomId);
            me.EventBus.emit('definitions-updated');
        },

        checkAndSubscribePdf2Bpmn(responseText, toolCalls, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return false;

            // 1) toolCalls에서 create_pdf2bpmn_workitem 찾기
            if (toolCalls && toolCalls.length > 0) {
                const pdf2bpmnTool = toolCalls.find(
                    (t) =>
                        t?.name &&
                        (t.name.includes('create_pdf2bpmn_workitem') ||
                            t.name.includes('create_consulting_process_workitem') ||
                            t.name.includes('pdf2bpmn'))
                );
                if (pdf2bpmnTool) {
                    const outputStr = pdf2bpmnTool.output || pdf2bpmnTool.result || pdf2bpmnTool.content;
                    if (outputStr) {
                        try {
                            const output = me.parseToolOutput(outputStr);
                            const taskId = output?.workitem_id || output?.task_id || output?.todo_id || output?.id;
                            if (taskId) {
                                me.subscribeToEventsForTask(taskId, targetRoomId);
                                return true;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            }

            // 2) 응답 텍스트에서 taskId 탐색
            if (responseText) {
                const patterns = [
                    /workitem_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /task_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /todo_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /"id"\s*:\s*"([a-f0-9-]{36})"/i,
                    /워크아이템.*?([a-f0-9-]{36})/i,
                    /PDF2BPMN.*?([a-f0-9-]{36})/i
                ];
                for (const pattern of patterns) {
                    const match = responseText.match(pattern);
                    if (match) {
                        me.subscribeToEventsForTask(match[1], targetRoomId);
                        return true;
                    }
                }
            }

            // 3) 키워드가 있으면 todolist에서 최근 작업 확인
            if (
                responseText &&
                (responseText.includes('PDF') ||
                    responseText.includes('pdf2bpmn') ||
                    responseText.includes('BPMN') ||
                    responseText.includes('워크아이템') ||
                    responseText.includes('변환'))
            ) {
                setTimeout(() => me.checkAndWatchPdf2BpmnTodo(targetRoomId), 1000);
            }

            return false;
        },

        // ===== 프리뷰 UI =====

        async showBpmnPreview(bpmn) {
            const me = this;
            if (!bpmn) return;

            // Always open preview in BPMN(diagram) mode
            me.bpmnViewMode = 'diagram';

            // 저장 전(__unsaved): DB 에 아직 없으므로 조회하지 않고, 생성된 계약 definition 을
            // createBpmnXml(=_buildBpmnXmlFromDefinition) 로 즉석 변환해 미리보기만 한다.
            // 변환 XML 은 어디에도 저장하지 않는다(저장은 사용자가 '저장' 버튼 클릭 시).
            if (bpmn.__unsaved) {
                let xml = String(bpmn.bpmn_xml || '').trim();
                if (!xml && bpmn.definition) xml = this._buildBpmnXmlFromDefinition(bpmn.definition);
                me.selectedBpmn = { ...bpmn, bpmn_xml: xml, updatedAt: Date.now() };
                me.neo4jGraphLoading = false;
                me.neo4jGraphError = '';
                me.neo4jGraphElements = [];
                me.bpmnPreviewDialog = true;
                return;
            }

            // process_id가 있으면 모델러와 동일한 backend 경로로 최신본 조회
            if (bpmn.process_id) {
                try {
                    let rawBpmn = await backend.getRawDefinition(bpmn.process_id, { type: 'bpmn' });
                    let rawDefinition = await backend.getRawDefinition(bpmn.process_id);

                    if (rawDefinition?.definition) {
                        bpmn.definition = rawDefinition.definition;
                        if (!bpmn.process_name) {
                            bpmn.process_name = rawDefinition.name || rawDefinition.definition?.processDefinitionName || bpmn.process_id;
                        }
                    }

                    if (rawBpmn) {
                        bpmn.bpmn_xml = rawBpmn;
                    } else if (rawDefinition?.definition) {
                        // raw BPMN이 비어 있으면 definition에서 XML만 복구 생성 (원본 definition은 보존)
                        const originalDefinitionForPersist = JSON.parse(JSON.stringify(rawDefinition.definition));
                        let definitionForXml = JSON.parse(JSON.stringify(rawDefinition.definition));
                        const hasElements = Array.isArray(definitionForXml?.elements) && definitionForXml.elements.length > 0;
                        if (!hasElements && isLegacyProcessDefinition(definitionForXml)) {
                            definitionForXml = convertLegacyProcessDefinitionToElements(definitionForXml);
                        }
                        bpmn.definition = originalDefinitionForPersist;

                        const rebuiltXml = this._buildBpmnXmlFromDefinition(definitionForXml);
                        if (String(rebuiltXml || '').trim()) {
                            bpmn.bpmn_xml = rebuiltXml;
                            try {
                                await backend.putRawDefinition(rebuiltXml, bpmn.process_id, {
                                    name:
                                        rawDefinition?.name ||
                                        originalDefinitionForPersist?.processDefinitionName ||
                                        bpmn.process_name ||
                                        bpmn.process_id,
                                    // XML만 저장하고 definition 원문은 그대로 유지
                                    definition: originalDefinitionForPersist
                                });
                            } catch (persistError) {
                                console.warn('[ProcessPreview] rebuilt BPMN persisted failed:', persistError);
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }

            me.selectedBpmn = {
                ...bpmn,
                updatedAt: Date.now()
            };
            me.neo4jGraphLoading = false;
            me.neo4jGraphError = '';
            me.neo4jGraphElements = [];
            me.bpmnPreviewDialog = true;
        },
        _resolvePdf2bpmnTaskId(resultData, roomId) {
            const fromResult = String(
                resultData?.task_id || resultData?.taskId || resultData?.todo_id || resultData?.todoId || resultData?.id || ''
            ).trim();
            if (fromResult) return fromResult;

            const fromProgress = String(this.pdf2bpmnProgressByRoomId?.[roomId]?.taskId || '').trim();
            if (fromProgress) return fromProgress;

            const fromRoomMap = String(this.pdf2bpmnTaskIdByRoomId?.[roomId] || '').trim();
            if (fromRoomMap) return fromRoomMap;

            return '';
        },
        _getCurrentTenantId() {
            try {
                return String(window?.$tenantName || localStorage.getItem('tenantId') || '').trim();
            } catch (e) {
                return '';
            }
        },

        /**
         * 워커가 처리 종료 직전 전달한 그래프 payload 를 캐시에 저장한다.
         *  - taskId(=todo id) 단위로 보관: 동일 todo 의 모든 프로세스가 한 그래프를 공유.
         *  - 메시지 자체에도 같은 payload 가 pdf2bpmnResult 안에 박혀 영속되므로,
         *    이 캐시는 페이지 내 즉시 사용을 위한 보조 저장소다.
         */
        _cachePdf2bpmnGraphPayload({ taskId, integratedGraph, processGraphs, graphName }) {
            const key = String(taskId || '').trim();
            if (!key) return;
            const prev = (this.pdf2bpmnGraphCache && this.pdf2bpmnGraphCache[key]) || {};
            const merged = {
                integratedGraph: integratedGraph || prev.integratedGraph || null,
                processGraphs: { ...(prev.processGraphs || {}), ...(processGraphs || {}) },
                graphName: (graphName || prev.graphName || '').trim()
            };
            if (!this.pdf2bpmnGraphCache) this.pdf2bpmnGraphCache = {};
            this.pdf2bpmnGraphCache = { ...this.pdf2bpmnGraphCache, [key]: merged };
        },

        /**
         * 캐시 또는 채팅 메시지(pdf2bpmnResult)에서 taskId 매칭되는 그래프 payload 를 찾아 반환.
         * 페이지 새로고침 후에도 메시지가 재로드되면 메시지에서 복원 가능하다.
         */
        _lookupPdf2bpmnGraphFromCache(taskId) {
            const key = String(taskId || '').trim();
            if (!key) return null;
            const cached = this.pdf2bpmnGraphCache && this.pdf2bpmnGraphCache[key];
            if (cached && (cached.integratedGraph || Object.keys(cached.processGraphs || {}).length)) {
                return cached;
            }
            try {
                const matchedMsg = (this.messages || []).find((m) => {
                    const r = m && m.pdf2bpmnResult;
                    if (!r) return false;
                    if (!r.taskId) return false;
                    if (String(r.taskId).trim() !== key) return false;
                    return r.integratedGraph || (r.processGraphs && Object.keys(r.processGraphs).length);
                });
                if (matchedMsg) {
                    const r = matchedMsg.pdf2bpmnResult;
                    const fromMsg = {
                        integratedGraph: r.integratedGraph || null,
                        processGraphs: r.processGraphs || {},
                        graphName: String(r.graphName || '').trim()
                    };
                    // 다음 호출부터는 캐시 hit
                    this._cachePdf2bpmnGraphPayload({ taskId: key, ...fromMsg });
                    return fromMsg;
                }
            } catch (e) {
                // ignore
            }
            return null;
        },

        async showIntegratedGraphByTask(taskId) {
            const me = this;
            const resolvedTaskId = String(taskId || '').trim();
            if (!resolvedTaskId) return;

            const tenantId = me._getCurrentTenantId();

            me.selectedBpmn = {
                process_name: 'BPMN 통합 그래프',
                isIntegratedGraph: true,
                task_id: resolvedTaskId,
                tenant_id: tenantId
            };
            me.bpmnViewMode = 'ontology';
            me.neo4jGraphLoading = true;
            me.neo4jGraphError = '';
            me.neo4jGraphElements = [];
            me.bpmnPreviewDialog = true;

            // 1) 워커가 처리 종료 직전에 메시지로 함께 전달한 payload 우선 사용
            //    (ScaledJob 환경에서는 외부 API 가 없으므로 이 데이터가 정상 경로)
            try {
                const cached = me._lookupPdf2bpmnGraphFromCache(resolvedTaskId);
                const elementsFromCache = cached?.integratedGraph?.elements;
                if (Array.isArray(elementsFromCache) && elementsFromCache.length > 0) {
                    me.neo4jGraphElements = elementsFromCache;
                    if (cached.graphName && me.selectedBpmn) {
                        me.selectedBpmn.graph_name = cached.graphName;
                    }
                    me.neo4jGraphLoading = false;
                    return;
                }
            } catch (e) {
                // 캐시 lookup 실패는 무시하고 외부 API fallback 으로 진행
            }

            try {
                const base = await me._resolvePdf2BpmnApiBase();
                // tenant_id + task_id 를 함께 전달하여 백엔드가 정확한
                // `g_<tenant>_<task_id>` 그래프를 짚을 수 있도록 한다.
                const params = new URLSearchParams();
                if (tenantId) params.set('tenant_id', tenantId);
                const qs = params.toString();
                const url = `${base}/graph/requests/${encodeURIComponent(resolvedTaskId)}${qs ? `?${qs}` : ''}`;
                const res = await fetch(url, { method: 'GET' });
                if (!res.ok) throw new Error(`status=${res.status}`);

                const ct = String(res.headers.get('content-type') || '').toLowerCase();
                if (!ct.includes('application/json')) {
                    const text = await res.text().catch(() => '');
                    const head = String(text || '')
                        .slice(0, 120)
                        .replace(/\s+/g, ' ');
                    throw new Error(`non-json response (content-type=${ct || 'unknown'}): ${head}`);
                }

                const data = await res.json();
                const elements = Array.isArray(data?.elements)
                    ? data.elements
                    : Array.isArray(data?.data?.elements)
                    ? data.data.elements
                    : Array.isArray(data?.graph?.elements)
                    ? data.graph.elements
                    : [];

                me.neo4jGraphElements = elements;
                if (data?.graph_name && me.selectedBpmn) {
                    me.selectedBpmn.graph_name = data.graph_name;
                }
                if (elements.length === 0) {
                    me.neo4jGraphError = '통합 그래프 데이터가 비어있습니다.';
                }
            } catch (e) {
                me.neo4jGraphError = `통합 그래프 조회 실패: ${e?.message || e}`;
            } finally {
                me.neo4jGraphLoading = false;
            }
        },

        _getPdf2BpmnApiBase() {
            const fromEnv = (import.meta.env.VITE_PDF2BPMN_API_BASE_URL || '').trim();
            return (fromEnv || 'http://localhost:8012/api').replace(/\/+$/, '');
        },

        async _resolvePdf2BpmnApiBase() {
            // 캐시
            if (this.pdf2bpmnApiBaseResolved) return this.pdf2bpmnApiBaseResolved;

            const candidates = [];

            // 1) env override
            const envBase = (import.meta.env.VITE_PDF2BPMN_API_BASE_URL || '').trim();
            if (envBase) candidates.push(envBase.replace(/\/+$/, ''));

            // 2) 로컬/compose 기본 포트들 (우선 순위 높게)
            candidates.push('http://localhost:8012/api');
            candidates.push('http://127.0.0.1:8012/api');
            candidates.push('http://localhost:8001/api');
            candidates.push('http://127.0.0.1:8001/api');
            // (방어) 일부 환경에서 run_server가 8000으로 떠 있을 수 있음
            candidates.push('http://localhost:8000/api');
            candidates.push('http://127.0.0.1:8000/api');

            // 3) nginx 경유(같은 origin) - dev 서버에서는 index.html이 나올 수 있어 뒤로 미룸
            try {
                const origin = String(window?.location?.origin || '').replace(/\/+$/, '');
                if (origin) {
                    candidates.push(`${origin}/bpmn-extractor/api`);
                }
            } catch (e) {
                // ignore
            }

            const unique = Array.from(new Set(candidates.map((x) => String(x || '').trim()).filter(Boolean)));

            const tryHealth = async (base) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 1500);
                try {
                    const url = `${base.replace(/\/+$/, '')}/health`;
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) return false;

                    // IMPORTANT: dev 서버/프록시가 index.html을 200으로 줄 수 있어 JSON 여부까지 확인
                    const ct = String(res.headers.get('content-type') || '').toLowerCase();
                    if (!ct.includes('application/json')) return false;
                    const data = await res.json().catch(() => null);
                    return !!data && data.status === 'ok';
                } catch (e) {
                    return false;
                } finally {
                    clearTimeout(timer);
                }
            };

            for (const base of unique) {
                // eslint-disable-next-line no-await-in-loop
                const ok = await tryHealth(base);
                if (ok) {
                    this.pdf2bpmnApiBaseResolved = base.replace(/\/+$/, '');
                    return this.pdf2bpmnApiBaseResolved;
                }
            }

            // fallback: 그래도 못 찾으면 기존 기본값 반환(에러 메시지에 후보 목록 표시)
            return this._getPdf2BpmnApiBase();
        },

        _getNeo4jProcIdFromDefinition(definition) {
            const def = definition && typeof definition === 'object' ? definition : null;
            const ex = def && def.extraction && typeof def.extraction === 'object' ? def.extraction : null;
            return (ex && String(ex.neo4j_proc_id || '').trim()) || '';
        },

        _getNeo4jGraphScopeFromDefinition(definition) {
            // 한 todo 의 모든 프로세스는 `g_<tenant>_<task_id>` 그래프 하나에 누적된다.
            // pdf2bpmn 워커가 definition.extraction 에 graph_name / tenant_id / task_id
            // 를 함께 저장하므로, 그 값을 그대로 백엔드에 전달하면 가장 정확하게 그래프를 짚을 수 있다.
            const def = definition && typeof definition === 'object' ? definition : null;
            const ex = def && def.extraction && typeof def.extraction === 'object' ? def.extraction : null;
            const fallbackTenantId = this._getCurrentTenantId();
            return {
                graph_name: (ex && String(ex.neo4j_graph_name || '').trim()) || '',
                tenant_id: (ex && String(ex.tenant_id || '').trim()) || fallbackTenantId || '',
                task_id:
                    (ex && String(ex.task_id || ex.todo_id || '').trim()) ||
                    String(this.selectedBpmn?.task_id || '').trim() ||
                    ''
            };
        },

        async ensureNeo4jGraphLoaded() {
            const me = this;
            if (!me.selectedBpmn) return;
            if (me.neo4jGraphLoading) return;
            if (Array.isArray(me.neo4jGraphElements) && me.neo4jGraphElements.length > 0) return;

            const neo4jProcId = me._getNeo4jProcIdFromDefinition(me.selectedBpmn?.definition);
            if (!neo4jProcId) {
                me.neo4jGraphError =
                    '이 프로세스에 연결된 Neo4j proc_id(extraction.neo4j_proc_id)를 찾을 수 없습니다. (pdf2bpmn 최신 버전으로 생성된 프로세스인지 확인해주세요)';
                return;
            }

            // 1) 워커가 메시지로 함께 보낸 process_graphs[proc_id] 캐시 우선 사용
            try {
                const scope = me._getNeo4jGraphScopeFromDefinition(me.selectedBpmn?.definition);
                const taskIdForCache = String(scope.task_id || '').trim();
                if (taskIdForCache) {
                    const cached = me._lookupPdf2bpmnGraphFromCache(taskIdForCache);
                    const procGraph = cached && cached.processGraphs && cached.processGraphs[neo4jProcId];
                    const elementsFromCache = procGraph && procGraph.elements;
                    if (Array.isArray(elementsFromCache) && elementsFromCache.length > 0) {
                        me.neo4jGraphElements = elementsFromCache;
                        if (cached.graphName && me.selectedBpmn) {
                            me.selectedBpmn.graph_name = cached.graphName;
                        }
                        return;
                    }
                }
            } catch (e) {
                // 캐시 조회 실패는 무시하고 API fallback 으로 진행
            }

            me.neo4jGraphLoading = true;
            me.neo4jGraphError = '';

            try {
                const base = await me._resolvePdf2BpmnApiBase();
                const scope = me._getNeo4jGraphScopeFromDefinition(me.selectedBpmn?.definition);
                const params = new URLSearchParams();
                // 우선순위: graph_name (가장 정확) -> tenant_id + task_id (재구성 가능)
                if (scope.graph_name) params.set('graph_name', scope.graph_name);
                if (scope.tenant_id) params.set('tenant_id', scope.tenant_id);
                if (scope.task_id) params.set('task_id', scope.task_id);
                const qs = params.toString();
                const url = `${base}/processes/${encodeURIComponent(neo4jProcId)}/graph${qs ? `?${qs}` : ''}`;
                const res = await fetch(url, { method: 'GET' });
                if (!res.ok) throw new Error(`status=${res.status}`);
                const ct = String(res.headers.get('content-type') || '').toLowerCase();
                if (!ct.includes('application/json')) {
                    const text = await res.text().catch(() => '');
                    const head = String(text || '')
                        .slice(0, 120)
                        .replace(/\s+/g, ' ');
                    throw new Error(`non-json response (content-type=${ct || 'unknown'}): ${head}`);
                }
                const data = await res.json();
                me.neo4jGraphElements = Array.isArray(data?.elements) ? data.elements : [];
                if (me.neo4jGraphElements.length === 0) {
                    me.neo4jGraphError = 'Neo4j 그래프 데이터가 비어있습니다.';
                }
            } catch (e) {
                const hint = [
                    'bpmn-extractor(API)가 실행 중인지 확인해주세요.',
                    '- Docker Compose: `docker compose up -d bpmn-extractor` (또는 전체 스택 up)',
                    '- 또는 로컬: PDF2BPMN API를 실행(예: pdf2bpmn 저장소에서 `uv run python run.py api`)',
                    '- 필요 시 프론트 `.env`에 `VITE_PDF2BPMN_API_BASE_URL` 설정',
                    '  - 현재 원프로세스 실행이라면: `VITE_PDF2BPMN_API_BASE_URL=http://localhost:8012/api` 권장'
                ].join('\n');
                me.neo4jGraphError = `Neo4j 그래프 조회 실패: ${e?.message || e}\n\n${hint}`;
            } finally {
                me.neo4jGraphLoading = false;
            }
        },

        openImagePreview(imageUrl) {
            if (!imageUrl) return;
            this.previewImageUrl = imageUrl;
            this.imagePreviewDialog = true;
        },

        openExternalUrl(url) {
            if (!url) return;
            try {
                window.open(url, '_blank');
            } catch (e) {}
        },

        openInModeler() {
            if (this.selectedBpmn?.process_id) {
                const modelerUrl = `${window.location.origin}/definitions/${this.selectedBpmn.process_id}?edit=true`;
                window.open(modelerUrl, '_blank');
                this.bpmnPreviewDialog = false;
            }
        },

        async copyBpmnToClipboard() {
            try {
                if (!this.selectedBpmn?.bpmn_xml) return;
                await navigator.clipboard.writeText(this.selectedBpmn.bpmn_xml);
            } catch (e) {}
        },

        // ===== Abort/Stop =====

        abortAllAgentStreams() {
            try {
                const map = this.agentAbortControllers || {};
                Object.keys(map).forEach((k) => {
                    try {
                        map[k]?.abort?.();
                    } catch (e) {}
                });
            } catch (e) {}
            this.agentAbortControllers = {};
        },

        stopAgentsInRoom(roomId) {
            const rid = roomId || this.currentChatRoom?.id || this.roomId;
            if (!rid) return;
            const map = this.agentAbortControllers || {};
            Object.keys(map).forEach((k) => {
                if (k.startsWith(`${rid}:`)) {
                    try {
                        map[k]?.abort?.();
                    } catch (e) {}
                    delete map[k];
                }
            });
        },

        extractDisplayAssistantContent(rawContent) {
            const text = (rawContent ?? '').toString().trim();
            if (!text) return '';

            const parseCandidate = (candidate) => {
                if (!candidate) return null;
                try {
                    return JSON.parse(candidate);
                } catch (e) {
                    return null;
                }
            };

            // 코드펜스(JSON) 제거 후 파싱 시도
            const fencedMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
            const candidate = fencedMatch ? fencedMatch[1].trim() : text;

            let parsed = parseCandidate(candidate);
            if (!parsed) {
                // JSON 문자열 앞뒤에 문장이 섞여있는 경우를 대비해 첫/마지막 중괄호 범위를 재시도
                const startIdx = candidate.indexOf('{');
                const endIdx = candidate.lastIndexOf('}');
                if (startIdx >= 0 && endIdx > startIdx) {
                    parsed = parseCandidate(candidate.substring(startIdx, endIdx + 1));
                }
            }

            if (parsed && typeof parsed === 'object') {
                const requestType = (parsed.user_request_type || '').toString();
                const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
                if (requestType === 'ask_user' && question) {
                    return question;
                }
                if (parsed.waiting_for_user_input === true && question) {
                    return question;
                }
                if (parsed.message) {
                    return parsed.message.trim();
                }
            }

            return text;
        },

        /** DB/실시간 row의 snake·레거시 키 → 화면용 openuiLang / runState */
        hydrateMessageOpenUiFromDb(message) {
            if (!message || typeof message !== 'object') return message;
            if (message.openuiLang == null && typeof message.openui_lang === 'string') {
                message.openuiLang = message.openui_lang;
            }
            const rs = message.runState ?? message.run_state ?? message.openuiRunState;
            if (rs != null && typeof rs === 'object') {
                message.runState = rs;
            }
            return message;
        },
        getMessageRunStateForOpenUi(m) {
            if (!m || typeof m !== 'object') return null;
            const rs = m.runState ?? m.run_state ?? m.openuiRunState;
            return rs != null && typeof rs === 'object' ? rs : null;
        },

        normalizeAssistantMessageForDisplay(message) {
            if (!message || typeof message !== 'object') return message;
            this.hydrateMessageOpenUiFromDb(message);
            const role = (message.role || '').toString();
            const content = message.content;
            if (role !== 'assistant' || typeof content !== 'string') return message;
            const normalized = this.extractDisplayAssistantContent(content);
            if (normalized !== content) {
                message.content = normalized;
                if (!message.contentType) {
                    message.contentType = 'text';
                }
            }
            return message;
        },

        /**
         * Optimistic(임시) assistant 메시지가 realtime INSERT 로 교체될 때,
         * DB 에 저장되지 않는 프런트엔드 전용 상태를 incoming 메시지로 이관한다.
         * - __humanFeedback: HITL 패널(pdf2bpmn 강도 선택 등) 렌더에 필수
         * - toolCalls: 메시지 버블 안의 툴 호출 표시
         * - processPreview / pdf2bpmnResult: 우측 패널/임베드 BPMN 미리보기
         * - runState / openui*: OpenUI 스트리밍 상태
         * - agentLogs / agentPlan: 사이드 패널 로그/계획
         * 이관은 incoming 에 동일 키가 비어있을 때만 수행한다(서버 값을 덮어쓰지 않음).
         */
        /**
         * 배열 내 timeStamp 가 비어있는(legacy) 메시지에 합리적인 타임스탬프를 채워 넣는다.
         *
         * 배경:
         *   chats 테이블에는 created_at 컬럼이 없고, 정렬은 messages JSONB 의 timeStamp 키로 한다.
         *   과거 SDK 가 timeStamp 를 넣지 않은 채 chats.messages 를 INSERT 한 메시지가 섞여있으면
         *   ORDER BY messages->>timeStamp DESC NULLS FIRST 결과 → reverse 시 NULL 메시지가 모두
         *   배열 끝으로 밀려나 시간 흐름이 깨진다.
         *
         * 동작:
         *   - timeStamp 가 없는 항목은 (이전 timeStamped, 다음 timeStamped) 사이의 중간값으로 보간.
         *   - 한쪽만 있으면 ±1ms 만큼 비껴 배치.
         *   - 양쪽 모두 없으면 현재 시각으로 채움.
         *   - 원본 객체에 __synthTimeStamp = true 를 표시해, 디버깅 / 차후 백필에 활용 가능.
         */
        _backfillMissingTimeStamps(list) {
            if (!Array.isArray(list) || list.length === 0) return;
            const tsOf = (m) => {
                if (!m) return NaN;
                const v = m.timeStamp;
                if (!v) return NaN;
                const t = new Date(v).getTime();
                return Number.isFinite(t) ? t : NaN;
            };
            for (let i = 0; i < list.length; i++) {
                if (Number.isFinite(tsOf(list[i]))) continue;
                let prev = NaN;
                let next = NaN;
                for (let j = i - 1; j >= 0; j--) {
                    const t = tsOf(list[j]);
                    if (Number.isFinite(t)) { prev = t; break; }
                }
                for (let j = i + 1; j < list.length; j++) {
                    const t = tsOf(list[j]);
                    if (Number.isFinite(t)) { next = t; break; }
                }
                let synth;
                if (Number.isFinite(prev) && Number.isFinite(next)) {
                    synth = Math.floor((prev + next) / 2);
                } else if (Number.isFinite(prev)) {
                    synth = prev + 1;
                } else if (Number.isFinite(next)) {
                    synth = next - 1;
                } else {
                    synth = Date.now();
                }
                try {
                    list[i].timeStamp = new Date(synth).toISOString();
                    list[i].__synthTimeStamp = true;
                } catch (_) {
                    // ignore - keep as is
                }
            }
        },

        /**
         * 메시지 배열을 (timeStamp asc, rowUuid asc) 기준으로 안정 정렬한다.
         * NaN 타임스탬프는 Infinity 로 처리해 항상 뒤로 보낸다.
         */
        _stableSortMessages(list) {
            if (!Array.isArray(list) || list.length <= 1) return;
            const tsNum = (m) => {
                if (!m) return Number.POSITIVE_INFINITY;
                const t = new Date(m.timeStamp || 0).getTime();
                return Number.isFinite(t) && t > 0 ? t : Number.POSITIVE_INFINITY;
            };
            list.sort((a, b) => {
                const ta = tsNum(a);
                const tb = tsNum(b);
                if (ta !== tb) return ta - tb;
                const ua = String(a?.rowUuid || a?.uuid || '');
                const ub = String(b?.rowUuid || b?.uuid || '');
                if (ua < ub) return -1;
                if (ua > ub) return 1;
                return 0;
            });
        },

        carryOptimisticOnlyFields(fromMsg, toMsg) {
            if (!fromMsg || !toMsg || typeof fromMsg !== 'object' || typeof toMsg !== 'object') return toMsg;
            const carryKeys = [
                '__humanFeedback',
                'toolCalls',
                'processPreview',
                'pdf2bpmnResult',
                'workspaceFiles',
                'runState',
                'openuiLang',
                'openuiIsStreaming',
                'openuiStreamQuestionId',
                'agentLogs',
                'agentPlan'
            ];
            for (const key of carryKeys) {
                const incomingVal = toMsg[key];
                const hasIncoming =
                    incomingVal !== undefined &&
                    incomingVal !== null &&
                    !(Array.isArray(incomingVal) && incomingVal.length === 0);
                if (!hasIncoming && fromMsg[key] !== undefined && fromMsg[key] !== null) {
                    toMsg[key] = fromMsg[key];
                }
            }
            return toMsg;
        },

        /**
         * assistant 메시지에 붙어 있는 프런트엔드 전용 상태(__humanFeedback / toolCalls /
         * pdf2bpmnResult / processPreview / runState / openui* / agentLogs / agentPlan)를
         * chats.messages jsonb 에 영속화한다. 새로고침 후에도 HITL 패널·진행상황 UI·
         * BPMN 미리보기 같은 ephemeral 상태가 채팅방별로 그대로 살아남게 하기 위함.
         *
         * SDK(persist_chat_to_db) 는 `content` + 기본 actor 정보만 INSERT 하므로,
         * realtime INSERT 가 도착해 optimistic 메시지가 교체되는 시점에
         * carryOptimisticOnlyFields 로 위 필드들을 옮긴 뒤 이 함수로 같은 row 를 UPDATE 한다.
         *
         * 멱등성: 저장된 필드 시그니처(__feStateKey) 가 동일하면 재저장하지 않는다.
         * (우리가 만든 UPDATE 가 다시 realtime 이벤트로 돌아왔을 때 무한루프 방지)
         */
        async persistMessageFrontendState(msg, roomId) {
            try {
                if (!msg || typeof msg !== 'object') return;
                const hasFeedback = !!msg.__humanFeedback;
                const toolCallsArr = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
                const hasToolCalls = toolCallsArr.length > 0;
                const hasPdf2bpmnResult = !!msg.pdf2bpmnResult;
                const hasProcessPreview = !!msg.processPreview;
                const wsFilesArr = Array.isArray(msg.workspaceFiles) ? msg.workspaceFiles : [];
                const hasWorkspaceFiles = wsFilesArr.length > 0;
                const hasRunState = !!msg.runState && typeof msg.runState === 'object';
                const hasOpenuiLang = typeof msg.openuiLang === 'string' && msg.openuiLang.length > 0;
                const hasAgentLogs = Array.isArray(msg.agentLogs) && msg.agentLogs.length > 0;
                const hasAgentPlan = !!msg.agentPlan;
                if (
                    !hasFeedback &&
                    !hasToolCalls &&
                    !hasPdf2bpmnResult &&
                    !hasProcessPreview &&
                    !hasWorkspaceFiles &&
                    !hasRunState &&
                    !hasOpenuiLang &&
                    !hasAgentLogs &&
                    !hasAgentPlan
                ) {
                    return;
                }
                const targetRoomId = (roomId || this.currentChatRoom?.id || this.roomId || '').toString();
                const msgUuid = (msg.rowUuid || msg.uuid || '').toString();
                if (!targetRoomId || !msgUuid) return;
                const stateKey = JSON.stringify({
                    f: hasFeedback ? 1 : 0,
                    tc: hasToolCalls ? toolCallsArr.length : 0,
                    pr: hasPdf2bpmnResult ? 1 : 0,
                    pp: hasProcessPreview ? 1 : 0,
                    wf: hasWorkspaceFiles ? wsFilesArr.length : 0,
                    rs: hasRunState ? 1 : 0,
                    ol: hasOpenuiLang ? (msg.openuiLang.length || 0) : 0,
                    al: hasAgentLogs ? msg.agentLogs.length : 0,
                    ap: hasAgentPlan ? 1 : 0
                });
                if (msg.__feStateKey === stateKey) return;
                msg.__feStateKey = stateKey;
                if (hasFeedback) {
                    msg.__humanFeedbackPersisted = true;
                }
                const messagesToSave = { ...msg };
                delete messagesToSave.rowUuid;
                delete messagesToSave.isOptimistic;
                delete messagesToSave.isLoading;
                // 내부 멱등성 플래그는 DB jsonb 에 박힐 필요 없음
                delete messagesToSave.__feStateKey;
                delete messagesToSave.__humanFeedbackPersisted;
                await backend.putObject(`db://chats/${msgUuid}`, {
                    uuid: msgUuid,
                    id: targetRoomId,
                    messages: messagesToSave
                });
            } catch (e) {
                console.warn('[FrontendState] persistMessageFrontendState 실패:', e);
            }
        },

        /**
         * 하위 호환 alias. 기존 호출부와의 의미를 보존하기 위해 남겨둔다.
         * 내부적으로는 일반 영속화 헬퍼를 호출한다.
         */
        async persistMessageHumanFeedback(msg, roomId) {
            return this.persistMessageFrontendState(msg, roomId);
        },

        // MCP 도구 output 파싱 (WorkAssistantChatPanel의 구현을 동일하게 사용)
        parseToolOutput(outputStr) {
            if (!outputStr) return null;
            if (typeof outputStr === 'object') return outputStr;

            const sanitizeForJsonParse = (s) => {
                if (typeof s !== 'string') return s;
                let out = '';
                let inString = false;
                let escaped = false;

                for (let i = 0; i < s.length; i++) {
                    const ch = s[i];

                    if (ch === '\n' || ch === '\r' || ch === '\t') continue;

                    if (inString) {
                        out += ch;
                        if (escaped) {
                            escaped = false;
                        } else if (ch === '\\') {
                            escaped = true;
                        } else if (ch === '"') {
                            inString = false;
                        }
                        continue;
                    }

                    if (ch === '"') {
                        inString = true;
                        out += ch;
                        continue;
                    }

                    if (ch === '\\') {
                        const next = s[i + 1];
                        if (next === 'n' || next === 'r' || next === 't') {
                            i++;
                            continue;
                        }
                    }

                    out += ch;
                }

                return out.trim();
            };

            const normalizeNewlines = (val) => {
                if (typeof val !== 'string') return val;
                return val.replace(/\\\\\\\\n/g, '\\\\n').replace(/\\\\n/g, '\n');
            };

            const normalizeParsedObject = (parsed) => {
                if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                    parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
                }
                return parsed;
            };

            const tryParseJsonSafely = (source) => {
                if (typeof source !== 'string') return null;
                const trimmed = source.trim();
                if (!trimmed) return null;

                const candidates = [
                    trimmed,
                    sanitizeForJsonParse(trimmed),
                    trimmed.replace(/\\'/g, "'"),
                    sanitizeForJsonParse(trimmed.replace(/\\'/g, "'")),
                    trimmed.replace(/\\\\/g, '\\').replace(/\\'/g, "'"),
                    sanitizeForJsonParse(trimmed.replace(/\\\\/g, '\\').replace(/\\'/g, "'"))
                ];

                for (const candidate of candidates) {
                    try {
                        return normalizeParsedObject(JSON.parse(candidate));
                    } catch (e) {
                        // 다음 후보로 재시도
                    }
                }
                return null;
            };

            const extractContentField = (rawText) => {
                if (typeof rawText !== 'string') return null;
                const matched = rawText.match(/^content=(['"])((?:\\.|(?!\1)[\s\S])*)\1(?:\s+\w+=|$)/);
                if (matched && matched[2]) {
                    return matched[2];
                }
                return null;
            };

            const tryParseFromText = (rawText) => {
                if (typeof rawText !== 'string') return null;

                const directParsed = tryParseJsonSafely(rawText);
                if (directParsed) return directParsed;

                const contentField = extractContentField(rawText);
                if (contentField) {
                    const parsedFromContent = tryParseJsonSafely(contentField);
                    if (parsedFromContent) return parsedFromContent;
                }

                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace >= 0 && lastBrace > firstBrace) {
                    const jsonSlice = rawText.substring(firstBrace, lastBrace + 1);
                    const parsedFromSlice = tryParseJsonSafely(jsonSlice);
                    if (parsedFromSlice) return parsedFromSlice;
                }

                return null;
            };

            const parsed = tryParseFromText(outputStr);
            if (parsed) return parsed;

            console.warn('[ChatRoomPage.parseToolOutput] JSON 파싱 실패');
            return null;
        }
    }
};
</script>

<style scoped>
.chat-room-page-card {
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.chat-room-page {
    height: 100%;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 0;
    overflow: hidden;
}

.empty-state,
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
}

.loading-state {
    flex-direction: row;
    gap: 8px;
}

.chat-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.chat-body {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
}

.chat-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.messages-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding-bottom: 24px; /* 내부 스크롤 여유(추가 여유는 Chat.vue chat-view-box padding으로 보강) */
}

.right-sidebar {
    width: 380px;
    border-left: 1px solid rgb(var(--v-theme-borderColor));
    background: rgb(var(--v-theme-surface));
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
}

.right-sidebar__resizer {
    position: absolute;
    left: -6px;
    top: 0;
    width: 12px;
    height: 100%;
    cursor: col-resize;
    z-index: 4;
}

.right-sidebar__resizer::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(0, 0, 0, 0.08);
}

@media (max-width: 960px) {
    .right-sidebar {
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        z-index: 3;
        box-shadow: 2px 1px 20px rgba(0, 0, 0, 0.12);
    }
}

.header-bar {
    padding: 16px 16px 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.header-divider {
    margin-top: 12px;
}

.context-tabs-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 0 12px;
    min-height: 44px;
}

/* ===== BPMN Preview (diagram/xml/ontology) ===== */
.bpmn-diagram-container {
    height: 450px;
    background: #f8fafc;
    position: relative;
}
/* 미리보기 다이얼로그에서는 미니맵 숨김(요청) */
.bpmn-diagram-container :deep(.djs-minimap) {
    display: none !important;
}

.bpmn-preview-container {
    height: 450px;
    overflow: auto;
    background: #1e293b;
}

.bpmn-xml-content {
    padding: 16px;
    margin: 0;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-all;
}

.bpmn-ontology-container {
    height: 450px;
    background: #0b1220;
    position: relative;
}

.bpmn-ontology-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: #cbd5e1;
    font-size: 13px;
    text-align: center;
}

.room-tabs {
    flex: 1;
    min-width: 0;
}

.tab-title {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.header-title {
    min-width: 0;
}

.room-name {
    font-size: 16px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 420px;
}

.avatar-grid {
    width: 100%;
    height: 100%;
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    border-radius: 9999px;
}
.avatar-grid__cell {
    width: 50%;
    height: 50%;
}
.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.input-area {
    padding: 12px 16px 16px 16px;
    border-top: 1px solid #e2e8f0;
    background: white;
    flex-shrink: 0;
}

/* ===== 데스크탑 음성 모드 바 ===== */
.voice-mode-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    margin-bottom: 8px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.08), rgba(var(--v-theme-primary), 0.04));
    border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.voice-pulse-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #94a3b8;
    flex-shrink: 0;
    transition: background-color 0.3s;
}

.voice-pulse-dot.is-speaking {
    background-color: rgb(var(--v-theme-primary));
    animation: voice-pulse 1s ease-in-out infinite;
}

.voice-pulse-dot.is-responding {
    background-color: #f59e0b;
    animation: voice-pulse 0.6s ease-in-out infinite;
}

.voice-pulse-dot.is-playing {
    background-color: #10b981;
    animation: voice-pulse 0.5s ease-in-out infinite;
}

.voice-pulse-dot.is-connecting {
    background-color: #94a3b8;
    animation: voice-pulse 1.2s ease-in-out infinite;
}

.voice-pulse-dot.is-error {
    background-color: #ef4444;
}

.voice-mode-bar.is-error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.04));
    border-color: rgba(239, 68, 68, 0.3);
}

.voice-status-label.is-error-text {
    color: #ef4444;
}

@keyframes voice-pulse {
    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.4);
        opacity: 0.7;
    }
}

.voice-status-label {
    font-size: 12px;
    color: rgb(var(--v-theme-primary));
    font-weight: 500;
}
/* ===== 데스크탑 음성 모드 바 끝 ===== */

.participants-summary-btn {
    padding: 0 !important;
    min-width: 0 !important;
    height: 20px !important;
    text-transform: none;
}
.participants-count {
    font-weight: 700;
    color: rgba(0, 0, 0, 0.65);
}

.participants-preview {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 260px;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.55);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
}
.participants-preview::before {
    content: '·';
    margin-right: 6px;
    color: rgba(0, 0, 0, 0.25);
}
</style>

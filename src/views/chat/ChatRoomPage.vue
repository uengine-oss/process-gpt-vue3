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
                                                <img :src="getParticipantProfile(p)" :alt="getParticipantAlt(p)" class="avatar-img" />
                                            </div>
                                        </div>
                                    </v-avatar>
                                </template>
                            </div>
                            <div class="header-title">
                                <div class="room-name">{{ currentChatRoom?.name || $t('chatListing.chat') }}</div>
                                <div class="room-subtitle text-caption text-medium-emphasis d-flex align-center" style="gap: 8px">
                                    <v-btn variant="text" density="compact" class="participants-summary-btn" @click="openParticipantsView">
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
                                :messages="messages"
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
                                @preview-bpmn="showBpmnPreview"
                                @preview-image="openImagePreview"
                                @open-external-url="openExternalUrl"
                                @beforeReply="handleBeforeReply"
                                @invite-agent="handleInviteAgent"
                                @getMoreChat="loadMoreMessages"
                                @human-feedback-submit="handleHumanFeedbackSubmit"
                            />
                        </div>

                        <!-- 입력 영역 -->
                        <div class="input-area">
                            <!-- Human Feedback 패널 (입력부 상단) -->
                            <HumanFeedbackPanel
                                v-if="pendingHumanFeedback && !pendingHumanFeedback.__submitted"
                                :feedbackType="pendingHumanFeedback.user_request_type || 'select_items'"
                                :question="pendingHumanFeedback.question || '선택해 주세요.'"
                                :context="pendingHumanFeedback.context || ''"
                                :items="pendingHumanFeedback.items || []"
                                :suggestions="pendingHumanFeedback.suggestions || []"
                                :allowMultiple="pendingHumanFeedback.allow_multiple !== false"
                                :minSelect="pendingHumanFeedback.min_select || 1"
                                :allowSkip="pendingHumanFeedback.allow_skip || false"
                                :submitted="false"
                                :headerIcon="'mdi-file-document-multiple-outline'"
                                :submitLabel="'선택 완료'"
                                class="ml-3 mb-2"
                                @submit="handleHumanFeedbackSubmit(pendingHumanFeedbackMessage, $event)"
                                @skip="handleHumanFeedbackSkip(pendingHumanFeedbackMessage)"
                            />
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
                                :userList="userList"
                                :currentChatRoom="currentChatRoom"
                                :desktopVoiceActive="isDesktopVoiceActive"
                                :enableDesktopVoice="isVoiceEnabled"
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
                                        </v-list>
                                    </v-card>
                                </v-menu>
                            </div>
                        </div>
                        <v-divider class="header-divider" />

                        <Chat
                            ref="chatView"
                            :messages="messages"
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
                            @preview-bpmn="showBpmnPreview"
                            @preview-integrated-graph="showIntegratedGraphByTask"
                            @preview-image="openImagePreview"
                            @open-external-url="openExternalUrl"
                            @beforeReply="handleBeforeReply"
                            @invite-agent="handleInviteAgent"
                            @getMoreChat="loadMoreMessages"
                            @human-feedback-submit="handleHumanFeedbackSubmit"
                        />
                    </div>

                    <div class="input-area">
                        <!-- Human Feedback 패널 (입력부 상단) -->
                        <HumanFeedbackPanel
                            v-if="pendingHumanFeedback && !pendingHumanFeedback.__submitted"
                            :feedbackType="pendingHumanFeedback.user_request_type || 'select_items'"
                            :question="pendingHumanFeedback.question || '선택해 주세요.'"
                            :context="pendingHumanFeedback.context || ''"
                            :items="pendingHumanFeedback.items || []"
                            :suggestions="pendingHumanFeedback.suggestions || []"
                            :allowMultiple="pendingHumanFeedback.allow_multiple !== false"
                            :minSelect="pendingHumanFeedback.min_select || 1"
                            :allowSkip="pendingHumanFeedback.allow_skip || false"
                            :submitted="false"
                            :headerIcon="'mdi-file-document-multiple-outline'"
                            :submitLabel="'선택 완료'"
                            class="mx-3 mb-2"
                            @submit="handleHumanFeedbackSubmit(pendingHumanFeedbackMessage, $event)"
                            @skip="handleHumanFeedbackSkip(pendingHumanFeedbackMessage)"
                        />
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
                                    </v-list>
                                </v-card>
                            </v-menu>
                        </div>
                    </div>
                    <v-divider class="header-divider" />

                    <Chat
                        ref="chatView"
                        :messages="messages"
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
                        @preview-bpmn="showBpmnPreview"
                        @preview-integrated-graph="showIntegratedGraphByTask"
                        @preview-image="openImagePreview"
                        @open-external-url="openExternalUrl"
                        @beforeReply="handleBeforeReply"
                        @invite-agent="handleInviteAgent"
                        @getMoreChat="loadMoreMessages"
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
                            :key="selectedBpmn?.process_name"
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
                    <v-btn v-if="!isIntegratedGraphPreview && bpmnViewMode === 'diagram'" variant="tonal" @click="openInModeler">
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
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';
import Chat from '@/components/ui/Chat.vue';
import HumanFeedbackPanel from '@/components/ui/HumanFeedbackPanel.vue';
import VoiceAgentDesktopMode from '@/components/ui/VoiceAgentDesktopMode.vue';
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import OntologyGraphViewer from '@/components/ui/OntologyGraphViewer.vue';
import ArtifactPanel from '@/components/ArtifactPanel.vue';
import { useDefaultSetting } from '@/stores/defaultSetting';
import agentRouterService from '@/services/AgentRouterService';
import workAssistantAgentService from '@/services/WorkAssistantAgentService.js';
import { getValidToken } from '@/utils/supabaseAuth';
import { processGptAgent } from '@/constants/processGptAgent';
import { PROCESS_GPT_AGENT_ID } from '@/constants/processGptAgent';

const backend = BackendFactory.createBackend();

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
        'PDF → BPMN 변환 작업 감지/추적',
        '이미지 분석'
    ].join(', '),
    tools: 'get_process_list, get_process_detail, get_form_fields, execute_process, get_instance_list, get_todolist, get_organization, generate_process, start_process_consulting, create_pdf2bpmn_workitem'
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
        ArtifactPanel,
        HumanFeedbackPanel
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
            chatsWatchRef: null,

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

            // 프리뷰 UI (BPMN/이미지) - WorkAssistantChatPanel과 동일한 UX를 ChatRoomPage에서 제공
            bpmnPreviewDialog: false,
            bpmnViewMode: 'diagram', // diagram | xml | ontology
            selectedBpmn: null,
            neo4jGraphLoading: false,
            neo4jGraphError: '',
            neo4jGraphElements: [],
            pdf2bpmnApiBaseResolved: '',
            imagePreviewDialog: false,
            previewImageUrl: null,

            // 산출물 미리보기 패널 (공통)
            artifactPanels: [],       // [{ id, type, label, data: { htmlUrl, fileUrl, messageId } }]
            activeArtifactId: null,   // 현재 활성 탭 ID
            artifactSidebarVisible: false,
            artifactSidebarWidth: 820,
            artifactSidebarResizing: false,
            artifactSidebarResizeStartX: 0,
            artifactSidebarResizeStartWidth: 0,
            artifactDownloadLoading: false,

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
        /**
         * 마지막 메시지에서 미제출 __humanFeedback 추출
         * 입력부 상단에 표시할 human feedback 데이터
         */
        pendingHumanFeedback() {
            if (!this.messages || this.messages.length === 0) return null;
            // 마지막부터 역순으로 찾기
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if (msg && msg.__humanFeedback && msg.__humanFeedback.items && msg.__humanFeedback.items.length > 0 && !msg.__humanFeedback.__submitted) {
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
                if (msg && msg.__humanFeedback && msg.__humanFeedback.items && msg.__humanFeedback.items.length > 0 && !msg.__humanFeedback.__submitted) {
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

        // PDF2BPMN events 구독 해제
        this.unsubscribeAllPdf2bpmnEvents();

        // 진행 중인 스트리밍 중지
        this.abortAllAgentStreams();

        // 사이드바 리사이즈 리스너 해제
        window.removeEventListener('mousemove', this.onArtifactSidebarResizeMove);
        window.removeEventListener('mouseup', this.stopArtifactSidebarResize);
    },
    methods: {
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

            for (const f of files) {
                if (!f) continue;
            }
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

                const room = {
                    id: roomId,
                    name:
                        String(this.draftName || this.$t('chatListing.newChat'))
                            .trim()
                            .substring(0, 50) || this.$t('chatListing.newChat'),
                    participants: this.getDraftParticipantsFallback([me, tu]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso }
                };

                await backend.putObject('db://chat_rooms', room);

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
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

                // room last message
                const fileName = (fileMeta.firstFileName || '').toString();
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileMeta.fileCount > 1 ? `${fileName} 외 ${fileMeta.fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                await backend.putObject('db://chat_rooms', room);
                this.EventBus.emit('chat-rooms-updated');

                // userId 컨텍스트 유지: 라우팅 없이 내부 상태로 전환
                this.activeRoomId = roomId;
                // UI 즉시 반영(이후 roomId watcher가 bootstrapRoom으로 동기화)
                this.currentChatRoom = room;
                this.messages.push(msg);
                this.$nextTick(() => this.scrollToBottomSafe());
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

                const room = {
                    id: roomId,
                    name:
                        String(this.draftName || this.$t('chatListing.newChat'))
                            .trim()
                            .substring(0, 50) || this.$t('chatListing.newChat'),
                    participants: this.getDraftParticipantsFallback([me, ag]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso }
                };

                await backend.putObject('db://chat_rooms', room);

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
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

                const fileName = (fileMeta.firstFileName || '').toString();
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileMeta.fileCount > 1 ? `${fileName} 외 ${fileMeta.fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                await backend.putObject('db://chat_rooms', room);
                this.EventBus.emit('chat-rooms-updated');

                // embedded에서는 라우팅하지 않고 내부 state로 전환
                this.activeRoomId = roomId;
                // UI 즉시 반영(이후 roomId watcher가 bootstrapRoom으로 동기화)
                this.currentChatRoom = room;
                this.messages.push(msg);
                this.$nextTick(() => this.scrollToBottomSafe());
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
            // 방 전환 시 아티팩트 패널 초기화
            this.artifactPanels = [];
            this.activeArtifactId = null;
            this.artifactSidebarVisible = false;
            try {
                // 방 전환 시 히스토리 페이지네이션 상태 초기화
                this.resetHistoryPagination();
                this.userInfo = await backend.getUserInfo();
                if (!this.userList || this.userList.length === 0) {
                    await this.loadUserList();
                }
                await this.loadRoom(roomId);
                await this.loadMessages(roomId);
                await this.subscribeToRoom(roomId);
                this.EventBus.emit('chat-room-selected', roomId);
                this.startChatAccessHeartbeat(roomId);
                this.warmupAgentsForCurrentRoom();
                this.$nextTick(() => this.scrollToBottomSafe());
                this.focusComposerInput();
            } catch (e) {
                this.currentChatRoom = null;
                this.messages = [];
            } finally {
                this.isLoadingRoom = false;
            }

            // definition-map 메인 채팅에서 생성된 방:
            // 화면 로딩을 막지 않도록 kickoff는 백그라운드로 시작한다.
            this.$nextTick(() => {
                this.maybeKickoffFromSession(roomId).catch(() => {});
            });
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

                const agentTargets = await this.resolveAgentTargetsForMessage(payload.text || '');
                if (agentTargets.length > 0) {
                    const kickoffFiles = this.normalizePayloadFiles(payload);
                    await this.streamAgents(agentTargets, payload.text || '', {
                        images: payload.images || [],
                        file: kickoffFiles[0] || null,
                        files: kickoffFiles
                    });
                }
            } catch (e) {}
        },
        async loadRoom(roomId) {
            // 우선 로컬 인덱스 사용
            try {
                const raw = localStorage.getItem('chatRoomIndex');
                if (raw) {
                    const idx = JSON.parse(raw);
                    const cached = idx?.[roomId] || null;
                    if (cached) {
                        this.currentChatRoom = cached;
                        return;
                    }
                }
            } catch (e) {}

            const rooms = await backend.getChatRoomList('chat_rooms');
            const found = (rooms || []).find((r) => r.id === roomId) || null;
            this.currentChatRoom = found || { id: roomId, name: this.$t('chatListing.chat'), participants: [] };
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
                this.messages = asc;

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
                    const runId =
                        ex?.integrated_graph_ref?.run_id ||
                        ex?.graph_run_id ||
                        ex?.graph_snapshot_ref?.run_id ||
                        '';
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
                    this.messages = [...toPrepend, ...(this.messages || [])];
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
                    this.messages[exists] =
                        typeof incoming === 'object'
                            ? this.normalizeAssistantMessageForDisplay({ ...(this.messages[exists] || {}), ...incoming })
                            : incoming;
                    return;
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
                            this.messages[dupIdx] = this.normalizeAssistantMessageForDisplay({ ...(this.messages[dupIdx] || {}), ...incoming });
                        } else {
                            this.messages[dupIdx] = incoming;
                        }
                        return;
                    }
                } catch (e) {}
                this.messages.push(incoming);
                this.messages.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                this.$nextTick(() => this.scrollToBottomSafe());
            } catch (e) {}
        },
        openRenameDialog() {
            this.settingsMenu = false;
            this.renameDraft = (this.currentChatRoom?.id ? this.currentChatRoom?.name || '' : this.draftName || this.$t('chatListing.newChat')).toString();
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
                    await backend.putObject('db://chat_rooms', this.currentChatRoom);
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
                    await backend.putObject('db://chat_rooms', this.currentChatRoom);
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
                        await agentRouterService.warmup(id);
                        this.setAgentStatus(id, { state: 'ready', message: '' });
                    } catch (e) {
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
        handleHumanFeedbackSkip(message) {
            if (message && message.__humanFeedback) {
                message.__humanFeedback.__submitted = true;
                message.__humanFeedback.__submittedText = '건너뜀';
            }
        },

        async handleHumanFeedbackSubmit(message, feedbackResult) {
            if (!feedbackResult) return;
            console.log('[HumanFeedback] handleHumanFeedbackSubmit:', feedbackResult);

            // 메시지를 제출 완료 상태로 변경
            if (message && message.__humanFeedback) {
                message.__humanFeedback.__submitted = true;
                message.__humanFeedback.__submittedText = feedbackResult.type === 'select_items'
                    ? `${feedbackResult.selectedItems?.length || 0}개 문서 선택됨`
                    : '응답 완료';
            }

            let userText = '';
            if (feedbackResult.type === 'select_items') {
                const selectedLabels = feedbackResult.selectedItems.map(item => item.label);
                userText = `다음 문서를 참고해서 작성해 주세요: ${selectedLabels.join(', ')}`;
            } else if (feedbackResult.type === 'suggestions') {
                userText = feedbackResult.selected;
            } else {
                userText = '확인';
            }

            // handleSendMessage를 통해 에이전트에 전송
            await this.handleSendMessage({ text: userText });
        },

        async handleSendMessage(payload) {
            const fileMeta = this.getPayloadFileSummary(payload);
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !fileMeta.hasFile)) return;
            if (!this.currentChatRoom?.id) return;
            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = fileMeta.hasFile;
            if (!text && !hasImages && !hasFile) return;

            try {
                const keyObj = {
                    text: text || '',
                    imgCount: hasImages ? (payload.images || []).length : 0,
                    fileNames: hasFile
                        ? fileMeta.files.map((f) => f?.name || f?.fileName || '').filter(Boolean)
                        : []
                };
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
                const nowIso = new Date().toISOString();
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
                    pdfFiles: fileMeta.files,
                    // mention 메타데이터 (UI 표시 + 라우팅에 사용)
                    mentionedUsers: Array.isArray(payload?.mentionedUsers) ? payload.mentionedUsers : [],
                    // reply 메타데이터 (UI에서 표시)
                    replyUuid: payload?.reply?.uuid || null,
                    replyUserName: payload?.reply?.name || null,
                    replyContent: payload?.reply?.content || null
                };
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: this.currentChatRoom.id, messages: msg });

                // last message update
                const fileName = (fileMeta.firstFileName || '').toString();
                const preview =
                    (text || '').substring(0, 50) ||
                    (hasFile ? (fileMeta.fileCount > 1 ? `${fileName} 외 ${fileMeta.fileCount - 1}개` : fileName).substring(0, 50) : '') ||
                    (hasImages ? `이미지 ${(payload?.images || []).length || 0}장` : '');
                this.currentChatRoom.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
                await backend.putObject('db://chat_rooms', this.currentChatRoom);

                this.messages.push(msg);
                this.EventBus.emit('chat-rooms-updated');
                this.$nextTick(() => this.scrollToBottomSafe());
                this.focusComposerInput();
                this.updateChatAccessPage(this.currentChatRoom?.id);

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
                    await backend.putObject('db://chat_rooms', this.currentChatRoom);
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
                    files: triggerFiles
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
                return s.split(',').map((v) => v.trim()).filter(Boolean);
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
                const routed = await agentRouterService.routeAgents({
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

        buildMessageForAgent(userText, payload, policy) {
            let messageForAgent = (userText || '').toString();
            // 첨부 정보는 기존 방식처럼 [InputData]로 전달
            const normalizedFiles = this.normalizePayloadFiles(payload);
            if (
                (payload?.images && payload.images.length > 0) ||
                normalizedFiles.length > 0 ||
                payload?.hwpxUrl ||
                payload?.hwpxEdit
            ) {
                const inputData = {};
                if (payload?.images && payload.images.length > 0) inputData.images = payload.images;
                if (normalizedFiles.length > 0) {
                    // 하위 호환: 첫 파일은 file, 전체는 files
                    inputData.file = normalizedFiles[0];
                    inputData.files = normalizedFiles;
                }
                if (payload?.hwpxUrl) inputData.hwpx_url = payload.hwpxUrl;
                if (payload?.hwpxEdit) inputData.hwpx_edit = payload.hwpxEdit;
                messageForAgent += `\n\n[InputData]\n${JSON.stringify(inputData)}`;
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
            const stripped = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
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
                const hasSlideMarkdown = !!(parsed.slide_markdown);
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
            const existingIdx = this.artifactPanels.findIndex(
                (p) => p.type === type && (
                    type === 'slide'
                        ? p.data?.messageId === data?.messageId
                        : p.data?.htmlUrl === data?.htmlUrl
                )
            );
            if (existingIdx !== -1) {
                this.artifactPanels[existingIdx] = { ...this.artifactPanels[existingIdx], label, data };
                this.activeArtifactId = this.artifactPanels[existingIdx].id;
            } else {
                const id = `${type}-${this.uuid()}`;
                this.artifactPanels.push({ id, type, label, data });
                this.activeArtifactId = id;
            }
            this.artifactSidebarVisible = true;
        },

        /** ArtifactPanel의 panel-action 이벤트 중앙 처리 */
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
            }
        },

        extractHwpxHtmlUrl(payload) {
            if (!payload || typeof payload !== 'object') return '';
            return (
                payload.html_url ||
                payload.htmlUrl ||
                payload.hwpx_html_url ||
                payload.hwpxHtmlUrl ||
                ''
            );
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
                    !!msg.hwpxHtmlUrl ||
                    /https?:\/\/\S+\.hwpx/i.test(content) ||
                    /https?:\/\/\S*filled-\S+\.html/i.test(content);
                if (!isHwpxMessage) continue;

                const cleaned = this.cleanupHwpxMessageContent(i);
                if (cleaned !== null && cleaned !== content) {
                    msg.content = cleaned;
                }
            }
        },

        pushHwpxArtifact(parsed, msgIdx) {
            const url = this.extractHwpxHtmlUrl(parsed);
            if (!url) return;
            const name =
                (parsed?.html_name || parsed?.htmlName || parsed?.file_name || parsed?.fileName || '').toString();
            const isFilled = name.startsWith('filled-') || url.includes('filled-');
            if (!isFilled) return;
            const msg = this.messages?.[msgIdx];
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

        pushDocxArtifact(parsed, msgIdx) {
            const url = this.extractHwpxHtmlUrl(parsed);
            if (!url) return;
            const name =
                (parsed?.html_name || parsed?.htmlName || parsed?.file_name || parsed?.fileName || '').toString();
            const msg = this.messages?.[msgIdx];
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
        pushSlideArtifact(parsed, msgIdx) {
            const md = parsed?.slide_markdown;
            if (!md) return;
            const msg = this.messages?.[msgIdx];
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

        applyHwpxViewerFromToolCalls(toolCalls, msgIdx) {
            if (!Array.isArray(toolCalls) || toolCalls.length === 0) return;
            for (let i = toolCalls.length - 1; i >= 0; i--) {
                const outputStr = toolCalls[i]?.output;
                if (!outputStr) continue;
                const parsed = this.parseToolOutput(outputStr);
                // 슬라이드 아티팩트 감지
                if (this.isSlidePayload(parsed)) {
                    this.pushSlideArtifact(parsed, msgIdx);
                    return;
                }
                const url = this.extractHwpxHtmlUrl(parsed);
                if (url) {
                    if (this.isDocxPayload(parsed)) {
                        this.pushDocxArtifact(parsed, msgIdx);
                    } else {
                        this.pushHwpxArtifact(parsed, msgIdx);
                    }
                    return;
                }
                const textUrl = this.extractHwpxHtmlUrlFromText(outputStr);
                if (textUrl) {
                    this.pushHwpxArtifact({ html_url: textUrl }, msgIdx);
                    return;
                }
            }
        },

        checkExistingArtifactPanels() {
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if (!msg) continue;
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

        async streamAgents(agentTargets, userText, payload) {
            const userJwt = (await getValidToken()) || '';
            const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';
            const requestFiles = this.normalizePayloadFiles(payload);
            const requestPrimaryFile = requestFiles[0] || null;

            // remove routing loading bubble once we start calling agents
            const routingUuid = (agentTargets || []).find((t) => t?.__routingLoadingUuid)?.__routingLoadingUuid || null;
            if (routingUuid) this.removeRoutingLoadingMessage(routingUuid);

            const promises = agentTargets.map(async (agentTarget) => {
                const agentId = agentTarget.id;
                if (!agentId) return;

                const assistantUuid = this.uuid();
                const assistantMsgBase = {
                    uuid: assistantUuid,
                    role: 'assistant',
                    // WorkAssistantChatPanel 방식: 스트리밍 중엔 로딩 영역에서 텍스트가 늘어나고
                    // 완료되면 같은 메시지 객체가 "최종 버블"로 확정됨
                    content: '생각 중...',
                    contentType: 'text',
                    isLoading: true,
                    toolCalls: [],
                    timeStamp: new Date().toISOString(),
                    email: agentTarget.email || `agent:${agentId}`,
                    name: agentTarget.username || agentId,
                    userName: agentTarget.username || agentId,
                    profile: agentTarget.profile || null,
                    agentId
                };

                let full = '';
                let created = false;
                let lastScrollAt = 0;
                const messageForAgent = this.buildMessageForAgent(userText, payload, agentTarget.policy);
                const ensureCreated = () => {
                    if (created) return;
                    created = true;
                    this.messages.push({ ...assistantMsgBase, content: assistantMsgBase.content || full || '' });
                };
                const maybeScroll = () => {
                    const now = Date.now();
                    if (now - lastScrollAt < 120) return;
                    lastScrollAt = now;
                    this.$nextTick(() => this.scrollToBottomSafe());
                };

                // show loading bubble immediately (even while warmup is happening)
                ensureCreated();
                maybeScroll();

                // warmup (process-gpt-agent는 라우터 warmup 대상이 아님)
                if (agentId === PROCESS_GPT_AGENT_ID) {
                    this.setAgentStatus(agentId, { state: 'ready', message: '' });
                } else {
                    this.setAgentStatus(agentId, { state: 'warming', message: '' });
                    try {
                        await agentRouterService.warmup(agentId);
                        this.setAgentStatus(agentId, { state: 'ready', message: '' });
                    } catch (e) {
                        this.setAgentStatus(agentId, { state: 'error', message: '준비 실패' });
                        const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                        if (idx !== -1) {
                            this.messages[idx].content = '(에이전트 준비 실패)';
                            this.messages[idx].isLoading = false;
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
                    skills: assignedSkills,
                };

                const commonParams = {
                    message: messageForAgent,
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
                        ...(agentTarget?.__routingDecision ? { routing: agentTarget.__routingDecision } : {}),
                        room_recent_history,
                        assigned_skills: assignedSkills,
                        agent_profile: agentProfileForRuntime,
                        input_data: {
                            file: requestPrimaryFile,
                            files: requestFiles,
                            fileCount: requestFiles.length
                        }
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
                        const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                        if (idx !== -1) {
                            // human feedback이 감지된 경우 간결한 안내만 표시
                            if (hasHumanFeedback) {
                                this.messages[idx].content = '참고할 문서를 검색했습니다. 아래에서 선택해 주세요.';
                            } else {
                                this.messages[idx].content = full.length === 0 ? '생각 중...' : full;
                            }
                            this.messages[idx].isLoading = true;
                        }
                        this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                        maybeScroll();
                    },
                    onToolStart: (tool, input) => {
                        try {
                            const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                            if (idx === -1) return;
                            const name = (tool?.name || tool || '').toString();
                            if (!name) return;
                            const cur = this.messages[idx];
                            const toolCalls = Array.isArray(cur.toolCalls) ? cur.toolCalls : [];
                            // 중복 방지
                            const exists = toolCalls.some((t) => (t?.name || '') === name && (t?.status || '') === 'running');
                            if (!exists) {
                                toolCalls.push({ name, status: 'running', input: input ?? null, startedAt: new Date().toISOString() });
                            }
                            this.messages[idx].toolCalls = toolCalls;
                            // WorkAssistantChatPanel처럼 현재 동작 텍스트로 표시
                            this.messages[idx].content = `🔧 ${this.formatToolName(name)} 실행 중...`;
                            this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                            maybeScroll();
                        } catch (e) {}
                    },
                    onToolEnd: (output) => {
                        try {
                            const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                            if (idx === -1) return;
                            const cur = this.messages[idx];
                            const toolCalls = Array.isArray(cur.toolCalls) ? cur.toolCalls : [];
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
                            this.messages[idx].toolCalls = toolCalls;

                            // list_reference_documents 등 human feedback 도구 결과 감지
                            if (lastRunningTool && lastRunningTool.name && lastRunningTool.name.includes('list_reference_documents')) {
                                try {
                                    const fbParsed = typeof output === 'string' ? JSON.parse(output) : output;
                                    if (fbParsed && fbParsed.user_request_type === 'select_items' && fbParsed.items) {
                                        lastRunningTool.__humanFeedback = fbParsed;
                                        hasHumanFeedback = true;
                                        // 즉시 메시지 내용을 간결하게 교체
                                        const msgIdx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                                        if (msgIdx !== -1) {
                                            this.messages[msgIdx].content = '참고할 문서를 검색했습니다. 아래에서 선택해 주세요.';
                                        }
                                    }
                                } catch (e) {
                                    // 파싱 실패 시 무시
                                }
                            }

                            const parsed = this.parseToolOutput(output);
                            // 슬라이드 아티팩트 감지
                            if (this.isSlidePayload(parsed)) {
                                this.pushSlideArtifact(parsed, idx);
                            } else {
                                this.pushHwpxArtifact(parsed, idx);
                                if (!this.hasArtifactPanel) {
                                    const urlFromText = this.extractHwpxHtmlUrlFromText(output);
                                    if (urlFromText) {
                                        this.pushHwpxArtifact({ html_url: urlFromText }, idx);
                                    }
                                }
                            }
                            maybeScroll();
                        } catch (e) {}
                    },
                    onDone: async (content) => {
                        const finalContent = (content || full || '').toString().trim();
                        // 침묵 정책 제거: NO_RESPONSE도 그대로 텍스트로 표시하지 않도록 빈 값 처리
                        let safeFinal = finalContent === 'NO_RESPONSE' ? '' : finalContent;
                        let displayContent = '';

                        const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                        if (idx !== -1) {
                            // human feedback 도구 결과가 있으면 메시지에 첨부
                            const msgToolCalls = Array.isArray(this.messages[idx].toolCalls) ? this.messages[idx].toolCalls : [];
                            const feedbackTC = msgToolCalls.find(tc => tc?.__humanFeedback);
                            if (feedbackTC) {
                                this.messages[idx].__humanFeedback = feedbackTC.__humanFeedback;
                                // AI가 문서 목록을 텍스트로 나열한 부분 제거 → 간결한 안내만 표시
                                safeFinal = '참고할 문서를 검색했습니다. 아래에서 선택해 주세요.';
                                console.log('[HumanFeedback] ✅ 메시지에 __humanFeedback 첨부됨, items:', feedbackTC.__humanFeedback?.items?.length);
                            }

                            const hwpxPayload = this.extractHwpxPayload(safeFinal || full || '');
                            if (hwpxPayload && this.isSlidePayload(hwpxPayload)) {
                                // 슬라이드 아티팩트 처리
                                this.pushSlideArtifact(hwpxPayload, idx);
                                safeFinal = '슬라이드를 생성했습니다. 오른쪽 패널에서 확인해주세요.';
                            } else if (hwpxPayload) {
                                const pdfUrl = hwpxPayload.pdf_url || hwpxPayload.pdfUrl || '';
                                const pdfName = (hwpxPayload.pdf_name || hwpxPayload.pdfName || '').toString();
                                const fileUrl = hwpxPayload.file_url || hwpxPayload.fileUrl || '';
                                const fileName = (hwpxPayload.file_name || hwpxPayload.fileName || 'filled.hwpx').toString();
                                const contentType =
                                    (hwpxPayload.content_type || hwpxPayload.contentType || 'application/vnd.hancom.hwpx').toString();
                                const htmlUrl = this.extractHwpxHtmlUrl(hwpxPayload);

                                if (pdfUrl) {
                                    this.messages[idx].pdfFile = {
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
                                        this.messages[idx].pdfFile = {
                                            url: blobUrl,
                                            fileUrl: blobUrl,
                                            name: fileName,
                                            fileName,
                                            contentType
                                        };
                                    }
                                    safeFinal = 'HWPX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.';
                                } else if (fileUrl) {
                                    this.messages[idx].pdfFile = {
                                        url: fileUrl,
                                        fileUrl,
                                        name: fileName,
                                        fileName,
                                        contentType
                                    };
                                    safeFinal = this.isDocxPayload(hwpxPayload)
                                        ? 'DOCX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.'
                                        : 'HWPX 파일을 생성했습니다. 아래 첨부 파일을 확인해주세요.';
                                }

                                if (htmlUrl) {
                                    if (this.isDocxPayload(hwpxPayload)) {
                                        this.pushDocxArtifact(hwpxPayload, idx);
                                    } else {
                                        this.pushHwpxArtifact(hwpxPayload, idx);
                                    }
                                }
                            }

                            this.messages[idx].content = safeFinal || full || '';
                            displayContent = this.extractDisplayAssistantContent(this.messages[idx].content);
                            this.messages[idx].isLoading = false;
                            this.messages[idx].contentType = 'text';
                            this.applyHwpxViewerFromToolCalls(this.messages[idx].toolCalls, idx);
                            if (!this.hasArtifactPanel) {
                                const urlFromText = this.extractHwpxHtmlUrlFromText(this.messages[idx].content);
                                if (urlFromText) {
                                    this.pushHwpxArtifact({ html_url: urlFromText }, idx);
                                }
                            }
                            // 패널 열림 여부와 무관하게 content에 raw hwpx 링크가 있으면 항상 정리
                            // (tool_end로 패널이 이미 열려있어도 LLM 텍스트에 URL이 남아있을 수 있음)
                            const hasRawHwpxInContent =
                                /https?:\/\/\S+\.hwpx/i.test(this.messages[idx].content) ||
                                /https?:\/\/\S*filled-\S+\.html/i.test(this.messages[idx].content);
                            if (hasRawHwpxInContent) {
                                const cleaned = this.cleanupHwpxMessageContent(idx);
                                if (cleaned !== null && cleaned !== this.messages[idx].content) {
                                    this.messages[idx].content = cleaned;
                                    safeFinal = cleaned;
                                }
                            }
                        }
                        this.setAgentStatus(agentId, { state: 'ready', message: '' });

                        // DB 저장
                        await backend.putObject(`db://chats/${assistantUuid}`, {
                            uuid: assistantUuid,
                            id: this.currentChatRoom?.id,
                            messages: { ...(this.messages[idx] || assistantMsgBase), content: displayContent || safeFinal || full || '', isLoading: false }
                        });

                        // last message 업데이트(가장 마지막 완료 응답 기준으로 덮어쓰기)
                        if (this.currentChatRoom) {
                            this.currentChatRoom.message = {
                                msg: displayContent.substring(0, 50),
                                type: 'text',
                                createdAt: new Date().toISOString()
                            };
                            await backend.putObject('db://chat_rooms', this.currentChatRoom);
                        }

                        this.EventBus.emit('chat-rooms-updated');
                        this.$nextTick(() => this.scrollToBottomSafe());

                        // AbortController 정리
                        delete this.agentAbortControllers[abortKey];

                        // WorkAssistantChatPanel의 "툴 호출 기반 동작"까지 동일하게 수행
                        try {
                            await this.handleAgentDirectiveToolCalls({ assistantUuid, userText, agentId });
                        } catch (e) {
                            // ignore
                        }

                        // PDF2BPMN 작업 감지 및 events watch 시작 (메인 에이전트 기준)
                        try {
                            if (agentId === PROCESS_GPT_AGENT_ID) {
                                const msgObj = this.messages.find((m) => m?.uuid === assistantUuid);
                                const toolCalls = Array.isArray(msgObj?.toolCalls) ? msgObj.toolCalls : [];
                                const roomId = this.currentChatRoom?.id || this.roomId || null;
                                this.checkAndSubscribePdf2Bpmn(safeFinal || full || '', toolCalls, roomId);
                            }
                        } catch (e) {
                            // ignore
                        }
                    },
                    onError: async () => {
                        delete this.agentAbortControllers[abortKey];
                        const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                        if (idx !== -1) {
                            const current = (this.messages[idx].content || '').toString();
                            this.messages[idx].content = current ? current : '(에이전트 응답 오류)';
                            this.messages[idx].isLoading = false;
                        }
                        this.setAgentStatus(agentId, { state: 'error', message: '응답 오류' });
                    }
                };

                if (agentId === PROCESS_GPT_AGENT_ID) {
                    await workAssistantAgentService.sendMessageStream(
                        commonParams,
                        {
                            ...callbacks,
                            onAbort: () => {
                                delete this.agentAbortControllers[abortKey];
                                const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                                if (idx !== -1) {
                                    this.messages[idx].isLoading = false;
                                }
                                this.setAgentStatus(agentId, { state: 'ready', message: '' });
                            }
                        },
                        { signal: abortController.signal }
                    );
                } else {
                    await agentRouterService.sendMessageStream(
                        agentId,
                        commonParams,
                        {
                            ...callbacks,
                            onAbort: () => {
                                delete this.agentAbortControllers[abortKey];
                                const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
                                if (idx !== -1) {
                                    this.messages[idx].isLoading = false;
                                }
                                this.setAgentStatus(agentId, { state: 'ready', message: '' });
                            }
                        },
                        { signal: abortController.signal }
                    );
                }
            });

            await Promise.all(promises);
        },

        /**
         * WorkAssistantChatPanel에서 구현된 "도구 호출 결과 기반 동작"을 ChatRoomPage에서도 수행
         * - start_process_consulting: 컨설팅 UI 오픈 + 초기 메시지 전달
         * - generate_process: 프로세스 정의 생성 화면 이동(/definitions/chat)
         */
        async handleAgentDirectiveToolCalls({ assistantUuid, userText, agentId }) {
            const idx = this.messages.findIndex((m) => m?.uuid === assistantUuid);
            if (idx === -1) return;

            const msg = this.messages[idx] || {};
            const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
            if (toolCalls.length === 0) return;

            const pageEditToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('edit_hwpx_page_html'));

            const startConsultingToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('start_process_consulting'));
            const generateProcessToolCall = [...toolCalls]
                .reverse()
                .find((tc) => typeof tc?.name === 'string' && tc.name.includes('generate_process'));
            if (!pageEditToolCall?.name && !startConsultingToolCall?.name && !generateProcessToolCall?.name) return;

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

            // 1) 프로세스 컨설팅 시작 → 컨설팅 다이얼로그 오픈 + 초기 메시지 전달
            if (startConsultingToolCall?.name?.includes('start_process_consulting')) {
                // 메인 에이전트(work-assistant / process-gpt-agent)에서만 컨설팅 트리거 허용 (오동작 방지)
                if (agentId && agentId !== PROCESS_GPT_AGENT_ID) return;

                let imageAnalysis = null;
                let parsedDirective = null;
                try {
                    const parsed = this.parseToolOutput(startConsultingToolCall.output);
                    parsedDirective = parsed && typeof parsed === 'object' ? parsed : null;
                    if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                        imageAnalysis = parsed.image_analysis_result;
                    }
                } catch (e) {
                    // ignore
                }

                const shouldShowConsultingNotice = parsedDirective?.user_request_type === 'start_process_consulting';
                if (shouldShowConsultingNotice) {
                    const consultingStartMessage = '프로세스 컨설팅을 시작합니다. 말씀하신 내용의 프로세스 초안을 생성하겠습니다.';
                    if (this.messages[idx]) {
                        this.messages[idx].content = consultingStartMessage;
                        this.messages[idx].contentType = 'text';
                        this.messages[idx].isLoading = false;
                    }

                    await backend.putObject(`db://chats/${assistantUuid}`, {
                        uuid: assistantUuid,
                        id: this.currentChatRoom?.id,
                        messages: { ...(this.messages[idx] || msg), content: consultingStartMessage, isLoading: false }
                    });

                    if (this.currentChatRoom) {
                        this.currentChatRoom.message = {
                            msg: consultingStartMessage.substring(0, 50),
                            type: 'text',
                            createdAt: new Date().toISOString()
                        };
                        await backend.putObject('db://chat_rooms', this.currentChatRoom);
                    }
                }

                const originalMessage = imageAnalysis
                    ? `${(userText || '').toString()}\n\n[이미지 분석 결과]\n${imageAnalysis}`
                    : `${(userText || '').toString()}\n\n[전체 요청 및 첨부 이미지 분석 내용]: ${JSON.stringify(
                          startConsultingToolCall.output ?? null
                      )}`;

                // WorkAssistantChatPanel 방식: 컨설팅은 다이얼로그가 아니라 ConsultingGenerator 1회 실행으로 처리
                await this.switchToConsultingMode(originalMessage, { keepLastAssistantMessage: shouldShowConsultingNotice });
                return;
            }

            // 2) 생성 확정 → definitions 생성 화면으로 전환
            if (generateProcessToolCall?.name?.includes('generate_process')) {
                if (agentId && agentId !== PROCESS_GPT_AGENT_ID) return;
                const messagesForDefinition = this.buildMessagesForDefinitionGeneration();
                this.$store.dispatch('updateMessages', messagesForDefinition);
                this.$router.push('/definitions/chat');
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
                    await backend.putObject('db://chat_rooms', this.currentChatRoom);
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
                    lastMessage.content = me.extractConsultingText(responseObj.content) || normalizedContent || '응답을 받았지만 표시할 텍스트를 찾지 못했습니다.';
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

                const pdf2bpmnTool = toolCalls.find((t) => t?.name && t.name.includes('create_pdf2bpmn_workitem'));
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
                        let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
                        content += `${processCount}개의 프로세스가 생성되었습니다.`;

                        const msgObj = me.createMessageObj(content, 'assistant');
                        msgObj.pdf2bpmnResult = {
                            processCount,
                            savedProcesses: resultData.saved_processes || [],
                            generatedBpmns,
                            taskId,
                            savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                            savedAgents: resultData.saved_agents || resultData.savedAgents || []
                        };
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
                progress.message = progress.message || 'PDF2BPMN 작업 시작 대기 중...';
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

                switch (eventType) {
                    case 'task_started':
                        progressState.isActive = true;
                        progressState.status = 'started';
                        progressState.progress = progress || 5;
                        progressState.message = message || 'PDF2BPMN 작업 시작됨';
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
                        const errorMsg = me.createMessageObj(`PDF2BPMN 변환 실패: ${messageData.error || '알 수 없는 오류'}`, 'assistant');
                        if (me.currentChatRoom?.id === targetRoomId) {
                            me.messages.push(errorMsg);
                        }
                        me.saveMessageToRoom(errorMsg, targetRoomId);
                        break;
                    }
                    default:
                        if (progress > 0) progressState.progress = Math.max(progressState.progress, progress);
                        if (message) progressState.message = message;
                }
            } catch (e) {
                // ignore
            }
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

            let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
            content += `${processCount}개의 프로세스가 생성되었습니다.\n\n`;
            content += `\n프로세스 정의가 저장되었습니다. 왼쪽 메뉴에서 확인할 수 있습니다.`;

            const msgObj = me.createMessageObj(content, 'assistant');
            msgObj.pdf2bpmnResult = {
                processCount,
                savedProcesses,
                generatedBpmns: progressState.generatedBpmns,
                taskId,
                savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                savedAgents: resultData.saved_agents || resultData.savedAgents || []
            };

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
                    (t) => t?.name && (t.name.includes('create_pdf2bpmn_workitem') || t.name.includes('pdf2bpmn'))
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

            // bpmn_xml/definition이 없으면 DB에서 로드
            if ((!bpmn.bpmn_xml || !bpmn.definition) && bpmn.process_id && window.$supabase) {
                try {
                    const { data, error } = await window.$supabase
                        .from('proc_def')
                        .select('bpmn, definition')
                        .eq('id', bpmn.process_id)
                        .single();
                    if (!error && data) {
                        if (data.bpmn) bpmn.bpmn_xml = data.bpmn;
                        if (data.definition) bpmn.definition = data.definition;
                    }
                } catch (e) {
                    // ignore
                }
            }

            me.selectedBpmn = bpmn;
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
        async showIntegratedGraphByTask(taskId) {
            const me = this;
            const resolvedTaskId = String(taskId || '').trim();
            if (!resolvedTaskId) return;

            me.selectedBpmn = {
                process_name: 'PDF2BPMN 통합 그래프',
                isIntegratedGraph: true,
                task_id: resolvedTaskId
            };
            me.bpmnViewMode = 'ontology';
            me.neo4jGraphLoading = true;
            me.neo4jGraphError = '';
            me.neo4jGraphElements = [];
            me.bpmnPreviewDialog = true;

            try {
                const base = await me._resolvePdf2BpmnApiBase();
                const url = `${base}/graph/requests/${encodeURIComponent(resolvedTaskId)}`;
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

            me.neo4jGraphLoading = true;
            me.neo4jGraphError = '';

            try {
                const base = await me._resolvePdf2BpmnApiBase();
                const url = `${base}/processes/${encodeURIComponent(neo4jProcId)}/graph`;
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
            }

            return text;
        },

        normalizeAssistantMessageForDisplay(message) {
            if (!message || typeof message !== 'object') return message;
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

            if (outputStr.includes('"user_request_type": "start_process_consulting"')) {
                return { user_request_type: 'start_process_consulting' };
            }
            if (outputStr.includes('"user_request_type": "generate_process"')) {
                return { user_request_type: 'generate_process' };
            }

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

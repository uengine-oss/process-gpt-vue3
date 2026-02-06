<template>
    <v-card elevation="10" class="is-work-height chat-room-page-card">
        <div class="chat-room-page">
            <div v-if="!roomId && !userId && !isAnyDraftContextView" class="empty-state">
                <v-icon size="40" color="grey-lighten-1">mdi-message-text-outline</v-icon>
                <div class="text-subtitle-1 mt-2">대화를 선택해주세요</div>
                <div class="text-caption text-medium-emphasis">
                    좌측 사이드바의 대화목록에서 대화를 선택하거나 새 대화를 만들어주세요.
                </div>
            </div>

            <div v-else-if="isLoadingRoom" class="loading-state">
                <v-progress-circular indeterminate color="primary" :size="28" />
                <span class="ml-2 text-caption">채팅을 불러오는 중...</span>
            </div>

            <div v-else-if="roomId" class="chat-container">
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
                                <div class="room-name">{{ currentChatRoom?.name || '대화' }}</div>
                                <div class="room-subtitle text-caption text-medium-emphasis d-flex align-center" style="gap: 8px;">
                                    <v-btn
                                        variant="text"
                                        density="compact"
                                        class="participants-summary-btn"
                                        @click="openParticipantsView"
                                    >
                                        <v-icon size="16" class="mr-1">mdi-account-multiple</v-icon>
                                        <span class="participants-count">{{ (currentChatRoom?.participants || []).length }}</span>
                                    </v-btn>
                                    <!-- 에이전트 연결중(웜업) 표시: 참가자 옆 원형 로딩 -->
                                    <v-progress-circular
                                        v-if="hasAgentWarming"
                                        indeterminate
                                        color="primary"
                                        :size="14"
                                        :width="2"
                                    />
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
                    />
                </div>

                <!-- 입력 영역(임시): 이후 UnifiedChatInput으로 교체 -->
                <div class="input-area">
                    <UnifiedChatInput
                        ref="composer"
                        variant="inline"
                        :showExamples="false"
                        :disableChat="isSending || hasAbortableStream"
                        :showStopButton="hasAbortableStream"
                        :userList="userList"
                        :currentChatRoom="currentChatRoom"
                        @sendMessage="handleSendMessage"
                        @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
                    />
                </div>
            </div>

            <div v-else-if="userId" class="chat-container">
                <div v-if="isLoadingTargetUser" class="loading-state">
                    <v-progress-circular indeterminate color="primary" :size="28" />
                    <span class="ml-2 text-caption">유저 정보를 불러오는 중...</span>
                </div>

                <template v-else-if="targetUser">
                    <div class="messages-area">
                        <div class="header-bar">
                            <div class="header-left">
                                <div class="avatar-wrap">
                                    <v-avatar size="28" color="grey-lighten-3">
                                        <img :src="getParticipantProfile(targetUser)" :alt="getParticipantAlt(targetUser)" class="avatar-img" />
                                    </v-avatar>
                                </div>
                                <div class="header-title">
                                    <div class="room-name">{{ draftName || '새 채팅' }}</div>
                                    <div class="room-subtitle text-caption text-medium-emphasis">
                                        {{ targetUser?.username || targetUser?.email || 'User' }}
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
                            :currentChatRoom="draftUserContextRoom"
                            :chatRoomId="''"
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
                        />
                    </div>

                    <div class="input-area">
                        <UnifiedChatInput
                            ref="composer"
                            variant="inline"
                            :showExamples="false"
                            :disableChat="isSending || hasAbortableStream"
                            :showStopButton="hasAbortableStream"
                            :userList="userList"
                            :currentChatRoom="draftUserContextRoom"
                            @sendMessage="handleSendMessageUserContextDraft"
                            @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
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
                                    <img :src="getParticipantProfile(contextAgent)" :alt="getParticipantAlt(contextAgent)" class="avatar-img" />
                                </v-avatar>
                            </div>
                            <div class="header-title">
                                <div class="room-name">{{ draftName || '새 채팅' }}</div>
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
                        @preview-image="openImagePreview"
                        @open-external-url="openExternalUrl"
                        @beforeReply="handleBeforeReply"
                    />
                </div>

                <div class="input-area">
                    <UnifiedChatInput
                        ref="composer"
                        variant="inline"
                        :showExamples="false"
                        :disableChat="isSending || hasAbortableStream"
                        :showStopButton="hasAbortableStream"
                        :userList="userList"
                        :currentChatRoom="draftContextRoom"
                        @sendMessage="handleSendMessageContextDraft"
                        @stopMessage="stopAgentsInRoom(currentChatRoom?.id || roomId)"
                    />
                </div>
            </div>
        </div>

        <!-- 참여자 보기 -->
        <v-dialog v-model="participantsViewDialog" max-width="520">
            <v-card class="pa-2" style="border-radius: 16px;">
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
                        <v-list-item
                            v-for="(p, idx) in participantUsersForView"
                            :key="(p && (p.id || p.email)) || idx"
                        >
                            <template v-slot:prepend>
                                <v-avatar size="28" color="grey-lighten-3">
                                    <img :src="getParticipantProfile(p)" :alt="getParticipantAlt(p)" class="avatar-img" />
                                </v-avatar>
                            </template>
                            <v-list-item-title>{{ p.username || p.name || p.email || p.id }}</v-list-item-title>
                            <v-list-item-subtitle>{{ p.email || (p.id ? ('ID: ' + p.id) : '') }}</v-list-item-subtitle>
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
            <v-card class="pa-2" style="border-radius: 16px;">
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
                    <v-btn @click="participantsDialog = false" icon variant="text" density="comfortable" style="margin-top:-8px;">
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
                        :item-value="item => item"
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
                                :text="item.raw.username ? item.raw.username:item.raw.email"
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
                                :text="item.raw.username ? item.raw.username:item.raw.email"
                            />
                        </template>
                    </v-autocomplete>
                    <div class="text-caption text-grey mt-2">
                        - 내 계정은 자동으로 포함됩니다.
                    </div>
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
            <v-card class="pa-2" style="border-radius: 16px;">
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
                    "{{ currentChatRoom?.name || '대화' }}" {{ $t('chatListing.confirmDeleteChatRoom') || '채팅방을 삭제하시겠습니까?' }}
                    <div class="text-caption text-medium-emphasis mt-2">
                        - 삭제하면 복구할 수 없습니다.
                    </div>
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
                    <v-btn-toggle v-model="bpmnViewMode" mandatory density="compact" class="mr-2">
                        <v-btn value="diagram" size="small">
                            <v-icon size="18" :color="bpmnViewMode === 'diagram' ? 'primary' : undefined">mdi-sitemap</v-icon>
                        </v-btn>
                        <v-btn value="xml" size="small">
                            <v-icon size="18" :color="bpmnViewMode === 'xml' ? 'primary' : undefined">mdi-xml</v-icon>
                        </v-btn>
                    </v-btn-toggle>
                    <v-btn icon variant="text" @click="bpmnPreviewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <div v-if="bpmnViewMode === 'diagram'" class="bpmn-diagram-container">
                        <ProcessDefinition
                            v-if="selectedBpmn?.bpmn_xml"
                            :bpmn="selectedBpmn.bpmn_xml"
                            :key="selectedBpmn?.process_name"
                            isViewMode="true"
                            isAIGenerated="true"
                        />
                    </div>
                    <div v-else class="bpmn-preview-container">
                        <pre class="bpmn-xml-content">{{ selectedBpmn?.bpmn_xml }}</pre>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-btn v-if="bpmnViewMode === 'xml'" variant="tonal" @click="copyBpmnToClipboard">
                        <v-icon class="mr-1">mdi-content-copy</v-icon>
                        XML 복사
                    </v-btn>
                    <v-btn v-if="bpmnViewMode === 'diagram'" variant="tonal" @click="openInModeler">
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
                    <v-img
                        v-if="previewImageUrl"
                        :src="previewImageUrl"
                        max-height="600"
                        contain
                    />
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';
import Chat from '@/components/ui/Chat.vue';
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
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
    tools: 'get_process_list, get_process_detail, get_form_fields, execute_process, get_instance_list, get_todolist, get_organization, generate_process, start_process_consulting, create_pdf2bpmn_workitem',
};

export default {
    name: 'ChatRoomPage',
    props: {
        embedded: { type: Boolean, default: false },
        contextAgentId: { type: String, default: null },
        contextUserId: { type: String, default: null },
        initialRoomId: { type: String, default: null },
    },
    components: {
        UnifiedChatInput,
        Chat,
        ProcessDefinition
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

            isSending: false,
            // 메시지 전송 중복 방지(더블 submit 등)
            _lastClientSendKey: null,
            _lastClientSendAt: 0,

            // draft settings (새 채팅)
            draftName: '새 채팅',
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
            bpmnViewMode: 'diagram',
            selectedBpmn: null,
            imagePreviewDialog: false,
            previewImageUrl: null,

            // 스트리밍 중지(Abort) 컨트롤러: roomId:agentId 단위
            agentAbortControllers: {},

            // settings UI
            settingsMenu: false,
            renameDialog: false,
            renameDraft: '',
            participantsDialog: false,
            participantsDraft: [],
            deleteDialog: false,
        };
    },
    computed: {
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
            if (this.isUserContextRouted) return (this.targetUser?.id || this.targetUser?.uid || this.userId || null);
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
                const found = Array.isArray(this.userList)
                    ? this.userList.find(u => this.participantMatches(u, np))
                    : null;
                return {
                    ...(found ? { ...np, ...found } : np),
                    __idx: idx
                };
            });
            // 참여자 목록: 내 계정 최상단 고정(나 외에는 기존 순서 유지)
            merged.sort((a, b) => {
                const aIsMe = !!(me && this.participantMatches(a, me));
                const bIsMe = !!(me && this.participantMatches(b, me));
                if (aIsMe && !bIsMe) return -1;
                if (!aIsMe && bIsMe) return 1;
                return (a.__idx ?? 0) - (b.__idx ?? 0);
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
                const isAgent = isProcessGpt || (np.agent_type === 'agent') || (np.is_agent === true) || !!agent;
                if (!isAgent) return;
                if (!uniq.has(np.id)) uniq.set(np.id, { ...np, ...agent, id: np.id });
            });
            return Array.from(uniq.values());
        },
        // 참가자 영역 "연결중" 로딩바용 (warmup 중인 에이전트가 있는가)
        hasAgentWarming() {
            return (this.agentParticipants || []).some((a) => this.getAgentStatus(a.id)?.state === 'warming');
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
            return state || {
                isActive: false,
                taskId: null,
                status: '',
                progress: 0,
                message: '',
                generatedBpmns: []
            };
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
                this.contextAgent = this.defaultSetting?.getAgentById?.(this.contextAgentId) || { id: this.contextAgentId, username: 'Agent' };
            }
                this.resetDraft();
        }
    },
    watch: {
        roomId: {
            immediate: true,
            async handler(newRoomId, oldRoomId) {
                if (!newRoomId) return;
                if (newRoomId === oldRoomId) return;
                await this.bootstrapRoom(newRoomId);
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
        }
    },
    async beforeUnmount() {
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
    },
    methods: {
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
                    title: r.name || '대화'
                }));

                const initial = this.initialRoomId || null;
                const existsInitial = initial && this.contextRoomTabs.some(t => t.roomId === initial);
                if (existsInitial) {
                    this.activeRoomId = initial;
                    this.contextTabIndex = Math.max(0, this.contextRoomTabs.findIndex(t => t.roomId === initial));
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
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !payload.file)) return;
            if (!this.userInfo || !this.targetUser) return;

            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = !!payload.file;
            if (!text && !hasImages && !hasFile) return;

            this.isSending = true;
            try {
                const me = this.normalizeParticipant(this.userInfo);
                const tu = this.normalizeParticipant(this.targetUser);
                const roomId = this.uuid();
                const nowIso = new Date().toISOString();

                const room = {
                    id: roomId,
                    name: String(this.draftName || '새 채팅').trim().substring(0, 50) || '새 채팅',
                    participants: this.getDraftParticipantsFallback([me, tu]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso }
                };

                await backend.putObject('db://chat_rooms', room);

                const msgUuid = this.uuid();
                const msg = {
                    uuid: msgUuid,
                    role: 'user',
                    content: text || (hasFile ? '첨부된 파일을 확인해주세요.' : '첨부된 내용을 확인해주세요.'),
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: payload.file || null
                };
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

                // room last message
                room.message = { msg: (msg.content || '').substring(0, 50), type: 'text', createdAt: nowIso };
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
            }
        },
        async handleSendMessageContextDraft(payload) {
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !payload.file)) return;
            if (!this.userInfo || !this.contextAgentId) return;

            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = !!payload.file;
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
                    name: String(this.draftName || '새 채팅').trim().substring(0, 50) || '새 채팅',
                    participants: this.getDraftParticipantsFallback([me, ag]),
                    message: { msg: 'NEW', type: 'text', createdAt: nowIso }
                };

                await backend.putObject('db://chat_rooms', room);

                const msgUuid = this.uuid();
                const msg = {
                    uuid: msgUuid,
                    role: 'user',
                    content: text || (hasFile ? '첨부된 파일을 확인해주세요.' : '첨부된 내용을 확인해주세요.'),
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: payload.file || null
                };
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

                room.message = { msg: (msg.content || '').substring(0, 50), type: 'text', createdAt: nowIso };
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
            }
        },
        resetDraft() {
            this.draftName = '새 채팅';
            const me = this.normalizeParticipant(this.userInfo);
            const target = this.isDraftContextView ? this.normalizeParticipant(this.contextAgent) : this.normalizeParticipant(this.targetUser);
            this.draftParticipants = [me, target].filter(Boolean);
        },
        getDraftParticipantsFallback(fallbackParts) {
            const me = this.normalizeParticipant(this.userInfo);
            const normalized = (this.draftParticipants || []).map(this.normalizeParticipant).filter(Boolean);
            const base = normalized.length > 0 ? normalized : (fallbackParts || []).filter(Boolean);
            const ensureMe = me && !base.some(p => this.participantMatches(p, me)) ? [...base, me] : base;
            // 최소 2명(나+상대) 보장
            return ensureMe.filter(Boolean);
        },
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
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
                this.userList = [
                    processGptAgent,
                    ...withoutMe.filter(u => (u?.id || u?.uid) !== processGptAgent.id)
                ];
            } catch (e) {
                this.userList = [processGptAgent];
            } finally {
                this.isLoadingUsers = false;
            }
        },
        async bootstrapRoom(roomId) {
            this.isLoadingRoom = true;
            try {
                this.userInfo = await backend.getUserInfo();
                if (!this.userList || this.userList.length === 0) {
                    await this.loadUserList();
                }
                await this.loadRoom(roomId);
                await this.loadMessages(roomId);
                await this.subscribeToRoom(roomId);
                this.EventBus.emit('chat-room-selected', roomId);
                this.warmupAgentsForCurrentRoom();
                this.$nextTick(() => this.scrollToBottomSafe());

                // definition-map 메인 채팅에서 생성된 방: 첫 메시지에 대한 에이전트 응답 kick-off
                await this.maybeKickoffFromSession(roomId);
            } catch (e) {
                this.currentChatRoom = null;
                this.messages = [];
            } finally {
                this.isLoadingRoom = false;
            }
        },
        async maybeKickoffFromSession(roomId) {
            try {
                const raw = sessionStorage.getItem(`chatKickoff:${roomId}`);
                if (!raw) return;
                const payload = JSON.parse(raw);
                if (!payload || payload.roomId !== roomId) return;

                // 이미 메시지가 존재하는지 확인(중복 방지)
                const exists = this.messages.find(m => m?.uuid === payload.msgUuid);
                if (!exists) return;

                // 내가 보낸 메시지인지 확인
                const myEmail = this.userInfo?.email || null;
                if (myEmail && exists?.email && exists.email !== myEmail) return;

                // 1회만 실행
                sessionStorage.removeItem(`chatKickoff:${roomId}`);

                const agentTargets = await this.resolveAgentTargetsForMessage(payload.text || '');
                if (agentTargets.length > 0) {
                    await this.streamAgents(agentTargets, payload.text || '', {
                        images: payload.images || [],
                        file: payload.file || null
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
            const found = (rooms || []).find(r => r.id === roomId) || null;
            this.currentChatRoom = found || { id: roomId, name: '대화', participants: [] };
        },
        async loadMessages(roomId) {
            this.messages = [];
            const rows = await backend.getMessages(roomId);
            if (rows && rows.length > 0) {
                const all = rows.map((row) => {
                    const m = row.messages || {};
                    m.uuid = row.uuid || m.uuid || this.uuid();
                    return m;
                });
                all.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                this.messages = all;
            }
            // 기존 채팅방 재진입 시: 이전 pdf2bpmn 작업 감지/구독 복구
            await this.checkExistingPdf2BpmnTask(roomId);
            this.$nextTick(() => this.scrollToBottomSafe());
        },
        async subscribeToRoom(roomId) {
            try {
                if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                    await this.chatsWatchRef.unsubscribe();
                }
            } catch (e) {}
            this.chatsWatchRef = null;
            if (!roomId) return;
            this.chatsWatchRef = await backend.watchChats((payload) => {
                this.handleRealtimeMessage(payload);
            }, { filter: `id=eq.${roomId}` });
        },
        handleRealtimeMessage(payload) {
            try {
                if (!payload) return;
                if (payload.eventType === 'DELETE') {
                    const oldUuid = payload.old?.uuid;
                    if (!oldUuid) return;
                    const idx = this.messages.findIndex(m => m.uuid === oldUuid);
                    if (idx !== -1) this.messages.splice(idx, 1);
                    return;
                }
                if (!payload.new) return;
                const roomId = payload.new.id;
                if (!this.roomId || roomId !== this.roomId) return;
                const incoming = payload.new.messages;
                if (!incoming) return;
                const uuid = payload.new.uuid || incoming.uuid;
                if (!uuid) return;
                const exists = this.messages.findIndex(m => m.uuid === uuid);
                if (exists !== -1) {
                    this.messages[exists] = incoming;
                    return;
                }
                // uuid가 다르게 들어오는 경우(또는 이중 submit)로 인한 중복 방지: 내용/작성자/시간이 거의 동일하면 덮어쓰기
                try {
                    const inRole = (incoming.role || '').toString();
                    const inEmail = (incoming.email || '').toString();
                    const inContent = (incoming.content || '').toString();
                    const inTs = new Date(incoming.timeStamp || 0).getTime();
                    const dupIdx = this.messages.findIndex(m => {
                        if (!m) return false;
                        if ((m.role || '').toString() !== inRole) return false;
                        if ((m.email || '').toString() !== inEmail) return false;
                        if ((m.content || '').toString() !== inContent) return false;
                        const mts = new Date(m.timeStamp || 0).getTime();
                        return Math.abs(mts - inTs) <= 1500;
                    });
                    if (dupIdx !== -1) {
                        // 들어온 것을 기준으로 최신화(단, uuid는 row uuid로 맞춰준다)
                        this.messages[dupIdx] = { ...incoming, uuid };
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
            this.renameDraft = (this.currentChatRoom?.id ? (this.currentChatRoom?.name || '') : (this.draftName || '새 채팅')).toString();
            this.renameDialog = true;
        },
        async confirmRename() {
            const trimmed = String(this.renameDraft || '').trim().substring(0, 50);
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
                ? (Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [])
                : (Array.isArray(this.draftParticipants) ? this.draftParticipants : []);
            const me = this.normalizeParticipant(this.userInfo);
            const normalized = parts.map(this.normalizeParticipant).filter(Boolean);
            const hasMe = me ? normalized.some(p => this.participantMatches(p, me)) : false;
            const withMe = hasMe ? normalized : [...normalized, me].filter(Boolean);
            // autocomplete items와 shape 맞추기
            this.participantsDraft = withMe.map(p => {
                const u = this.userList.find(x => this.participantMatches(x, p));
                return u || p;
            });
            this.participantsDialog = true;
        },
        async saveParticipants() {
            try {
                const me = this.normalizeParticipant(this.userInfo);
                const normalized = (this.participantsDraft || []).map(this.normalizeParticipant).filter(Boolean);
                const ensureMe = me && !normalized.some(p => this.participantMatches(p, me))
                    ? [...normalized, me]
                    : normalized;
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
            await Promise.all(agents.map(async (a) => {
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
            }));
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
        async handleSendMessage(payload) {
            if (!payload || (!payload.text && (!payload.images || payload.images.length === 0) && !payload.file)) return;
            if (!this.currentChatRoom?.id) return;
            // 더블 submit 방지
            if (this.isSending) return;
            const text = (payload.text || '').trim();
            const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
            const hasFile = !!payload.file;
            if (!text && !hasImages && !hasFile) return;

            try {
                const keyObj = {
                    text: text || '',
                    imgCount: hasImages ? (payload.images || []).length : 0,
                    fileName: hasFile ? (payload.file?.name || payload.file?.fileName || '') : '',
                };
                const key = JSON.stringify(keyObj);
                const now = Date.now();
                if (this._lastClientSendKey === key && (now - (this._lastClientSendAt || 0)) < 800) {
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
                    role: 'user',
                    content: text || (hasFile ? '첨부된 파일을 확인해주세요.' : '첨부된 내용을 확인해주세요.'),
                    timeStamp: nowIso,
                    email: this.userInfo?.email || null,
                    name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                    images: payload.images || [],
                    pdfFile: payload.file || null
                };
                await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: this.currentChatRoom.id, messages: msg });

                // last message update
                this.currentChatRoom.message = { msg: (msg.content || '').substring(0, 50), type: 'text', createdAt: nowIso };
                await backend.putObject('db://chat_rooms', this.currentChatRoom);

                this.messages.push(msg);
                this.EventBus.emit('chat-rooms-updated');
                this.$nextTick(() => this.scrollToBottomSafe());

                // ---- 멀티 에이전트 라우팅/스트리밍 ----
                const agentTargets = await this.resolveAgentTargetsForMessage(msg.content || '');
                if (agentTargets.length > 0) {
                    await this.streamAgents(agentTargets, msg.content || '', payload);
                }
            } catch (e) {
                // ignore
            } finally {
                this.isSending = false;
            }
        },

        getAgentCandidates() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            const candidates = parts
                .map(p => this.normalizeParticipant(p))
                .filter(p => p && p.id)
                .map(p => {
                    const agent = p?.id ? this.defaultSetting?.getAgentById?.(p.id) : null;
                    // 참가자 객체에 is_agent/agent_type가 없을 수 있어 defaultSetting도 활용
                    const isProcessGpt = p.id === PROCESS_GPT_AGENT_ID;
                    const isAgent = isProcessGpt || (p.agent_type === 'agent') || (p.is_agent === true) || !!agent;
                    if (!isAgent) return null;
                    return {
                        id: p.id,
                        username: (p.id === PROCESS_GPT_AGENT_ID ? 'Process GPT Agent' : (agent?.username || p.username || p.email || p.id)),
                        email: agent?.email || p.email || null,
                        profile: agent?.profile || p.profile || null,
                        alias: agent?.alias || ''
                    };
                })
                .filter(Boolean);

            // dedupe by id
            const uniq = new Map();
            candidates.forEach(a => {
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
            return parts.map(p => this.normalizeParticipant(p)).filter(Boolean);
        },

        isOneOnOneWithSingleAgent(agentId) {
            // "나 + 에이전트 1명"만 있는 경우(시스템은 무시)
            const me = this.normalizeParticipant(this.userInfo);
            const parts = this.getNormalizedParticipants().filter(p => !this.isSystemParticipant(p));
            if (!me?.id && !me?.email) return false;
            const isMe = (p) => {
                if (!p) return false;
                if (me.id && p.id && p.id === me.id) return true;
                if (me.email && p.email && p.email === me.email) return true;
                return false;
            };
            const others = parts.filter(p => !isMe(p));
            if (others.length !== 1) return false;
            const onlyOther = others[0];
            const otherId = onlyOther?.id || null;
            return !!otherId && otherId === agentId;
        },

        buildRecentHistoryForRouting(limit = 10) {
            const msgs = Array.isArray(this.messages) ? this.messages : [];
            const recent = msgs
                .filter(m => m && !m.isLoading && (m.content || '').toString().trim())
                .slice(-Math.max(5, Math.min(10, limit)));
            if (recent.length === 0) return '(없음)';
            return recent.map(m => {
                const role = (m.role || '').toString();
                const content = (m.content || '').toString().replace(/\s+/g, ' ').trim().substring(0, 600);
                if (role === 'user') {
                    const name = (m.name || m.userName || m.email || 'user').toString();
                    return `[user][${name}]: ${content}`;
                }
                const name = (m.name || m.userName || 'assistant').toString();
                const agentId = (m.agentId || '').toString();
                return agentId ? `[assistant][${name}][agentId=${agentId}]: ${content}` : `[assistant][${name}]: ${content}`;
            }).join('\n');
        },

        buildAgentsInfoForRouting(agentCandidates) {
            const list = Array.isArray(agentCandidates) ? agentCandidates : [];
            if (list.length === 0) return '(없음)';
            const lines = list.map(a => {
                const id = a?.id;
                if (!id) return null;
                if (id === PROCESS_GPT_AGENT_ID) {
                    const m = MAIN_PROCESS_GPT_AGENT_META;
                    return `- id=${m.id}, name=${m.username}, alias=${m.alias}, role=${m.role}, goal=${m.goal}, description=${m.description}, tools=${m.tools}`;
                }
                const meta = this.defaultSetting?.getAgentById?.(id) || {};
                const name = a?.username || meta?.username || id;
                const alias = a?.alias || meta?.alias || '';
                const role = meta?.role || '';
                const goal = meta?.goal || '';
                const persona = meta?.persona || '';
                const description = meta?.description || '';
                const tools = meta?.tools || '';
                const skills = meta?.skills ? JSON.stringify(meta.skills) : '';
                return `- id=${id}, name=${name}, alias=${alias}, role=${role}, goal=${goal}, persona=${persona}, description=${description}, tools=${tools}, skills=${skills}`;
            }).filter(Boolean);
            return lines.length > 0 ? lines.join('\n') : '(없음)';
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
            const idx = this.messages.findIndex(m => m?.uuid === uuid);
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

        async resolveAgentTargetsForMessage(text) {
            const agents = this.getAgentCandidates();
            if (agents.length === 0) return [];

            const mentions = this.parseMentions(text);
            if (mentions.length > 0) {
                // 멘션 있음: 멘션된 에이전트만 반드시 응답 (기존 동작 유지)
                const norm = (v) => (v || '').toString().toLowerCase().replace(/\s+/g, '');
                const mentionSet = new Set(mentions.map(norm));
                const matched = agents.filter(a => {
                    const keys = [a.username, a.alias, a.id].filter(Boolean).map(norm);
                    return keys.some(k => mentionSet.has(k));
                });
                return matched.map(a => ({ ...a, policy: 'must_reply' }));
            }

            // 멘션 없음:
            // 1) "나 + 에이전트 1명" 1:1이면 무조건 응답
            if (agents.length === 1) {
                const only = agents[0];
                if (only?.id && this.isOneOnOneWithSingleAgent(only.id)) {
                    return [{ ...only, policy: 'must_reply' }];
                }
            }

            // 2) 그 외(그룹 채팅, 에이전트 2+, 또는 에이전트 1명+일반 유저 포함)는 router가 선별
            const routingLoadingUuid = this.addRoutingLoadingMessage();
            const recent_history = this.buildRecentHistoryForRouting(10);
            const agents_info = this.buildAgentsInfoForRouting(agents);
            const candidate_agent_ids = agents.map(a => a.id).filter(Boolean);
            try {
                const routed = await agentRouterService.routeAgents({
                    user_message: (text || '').toString(),
                    recent_history,
                    agents_info,
                    candidate_agent_ids,
                    conversation_id: this.currentChatRoom?.id || null,
                });
                const should = !!routed?.should_intervene;
                const selected = Array.isArray(routed?.selected_agent_ids) ? routed.selected_agent_ids : [];
                const selectedSet = new Set(selected.map(v => (v || '').toString()).filter(Boolean));
                if (!should || selectedSet.size === 0) {
                    this.removeRoutingLoadingMessage(routingLoadingUuid);
                    return [];
                }
                const picked = agents.filter(a => selectedSet.has(a.id));
                if (picked.length === 0) {
                    this.removeRoutingLoadingMessage(routingLoadingUuid);
                    return [];
                }
                return picked.map(a => ({
                    ...a,
                    policy: 'must_reply',
                    __routingLoadingUuid: routingLoadingUuid,
                    __routingDecision: {
                        should_intervene: true,
                        reply_mode: routed?.reply_mode || null,
                        reason: routed?.reason || '',
                        confidence: routed?.confidence ?? null,
                        agent_selection_reason: routed?.agent_selection_reason || null,
                    }
                }));
            } catch (e) {
                // fallback: 메인만 호출(단, 방에 참여 중인 경우)
                const main = agents.find(a => a?.id === PROCESS_GPT_AGENT_ID);
                if (!main) {
                    this.removeRoutingLoadingMessage(routingLoadingUuid);
                    return [];
                }
                return [{
                    ...main,
                    policy: 'must_reply',
                    __routingLoadingUuid: routingLoadingUuid,
                    __routingDecision: {
                        should_intervene: true,
                        reply_mode: 'answer',
                        reason: 'router_failed_fallback_to_main',
                        confidence: null,
                        agent_selection_reason: null,
                    }
                }];
            }
        },

        buildMessageForAgent(userText, payload, policy) {
            let messageForAgent = (userText || '').toString();
            // 첨부 정보는 기존 방식처럼 [InputData]로 전달
            if ((payload?.images && payload.images.length > 0) || payload?.file) {
                const inputData = {};
                if (payload?.images && payload.images.length > 0) inputData.images = payload.images;
                if (payload?.file) inputData.file = payload.file;
                messageForAgent += `\n\n[InputData]\n${JSON.stringify(inputData)}`;
            }

            // must_reply (침묵 정책 제거)
            return messageForAgent;
        },

        async streamAgents(agentTargets, userText, payload) {
            const userJwt = await getValidToken() || '';
            const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';

            // remove routing loading bubble once we start calling agents
            const routingUuid = (agentTargets || []).find(t => t?.__routingLoadingUuid)?.__routingLoadingUuid || null;
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
                    this.messages.push({ ...assistantMsgBase, content: assistantMsgBase.content || (full || '') });
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
                        const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                        if (idx !== -1) {
                            this.messages[idx].content = '(에이전트 준비 실패)';
                            this.messages[idx].isLoading = false;
                        }
                        return;
                    }
                }

                const commonParams = {
                    message: messageForAgent,
                    tenant_id: tenantId,
                    user_uid: this.userInfo?.uid || this.userInfo?.id,
                    user_email: this.userInfo?.email,
                    user_name: this.userInfo?.name || this.userInfo?.username,
                    user_jwt: userJwt,
                    conversation_id: this.currentChatRoom?.id,
                    metadata: agentTarget?.__routingDecision ? { routing: agentTarget.__routingDecision } : {}
                };

                // AbortController 등록 (중지 버튼)
                const targetRoomId = this.currentChatRoom?.id || this.roomId || '';
                const abortController = new AbortController();
                const abortKey = `${targetRoomId}:${agentId}:${assistantUuid}`;
                this.agentAbortControllers[abortKey] = abortController;

                const callbacks = {
                        onToken: (token) => {
                            full += token;
                            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                            if (idx !== -1) {
                                this.messages[idx].content = full.length === 0 ? '생각 중...' : full;
                                this.messages[idx].isLoading = true;
                            }
                            this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                            maybeScroll();
                        },
                        onToolStart: (tool, input) => {
                            try {
                                const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                                if (idx === -1) return;
                                const name = (tool?.name || tool || '').toString();
                                if (!name) return;
                                const cur = this.messages[idx];
                                const toolCalls = Array.isArray(cur.toolCalls) ? cur.toolCalls : [];
                                // 중복 방지
                                const exists = toolCalls.some(t => (t?.name || '') === name && (t?.status || '') === 'running');
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
                                const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                                if (idx === -1) return;
                                const cur = this.messages[idx];
                                const toolCalls = Array.isArray(cur.toolCalls) ? cur.toolCalls : [];
                                // 마지막 running tool을 done 처리
                                for (let i = toolCalls.length - 1; i >= 0; i--) {
                                    if (toolCalls[i]?.status === 'running') {
                                        toolCalls[i] = { ...toolCalls[i], status: 'done', output: output ?? null, endedAt: new Date().toISOString() };
                                        break;
                                    }
                                }
                                this.messages[idx].toolCalls = toolCalls;
                                maybeScroll();
                            } catch (e) {}
                        },
                        onDone: async (content) => {
                            const finalContent = (content || full || '').toString().trim();
                            // 침묵 정책 제거: NO_RESPONSE도 그대로 텍스트로 표시하지 않도록 빈 값 처리
                            const safeFinal = finalContent === 'NO_RESPONSE' ? '' : finalContent;

                            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                            if (idx !== -1) {
                                this.messages[idx].content = safeFinal || full || '';
                                this.messages[idx].isLoading = false;
                                this.messages[idx].contentType = 'text';
                            }
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });

                            // DB 저장
                            await backend.putObject(`db://chats/${assistantUuid}`, {
                                uuid: assistantUuid,
                                id: this.currentChatRoom?.id,
                                messages: { ...(this.messages[idx] || assistantMsgBase), content: safeFinal || full || '', isLoading: false }
                            });

                            // last message 업데이트(가장 마지막 완료 응답 기준으로 덮어쓰기)
                            if (this.currentChatRoom) {
                                this.currentChatRoom.message = {
                                    msg: (safeFinal || '').substring(0, 50),
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
                                    const msgObj = this.messages.find(m => m?.uuid === assistantUuid);
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
                            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                            if (idx !== -1) {
                                const current = (this.messages[idx].content || '').toString();
                                this.messages[idx].content = current ? current : '(에이전트 응답 오류)';
                                this.messages[idx].isLoading = false;
                            }
                            this.setAgentStatus(agentId, { state: 'error', message: '응답 오류' });
                        }
                    };

                if (agentId === PROCESS_GPT_AGENT_ID) {
                    await workAssistantAgentService.sendMessageStream(commonParams, {
                        ...callbacks,
                        onAbort: () => {
                            delete this.agentAbortControllers[abortKey];
                            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                            if (idx !== -1) {
                                this.messages[idx].isLoading = false;
                            }
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });
                        }
                    }, { signal: abortController.signal });
                } else {
                    await agentRouterService.sendMessageStream(agentId, commonParams, {
                        ...callbacks,
                        onAbort: () => {
                            delete this.agentAbortControllers[abortKey];
                            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
                            if (idx !== -1) {
                                this.messages[idx].isLoading = false;
                            }
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });
                        }
                    }, { signal: abortController.signal });
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
            const idx = this.messages.findIndex(m => m?.uuid === assistantUuid);
            if (idx === -1) return;

            const msg = this.messages[idx] || {};
            const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
            if (toolCalls.length === 0) return;

            const directiveToolCall = [...toolCalls].reverse().find(tc =>
                typeof tc?.name === 'string' && (
                    tc.name.includes('start_process_consulting') ||
                    tc.name.includes('generate_process')
                )
            );
            if (!directiveToolCall?.name) return;

            // 1) 프로세스 컨설팅 시작 → 컨설팅 다이얼로그 오픈 + 초기 메시지 전달
            if (directiveToolCall.name.includes('start_process_consulting')) {
                // 메인 에이전트(work-assistant / process-gpt-agent)에서만 컨설팅 트리거 허용 (오동작 방지)
                if (agentId && agentId !== PROCESS_GPT_AGENT_ID) return;

                let imageAnalysis = null;
                try {
                    const parsed = this.parseToolOutput(directiveToolCall.output);
                    if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                        imageAnalysis = parsed.image_analysis_result;
                    }
                } catch (e) {
                    // ignore
                }

                const originalMessage = imageAnalysis
                    ? `${(userText || '').toString()}\n\n[이미지 분석 결과]\n${imageAnalysis}`
                    : `${(userText || '').toString()}\n\n[전체 요청 및 첨부 이미지 분석 내용]: ${JSON.stringify(directiveToolCall.output ?? null)}`;

                // WorkAssistantChatPanel 방식: 컨설팅은 다이얼로그가 아니라 ConsultingGenerator 1회 실행으로 처리
                await this.switchToConsultingMode(originalMessage);
                return;
            }

            // 2) 생성 확정 → definitions 생성 화면으로 전환
            if (directiveToolCall.name.includes('generate_process')) {
                if (agentId && agentId !== PROCESS_GPT_AGENT_ID) return;
                this.$store.dispatch('updateMessages', this.messages);
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
                    userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
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
                agentId:'process-gpt-agent',
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

        // 컨설팅 모드로 전환 (프로세스 생성용) - start_process_consulting 도구 호출 시마다 1회 실행
        async switchToConsultingMode(userMessage) {
            const me = this;

            me.generator = new ConsultingGenerator(me, {
                isStream: true,
                preferredLanguage: 'Korean'
            });

            me.isConsultingMode = true;

            // 마지막 assistant 메시지 제거 (에이전트의 start_process_consulting 응답을 대체)
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].role !== 'user') {
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
            let jsonData = response;
            if (typeof response === 'string') {
                try {
                    if (response.includes('{')) {
                        const jsonMatch = response.match(/\{[\s\S]*\}/);
                        if (jsonMatch) jsonData = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    // JSON 파싱 실패 시 원본 사용
                    jsonData = response;
                }
            }

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

            if (responseObj && (responseObj.answerType || responseObj.validity)) {
                if (me.messages.length > 0) {
                    const lastMessage = me.messages[me.messages.length - 1];
                    if (lastMessage.role === 'assistant' && !lastMessage.uuid) {
                        lastMessage.uuid = me.uuid();
                    }
                    lastMessage.content = responseObj.content;
                    if (!lastMessage.isLoading) {
                        await me.saveMessage(lastMessage);
                    }
                }

                if (responseObj.answerType === 'generateProcessDef') {
                    me.$store.dispatch('updateMessages', me.messages);
                    me.$router.push('/definitions/chat');
                    return;
                }
            }

            if (me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                if (!lastMsg.uuid) lastMsg.uuid = me.uuid();
                if (!lastMsg.isLoading) await me.saveMessage(lastMsg);
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

                const pdf2bpmnTool = toolCalls.find(t => t?.name && t.name.includes('create_pdf2bpmn_workitem'));
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
                    const resultData = typeof completedEvent.data === 'string'
                        ? JSON.parse(completedEvent.data)
                        : completedEvent.data;
                    await me.showCompletedTaskResult(resultData, targetRoomId);
                    return;
                }

                const { data: todo, error } = await window.$supabase
                    .from('todolist')
                    .select('id, status')
                    .eq('id', taskId)
                    .single();

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

        async showCompletedTaskResult(resultData, roomId) {
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

                    const hasResult = me.messages.some(m => m.pdf2bpmnResult);
                    if (!hasResult && generatedBpmns.length > 0) {
                        const processCount = resultData.process_count || generatedBpmns.length;
                        let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
                        content += `${processCount}개의 프로세스가 생성되었습니다.`;

                        const msgObj = me.createMessageObj(content, 'assistant');
                        msgObj.pdf2bpmnResult = {
                            processCount,
                            savedProcesses: resultData.saved_processes || [],
                            generatedBpmns
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
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('id, query, agent_orch, start_date')
                    .eq('agent_orch', 'pdf2bpmn')
                    .gte('start_date', fiveMinAgo)
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
                            const existing = progressState.generatedBpmns.find(b => b.process_id === messageData.process_id);
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
                        me.addPdf2BpmnResultMessage(messageData, targetRoomId);
                        setTimeout(() => {
                            const st = me._getOrInitPdf2bpmnProgress(targetRoomId);
                            if (st) st.isActive = false;
                        }, 3000);
                        break;
                    case 'error': {
                        progressState.isActive = true;
                        progressState.status = 'failed';
                        progressState.message = messageData.error || message || '작업 실패';
                        const errorMsg = me.createMessageObj(
                            `PDF2BPMN 변환 실패: ${messageData.error || '알 수 없는 오류'}`,
                            'assistant'
                        );
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

        async addPdf2BpmnResultMessage(resultData, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentChatRoom?.id;
            if (!targetRoomId) return;
            const progressState = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (!progressState) return;

            const processCount = resultData.process_count || progressState.generatedBpmns.length;
            const savedProcesses = resultData.saved_processes || [];

            let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
            content += `${processCount}개의 프로세스가 생성되었습니다.\n\n`;
            content += `\n프로세스 정의가 저장되었습니다. 왼쪽 메뉴에서 확인할 수 있습니다.`;

            const msgObj = me.createMessageObj(content, 'assistant');
            msgObj.pdf2bpmnResult = {
                processCount,
                savedProcesses,
                generatedBpmns: progressState.generatedBpmns
            };

            if (me.currentChatRoom?.id === targetRoomId) {
                // 중복 결과 메시지 방지
                const hasResult = me.messages.some(m => m.pdf2bpmnResult);
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
                const pdf2bpmnTool = toolCalls.find(t =>
                    t?.name && (t.name.includes('create_pdf2bpmn_workitem') || t.name.includes('pdf2bpmn'))
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
            if (responseText && (
                responseText.includes('PDF') ||
                responseText.includes('pdf2bpmn') ||
                responseText.includes('BPMN') ||
                responseText.includes('워크아이템') ||
                responseText.includes('변환')
            )) {
                setTimeout(() => me.checkAndWatchPdf2BpmnTodo(targetRoomId), 1000);
            }

            return false;
        },

        // ===== 프리뷰 UI =====

        async showBpmnPreview(bpmn) {
            const me = this;
            if (!bpmn) return;

            if (!bpmn.bpmn_xml && bpmn.process_id && window.$supabase) {
                try {
                    const { data, error } = await window.$supabase
                        .from('proc_def')
                        .select('bpmn')
                        .eq('id', bpmn.process_id)
                        .single();
                    if (!error && data?.bpmn) {
                        bpmn.bpmn_xml = data.bpmn;
                    }
                } catch (e) {
                    // ignore
                }
            }

            me.selectedBpmn = bpmn;
            me.bpmnPreviewDialog = true;
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

        // MCP 도구 output 파싱 (WorkAssistantChatPanel의 구현을 동일하게 사용)
        parseToolOutput(outputStr) {
            if (!outputStr) return null;

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

            // content='...' name=... 형식 처리 (Python ToolMessage repr 형식)
            if (typeof outputStr === 'string' && outputStr.startsWith('content=')) {
                try {
                    const contentStart = "content='".length;
                    const endMarkers = [/' name=/, /' tool_call_id=/];
                    let endIdx = -1;

                    for (const marker of endMarkers) {
                        const match = outputStr.match(marker);
                        if (match && (endIdx === -1 || match.index < endIdx)) {
                            endIdx = match.index;
                        }
                    }

                    if (endIdx > contentStart) {
                        const raw = outputStr.substring(contentStart, endIdx);

                        const normalizeNewlines = (val) => {
                            if (typeof val !== 'string') return val;
                            return val
                                .replace(/\\\\\\\\n/g, '\\\\n')
                                .replace(/\\\\n/g, '\n');
                        };

                        const rawSanitized = sanitizeForJsonParse(raw);
                        try {
                            const parsed = JSON.parse(rawSanitized);
                            if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                                parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
                            }
                            return parsed;
                        } catch (e1) {
                            let jsonStr = raw.replace(/\\\\\\\\/g, '\\\\').replace(/\\\\"/g, '\\"');
                            try {
                                const parsed = JSON.parse(sanitizeForJsonParse(jsonStr));
                                if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                                    parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
                                }
                                return parsed;
                            } catch (e2) {
                                if (outputStr.includes('"user_request_type": "start_process_consulting"')) {
                                    return { user_request_type: 'start_process_consulting' };
                                }
                                if (outputStr.includes('"user_request_type": "generate_process"')) {
                                    return { user_request_type: 'generate_process' };
                                }
                                throw e2;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[ChatRoomPage.parseToolOutput] content= 형식 파싱 실패:', e.message);
                }
            }

            // 일반 JSON 문자열
            if (typeof outputStr === 'string') {
                try {
                    return JSON.parse(sanitizeForJsonParse(outputStr));
                } catch (e) {
                    console.warn('[ChatRoomPage.parseToolOutput] JSON 파싱 실패:', e.message);
                    return null;
                }
            }

            // 이미 객체인 경우
            return outputStr;
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

.messages-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding-bottom: 24px; /* 내부 스크롤 여유(추가 여유는 Chat.vue chat-view-box padding으로 보강) */
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
    color: rgba(0, 0, 0, 0.80);
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
</style>


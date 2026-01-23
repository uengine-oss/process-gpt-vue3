<template>
    <v-card elevation="10">
        <AppBaseCard :isInstanceChat="isInstanceChat">
            <template v-if="!isInstanceChat" v-slot:leftpart="{ closeDrawer }">
                <div class="no-scrollbar">
                    <v-tabs v-model="activeTab" grow color="primary">
                        <v-tab>
                            <v-icon class="mt-1 mr-2">mdi-account</v-icon>
                            {{ $t('chat.user') }}
                        </v-tab>
                        <v-tab>
                            <v-icon class="mt-1 mr-2">mdi-message</v-icon>
                            {{ $t('chat.chatRoom') }}
                        </v-tab>
                    </v-tabs>
                    <v-window v-model="activeTab">
                        <v-window-item :value="0">
                            <!-- <ChatProfile style="margin-bottom: -15px;" /> -->
                            <!-- <v-divider class="my-2"></v-divider> -->
                            <UserListing :userList="userList" @selectedUser="selectedUser" @startChat="startChat" />
                        </v-window-item>
                        <v-window-item :value="1">
                            <ChatListing
                                :chatRoomList="filteredChatRoomList"
                                :userList="userList"
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                :closeDrawer="closeDrawer"
                                :enableGroupChat="true"
                                @chat-selected="chatRoomSelected"
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-window-item>
                    </v-window>
                </div>
            </template>
            <template v-slot:rightpart>
                <div :key="chatRenderKey" class="chat-info-view-wrapper-chats">
                    <div v-if="!currentChatRoom || !chatRoomId" class="empty-chat-placeholder">
                        <div class="empty-chat-content">
                            <v-icon size="80" color="grey-lighten-1">mdi-message-outline</v-icon>
                            <h3 class="mt-4 mb-2 text-h6 text-grey-darken-1">채팅방을 선택해주세요</h3>
                            <p class="text-body-2 text-grey-darken-1">왼쪽에서 채팅방을 선택하거나 새로운 채팅방을 생성해주세요.</p>
                        </div>
                    </div>
                    <GroupChat
                        v-else
                        ref="chatTempRef"
                        :messages="messages"
                        :userInfo="userInfo"
                        :userList="userList"
                        :currentChatRoom="currentChatRoom"
                        :type="path"
                        :generatedWorkList="generatedWorkList"
                        :ProcessGPTActive="ProcessGPTActive"
                        :isSystemChat="isSystemChat"
                        :chatRoomId="chatRoomId"
                        :newMessageInfo="newMessageInfo"
                        :participantUsers="computedParticipantUsers"
                        @requestDraftAgent="requestDraftAgent"
                        @requestFile="requestFile"
                        @beforeReply="beforeReply"
                        @sendMessage="beforeSendMessage"
                        @startProcess="startProcess"
                        @executeProcess="handleExecuteProcess"
                        @cancelProcess="cancelProcess"
                        @deleteWorkList="deleteWorkList"
                        @deleteAllWorkList="deleteAllWorkList"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                        @toggleProcessGPTActive="toggleProcessGPTActive"
                        @startWorkOrder="startWorkOrder"
                    >
                        <template v-slot:custom-chat-top>
                            <div class="custom-top-area">
                                <div class="position-fixed">
                                    <div v-if="attachments.length > 0">
                                        <v-tooltip text="Attachments" location="right">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    v-bind="props"
                                                    @click="toggleAttachments"
                                                    icon
                                                    variant="text"
                                                    class="text-medium-emphasis"
                                                >
                                                    <v-icon v-if="isAttachmentsOpen">mdi-close</v-icon>
                                                    <v-icon v-else>mdi-chevron-down</v-icon>
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </div>
                                    <Attachments :isOpen="isAttachmentsOpen" :attachments="attachments" />
                                </div>
                                <ScenarioScript
                                    :currentChatRoom="currentChatRoom"
                                    :chatRoomId="chatRoomId"
                                    :messages="messages"
                                    @message-sent="handleScenarioMessageSent"
                                    @scroll-to-bottom="handleScenarioScrollToBottom"
                                />
                            </div>
                        </template>
                    </GroupChat>
                </div>
            </template>

            <template v-if="!isInstanceChat" v-slot:mobileLeftContent="{ closeDrawer }">
                <div class="no-scrollbar">
                    <v-tabs v-model="activeTab">
                        <v-tab>
                            <v-icon class="mt-1 mr-2">mdi-account</v-icon>
                            {{ $t('chat.user') }}
                        </v-tab>
                        <v-tab>
                            <v-icon class="mt-1 mr-2">mdi-message</v-icon>
                            {{ $t('chat.chatRoom') }}
                        </v-tab>
                    </v-tabs>
                    <v-window v-model="activeTab">
                        <v-window-item :value="0">
                            <!-- <ChatProfile style="margin-bottom: -15px;" /> -->
                            <!-- <v-divider class="my-2"></v-divider> -->
                            <UserListing :userList="userList" @selectedUser="selectedUser" @startChat="startChat" />
                        </v-window-item>
                        <v-window-item :value="1">
                            <ChatListing
                                :chatRoomList="filteredChatRoomList"
                                :userList="userList"
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                :closeDrawer="closeDrawer"
                                :enableGroupChat="true"
                                @chat-selected="chatRoomSelected"
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-window-item>
                    </v-window>
                </div>
            </template>
        </AppBaseCard>
        <v-dialog v-model="openWorkOrderDialog" persistent :fullscreen="isMobile" max-width="80%">
            <v-row class="ma-0 pa-0">
                <v-col v-if="!isMobile && assistantRes" class="pa-0 mr-2" cols="4">
                    <v-card>
                        <div class="description-card">
                            123123
                            <v-card-title><h3>Title:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-textarea rows="1" v-model="assistantRes.title" auto-grow></v-textarea>
                            </v-card-text>
                            <v-card-title><h3>Specific:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-textarea rows="1" v-model="assistantRes.specific" auto-grow></v-textarea>
                            </v-card-text>
                            <v-card-title><h3>Measurable:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-textarea rows="1" v-model="assistantRes.measurable" auto-grow></v-textarea>
                            </v-card-text>
                            <v-card-title><h3>Attainable:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-textarea rows="1" v-model="assistantRes.attainable" auto-grow></v-textarea>
                            </v-card-text>
                            <v-card-title><h3>Relevant:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-textarea rows="1" v-model="assistantRes.relevant" auto-grow></v-textarea>
                            </v-card-text>
                            <v-card-title><h3>Time-bound:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4">
                                <v-col class="pa-0" style="max-width: 100%" cols="12" sm="6" md="4">
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
                                                v-model="assistantRes.time_bound"
                                                prepend-icon="mdi-calendar"
                                                v-bind="attrs"
                                                v-on="on"
                                            ></v-text-field>
                                        </template>
                                        <v-date-picker v-model="assistantRes.time_bound" @input="timeBoundMenu = false"></v-date-picker>
                                    </v-menu>
                                </v-col>
                            </v-card-text>
                            <v-card-title><h3>Descriptions:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4 mb-4">
                                <div v-for="(desc, index) in assistantRes.descriptions" :key="index">
                                    <h4>{{ desc.word }}:</h4>
                                    {{ desc.description }}
                                </div>
                            </v-card-text>
                            <v-card-title><h3>CheckList:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-2 pr-2">
                                <v-checkbox
                                    v-for="(check, index) in assistantRes.checkPoints"
                                    :key="index"
                                    :label="check"
                                    readonly
                                    v-model="checked"
                                    class="delete-input-details"
                                ></v-checkbox>
                            </v-card-text>
                        </div>
                        <v-row class="pa-0">
                            <v-col cols="12" class="pa-6">
                                <v-btn block @click="workOrder" rounded color="primary">{{ $t('chats.assignTask') }}</v-btn>
                            </v-col>
                        </v-row>
                    </v-card>
                </v-col>
                <v-col class="pa-0">
                    <v-card>
                        <v-card-title
                            style="height: 55px; background-color: rgb(var(--v-theme-primary), 0.15) !important; align-content: center"
                        >
                            <v-icon small style="margin-right: 10px">mdi-file-document</v-icon>
                            {{ $t('chats.document') }}
                            <v-icon @click="closeWorkOrderDialog()" small style="margin-right: 5px; float: right">mdi-close</v-icon>
                        </v-card-title>
                        <AssistantChats @genFinished="genFinished" @clickedWorkOrder="workOrder" />
                    </v-card>
                </v-col>
            </v-row>
        </v-dialog>
    </v-card>
</template>

<script>
import AssistantChats from '../chat/AssistantChats.vue';
import Attachments from './Attachments.vue';
import ChatModule from '@/components/ChatModule.vue';
import WorkAssistantGenerator from '@/components/ai/WorkAssistantGenerator.js';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import UserListing from '@/components/apps/chats/UserListing.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import GroupChat from '@/components/ui/GroupChat.vue';
import ScenarioScript from '@/components/groupchat/ScenarioScript.vue';
import axios from 'axios';
import partialParse from 'partial-json-parser';

export default {
    mixins: [ChatModule],
    name: 'GroupChats',
    components: {
        GroupChat,
        AppBaseCard,
        ChatListing,
        UserListing,
        AssistantChats,
        Attachments,
        ScenarioScript
    },
    emits: ['selectedUser', 'startChat', 'chat-selected', 'create-chat-room', 'delete-chat-room', 'genFinished', 'clickedWorkOrder'],
    props: {
        isInstanceChat: {
            type: Boolean,
            default: false
        },
        instanceInfo: {
            type: Object,
            default: null
        },
        participantUsersProp: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        path: 'chats',
        userList: [],
        chatRenderKey: 0,
        generatedWorkList: [],
        activeTab: 1,

        // assistantChat
        checked: true,
        openWorkOrderDialog: false,
        assistantRes: null,
        selectedUserInfo: null,
        timeBoundMenu: false,
        myChatRoomIds: [],

        // attachments
        isAttachmentsOpen: false,
        attachments: [],
        
        // 메시지 로드 시점 추적 (중복 방지용)
        messagesLoadedAt: null,
        watchChatsSubscription: null,
        // putMessage 중복 호출 방지 (대본 모드용)
        savingMessageIds: new Set(),
        // 실시간 실패 시 개입 결과 폴링용
        interventionPollers: {}
    }),
    computed: {
        filteredChatRoomList() {
            // 그룹채팅: chat_type이 'group'인 채팅방만 필터링
            const groupChatRooms = this.chatRoomList.filter((room) => {
                // chat_type이 명시적으로 'group'인 경우만 포함
                // chat_type이 없거나 'single'인 경우는 제외
                return room.chat_type === 'group';
            });
            return groupChatRooms.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
        },
        computedParticipantUsers() {
            // prop으로 받은 participantUsersProp이 있으면 사용, 없으면 currentChatRoom의 participants 사용
            if (this.participantUsersProp && this.participantUsersProp.length > 0) {
                return this.participantUsersProp;
            }
            if (this.currentChatRoom && this.currentChatRoom.participants) {
                return this.currentChatRoom.participants.map((participant) => ({
                    id: participant.id,
                    email: participant.email,
                    username: participant.username || participant.email,
                    profile: participant.profile || '/images/defaultUser.png'
                }));
            }
            return [];
        }
    },
    watch: {
        currentChatRoom: {
            async handler(newVal, oldVal) {
                if (newVal && newVal.id) {
                    if (this.generator) {
                        this.chatRoomId = newVal.id;
                        // setChatRoomData는 일부 generator에만 있음
                        if (this.generator.setChatRoomData) {
                            this.generator.setChatRoomData(newVal);
                        }
                        await this.getAttachments();
                    } else {
                        this.generator = new WorkAssistantGenerator(this, {
                            isStream: true,
                            preferredLanguage: 'Korean'
                        });
                    }
                }
            },
            deep: true
        }
    },
    async mounted() {
        await this.init();

        this.userInfo = await this.backend.getUserInfo();

        await this.getUserList();

        if (this.isInstanceChat) {
            await this.getChatRoom();
        } else {
            await this.getChatRoomList();
        }

        await this.getAttachments();

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        if (this.$route.query.id) {
            this.chatRoomSelected(this.chatRoomList.find((room) => room.id === this.$route.query.id));
        }

        // 정의 맵에서 업무지시 버튼 클릭으로 이동한 경우 다이얼로그 열기
        if (this.$route.query.openWorkOrder === 'true') {
            this.startWorkOrder();
            // query parameter 제거
            this.$router.replace({ path: '/chats-temp' });
        }

        if (this.currentChatRoom && this.currentChatRoom.id) {
            this.chatRoomId = this.currentChatRoom.id;
        }

        if (!this.generator) {
            this.generator = new WorkAssistantGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
        }
    },
    beforeUnmount() {
        this.EventBus.emit('chat-room-unselected');
        // 구독 정리
        if (this.watchChatsSubscription) {
            try {
                if (typeof this.watchChatsSubscription.unsubscribe === 'function') {
                    this.watchChatsSubscription.unsubscribe();
                } else if (typeof this.watchChatsSubscription === 'function') {
                    this.watchChatsSubscription();
                }
            } catch (e) {
                console.warn('구독 정리 실패:', e);
            }
            this.watchChatsSubscription = null;
        }
    },
    methods: {
        restoreInputFocus() {
            // GroupChat 컴포넌트의 입력 필드에 포커스 복원
            if (this.$refs.chatTempRef) {
                // GroupChat 컴포넌트의 입력 필드(textarea) 찾기
                const textarea = this.$refs.chatTempRef.$el?.querySelector('textarea.message-input-box, textarea.cp-chat');
                if (textarea) {
                    // 약간의 지연을 두고 포커스 설정 (리렌더링 완료 후)
                    setTimeout(() => {
                        textarea.focus();
                        // 커서를 텍스트 끝으로 이동
                        const length = textarea.value.length;
                        textarea.setSelectionRange(length, length);
                    }, 50);
                }
            }
        },
        toggleAttachments() {
            this.isAttachmentsOpen = !this.isAttachmentsOpen;
        },
        scrollToBottomSafe(label = '') {
            this.$nextTick(() => {
                const gc = this.$refs.chatTempRef;
                if (gc && typeof gc.scrollToBottom === 'function') {
                    gc.scrollToBottom();
                }
            });
        },
        async handleScenarioMessageSent({ message, chatRoomId, text, userId, userMessageUuid }) {
            // 중복 호출 방지: 같은 ID로 이미 처리 중이면 무시
            if (message.id && this.savingMessageIds.has(message.id)) {
                console.log('⚠️ [handleScenarioMessageSent] 이미 처리 중인 메시지 ID, 무시', { id: message.id });
                return;
            }
            
            // 처리 중 표시
            if (message.id) {
                this.savingMessageIds.add(message.id);
            }
            
            try {
                // 1. 먼저 messages 배열에 추가 (화면에 즉시 표시)
                const isDuplicate = this.messages.some((msg) => msg.id === message.id);
                if (!isDuplicate) {
                    this.messages.push(message);
                    this.scrollToBottomSafe('scenario-push');
                    console.log('✅ [handleScenarioMessageSent] 메시지 화면 추가', {
                        id: message.id,
                        content: message.content?.substring(0, 50)
                    });
                }
                
                // 2. DB에 저장
                await this.putMessage(message, chatRoomId);
                console.log('✅ [handleScenarioMessageSent] DB 저장 완료', { 
                    id: message.id
                });
                
                // 3. Agent 개입 검사 (메시지가 messages 배열에 있으므로 찾을 수 있음)
                await this.handleAgentIntervention(text, chatRoomId, userId, message.id);
            } catch (error) {
                console.warn('❌ [handleScenarioMessageSent] 시나리오 메시지 저장 실패:', error);
                // 저장 실패 시 화면에서도 제거
                if (message.id) {
                    const index = this.messages.findIndex((msg) => msg.id === message.id);
                    if (index !== -1) {
                        this.messages.splice(index, 1);
                    }
                }
            } finally {
                // 처리 완료 후 Set에서 제거
                if (message.id) {
                    this.savingMessageIds.delete(message.id);
                }
            }
        },
        handleScenarioScrollToBottom(label) {
            this.scrollToBottomSafe(label);
        },
        async getAttachments() {
            await this.backend.getAttachments(this.chatRoomId, (attachment) => {
                if (this.attachments.find((a) => a.id == attachment.id)) {
                    return;
                } else {
                    this.attachments.push(attachment);
                }
            });
        },
        selectedUser(user) {
            this.selectedUserInfo = user;
        },
        startChat(type) {
            let chatRoomInfo;
            const selectedUserEmail = this.selectedUserInfo.email || this.selectedUserInfo.id;
            const selectedUserName = this.selectedUserInfo.username || this.selectedUserInfo.name;
            const currentUserEmail = this.userInfo.email || this.userInfo.id;
            const currentUserName = this.userInfo.username || this.userInfo.name;

            if (type == 'work') {
                chatRoomInfo = {};
                chatRoomInfo.name = this.selectedUserInfo.username;
                chatRoomInfo.participants = [];
                chatRoomInfo.participants.push(this.selectedUserInfo);
                this.createChatRoom(chatRoomInfo);
            } else {
                const chatRoomExists = this.chatRoomList.some((chatRoom) => {
                    if (chatRoom.participants.length == 2) {
                        const participantEmails = chatRoom.participants.map((participant) => participant.email);
                        const participantNames = chatRoom.participants.map((participant) => participant.username);
                        chatRoomInfo = chatRoom;
                        return participantEmails.includes(currentUserEmail) && participantEmails.includes(selectedUserEmail);
                    } else {
                        return false;
                    }
                });

                if (chatRoomExists) {
                    this.chatRoomSelected(chatRoomInfo);
                } else {
                    chatRoomInfo = {};
                    chatRoomInfo.name = this.selectedUserInfo.username;
                    chatRoomInfo.participants = [];
                    chatRoomInfo.participants.push(this.selectedUserInfo);
                    this.createChatRoom(chatRoomInfo);
                }
            }

            this.activeTab = 0;

            if (type == 'work') {
                this.startWorkOrder();
            }
        },
        genFinished(responseObj) {
            console.log(responseObj);
            this.assistantRes = responseObj;
        },
        workOrder() {
            this.ProcessGPTActive = false;
            this.beforeSendMessage({
                image: null,
                // text: this.assistantRes.content,
                text: this.assistantRes.title,
                mentionedUsers: [],
                attainable: this.assistantRes.attainable,
                measurable: this.assistantRes.measurable,
                relevant: this.assistantRes.relevant,
                specific: this.assistantRes.specific,
                time_bound: this.assistantRes.time_bound,
                title: this.assistantRes.title,
                descriptions: this.assistantRes.descriptions,
                checkPoints: this.assistantRes.checkPoints
            });
            this.closeWorkOrderDialog();
        },
        startWorkOrder() {
            this.openWorkOrderDialog = true;
            this.assistantRes = null;
        },
        closeWorkOrderDialog() {
            this.openWorkOrderDialog = false;
        },
        toggleProcessGPTActive() {
            this.ProcessGPTActive = !this.ProcessGPTActive;
        },
        async getUserList() {
            var me = this;
            await me.backend.getUserList().then(function (users) {
                if (users) {
                    users = users.filter((user) => user.email !== me.userInfo.email);
                    const systemUser = {
                        email: 'system@uengine.org',
                        id: 'system_id',
                        username: 'System',
                        is_admin: true,
                        notifications: null
                    };
                    users.unshift(systemUser);
                    me.userList = users;
                }
            });
        },
        async getChatRoom() {
            var me = this;
            let chatRoom = await me.backend.getChatRoom(this.instanceInfo.instId + '_chat');
            if (chatRoom) {
                me.chatRoomList.push(chatRoom);
                me.currentChatRoom = chatRoom;
                me.chatRoomSelected(chatRoom);
            } else {
                // 인스턴스 참가자들을 채팅 참가자로 추가
                let participants = [];

                this.instanceInfo.participants.forEach((participant) => {
                    const user = this.userList.find((user) => user.email === participant);
                    if (user) {
                        participants.push(user);
                    }
                });

                let instanceChatRoom = {
                    id: this.instanceInfo.instId + '_chat',
                    name: `인스턴스: ${this.instanceInfo.name}`,
                    participants: participants
                };

                // createChatRoom 호출해서 채팅방 생성
                me.createChatRoom(instanceChatRoom);
                me.chatRoomSelected(instanceChatRoom);
            }

            if (me.chatRoomList.length > 0) {
                me.myChatRoomIds.push(me.currentChatRoom.id);
                me.setWatchChatList(me.myChatRoomIds);
            }
        },
        async getChatRoomList() {
            var me = this;

            // RLS 정책 문제 해결: 직접 Supabase 쿼리 사용
            const userTenantId = me.userInfo.tenant_id || 'localhost';
            const { data: chatRooms, error } = await window.$supabase.from('chat_rooms').select('*').eq('tenant_id', userTenantId);
            
            if (error || !chatRooms) {
                console.error('채팅방 조회 실패:', error);
                return;
            }

            me.myChatRoomIds = [];
            me.chatRoomList = [];

            chatRooms.forEach(function (chatRoom) {
                    // participants가 배열인지 확인
                    if (!chatRoom.participants || !Array.isArray(chatRoom.participants)) {
                        return;
                    }

                    // email 비교 (대소문자 무시, trim 처리)
                    const currentUserEmail = (me.userInfo.email || '').toLowerCase().trim();

                    let existUserInfo = chatRoom.participants.find((participant) => {
                        if (!participant || !participant.email) {
                            return false;
                        }
                        const participantEmail = (participant.email || '').toLowerCase().trim();
                        return participantEmail === currentUserEmail;
                    });

                    if (existUserInfo) {
                        // 그룹채팅 페이지에서는 chat_type이 'group'인 채팅방만 추가
                        if (chatRoom.chat_type !== 'group') {
                            return;
                        }

                        // 참가자 정보가 없거나 불완전한 경우 보완
                        if (existUserInfo.isExistUnReadMessage === undefined) {
                            existUserInfo.isExistUnReadMessage = false;
                        }

                        me.chatRoomList.push(chatRoom);
                        me.myChatRoomIds.push(chatRoom.id);

                        if (existUserInfo.isExistUnReadMessage) {
                            window.dispatchEvent(
                                new CustomEvent('update-notification-badge', {
                                    detail: { type: 'chat', value: true, id: chatRoom.id }
                                })
                            );
                        }
                    }
                });

            // 필터링된 그룹채팅방이 있으면 첫 번째 채팅방 선택
            if (me.filteredChatRoomList.length > 0) {
                me.currentChatRoom = me.filteredChatRoomList[0];
                // getMessages가 완료된 후에만 실시간 구독 시작 (중복 방지)
                await me.chatRoomSelected(me.currentChatRoom);
                me.setWatchChatList(me.myChatRoomIds);
                me.setReadMessage(0);
            } else {
                me.currentChatRoom = null;
                me.chatRoomId = null;
                me.messages = [];
            }
        },
        async deleteChatRoom(chatRoomId) {
            try {
                // 그룹 채팅 메시지 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
                try {
                    const { error } = await window.$supabase
                        .from('group_chat_messages')
                        .delete()
                        .eq('chat_room_id', chatRoomId);
                    if (error) {
                        console.warn('그룹 채팅 메시지 삭제 실패 (CASCADE로 자동 삭제될 수 있음):', error);
                    }
                } catch (e) {
                    console.warn('그룹 채팅 메시지 삭제 중 오류:', e);
                }
                
                // 먼저 서버에서 삭제 요청
                await Promise.all([
                    this.backend.delete(`chat_rooms/${chatRoomId}`, { key: 'id' })
                ]);

                // 서버 삭제가 완료된 후 로컬 상태 업데이트
                let index = this.chatRoomList.findIndex((room) => room.id === chatRoomId);
                if (index !== -1) {
                    this.chatRoomList.splice(index, 1);
                }

                // 현재 선택된 채팅방이 삭제된 채팅방인 경우
                if (this.currentChatRoom && this.currentChatRoom.id === chatRoomId) {
                    if (this.filteredChatRoomList && this.filteredChatRoomList.length > 0) {
                        this.chatRoomSelected(this.filteredChatRoomList[0]);
                    } else {
                        this.currentChatRoom = null;
                        this.chatRoomId = null;
                        this.messages = [];
                    }
                }
            } catch (error) {
                console.error('채팅방 삭제 실패:', error);
                // 에러 발생 시 사용자에게 알림
                alert('채팅방 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
                // 에러가 발생해도 로컬에서 제거된 경우 다시 추가하지 않음
                // (이미 UI에서 제거되었을 수 있으므로)
            }
        },
        async createChatRoom(chatRoomInfo) {
            // 기존 채팅방 수정인지 확인
            const isEditMode = chatRoomInfo.id && this.chatRoomList.find((room) => room.id === chatRoomInfo.id);

            if (!chatRoomInfo.id) {
                chatRoomInfo.id = this.uuid();
            }

            // 참가자 정보 정규화: userList에서 정확한 정보 가져오기
            const normalizedParticipants = [];
            const addedParticipantIds = new Set(); // 중복 체크용

            chatRoomInfo.participants.forEach((participant) => {
                // 참가자 ID 추출 (id 또는 email 기반)
                const participantId = participant.id || participant.email;

                // 이미 추가된 참가자인지 확인 (중복 방지)
                if (addedParticipantIds.has(participantId)) {
                    console.warn('중복된 참가자 건너뛰기:', participant.username || participant.email || participant.id);
                    return;
                }

                // userList에서 정확한 사용자 정보 찾기
                // 에이전트의 경우 email이 null일 수 있으므로 id로 먼저 비교
                const userFromList = this.userList.find((u) => {
                    // ID로 먼저 비교 (에이전트의 경우 email이 null일 수 있음)
                    if (u.id === participant.id) {
                        return true;
                    }
                    // email로 비교
                    if (participant.email && u.email && u.email === participant.email) {
                        return true;
                    }
                    // uid로 비교
                    if (u.uid === participant.id) {
                        return true;
                    }
                    return false;
                });

                if (userFromList) {
                    const normalizedId = userFromList.id || userFromList.uid;
                    // 중복 체크
                    if (addedParticipantIds.has(normalizedId)) {
                        console.warn(
                            '중복된 참가자 건너뛰기 (userList에서 찾은 경우):',
                            userFromList.username || userFromList.email || normalizedId
                        );
                        return;
                    }

                    normalizedParticipants.push({
                        id: normalizedId,
                        username: userFromList.username || userFromList.name,
                        email: userFromList.email,
                        is_admin: userFromList.is_admin || false,
                        notifications: userFromList.notifications || null,
                        profile: userFromList.profile || null,
                        isExistUnReadMessage: false // 초기 상태
                    });
                    addedParticipantIds.add(normalizedId);
                } else {
                    // userList에 없으면 원본 정보 사용 (시스템 사용자 등)
                    // 중복 체크
                    if (addedParticipantIds.has(participantId)) {
                        console.warn(
                            '중복된 참가자 건너뛰기 (원본 정보 사용):',
                            participant.username || participant.email || participant.id
                        );
                        return;
                    }

                    normalizedParticipants.push({
                        id: participant.id,
                        username: participant.username || participant.name,
                        email: participant.email,
                        is_admin: participant.is_admin || false,
                        notifications: participant.notifications || null,
                        profile: participant.profile || null,
                        isExistUnReadMessage: false
                    });
                    addedParticipantIds.add(participantId);
                }
            });

            // 현재 사용자가 참가자 목록에 없으면 추가
            const currentUserId = this.userInfo.uid || this.userInfo.id;
            const currentUserEmail = this.userInfo.email;
            const isCurrentUserAdded = normalizedParticipants.some(
                (p) => p.id === currentUserId || (currentUserEmail && p.email === currentUserEmail)
            );

            if (!isCurrentUserAdded) {
                normalizedParticipants.push({
                    id: currentUserId,
                    username: this.userInfo.name,
                    email: currentUserEmail,
                    is_admin: this.userInfo.is_admin || false,
                    notifications: this.userInfo.notifications || null,
                    profile: this.userInfo.profile || null,
                    isExistUnReadMessage: false
                });
                addedParticipantIds.add(currentUserId);
            }

            chatRoomInfo.participants = normalizedParticipants;

            // tenant_id 설정 (RLS 정책을 통과하기 위해 필수)
            // users 테이블에서 가져온 현재 사용자의 tenant_id 사용
            if (!chatRoomInfo.tenant_id) {
                chatRoomInfo.tenant_id = this.userInfo.tenant_id || window.$tenantName || 'localhost';
            }

            // 채팅방 이름이 없으면 자동 생성 (단톡방인 경우)
            if (!chatRoomInfo.name && chatRoomInfo.participants.length > 2) {
                // 현재 사용자를 제외한 참가자들의 이름으로 채팅방 이름 생성
                const otherParticipants = chatRoomInfo.participants
                    .filter((p) => p.email !== this.userInfo.email)
                    .map((p) => p.username || p.email);
                chatRoomInfo.name = otherParticipants.join(', ');
            } else if (!chatRoomInfo.name && chatRoomInfo.participants.length === 2) {
                // 1:1 채팅인 경우 상대방 이름 사용
                const otherParticipant = chatRoomInfo.participants.find((p) => p.email !== this.userInfo.email);
                if (otherParticipant) {
                    chatRoomInfo.name = otherParticipant.username || otherParticipant.email;
                }
            }

            if (isEditMode) {
                // 기존 채팅방 수정
                const index = this.chatRoomList.findIndex((room) => room.id === chatRoomInfo.id);
                if (index !== -1) {
                    // 메시지는 유지
                    if (!chatRoomInfo.message) {
                        chatRoomInfo.message = this.chatRoomList[index].message;
                    }
                    // 기존 참가자들의 읽음 상태 유지
                    chatRoomInfo.participants.forEach((newParticipant) => {
                        const existingParticipant = this.chatRoomList[index].participants.find((p) => p.email === newParticipant.email);
                        if (existingParticipant && existingParticipant.isExistUnReadMessage !== undefined) {
                            newParticipant.isExistUnReadMessage = existingParticipant.isExistUnReadMessage;
                        }
                    });
                    this.chatRoomList.splice(index, 1, chatRoomInfo);
                    // DB에 저장 (에러 처리 추가)
                    try {
                        // participants가 배열인지 확인
                        if (!Array.isArray(chatRoomInfo.participants)) {
                            console.error('[GroupChats] participants must be an array:', chatRoomInfo);
                            throw new Error('participants must be an array');
                        }
                        await this.putObject(`chat_rooms`, chatRoomInfo);
                    } catch (error) {
                        console.error('[GroupChats] Failed to update chat room in DB:', error);
                        console.error('[GroupChats] chatRoomInfo:', JSON.stringify(chatRoomInfo, null, 2));
                    }
                    // 현재 선택된 채팅방이면 업데이트
                    if (this.currentChatRoom && this.currentChatRoom.id === chatRoomInfo.id) {
                        this.currentChatRoom = chatRoomInfo;
                    }
                }
            } else {
                // 새 채팅방 생성
                // chat_type이 없으면 기본값 'group'으로 설정 (그룹채팅 페이지이므로)
                if (!chatRoomInfo.chat_type) {
                    chatRoomInfo.chat_type = 'group';
                }
                let currentTimestamp = Date.now();
                chatRoomInfo.message = {
                    msg: 'NEW',
                    type: 'text',
                    createdAt: currentTimestamp
                };

                // 모든 참가자에게 초기 읽지 않음 상태 설정 (생성자는 제외)
                chatRoomInfo.participants.forEach((participant) => {
                    if (participant.email !== this.userInfo.email) {
                        participant.isExistUnReadMessage = true; // 다른 참가자들은 읽지 않음
                    } else {
                        participant.isExistUnReadMessage = false; // 생성자는 읽음
                    }
                });

                // 중복 체크: 같은 참가자들로 구성된 채팅방이 이미 있는지 확인 (1:1 채팅만)
                if (chatRoomInfo.participants.length === 2) {
                    const existingRoom = this.chatRoomList.find((room) => {
                        if (room.participants.length !== chatRoomInfo.participants.length) {
                            return false;
                        }
                        const roomEmails = room.participants.map((p) => p.email).sort();
                        const newRoomEmails = chatRoomInfo.participants.map((p) => p.email).sort();
                        return JSON.stringify(roomEmails) === JSON.stringify(newRoomEmails);
                    });

                    if (existingRoom) {
                        // 이미 존재하는 채팅방이면 해당 채팅방 선택
                        this.chatRoomSelected(existingRoom);
                        return;
                    }
                }

                this.chatRoomList.push(chatRoomInfo);

                // DB에 저장 (에러 처리 추가)
                try {
                    // id가 없으면 생성
                    if (!chatRoomInfo.id) {
                        chatRoomInfo.id = this.uuid();
                    }
                    // participants가 배열인지 확인
                    if (!Array.isArray(chatRoomInfo.participants)) {
                        console.error('[GroupChats] participants must be an array:', chatRoomInfo);
                        throw new Error('participants must be an array');
                    }
                    // participants가 비어있으면 에러
                    if (chatRoomInfo.participants.length === 0) {
                        console.error('[GroupChats] participants array is empty:', chatRoomInfo);
                        throw new Error('participants array cannot be empty');
                    }
                    await this.putObject(`chat_rooms`, chatRoomInfo);
                } catch (error) {
                    // 저장 실패해도 로컬에서는 사용 가능하도록 함
                    // 하지만 다른 사용자에게는 보이지 않음
                    console.error('[GroupChats] Failed to save chat room to DB:', error);
                    console.error('[GroupChats] chatRoomInfo:', JSON.stringify(chatRoomInfo, null, 2));
                }

                this.chatRoomSelected(chatRoomInfo);
                this.myChatRoomIds.push(chatRoomInfo.id);
                this.setWatchChatList(this.myChatRoomIds);
            }
        },
        async setReadMessage(idx) {
            if (idx !== -1) {
                let participant = this.chatRoomList[idx].participants.find((participant) => participant.email === this.userInfo.email);
                if (participant) {
                    participant.isExistUnReadMessage = false;
                }
                try {
                    await this.putObject(`chat_rooms`, this.chatRoomList[idx]);
                } catch (error) {
                    console.error('[GroupChats] Failed to update read message status in DB:', error);
                }
                this.EventBus.emit('clear-notification', this.chatRoomList[idx].id);
                window.dispatchEvent(
                    new CustomEvent('update-notification-badge', {
                        detail: { type: 'chat', value: false, id: this.chatRoomList[idx].id }
                    })
                );
            }
        },
        async chatRoomSelected(chatRoomInfo) {
            // 현재 진행 중인 AI 생성 작업이 있으면 백그라운드 모드로 전환 (새로운 채팅방 정보 설정 전에 호출)
            this.handleChatRoomChange();

            this.currentChatRoom = chatRoomInfo;
            if (chatRoomInfo.participants.find((p) => p.id === 'system_id')) {
                this.ProcessGPTActive = true;
                if (chatRoomInfo.participants.length == 2) {
                    this.isSystemChat = true;
                } else {
                    this.isSystemChat = false;
                }
            } else {
                this.ProcessGPTActive = false;
                this.isSystemChat = false;
            }
            // getMessages가 완료된 후에만 다음 작업 진행 (중복 방지)
            await this.getMessages(this.currentChatRoom.id);
            this.setReadMessage(this.chatRoomList.findIndex((x) => x.id == chatRoomInfo.id));

            this.EventBus.emit('chat-room-selected', this.currentChatRoom.id);
            this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch((e) => {
                console.warn('saveAccessPage 실패:', e);
            });
        },
        async requestDraftAgent(newVal, mentionedAgent) {
            if (mentionedAgent && mentionedAgent.id) {
                try {
                    if (!this.agentInfo) {
                        this.agentInfo = {};
                    }
                    if (newVal) {
                        this.agentInfo.draftPrompt = newVal;
                    }
                    if (!this.agentInfo.draftPrompt) {
                        return;
                    }
                    this.agentInfo.isRunning = true;

                    const chatRoomId = this.currentChatRoom?.id || this.chatRoomId;
                    if (!chatRoomId) {
                        this.agentInfo.isRunning = false;
                        return;
                    }

                    const response = await axios.post('/completion/multi-agent/chat', {
                        text: this.agentInfo.draftPrompt,
                        chat_room_id: chatRoomId,
                        options: {
                            agent_id: mentionedAgent.id,
                            is_learning_mode: false
                        }
                    });

                    let responseText = '';
                    if (response.data.response) {
                        if (typeof response.data.response === 'string') {
                            responseText = response.data.response;
                        } else if (response.data.response.content) {
                            responseText = response.data.response.content;
                        } else if (response.data.response.html_content) {
                            responseText = response.data.response.html_content;
                        } else if (response.data.response.text) {
                            responseText = response.data.response.text;
                        } else {
                            responseText = JSON.stringify(response.data.response);
                        }
                    } else {
                        responseText = JSON.stringify(response.data);
                    }

                    const agentEmail = mentionedAgent.email || mentionedAgent.id || 'agent';
                    const agentName = mentionedAgent.username || mentionedAgent.name || '에이전트';
                    const agentProfile = mentionedAgent.profile || '/images/chat-icon.png';

                    const agentMessage = {
                        email: agentEmail,
                        name: agentName,
                        role: 'agent',
                        profile: agentProfile,
                        command: responseText,
                        content: responseText,
                        timeStamp: Date.now(),
                        jsonData: {
                            agent_id: mentionedAgent.id,
                            agent_name: agentName,
                            task_id: response.data.task_id,
                            response: response.data.response
                        }
                    };

                    await this.putMessage(agentMessage, chatRoomId);
                    this.agentInfo.isRunning = false;
                } catch (error) {
                    if (this.agentInfo) {
                        this.agentInfo.isRunning = false;
                    }
                }
            } else {
                return this.$options.mixins[0].methods.requestDraftAgent.call(this, newVal, mentionedAgent);
            }
        },
        async putMessage(msg, chatRoomId = null) {
            // this.addTextToVectorStore(msg)
            const roomId = chatRoomId || this.currentChatRoom.id;
            
            // 디버깅: putMessage 호출 추적
            const callStack = new Error().stack;
            console.log('🔍 [putMessage] 호출됨', {
                content: msg.content?.substring(0, 30),
                chatRoomId: roomId,
                caller: callStack?.split('\n')[2]?.trim()
            });
            
            // 그룹 채팅 전용 테이블에 저장
            try {
                const { data, error } = await window.$supabase
                    .from('group_chat_messages')
                    .insert({
                        chat_room_id: roomId,
                        content: msg.content,
                        email: msg.email,
                        name: msg.name,
                        role: msg.role || 'user',
                        time_stamp: msg.timeStamp || Date.now(),
                        profile: msg.profile,
                        json_content: msg.jsonContent || null,
                        json_data: msg.jsonData || null,
                        image: msg.image || null,
                        images: msg.images || null,
                        thread_id: msg.thread_id || null,
                        tenant_id: this.userInfo.tenant_id || window.$tenantName || 'localhost'
                    })
                    .select('id')
                    .single();
                
                if (error) {
                    // PRIMARY KEY 제약 위반 (중복 ID)인 경우 무시
                    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
                        console.log('⚠️ [putMessage] 중복 ID 에러 (이미 저장된 메시지)', { id: data?.id, chatRoomId: roomId, error: error.message });
                        return;
                    }
                    throw error;
                }
                
                // 저장된 메시지의 id를 메시지 객체에 추가
                if (data && data.id) {
                    msg.id = data.id;
                }
                
                console.log('✅ [putMessage] 그룹 채팅 메시지 저장 완료', { id: data?.id, chatRoomId: roomId });
            } catch (error) {
                console.error('[GroupChats] Failed to save group chat message:', error);
                throw error;
            }

            // chat_rooms 테이블의 최신 메시지 정보 업데이트
            let chatRoomObj = {
                msg: msg.messageForUser ? msg.messageForUser : msg.content,
                type: 'text',
                createdAt: msg.timeStamp
            };
            let targetChatRoom = this.chatRoomList.find((room) => room.id === roomId) || this.currentChatRoom;
            targetChatRoom.message = chatRoomObj;
            targetChatRoom.participants.forEach((participant) => {
                if (participant.email !== this.userInfo.email) {
                    participant.isExistUnReadMessage = true;
                }
            });
            try {
                await this.putObject(`chat_rooms`, targetChatRoom);
            } catch (error) {
                console.error('[GroupChats] Failed to update chat room message in DB:', error);
            }
        },
        beforeReply(msg) {
            if (msg) {
                this.replyUser = msg;
            } else {
                this.replyUser = null;
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || (newMessage.images && newMessage.images.length > 0) || newMessage.image != null)) {
                // 사용자 메시지를 먼저 화면에 표시 (즉시 반응)
                const userMessageObj = this.createMessageObj(newMessage);
                // messages 배열에 즉시 추가하여 화면에 표시
                this.messages.push(userMessageObj);
                newMessage.callType = 'chats';

                // 멘션된 에이전트 확인
                const mentionedAgent = newMessage.mentionedUsers && newMessage.mentionedUsers.find((user) => user.is_agent);

                // 텍스트 메시지인 경우 에이전트 개입 로직을 비동기로 처리
                // 단, 에이전트가 멘션된 경우는 개입 여부 판단을 하지 않음 (직접 해당 에이전트에게 메시지 전송)
                if (newMessage.text && this.currentChatRoom && this.currentChatRoom.id && !mentionedAgent) {
                    // 먼저 DB에 저장하고 id를 받아옴
                    await this.putMessage(userMessageObj);
                    
                    // 저장된 메시지의 id로 개입 로직 처리
                    if (userMessageObj.id) {
                        this.handleAgentIntervention(newMessage.text, this.currentChatRoom.id, this.userInfo.email, userMessageObj.id).catch((error) => {
                            console.error('❌ 에이전트 개입 처리 실패:', error);
                            console.error('에러 상세:', error.response?.data || error.message);
                            // 실패 시 기존 로직 사용
                            this.sendMessage(newMessage);
                        });
                    } else {
                        console.warn('⚠️ [beforeSendMessage] 메시지 ID를 받지 못함, 개입 로직 건너뜀');
                        this.sendMessage(newMessage);
                    }
                } else {
                    // 이미지만 있거나 텍스트가 없거나, 에이전트가 멘션된 경우 기존 로직 사용
                    // 이 경우에는 putMessage를 호출해야 함 (백엔드 개입 로직이 없으므로)
                    this.putMessage(userMessageObj);
                    this.sendMessage(newMessage);
                }

                // saveAccessPage 에러 무시 (Promise rejection 처리)
                this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch((e) => {
                    console.warn('saveAccessPage 실패:', e);
                });
            }
        },
        async handleAgentIntervention(text, chatRoomId, userId, userMessageId = null) {
            // 에이전트 개입 로직을 비동기로 처리
            console.log('🔵 [handleAgentIntervention] 시작', {
                text: text?.substring(0, 50),
                chatRoomId,
                userId,
                userMessageId,
                messagesCount: this.messages.length
            });
            
            try {
                const response = await axios.post('/langchain-chat/intervention', {
                    text: text,
                    chat_room_id: chatRoomId,
                    user_id: userId,
                    user_message_id: userMessageId || undefined
                });

                console.log('🟢 [handleAgentIntervention] 응답 받음', {
                    hasIntervention: !!(response.data && response.data.intervention),
                    intervention: response.data?.intervention,
                    fullResponse: response.data
                });

                if (response.data && response.data.intervention) {
                    const intervention = response.data.intervention;

                    // 개입 정보를 사용자 메시지에 즉시 반영 (ID로 찾기)
                    const userMessage = userMessageId 
                        ? this.messages.find((msg) => msg.id === userMessageId)
                        : null;

                    if (userMessage) {
                        // jsonContent가 없으면 생성 (Vue 3는 반응성이 자동 처리됨)
                        if (!userMessage.jsonContent) {
                            userMessage.jsonContent = {};
                        }

                        // 개입 정보 업데이트 (Vue 3는 직접 할당해도 반응성 유지)
                        const statusFromServer = intervention.status || (intervention.should_intervene ? 'intervening' : 'not_intervening');
                        const shouldIntervene =
                            intervention.should_intervene !== undefined
                                ? intervention.should_intervene
                                : statusFromServer !== 'not_intervening' && !!statusFromServer;

                        userMessage.interventionStatus = statusFromServer;
                        userMessage.jsonContent.intervention = {
                            should_intervene: shouldIntervene,
                            status: statusFromServer,
                            reason: intervention.reason || '',
                            selected_agent_id: intervention.selected_agent_id || null,
                            agent_name: intervention.agent_response?.agent_name || null
                        };
                        
                        console.log('✅ [handleAgentIntervention] 개입 정보 업데이트 완료', {
                            messageId: userMessage.id,
                            intervention: userMessage.jsonContent.intervention,
                            should_intervene: intervention.should_intervene
                        });

                        // 실시간 이벤트 누락 대비 폴링 시작
                        if (chatRoomId && userMessageId) {
                            this.pollInterventionResult(chatRoomId, userMessageId);
                        }
                    } else {
                        console.warn('⚠️ [handleAgentIntervention] 사용자 메시지를 찾지 못함', {
                            userMessageId,
                            userId,
                            messagesCount: this.messages.length,
                            lastMessages: this.messages.slice(-3).map(m => ({
                                id: m.id,
                                email: m.email,
                                content: m.content?.substring(0, 30)
                            }))
                        });
                    }
                }

            } catch (error) {
                console.error('❌ 에이전트 개입 처리 실패:', error);
                console.error('에러 상세:', error.response?.data || error.message);
            }
        },
        async pollInterventionResult(chatRoomId, userMessageId) {
            if (!chatRoomId || !userMessageId) return;

            const pollKey = `${chatRoomId}:${userMessageId}`;
            if (this.interventionPollers[pollKey]) {
                return; // 이미 폴링 중이면 중복 실행 방지
            }
            this.interventionPollers[pollKey] = true;

            const safeParse = (val) => {
                if (!val) return null;
                if (typeof val === 'object') return val;
                try {
                    return JSON.parse(val);
                } catch (e) {
                    return null;
                }
            };

            const maxAttempts = 10;
            const delayMs = 1500;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const { data, error } = await window.$supabase
                        .from('group_chat_messages')
                        .select('*')
                        .eq('chat_room_id', chatRoomId)
                        .or(
                            `id.eq.${userMessageId},json_content->>user_message_id.eq.${userMessageId},json_data->>user_message_id.eq.${userMessageId}`
                        )
                        .order('time_stamp', { ascending: true });

                    if (error) {
                        console.warn('⚠️ [pollInterventionResult] 조회 실패:', error);
                        break;
                    }

                    const rows = (data || []).map((row) => ({
                        ...row,
                        json_content: safeParse(row.json_content),
                        json_data: safeParse(row.json_data)
                    }));

                    const userRow = rows.find((row) => row.id === userMessageId);
                    const agentRow = rows.find(
                        (row) =>
                            ['agent', 'assistant', 'system'].includes(row.role) &&
                            (row.json_content?.user_message_id == userMessageId ||
                                row.json_data?.user_message_id == userMessageId)
                    );

                    // 사용자 메시지 상태 동기화
                    if (userRow) {
                        const userIdx = this.messages.findIndex((m) => m.id === userMessageId);
                        if (userIdx !== -1) {
                            const status = userRow.intervention_status || this.messages[userIdx].interventionStatus;
                            this.messages[userIdx].interventionStatus = status || null;
                            if (!this.messages[userIdx].jsonContent) {
                                this.messages[userIdx].jsonContent = {};
                            }
                            if (!this.messages[userIdx].jsonContent.intervention) {
                                this.messages[userIdx].jsonContent.intervention = {};
                            }
                            this.messages[userIdx].jsonContent.intervention = {
                                ...this.messages[userIdx].jsonContent.intervention,
                                ...(userRow.json_content?.intervention || {}),
                                status: status || this.messages[userIdx].jsonContent.intervention.status || null,
                                should_intervene: true
                            };
                        }
                    }

                    // 에이전트 응답 동기화
                    if (agentRow) {
                        const existing = this.messages.find((m) => m.id === agentRow.id);
                        const normalizedAgent = {
                            id: agentRow.id,
                            chat_room_id: agentRow.chat_room_id,
                            content: agentRow.content,
                            email: agentRow.email,
                            name: agentRow.name,
                            role: agentRow.role,
                            timeStamp: agentRow.time_stamp,
                            profile: agentRow.profile,
                            jsonContent: agentRow.json_content,
                            jsonData: agentRow.json_data,
                            image: agentRow.image,
                            images: agentRow.images,
                            interventionStatus:
                                agentRow.intervention_status || agentRow.json_content?.intervention?.status || null
                        };

                        if (!existing) {
                            this.messages.push(normalizedAgent);
                        }

                        // 사용자 메시지도 완료 처리
                        const userIdx = this.messages.findIndex((m) => m.id === userMessageId);
                        if (userIdx !== -1) {
                            this.messages[userIdx].interventionStatus = 'completed';
                            if (!this.messages[userIdx].jsonContent) {
                                this.messages[userIdx].jsonContent = {};
                            }
                            if (!this.messages[userIdx].jsonContent.intervention) {
                                this.messages[userIdx].jsonContent.intervention = {};
                            }
                            this.messages[userIdx].jsonContent.intervention.status = 'completed';
                            this.messages[userIdx].jsonContent.intervention.should_intervene = true;
                        }

                        delete this.interventionPollers[pollKey];
                        return;
                    }
                } catch (e) {
                    console.warn('⚠️ [pollInterventionResult] 폴링 중 오류:', e);
                    break;
                }

                // 이미 완료되었으면 폴링 종료
                const currentMsg = this.messages.find((m) => m.id === userMessageId);
                if (currentMsg && currentMsg.interventionStatus === 'completed') {
                    delete this.interventionPollers[pollKey];
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            delete this.interventionPollers[pollKey];
        },
        async executeProcess(input) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const response = await me.backend.start(input);
                    console.log(response);
                    if (response) {
                        me.EventBus.emit('instances-updated');
                    } else {
                        const systemMsg = this.$t('chats.processExecutionFailed', { title: input.process_name });
                        me.putMessage(me.createMessageObj(systemMsg, 'system'));
                    }
                }
            });
        },
        async handleExecuteProcess(data) {
            const me = this;
            await me.$try({
                context: me,
                action: async () => {
                    // 첫 번째 액티비티 ID 및 폼 키 가져오기
                    const activityId = data.firstActivityForm?.activityId;
                    const formKey = data.firstActivityForm?.formKey;

                    if (!activityId || !formKey) {
                        console.error('Activity ID 또는 Form Key를 찾을 수 없습니다.');
                        return;
                    }

                    // Role mappings 가져오기 및 첫 번째 액티비티의 role을 현재 사용자로 설정
                    const roleMappings = JSON.parse(JSON.stringify(data.processDefinition?.definition?.roles || []));

                    // 첫 번째 액티비티 정보 가져오기
                    const firstActivity = data.processDefinition?.definition?.activities?.find((act) => act.id === activityId);

                    if (firstActivity && firstActivity.role) {
                        // 해당 role의 endpoint를 현재 사용자로 변경
                        const roleMapping = roleMappings.find((r) => r.name === firstActivity.role);
                        if (roleMapping) {
                            roleMapping.endpoint = [me.userInfo.uid];
                            roleMapping.default = [me.userInfo.uid];
                        }
                    }

                    // 폼 데이터를 프로세스 시작 입력으로 변환
                    const input = {
                        process_definition_id: data.processDefinitionId,
                        activity_id: activityId,
                        answer: '',
                        form_values: {
                            [formKey]: data.formValues || {}
                        },
                        role_mappings: roleMappings,
                        version_tag: data.processDefinition?.definition?.version_tag || 'major',
                        version: data.processDefinition?.definition?.version || null,
                        source_list: []
                    };

                    console.log('프로세스 실행 input:', input);

                    // 프로세스 실행
                    const response = await me.backend.start(input);
                    console.log('프로세스 실행 응답:', response);

                    if (response && !response.error && !response.detail) {
                        me.EventBus.emit('instances-updated');

                        // 성공 메시지 추가
                        const successMsg = me.createMessageObj(
                            `"${data.processDefinitionName}" 프로세스가 성공적으로 실행되었습니다.`,
                            'system'
                        );
                        me.putMessage(successMsg);
                        me.messages.push(successMsg);

                        // 인스턴스 상세 페이지로 이동할 수 있는 버튼 추가
                        const linkMsg = me.createMessageObj('실행된 프로세스 인스턴스를 확인하시겠습니까?', 'system');
                        linkMsg.instanceId = response.process_instance_id || response.proc_inst_id || response.id;
                        linkMsg.instanceUrl = `/todolist`;
                        linkMsg.companyQueryUrl = `/todolist`;
                        me.putMessage(linkMsg);
                        me.messages.push(linkMsg);
                    } else {
                        const errorMsg = me.createMessageObj(
                            response?.detail ||
                                response?.error ||
                                me.$t('chats.processExecutionFailed', { title: data.processDefinitionName }),
                            'system'
                        );
                        me.putMessage(errorMsg);
                        me.messages.push(errorMsg);
                    }
                }
            });
        },
        afterModelCreated(response) {
            if (response.work == 'A2AResponse') {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting && messageWriting.isLoading) {
                    messageWriting.content += response.content;
                    let content = response.content.replaceAll('\n', '<br>');
                    messageWriting.htmlContent += content;
                }
            }
        },
        async deleteSystemMessage(response) {
            // 그룹 채팅 메시지 삭제
            try {
                const { error } = await window.$supabase
                    .from('group_chat_messages')
                    .delete()
                    .eq('uuid', response.uuid);
                if (error) {
                    console.error('그룹 채팅 메시지 삭제 실패:', error);
                }
            } catch (e) {
                console.error('그룹 채팅 메시지 삭제 중 오류:', e);
            }
        },
        cancelProcess(response) {
            let systemMsg = this.$t('chats.requestCancelled', { name: this.name });
            this.putMessage(this.createMessageObj(systemMsg, 'system'));
            this.deleteSystemMessage(response);
        },
        deleteWorkList(index) {
            this.generatedWorkList.splice(index, 1);
        },
        deleteAllWorkList() {
            this.generatedWorkList = [];
        },
        async startProcess(response) {
            var me = this;
            let responseObj;

            if (response.content && response.content.includes('{')) {
                responseObj = partialParse(response.content);
            } else {
                responseObj = response;
            }
            // process instance execute
            if (responseObj.work == 'StartProcessInstance') {
                if (!me.lastSendMessage) {
                    const userMsgs = me.messages.filter((msg) => msg.role === 'user');
                    me.lastSendMessage = userMsgs[userMsgs.length - 1];
                }
                const systemMsg = me.$t('chats.startProcess', { title: responseObj.title });
                const input = {
                    process_name: responseObj.title,
                    process_definition_id: responseObj.process_definition_id,
                    answer: {
                        text: responseObj.prompt,
                        image: me.lastSendMessage.image
                    }
                };
                await me.executeProcess(input);
                const finalMsg = `${me.userInfo.name}님이 요청하신 ${systemMsg}`;
                const systemMsgObj = me.createMessageObj(finalMsg, 'system');
                if (me.currentChatRoom.id == me.chatRoomId) {
                    if (me.messages[me.messages.length - 1].content === '...' && me.messages[me.messages.length - 1].isLoading) {
                        me.messages.pop();
                    }
                    me.messages.push(systemMsgObj);
                }

                me.putMessage(systemMsgObj, me.chatRoomId);

                if (response.content) {
                    me.deleteSystemMessage(response);
                }
            }
        },
        async afterGenerationFinished(responseObj, chatRoomId = null) {
            const me = this;
            if (!responseObj) return;

            const role = 'system';
            const obj = me.createMessageObj(responseObj, role);
            if (responseObj.messageForUser) {
                obj.messageForUser = responseObj.messageForUser;
            }

            if (me.isSystemChat) {
                obj.uuid = me.uuid();
                me.putMessage(obj, chatRoomId);
            } else {
                if (typeof responseObj === 'string') {
                    responseObj = {
                        messageForUser: responseObj
                    };
                }
                if (!responseObj.expanded) {
                    responseObj.expanded = false;
                }
                if (!me.ProcessGPTActive) {
                    me.ProcessGPTActive = true;
                }
                me.generatedWorkList.push(responseObj);
            }
        },
        async handleProcessDefinitionMessage(message) {
            let systemChatRoom = {
                id: this.uuid(),
                name: message.chatRoomName,
                participants: [
                    {
                        email: 'system@uengine.org',
                        id: 'system_id',
                        username: 'System',
                        is_admin: true,
                        notifications: null
                    }
                ]
            };
            this.createChatRoom(systemChatRoom);

            if (systemChatRoom) {
                // 시스템 채팅방 선택
                this.chatRoomSelected(systemChatRoom);
                delete message.chatRoomName;

                if (message && (message.text != '' || (message.images && message.images.length > 0) || message.image != null)) {
                    // 1. 메시지 객체 생성
                    const messageObj = this.createMessageObj(message);

                    // 2. DB에 저장
                    this.putMessage(messageObj);

                    // 3. UI에 즉시 표시
                    this.messages.push(messageObj);

                    // 4. AI 생성을 위한 설정
                    if (!this.generator.contexts) {
                        let contexts = await this.backend.listDefinition();
                        this.generator.setContexts(contexts);
                    }

                    let instanceList = await this.backend.getAllInstanceList();
                    this.generator.setWorkList(instanceList);

                    // 5. AI 생성 시작 (sendMessage를 호출하지 않아 중복 추가 방지)
                    this.lastSendMessage = message;
                    if (this.ProcessGPTActive) {
                        this.startGenerate();
                    }

                    // saveAccessPage 에러 무시
                    this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch((e) => {
                        console.warn('saveAccessPage 실패:', e);
                    });
                }
            }
        },
        // setWatchChatList 오버라이드: 그룹채팅 전용 intervention 처리 추가
        async setWatchChatList(chatRoomIds) {
            var me = this;
            me.userInfo = await this.backend.getUserInfo();

            // 이전 구독 정리
            if (me.watchChatsSubscription) {
                try {
                    if (typeof me.watchChatsSubscription.unsubscribe === 'function') {
                        me.watchChatsSubscription.unsubscribe();
                    } else if (typeof me.watchChatsSubscription === 'function') {
                        me.watchChatsSubscription();
                    }
                } catch (e) {
                    console.warn('이전 구독 정리 실패:', e);
                }
                me.watchChatsSubscription = null;
            }

            // 그룹 채팅 전용 실시간 구독 (chat_room_id 필터 적용)
            // uuid 문자열은 따옴표가 필요하므로 숫자가 아닌 경우 따옴표를 붙여줌
            const formattedIds = (chatRoomIds || [])
                .filter((id) => !!id)
                .map((id) => {
                    const value = String(id).trim();
                    // 숫자만으로 된 ID는 그대로, UUID/문자열은 단일 인용부호로 감싸기 (Supabase in. 필터 포맷)
                    return /^[0-9]+$/.test(value) ? value : `'${value.replace(/'/g, "''")}'`;
                })
                .join(',');

            if (!formattedIds) {
                console.warn('⚠️ [setWatchChatList] chatRoomIds가 비어 있어 실시간 구독을 건너뜁니다.');
                return;
            }

            const filter = `chat_room_id=in.(${formattedIds})`;
            console.log('🔔 [setWatchChatList] 실시간 구독 필터', { filter });
            me.watchChatsSubscription = await this.backend.watchGroupChats(
                (data) => {
                    console.log('📡 [실시간 구독] 이벤트 수신', {
                        eventType: data?.eventType,
                        hasNew: !!data?.new,
                        hasOld: !!data?.old,
                        messageId: data?.new?.id || data?.old?.id
                    });
                    
                    // UPDATE 이벤트 처리 (data.new가 없을 수도 있음)
                    if (data && data.eventType === 'UPDATE' && data.new) {
                        const msg = {
                            id: data.new.id,
                            chat_room_id: data.new.chat_room_id,
                            content: data.new.content,
                            email: data.new.email,
                            name: data.new.name,
                            role: data.new.role,
                            timeStamp: data.new.time_stamp,
                            profile: data.new.profile,
                            jsonContent: data.new.json_content,
                            jsonData: data.new.json_data,
                            image: data.new.image,
                            images: data.new.images,
                            interventionStatus: data.new.intervention_status || data.new.json_content?.intervention?.status || null
                        };
                        
                        console.log('🔄 [실시간 구독] UPDATE 이벤트 수신', {
                            messageId: msg.id,
                            chatRoomId: msg.chat_room_id,
                            currentChatRoomId: me.currentChatRoom?.id,
                            jsonContent: msg.jsonContent
                        });
                        
                        if (msg.chat_room_id == me.currentChatRoom.id) {
                            const messageIndex = me.messages.findIndex((m) => m.id === msg.id);
                            
                            console.log('🔄 [실시간 구독] UPDATE 이벤트 처리', {
                                messageId: msg.id,
                                messageIndex,
                                interventionStatus: msg.interventionStatus
                            });
                            
                            if (messageIndex !== -1) {
                                me.messages[messageIndex].interventionStatus = msg.interventionStatus || me.messages[messageIndex].interventionStatus || null;
                                if (msg.jsonContent) {
                                    me.messages[messageIndex].jsonContent = {
                                        ...me.messages[messageIndex].jsonContent,
                                        ...msg.jsonContent
                                    };
                                }
                            } else {
                                console.warn('⚠️ [실시간 구독] UPDATE 이벤트: 메시지를 찾을 수 없음', {
                                    messageId: msg.id,
                                    messagesCount: me.messages.length,
                                    messageIds: me.messages.map(m => m.id)
                                });
                            }
                        }
                        return; // UPDATE 이벤트는 여기서 처리하고 종료
                    }
                    
                    if (data && data.new) {
                        // group_chat_messages 테이블 구조에 맞게 변환
                        const msg = {
                            id: data.new.id,  // id (auto increment, 필수)
                            chat_room_id: data.new.chat_room_id,
                            content: data.new.content,
                            email: data.new.email,
                            name: data.new.name,
                            role: data.new.role,
                            timeStamp: data.new.time_stamp,
                            profile: data.new.profile,
                            jsonContent: data.new.json_content,
                            jsonData: data.new.json_data,
                            image: data.new.image,
                            images: data.new.images,
                            interventionStatus: data.new.intervention_status || data.new.json_content?.intervention?.status || null
                        };
                        
                        if (data.eventType == 'DELETE') {
                            const messageIndex = me.messages.findIndex((m) => m.id === data.old.id);
                            if (messageIndex !== -1) {
                                me.messages.splice(messageIndex, 1);
                            }
                        } else {
                            if (!me.currentChatRoom && me.chatRoomId) {
                                me.currentChatRoom = {
                                    id: me.chatRoomId
                                };
                            }


                            // 모든 메시지 처리 (에이전트, 시스템, 다른 사용자, 대본 모드 포함)
                            const isAgentMessage = msg.role === 'agent' || msg.role === 'system';
                            const isOtherUserMessage = msg.email && msg.email != me.userInfo.email;
                            const isCurrentUserMessage = msg.email && msg.email === me.userInfo.email;

                            // 현재 사용자가 보낸 메시지는 실시간 구독에서 처리하지 않음 (이미 화면에 추가됨)
                            // 단, 에이전트나 시스템 메시지는 처리
                            if (isAgentMessage || isOtherUserMessage || (isCurrentUserMessage && isAgentMessage)) {
                                if (msg.chat_room_id == me.currentChatRoom.id) {
                                    // INSERT 이벤트인 경우: 중복 체크를 먼저 수행
                                    if (data.eventType === 'INSERT') {
                                        // getMessages로 로드한 시점보다 오래된 메시지는 무시
                                        if (me.messagesLoadedAt && msg.timeStamp && msg.timeStamp < me.messagesLoadedAt) {
                                            console.log('⚠️ [실시간 구독] INSERT 이벤트: 이미 로드된 오래된 메시지, 무시', {
                                                messageTimeStamp: msg.timeStamp,
                                                loadedAt: me.messagesLoadedAt,
                                                content: msg.content?.substring(0, 30)
                                            });
                                            return;
                                        }
                                        
                                        // ID로 중복 체크
                                        const existingById = me.messages.find((m) => m.id === msg.id);
                                        if (existingById) {
                                            // 이미 있으면 업데이트만 하고 추가하지 않음
                                            const index = me.messages.indexOf(existingById);
                                            if (index !== -1) {
                                                Object.assign(me.messages[index], msg);
                                            }
                                            console.log('⚠️ [실시간 구독] INSERT 이벤트: ID로 중복 감지, 업데이트만 수행', {
                                                id: msg.id,
                                                content: msg.content?.substring(0, 30)
                                            });
                                            return;
                                        }
                                        
                                        // 내용+시간+이메일+role로 중복 체크 (ID가 없는 경우 대비)
                                        const isDuplicateByContent = me.messages.some(
                                            (m) =>
                                                m.content === msg.content &&
                                                m.role === msg.role &&
                                                (m.email === msg.email || (!m.email && !msg.email)) &&
                                                Math.abs(m.timeStamp - msg.timeStamp) < 3000
                                        );
                                        
                                        if (isDuplicateByContent) {
                                            console.log('⚠️ [실시간 구독] INSERT 이벤트: 내용으로 중복 감지, 추가하지 않음', {
                                                content: msg.content?.substring(0, 30),
                                                email: msg.email,
                                                timeStamp: msg.timeStamp
                                            });
                                            return;
                                        }
                                    }
                                    

                                    // 시스템 메시지 업데이트 처리
                                    if (
                                        me.messages &&
                                        me.messages.length > 0 &&
                                        msg.role == 'system' &&
                                        me.messages[me.messages.length - 1].role == 'system' &&
                                        (me.messages[me.messages.length - 1].content == 'AI 생성중...' ||
                                            me.messages[me.messages.length - 1].content == '테이블 생성 중...' ||
                                            me.messages[me.messages.length - 1].content
                                                .replace(/\s+/g, '')
                                                .includes(msg.content.replace(/\s+/g, '')))
                                    ) {
                                        msg.id = msg.id || me.messages[me.messages.length - 1].id;
                                        me.messages[me.messages.length - 1] = msg;
                                        me.messages[me.messages.length - 1].isLoading = false;
                                        me.EventBus.emit('instances-updated');
                                    } else {
                                        // INSERT 이벤트가 아닌 경우에도 중복 체크
                                        const existingById = me.messages.find((m) => m.id === msg.id);
                                        if (existingById) {
                                            const index = me.messages.indexOf(existingById);
                                            if (index !== -1) {
                                                Object.assign(me.messages[index], msg);
                                            }
                                            console.log('⚠️ [실시간 구독] ID로 중복 감지, 업데이트만 수행', {
                                                id: msg.id,
                                                content: msg.content?.substring(0, 30)
                                            });
                                            return;
                                        }
                                        
                                        // 내용+시간+이메일+role로 중복 체크
                                        const isDuplicate = me.messages.some(
                                            (m) =>
                                                m.content === msg.content &&
                                                m.role === msg.role &&
                                                (m.email === msg.email || (!m.email && !msg.email)) &&
                                                Math.abs(m.timeStamp - msg.timeStamp) < 3000
                                        );

                                        if (!isDuplicate) {
                                            // 에이전트 개입 응답인 경우, user_message_uuid로 사용자 메시지 찾아서 개입 정보 업데이트
                                            if (isAgentMessage) {
                                                console.log('🤖 [실시간 구독] 에이전트 메시지 수신', {
                                                    uuid: msg.uuid,
                                                    role: msg.role,
                                                    content: msg.content?.substring(0, 50),
                                                    jsonContent: msg.jsonContent,
                                                    jsonData: msg.jsonData
                                                });
                                                
                                                let userMessageId = null;
                                                try {
                                                    const jsonContent = typeof msg.jsonContent === 'string' 
                                                        ? JSON.parse(msg.jsonContent) 
                                                        : msg.jsonContent;
                                                    const jsonData = typeof msg.jsonData === 'string' 
                                                        ? JSON.parse(msg.jsonData) 
                                                        : msg.jsonData;
                                                    
                                                    userMessageId = jsonContent?.user_message_id || jsonData?.user_message_id || null;
                                                    
                                                    if (userMessageId) {
                                                        const userMessageIndex = me.messages.findIndex((m) => m.id === userMessageId);
                                                        
                                                        if (userMessageIndex !== -1) {
                                                            if (!me.messages[userMessageIndex].jsonContent) {
                                                                me.messages[userMessageIndex].jsonContent = {};
                                                            }
                                                            if (!me.messages[userMessageIndex].jsonContent.intervention) {
                                                                me.messages[userMessageIndex].jsonContent.intervention = {};
                                                            }
                                                            me.messages[userMessageIndex].interventionStatus = 'completed';
                                                            me.messages[userMessageIndex].jsonContent.intervention.status = 'completed';
                                                            me.messages[userMessageIndex].jsonContent.intervention.should_intervene = true;
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.warn('❌ [실시간 구독] 에이전트 응답의 user_message_id 파싱 실패:', e);
                                                }
                                            }
                                            
                                            // 메시지 추가
                                            console.log('➕ [실시간 구독] 메시지 추가', {
                                                uuid: msg.uuid,
                                                role: msg.role,
                                                isAgentMessage,
                                                messagesCountBefore: me.messages.length
                                            });
                                            me.messages.push(msg);
                                            console.log('✅ [실시간 구독] 메시지 추가 완료', {
                                                messagesCountAfter: me.messages.length
                                            });
                                        }
                                    }
                                    me.newMessageInfo = msg;
                                }

                                let idx = me.chatRoomList.findIndex((x) => x.id == msg.chat_room_id);
                                if (idx != -1) {
                                    me.chatRoomList[idx].message.msg = msg.content;
                                    me.chatRoomList[idx].message.createdAt = msg.timeStamp;

                                    if (me.chatRoomList[idx].id != me.currentChatRoom.id) {
                                        const participantWithEmail = me.chatRoomList[idx].participants.find(
                                            (participant) => participant.email === me.userInfo.email
                                        );
                                        participantWithEmail.isExistUnReadMessage = true;
                                    }
                                }
                            }
                        }
                    }
                },
                filter
            );
        },
        // getMessages 오버라이드: 그룹 채팅 전용 메시지 로드
        async getMessages(chatRoomId) {
            var me = this;
            if (!me.backend || me.backend == null) {
                me.backend = BackendFactory.createBackend();
            }
            me.messages = [];
            
            // 그룹 채팅 전용 메시지 조회
            let messages = await me.backend.getGroupChatMessages(chatRoomId);
            if (messages) {
                let allMessages = messages.map((message) => {
                    let newMessage = message.messages;
                    newMessage.thread_id = message.thread_id || null;
                    newMessage.uuid = message.uuid || null;
                    newMessage.id = message.id || message.uuid || null;
                    newMessage.interventionStatus = message.messages?.interventionStatus || null;
                    return newMessage;
                });
                allMessages.sort((a, b) => {
                    return new Date(a.timeStamp) - new Date(b.timeStamp);
                });
                me.messages = allMessages;
                
                // 메시지 로드 완료 시점 기록 (가장 최신 메시지의 시간 또는 현재 시간)
                if (allMessages.length > 0) {
                    const latestMessage = allMessages[allMessages.length - 1];
                    me.messagesLoadedAt = latestMessage.timeStamp || Date.now();
                } else {
                    me.messagesLoadedAt = Date.now();
                }
                
                console.log('✅ [getMessages] 그룹 채팅 메시지 로드 완료', {
                    chatRoomId,
                    messageCount: allMessages.length,
                    messagesLoadedAt: me.messagesLoadedAt
                });
                
                me.EventBus.emit('messages-updated');
            } else {
                me.messagesLoadedAt = Date.now();
            }
            me.isInitDone = true;
        }
    }
};
</script>

<style scoped>
.description-card {
    height: 81.6vh;
    overflow: auto;
}

.custom-top-area {
    position: relative;
    z-index: 1000;
}

.custom-top-area .v-btn {
    background-color: white;
}

.scenario-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: rgba(255, 255, 255, 0.92);
    border-radius: 8px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
    margin: 8px 0 0 60px;
    max-width: 680px;
}

.scenario-select {
    min-width: 200px;
    max-width: 260px;
}

.scenario-progress {
    color: #555;
}

.empty-chat-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 400px;
    background-color: rgba(255, 255, 255, 1);
}

.empty-chat-content {
    text-align: center;
    padding: 40px 20px;
}

.empty-chat-content h3 {
    font-weight: 500;
}

.empty-chat-content p {
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.6;
}
</style>
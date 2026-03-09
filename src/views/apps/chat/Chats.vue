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
                    <v-tabs-items v-model="activeTab">
                        <v-tab-item v-if="activeTab == 0">
                            <!-- <ChatProfile style="margin-bottom: -15px;" /> -->
                            <!-- <v-divider class="my-2"></v-divider> -->
                            <UserListing :userList="userList" @selectedUser="selectedUser" @startChat="startChat" />
                        </v-tab-item>
                        <v-tab-item v-if="activeTab == 1">
                            <ChatListing
                                :chatRoomList="filteredChatRoomList"
                                :userList="userList"
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                :closeDrawer="closeDrawer"
                                @chat-selected="chatRoomSelected"
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-tab-item>
                    </v-tabs-items>
                </div>
            </template>
            <template v-slot:rightpart>
                <div :key="chatRenderKey" class="chat-info-view-wrapper-chats">
                    <Chat
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
                        :participantUsers="participantUsers"
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
                            </div>
                        </template>
                    </Chat>
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
                    <v-tabs-items v-model="activeTab">
                        <v-tab-item v-if="activeTab == 0">
                            <!-- <ChatProfile style="margin-bottom: -15px;" /> -->
                            <!-- <v-divider class="my-2"></v-divider> -->
                            <UserListing :userList="userList" @selectedUser="selectedUser" @startChat="startChat" />
                        </v-tab-item>
                        <v-tab-item v-if="activeTab == 1">
                            <ChatListing
                                :chatRoomList="filteredChatRoomList"
                                :userList="userList"
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                :closeDrawer="closeDrawer"
                                @chat-selected="chatRoomSelected"
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-tab-item>
                    </v-tabs-items>
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
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';
import CompanyQueryGenerator from '@/components/ai/CompanyQueryGenerator.js';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import UserListing from '@/components/apps/chats/UserListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from '@/components/ui/Chat.vue';
import axios from 'axios';
import partialParse from 'partial-json-parser';

export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        UserListing,
        ChatProfile,
        AssistantChats,
        Attachments
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
        participantUsers: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        headers: [
            { title: 'id', align: 'start', key: 'id' },
            { title: 'name', align: 'start', key: 'name' },
            { title: 'description', align: 'start', key: 'description' },
            { title: 'actions', align: 'start', key: 'actions' }
        ],
        definitions: [],
        onLoad: false,
        processDefinition: null,
        path: 'chats',
        organizationChart: [],
        calendarData: null,
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
        attachments: []
    }),
    computed: {
        filteredChatRoomList() {
            return this.chatRoomList.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
        }
    },
    watch: {
        currentChatRoom: {
            async handler(newVal) {
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

        await this.getCalendar();
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
            this.$router.replace({ path: '/chats' });
        }

        if (this.currentChatRoom && this.currentChatRoom.id) {
            this.chatRoomId = this.currentChatRoom.id;
        }

        // 메인 채팅에서 전달된 메시지 처리
        if (this.$route.query.mainChatMessage) {
            await this.handleMainChatMessage(decodeURIComponent(this.$route.query.mainChatMessage));
        } else {
            this.generator = new WorkAssistantGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
        }
    },
    beforeUnmount() {
        this.EventBus.emit('chat-room-unselected');
    },
    methods: {
        toggleAttachments() {
            this.isAttachmentsOpen = !this.isAttachmentsOpen;
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
        async getCalendar() {
            let option = {
                key: 'uid'
            };
            const res = await this.getData(`calendar/${this.userInfo.uid}`, option);
            this.calendarData = res && res.data ? res.data : {};
            if (this.generator && this.generator.setCalendarData) this.generator.setCalendarData(this.calendarData);
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
            let chatRooms = await me.backend.getChatRoomList(`chat_rooms`);
            if (chatRooms) {
                me.myChatRoomIds = [];
                chatRooms.forEach(function (chatRoom) {
                    let existUserInfo = chatRoom.participants.find((x) => x.email === me.userInfo.email);
                    if (existUserInfo) {
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
                if (me.chatRoomList.length > 0) {
                    me.currentChatRoom = me.filteredChatRoomList[0];
                    me.chatRoomSelected(me.currentChatRoom);
                    me.setWatchChatList(me.myChatRoomIds);
                    me.setReadMessage(0);
                } else {
                    let systemChatRoom = {
                        name: 'Process GPT',
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
                    me.createChatRoom(systemChatRoom);
                }
            }
        },
        deleteChatRoom(chatRoomId) {
            let index = this.chatRoomList.findIndex((room) => room.id === chatRoomId);
            if (index !== -1) {
                this.chatRoomList.splice(index, 1);
            }
            this.backend.delete(`chats/${chatRoomId}`, { key: 'id' });
            this.backend.delete(`chat_rooms/${chatRoomId}`, { key: 'id' });

            if (this.chatRoomList && this.chatRoomList.length > 0) {
                this.chatRoomSelected(this.chatRoomList[0]);
            } else {
                this.currentChatRoom = null;
                this.messages = [];
            }
        },
        createChatRoom(chatRoomInfo) {
            if (!chatRoomInfo.id) {
                chatRoomInfo.id = this.uuid();
            }
            // chatRoomInfo.participants.forEach(participant => {
            //     delete participant.profile;
            // });
            if (!chatRoomInfo.participants.find((p) => p.email === this.userInfo.email)) {
                let userInfo = {
                    id: this.userInfo.uid,
                    username: this.userInfo.name,
                    email: this.userInfo.email
                };
                chatRoomInfo.participants.push(userInfo);
            }
            let currentTimestamp = Date.now();
            chatRoomInfo.message = {
                msg: 'NEW',
                type: 'text',
                createdAt: currentTimestamp
            };
            this.chatRoomList.push(chatRoomInfo);
            // }
            // else {
            //     let index = this.chatRoomList.findIndex(room => room.id === chatRoomInfo.id);
            //     if(index !== -1) {
            //         this.chatRoomList.splice(index, 1, chatRoomInfo);
            //     }
            // }

            this.putObject(`chat_rooms`, chatRoomInfo);
            this.chatRoomSelected(chatRoomInfo);
            this.myChatRoomIds.push(chatRoomInfo.id);
            this.setWatchChatList(this.myChatRoomIds);
        },
        setReadMessage(idx) {
            if (idx !== -1) {
                let participant = this.chatRoomList[idx].participants.find((participant) => participant.email === this.userInfo.email);
                if (participant) {
                    participant.isExistUnReadMessage = false;
                }
                this.putObject(`chat_rooms`, this.chatRoomList[idx]);
                this.EventBus.emit('clear-notification', this.chatRoomList[idx].id);
                window.dispatchEvent(
                    new CustomEvent('update-notification-badge', {
                        detail: { type: 'chat', value: false, id: this.chatRoomList[idx].id }
                    })
                );
            }
        },
        chatRoomSelected(chatRoomInfo) {
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
            this.getMessages(this.currentChatRoom.id);
            this.setReadMessage(this.chatRoomList.findIndex((x) => x.id == chatRoomInfo.id));

            this.EventBus.emit('chat-room-selected', this.currentChatRoom.id);
            this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch((e) => {
                console.warn('saveAccessPage 실패:', e);
            });
        },
        async putMessage(msg, chatRoomId = null) {
            // this.addTextToVectorStore(msg)
            let uuid;
            if (msg.uuid) {
                uuid = msg.uuid;
            } else {
                uuid = this.uuid();
            }
            let message = {
                messages: msg,
                id: chatRoomId || this.currentChatRoom.id,
                uuid: uuid
            };

            this.putObject(`chats/${uuid}`, message);

            let chatRoomObj = {
                msg: msg.messageForUser ? msg.messageForUser : msg.content,
                type: 'text',
                createdAt: msg.timeStamp
            };
            let targetChatRoom = this.chatRoomList.find((room) => room.id === chatRoomId) || this.currentChatRoom;
            targetChatRoom.message = chatRoomObj;
            targetChatRoom.participants.forEach((participant) => {
                if (participant.email !== this.userInfo.email) {
                    participant.isExistUnReadMessage = true;
                }
            });
            this.putObject(`chat_rooms`, targetChatRoom);
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
                this.putMessage(this.createMessageObj(newMessage));
                newMessage.callType = 'chats';
                this.sendMessage(newMessage);

                // saveAccessPage 에러 무시 (Promise rejection 처리)
                this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch((e) => {
                    console.warn('saveAccessPage 실패:', e);
                });
            }
        },
        async handleExecuteProcessRequest(executeData) {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 프로세스 정의 가져오기
                    const processDef = await me.backend.getRawDefinition(executeData.processDefinitionId, null);

                    if (!processDef) {
                        const errorMsg = me.createMessageObj(
                            me.$t('chats.processNotFound', { name: executeData.processDefinitionName }),
                            'system'
                        );
                        me.putMessage(errorMsg);
                        me.messages.push(errorMsg);
                        return;
                    }

                    // 프로세스 정의에서 첫 번째 액티비티 찾기
                    let firstActivity = null;
                    let firstActivityForm = null;

                    if (processDef && processDef.definition) {
                        const definition = processDef.definition;

                        // Start Event 찾기
                        const startEvent = definition.events?.find((event) => event.type === 'startEvent');

                        if (startEvent) {
                            // Start Event 이후의 첫 번째 Sequence 찾기
                            const firstSequence = definition.sequences?.find((seq) => seq.source === startEvent.id);

                            if (firstSequence && firstSequence.target) {
                                // 첫 번째 액티비티 찾기
                                firstActivity = definition.activities?.find((activity) => activity.id === firstSequence.target);

                                if (firstActivity) {
                                    // 액티비티의 폼 정보 가져오기
                                    if (firstActivity.tool && firstActivity.tool.startsWith('formHandler:')) {
                                        const formKey = firstActivity.tool.replace('formHandler:', '');

                                        try {
                                            // 폼 정보 가져오기
                                            const formInfo = await me.backend.getFormFields(formKey);

                                            if (formInfo) {
                                                firstActivityForm = {
                                                    formKey: formKey,
                                                    formHtml: formInfo.html,
                                                    fields: formInfo.fields_json,
                                                    activityName: firstActivity.name || firstActivity.id,
                                                    activityId: firstActivity.id
                                                };
                                            }
                                        } catch (error) {
                                            console.error('폼 정보 가져오기 오류:', error);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 시스템 응답 메시지 추가 (프로세스 설명 + 폼)
                    const systemMsg = me.createMessageObj(
                        `"${executeData.processDefinitionName}" 프로세스를 실행합니다.\n\n${processDef.description || ''}`,
                        'system'
                    );

                    // 프로세스 실행에 필요한 정보 추가
                    systemMsg.processDefinitionId = executeData.processDefinitionId;
                    systemMsg.processDefinitionName = executeData.processDefinitionName;
                    systemMsg.processDefinition = processDef;
                    systemMsg.firstActivityForm = firstActivityForm;
                    systemMsg.work = 'StartProcessInstance';

                    me.putMessage(systemMsg);
                    me.messages.push(systemMsg);
                }
            });
        },
        async handleCompanyQuery(queryData) {
            const me = this;
            await me.$try({
                context: me,
                action: async () => {
                    // CompanyQueryGenerator 초기화
                    me.generator = new CompanyQueryGenerator(me, {
                        isStream: false,
                        preferredLanguage: 'Korean'
                    });

                    // 간소화된 프로세스 목록은 이미 WorkAssistantGenerator가 제공했으므로
                    // 동일한 목록을 사용 (중복 로드 방지)
                    const processes = await me.backend.listDefinition();
                    const simplifiedProcesses = processes.map((p) => ({
                        id: p.id,
                        name: p.name,
                        description: p.description || ''
                    }));
                    me.generator.setSimplifiedProcesses(simplifiedProcesses);
                    me.generator.setUserInfo(me.userInfo);
                    me.generator.setToday();
                    me.generator.setQueryType(queryData.queryType);

                    // 전체 대화 내역을 previousMessages에 추가
                    let chatMsgs = [];
                    if (me.messages && me.messages.length > 0) {
                        me.messages.forEach((msg) => {
                            if (msg.content && !msg.isLoading) {
                                chatMsgs.push({
                                    role: msg.role,
                                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                                });
                            }
                        });
                    }
                    me.generator.previousMessages = [me.generator.previousMessages[0], ...chatMsgs];

                    // 1단계 LLM 실행
                    await me.startGenerate();
                }
            });
        },
        async fetchDetailedDataAndRetry(responseObj) {
            const me = this;
            await me.$try({
                context: me,
                action: async () => {
                    // 로딩 메시지 업데이트
                    // if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {

                    if (responseObj.requiredDataType === 'processDetail') {
                        // 프로세스 상세 정보 조회
                        const processDetails = [];
                        for (const processId of responseObj.requiredProcessIds || []) {
                            const detail = await me.backend.getRawDefinition(processId, null);
                            if (detail) {
                                processDetails.push(detail);
                            }
                        }
                        me.generator.setDetailedData({ processes: processDetails });
                    } else if (responseObj.requiredDataType === 'instances') {
                        // 인스턴스 목록 조회
                        const instances = await me.backend.getAllInstanceList();

                        // 사용자가 참가하고 있는 인스턴스만 필터링
                        let filteredInstances = instances.filter(
                            (inst) => inst.participants && inst.participants.includes(me.userInfo.uid)
                        );

                        // 특정 프로세스의 인스턴스만 추가 필터링
                        if (responseObj.requiredProcessIds && responseObj.requiredProcessIds.length > 0) {
                            filteredInstances = filteredInstances.filter((inst) => responseObj.requiredProcessIds.includes(inst.defId));
                        }

                        // 인스턴스 ID 목록 추출
                        const instanceIds = filteredInstances.map((inst) => inst.instId);

                        // todolist 정보 가져오기 (중복 제거된 구조)
                        const todoListData = await me.backend.getTodoListByInstances(instanceIds);

                        // 인스턴스 기본 정보와 todolist 상세 정보 결합
                        const instancesWithDetails = {};

                        Object.keys(todoListData).forEach((defId) => {
                            instancesWithDetails[defId] = {
                                processDefinitionId: defId,
                                processName: filteredInstances.find((inst) => inst.defId === defId)?.name?.split('_')[0] || defId,
                                instances: {}
                            };

                            Object.keys(todoListData[defId].instances).forEach((instId) => {
                                const instanceInfo = filteredInstances.find((inst) => inst.instId === instId);
                                instancesWithDetails[defId].instances[instId] = {
                                    instanceId: instId,
                                    instanceName: instanceInfo?.name || instId,
                                    status: instanceInfo?.status,
                                    startDate: instanceInfo?.startDate,
                                    currentActivityIds: instanceInfo?.currentActivityIds,
                                    activities: todoListData[defId].instances[instId].activities
                                };
                            });
                        });

                        me.generator.setDetailedData({ instances: instancesWithDetails });
                    } else if (responseObj.requiredDataType === 'organization') {
                        // 조직도 정보 조회
                        const orgData = await me.getData(`configuration`, { match: { key: 'organization' } });
                        if (orgData && orgData.value && orgData.value.chart) {
                            me.generator.setDetailedData({ organization: orgData.value.chart });
                        }
                    }
                    // }

                    // 2단계 LLM 실행
                    await me.startGenerate();
                }
            });
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
        deleteSystemMessage(response) {
            this.backend.delete(`chats/${response.uuid}`, { key: 'uuid' });
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
            let systemMsg;

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
                systemMsg = me.$t('chats.startProcess', { title: responseObj.title });
                const input = {
                    process_name: responseObj.title,
                    process_definition_id: responseObj.process_definition_id,
                    answer: {
                        text: responseObj.prompt,
                        image: me.lastSendMessage.image
                    }
                };
                await me.executeProcess(input);
            } else if (responseObj.work == 'TodoListRegistration') {
                systemMsg = me.$t('chats.todoAdded', { activityId: responseObj.activity_id });

                if (!responseObj.participants) {
                    responseObj.participants = [];
                }

                if (!responseObj.participants.includes(me.userInfo.email)) {
                    responseObj.participants.push(me.userInfo.email);
                }

                responseObj.participants.forEach(function (email) {
                    const putObj = {
                        id: me.uuid(),
                        user_id: email,
                        proc_inst_id: null,
                        proc_def_id: null,
                        activity_id: responseObj.activity_id,
                        activity_name: responseObj.activity_name ?? responseObj.activity_id,
                        start_date: responseObj.start_date,
                        end_date: responseObj.end_date,
                        status: responseObj.status,
                        description: responseObj.description,
                        tool: null,
                        due_date: responseObj.due_date ?? responseObj.end_date,
                        tenant_id: null
                    };
                    me.putObject('todolist', putObj);
                });
            } else if (responseObj.work == 'ScheduleRegistration') {
                systemMsg = me.$t('chats.scheduleAdded', { title: responseObj.title });
                let start = responseObj.startDateTime.split('/');
                let startDate = start[0].split('-');
                let end = responseObj.endDateTime.split('/');
                let endDate = end[0].split('-');

                let uuid = me.uuid();
                let scheduleObj = {
                    id: uuid,
                    title: responseObj.title,
                    description: responseObj.description,
                    allDay: true,
                    start: new Date(startDate[0], startDate[1] - 1, startDate[2]),
                    end: new Date(endDate[0], endDate[1] - 1, endDate[2]),
                    color: '#615dff'
                };

                // if(!this.calendarData[`${startDate[0]}_${startDate[1]}`]){
                //     this.calendarData[`${startDate[0]}_${startDate[1]}`] = {}
                // }
                // this.calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = scheduleObj
                if (!responseObj.participants) {
                    responseObj.participants = [];
                }

                if (!responseObj.participants.includes(me.userInfo.uid)) {
                    responseObj.participants.push(me.userInfo.uid);
                }
                responseObj.participants.forEach(async function (participant) {
                    let calendarData;
                    if (participant == me.userInfo.uid) {
                        calendarData = me.calendarData;
                    } else {
                        let option = {
                            key: 'uid'
                        };
                        const res = await me.getData(`calendar/${participant}`, option);
                        calendarData = res && res.data ? res.data : {};
                    }
                    if (!calendarData[`${startDate[0]}_${startDate[1]}`]) {
                        calendarData[`${startDate[0]}_${startDate[1]}`] = {};
                    }
                    calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = scheduleObj;
                    let calendarObj = {
                        uid: participant,
                        data: calendarData
                    };
                    me.putObject(`calendar/${participant}`, calendarObj);
                });
            }
            // else if(responseObj.work == 'CreateProcessDefinition'){
            //     systemMsg = this.$t('chats.processDefinitionCreated')
            //     me.$store.dispatch('updateMessages', me.messages);
            //     me.$router.push('/definitions/chat');
            // } else if(responseObj.work == 'ModifyProcessDefinition'){
            //     systemMsg = this.$t('chats.processDefinitionModificationStarted')
            //     me.$store.dispatch('updateEditMessages', me.messages)
            //     me.$router.push(`/definitions/${responseObj.processId}`);
            // }

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
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async handleMainChatMessage(messageText) {
            const me = this;
            await me.$try({
                context: me,
                action: async () => {
                    // 1. 새 시스템 채팅방 생성
                    const systemChatRoom = {
                        name: 'Process GPT',
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
                    me.createChatRoom(systemChatRoom);

                    // 2. 사용자 메시지 생성 및 저장
                    const userMsg = me.createMessageObj({ text: messageText });
                    me.messages.push(userMsg);
                    me.putMessage(userMsg);

                    // 3. WorkAssistantGenerator로 초기화
                    me.generator = new WorkAssistantGenerator(me, {
                        isStream: false,
                        preferredLanguage: 'Korean'
                    });

                    // 컨텍스트 설정
                    const contexts = await me.backend.listDefinition();
                    me.generator.setContexts(contexts);
                    me.generator.setUserInfo(me.userInfo);
                    me.generator.setToday();

                    // 4. sendMessage 호출 (ChatModule의 생명주기 활용, 중복 체크로 메시지는 추가 안됨)
                    await me.sendMessage({ text: messageText });

                    // query parameter 제거
                    me.$router.replace({ path: '/chats' });
                }
            });
        },
        async afterGenerationFinished(responseObj, chatRoomId = null) {
            const me = this;

            // 메인 채팅에서 넘어온 intent 처리
            if (responseObj && responseObj.work) {
                // 채팅방 이름 및 메시지 업데이트
                if (me.currentChatRoom) {
                    me.currentChatRoom.name = responseObj.summaryUserRequest || responseObj.messageForUser || me.currentChatRoom.name;

                    // 채팅방 목록 업데이트
                    const chatRoomIndex = me.chatRoomList.findIndex((room) => room.id === me.currentChatRoom.id);
                    if (chatRoomIndex !== -1) {
                        me.chatRoomList[chatRoomIndex].name = me.currentChatRoom.name;
                    }

                    // 채팅방 저장
                    await me.putObject(`chat_rooms`, me.currentChatRoom);
                }

                if (responseObj.work === 'CreateProcessDefinition') {
                    // 컨설팅 모드로 전환
                    me.generator = new ConsultingGenerator(me, {
                        isStream: true,
                        preferredLanguage: 'Korean'
                    });

                    // 시스템 메시지 제거 (WorkAssistantGenerator의 응답)
                    if (me.messages[me.messages.length - 1].role === 'system') {
                        me.messages.pop();
                    }

                    // 전체 대화 내역을 previousMessages에 추가
                    let chatMsgs = [];
                    if (me.messages && me.messages.length > 0) {
                        me.messages.forEach((msg) => {
                            if (msg.content && !msg.isLoading) {
                                chatMsgs.push({
                                    role: msg.role,
                                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                                });
                            }
                        });
                    }
                    me.generator.previousMessages = [me.generator.previousMessages[0], ...chatMsgs];

                    // 컨설팅 시작
                    await me.startGenerate();
                    return;
                } else if (responseObj.work === 'StartProcessInstance') {
                    // 시스템 메시지 제거
                    if (me.messages[me.messages.length - 1].role === 'system') {
                        me.messages.pop();
                    }

                    const lastUserMessage = me.messages.filter((msg) => msg.role === 'user').pop();
                    await me.handleExecuteProcessRequest({
                        processDefinitionId: responseObj.process_definition_id || responseObj.processDefinitionId,
                        processDefinitionName:
                            responseObj.process_definition_name || responseObj.processDefinitionName || responseObj.messageForUser,
                        userMessage: lastUserMessage ? lastUserMessage.content : ''
                    });
                    return;
                } else if (responseObj.work === 'CompanyQuery') {
                    // 회사 정보 조회 - 2단계 LLM 실행
                    // WorkAssistantGenerator의 응답 메시지 제거
                    if (me.messages[me.messages.length - 1].role === 'system') {
                        me.messages.pop();
                    }

                    const lastUserMessage = me.messages.filter((msg) => msg.role === 'user').pop();
                    await me.handleCompanyQuery({
                        queryType: responseObj.queryType || 'general',
                        userQuestion: lastUserMessage ? lastUserMessage.content : ''
                    });
                    return;
                }
            }

            // CompanyQueryGenerator의 1차 응답 처리 (추가 정보 필요 여부 확인)
            if (responseObj && responseObj.needMoreInfo && !responseObj.work) {
                // 2차 LLM 실행을 위한 데이터 fetch
                await me.fetchDetailedDataAndRetry(responseObj);
                return;
            }

            // CompanyQueryGenerator의 최종 답변 처리
            if (responseObj && responseObj.answer && !responseObj.work && !responseObj.needMoreInfo) {
                // 로딩 메시지 제거
                if (me.messages.length > 0 && me.messages[me.messages.length - 1].role === 'system') {
                    me.messages.pop();
                }
                // 최종 답변 메시지 추가
                const answerMsg = me.createMessageObj(responseObj.answer, 'system');
                answerMsg.companyQueryResult = true;
                me.messages.push(answerMsg);
                me.putMessage(answerMsg);

                me.generator = new WorkAssistantGenerator(me, {
                    isStream: false,
                    preferredLanguage: 'Korean'
                });
                return;
            }

            // 컨설팅 모드 응답 처리
            if (responseObj && (responseObj.answerType || responseObj.validity)) {
                // 컨설팅 응답 메시지 저장
                if (me.messages.length > 0) {
                    const lastMessage = me.messages[me.messages.length - 1];
                    if (lastMessage.role === 'system' && !lastMessage.uuid && !lastMessage.isLoading) {
                        me.putMessage(lastMessage);
                    }
                }

                // 프로세스 생성 모드로 전환
                if (responseObj.answerType === 'generateProcessDef') {
                    // 현재까지의 대화 내용을 store에 저장
                    me.$store.dispatch('updateMessages', me.messages);

                    // /definitions/chat로 이동
                    me.$router.push('/definitions/chat');
                    return;
                }
            }

            // 기존 채팅에서의 응답 처리
            if (responseObj && !responseObj.work) {
                // work가 없는 경우만 처리 (메인 채팅 intent는 위에서 처리됨)
                let startProcess = false;
                let role = 'system';
                let obj = me.createMessageObj(responseObj, role);
                if (responseObj.messageForUser) {
                    obj.messageForUser = responseObj.messageForUser;
                }
                if (me.isSystemChat) {
                    if (responseObj.work == 'CompanyQuery') {
                        try {
                            const token = localStorage.getItem('accessToken');
                            let mementoRes = await axios.post(`/memento/query`, {
                                input: {
                                    query: responseObj.content,
                                    tenant_id: window.$tenantName
                                },
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                }
                            });
                            obj.memento = {};
                            obj.memento.response = mementoRes.data.response;
                            if (!mementoRes.data.metadata) return {};
                            const unique = {};
                            const sources = Object.values(mementoRes.data.metadata).filter((obj) => {
                                if (!unique[obj.file_path]) {
                                    unique[obj.file_path] = true;
                                    return true;
                                }
                            });
                            obj.memento.sources = sources;
                            if (
                                this.currentChatRoom.id == chatRoomId &&
                                this.messages.length > 0 &&
                                this.messages[this.messages.length - 1].email == 'system@uengine.org'
                            ) {
                                this.messages[this.messages.length - 1].content = '테이블 생성 중...';
                            }
                            const responseTable = await axios.post(
                                `/completion/process-data-query`,
                                {
                                    input: {
                                        query: responseObj.content,
                                        user_id: this.userInfo.email
                                    }
                                },
                                {
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`
                                    }
                                }
                            );
                            if (responseTable.data) {
                                obj.tableData = responseTable.data;
                            } else {
                                obj.tableData = null;
                            }
                        } catch (error) {
                            alert(error);
                        }
                    } else if (responseObj.work == 'ScheduleQuery') {
                        console.log(responseObj);
                    } else {
                        startProcess = true;
                    }
                    obj.uuid = me.uuid();
                    if (!startProcess) {
                        me.putMessage(obj, chatRoomId);
                    }
                } else {
                    if (!me.ProcessGPTActive) me.ProcessGPTActive = true;
                    if (typeof responseObj == 'string') {
                        responseObj = {
                            messageForUser: responseObj
                        };
                    }
                    if (!responseObj.expanded) {
                        responseObj.expanded = false;
                    }
                    me.generatedWorkList.push(responseObj);
                }
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
</style>

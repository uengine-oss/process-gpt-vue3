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
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
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
                <div :key="chatRenderKey"
                    class="chat-info-view-wrapper-chats"
                >
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :agentInfo="agentInfo"
                        :userList="userList"
                        :currentChatRoom="currentChatRoom"
                        :type="path"
                        :generatedWorkList="generatedWorkList"
                        :ProcessGPTActive="ProcessGPTActive"
                        :isSystemChat="isSystemChat"
                        :chatRoomId="chatRoomId"
                        :newMessageInfo="newMessageInfo"
                        @requestDraftAgent="requestDraftAgent"
                        @requestFile="requestFile"
                        @beforeReply="beforeReply"
                        @sendMessage="beforeSendMessage"
                        @startProcess="startProcess"
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
                                    <div v-if="showAgentLearning">
                                        <v-switch v-model="isAgentLearning" color="primary" label="학습 모드" density="compact" class="ml-4" />
                                    </div>
                                    <div v-if="attachments.length > 0">
                                        <v-tooltip text="Attachments" location="right">
                                            <template v-slot:activator="{ props }">
                                                <v-btn v-bind="props" @click="toggleAttachments" icon variant="text" class="text-medium-emphasis">
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
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
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
        <v-dialog v-model="openWorkOrderDialog"
            persistent
            :fullscreen="isMobile"
            max-width="80%"
        >
            <v-row class="ma-0 pa-0">
                <v-col  v-if="!isMobile && assistantRes" class="pa-0 mr-2"
                    cols="4"
                >
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
                            <v-card-text  class="pa-0 pl-4 pr-4">
                                <v-col class="pa-0" style="max-width: 100%;" cols="12" sm="6" md="4">
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
                                        <v-date-picker
                                            v-model="assistantRes.time_bound"
                                            @input="timeBoundMenu = false"
                                        ></v-date-picker>
                                    </v-menu>
                                </v-col>
                            </v-card-text>
                            <v-card-title><h3>Descriptions:</h3></v-card-title>
                            <v-card-text class="pa-0 pl-4 pr-4 mb-4">
                                <div v-for="(desc, index) in assistantRes.descriptions" :key="index">
                                    <h4>{{ desc.word }}:</h4>{{ desc.description }}
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
                    <!-- <v-card> -->
                        <v-card-title style="height: 55px; background-color: rgb(var(--v-theme-primary), 0.15) !important; align-content: center;">
                            <v-icon small style="margin-right: 10px;">mdi-file-document</v-icon>
                            {{ $t('chats.document') }}
                            <v-icon @click="closeWorkOrderDialog()" small style="margin-right: 5px; float: right;">mdi-close</v-icon>
                        </v-card-title>
                        <AssistantChats @genFinished="genFinished" @clickedWorkOrder="workOrder"/>
                    </v-card>
                </v-col>
            </v-row>
        </v-dialog>
    </v-card>
</template>

<script>
import AssistantChats from "../chat/AssistantChats.vue";
import Attachments from "./Attachments.vue";
import ChatModule from "@/components/ChatModule.vue";
import ChatGenerator from "@/components/ai/WorkAssistantGenerator.js";
import AgentChatGenerator from "@/components/ai/AgentChatGenerator.js";
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import UserListing from '@/components/apps/chats/UserListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from "@/components/ui/Chat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";
import { VDataTable } from 'vuetify/components/VDataTable';


export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        UserListing,
        ChatProfile,
        VDataTable,
        AssistantChats,
        Attachments
    },
    emits: [
        'selectedUser',
        'startChat', 
        'chat-selected',
        'create-chat-room',
        'delete-chat-room',
        'genFinished',
        'clickedWorkOrder'
    ],
    props: {
        isInstanceChat: {
            type: Boolean,
            default: false
        },
        instanceInfo: {
            type: Object,
            default: null
        }
    },
    data: () => ({
        headers: [
            { title: 'id', align: 'start', key: 'id' },
            { title: 'name', align: 'start', key: 'name' },
            { title: 'description', align: 'start', key: 'description' },
            { title: 'actions', align: 'start', key: 'actions' },
        ],
        definitions: [],
        onLoad: false,
        processDefinition: null,
        path: "chats",
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
        attachments: [],

        isAgentLearning: false,
        showAgentLearning: true,
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
                    if (newVal.participants.length > 0) {
                        this.isAgentChat = newVal.participants.some(participant => participant.is_agent);
                        this.selectedUserInfo = newVal.participants.find(participant => participant.is_agent);
                        if (this.selectedUserInfo && this.selectedUserInfo.is_agent && this.selectedUserInfo.persona && this.selectedUserInfo.persona !== '') {
                            this.showAgentLearning = true;
                        } else {
                            this.showAgentLearning = false;
                        }
                    }
                    if(this.generator) {
                        this.chatRoomId = newVal.id;
                        this.generator.setChatRoomData(newVal);
                        await this.getAttachments();
                    }
                }
            },
            deep: true
        },
        isAgentChat: {
            async handler(newVal) {
                if (newVal) {
                    this.generator = new AgentChatGenerator(this, {
                        isStream: false,
                        preferredLanguage: "Korean",
                    });
                } else {
                    this.generator = new ChatGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                }
            }
        },
    },
    async mounted() {
        await this.init();

        if (this.isAgentChat) {
            this.generator = new AgentChatGenerator(this, {
                isStream: false,
                preferredLanguage: "Korean",
            });
        } else {
            this.generator = new ChatGenerator(this, {
                isStream: true,
                preferredLanguage: "Korean"
            });
        }

        this.userInfo = await this.backend.getUserInfo();

        await this.getUserList();   

        if(this.isInstanceChat){
            await this.getChatRoom();
        } else {
            await this.getChatRoomList();
        }

        await this.getCalendar();
        await this.getAttachments();



        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        // ProcessDefinitionMap에서 전달된 메시지 처리 (query parameter 확인)
        if (this.$route.query.processMessage) {
            try {
                const messageData = JSON.parse(decodeURIComponent(this.$route.query.processMessage));
                this.handleProcessDefinitionMessage(messageData);
                
                // query parameter 제거
                this.$router.replace({ path: '/chats' });
            } catch (error) {
                console.error('Failed to parse process message:', error);
            }
        }

        if (this.$route.query.id) {
            this.chatRoomSelected(this.chatRoomList.find(room => room.id === this.$route.query.id));
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
                if (this.attachments.find(a => a.id == attachment.id)) {
                    return;
                } else {
                    this.attachments.push(attachment);
                }
            });
        },
        selectedUser(user){
            this.selectedUserInfo = user
        },
        startChat(type){
            let chatRoomInfo
            const selectedUserEmail = this.selectedUserInfo.email || this.selectedUserInfo.id;
            const selectedUserName = this.selectedUserInfo.username || this.selectedUserInfo.name;
            const currentUserEmail = this.userInfo.email || this.userInfo.id;
            const currentUserName = this.userInfo.username || this.userInfo.name;

            if(type == 'work'){
                chatRoomInfo = {}
                chatRoomInfo.name = this.selectedUserInfo.username
                chatRoomInfo.participants = []
                chatRoomInfo.participants.push(this.selectedUserInfo)
                this.createChatRoom(chatRoomInfo)
            } else {
                const chatRoomExists = this.chatRoomList.some(chatRoom => {
                    if(chatRoom.participants.length == 2) {
                        const participantEmails = chatRoom.participants.map(participant => participant.email);
                        const participantNames = chatRoom.participants.map(participant => participant.username);
                        chatRoomInfo = chatRoom
                        return participantEmails.includes(currentUserEmail) && participantEmails.includes(selectedUserEmail);
                    } else {
                        return false
                    }
                });
    
                if (chatRoomExists) {
                    this.chatRoomSelected(chatRoomInfo)
                } else {
                    chatRoomInfo = {}
                    chatRoomInfo.name = this.selectedUserInfo.username
                    chatRoomInfo.participants = []
                    chatRoomInfo.participants.push(this.selectedUserInfo)
                    this.createChatRoom(chatRoomInfo)
                }
            }

            this.activeTab = 0

            if(type == 'work'){
                this.startWorkOrder()
            } 
        },
        genFinished(responseObj){
            console.log(responseObj)
            this.assistantRes = responseObj
        },
        workOrder(){
            this.ProcessGPTActive = false
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
            this.closeWorkOrderDialog()
        },
        startWorkOrder(){
            this.openWorkOrderDialog = true
            this.assistantRes = null
        },
        closeWorkOrderDialog(){
            this.openWorkOrderDialog = false
        },
        toggleProcessGPTActive() {
            this.ProcessGPTActive = !this.ProcessGPTActive;
        },
        async getCalendar(){
            let option = {
                key: "uid"
            }
            const res = await this.getData(`calendar/${this.userInfo.uid}`, option);
            this.calendarData = res && res.data ? res.data : {};
            this.generator.setCalendarData(this.calendarData);
        },
        async getUserList(){
            var me = this
            await me.backend.getUserList().then(function (users) {
                if (users) {
                    users = users.filter(user => user.email !== me.userInfo.email);
                    const systemUser = {
                        email: "system@uengine.org",
                        id: "system_id",
                        username: "System",
                        is_admin: true,
                        notifications: null
                    };
                    users.unshift(systemUser);
                    me.userList = users
                }
            });
        },
        async getChatRoom(){
            var me = this
            let chatRoom = await me.backend.getChatRoom(this.instanceInfo.instId + '_chat')
            if(chatRoom){
                me.chatRoomList.push(chatRoom)
                me.currentChatRoom = chatRoom;
                me.chatRoomSelected(chatRoom);
            } else {
                // 인스턴스 참가자들을 채팅 참가자로 추가
                let participants = [];

                this.instanceInfo.participants.forEach(participant => {
                    const user = this.userList.find(user => user.email === participant)
                    if(user){
                        participants.push(user)
                    }
                })
                
                let instanceChatRoom = {
                    "id": this.instanceInfo.instId + '_chat',
                    "name": `인스턴스: ${this.instanceInfo.name}`,
                    "participants": participants
                };
                
                // createChatRoom 호출해서 채팅방 생성
                me.createChatRoom(instanceChatRoom);
                me.chatRoomSelected(instanceChatRoom);
            }

            if(me.chatRoomList.length > 0){
                me.myChatRoomIds.push(me.currentChatRoom.id)
                me.setWatchChatList(me.myChatRoomIds);
            }
        },
        async getChatRoomList(){
            var me = this
            let chatRooms = await me.backend.getChatRoomList(`chat_rooms`)
            if (chatRooms) {
                me.myChatRoomIds = []
                chatRooms.forEach(function (chatRoom) {
                    let existUserInfo = chatRoom.participants.find(x => x.email === me.userInfo.email)
                    if(existUserInfo){
                        me.chatRoomList.push(chatRoom)
                        me.myChatRoomIds.push(chatRoom.id)
                        if(existUserInfo.isExistUnReadMessage){
                            window.dispatchEvent(new CustomEvent('update-notification-badge', {
                                detail: { type: 'chat', value: true, id: chatRoom.id }
                            }));
                        }
                    }
                });
                if(me.chatRoomList.length > 0){
                    me.currentChatRoom = me.filteredChatRoomList[0];
                    me.chatRoomSelected(me.currentChatRoom)
                    me.setWatchChatList(me.myChatRoomIds);
                    me.setReadMessage(0);
                } else {
                    let systemChatRoom = {
                        "name": "Process GPT",
                        "participants": [
                            {
                                email: "system@uengine.org",
                                id: "system_id",
                                username: "System",
                                is_admin: true,
                                notifications: null
                            }
                        ]
                    };
                    me.createChatRoom(systemChatRoom);
                }
            }
        },
        deleteChatRoom(chatRoomId){
            let index = this.chatRoomList.findIndex(room => room.id === chatRoomId);
            if(index !== -1) {
                this.chatRoomList.splice(index, 1);
            }
            this.backend.delete(`chats/${chatRoomId}`, {key: 'id'});
            this.backend.delete(`chat_rooms/${chatRoomId}`, {key: 'id'});

            if(this.chatRoomList && this.chatRoomList.length > 0){
                this.chatRoomSelected(this.chatRoomList[0])
            } else {
                this.currentChatRoom = null
                this.messages = []
            }
        },
        createChatRoom(chatRoomInfo){
            if(!chatRoomInfo.id){
                chatRoomInfo.id = this.uuid();
            }
            // chatRoomInfo.participants.forEach(participant => {
            //     delete participant.profile;
            // });
            if(!chatRoomInfo.participants.find(p => p.email === this.userInfo.email)){
                let userInfo = {
                    "id": this.userInfo.uid,
                    "username": this.userInfo.name,
                    "email": this.userInfo.email,
                }
                chatRoomInfo.participants.push(userInfo)
            }
            let currentTimestamp = Date.now()
            chatRoomInfo.message = {
                "msg": "NEW",
                "type": "text",
                "createdAt": currentTimestamp
            }
            this.chatRoomList.push(chatRoomInfo)
            // } 
            // else {
            //     let index = this.chatRoomList.findIndex(room => room.id === chatRoomInfo.id);
            //     if(index !== -1) {
            //         this.chatRoomList.splice(index, 1, chatRoomInfo);
            //     }
            // }
            
            this.putObject(`chat_rooms`, chatRoomInfo);
            this.chatRoomSelected(chatRoomInfo)
            this.myChatRoomIds.push(chatRoomInfo.id);
            this.setWatchChatList(this.myChatRoomIds);
        },
        setReadMessage(idx){
            if(idx !== -1) {
                let participant = this.chatRoomList[idx].participants.find(participant => participant.email === this.userInfo.email);
                if(participant) {
                    participant.isExistUnReadMessage = false;
                }
                this.putObject(`chat_rooms`, this.chatRoomList[idx]);
                this.EventBus.emit('clear-notification', this.chatRoomList[idx].id);
                window.dispatchEvent(new CustomEvent('update-notification-badge', {
                    detail: { type: 'chat', value: false, id: this.chatRoomList[idx].id}
                }));
            }   
        },
        chatRoomSelected(chatRoomInfo){
            // 현재 진행 중인 AI 생성 작업이 있으면 백그라운드 모드로 전환 (새로운 채팅방 정보 설정 전에 호출)
            this.handleChatRoomChange();

            this.currentChatRoom = chatRoomInfo
            if(chatRoomInfo.participants.find(p => p.id === "system_id")){
                this.ProcessGPTActive = true
                if(chatRoomInfo.participants.length == 2){
                    this.isSystemChat = true
                } else {
                    this.isSystemChat = false
                }
            } else {
                this.ProcessGPTActive = false
                this.isSystemChat = false
            }
            this.isAgentChat = chatRoomInfo.participants.some(participant => participant.is_agent);
            this.selectedUserInfo = chatRoomInfo.participants.find(participant => participant.is_agent);
            if (this.selectedUserInfo && this.selectedUserInfo.is_agent && this.selectedUserInfo.persona && this.selectedUserInfo.persona !== '') {
                this.showAgentLearning = true;
            } else {
                this.showAgentLearning = false;
            }
            this.getMessages(this.currentChatRoom.id);
            this.setReadMessage(this.chatRoomList.findIndex(x => x.id == chatRoomInfo.id));
            
            this.EventBus.emit('chat-room-selected', this.currentChatRoom.id);
            this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id);
        },
        async putMessage(msg, chatRoomId = null){
            // this.addTextToVectorStore(msg)
            let uuid
            if(msg.uuid){
                uuid = msg.uuid
            } else {
                uuid = this.uuid()
            }
            let message = {
                "messages": msg,
                "id": chatRoomId || this.currentChatRoom.id,
                "uuid": uuid
            }
            
            this.putObject(`chats/${uuid}`, message);

            let chatRoomObj = {
                "msg": msg.messageForUser ? msg.messageForUser : msg.content,
                "type": "text",
                "createdAt": msg.timeStamp
            }
            let targetChatRoom = this.chatRoomList.find(room => room.id === chatRoomId) || this.currentChatRoom;
            targetChatRoom.message = chatRoomObj
            targetChatRoom.participants.forEach(participant => {
                if(participant.email !== this.userInfo.email) {
                    participant.isExistUnReadMessage = true
                }
            });
            this.putObject(`chat_rooms`, targetChatRoom);
        },
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || (newMessage.images && newMessage.images.length > 0) || newMessage.image != null)) {
                this.putMessage(this.createMessageObj(newMessage))
                if (this.isAgentChat) {
                    this.generator.beforeGenerate(newMessage);
                } else {
                    if(!this.generator.contexts) {
                        let contexts = await this.backend.listDefinition();
                        this.generator.setContexts(contexts);
                    }
                    
                    let instanceList = await this.backend.getAllInstanceList(); 
                    this.generator.setWorkList(instanceList);
                    newMessage.callType = 'chats'
                }
                this.sendMessage(newMessage);
                this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id);
            }
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
            })
        },
        afterModelCreated(response) {
            if (response.work == 'A2AResponse') {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting && messageWriting.isLoading) {
                    messageWriting.content += response.content
                    let content = response.content.replaceAll('\n', '<br>')
                    messageWriting.htmlContent += content
                }
            }
        },
        deleteSystemMessage(response){
            this.backend.delete(`chats/${response.uuid}`, {key: 'uuid'});
        },
        cancelProcess(response){
            let systemMsg = this.$t('chats.requestCancelled', { name: this.name })
            this.putMessage(this.createMessageObj(systemMsg, 'system'))
            this.deleteSystemMessage(response)
        },
        deleteWorkList(index){
            this.generatedWorkList.splice(index, 1);
        },
        deleteAllWorkList(){
            this.generatedWorkList = [];
        },
        async startProcess(response){
            var me = this
                let responseObj
                let systemMsg

                if (response.content && response.content.includes("{")) {
                    responseObj = partialParse(response.content);
                } else {
                    responseObj = response
                }
                // process instance execute
                if(responseObj.work == 'StartProcessInstance') {
                    if(!this.lastSendMessage) {
                        const userMsgs = this.messages.filter(msg => msg.role === 'user');
                        this.lastSendMessage = userMsgs[userMsgs.length - 1];
                    }
                    systemMsg = this.$t('chats.startProcess', { title: responseObj.title });
                    const input = {
                        process_name: responseObj.title,
                        process_definition_id: responseObj.process_definition_id,
                        answer: {
                            text: responseObj.prompt,
                            image: this.lastSendMessage.image
                        }
                    };
                    await this.executeProcess(input);

                } else if(responseObj.work == 'TodoListRegistration'){
                    systemMsg = this.$t('chats.todoAdded', { activityId: responseObj.activity_id })

                    if(!responseObj.participants){
                        responseObj.participants = []
                    }

                    if (!responseObj.participants.includes(me.userInfo.email)) {
                        responseObj.participants.push(me.userInfo.email);
                    }
                    
                    responseObj.participants.forEach(function (email){
                        const putObj =  {
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
                        }
                        me.putObject('todolist', putObj)
                    })

                } else if(responseObj.work == 'ScheduleRegistration'){
                    systemMsg = this.$t('chats.scheduleAdded', { title: responseObj.title })
                    let start = responseObj.startDateTime.split('/')
                    let startDate = start[0].split("-")
                    let end = responseObj.endDateTime.split('/')
                    let endDate = end[0].split("-")

                    let uuid = me.uuid()
                    let scheduleObj = {
                        id: uuid,
                        title: responseObj.title,
                        description: responseObj.description,
                        allDay: true,
                        start: new Date(startDate[0], startDate[1] - 1, startDate[2]),
                        end: new Date(endDate[0], endDate[1] - 1, endDate[2]),
                        color: '#615dff',
                    }
                    
                    // if(!this.calendarData[`${startDate[0]}_${startDate[1]}`]){
                    //     this.calendarData[`${startDate[0]}_${startDate[1]}`] = {}
                    // }
                    // this.calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = scheduleObj
                    if(!responseObj.participants){
                        responseObj.participants = []
                    }
                    
                    if (!responseObj.participants.includes(me.userInfo.uid)) {
                        responseObj.participants.push(me.userInfo.uid);
                    }
                    responseObj.participants.forEach(async function (participant) {
                        let calendarData
                        if(participant == me.userInfo.uid) {
                            calendarData = me.calendarData
                        } else {
                            let option = {
                                key: "uid"
                            }
                            const res = await me.getData(`calendar/${participant}`, option);
                            calendarData = res && res.data ? res.data : {};
                        }
                        if(!calendarData[`${startDate[0]}_${startDate[1]}`]){
                            calendarData[`${startDate[0]}_${startDate[1]}`] = {}
                        }
                        calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = scheduleObj
                        let calendarObj = {
                            "uid": participant,
                            "data": calendarData
                        }
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

                systemMsg = this.$t('chats.userRequestedAction', { name: me.userInfo.name, action: systemMsg })

                if(this.currentChatRoom.id == this.chatRoomId){
                    const systemMsgObj = me.createMessageObj(systemMsg, 'system')
                    if(this.messages[this.messages.length - 1].content === '...' && this.messages[this.messages.length - 1].isLoading){
                        this.messages.pop()
                    }
                    this.messages.push(systemMsgObj)
                }
                
                me.putMessage(systemMsgObj, chatRoomId)
                
                if(response.content){
                    me.deleteSystemMessage(response)
                }
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj, chatRoomId = null) {
            if(responseObj){
                let startProcess = false;
                let role = this.isAgentChat ? 'agent' : 'system';
                let obj = this.createMessageObj(responseObj, role)
                if(responseObj.messageForUser){
                    obj.messageForUser = responseObj.messageForUser
                }
                if(responseObj.work || this.isSystemChat) {
                    // this.messages.push({
                    //     role: 'system',
                    //     content: '...',
                    //     isLoading: true
                    // });
                    if(responseObj.work == 'CompanyQuery'){
                        try{
                            const token = localStorage.getItem('accessToken');
                            let mementoRes = await axios.post(`/memento/query`, {
                                input: {
                                    query: responseObj.content,
                                    tenant_id: window.$tenantName
                                },
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            obj.memento = {}
                            obj.memento.response = mementoRes.data.response
                            if (!mementoRes.data.metadata) return {};
                            const unique = {};
                            const sources = Object.values(mementoRes.data.metadata).filter(obj => {
                                if (!unique[obj.file_path]) {
                                    unique[obj.file_path] = true;
                                    return true;
                                }
                            });
                            obj.memento.sources = sources
                            if(this.currentChatRoom.id == chatRoomId && this.messages.length > 0 && this.messages[this.messages.length - 1].email == 'system@uengine.org'){
                                this.messages[this.messages.length - 1].content = '테이블 생성 중...'
                            }
                            const responseTable = await axios.post(`/execution/process-data-query`, {
                                input: {
                                    query: responseObj.content,
                                    user_id: this.userInfo.email
                                }
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            if(responseTable.data) {
                                obj.tableData = responseTable.data
                            } else {
                                obj.tableData = null
                            }
                        } catch(error){
                            alert(error);
                        }
                    } else if(responseObj.work == 'ScheduleQuery'){
                        console.log(responseObj)
                    } else if (responseObj.work == 'Mem0AgentQuery') {
                        if (responseObj.searchResults) {
                            obj.content = responseObj.content
                            obj.htmlContent = responseObj.htmlContent
                            obj.searchResults = responseObj.searchResults
                        }
                    } else if (responseObj.work == 'Mem0AgentInformation' || responseObj.work == 'Mem0AgentResponse') {
                        obj.content = responseObj.content
                    } else if (responseObj.work == 'A2AResponse') {
                        let content = responseObj.content
                        content = content.replaceAll('undefined', '')
                        obj.content = content
                        obj.htmlContent = content.replaceAll('\n', '<br>')
                    } else {
                        startProcess = true;
                    }
                    obj.uuid = this.uuid()
                    if(startProcess) {
                        this.startProcess(obj, chatRoomId)
                    } else {
                        if (this.isAgentChat) {
                            obj.profile = this.selectedUserInfo.profile
                            obj.name = this.selectedUserInfo.username
                        }
                        this.putMessage(obj, chatRoomId)
                    }
                } else {
                    if(!this.ProcessGPTActive) this.ProcessGPTActive = true
                    if (typeof responseObj == 'string') {
                        responseObj = {
                            messageForUser: responseObj
                        }
                    }
                    if (!responseObj.expanded) {
                        responseObj.expanded = false
                    }
                    this.generatedWorkList.push(responseObj)
                }
            }
        },
        handleProcessDefinitionMessage(message) {
            let systemChatRoom = {
                "id": this.uuid(),
                "name": message.chatRoomName,
                "participants": [
                    {
                        email: "system@uengine.org",
                        id: "system_id",
                        username: "System",
                        is_admin: true,
                        notifications: null
                    }
                ]
            };
            this.createChatRoom(systemChatRoom);
            
            if (systemChatRoom) {
                // 시스템 채팅방 선택
                this.chatRoomSelected(systemChatRoom);
                delete message.chatRoomName
                this.beforeSendMessage(message);
            }

        },
    }
}
</script>

<style scoped>
.description-card {
    height:81.6vh;
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

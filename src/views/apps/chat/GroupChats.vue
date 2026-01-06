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
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
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
                <div :key="chatRenderKey"
                    class="chat-info-view-wrapper-chats"
                >
                    <GroupChat
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
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
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
import WorkAssistantGenerator from "@/components/ai/WorkAssistantGenerator.js";
import ConsultingGenerator from "@/components/ai/ProcessConsultingGenerator.js";
import CompanyQueryGenerator from "@/components/ai/CompanyQueryGenerator.js";
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import UserListing from '@/components/apps/chats/UserListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import GroupChat from "@/components/ui/GroupChat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";


export default {
    mixins: [ChatModule],
    name: 'GroupChats',
    components: {
        GroupChat,
        AppBaseCard,
        ChatListing,
        UserListing,
        ChatProfile,
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
        },
        participantUsersProp: {
            type: Array,
            default: () => []
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
    }),
    computed: {
        filteredChatRoomList() {
            // 그룹채팅: chat_type이 'group'인 채팅방만 필터링
            const groupChatRooms = this.chatRoomList.filter(room => 
                room.chat_type === 'group'
            );
            return groupChatRooms.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
        },
        computedParticipantUsers() {
            // prop으로 받은 participantUsersProp이 있으면 사용, 없으면 currentChatRoom의 participants 사용
            if (this.participantUsersProp && this.participantUsersProp.length > 0) {
                return this.participantUsersProp;
            }
            if (this.currentChatRoom && this.currentChatRoom.participants) {
                return this.currentChatRoom.participants.map(participant => ({
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
            async handler(newVal) {
                if (newVal && newVal.id) {
                    if(this.generator) {
                        this.chatRoomId = newVal.id;
                        // setChatRoomData는 일부 generator에만 있음
                        if(this.generator.setChatRoomData) {
                            this.generator.setChatRoomData(newVal);
                        }
                        await this.getAttachments();
                    } else {
                        this.generator = new WorkAssistantGenerator(this, {
                            isStream: true,
                            preferredLanguage: "Korean"
                        });
                    }
                }
            },
            deep: true
        },
    },
    async mounted() {
        await this.init();

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

        if (this.$route.query.id) {
            this.chatRoomSelected(this.chatRoomList.find(room => room.id === this.$route.query.id));
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

        // 메인 채팅에서 전달된 메시지 처리
        if (this.$route.query.mainChatMessage) {
            await this.handleMainChatMessage(decodeURIComponent(this.$route.query.mainChatMessage));
        } else {
            this.generator = new WorkAssistantGenerator(this, {
                isStream: true,
                preferredLanguage: "Korean"
            });
        }
    },
    beforeUnmount() {
        this.EventBus.emit('chat-room-unselected');
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
            if(this.generator && this.generator.setCalendarData) this.generator.setCalendarData(this.calendarData);
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
            
            // RLS 정책 문제 해결: 직접 Supabase 쿼리 사용
            // 참가자 목록에 현재 사용자가 있는 채팅방도 가져오기 위해 여러 방법 시도
            const currentUserEmail = me.userInfo.email;
            const userTenantId = me.userInfo.tenant_id || 'localhost';
            
            let chatRooms = [];
            try {
                // 방법 1: tenant_id로 필터링 시도
                const { data: data1, error: error1 } = await window.$supabase
                    .from('chat_rooms')
                    .select('*')
                    .eq('tenant_id', userTenantId);
                
                if (!error1 && data1) {
                    chatRooms = data1;
                }
                
                // 방법 2: 참가자 목록에 현재 사용자가 있는 채팅방도 추가로 가져오기
                // JSONB 쿼리로 participants 배열에서 email 검색
                const { data: data2, error: error2 } = await window.$supabase
                    .from('chat_rooms')
                    .select('*')
                    .contains('participants', JSON.stringify([{ email: currentUserEmail }]));
                
                if (!error2 && data2) {
                    // 중복 제거
                    const existingIds = new Set(chatRooms.map(r => r.id));
                    const newRooms = data2.filter(r => !existingIds.has(r.id));
                    chatRooms = [...chatRooms, ...newRooms];
                }
                
            } catch (e) {
                // 폴백: 기존 방법 사용
                chatRooms = await me.backend.getChatRoomList(`chat_rooms`) || [];
            }
            
            if (chatRooms) {
                me.myChatRoomIds = []
                me.chatRoomList = [] // 초기화
                
                chatRooms.forEach(function (chatRoom) {
                    // participants가 배열인지 확인
                    if (!chatRoom.participants || !Array.isArray(chatRoom.participants)) {
                        return;
                    }
                    
                    // email 비교 (대소문자 무시, trim 처리)
                    const currentUserEmail = (me.userInfo.email || '').toLowerCase().trim();
                    
                    let existUserInfo = chatRoom.participants.find(participant => {
                        if (!participant || !participant.email) {
                            return false;
                        }
                        const participantEmail = (participant.email || '').toLowerCase().trim();
                        return participantEmail === currentUserEmail;
                    });
                    
                    if(existUserInfo){
                        // 참가자 정보가 없거나 불완전한 경우 보완
                        if (existUserInfo.isExistUnReadMessage === undefined) {
                            existUserInfo.isExistUnReadMessage = false;
                        }
                        
                        me.chatRoomList.push(chatRoom)
                        me.myChatRoomIds.push(chatRoom.id)
                        
                        if(existUserInfo.isExistUnReadMessage){
                            window.dispatchEvent(new CustomEvent('update-notification-badge', {
                                detail: { type: 'chat', value: true, id: chatRoom.id }
                            }));
                        }
                    }
                });
                
                // 필터링된 그룹채팅방이 있으면 첫 번째 채팅방 선택
                if(me.filteredChatRoomList.length > 0){
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
        async createChatRoom(chatRoomInfo){
            // 기존 채팅방 수정인지 확인
            const isEditMode = chatRoomInfo.id && this.chatRoomList.find(room => room.id === chatRoomInfo.id);
            
            if(!chatRoomInfo.id){
                chatRoomInfo.id = this.uuid();
            }
            
            // 참가자 정보 정규화: userList에서 정확한 정보 가져오기
            const normalizedParticipants = [];
            const addedParticipantIds = new Set(); // 중복 체크용
            
            chatRoomInfo.participants.forEach(participant => {
                // 참가자 ID 추출 (id 또는 email 기반)
                const participantId = participant.id || participant.email;
                
                // 이미 추가된 참가자인지 확인 (중복 방지)
                if (addedParticipantIds.has(participantId)) {
                    console.warn('중복된 참가자 건너뛰기:', participant.username || participant.email || participant.id);
                    return;
                }
                
                // userList에서 정확한 사용자 정보 찾기
                // 에이전트의 경우 email이 null일 수 있으므로 id로 먼저 비교
                const userFromList = this.userList.find(u => {
                    // ID로 먼저 비교 (에이전트의 경우 email이 null일 수 있음)
                    if (u.id === participant.id) {
                        return true;
                    }
                    // email이 있는 경우 email로 비교
                    if (participant.email && u.email && u.email === participant.email) {
                        return true;
                    }
                    // uid로도 비교 시도
                    if (u.uid === participant.id) {
                        return true;
                    }
                    return false;
                });
                
                if (userFromList) {
                    const normalizedId = userFromList.id || userFromList.uid;
                    // 중복 체크
                    if (addedParticipantIds.has(normalizedId)) {
                        console.warn('중복된 참가자 건너뛰기 (userList에서 찾은 경우):', userFromList.username || userFromList.email || normalizedId);
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
                        console.warn('중복된 참가자 건너뛰기 (원본 정보 사용):', participant.username || participant.email || participant.id);
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
            const isCurrentUserAdded = normalizedParticipants.some(p => 
                (p.id === currentUserId) || 
                (currentUserEmail && p.email === currentUserEmail)
            );
            
            if(!isCurrentUserAdded){
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
            if(!chatRoomInfo.name && chatRoomInfo.participants.length > 2) {
                // 현재 사용자를 제외한 참가자들의 이름으로 채팅방 이름 생성
                const otherParticipants = chatRoomInfo.participants
                    .filter(p => p.email !== this.userInfo.email)
                    .map(p => p.username || p.email);
                chatRoomInfo.name = otherParticipants.join(', ');
            } else if(!chatRoomInfo.name && chatRoomInfo.participants.length === 2) {
                // 1:1 채팅인 경우 상대방 이름 사용
                const otherParticipant = chatRoomInfo.participants.find(p => p.email !== this.userInfo.email);
                if(otherParticipant) {
                    chatRoomInfo.name = otherParticipant.username || otherParticipant.email;
                }
            }
            
            if (isEditMode) {
                // 기존 채팅방 수정
                const index = this.chatRoomList.findIndex(room => room.id === chatRoomInfo.id);
                if (index !== -1) {
                    // 메시지는 유지
                    if (!chatRoomInfo.message) {
                        chatRoomInfo.message = this.chatRoomList[index].message;
                    }
                    // 기존 참가자들의 읽음 상태 유지
                    chatRoomInfo.participants.forEach(newParticipant => {
                        const existingParticipant = this.chatRoomList[index].participants.find(
                            p => p.email === newParticipant.email
                        );
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
                if(!chatRoomInfo.chat_type){
                    chatRoomInfo.chat_type = 'group';
                }
                let currentTimestamp = Date.now()
                chatRoomInfo.message = {
                    "msg": "NEW",
                    "type": "text",
                    "createdAt": currentTimestamp
                }
                
                // 모든 참가자에게 초기 읽지 않음 상태 설정 (생성자는 제외)
                chatRoomInfo.participants.forEach(participant => {
                    if (participant.email !== this.userInfo.email) {
                        participant.isExistUnReadMessage = true; // 다른 참가자들은 읽지 않음
                    } else {
                        participant.isExistUnReadMessage = false; // 생성자는 읽음
                    }
                });
                
                // 중복 체크: 같은 참가자들로 구성된 채팅방이 이미 있는지 확인 (1:1 채팅만)
                if (chatRoomInfo.participants.length === 2) {
                    const existingRoom = this.chatRoomList.find(room => {
                        if(room.participants.length !== chatRoomInfo.participants.length) {
                            return false;
                        }
                        const roomEmails = room.participants.map(p => p.email).sort();
                        const newRoomEmails = chatRoomInfo.participants.map(p => p.email).sort();
                        return JSON.stringify(roomEmails) === JSON.stringify(newRoomEmails);
                    });
                    
                    if(existingRoom) {
                        // 이미 존재하는 채팅방이면 해당 채팅방 선택
                        this.chatRoomSelected(existingRoom);
                        return;
                    }
                }
                
                this.chatRoomList.push(chatRoomInfo)
                
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
                
                this.chatRoomSelected(chatRoomInfo)
                this.myChatRoomIds.push(chatRoomInfo.id);
                this.setWatchChatList(this.myChatRoomIds);
            }
        },
        async setReadMessage(idx){
            if(idx !== -1) {
                let participant = this.chatRoomList[idx].participants.find(participant => participant.email === this.userInfo.email);
                if(participant) {
                    participant.isExistUnReadMessage = false;
                }
                try {
                    await this.putObject(`chat_rooms`, this.chatRoomList[idx]);
                } catch (error) {
                    console.error('[GroupChats] Failed to update read message status in DB:', error);
                }
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
            this.getMessages(this.currentChatRoom.id);
            this.setReadMessage(this.chatRoomList.findIndex(x => x.id == chatRoomInfo.id));
            
            this.EventBus.emit('chat-room-selected', this.currentChatRoom.id);
            this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch(e => {
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
            try {
                await this.putObject(`chat_rooms`, targetChatRoom);
            } catch (error) {
                console.error('[GroupChats] Failed to update chat room message in DB:', error);
            }
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
                // 사용자 메시지를 먼저 화면에 표시 (즉시 반응)
                const userMessageObj = this.createMessageObj(newMessage);
                // messages 배열에 즉시 추가하여 화면에 표시
                // putMessage는 호출하지 않음 - 백엔드에서 저장하므로 중복 방지
                this.messages.push(userMessageObj);
                newMessage.callType = 'chats'
                
                // 멘션된 에이전트 확인
                const mentionedAgent = newMessage.mentionedUsers && newMessage.mentionedUsers.find(user => user.is_agent);
                
                // 텍스트 메시지인 경우 에이전트 개입 로직을 비동기로 처리
                // 단, 에이전트가 멘션된 경우는 개입 여부 판단을 하지 않음 (직접 해당 에이전트에게 메시지 전송)
                if (newMessage.text && this.currentChatRoom && this.currentChatRoom.id && !mentionedAgent) {
                    // 에이전트 개입 로직을 비동기로 처리 (await 제거)
                    // 사용자 메시지는 이미 화면에 표시되었으므로 백그라운드에서 처리
                    this.handleAgentIntervention(newMessage.text, this.currentChatRoom.id, this.userInfo.email).catch(error => {
                        console.error('❌ 에이전트 개입 처리 실패:', error);
                        console.error('에러 상세:', error.response?.data || error.message);
                        // 실패 시 기존 로직 사용
                        this.sendMessage(newMessage);
                    });
                } else {
                    // 이미지만 있거나 텍스트가 없거나, 에이전트가 멘션된 경우 기존 로직 사용
                    // 이 경우에는 putMessage를 호출해야 함 (백엔드 개입 로직이 없으므로)
                    this.putMessage(userMessageObj);
                    this.sendMessage(newMessage);
                }
                
                // saveAccessPage 에러 무시 (Promise rejection 처리)
                this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch(e => {
                    console.warn('saveAccessPage 실패:', e);
                });
            }
        },
        async handleAgentIntervention(text, chatRoomId, userId) {
            // 에이전트 개입 로직을 비동기로 처리
            try {
                const response = await axios.post('/langchain-chat/intervention', {
                    text: text,
                    chat_room_id: chatRoomId,
                    user_id: userId
                });
                
                if (response.data && response.data.intervention) {
                    const intervention = response.data.intervention;
                    
                    // 개입 정보를 사용자 메시지에 즉시 반영
                    // 방금 추가한 사용자 메시지를 찾아서 jsonContent 업데이트
                    // 가장 최근에 추가된 사용자 메시지를 찾음 (내림차순으로 검색)
                    let userMessage = null;
                    for (let i = this.messages.length - 1; i >= 0; i--) {
                        const msg = this.messages[i];
                        if (msg.content === text && 
                            msg.email === this.userInfo.email) {
                            userMessage = msg;
                            break;
                        }
                    }
                    
                    if (userMessage) {
                        // jsonContent가 없으면 생성 (Vue 3는 반응성이 자동 처리됨)
                        if (!userMessage.jsonContent) {
                            userMessage.jsonContent = {};
                        }
                        
                        // 개입 정보 업데이트 (Vue 3는 직접 할당해도 반응성 유지)
                        userMessage.jsonContent.intervention = {
                            should_intervene: intervention.should_intervene || false,
                            status: intervention.should_intervene ? 'intervening' : 'not_intervening',
                            reason: intervention.reason || '',
                            selected_agent_id: intervention.selected_agent_id || null,
                            agent_name: intervention.agent_response?.agent_name || null
                        };
                    }
                }
                
                // Supabase 실시간 구독이 이미 설정되어 있으므로, getMessages를 호출할 필요 없음
                // 백엔드에서 메시지가 저장되면 실시간 구독을 통해 자동으로 messages 배열에 추가됨
                // getMessages를 호출하면 messages 배열이 초기화되면서 리프레시가 발생하여 입력 필드 포커스가 사라짐
                
                // 에이전트 개입 여부와 관계없이 실시간 구독이 메시지를 자동으로 처리함
                // 사용자 메시지는 이미 messages.push로 추가되었고,
                // 에이전트 응답은 백엔드에서 저장되면 실시간 구독을 통해 자동으로 추가됨
                
                // 단, 사용자가 보낸 메시지가 실시간 구독으로 중복 추가될 수 있으므로 확인
                // 실시간 구독의 중복 체크 로직이 있지만, 사용자 메시지는 email로 필터링됨
                // (175줄: if (data.new.messages.email != me.userInfo.email))
                // 따라서 사용자 메시지는 실시간 구독으로 추가되지 않음
                
                // 에이전트 응답만 실시간 구독으로 추가되므로, 별도 처리 불필요
            } catch (error) {
                console.error('❌ 에이전트 개입 처리 실패:', error);
                console.error('에러 상세:', error.response?.data || error.message);
                // 실패 시에도 LLM 채팅을 실행하지 않음 (에이전트 개입 시스템이 동작하지 않을 때)
                // 사용자 메시지는 이미 화면에 표시되었으므로 그대로 둠
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
                        const startEvent = definition.events?.find(event => event.type === 'startEvent');
                        
                        if (startEvent) {
                            // Start Event 이후의 첫 번째 Sequence 찾기
                            const firstSequence = definition.sequences?.find(seq => seq.source === startEvent.id);
                            
                            if (firstSequence && firstSequence.target) {
                                // 첫 번째 액티비티 찾기
                                firstActivity = definition.activities?.find(activity => activity.id === firstSequence.target);
                                
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
                        preferredLanguage: "Korean"
                    });
                    
                    // 간소화된 프로세스 목록은 이미 WorkAssistantGenerator가 제공했으므로
                    // 동일한 목록을 사용 (중복 로드 방지)
                    const processes = await me.backend.listDefinition();
                    const simplifiedProcesses = processes.map(p => ({
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
                            for (const processId of (responseObj.requiredProcessIds || [])) {
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
                            let filteredInstances = instances.filter(inst => 
                                inst.participants && inst.participants.includes(me.userInfo.uid)
                            );
                            
                            // 특정 프로세스의 인스턴스만 추가 필터링
                            if (responseObj.requiredProcessIds && responseObj.requiredProcessIds.length > 0) {
                                filteredInstances = filteredInstances.filter(inst => 
                                    responseObj.requiredProcessIds.includes(inst.defId)
                                );
                            }
                            
                            // 인스턴스 ID 목록 추출
                            const instanceIds = filteredInstances.map(inst => inst.instId);
                            
                            // todolist 정보 가져오기 (중복 제거된 구조)
                            const todoListData = await me.backend.getTodoListByInstances(instanceIds);
                            
                            // 인스턴스 기본 정보와 todolist 상세 정보 결합
                            const instancesWithDetails = {};
                            
                            Object.keys(todoListData).forEach(defId => {
                                instancesWithDetails[defId] = {
                                    processDefinitionId: defId,
                                    processName: filteredInstances.find(inst => inst.defId === defId)?.name?.split('_')[0] || defId,
                                    instances: {}
                                };
                                
                                Object.keys(todoListData[defId].instances).forEach(instId => {
                                    const instanceInfo = filteredInstances.find(inst => inst.instId === instId);
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
            })
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
                    const firstActivity = data.processDefinition?.definition?.activities?.find(
                        act => act.id === activityId
                    );
                    
                    if (firstActivity && firstActivity.role) {
                        // 해당 role의 endpoint를 현재 사용자로 변경
                        const roleMapping = roleMappings.find(r => r.name === firstActivity.role);
                        if (roleMapping) {
                            roleMapping.endpoint = [me.userInfo.uid];
                            roleMapping.default = [me.userInfo.uid];
                        }
                    }
                    
                    // 폼 데이터를 프로세스 시작 입력으로 변환
                    const input = {
                        process_definition_id: data.processDefinitionId,
                        activity_id: activityId,
                        answer: "",
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
                        const linkMsg = me.createMessageObj(
                            '실행된 프로세스 인스턴스를 확인하시겠습니까?',
                            'system'
                        );
                        linkMsg.instanceId = response.process_instance_id || response.proc_inst_id || response.id;
                        linkMsg.instanceUrl = `/todolist`;
                        linkMsg.companyQueryUrl = `/todolist`;
                        me.putMessage(linkMsg);
                        me.messages.push(linkMsg);
                    } else {
                        const errorMsg = me.createMessageObj(
                            response?.detail || response?.error || me.$t('chats.processExecutionFailed', { title: data.processDefinitionName }),
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
                    if(!me.lastSendMessage) {
                        const userMsgs = me.messages.filter(msg => msg.role === 'user');
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

                } else if(responseObj.work == 'TodoListRegistration'){
                    systemMsg = me.$t('chats.todoAdded', { activityId: responseObj.activity_id })

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
                    systemMsg = me.$t('chats.scheduleAdded', { title: responseObj.title })
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

                const finalMsg = `${me.userInfo.name}님이 요청하신 ${systemMsg}`;
                const systemMsgObj = me.createMessageObj(finalMsg, 'system')
                if(me.currentChatRoom.id == me.chatRoomId){
                    
                    if(me.messages[me.messages.length - 1].content === '...' && me.messages[me.messages.length - 1].isLoading){
                        me.messages.pop()
                    }
                    me.messages.push(systemMsgObj)
                }
                
                me.putMessage(systemMsgObj, me.chatRoomId)
                
                if(response.content){
                    me.deleteSystemMessage(response)
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
                    
                    // 2. 사용자 메시지 생성 및 저장
                    const userMsg = me.createMessageObj({ text: messageText });
                    me.messages.push(userMsg);
                    me.putMessage(userMsg);
                    
                    // 3. WorkAssistantGenerator로 초기화
                    me.generator = new WorkAssistantGenerator(me, {
                        isStream: false,
                        preferredLanguage: "Korean"
                    });
                    
                    // 컨텍스트 설정
                    const contexts = await me.backend.listDefinition();
                    me.generator.setContexts(contexts);
                    me.generator.setUserInfo(me.userInfo);
                    me.generator.setToday();
                    
                    // 4. sendMessage 호출 (ChatModule의 생명주기 활용, 중복 체크로 메시지는 추가 안됨)
                    await me.sendMessage({ text: messageText });
                    
                    // query parameter 제거
                    me.$router.replace({ path: '/chats-temp' });
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
                    const chatRoomIndex = me.chatRoomList.findIndex(room => room.id === me.currentChatRoom.id);
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
                        preferredLanguage: "Korean"
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
                    
                    const lastUserMessage = me.messages.filter(msg => msg.role === 'user').pop();
                    await me.handleExecuteProcessRequest({
                        processDefinitionId: responseObj.process_definition_id || responseObj.processDefinitionId,
                        processDefinitionName: responseObj.process_definition_name || responseObj.processDefinitionName || responseObj.messageForUser,
                        userMessage: lastUserMessage ? lastUserMessage.content : ''
                    });
                    return;
                    
                } else if (responseObj.work === 'CompanyQuery') {
                    // 회사 정보 조회 - 2단계 LLM 실행
                    // WorkAssistantGenerator의 응답 메시지 제거
                    if (me.messages[me.messages.length - 1].role === 'system') {
                        me.messages.pop();
                    }
                    
                    const lastUserMessage = me.messages.filter(msg => msg.role === 'user').pop();
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
                    preferredLanguage: "Korean"
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
            if(responseObj && !responseObj.work){ // work가 없는 경우만 처리 (메인 채팅 intent는 위에서 처리됨)
                let startProcess = false;
                let role = 'system';
                let obj = me.createMessageObj(responseObj, role)
                if(responseObj.messageForUser){
                    obj.messageForUser = responseObj.messageForUser
                }
                if(me.isSystemChat) {
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
                            const responseTable = await axios.post(`/completion/process-data-query`, {
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
                    } else {
                        startProcess = true;
                    }
                    obj.uuid = me.uuid()
                    if(!startProcess) {
                        me.putMessage(obj, chatRoomId)
                    }
                } else {
                    if(!me.ProcessGPTActive) me.ProcessGPTActive = true
                    if (typeof responseObj == 'string') {
                        responseObj = {
                            messageForUser: responseObj
                        }
                    }
                    if (!responseObj.expanded) {
                        responseObj.expanded = false
                    }
                    me.generatedWorkList.push(responseObj)
                }
            }
        },
        async handleProcessDefinitionMessage(message) {
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
                delete message.chatRoomName;
                
                if (message && (message.text != '' || (message.images && message.images.length > 0) || message.image != null)) {
                    // 1. 메시지 객체 생성
                    const messageObj = this.createMessageObj(message);
                    
                    // 2. DB에 저장
                    this.putMessage(messageObj);
                    
                    // 3. UI에 즉시 표시
                    this.messages.push(messageObj);
                    
                    // 4. AI 생성을 위한 설정
                    if(!this.generator.contexts) {
                        let contexts = await this.backend.listDefinition();
                        this.generator.setContexts(contexts);
                    }
                    
                    let instanceList = await this.backend.getAllInstanceList(); 
                    this.generator.setWorkList(instanceList);
                    
                    // 5. AI 생성 시작 (sendMessage를 호출하지 않아 중복 추가 방지)
                    this.lastSendMessage = message;
                    if(this.ProcessGPTActive) {
                        this.startGenerate();
                    }
                    
                    // saveAccessPage 에러 무시
                    this.backend.saveAccessPage(this.userInfo.email, 'chat:' + this.currentChatRoom.id).catch(e => {
                        console.warn('saveAccessPage 실패:', e);
                    });
                }
            }

        },
        // setWatchChatList 오버라이드: 그룹채팅 전용 intervention 처리 추가
        async setWatchChatList(chatRoomIds) {
            var me = this;
            me.userInfo = await this.backend.getUserInfo();
           
            await this.backend.watchChats((data) => {
                if(data && data.new){
                    if(data.eventType == "DELETE"){
                        let messageIndex = me.messages.findIndex(msg => msg.uuid === data.old.uuid);
                        if (messageIndex !== -1) {
                            me.messages.splice(messageIndex, 1);
                        }
                    } else {
                        if (!me.currentChatRoom && me.chatRoomId) {
                            me.currentChatRoom = {
                                id: me.chatRoomId
                            }
                        }
                        
                        // UPDATE 이벤트인 경우: 사용자 메시지의 intervention 정보 업데이트 처리 (그룹채팅 전용)
                        if (data.eventType == "UPDATE" && data.new.messages.email === me.userInfo.email) {
                            if (data.new.id == me.currentChatRoom.id) {
                                // 해당 메시지를 찾아서 jsonContent 업데이트
                                const messageIndex = me.messages.findIndex(msg => 
                                    msg.uuid === data.new.uuid || 
                                    (msg.content === data.new.messages.content && 
                                     msg.email === data.new.messages.email &&
                                     Math.abs(msg.timeStamp - data.new.messages.timeStamp) < 5000)
                                );
                                
                                if (messageIndex !== -1) {
                                    // UUID 업데이트 (없으면 추가)
                                    if (data.new.uuid && !me.messages[messageIndex].uuid) {
                                        me.messages[messageIndex].uuid = data.new.uuid;
                                    }
                                    if (data.new.id && !me.messages[messageIndex].id) {
                                        me.messages[messageIndex].id = data.new.id;
                                    }
                                    // jsonContent.intervention이 있으면 업데이트
                                    if (data.new.messages.jsonContent && data.new.messages.jsonContent.intervention) {
                                        if (!me.messages[messageIndex].jsonContent) {
                                            me.messages[messageIndex].jsonContent = {};
                                        }
                                        me.messages[messageIndex].jsonContent.intervention = data.new.messages.jsonContent.intervention;
                                    }
                                }
                            }
                        }
                        
                        // 에이전트 메시지 또는 다른 사용자 메시지 처리
                        // 에이전트 메시지는 email이 없거나 role이 'agent'일 수 있음
                        const isAgentMessage = data.new.messages.role === 'agent' || data.new.messages.role === 'system';
                        const isOtherUserMessage = data.new.messages.email && data.new.messages.email != me.userInfo.email;
                        
                        if (isAgentMessage || isOtherUserMessage) {
                            if(data.new.id == me.currentChatRoom.id){
                                if ((me.messages && me.messages.length > 0) 
                                && (data.new.messages.role == 'system' && me.messages[me.messages.length - 1].role == 'system') 
                                && (me.messages[me.messages.length - 1].content == 'AI 생성중...' || me.messages[me.messages.length - 1].content == '테이블 생성 중...' || me.messages[me.messages.length - 1].content.replace(/\s+/g, '').includes(data.new.messages.content.replace(/\s+/g, '')))
                                ) {
                                    // UUID 포함 (에이전트 개입 응답 매칭을 위해 필수)
                                    const messageWithUuid = { ...data.new.messages };
                                    messageWithUuid.uuid = data.new.uuid || messageWithUuid.uuid || null;
                                    messageWithUuid.id = data.new.id || messageWithUuid.id || messageWithUuid.uuid || null;
                                    me.messages[me.messages.length - 1] = messageWithUuid;
                                    me.messages[me.messages.length - 1].isLoading = false;
                                    me.EventBus.emit('instances-updated');
                                } else {
                                    // 중복 메시지 체크: uuid 또는 내용+시간으로 확인
                                    const isDuplicate = me.messages.some(msg => 
                                        (data.new.uuid && msg.uuid === data.new.uuid) ||
                                        (msg.content === data.new.messages.content && 
                                         msg.role === data.new.messages.role && 
                                         Math.abs(msg.timeStamp - data.new.messages.timeStamp) < 1000)
                                    );
                                    
                                    if (!isDuplicate) {
                                        // UUID 포함 (에이전트 개입 응답 매칭을 위해 필수)
                                        const messageWithUuid = { ...data.new.messages };
                                        messageWithUuid.uuid = data.new.uuid || messageWithUuid.uuid || null;
                                        messageWithUuid.id = data.new.id || messageWithUuid.id || messageWithUuid.uuid || null;
                                        me.messages.push(messageWithUuid);
                                    }
                                }
                                me.newMessageInfo = data.new.messages
                            }
                            
                            let idx = me.chatRoomList.findIndex(x => x.id == data.new.id)
                            if(idx != -1){
                                me.chatRoomList[idx].message.msg = data.new.messages.messageForUser ? data.new.messages.messageForUser : data.new.messages.content
                                me.chatRoomList[idx].message.createdAt = data.new.messages.timeStamp
    
                                if(me.chatRoomList[idx].id != me.currentChatRoom.id){
                                    const participantWithEmail = me.chatRoomList[idx].participants.find(participant => participant.email === me.userInfo.email);
                                    participantWithEmail.isExistUnReadMessage = true
                                }
                            }
                        }
                    }
                }
            }, {
                filter: `id=in.(${chatRoomIds.join(',')})`
            });
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


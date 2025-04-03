<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                    <v-tabs v-model="activeTab" grow color="primary">
                        <v-tooltip location="top" :text="$t('chat.user')">
                            <template v-slot:activator="{ props }">
                                <v-tab v-bind="props">
                                    <v-icon>mdi-account</v-icon>
                                </v-tab>
                            </template>
                        </v-tooltip>
                        <v-tooltip location="top" :text="$t('chat.chatRoom')">
                            <template v-slot:activator="{ props }">
                                <v-tab v-bind="props">
                                    <v-icon>mdi-message</v-icon>
                                </v-tab>
                            </template>
                        </v-tooltip>
                    </v-tabs>
                    <v-tabs-items v-model="activeTab">
                        <v-tab-item v-if="activeTab == 0">
                            <ChatProfile style="margin-bottom: -15px;" />
                            <v-divider class="my-2"></v-divider>
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
                        </v-tab-item>
                        <v-tab-item v-else>
                            <ChatListing 
                                :chatRoomList="filteredChatRoomList" 
                                :userList="userList" 
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                @chat-selected="chatRoomSelected" 
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-tab-item>
                    </v-tabs-items>
                </div>
            </template>
            <template v-slot:rightpart>
                <div :key="chatRenderKey">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :agentInfo="agentInfo"
                        :userList="userList"
                        :currentChatRoom="currentChatRoom"
                        :type="path"
                        :generatedWorkList="generatedWorkList"
                        :ProcessGPTActive="ProcessGPTActive"
                        :chatRoomId="chatRoomId"
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
                    ></Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <div class="no-scrollbar">
                    <v-tabs v-model="activeTab">
                        <v-tab>
                            <v-icon>mdi-account</v-icon>
                        </v-tab>
                        <v-tab>
                            <v-icon>mdi-message</v-icon>
                        </v-tab>
                    </v-tabs>
                    <v-tabs-items v-model="activeTab">
                        <v-tab-item v-if="activeTab == 0">
                            <ChatProfile style="margin-bottom: -15px;" />
                            <v-divider class="my-2"></v-divider>
                            <UserListing 
                                :userList="userList" 
                                @selectedUser="selectedUser"
                                @startChat="startChat"
                            />
                        </v-tab-item>
                        <v-tab-item v-else>
                            <ChatListing 
                                :chatRoomList="filteredChatRoomList" 
                                :userList="userList" 
                                :userInfo="userInfo"
                                :chatRoomId="chatRoomId"
                                @chat-selected="chatRoomSelected" 
                                @create-chat-room="createChatRoom"
                                @delete-chat-room="deleteChatRoom"
                            />
                        </v-tab-item>
                    </v-tabs-items>
                </div>
            </template>
        </AppBaseCard>
        <v-dialog v-model="openWorkOrderDialog" persistent>
            <v-row class="ma-0 pa-0">
                <v-col  v-if="!isMobile && assistantRes" class="pa-0 mr-2"
                    cols="4"
                >
                    <v-card>
                        <div class="description-card">
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
import ChatModule from "@/components/ChatModule.vue";
import ChatGenerator from "@/components/ai/WorkAssistantGenerator.js";
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
        AssistantChats

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
    }),
    computed: {
        filteredChatRoomList() {
            return this.chatRoomList.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
        }
    },
    watch: {
        currentChatRoom: {
            handler(newVal) {
                if(this.generator && newVal && newVal.id){
                    this.chatRoomId = newVal.id;
                    this.generator.setChatRoomData(newVal);
                }
            },
            deep: true
        }
    },  
    async created() {
        this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        this.userInfo = await this.storage.getUserInfo();
        await this.getChatRoomList();
        await this.getUserList();
        await this.getCalendar();

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        if (this.$route.query.id) {
            this.chatRoomSelected(this.chatRoomList.find(room => room.id === this.$route.query.id));
        }
        if (this.currentChatRoom && this.currentChatRoom.id) {
            this.chatRoomId = this.currentChatRoom.id;
        }
    },
    methods: {
        selectedUser(user){
            this.selectedUserInfo = user
        },
        startChat(type){
            let chatRoomInfo
            const selectedUserEmail = this.selectedUserInfo.email;
            const currentUserEmail = this.userInfo.email;

            if(type == 'work'){
                chatRoomInfo = {}
                chatRoomInfo.name = this.selectedUserInfo.username
                chatRoomInfo.participants = []
                chatRoomInfo.participants.push(this.selectedUserInfo)
                this.createChatRoom(chatRoomInfo)
            } else {
                const chatRoomExists = this.chatRoomList.some(chatRoom => {
                    if(chatRoom.participants.length == 2){
                        const participantEmails = chatRoom.participants.map(participant => participant.email);
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

            this.activeTab = 1

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
            const res = await this.storage.getObject(`db://calendar/${this.userInfo.uid}`, option);
            this.calendarData = res && res.data ? res.data : {};
            this.generator.setCalendarData(this.calendarData);
        },
        async getUserList(){
            var me = this
            await me.storage.list(`users`).then(function (users) {
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
        async getChatRoomList(){
            var me = this
            await me.storage.list(`chat_rooms`).then(function (chatRooms) {
                if (chatRooms) {
                    chatRooms.forEach(function (chatRoom) {
                        if(chatRoom.participants.find(x => x.email === me.userInfo.email)){
                            me.chatRoomList.push(chatRoom)
                        }
                    });
                    if(me.chatRoomList.length > 0){
                        me.currentChatRoom = me.filteredChatRoomList[0];
                        me.chatRoomSelected(me.currentChatRoom)
                        me.getChatList(me.filteredChatRoomList[0].id);
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
            });
        },
        deleteChatRoom(chatRoomId){
            let index = this.chatRoomList.findIndex(room => room.id === chatRoomId);
            if(index !== -1) {
                this.chatRoomList.splice(index, 1);
            }
            this.storage.delete(`chats/${chatRoomId}`, {key: 'id'});
            this.storage.delete(`chat_rooms/${chatRoomId}`, {key: 'id'});

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
                chatRoomInfo.participants.forEach(participant => {
                    delete participant.profile;
                });
                let userInfo = {
                    "id": this.userInfo.uid,
                    "username": this.userInfo.name,
                    "email": this.userInfo.email,
                }
                chatRoomInfo.participants.push(userInfo)
                let currentTimestamp = Date.now()
                chatRoomInfo.message = {
                    "msg": "NEW",
                    "type": "text",
                    "createdAt": currentTimestamp
                }
                this.chatRoomList.push(chatRoomInfo)
            } else {
                let index = this.chatRoomList.findIndex(room => room.id === chatRoomInfo.id);
                if(index !== -1) {
                    this.chatRoomList.splice(index, 1, chatRoomInfo);
                }
            }
            
            this.putObject(`chat_rooms`, chatRoomInfo);
            this.chatRoomSelected(chatRoomInfo)
        },
        setReadMessage(idx){
            let participant = this.chatRoomList[idx].participants.find(participant => participant.email === this.userInfo.email);
            if(participant) {
                participant.isExistUnReadMessage = false;
            }
            this.putObject(`chat_rooms`, this.chatRoomList[idx]);
        },
        chatRoomSelected(chatRoomInfo){
            this.currentChatRoom = chatRoomInfo
            if(chatRoomInfo.participants.find(p => p.id === "system_id")){
                this.ProcessGPTActive = true
            } else {
                this.ProcessGPTActive = false
            }
            this.getChatList(chatRoomInfo.id);
            this.setReadMessage(this.chatRoomList.findIndex(x => x.id == chatRoomInfo.id));
        },
        async putMessage(msg){
            // this.addTextToVectorStore(msg)
            let uuid
            if(msg.uuid){
                uuid = msg.uuid
            } else {
                uuid = this.uuid()
            }
            let message = {
                "messages": msg,
                "id": this.currentChatRoom.id,
                "uuid": uuid,
            }
            this.putObject(`chats/${uuid}`, message);

            let chatRoomObj = {
                "msg": msg.messageForUser ? msg.messageForUser : msg.content,
                "type": "text",
                "createdAt": msg.timeStamp
            }
            this.currentChatRoom.message = chatRoomObj
            this.currentChatRoom.participants.forEach(participant => {
                if(participant.email !== this.userInfo.email) {
                    participant.isExistUnReadMessage = true
                }
            });
            this.putObject(`chat_rooms`, this.currentChatRoom);
        },
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || newMessage.image != null)) {
                this.putMessage(this.createMessageObj(newMessage))
                if(!this.generator.contexts) {
                    let contexts = await this.storage.list(`proc_def`);
                    this.generator.setContexts(contexts);
                }
                
                this.generator.setWorkList(this.generatedWorkList);
                newMessage.callType = 'chats'
                this.sendMessage(newMessage);
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
        },
        deleteSystemMessage(response){
            this.storage.delete(`chats/${response.uuid}`, {key: 'uuid'});
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
                            const res = await me.storage.getObject(`db://calendar/${participant}`, option);
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
                } else if(responseObj.work == 'CreateProcessDefinition'){
                    systemMsg = this.$t('chats.processDefinitionCreated')
                    me.$store.dispatch('updateMessages', me.messages);
                    me.$router.push('/definitions/chat');
                } else if(responseObj.work == 'ModifyProcessDefinition'){
                    systemMsg = this.$t('chats.processDefinitionModificationStarted')
                    me.$store.dispatch('updateEditMessages', me.messages)
                    me.$router.push(`/definitions/${responseObj.processId}`);
                }

                systemMsg = this.$t('chats.userRequestedAction', { name: me.userInfo.name, action: systemMsg })

                const systemMsgObj = me.createMessageObj(systemMsg, 'system')
                this.messages.push(systemMsgObj)
                me.putMessage(systemMsgObj)
                
                if(response.content){
                    me.deleteSystemMessage(response)
                }
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj) {
            if(responseObj){
                let obj = this.createMessageObj(responseObj, 'system')
                if(responseObj.messageForUser){
                    obj.messageForUser = responseObj.messageForUser
                }
                if(responseObj.work == 'CompanyQuery' || responseObj.work == 'ScheduleQuery'){
                    this.messages.push({
                        role: 'system',
                        content: '...',
                        isLoading: true
                    });
                    if(responseObj.work == 'CompanyQuery'){
                        try{
                            let mementoRes = await axios.post(`/memento/query`, {
                                query: responseObj.content,
                                tenant_id: window.$tenantName
                            });
                            console.log(mementoRes)
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
                            const token = localStorage.getItem('accessToken');
                            const responseTable = await axios.post(`/execution/process-data-query`, {
                                input: {
                                    query: responseObj.content
                                }
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            obj.tableData = responseTable.data.output
                        } catch(error){
                            alert(error);
                        }
                    } else if(responseObj.work == 'ScheduleQuery'){
                        console.log(responseObj)
                    }
                    obj.uuid = this.uuid()
                    this.putMessage(obj)
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
    }
}
</script>

<style scoped>
.description-card {
    height:81.6vh;
    overflow: auto;
}
</style>

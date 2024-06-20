<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                <ChatProfile />
                <ChatListing 
                    :chatRoomList="filteredChatRoomList" 
                    :userList="userList" 
                    :userInfo="userInfo"
                    @chat-selected="chatRoomSelected" 
                    @create-chat-room="createChatRoom"
                />
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
                    ></Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <ChatProfile />
                <ChatListing 
                    :chatRoomList="filteredChatRoomList" 
                    :userList="userList" 
                    :userInfo="userInfo"
                    @chat-selected="chatRoomSelected" 
                    @create-chat-room="createChatRoom"
                />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import ChatModule from "@/components/ChatModule.vue";
import ConsultingGenerator from "@/components/ai/ProcessConsultingGenerator.js";
import ConsultingMentoGenerator from "@/components/ai/ProcessConsultingMentoGenerator.js";
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from "@/components/ui/Chat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import { VDataTable } from 'vuetify/labs/VDataTable';


export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatProfile,
        VDataTable,

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
        currentChatRoom: null,
        userList: [],
        chatRenderKey: 0,
        generatedWorkList: [],
        isMentoMode: false,
    }),
    computed: {
        filteredChatRoomList() {
            return this.chatRoomList.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
        }
    },
    watch: {
        currentChatRoom: {
            handler(newVal) {
                if(this.generator){
                    this.chatRoomId = newVal.id;
                    this.generator.setChatRoomData(newVal);
                }
            },
            deep: true
        }
    },  
    async created() {
        this.init();
        this.generator = new ConsultingGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        this.userInfo = await this.storage.getUserInfo();
        await this.getChatRoomList();
        await this.getUserList();

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        if (this.currentChatRoom && this.currentChatRoom.id) {
            this.chatRoomId = this.currentChatRoom.id;
        }
        this.EventBus.on('messages-updated', () => {
            if(!this.isMentoMode){
                this.generator = new ConsultingMentoGenerator(this, {
                    isStream: true,
                    preferredLanguage: "Korean"
                });
                this.isMentoMode = true

                let chatMsgs = [];
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        if (msg.content) {
                            chatMsgs.push({
                                role: msg.role,
                                content: msg.content
                            });
                        }
                    });
                }

                let chatObj = {
                    role: 'system'
                };
                if(this.generator){
                    this.generator.model = "gpt-4o";
                }
                
                chatObj.content= response;
                chatMsgs.push(chatObj);
                this.generator.previousMessages = [this.generator.previousMessages[0], ...chatMsgs];
                this.startGenerate();
            }
        });
    },
    methods: {
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
            
            this.currentChatRoom = chatRoomInfo
            this.putObject(`chat_rooms`, chatRoomInfo);
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
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || newMessage.image != null)) {
                this.putMessage(this.createMessageObj(newMessage))
                this.sendMessage(newMessage);
            }
        },

        afterModelCreated(response) {},
        afterModelStopped(response) {},
        async afterGenerationFinished(response) {
            let obj = this.createMessageObj(response, 'system')
            this.putMessage(obj)
            if(this.isMentoMode){
                this.generator = new ConsultingGenerator(this, {
                    isStream: true,
                    preferredLanguage: "Korean"
                });
                this.isMentoMode = false
            }
        },

    }
}
</script>

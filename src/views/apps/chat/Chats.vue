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
                    >
                        <template v-slot:custom-chat>
                            <VDataTable v-if="onLoad" :headers="headers" :items="definitions" item-value="processDefinitionId" class="overflow-x-auto">
                                <template v-slot:item.actions="{ item }">
                                    <v-btn color="primary" class="px-4 rounded-pill mx-auto" variant="tonal"
                                        @click="executeProcess(item.raw.id)">Select</v-btn>
                                </template>
                            </VDataTable>
                        </template>
                    </Chat>
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
import ChatGenerator from "@/components/ai/WorkAssistantGenerator.js";
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
                    this.generator.setChatRoomData(newVal);
                }
            },
            deep: true
        }
    },  
    async created() {
        // this.init();
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
    },
    methods: {
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
                    })
                    if(me.chatRoomList.length > 0){
                        me.currentChatRoom = me.filteredChatRoomList[0]
                        me.getChatList(me.filteredChatRoomList[0].id);
                        me.setReadMessage(0);
                    } else {
                       // alert("Create a new chat room")
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

        async beforeExecuteProcess(newMessage) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    var url = '/process-search/invoke'
                    var req = {
                        input: {
                            answer: newMessage.text || '',
                            image: newMessage.image || ''
                        }
                    }
                    let response = await axios.post(url, req);
                    const output = JSON.parse(response.data.output)
                    if (output && output.processDefinitionList) {
                        me.definitions = output.processDefinitionList;
                        me.onLoad = true;
                    }
                }
            })

            // if(!this.generator.contexts) {
            //     var procDefs = await this.queryFromVectorDB(newMessage.text);
            //     if (procDefs) {
            //         procDefs = procDefs.map(item => JSON.parse(item));
            //         this.definitions = procDefs;
            //         this.onLoad = true;
            //     }
            // }
        },
        executeProcess(processDefinitionId) {
            this.$router.push('/instances/chat?process=' + processDefinitionId)
        },

        afterModelCreated(response) {
        },
        deleteSystemMessage(response){
            this.storage.delete(`chats/${response.uuid}`, {key: 'uuid'});
        },
        cancelProcess(response){
            let systemMsg = `${this.userInfo.name}님의 요청이 취소되었습니다.`
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
                    localStorage.setItem('instancePrompt', this.lastSendMessage.text)
                    systemMsg = `"${responseObj.title}" 프로세스를 시작하겠습니다.`
                    // me.$router.push('/instances/chat')
                    this.beforeExecuteProcess({ text: responseObj.title, image: this.lastSendMessage.image });

                } else if(responseObj.work == 'TodoListRegistration'){
                    systemMsg = `"${responseObj.activity_id}" 할 일이 추가되었습니다.`

                    if(!responseObj.participants){
                        responseObj.participants = []
                    }

                    if (!responseObj.participants.includes(me.userInfo.email)) {
                        responseObj.participants.push(me.userInfo.email);
                    }
                    
                    responseObj.participants.forEach(function (email){
                        let todoObj = JSON.parse(JSON.stringify(responseObj))
                        delete todoObj.work
                        delete todoObj.messageForUser
                        delete todoObj.participants
                        todoObj.proc_inst_id = null
                        todoObj.proc_def_id = null
                        todoObj.id = me.uuid()
                        todoObj.user_id = email
                        me.putObject('todolist', todoObj);
                    })

                } else if(responseObj.work == 'ScheduleRegistration'){
                    systemMsg = `"${responseObj.title}" 일정이 추가되었습니다.`
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
                    systemMsg = `프로세스 정의가 생성되었습니다.`
                    me.$store.dispatch('updateMessages', me.messages);
                    me.$router.push('/definitions/chat');
                }
                systemMsg = `${me.userInfo.name}님이 요청하신 ${systemMsg}`
                me.putMessage(me.createMessageObj(systemMsg, 'system'))
                if(response.content){
                    me.deleteSystemMessage(response)
                }
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(response) {
            let responseObj = response
            if(responseObj.work == 'SKIP'){
                if(!this.ProcessGPTActive){
                    this.messages.pop();
                }
            } else {
                if(this.ProcessGPTActive){
                    responseObj.expanded = false
                    this.generatedWorkList.push(responseObj)
                }
                let obj = this.createMessageObj(response, 'system')
                if(responseObj.messageForUser){
                    obj.messageForUser = responseObj.messageForUser
                }
                if(responseObj.work == 'CompanyQuery'){
                    try{
                        var url = window.$memento == '' ? 'http://localhost:8005' : window.$memento
                        let responseMemento = await axios.post(`${url}/query`, { query: responseObj.content});
                        obj.memento = {}
                        obj.memento.response = responseMemento.data.response
                        if (!responseMemento.data.metadata) return {};
                        const unique = {};
                        const sources = Object.values(responseMemento.data.metadata).filter(obj => {
                            if (!unique[obj.file_path]) {
                                unique[obj.file_path] = true;
                                return true;
                            }
                        });
                        obj.memento.sources = sources

                        const responseTable = await axios.post(`${window.$backend}/process-data-query/invoke`, {
                            input: {
                                var_name: responseObj.content
                            }
                        });
                        obj.tableData = responseTable.data.output
                    } catch(error){
                        alert(error);
                    }
                } else if(responseObj.work == 'ScheduleQuery'){
                    console.log(responseObj)
                } else {
                    if(!this.ProcessGPTActive){
                        obj.uuid = this.uuid()
                        obj.systemRequest = true
                        obj.requestUserEmail = this.userInfo.email
                    }
                }
                if(!this.ProcessGPTActive){
                    // this.messages.pop();
                    this.putMessage(obj)
                }
            }
        },

        async queryFromVectorDB(messsage){
            // const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: this.openaiToken });

            // Perform a similarity search
            const results = await vectorStore.similaritySearch({
                query: messsage
            });

            if (results.similarItems) {
                return results.similarItems.map(item => item.text);
            }
        },

    }
}
</script>

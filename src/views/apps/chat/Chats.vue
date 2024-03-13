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
                <Chat
                    :messages="messages"
                    :userInfo="userInfo"
                    :userList="userList"
                    :type="path"
                    @beforeReply="beforeReply"
                    @sendMessage="beforeSendMessage"
                    @startProcess="startProcess"
                    @cancelProcess="cancelProcess"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                    @getMoreChat="getMoreChat"
                ></Chat>
            </template>

            <template v-slot:mobileLeftContent>
                <ChatProfile />
                <ChatListing />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import ChatGenerator from "@/components/ai/WorkAssistantGenerator.js";
import Chat from "@/components/ui/Chat.vue";
import ChatModule from "@/components/ChatModule.vue";
import axios from 'axios';


export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatProfile
    },
    data: () => ({
        definitions: [],
        processDefinition: null,
        path: "chats",
        organizationChart: [],
        calendarData: null,
        currentChatRoom: null,
        userList: [],
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
    },
    methods: {
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
            await me.storage.list(`db://users`).then(function (users) {
                if (users) {
                    users = users.filter(user => user.email !== me.userInfo.email);
                    me.userList = users
                }
            });
        },
        async getChatRoomList(){
            var me = this
            await me.storage.list(`db://chat_rooms`).then(function (chatRooms) {
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
                        alert("Create a new chat room")
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
        // async addTextToVectorStore(msg){
        //     const apiToken = this.generator.getToken();
        //     const vectorStore = new VectorStorage({ openAIApiKey: apiToken });
        //     try {
        //     // 메시지 추가
        //         await vectorStore.addText(JSON.stringify(msg), {
        //             category: this.currentChatRoom.id
        //         });
        //     } catch (error) {
        //         console.error("Error adding message to vectorStore:", error);
        //     }
        // },
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
            
            // let test = await this.queryMsgFromVectorDB(msg.content)
            // console.log(test)
        },
        // async queryMsgFromVectorDB(content) {
        //     const apiToken = this.generator.getToken();
        //     const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

        //     const results = await vectorStore.similaritySearch({
        //         query: content,
        //         category: this.currentChatRoom.id
        //     });

        //     if (results.similarItems) {
        //         return results.similarItems.map(item => item.text);
        //     }
        // },
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && newMessage.text != '') {
                this.putMessage(this.createMessageObj(newMessage.text))
                if(!this.generator.contexts) {
                    let contexts = await this.queryFromVectorDB(newMessage.text);
                    this.generator.setContexts(contexts);
                }
                
                this.sendMessage(newMessage);
            }
        },

        // async loadData(path) {
            // var me = this
            // const value = await this.getData(path);

            // if (value) {
            //     if (value.organizationChart) {
            //         this.organizationChart = JSON.parse(value.organizationChart);
                    
            //         if (!this.organizationChart) {
            //             this.organizationChart = []
            //         }
            //     } else {
            //         // if (this.$route.params && this.$route.params.id) {
            //             // Object.keys(value).forEach(function (key){
            //             //     me.processInstance[key] = partialParse(value[key].model);
            //             // })

            //         }
            //     // }
            // }
        // },

        afterModelCreated(response) {
            // let jsonInstance = this.extractJSON(response);

            // if (jsonInstance) {
            //     try {
            //         this.processInstance = partialParse(jsonInstance);
            //     } catch (error) {
            //         this.processInstance = jsonInstance;
            //         console.log(error);
            //     }
            // }
        },
        deleteSystemMessage(response){
            if(response.idx){
                this.messages.splice(response.idx, 1);
            }
            this.storage.delete(`chats/${response.uuid}`, {key: 'uuid'});
        },
        cancelProcess(response){
            let systemMsg = `${this.userInfo.name}님의 요청이 취소되었습니다.`
            this.putMessage(this.createMessageObj(systemMsg, 'system'))
            this.deleteSystemMessage(response)
        },
        async startProcess(response){
            var me = this
            if(response.content && response.content.includes("{")){
                let responseObj = partialParse(response.content)
                let systemMsg
                if(responseObj.work == 'StartProcessInstance'){
                    systemMsg = `"${responseObj.title}" 프로세스를 시작하겠습니다.`
                    localStorage.setItem('instancePrompt', JSON.stringify(responseObj.prompt))
                    me.$router.push('/instances/chat')
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
                    let startTime = start[1].split("-")
                    
                    let end = responseObj.endDateTime.split('/')
                    let endDate = end[0].split("-")
                    let endTime = end[1].split("-")
                    // {
                    //     start: new Date(y, m, d + 3, 10, 30),
                    //     end: new Date(y, m, d + 3, 11, 30),
                    // },
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
                } 
                systemMsg = `${me.userInfo.name}님이 요청하신 ${systemMsg}`
                me.putMessage(me.createMessageObj(systemMsg, 'system'))
                me.deleteSystemMessage(response)
            }
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(response) {
            if(response == '.' || response == '.\n' || response == '{}') {
                this.messages.splice(this.messages.length - 1, 1)
            } else {
                let obj = this.createMessageObj(response, 'system')
                if(response && response.includes("{")){
                    let responseObj = partialParse(response)
                    if(responseObj.messageForUser){
                        obj.messageForUser = responseObj.messageForUser
                    }

                    if(responseObj.work == 'CompanyQuery'){
                        try{
                            let responseMemento = await axios.post('http://localhost:8005/query', { query: responseObj.content});
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

                            const responseTable = await axios.post('http://localhost:8006/process-data-query/invoke', {
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
                        obj.uuid = this.uuid()
                        obj.systemRequest = true
                        obj.requestUserEmail = this.userInfo.email
                    }
                }
                this.putMessage(obj)
            }
        },

        async sendTodolist() {
            let path = "";
            const uuid = this.uuid();
            let putObj = {};

            putObj[uuid] = {
                activityId: "",
                activityName: "",
                startDate: new Date().toISOString().substr(0, 10),
                endDate: "",
                dueDate: "",
                processDefinitionId: "",
                processInstanceId: "",
                userId: this.userInfo.email
            };

            if (this.processDefinition) {
                putObj[uuid].processDefinitionId = this.processDefinition.processDefinitionId;

                this.processDefinition.activities.forEach(act => {
                    if (act.id == this.processInstance.currentActivityId) {
                        putObj[uuid].activityName = act.name; 
                    }
                });
            }

            if (this.processInstance) {
                putObj[uuid].activityId = this.processInstance.currentActivityId;
                putObj[uuid].processInstanceId = this.processInstance.processInstanceId;
                path = `todolist/${this.processInstance.nextUserEmail}`;
                
                this.putObject(path, putObj);
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

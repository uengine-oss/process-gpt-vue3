<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                <ChatProfile />
                <ChatListing :chatRoomList="filteredChatRoomList" :userList="userList" 
                    @chat-selected="chatRoomSelected" 
                    @create-chat-room="createChatRoom"
                />
                </div>
            </template>
            <template v-slot:rightpart>
                <Chat
                    :messages="messages"
                    :userInfo="userInfo"
                    :type="path"
                    @beforeReply="beforeReply"
                    @sendMessage="beforeSendMessage"
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
import { format } from 'date-fns';
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
        prompt: null,
        definitions: [],
        processDefinition: null,
        // processInstance: {},
        path: "chats",
        organizationChart: [],
        calendarData: null,
        currendtChatRoom: null,
        userList: null,
    }),
    computed: {
        filteredChatRoomList() {
            return this.chatRoomList.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
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
            const res = await this.storage.getObject(`db://calendar/${localStorage.getItem('uid')}`, option);
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
                        if(chatRoom.participants.find(x => x === me.userInfo.email)){
                            me.chatRoomList.push(chatRoom)
                        }
                    })
                    if(me.chatRoomList.length > 0){
                        me.currendtChatRoom = me.filteredChatRoomList[0]
                        me.getChatList(me.filteredChatRoomList[0].id);
                    } else {
                        alert("Create a new chat room")
                    }
                }
            });
        },
        createChatRoom(chatRoomInfo){
            if(!chatRoomInfo.id){
                chatRoomInfo.id = this.uuid();
                chatRoomInfo.participants.push(this.userInfo.email)
                chatRoomInfo.thumb = "/src/assets/images/profile/user-2.jpg"
                let currentTimestamp = Date.now().toString();
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
            
            this.currendtChatRoom = chatRoomInfo
            this.putObject(`chat_rooms`, chatRoomInfo);
        },
        chatRoomSelected(chatRoomInfo){
            this.currendtChatRoom = chatRoomInfo
            this.getChatList(chatRoomInfo.id);
        },
        putMessage(msg){
            let uuid = this.uuid()
            let message = {
                "messages": msg,
                "id": this.currendtChatRoom.id,
                "uid": uuid,
            }
            this.putObject(`chats/${uuid}`, message);

            let chatRoomObj = {
                "msg": msg.messageForUser ? msg.messageForUser : msg.content,
                "type": "text",
                "createdAt": msg.timeStamp
            }
            this.currendtChatRoom.message = chatRoomObj
            this.putObject(`chat_rooms`, this.currendtChatRoom);
        },
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && newMessage.text != '') {
                if(newMessage.text.includes("시작하겠습니다.")){
                    this.putMessage(this.createMessageObj(newMessage.text, 'system'))
                } else {
                    this.putMessage(this.createMessageObj(newMessage.text))
                    if(!this.generator.contexts) {
                        let contexts = await this.queryFromVectorDB(newMessage.text);
                        this.generator.setContexts(contexts);
                    }
                    
                    this.prompt = {
                        content: newMessage.text,
                        requestUserEmail: this.userInfo.email,
                        requestUserName: this.userInfo.name,
                    }
                    this.sendMessage(newMessage);
                }
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
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(response) {
            if(response == '.' || response == '.\n') {
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
                    } else if(responseObj.work == 'ScheduleRegistration'){
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
                        let uuid = this.uuid()
                        if(!this.calendarData[`${startDate[0]}_${startDate[1]}`]){
                            this.calendarData[`${startDate[0]}_${startDate[1]}`] = {}
                        }
                        this.calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = {
                            id: uuid,
                            title: responseObj.title,
                            description: responseObj.description,
                            allDay: true,
                            start: new Date(startDate[0], startDate[1] - 1, startDate[2]),
                            end: new Date(endDate[0], endDate[1] - 1, endDate[2]),
                            color: '#615dff',
                        }
                        let calendarObj = {
                            "uid": localStorage.getItem('uid'),
                            "data": this.calendarData
                        }
                        this.putObject(`calendar/${localStorage.getItem('uid')}`, calendarObj);

                        let putObj = {
                            id: uuid,
                            user_id: this.userInfo.email,
                            proc_inst_id: null,
                            proc_def_id: null,
                            activity_id: responseObj.title,
                            start_date: format(new Date(startDate[0], startDate[1] - 1, startDate[2]), "yyyy-MM-dd HH:mm:ss"),
                            end_date: format(new Date(endDate[0], endDate[1] - 1, endDate[2], '23', '59'), "yyyy-MM-dd HH:mm:ss"),
                            status: 'TODO',
                        }
                        await this.putObject('todolist', putObj);

                    } else {
                        if(this.prompt && this.prompt.content){
                            obj.prompt = this.prompt
                            this.prompt = null
                        }
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
            const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

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

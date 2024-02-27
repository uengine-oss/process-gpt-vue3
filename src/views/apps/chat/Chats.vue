<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                <ChatProfile />
                <ChatListing />
                <!-- <ChatListing :chatRoomList="chatRoomList" @chat-selected="chatRoomSelected" /> -->
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
        chatRoomList: [
            // {
            //     "id":1,
            //     "name":"James Johnson",
            //     "status":"online",
            //     "thumb":"/src/assets/images/profile/user-2.jpg",
            //     "recent":false,
            //     "chatHistory":[
            //         {
            //             "createdAt":"2024-02-23T06:21:22.893Z",
            //             "msg":"Vof bedvibu gegcip ricubo vidfu.",
            //             "type":"text",
            //         }
            //     ]
            // },
            // {
            //     "id":2,
            //     "name":"Maria Hernandez",
            //     "status":"online",
            //     "thumb":"/src/assets/images/profile/user-3.jpg",
            //     "recent":true,
            //     "chatHistory":[
            //         {
            //             "createdAt":"2024-02-23T06:21:22.893Z",
            //             "msg":"Vof bedvibu gegcip ricubo vidfu.",
            //             "type":"img",
            //         }
            //     ]
            // },
        ]
    }),
    async created() {
        // this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        // await this.getChatRoomList()
        await this.getChatList()
    },
    methods: {
        async getChatRoomList(){
            var me = this
            // await this.storage.watch(`db://chats/chat1`, async (data) => {
            //     if(data && data.new){
            //         if(data.new.messages.email != me.userInfo.email){
            //             me.messages.push(data.new.messages)
            //         }
            //     }
            // });
            me.userInfo = await me.storage.getUserInfo();
            await me.storage.list(`db://chat_rooms`).then(function (chatRooms) {
                if (chatRooms) {
                    chatRooms.forEach(function (chatRoom) {
                        if(chatRoom.participants.find(x => x === me.userInfo.email)){
                            chatRoom.status = "online"
                            chatRoom.thumb = "/src/assets/images/profile/user-2.jpg"
                            chatRoom.recent = false
                            me.chatRoomList.push(chatRoom)
                        }
                    })
                }
            });
        },
        chatRoomSelected(id){
            console.log(id)
        },
        putMessage(chatRoomId, msg){
            let uuid = this.uuid()
            let message = {
                "messages": msg,
                "id": chatRoomId,
                "uid": uuid,
            }
            this.putObject(`chats/${uuid}`, message);
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
                    this.putMessage("chat1", this.createMessageObj(newMessage.text, 'system'))
                } else {
                    this.putMessage("chat1", this.createMessageObj(newMessage.text))
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

        async afterGenerationFinished(response) {
            if(response == '.' || response == '.\n') {
                this.messages.splice(this.messages.length - 1, 1)
            } else {
                let obj = this.createMessageObj(response, 'system')
                if(response && response.includes("{")){
                    let responseObj = partialParse(response)
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
                            this.messages[this.messages.length - 1] = obj
                        } catch(error){
                            alert(error);
                        }
                    } else if(responseObj.work == 'ScheduleRegistration'){
                        let start = responseObj.startDateTime.split('/')
                        let startDate = start[0].split("-")
                        let startTime = start[1].split("-")
                        
                        let end = responseObj.endDateTime.split('/')
                        let endDate = end[0].split("-")
                        let endTime = end[1].split("-")
    
                        // endDateTime: "2024-02-24/15:00"
                        // location: "온라인"
                        // startDateTime: "2024-01-25/09:00"
                        // title: "온라인 강의 진행"
                        // work: "스케줄 등록"
                        // 참석자: "50명"
    
                       
                        // {
                        //     id: createEventId(),
                        //     title: 'Learn ReactJs',
                        //     start: new Date(y, m, d + 3, 10, 30),
                        //     end: new Date(y, m, d + 3, 11, 30),
                        //     allDay: true,
                        //     color: '#39b69a',
                        // },
                        // {
                        //     id: createEventId(),
                        //     title: 'Launching MaterialArt Angular',
                        //     start: new Date(y, m, d + 7, 12, 0),
                        //     end: new Date(y, m, d + 7, 14, 0),
                        //     allDay: true,
                        //     color: '#fc4b6c',
                        // },
                        // {
                        //     id: createEventId(),
                        //     title: 'Lunch with Mr.Raw',
                        //     start: new Date(y, m, d - 2),
                        //     end: new Date(y, m, d - 2),
                        //     allDay: true,
                        //     color: '#1a97f5',
                        // },
                        // {
                        //     id: createEventId(),
                        //     title: 'Going For Party of Sahs',
                        //     start: new Date(y, m, d + 1, 19, 0),
                        //     end: new Date(y, m, d + 1, 22, 30),
                        //     allDay: true,
                        //     color: '#1a97f5',
                        // },
                        
                        let option = {
                            key: "uid"
                        }
                        const res = await this.storage.getObject(`db://calendar/${localStorage.getItem('uid')}`, option);
                        let calendarData = res ? res.data:{}
                        let uuid = this.uuid()
                        if(!calendarData[`${startDate[0]}_${startDate[1]}`]){
                            calendarData[`${startDate[0]}_${startDate[1]}`] = {}
                        }
                        calendarData[`${startDate[0]}_${startDate[1]}`][uuid] = {
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
                            "data": calendarData
                        }
                        this.putObject(`calendar/${localStorage.getItem('uid')}`, calendarObj);
    
                        let todoObj = {
                            definitionId: null,
                            definitionName: null,
                            instanceId: null,
                            activityName: responseObj.title,
                            userId: this.userInfo.email,
                            status: 'Running',
                            startDate: new Date().toISOString().substr(0, 10)
                        };
    
                        this.pushObject(`todolist/${this.userInfo.email}`, todoObj);
    
                    } else {
                        if(this.prompt && this.prompt.content){
                            obj.prompt = this.prompt
                            this.prompt = null
                        }
                    }
                }
                this.putMessage("chat1", obj)
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

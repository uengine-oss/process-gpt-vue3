<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                <ChatProfile />
                <ChatListing />
                </div>
            </template>
            <template v-slot:rightpart>
                <chat
                    :messages="messages"
                    :userInfo="userInfo"
                    @sendMessage="beforeSendMessage"
                    @beforeReply="beforeReply"
                    @editSendMessage="editSendMessage"
                    @getMoreChat="getMoreChat"
                >
                </chat>
            </template>

            <template v-slot:mobileLeftContent>
                <ChatProfile />
                <ChatListing />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>

const page = ref({ title: 'Chat app' });

const breadcrumbs = ref([
    {
        text: 'Messenger',
        disabled: true,
        href: '#'
    }
]);

import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import ChatGenerator from "@/components/ai/WorkAssistantGenerator.js";
import Chat from "@/components/ui/Chat.vue";
import ChatModule from "@/components/ChatModule.vue";


export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        BaseBreadcrumb,
        AppBaseCard,
        ChatListing,
        ChatProfile
    },
    data: () => ({
        prompt: null,
        definitions: [],
        processDefinition: null,
        // processInstance: {},
        bpmn: null,
        path: "instances",
        organizationChart: [],
    }),
    async created() {
        // this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        await this.getChatList()
        // await this.loadData("organization");
        // await this.loadData("definitions");

        // var path = this.$route.href.replace("#/", "");
        // this.loadData(path);

        // this.messages = await this.loadMessages(path);
    },
    watch: {
        // "$route": {
        //     deep: true,
        //     async handler(newVal, oldVal) {
        //         if (newVal.path !== oldVal.path) {
        //             this.bpmn = null;
        //             var path = this.$route.href.replace("#/", "");
        //             this.loadData(path);

        //             this.messages = await this.loadMessages(path);
        //         }
        //     }
        // }
    },
    methods: {
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            this.saveMessages(`chats/1/messages/${this.uuid()}`, this.createMessageObj(newMessage));

            if(!this.generator.contexts) {
                let contexts = await this.queryFromVectorDB(newMessage);
                this.generator.setContexts(contexts);
            }
            
            this.prompt = {
                content: newMessage,
                requestUserEmail: this.userInfo.email,
                requestUserName: this.userInfo.name,
            }
            this.sendMessage(newMessage);

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

        afterGenerationFinished(response) {
            if(response == '.') {
                this.messages.splice(this.messages.length - 1, 1)
            } else {
                let obj = this.createMessageObj(response, 'system')
                if(this.prompt && this.prompt.content){
                    obj.prompt = this.prompt
                    this.prompt = null
                }
                this.saveMessages(`chats/1/messages/${this.uuid()}`, obj);
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
                
                this.saveMessages(path, putObj);
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

<template>
    <v-card elevation="10">
        <div :key="chatRenderKey">
            <Chat
                :messages="messages"
                :userInfo="userInfo"
                :userList="userList"
                :type="path"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @stopMessage="stopMessage"
            ></Chat>
        </div>
    </v-card>
</template>

<script>
import ChatModule from "@/components/ChatModule.vue";
import ChatGenerator from "@/components/ai/ChatAssistantGenerator.js";
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from "@/components/ui/Chat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import { VDataTable } from 'vuetify/components/VDataTable';


export default {
    mixins: [ChatModule],
    name: 'AssistantChats',
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
        path: "AssistantChats",
        userList: [],
        chatRenderKey: 0,
        messages: [],
    }),
    computed: {},
    watch: {},  
    async created() {
        this.init();
        this.messages = [];
        this.messages.push({
            role: 'system',
            content: "지시할 업무 내용을 입력하세요. 업무에 관한 정보를 주시면 업무를 받는 사람이 확인할 업무 미리보기가 좌측에 표시됩니다. 미리보기를 확인하고 부족한 부분을 개선합니다. 개선이 완료되었다면 '업무 지시하기'로 업무를 지시합니다.",
        })
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        this.userInfo = await this.storage.getUserInfo();
        await this.getUserList();

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
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
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || newMessage.image != null)) {
                newMessage.callType = 'AssistantChats'
                this.sendMessage(newMessage);
            }
        },

        afterModelCreated(response) {
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj) {
            if(responseObj){
                console.log(responseObj)
                this.messages[this.messages.length - 1].content = responseObj.content
                this.$emit("genFinished", responseObj);
            }
        },

    }
}
</script>

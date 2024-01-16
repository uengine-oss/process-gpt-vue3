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
import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';

const page = ref({ title: 'Chat app' });

const breadcrumbs = ref([
    {
        text: 'Messenger',
        disabled: true,
        href: '#'
    }
]);

import Chat from "@/components/ui/ChatUi.vue";
import ChatModule from "@/components/ChatModule.vue";


export default {
    mixins: [ChatModule],
    name: 'ChatBase',
    components: {
        Chat,
        BaseBreadcrumb,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile
    },
    data: () => ({
        // alertInfo: {
        //     title: "Chats",
        //     text: "chat"
        // },
        replyUser: null
    }),
    async created() {
        this.init();
    },
    watch: {},
    methods: {
        beforeReply(msg){
            if(msg){
                this.replyUser = msg
            } else {
                this.replyUser = null
            }
        },
        async beforeSendMessage(newMessage) {
            let obj

            var currentDate = new Date();
            var milliseconds = currentDate.getMilliseconds(); 
            var timeStamp = currentDate.toTimeString().split(' ')[0] + '.' + milliseconds.toString().padStart(3, '0');

            if(this.replyUser){
                obj = {
                    name: this.userInfo.name,
                    email: this.userInfo.email,
                    timeStamp: timeStamp,
                    role: 'user',
                    content: newMessage,
                    replyUserName: this.replyUser.name,
                    replyContent: this.replyUser.content,
                    replyUserEmail: this.replyUser.email
                }
            } else {
                obj = {
                    name: this.userInfo.name,
                    email: this.userInfo.email,
                    timeStamp: timeStamp,
                    role: 'user',
                    content: newMessage
                }
            }
            this.saveMessages(`chats/1/messages/${this.uuid()}`, obj);
        },

    }
}
</script>

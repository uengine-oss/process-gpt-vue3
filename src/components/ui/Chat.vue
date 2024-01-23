<template>
    <div class="customHeight">
        <div>
            <div class="d-flex align-center gap-3 pa-4  justify-space-between">
                <div class="d-flex gap-2 align-center">
                    <v-avatar>
                        <img :src="chatDetail.thumb" alt="pro" width="50" />
                    </v-avatar>

                    <v-badge
                        class="badg-dotDetail"
                        dot
                        :color="
                            chatDetail.status === 'away'
                                ? 'warning'
                                : chatDetail.status === 'busy'
                                ? 'error'
                                : chatDetail.status === 'online'
                                ? 'success'
                                : 'containerBg'
                        "
                    >
                    </v-badge>
                    <div>
                        <h5 class="text-h5 mb-n1">{{ name ? name : chatDetail.name }}</h5>
                        <small class="textPrimary"> {{ chatDetail.status }} </small>
                    </div>
                </div>
                <div class="d-flex">
                    <v-btn icon variant="text" class="text-medium-emphasis">
                        <PhoneIcon size="24" />
                    </v-btn>
                    <v-btn icon variant="text" class="text-medium-emphasis">
                        <VideoPlusIcon size="24" />
                    </v-btn>
                    <v-btn icon variant="text" class="text-medium-emphasis">
                        <DotsVerticalIcon size="24" />
                    </v-btn>
                </div>
            </div>
            <v-divider />
            <perfect-scrollbar class="rightpartHeight h-100">
                <v-btn v-if="filteredMessages.length > 0" style="position: absolute; left: 45%;" @click="getMoreChat()">get more chat</v-btn>
                <div class="d-flex">
                    <div class="w-100" style="height: 380px;">
                        <div v-for="(message, index) in filteredMessages" :key="index" class="pa-5">
                            <div v-if="message.email == userInfo.email" class="justify-end d-flex text-end mb-1">
                                <div>
                                    <small class="text-medium-emphasis text-subtitle-2" v-if="message.timeStamp">
                                        {{ message.timeStamp.split(':')[0] + ':' + message.timeStamp.split(':')[1] }}
                                    </small>

                                    <v-textarea v-if="editIndex === index"
                                        v-model="messages[index].content"
                                        rows="1"
                                        flat
                                        auto-grow
                                        hide-details
                                        bg-color="primary"
                                        class="message edit"
                                    >
                                        <template v-slot:append-inner>
                                            <v-btn @click="send"
                                                    icon="mdi-send"
                                                    size="x-small"
                                                    elevation="0"
                                                    class="mr-2"
                                            ></v-btn>
                                            <v-btn @click="cancel"
                                                    icon="mdi-close"
                                                    size="x-small"
                                                    elevation="0"
                                            ></v-btn>
                                        </template>
                                    </v-textarea>

                                    <v-sheet v-if="message.type == 'img'" class="mb-1">
                                        <img :src="message.content" class="rounded-md" alt="pro" width="250" />
                                    </v-sheet>

                                    <v-sheet 
                                        v-else
                                        class="bg-lightprimary rounded-md px-3 py-2 mb-1"
                                        @mouseover="hoverIndex = index"
                                        @mouseleave="hoverIndex = -1"
                                    >
                                        <pre class="text-body-1" v-if="message.replyUserName">{{ message.replyUserName }}</pre>                                                    
                                        <pre class="text-body-1" v-if="message.replyContent">{{ message.replyContent }}</pre>    
                                        <v-divider v-if="message.replyContent"></v-divider>
                                        <p class="text-body-1">{{ message.content }}</p>
                                        <v-btn v-if="hoverIndex === index"
                                            style="position: absolute; right: 21px; background-color: aliceblue;"
                                            @click="editMessage(index)"
                                            icon="mdi-pencil"
                                            size="x-small"
                                            elevation="0"
                                            class="float-right ml-2"
                                        ></v-btn>
                                    </v-sheet>
                                </div>
                            </div>

                            <div v-else class="d-flex align-items-start gap-3 mb-1">
                                <v-avatar>
                                    <img :src="chatDetail.thumb" alt="pro" width="40" />
                                </v-avatar>
                                <div>
                                    <small class="text-medium-emphasis text-subtitle-2" v-if="message.role == 'system' && message.timeStamp">
                                        System,
                                        {{ message.timeStamp.split(':')[0] + ':' + message.timeStamp.split(':')[1] }}
                                    </small>
                                    <small class="text-medium-emphasis text-subtitle-2" v-else-if="message.timeStamp">
                                        {{ message.name }},
                                        {{ message.timeStamp.split(':')[0] + ':' + message.timeStamp.split(':')[1] }}
                                    </small>
                                    
                                    <v-sheet v-if="message.type == 'img'" class="mb-1">
                                        <img :src="message.content" class="rounded-md" alt="pro" width="250" />
                                    </v-sheet>

                                    <v-sheet v-else class="bg-lightsecondary rounded-md px-3 py-2 mb-1" 
                                        @mouseover="replyIndex = index" @mouseleave="replyIndex = -1"
                                    >
                                        <pre class="text-body-1" v-if="message.replyUserName">{{ message.replyUserName }}</pre>                                                    
                                        <pre class="text-body-1" v-if="message.replyContent">{{ message.replyContent }}</pre>   
                                        <v-divider v-if="message.replyContent"></v-divider>
                                        <p class="text-body-1">{{ message.content }}</p>
                                        <p style="margin-top: 5px;" 
                                            v-if="message.role == 'system' 
                                            && message.content
                                            && message.content.includes('시작하시겠습니까') 
                                            && index == filteredMessages.length - 1
                                            && (message['prompt'] && userInfo.email == message['prompt'].requestUserEmail)"
                                        >
                                            <v-btn style="margin-right: 5px;" size="small" @click="processInstance(message['prompt'])">y</v-btn>
                                            <v-btn size="small">n</v-btn>
                                        </p>
                                        <v-btn v-if="replyIndex === index"
                                            style="position: absolute; left: 70px; background-color: aliceblue;"
                                            @click="beforeReply(message)"
                                            icon="mdi-reply"
                                            size="x-small"
                                            elevation="0"
                                            class="float-right ml-2"
                                        ></v-btn>
                                    </v-sheet>

                                    <v-progress-circular
                                        v-if="message.isLoading"
                                        indeterminate
                                        color="grey"
                                        class="ml-2 mt-2"
                                    ></v-progress-circular>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </perfect-scrollbar>
        </div>
        <v-divider />
        <div class="text-body-1" v-if="isReply" style="margin-left: 10px;">
            {{ replyUser.name }}님에게 답장
            <v-icon @click="cancelReply()">mdi-close</v-icon>
            <pre>{{ replyUser.content }}</pre>
            <v-divider />
        </div>
        <form class="d-flex align-center pa-4" @submit.prevent="send">
            <v-btn icon variant="text" class="text-medium-emphasis"><MoodSmileIcon size="24" /></v-btn>
            <v-text-field
                variant="solo"
                hide-details
                v-model="newMessage"
                color="primary"
                class="shadow-none"
                density="compact"
                placeholder="Type a Message"
            ></v-text-field>
            <v-btn icon variant="text" type="submit" class="text-medium-emphasis" :disabled="!newMessage">
                <SendIcon size="20" />
            </v-btn>

            <v-btn icon variant="text" class="text-medium-emphasis"><PhotoIcon size="20" /></v-btn>
            <v-btn icon variant="text" class="text-medium-emphasis"><PaperclipIcon size="20" /></v-btn>
        </form>
    </div>
</template>

<script>
export default {
    props: {
        name: String,
        messages: Array,
        userInfo: Object
    },
    data() {
        return {
            chatDetail: {
                name: "ChatRoom 1",
                thumb: "/src/assets/images/profile/user-2.jpg",
                status: "online",
            },
            isReply: false,
            newMessage: "",
            hoverIndex: -1,
            editIndex: -1,
            replyIndex: -1,
            replyUser: null,
        }
    },
    computed: {
        filteredMessages() {
            var list = [];
            this.messages.forEach(item => {
                const data = JSON.parse(JSON.stringify(item));
                list.push(data);
            });
            return list
        },
    },
    mounted() {
        window.addEventListener("keydown", (evt) => {
            if (evt.ctrlKey && evt.keyCode == 67) {
                let selectedObj = window.getSelection();
                if (selectedObj) {
                    let selected = selectedObj.getRangeAt(0).toString();
                }
            }
        });
    },
    methods: {
        processInstance(prompt){
            console.log(prompt.content, prompt.requestUserEmail)
        },
        getMoreChat(){
            this.$emit("getMoreChat")
        },
        cancelReply(){
            this.isReply = false
            this.replyUser = null
            this.$emit('beforeReply', false);
        },
        beforeReply(message){
            this.$emit('beforeReply', message);
            this.isReply = true
            this.replyUser = message
        },
        send() {
            if (this.editIndex >= 0) {
                this.$emit('editSendMessage', this.editIndex+1);
                this.editIndex = -1;
            } else {
                this.$emit('sendMessage', this.newMessage);
                this.newMessage = "";
            }
            if(this.isReply) this.isReply = false
        },
        cancel() {
            this.editIndex = -1;
        },
        editMessage(index) {
            if (index && index >= 0) {
                this.editIndex = index;
            } else {
                this.editIndex = -1;
            }
            this.editIndex = index;
        },
    }
}
</script>
<style lang="scss">
.rightpartHeight {
    height: 530px;
}
.badg-dotDetail {
    left: -9px;
    position: relative;
    bottom: -10px;
}

.toggleLeft {
    position: absolute;
    right: 15px;
    top: 15px;
}
.right-sidebar {
    width: 320px;
    border-left: 1px solid rgb(var(--v-theme-borderColor));
    transition: 0.1s ease-in;
    flex-shrink: 0;
}

.HideLeftPart {
    display: none;
}

@media (max-width: 960px) {
    .right-sidebar {
        position: absolute;
        right: -320px;
        &.showLeftPart {
            right: 0;
            z-index: 2;
            box-shadow: 2px 1px 20px rgba(0, 0, 0, 0.1);
        }
    }
    .boxoverlay {
        position: absolute;
        height: 100%;
        width: 100%;
        z-index: 1;
        background: rgba(0, 0, 0, 0.2);
    }
}

.shadow-none .v-field--no-label {
    --v-field-padding-top: -7px;
}
</style>
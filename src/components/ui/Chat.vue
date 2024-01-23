<template>
    <div class="customHeight">
        <div>
            <div class="d-flex align-center gap-3 pa-4  justify-space-between">
                <div class="d-flex gap-2 align-center">
                    <div v-if="alertInfo">
                        <h5 class="text-h5 mb-n1">{{ alertInfo.title }}</h5>
                        <small class="textPrimary"> {{ filteredAlert.subtitle }} </small>
                        <small class="textPrimary" v-if="isViewDetail">
                            <br />
                            {{ filteredAlert.detail }}
                        </small>
                    </div>
                    <div v-else-if="name">
                        <h5 class="text-h5 mb-n1">{{ name ? name : chatDetail.name }}</h5>
                        <small class="textPrimary"> {{ chatDetail.status }} </small>
                    </div>
                </div>
                <div class="d-flex">
                    <v-btn v-if="alertInfo" icon variant="text" class="text-medium-emphasis" @click="moreDetail">
                        <DotsVerticalIcon size="24" />
                    </v-btn>
                    <v-btn v-else icon variant="text" class="text-medium-emphasis">
                        <DeviceFloppyIcon size="24" @click="$emit('save')"/>
                    </v-btn>
                </div>
            </div>

            <v-divider />

            <perfect-scrollbar class="rightpartHeight h-100">

                <v-btn v-if="filteredMessages.length > 0" style="position: absolute; left: 45%;" @click="getMoreChat()">get more chat</v-btn>
                
                <div class="d-flex">
                    <div class="w-100" style="height: calc(100vh - 320px);">
                        <div v-for="(message, index) in filteredMessages" :key="index" class="pa-5">
                            <div v-if="message.email == userInfo.email" class="justify-end d-flex text-end mb-1">
                                <div>
                                    <small class="text-medium-emphasis text-subtitle-2" v-if="message.timeStamp">
                                        {{ message.timeStamp.split(':')[0] + ':' + message.timeStamp.split(':')[1] }}
                                    </small>

                                    <v-sheet v-if="message.type == 'img'" class="mb-1">
                                        <img :src="message.content" class="rounded-md" alt="pro" width="250" />
                                    </v-sheet>

                                    <v-textarea v-if="editIndex === index"
                                        v-model="messages[index].content"
                                        variant="solo"
                                        hide-details
                                        bg-color="lightprimary"
                                        class="shadow-none"
                                        density="compact"
                                        auto-grow
                                        rows="1"
                                    >
                                        <template v-slot:append-inner>
                                            <v-btn icon variant="text"
                                                class="text-medium-emphasis"
                                                @click="send"
                                            >
                                                <SendIcon size="20" />
                                            </v-btn>
                                            <v-btn icon variant="text"
                                                class="text-medium-emphasis" 
                                                @click="cancel">
                                                <Icon icon="solar:backspace-bold" height="20" width="20" />
                                            </v-btn>
                                        </template>
                                    </v-textarea>

                                    <div v-else class="d-flex" 
                                            @mouseover="hoverIndex = index" 
                                            @mouseleave="hoverIndex = -1"
                                    >
                                        <v-btn v-if="hoverIndex === index && !disableChat"
                                            @click="editMessage(index)"
                                            icon variant="text" size="x-small"
                                            class="bg-lightprimary float-left edit-btn"
                                        >
                                            <Icon icon="solar:pen-bold" height="20" width="20" />
                                        </v-btn>

                                        <v-sheet class="bg-lightprimary rounded-md px-3 py-2 mb-1 w-100">
                                            <pre class="text-body-1" v-if="message.replyUserName">{{ message.replyUserName }}</pre>                                                    
                                            <pre class="text-body-1" v-if="message.replyContent">{{ message.replyContent }}</pre>    
                                            <v-divider v-if="message.replyContent"></v-divider>

                                            <pre class="text-body-1">{{ message.content }}</pre>

                                            <pre v-if="message.jsonText" class="text-body-1">{{ message.jsonText}}</pre>
                                        </v-sheet>
                                    </div>
                                </div>
                            </div>

                            <div v-else class="d-flex align-items-start gap-3 mb-1 w-90">
                                <v-avatar>
                                    <Icon v-if="message.role == 'system'" icon="solar:dialog-linear" height="48" width="48" />
                                    <v-img v-else :src="userInfo.profile" :alt="userInfo.name" height="48" width="48" />
                                </v-avatar>
                                <div class="w-90">
                                    <small class="text-medium-emphasis text-subtitle-2" v-if="message.timeStamp">
                                        {{ message.role == 'system' ? 'System,' : message.name + ',' }}
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
                                        
                                        <pre class="text-body-1">{{ message.content }}</pre>

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

                                        <v-btn v-if="message.jsonText" 
                                            class="mt-2" 
                                            elevation="0" 
                                            @click="viewJSON(index)"
                                        >View JSON</v-btn>
                                        <pre v-if="isViewJSON.includes(index)" class="text-body-1">{{ message.jsonText}}</pre>

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
            <v-textarea
                variant="solo"
                hide-details
                v-model="newMessage"
                color="primary"
                class="shadow-none"
                density="compact"
                placeholder="Type a Message"
                auto-grow
                rows="1"
                :disabled="disableChat"
            >
                <!-- <template v-slot:prepend-inner>
                    <v-btn icon variant="text" class="text-medium-emphasis">
                        <MoodSmileIcon size="24" />
                    </v-btn>
                </template> -->
                <template v-slot:append-inner>
                    <v-btn icon variant="text" type="submit" 
                        class="text-medium-emphasis" 
                        :disabled="!newMessage"
                    >
                        <SendIcon size="20" />
                    </v-btn>
                    <!-- <v-btn icon variant="text" class="text-medium-emphasis">
                        <PhotoIcon size="20" />
                    </v-btn>
                    <v-btn icon variant="text" class="text-medium-emphasis">
                        <PaperclipIcon size="20" />
                    </v-btn> -->
                </template>
            </v-textarea>
        </form>
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';

export default {
    components: {
        Icon
    },
    props: {
        messages: Array,
        userInfo: Object,
        alertInfo: Object,
        disableChat: Boolean,
    },
    data() {
        return {
            isReply: false,
            newMessage: "",
            hoverIndex: -1,
            editIndex: -1,
            replyIndex: -1,
            replyUser: null,
            isViewDetail: false,
            isViewJSON: [],
        }
    },
    computed: {
        filteredAlert() {
            const textObj = {
                subtitle: "",
                detail: ""
            };
            if (this.alertInfo.text.includes("\n")) {
                const arr = this.alertInfo.text.split("\n");
                textObj.subtitle = arr[0];
                textObj.detail = arr[1];
            }
            return textObj;
        },
        filteredMessages() {
            var list = [];
            this.messages.forEach(item => {
                let data = JSON.parse(JSON.stringify(item));
                if (data.content) {
                    let regex = /^.*?`{3}(?:json|markdown)?\n(.*?)`{3}.*?$/s;
                    const match = data.content.match(regex);
                    if (match) {
                        data.content = data.content.replace(match[1], "");
                        regex = /`{3}(?:json|markdown)?\s?\n/g;
                        data.content = data.content.replace(regex, "");
                        data.content = data.content.replace(/\s?\n?`{3}?\s?\n/g, "");
                        data.content = data.content.replace(/`{3}/g, "");
                        data.jsonText = match[1];
                    } else {
                        data.jsonText = null;
                    }
                    list.push(data);
                }
            });
            return list;
        },
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
                this.$emit('sendEditedMessage', this.editIndex+1);
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
        moreDetail() {
            this.isViewDetail = !this.isViewDetail;
        },
        viewJSON(index) {
            if (!this.isViewJSON.includes(index)) {
                this.isViewJSON.push(index);
            } else {
                this.isViewJSON = this.isViewJSON.filter(idx => idx != index);
            }
        }
    }
}
</script>

<style lang="scss">
.w-90 {
    width: 90% !important;
}

.edit-btn {
    position: relative;
    left: -5px;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
}

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
// .right-sidebar {
//     width: 320px;
//     border-left: 1px solid rgb(var(--v-theme-borderColor));
//     transition: 0.1s ease-in;
//     flex-shrink: 0;
// }

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
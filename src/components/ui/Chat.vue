<template>
    <div class="customHeight" style="background-color: rgba( 255, 255, 255, 1 );">
        <div>
            <div style="position: sticky; top:0px; z-index:1;">
                <div class="d-flex align-right gap-3 pa-4 justify-space-between">
                    <div v-if="name && name !== ''" class="d-flex gap-2 align-center">
                        <div>
                            <h5 class="text-h5 mb-n1">{{ name }}</h5>
                        </div>
                    </div>
                    <div v-else-if="chatInfo" class="d-flex gap-2 align-center">
                        <v-avatar v-if="chatInfo.img">
                            <img :src="chatInfo.img" width="50" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 mb-n1">{{ $t(chatInfo.title) }}</h5>
                            <small class="textPrimary"> {{ filteredAlert.subtitle }} </small>
                            <v-card v-if="isViewDetail" class="elevation-10 pa-4" style="position:absolute; width:90%; top:60px;">
                                <small class="textPrimary" style="white-space: pre-line;">
                                    {{ filteredAlert.detail }}
                                </small>
                            </v-card>
                        </div>
                    </div>

                    <!-- 프로세스 정의 & 실행 -->
                    <div class="d-flex">
                        <v-btn v-if="type == 'instances'" icon variant="text" class="text-medium-emphasis" @click="viewProcess">
                            <Icon icon="fluent:flowchart-16-regular" :style="{ fontSize: '28px' }" />
                        </v-btn>
                        <v-btn v-if="type == 'definitions'" :disabled="!isChanged" icon variant="text" class="text-medium-emphasis">
                            <DeviceFloppyIcon size="24" @click="$emit('save')" />
                        </v-btn>
                        <v-btn v-if="chatInfo" icon variant="text" class="text-medium-emphasis" @click="moreDetail">
                            <DotsVerticalIcon size="24" />
                        </v-btn>
                    </div>
                </div>
                <v-divider/>
            </div>

            <perfect-scrollbar class="rightpartHeight h-100" ref="scrollContainer" @scroll="handleScroll">
                <!-- <v-btn v-if="type == 'chats' && filteredMessages.length > 0" style="position: absolute; left: 45%"
                    @click="getMoreChat()">get more chat</v-btn> -->

                <div class="d-flex">
                    <div class="w-100" style="height: calc(100vh - 320px)">
                        <div v-for="(message, index) in filteredMessages" :key="index" class="px-5 py-1">
                            <div v-if="message.email == userInfo.email" class="justify-end d-flex mb-1">
                                <div>
                                    <small class="text-medium-emphasis text-subtitle-2" v-if="message.timeStamp">
                                        {{ formatTime(message.timeStamp) }}
                                    </small>

                                    <v-sheet v-if="message.image" class="mb-1">
                                        <img :src="message.image" class="rounded-md" alt="pro" width="250" />
                                    </v-sheet>

                                    <v-textarea v-if="editIndex === index" v-model="messages[index].content" variant="solo"
                                        hide-details bg-color="lightprimary" class="shadow-none" density="compact" auto-grow
                                        rows="1">
                                        <template v-slot:append-inner>
                                            <v-btn icon variant="text" class="text-medium-emphasis" @click="send">
                                                <SendIcon size="20" />
                                            </v-btn>
                                            <v-btn icon variant="text" class="text-medium-emphasis" @click="cancel">
                                                <Icon icon="solar:backspace-bold" height="20" width="20" />
                                            </v-btn>
                                        </template>
                                    </v-textarea>

                                    <div v-else class="d-flex justify-end" @mouseover="hoverIndex = index"
                                        @mouseleave="hoverIndex = -1">
                                        <v-btn v-if="hoverIndex === index && !disableChat" @click="editMessage(index)" icon
                                            variant="text" size="x-small" class="bg-lightprimary float-left edit-btn">
                                            <Icon icon="solar:pen-bold" height="20" width="20" />
                                        </v-btn>

                                        <v-sheet class="bg-lightprimary rounded-md px-3 py-2 mb-1">
                                            <pre class="text-body-1"
                                                v-if="message.replyUserName">{{ message.replyUserName }}</pre>
                                            <pre class="text-body-1"
                                                v-if="message.replyContent">{{ message.replyContent }}</pre>
                                            <v-divider v-if="message.replyContent"></v-divider>

                                            <pre class="text-body-1">{{ message.content }}</pre>

                                            <pre v-if="message.jsonContent" class="text-body-1">{{ message.jsonContent }}</pre>
                                        </v-sheet>
                                    </div>
                                </div>
                            </div>

                            <div v-else class="align-items-start gap-3 mb-1 w-100">
                                <v-row class="ma-0 pa-0" style="margin-bottom:10px !important;">
                                    <v-avatar style="margin-right:10px;">
                                        <img v-if="message.role == 'system'" src="@/assets/images/chat/chat-icon.png"
                                            max-height="48" max-width="48" />
                                        <v-img v-else :src="message.profile" :alt="message.name" height="48" width="48" />
                                    </v-avatar>
                                    <div v-if="message.timeStamp" style="font-size:12px; padding-top:20px;">
                                        {{ message.role == 'system' ? 'System,' : message.name + ',' }}
                                        {{ formatTime(message.timeStamp) }}
                                    </div>
                                </v-row>

                                <div class="w-100 pb-5">
                                    <v-sheet v-if="message.type == 'img'" class="mb-1">
                                        <img :src="message.content" class="rounded-md" alt="pro" width="250" />
                                    </v-sheet>

                                    <div class="progress-border" :class="{ 'animate': borderCompletedAnimated }">
                                        <template v-if="message.role == 'system' && filteredMessages.length - 1 == index">
                                            <div class="progress-border-span" :class="{ 'opacity': !borderCompletedAnimated }" v-for="n in 5" :key="n"></div>
                                        </template>
                                        <v-sheet
                                            class="bg-lightsecondary rounded-md px-3 py-2"
                                            @mouseover="replyIndex = index"
                                            @mouseleave="replyIndex = -1"
                                        >
                                            <pre class="text-body-1"
                                                v-if="message.replyUserName"
                                            >{{ message.replyUserName }}
                                            </pre>
                                            <pre class="text-body-1"
                                                v-if="message.replyContent"
                                            >{{ message.replyContent }}
                                            </pre>
                                            <v-divider v-if="message.replyContent"></v-divider>

                                            <pre class="text-body-1">{{ setMessageForUser(message.content) }}</pre>
                                            <!-- <pre class="text-body-1">{{ message.content }}</pre> -->

                                            <p style="margin-top: 5px" v-if="message.role == 'system' &&
                                                index == filteredMessages.length - 1 &&
                                                message['prompt'] &&
                                                userInfo.email == message['prompt'].requestUserEmail
                                                ">
                                                <v-btn style="margin-right: 5px" size="small"
                                                    @click="processInstance(message)">y</v-btn>
                                                <v-btn size="small">n</v-btn>
                                            </p>
                                            <div style="position: relative;">
                                                <v-btn v-if="replyIndex === index" @click="beforeReply(message)" icon="mdi-reply"
                                                variant="text" size="x-small" style="position: absolute;right:0px; bottom:-5px; background-color:white;"></v-btn>
                                            </div>

                                            <v-row v-if="message.tableData" class="my-5">
                                                <v-col cols="12">
                                                    <v-card outlined>
                                                        <v-card-title>{{ setTableName(message.content) }}</v-card-title>
                                                        <v-card-text>
                                                            <div v-html="message.tableData" class="table-responsive"></div>
                                                        </v-card-text>
                                                    </v-card>
                                                </v-col>
                                            </v-row>   
                                            <v-row v-if="message.memento" class="my-5">
                                                <v-col cols="12">
                                                    <v-card outlined>
                                                        <v-card-title>Memento</v-card-title>
                                                        <v-card-text>
                                                            <v-textarea
                                                                hide-details
                                                                v-model="message.memento.response"
                                                                auto-grow
                                                                readonly
                                                                variant="solo-filled"
                                                            ></v-textarea>
                                                            <div class="chips-container" style="margin-top: 5px;">
                                                                <v-chip
                                                                    v-for="(source, index) in message.memento.sources"
                                                                    :key="index"
                                                                    variant="outlined"
                                                                    size="x-small"
                                                                    text-color="primary"
                                                                    style="margin-bottom: 1px;">
                                                                    <v-icon start icon="mdi-label" x-small></v-icon> {{ source.file_name }}
                                                                </v-chip>
                                                            </div>                                        
                                                        </v-card-text>
                                                    </v-card>
                                                </v-col>
                                            </v-row>   

                                            <v-btn v-if="message.jsonContent" class="mt-2" elevation="0"
                                                @click="viewJSON(index)">View JSON</v-btn>
                                            <pre v-if="isViewJSON.includes(index)"
                                                class="text-body-1">{{ message.jsonContent }}</pre>
                                        </v-sheet>
                                        <v-progress-linear
                                            v-if="message.role == 'system' && filteredMessages.length - 1 == index && isLoading"
                                            indeterminate
                                            class="my-progress-linear"
                                        ></v-progress-linear>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </perfect-scrollbar>
            <!-- <div style="width: 30%; position: absolute; bottom: 17%; right: 1%;">
                <RetrievalBox v-model:message="documentQueryStr"></RetrievalBox>
            </div> -->
        </div>
        <v-divider />
      
        <div class="text-body-1" v-if="isReply" style="margin-left: 10px">
            {{ replyUser.name }}님에게 답장
            <v-icon @click="cancelReply()">mdi-close</v-icon>
            <p>{{ replyUser.content }}</p>
            <v-divider />
        </div>

        <form class="d-flex align-center pa-0">
            <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
            <div id="imagePreview" style="max-width: 200px;"></div>
            <v-textarea
                variant="solo"
                hide-details
                v-model="newMessage"
                color="primary"
                class="shadow-none"
                density="compact"
                :placeholder="$t('chat.inputMessage')"
                auto-grow
                rows="1"
                @keydown.enter="beforeSend"
                :disabled="disableChat"
            >
                <template v-slot:prepend-inner>
                    <!-- <v-btn icon variant="text" class="text-medium-emphasis">
                        <MoodSmileIcon size="24" />
                    </v-btn> -->
                    <v-btn icon variant="text" class="text-medium-emphasis" @click="uploadImage">
                        <PhotoIcon size="20" />
                    </v-btn>
                </template>
                <template v-slot:append-inner>
                    <v-btn v-if="!isLoading" icon variant="text" type="submit" @click="beforeSend" class="text-medium-emphasis"
                        :disabled="!newMessage">
                        <SendIcon size="24" />
                    </v-btn>
                    <v-btn v-else icon variant="text" @click="isLoading = !isLoading" class="text-medium-emphasis">
                        <Icon icon="ic:outline-stop-circle" width="30" height="30" />
                    </v-btn>
                    <!-- <v-btn icon variant="text" class="text-medium-emphasis">
                        <PaperclipIcon size="20" />
                    </v-btn> -->
                </template>
            </v-textarea>
        </form>
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';
import RetrievalBox from '../retrieval/RetrievalBox.vue'

import ProgressAnimated from '@/components/ui/ProgressAnimated.vue';
import ScrollBottomHandle from '@/components/ui/ScrollBottomHandle.vue';

export default {
    components: {
        Icon,
        RetrievalBox
   },
    mixins: [
        ProgressAnimated,
        ScrollBottomHandle
    ],
    props: {
        name: String,
        messages: Array,
        userInfo: Object,
        chatInfo: Object,
        disableChat: Boolean,
        isChanged: Boolean,
        type: String,
        // documentQueryStr: String,
    },
    data() {
        return {
            isReply: false,
            newMessage: '',
            hoverIndex: -1,
            editIndex: -1,
            replyIndex: -1,
            replyUser: null,
            isViewDetail: false,
            isViewJSON: [],
            attachedImg: null,
        };
    },
    watch: {
    },
    mounted () {
    },

    beforeUnmount () {
    },

    computed: {
        filteredAlert() {
            const textObj = {
                subtitle: '',
                detail: ''
            };
            // 국제화된 문자열을 가져옵니다.
            const translatedText = this.$t(this.chatInfo.text);
            if (translatedText.includes('\n')) {
                const arr = translatedText.split('\n');
                textObj.subtitle = arr[0];
                textObj.detail = arr.slice(1).join('\n'); // 첫 번째 이후의 모든 텍스트를 detail로 결합
            }
            return textObj;
        },
        filteredMessages() {
            var list = [];
            this.messages.forEach((item) => {
                let data = JSON.parse(JSON.stringify(item));
                if (data.content || data.jsonContent) {
                    list.push(data);
                }
            });
            return list;
        },
        // isLoading 상태의 변화를 감시합니다.
        isLoading: {
            get() {
                var res = false;
                this.messages.forEach(item => {
                    if (item.isLoading) {
                        res = item.isLoading;
                    }
                });
                return res;
            },
            set(val) {
                if (!val) {
                    // isLoading이 false로 변경되면 animateBorder 메소드를 호출합니다.
                    this.animateBorder();
                    this.$emit("stopMessage");
                }
            }
        },
    },
    methods: {
        setMessageForUser(content){
            if (content.includes(`"messageForUser":`)) {
                let contentObj = JSON.parse(content)
                return contentObj.messageForUser || content;
            } else {
                return content
            }
        },
        setTableName(content){
            let contentObj = JSON.parse(content)
            return contentObj.content || content;
        },
        viewProcess() {
            this.$emit('viewProcess');
        },
        formatTime(timeStamp) {
            var date = new Date(timeStamp);
            var dateString = date.toString();
            var timeString = dateString.split(' ')[4].substring(0, 5);
            return timeString;
        },
        processInstance(messageObj) {
            this.$emit('sendMessage', JSON.parse(messageObj.content).content.replace('시작하시겠습니까 ?', '시작하겠습니다.'));
            localStorage.setItem('instancePrompt', JSON.stringify(messageObj.prompt))
            this.$router.push('/instances/chat')
        },
        getMoreChat() {
            this.$emit('getMoreChat');
        },
        cancelReply() {
            this.isReply = false;
            this.replyUser = null;
            this.$emit('beforeReply', false);
        },
        beforeReply(message) {
            this.$emit('beforeReply', message);
            this.isReply = true;
            this.replyUser = message;
        },
        beforeSend($event) {
            if ($event.shiftKey) return;
            if (this.isLoading) {
                this.isLoading = false;
            }
            var copyMsg = this.newMessage.replace(/(?:\r\n|\r|\n)/g, '');
            if (copyMsg.length > 0)
                this.send();
        },
        send() {
            if (this.editIndex >= 0) {
                this.$emit('sendEditedMessage', this.editIndex + 1);
                this.editIndex = -1;
            } else {
                this.$emit('sendMessage', {
                    image: this.attachedImg,
                    text: this.newMessage
                });
            }
            if (this.isReply) this.isReply = false;

            this.newMessage = "";
            this.newMessage = this.newMessage.replace(/(?:\r\n|\r|\n)/g, '');
            this.attachedImg = null;
            var imagePreview = document.querySelector("#imagePreview");
            imagePreview.innerHTML = '';
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
                this.isViewJSON = this.isViewJSON.filter((idx) => idx != index);
            }
        },
        uploadImage() {
            this.$refs.uploader.click();
        },
        changeImage(e) {
            const me = this;
            const imageFile = e.target.files[0];
            const reader = new FileReader();

            reader.onloadend = async () => {
                var html = `<img src=${reader.result} width='100%' />`;
                $('#imagePreview').append(html);
                me.attachedImg = reader.result;
            };

            if (imageFile) {
                reader.readAsDataURL(imageFile);
            }
        },
    }
};
</script>

<style lang="scss">
.my-progress-linear .v-progress-linear__indeterminate {
    background: linear-gradient(to right, #E1F5FE, #80DEEA, #1565C0) !important;
}
.chat-reply-icon {
    position:absolute;
    bottom:-5px;
    right:0px;
    z-index:1;
    background-color:white;
}
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

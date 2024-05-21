<template>
    <div class="customHeight" style="background-color: rgba( 255, 255, 255, 1 );">
        <Record v-if="recordingMode"
            @close="recordingModeChange()"
            @start="startRecording()"
            @stop="stopRecording()"
            :audioResponse="newMessage"
        />
        <div v-else>
            <div>
                <div>
                    <div style="position: sticky; top:0px; z-index:1; background-color:white;">
                        <div class="align-right gap-3 pa-4 justify-space-between">
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
                                </div>
                            </div>

                            <!-- slot 추가 -->
                            <slot name="custom-tools"></slot>
                        </div>
                        <v-divider style="margin:0px;" v-if="name && name !== '' || chatInfo || type == 'form'" />
                    </div>

                    <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                        <div class="d-flex w-100" style="height: calc(100vh - 307px);">
                            <v-col>
                                <v-alert v-if="filteredAlert.detail" color="#2196F3" variant="outlined">
                                    <template v-slot:title>
                                        <Icon style="margin-left:-6px;" icon="clarity:info-line" width="32" height="32" />
                                    </template>
                                    <small style="white-space: pre-line;">
                                        {{ filteredAlert.detail }}
                                    </small>
                                </v-alert>
                                
                                <div v-for="(message, index) in filteredMessages" :key="index" class="px-1 py-1">
                                    <AgentsChat v-if="message && message._template === 'agent'" :message="message"
                                        :agentInfo="agentInfo" :totalSize="filteredMessages.length" :currentIndex="index"
                                    />
                                    <div v-else>
                                        <div>
                                            <div v-if="message.email == userInfo.email && message.role != 'system'">
                                                <v-row class="ma-0 pa-0">
                                                    <v-spacer></v-spacer>
                                                    <small class="text-medium-emphasis text-subtitle-2 mr-2" v-if="message.timeStamp">
                                                        {{ formatTime(message.timeStamp) }}
                                                    </small>

                                                    <v-sheet v-if="message.image" class="mb-1">
                                                        <img :src="message.image" class="rounded-md" alt="pro" width="250" />
                                                    </v-sheet>
                                                </v-row>

                                                <div v-if="editIndex === index" class="bg-lightprimary"
                                                    style="border-radius:10px;"
                                                > 
                                                    <v-textarea v-model="messages[index].content"
                                                        variant="solo" hide-details bg-color="lightprimary" class="shadow-none"
                                                        density="compact" auto-grow rows="1"
                                                        autofocus
                                                    >
                                                    </v-textarea>
                                                    <v-row class="pa-0 ma-0 mr-2 pb-2">
                                                        <v-spacer></v-spacer>
                                                        <v-btn @click="send"
                                                            class="text-medium-emphasis"
                                                            icon variant="text" size="x-small"  
                                                            style="background-color:white !important; margin-right:5px;" 
                                                        >
                                                            <SendIcon size="20" />
                                                        </v-btn>
                                                        <v-btn @click="cancel"
                                                            class="text-medium-emphasis"
                                                            icon variant="text" size="x-small"  
                                                            style="background-color:white !important;"
                                                        >
                                                            <Icon icon="solar:backspace-bold" height="20" width="20" />
                                                        </v-btn>
                                                    </v-row>
                                                </div>

                                                <div v-else class="d-flex justify-end"
                                                    @mouseover="hoverIndex = index"
                                                    @mouseleave="hoverIndex = -1"
                                                >
                                                    <v-sheet class="bg-lightprimary rounded-md px-3 py-2 mb-1">
                                                        <pre class="text-body-1"
                                                            v-if="message.replyUserName">{{ message.replyUserName }}</pre>
                                                        <pre class="text-body-1"
                                                            v-if="message.replyContent">{{ message.replyContent }}</pre>
                                                        <v-divider v-if="message.replyContent"></v-divider>

                                                        <pre v-if="message.content" class="text-body-1" v-html="linkify(message.content)"></pre>

                                                        <pre v-if="message.jsonContent"
                                                            class="text-body-1">{{ message.jsonContent }}</pre>
                                                        <v-row class="ma-0 pa-0">
                                                            <v-spacer></v-spacer>
                                                            <v-btn v-if="hoverIndex === index && !disableChat"
                                                                @click="editMessage(index)" icon variant="text" size="x-small"
                                                                class="float-left edit-btn"
                                                                style="background-color:white;"
                                                            >
                                                                <Icon icon="solar:pen-bold" height="20" width="20" />
                                                            </v-btn>
                                                        </v-row>
                                                    </v-sheet>
                                                    <!-- <transition name="slide-fade"> -->
                                                        <div v-if="shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index)"
                                                            :key="isRender"
                                                        >
                                                        <!-- <div v-if="type == 'chats' && filteredMessages.length -1 == index && generatedWorkList.length != 0"> -->
                                                            <div @click="showGeneratedWorkList = !showGeneratedWorkList" class="find-message">
                                                            {{ generatedWorkList.length }}
                                                            </div>
                                                        </div>
                                                    <!-- </transition> -->
                                                </div>

                                                <v-card v-if="showGeneratedWorkList && shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index)" class="mt-3">
                                                    <v-btn @click="deleteAllWorkList()"
                                                        size="small" icon density="comfortable"
                                                        style="position:absolute; right:5px; top:5px; z-index:1;"
                                                    >
                                                        <Icon icon="el:trash" />
                                                    </v-btn>
                                                    <v-list>
                                                        <v-list-item-group>
                                                            <v-list-item v-for="(work, index) in generatedWorkList" :key="index" class="d-flex align-items-center">
                                                                <v-list-item-content v-if="work.messageForUser" class="flex-grow-1 d-flex align-items-center">
                                                                    <div class="w-100">
                                                                        <v-row class="ma-0 pa-3">
                                                                            <template v-if="!workIcons[work.work]">
                                                                                <img :src="defaultWorkIcon" alt="Default Icon"
                                                                                    style="width:20px; height:20px;"
                                                                                />
                                                                            </template>
                                                                            <template v-else>
                                                                                <div style="padding-top:2px;">
                                                                                    <Icon :icon="getWorkIcon(work.work)" />
                                                                                </div>
                                                                            </template>
                                                                            <div style="margin-left:5px; margin-top:0px;">{{ work.messageForUser }}</div>
                                                                            <div>
                                                                                <v-btn @click="work.expanded = !work.expanded"
                                                                                    class="ml-2"
                                                                                    size="small" icon density="comfortable"
                                                                                >
                                                                                    <Icon :icon="work.expanded ? 'iconamoon:arrow-up-2' : 'iconamoon:arrow-down-2'" width="24" height="24"/>
                                                                                </v-btn>
                                                                                <v-btn  @click="startProcess(work, index)"
                                                                                    class="ml-2"
                                                                                    size="small" icon density="comfortable"
                                                                                >
                                                                                    <Icon icon="gridicons:play" width="24" height="24" />
                                                                                </v-btn>
                                                                            </div>
                                                                        </v-row>
                                                                        <v-expand-transition>
                                                                            <div v-if="work.expanded" class="mt-2 w-100">
                                                                                <pre>{{ work }}</pre>
                                                                            </div>
                                                                        </v-expand-transition>
                                                                        <v-img
                                                                            v-if="work.work == 'CreateProcessDefinition'"
                                                                            :width="300"
                                                                            aspect-ratio="16/9"
                                                                            cover
                                                                            src="https://github.com/jhyg/project-shop-test/assets/65217813/1b551056-0428-41b6-9b90-76dd7942affc"
                                                                        ></v-img>
                                                                    </div>
                                                                </v-list-item-content>
                                                                <v-divider v-if="index < generatedWorkList.length - 1"></v-divider>
                                                            </v-list-item>
                                                        </v-list-item-group>
                                                    </v-list>
                                                </v-card>
                                            </div>
                                            <div v-else :style="shouldDisplayUserInfo(message, index) ? '' : 'margin-top: -20px;'">
                                                <div v-if="shouldDisplayUserInfo(message, index)"
                                                    class="align-items-start gap-3 mb-1 w-100"
                                                >
                                                    <v-row class="ma-0 pa-0" style="margin-bottom:10px !important;">
                                                        <v-avatar style="margin-right:10px;">
                                                            <img v-if="message.role == 'system'"
                                                                src="@/assets/images/chat/chat-icon.png" max-height="48"
                                                                max-width="48" />
                                                            <v-img v-else :src="getProfile(message.email)" :alt="message.name"
                                                                height="48" width="48" />
                                                        </v-avatar>
                                                        <div v-if="message.timeStamp" style="font-size:12px; padding-top:20px;">
                                                            {{ message.role == 'system' ? 'System,' : message.name + ',' }}
                                                            {{ formatTime(message.timeStamp) }}
                                                        </div>
                                                    </v-row>
                                                </div>

                                                <div class="w-100 pb-5">
                                                    <v-sheet v-if="message.image" class="mb-1">
                                                        <img :src="message.image" class="rounded-md" alt="pro" width="250" />
                                                    </v-sheet>

                                                    <div class="progress-border" :class="{ 'animate': borderCompletedAnimated }">
                                                        <template
                                                            v-if="message.role == 'system' && filteredMessages.length - 1 == index">
                                                            <div class="progress-border-span"
                                                                :class="{ 'opacity': !borderCompletedAnimated }" v-for="n in 5"
                                                                :key="n"></div>
                                                        </template>
                                                        <v-sheet v-if="message.content" class="bg-lightsecondary rounded-md px-3 py-2"
                                                            @mouseover="replyIndex = index" @mouseleave="replyIndex = -1">
                                                            <pre class="text-body-1" v-if="message.replyUserName">{{ message.replyUserName }}</pre>
                                                            <pre class="text-body-1" v-if="message.replyContent">{{ message.replyContent }}</pre>
                                                            <v-divider v-if="message.replyContent"></v-divider>

                                                            <pre class="text-body-1">{{ setMessageForUser(message.content) }}</pre>
                                                            <!-- <pre class="text-body-1">{{ message.content }}</pre> -->

                                                            <p style="margin-top: 5px" v-if="shouldDisplayButtons(message, index)">
                                                                <v-btn style="margin-right: 5px" size="small"
                                                                    @click="startProcess(message)">y</v-btn>
                                                                <v-btn size="small" @click="cancelProcess(message)">n</v-btn>
                                                            </p>
                                                            <v-row class="pa-0 ma-0">
                                                                <v-spacer></v-spacer>
                                                                <div v-if="replyIndex === index" >
                                                                    <v-btn @click="beforeReply(message)"
                                                                        variant="text" size="x-small" icon
                                                                        style="background-color:white; margin-right:5px;"
                                                                    >
                                                                        <Icon icon="material-symbols:reply" width="20" height="20" />
                                                                    </v-btn>
                                                                    <v-btn @click="viewJSON(index)"
                                                                        variant="text" size="x-small" icon
                                                                        style="background-color:white;"
                                                                    >
                                                                        <Icon v-if="message.jsonContent && isviewJSONStatus"
                                                                            icon="iconamoon:arrow-up-2" width="20" height="20"
                                                                        />
                                                                        <Icon v-else
                                                                            icon="iconamoon:arrow-down-2" width="20" height="20"
                                                                        />
                                                                    </v-btn>
                                                                </div>
                                                            </v-row>

                                                            <v-row v-if="message.tableData" class="my-5">
                                                                <v-col cols="12">
                                                                    <v-card outlined>
                                                                        <v-card-title>{{ setTableName(message.content)
                                                                            }}</v-card-title>
                                                                        <v-card-text>
                                                                            <div v-html="message.tableData"
                                                                                class="table-responsive">
                                                                            </div>
                                                                        </v-card-text>
                                                                    </v-card>
                                                                </v-col>
                                                            </v-row>
                                                            <v-row v-if="message.memento" class="my-5">
                                                                <v-col cols="12">
                                                                    <v-card outlined>
                                                                        <v-card-title>Memento</v-card-title>
                                                                        <v-card-text>
                                                                            <v-textarea hide-details
                                                                                v-model="message.memento.response" auto-grow
                                                                                readonly variant="solo-filled"></v-textarea>
                                                                            <div class="chips-container" style="margin-top: 5px;">
                                                                                <v-chip
                                                                                    v-for="(source, index) in message.memento.sources"
                                                                                    :key="index" variant="outlined" size="x-small"
                                                                                    text-color="primary"
                                                                                    style="margin-bottom: 1px;">
                                                                                    <v-icon start icon="mdi-label" x-small></v-icon>
                                                                                    {{source.file_name }}
                                                                                </v-chip>
                                                                            </div>
                                                                        </v-card-text>
                                                                    </v-card>
                                                                </v-col>
                                                            </v-row>
                                                            <pre v-if="isViewJSON.includes(index)"
                                                                class="text-body-1"
                                                                >{{ message.jsonContent }}
                                                            </pre>
                                                        </v-sheet>
                                                        <v-progress-linear
                                                            v-if="message.role == 'system' && filteredMessages.length - 1 == index && isLoading"
                                                            indeterminate class="my-progress-linear"></v-progress-linear>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <AgentsChat
                                        v-if="type == 'instances' && agentInfo.isRunning && filteredMessages.length == 0"
                                        class="px-5 py-1" :agentInfo="agentInfo" :totalSize="filteredMessages.length"
                                        :currentIndex="-1" />

                                </div>
                                <slot name="custom-chat"></slot>
                            </v-col>
                        </div>
                    </perfect-scrollbar>
                    <div style="position:relative">
                        <v-row class="pa-0 ma-0" style="position: absolute; bottom:0px; left:0px;">
                            <v-tooltip :text="'카메라'">
                                <template v-slot:activator="{ props }">
                                    <v-btn icon variant="text" class="text-medium-emphasis" @click="capture" v-bind="props"
                                        style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat">
                                        <Icon icon="iconoir:camera" width="20" height="20" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip :text="$t('chat.addImage')">
                                <template v-slot:activator="{ props }">
                                    <v-btn icon variant="text" class="text-medium-emphasis" @click="uploadImage" v-bind="props"
                                        style="width:30px; height:30px; margin-left:5px;" :disabled="disableChat">
                                        <Icon icon="iconoir:add-media-image" width="20" height="20" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip text="Draft Agent">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-if="(type == 'instances' || type == 'chats') && !agentInfo.isRunning"
                                        :disabled="!(newMessage || agentInfo.draftPrompt)" icon variant="text"
                                        class="text-medium-emphasis" @click="requestDraftAgent" v-bind="props"
                                        style="width:30px; height:30px; margin:1px 0px 0px 5px;">
                                        <Icon icon="fluent:document-one-page-sparkle-16-regular" width="20" height="20" />
                                    </v-btn>
                                    <v-btn v-if="(type == 'instances' || type == 'chats') && agentInfo.isRunning" icon variant="text"
                                        class="text-medium-emphasis" style="width:30px; height:30px;">
                                        <v-progress-circular :size="20" indeterminate color="primary"></v-progress-circular>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-form v-if="(type == 'instances' || type == 'chats') && !agentInfo.isRunning"
                                ref="uploadForm" @submit.prevent="submitFile"
                                style="height:30px;"
                                class="chat-selected-file"
                            >
                                <v-row class="ma-0 pa-0"
                                    :style="file && file.length > 0 ? 'margin:-13px 0px 0px 7px !important;' : ''"
                                >
                                <v-tooltip :text="$t('chat.fileUpLoad')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-if="file && file.length > 0" type="submit" 
                                            v-bind="props"
                                            icon variant="text"
                                            class="text-medium-emphasis"
                                            style="width:30px;
                                                height:30px;
                                                margin:12.5px 0px 0px 0px;"
                                        >
                                            <Icon icon="material-symbols:upload" width="24" height="24" />
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-file-input class="chat-file-up-load"
                                    :class="{'chat-file-up-load-display': file && file.length > 0}"
                                    :style="file && file.length > 0 ? '' : 'padding:5px 0px 0px 8px !important; width:30px !important; height:30px !important;'"
                                    v-model="file"
                                    label="Choose a file"
                                    prepend-icon="mdi-paperclip"
                                    outlined
                                ></v-file-input>
                                <v-tooltip v-if="type == 'chats'" :text="ProcessGPTActive ? $t('chat.isDisableProcessGPT') : $t('chat.isEnableProcessGPT')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn icon variant="text" class="text-medium-emphasis" @click="toggleProcessGPTActive" v-bind="props"
                                            style="width:30px; height:30px; margin-left:12px;" :disabled="disableChat">
                                            <img :style="ProcessGPTActive ? 'opacity:1' : 'opacity:0.5'"
                                                src="@/assets/images/chat/chat-icon.png"
                                                style="height:24px;"
                                            />
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </v-row>
                        </v-form>
                    </v-row>
                </div>
                <!-- <div style="width: 30%; position: absolute; bottom: 17%; right: 1%;">
                    <RetrievalBox v-model:message="documentQueryStr"></RetrievalBox>
                </div> -->
            </div>
            <v-divider />

        <!-- <div v-if="showNewMessageNoti"
            style="position: absolute; z-index: 9; max-width: 1000px; left: 50%; transform: translateX(-50%); bottom: 150px;">
            <v-chip color="primary" closable @click:close="showNewMessageNoti = false" style="cursor: pointer;">
                <div @click="clickToScroll">
                    <span>{{ lastMessage.name }}: {{ lastMessage.content }}</span>
                </div>
                <div style="width: 30%; position: absolute; bottom: 17%; right: 1%;">
                    <RetrievalBox v-model:message="documentQueryStr"></RetrievalBox>
                </div> -->
            </div>
            <v-divider />

            <!-- <div v-if="showNewMessageNoti"
                style="position: absolute; z-index: 9; max-width: 1000px; left: 50%; transform: translateX(-50%); bottom: 150px;">
                <v-chip color="primary" closable @click:close="showNewMessageNoti = false" style="cursor: pointer;">
                    <div @click="clickToScroll">
                        <span>{{ lastMessage.name }}: {{ lastMessage.content }}</span>
                    </div>
                </v-chip>
            </div> -->
            <div class="text-body-1" v-if="isReply" style="margin-left: 10px">
                {{ replyUser.name }}님에게 답장
                <v-icon @click="cancelReply()">mdi-close</v-icon>
                <p>{{ replyUser.content }}</p>
                <v-divider />
            </div>
            <!-- camera capture -->
            <input type="file" accept="image/*" capture="camera" ref="captureImg" class="d-none" @change="changeImage">
            <!-- image upload -->
            <input type="file" accept="image/*" ref="uploader" class="d-none" @change="changeImage">
            <div id="imagePreview" style="max-width: 200px;"></div>
            <form class="d-flex align-center pa-0">
                <v-textarea variant="solo" hide-details v-model="newMessage" color="primary"
                    class="shadow-none message-input-box cp-chat" density="compact" :placeholder="$t('chat.inputMessage')"
                    auto-grow rows="1" @keypress.enter="beforeSend" :disabled="disableChat"
                    style="font-size:20px !important;" @input="handleTextareaInput">
                    <template v-slot:prepend-inner>
                        <v-btn @click="recordingModeChange()"
                            density="comfortable"
                            icon
                        >
                            <Icon icon="ic:round-headset" width="24" height="24" />
                        </v-btn>
                    </template>
                    <template v-slot:append-inner>
                        <div style="height: -webkit-fill-available; margin-right: 10px; margin-top: 10px;">
                            <v-btn v-if="!isLoading" class="cp-send" icon variant="text" type="submit" @click="beforeSend"
                                style="width:30px; height:30px;" :disabled="disableBtn">
                                <Icon icon="teenyicons:send-outline" width="20" height="20" />
                            </v-btn>
                            <v-btn v-else icon variant="text" @click="isLoading = !isLoading"
                                style="width:30px; height:30px;">
                                <Icon icon="ic:outline-stop-circle" width="20" height="20" />
                            </v-btn>
                            <!-- <v-btn icon variant="text" class="text-medium-emphasis">
                                <PaperclipIcon size="20" />
                            </v-btn> -->
                        </div>
                    </template>
                </v-textarea>
                <div v-if="showUserList" class="user-list"
                    style="position: absolute; bottom: 16%; left: 0; background-color: white; z-index: 100;">
                    <div v-for="user in filteredUserList" :key="user.id" @click="selectUser(user)" class="user-item"
                        style="display: flex; align-items: center; padding: 10px; cursor: pointer;">
                        <img :src="user.profile" alt="profile"
                            style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                        <div>
                            <div>{{ user.username }}</div>
                            <div style="font-size: 0.8em; color: #666;">{{ user.email }}</div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';
import RetrievalBox from '../retrieval/RetrievalBox.vue'
import partialParse from "partial-json-parser";
import ProgressAnimated from '@/components/ui/ProgressAnimated.vue';
import ScrollBottomHandle from '@/components/ui/ScrollBottomHandle.vue';
import AgentsChat from './AgentsChat.vue';
import axios from 'axios';
import { HistoryIcon } from 'vue-tabler-icons';
import Record from './Record.vue';
// import Record from './Record2.vue';
import defaultWorkIcon from '@/assets/images/chat/chat-icon.png';


export default {
    components: {
        Icon,
        RetrievalBox,
        AgentsChat,
        Record
    },
    mixins: [
        ProgressAnimated,
        ScrollBottomHandle
    ],
    props: {
        prompt: String,
        name: String,
        messages: Array,
        userInfo: Object,
        chatInfo: Object,
        disableChat: Boolean,
        isChanged: Boolean,
        type: String,
        agentInfo: Object,
        userList: Array,
        currentChatRoom: Object,
        // documentQueryStr: String,
        lock: Boolean,
        generatedWorkList: Array,
        ProcessGPTActive: Boolean,
        isAgentMode: Boolean
    },
    data() {
        return {
            workIcons: {
                "ScheduleQuery" : "solar:calendar-line-duotone", // 달력 아이콘
                "ScheduleRegistration" : "solar:calendar-line-duotone", // 달력 아이콘
                "TodoListRegistration" : "pajamas:overview", // TODO 리스트 아이콘
                "StartProcessInstance" : "carbon:ibm-process-mining",
                "CreateProcessDefinition" : "tabler:device-imac-cog"
            },
            recordingMode: false,
            defaultWorkIcon: defaultWorkIcon,
            displayGeneratedWorkList: false,  // 애니메이션 후에 표시하기 위한 상태
            showGeneratedWorkList: false,
            mediaRecorder: null,
            audioChunks: [],
            isRecording: false,
            isReply: false,
            newMessage: '',
            hoverIndex: -1,
            editIndex: -1,
            editText: null,
            replyIndex: -1,
            replyUser: null,
            isViewJSON: [],
            isviewJSONStatus: false,
            attachedImg: null,
            showNewMessageNoti: false,
            lastMessage: { name: '', content: '' },
            showNewMessageNotiTimer: null,
            showUserList: false,
            mentionStartIndex: null,
            mentionedUsers: [], // Mention된 유저들의 정보를 저장할 배열
            file: null,
            isRender: false,
        };
    },
    mounted() {
        var me = this
        document.addEventListener('click', (event) => {
            if (event.target.matches('.request-file-link')) {
                event.preventDefault();
                me.$emit("requestFile", event.target.getAttribute('data-filename'));
            }
        });
    },
    watch: {
        prompt(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.newMessage = newVal
                this.beforeSend()
            }
        }
    },
    computed: {
        isSystemMentioned() {
            return this.mentionedUsers.some(user => user.id === 'system_id') || this.newMessage.startsWith('>') || this.newMessage.startsWith('!')
        },
        filteredUserList() {
            if (!this.showUserList || this.mentionStartIndex === null || !this.userList) {
                return [];
            }
            let userList = this.userList.filter(user => this.currentChatRoom.participants.some(participant => participant.id === user.id));
            userList.push({
                email: "system@uengine.org",
                id: "system_id",
                profile: "src/assets/images/chat/chat-icon.png",
                username: "System",
            })
            userList.reverse()
            const query = this.newMessage.substring(this.mentionStartIndex + 1).toLowerCase();
            // 이미 mention된 유저는 리스트에서 제외
            return userList.filter(user => user.username.toLowerCase().includes(query) && !this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id));
        },
        filteredAlert() {
            const textObj = {
                subtitle: '',
                detail: ''
            };
            // 국제화된 문자열을 가져옵니다.
            if(this.chatInfo){
                textObj.detail = this.$t(this.chatInfo.text);
            }
            return textObj;
        },
        filteredMessages() {
            var list = [];
            if (this.messages && this.messages.length > 0) {
                this.messages.forEach((item) => {
                    let data = JSON.parse(JSON.stringify(item));
                    if (data.content || data.jsonContent || data.image) {
                        list.push(data);
                        this.setRenderTime();
                    }
                });
            }
            return list;
        },
        // isLoading 상태의 변화를 감시합니다.
        isLoading: {
            get() {
                var res = false;
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach(item => {
                        if (item.isLoading) {
                            res = item.isLoading;
                        }
                    });
                }
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
        disableBtn() {
            if (this.disableChat) {
                return true
            } else {
                if (this.newMessage !== '' || this.attachedImg !== null) {
                    return false
                } else {
                    return true
                }
            }
        }
    },
    methods: {
        recordingModeChange() {
            this.recordingMode = !this.recordingMode
        },
        // 애니메이션 표시를 위해 system의 답변이 있더라도 표시 가능하게 하려고 만든 methods
        shouldDisplayGeneratedWorkList(type, filteredMessages, generatedWorkList, index) {
            let nonSystemMessageCount = 0;
            var renderVariable = 0;
            if(!this.isRender) {
                renderVariable = -1;
            }
            for (let i = 0; i <= index; i++) {
                if (filteredMessages[i].role !== 'system') {
                    nonSystemMessageCount++;
                }
            }
            const userMessagesLength = filteredMessages.filter(message => message.role === 'user').length;
            return type === 'chats' && nonSystemMessageCount - 1 === userMessagesLength + renderVariable - 1 && generatedWorkList.length !== 0;
        },
        setRenderTime() {
                this.isRender = false
            setTimeout(() => {
                this.isRender = true
            },3000)
        },
        getWorkIcon(workType) {
            return this.workIcons[workType] || this.defaultWorkIcon;
        },
        toggleProcessGPTActive() {
            this.$emit('toggleProcessGPTActive');
        },
        linkify(inputText) {
            var replacedText, replacePattern1, replacePattern2, replacePattern3;

            //URLs starting with http://, https://, or ftp://
            replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
            replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

            //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
            replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
            replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

            //Change email addresses to mailto:: links.
            replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
            replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

            return replacedText;
        },
        async startRecording() {
            this.isRecording = true;

            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = e => {
                this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start();
        },
        stopRecording() {
            this.isRecording = false;
            // MediaRecorder의 상태가 'recording'인 경우에만 stop 메서드를 호출
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.uploadAudio(audioBlob);
                };
            }
        },
        async uploadAudio(audioBlob) {
            event.preventDefault(); // 추가: 이벤트의 기본 동작 방지, form data 세팅시에 새로고침 되는 문제 해결

            const formData = new FormData();
            formData.append('audio', audioBlob);

            try {
                var url = window.$backend == '' ? 'http://localhost:8000' : window.$backend
                const response = await axios.post(`${url}/upload`, formData);
                const data = response.data;
                this.newMessage = data.transcript; 
            } catch (error) {
                console.error('Error:', error);
            }
        },
        async submitFile() {
            if (!this.file) return; // 파일이 없으면 함수 종료

            const formData = new FormData();
            formData.append('file', this.file[0]); // 'file' 키에 파일 데이터 추가

            try {
                var url = window.$memento == '' ? 'http://localhost:8005' : window.$memento
                const response = await axios.post(`${url}/uploadfile/`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                console.log(response.data); // 응답 로그 출력
                // 성공적으로 파일을 전송한 후의 로직을 여기에 작성하세요.
            } catch (error) {
                console.error(error); // 에러 로그 출력
                // 파일 전송 실패 시의 로직을 여기에 작성하세요.
            }
        },
        openVerMangerDialog() {
            this.$emit('openVerMangerDialog', true)
        },
        handleTextareaInput(event) {
            const text = event.target.value;
            const atIndex = text.lastIndexOf('@');
            if (atIndex !== -1) {
                this.showUserList = true;
                this.mentionStartIndex = atIndex;
            } else {
                this.showUserList = false;
            }
            this.mentionedUsers = this.mentionedUsers.filter(user => {
                const regex = new RegExp(`@${user.username}`, 'g');
                return text.match(regex);
            });

            if (text.startsWith('>') || text.startsWith('!')) {
                // 명령어 목록 표시 로직 추가
            } 
        },
        selectUser(user) {
            const beforeMention = this.newMessage.substring(0, this.mentionStartIndex);
            this.newMessage = `${beforeMention}@${user.username} `;
            this.showUserList = false;
            // Mention된 유저의 정보를 mentionedUsers 배열에 추가
            if (!this.mentionedUsers.some(mentionedUser => mentionedUser.id === user.id)) {
                this.mentionedUsers.push(user);
            }
        },
        clickToScroll() {
            this.isAtBottom = true
            this.scrollToBottom();
            this.showNewMessageNoti = false
            this.lastMessage = {
                name: '',
                content: ''
            }
        },
        showNewMessage() {
            if (this.messages.length > 0) {
                if (this.userInfo.email != this.messages[this.messages.length - 1].email) {
                    this.lastMessage = {
                        name: this.messages[this.messages.length - 1].name,
                        content: this.messages[this.messages.length - 1].content.length > 130 ? this.messages[this.messages.length - 1].content.substring(0, 130) + '...' : this.messages[this.messages.length - 1].content
                    };
                    this.showNewMessageNoti = true;

                    if (this.showNewMessageNotiTimer) {
                        clearTimeout(this.showNewMessageNotiTimer);
                    }

                    this.showNewMessageNotiTimer = setTimeout(() => {
                        this.showNewMessageNoti = false;
                    }, 5000);
                }
            }
        },
        getProfile(email) {
            if (!this.userList) return '';
            const user = this.userList.find(user => user.email === email);
            return user ? user.profile : '';
        },
        shouldDisplayButtons(message, index) {
            if (message.role !== 'system' || !message.systemRequest || message.requestUserEmail !== this.userInfo.email) {
                return false;
            }
            // 현재 메시지 이후로 동일한 userInfo.email을 가진 메시지가 있는지 확인
            for (let i = index + 1; i < this.filteredMessages.length; i++) {
                if (this.filteredMessages[i].email === this.userInfo.email) {
                    return false; // 동일한 email을 가진 메시지가 있다면 버튼을 표시하지 않음
                }
            }
            // 위의 조건들을 모두 통과했다면 버튼을 표시
            return true;
        },
        shouldDisplayUserInfo() {
            return (message, index) => {
                if (index === 0) return true;
                const prevMessage = this.filteredMessages[index - 1];
                if (message.email !== prevMessage.email) return true;
                const timeDiff = new Date(message.timeStamp) - new Date(prevMessage.timeStamp);
                if (timeDiff > 60000) return true;
                return false;
            };
        },
        requestDraftAgent() {
            this.$emit('requestDraftAgent', this.newMessage);
        },
        setMessageForUser(content) {
            if (content.includes(`"messageForUser":`)) {
                let contentObj = partialParse(content);
                let messageForUserContent = contentObj.messageForUser || content;
                return this.linkify(messageForUserContent); // URL을 하이퍼링크로 변환
            } else {
                return this.linkify(content); // URL을 하이퍼링크로 변환
            }
        },
        setTableName(content) {
            let contentObj = partialParse(content)
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
        startProcess(messageObj, index) {
            this.$emit('startProcess', messageObj)
            if(this.ProcessGPTActive){
                this.$emit('deleteWorkList', index)
            }
        },
        cancelProcess(messageObj) {
            this.$emit('cancelProcess', messageObj)
        },
        deleteAllWorkList() {
            this.$emit('deleteAllWorkList')
        },
        deleteWorkList(index) {
            this.$emit('deleteWorkList', index)
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
            if ($event && $event.shiftKey) return;

            if(this.isAgentMode){
                this.requestDraftAgent();
                setTimeout(() => {
                    this.newMessage = "";
                }, 100);
            } else {
                if (this.isLoading) {
                    this.isLoading = false;
                    this.$emit('stopMessage');
                }
                var copyMsg = this.newMessage.replace(/(?:\r\n|\r|\n)/g, '');
                if (copyMsg.length > 0 || this.attachedImg != null) {
                    this.send();
                }
            }
        },
        send() {
            if (this.editIndex >= 0) {
                this.$emit('sendEditedMessage', this.editIndex + 1);
                this.editIndex = -1;
            } else {
                this.$emit('sendMessage', {
                    image: this.attachedImg,
                    text: this.newMessage,
                    mentionedUsers: this.mentionedUsers
                });
            }
            if (this.isReply) this.isReply = false;
            this.attachedImg = null;
            var imagePreview = document.querySelector("#imagePreview");
            imagePreview.innerHTML = '';
            this.isAtBottom = true
            setTimeout(() => {
                this.newMessage = "";
                this.mentionedUsers = [];
                this.showUserList = false;
            }, 100);
        },
        cancel() {
            this.messages[this.editIndex].content = this.editText
            this.editIndex = -1;
        },
        editMessage(index) {
            if (index && index >= 0) {
                this.editIndex = index;
            } else {
                this.editIndex = -1;
            }
            this.editIndex = index;
            this.editText = this.messages[this.editIndex].content
        },
        viewJSON(index) {
            this.isviewJSONStatus = !this.isviewJSONStatus
            if (!this.isViewJSON.includes(index)) {
                this.isViewJSON.push(index);
            } else {
                this.isViewJSON = this.isViewJSON.filter((idx) => idx != index);
            }
        },
        uploadImage() {
            this.$refs.uploader.value = '';
            this.attachedImg = null;
            this.$refs.uploader.click();
        },
        changeImage(e) {
            const me = this;
            const imageFile = e.target.files[0];
            const reader = new FileReader();

            reader.onload = (event) => {
                const imgElement = document.createElement("img");
                imgElement.src = event.target.result;
                imgElement.onload = () => {
                    const canvas = document.createElement("canvas");
                    const max_width = 300; // 최대 너비 설정
                    const scaleSize = max_width / imgElement.width;
                    canvas.width = max_width;
                    canvas.height = imgElement.height * scaleSize;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                    const srcEncoded = ctx.canvas.toDataURL(imgElement, "image/jpeg", 0.3);

                    // 이미지 미리보기에 추가
                    var html = `<img src=${srcEncoded} width='100%' />`;
                    $('#imagePreview').append(html);
                    me.attachedImg = srcEncoded;
                };
            };

            if (imageFile) {
                reader.readAsDataURL(imageFile);
            }
        },
        capture() {
            this.$refs.captureImg.value = '';
            this.attachedImg = null;
            this.$refs.captureImg.click();
        },
    }
};
</script>

<style lang="scss">
@keyframes breathe {
  0%, 100% {
    transform: scale(0.9);
    opacity: 1;
  }
  50% {
    transform: scale(1);
    opacity: 0.85;
  }
}

.find-message {
    width: 24px;
    height: 24px;
    background-color: #1976D2;
    color: white;
    border-radius: 100%;
    animation: breathe 1.5s infinite ease-in-out;
    margin-top: 10px;
    margin-left: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    cursor: pointer;
    font-size: 12px;
}


.chat-file-up-load .v-input__control {
    display: none;
    margin-top:-20px;
}


.chat-file-up-load-display .v-input__control {
    display: block;
}

.chat-file-up-load-display .v-input__prepend {
    display: none;
}

.message-input-box .v-field__input {
    font-size: 16px;
    padding-left: 12px;
}

.message-input-box .v-field {
    padding: 0px;
}

.message-input-box .v-field__append-inner,
.v-field__prepend-inner {
    padding: 0px !important;
}

.prompt-edit-textarea textarea {
    padding: 5px !important;
}

.chat-reply-icon {
    position: absolute;
    bottom: -5px;
    right: 0px;
    z-index: 1;
    background-color: white;
}

.w-90 {
    width: 90% !important;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
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

.user-list {
    border: 1px solid #ddd;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>

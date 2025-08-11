<script setup>
import { ref, onMounted, computed, onUnmounted, watch, getCurrentInstance } from 'vue';
import { formatDistanceToNowStrict, differenceInSeconds } from 'date-fns';
import { last } from 'lodash';
import ChatBackgroundManager from '@/components/ai/ChatBackgroundManager.js';

const { proxy } = getCurrentInstance();

const props = defineProps({
    chatRoomList: Array,
    userList: Array,
    userInfo: Object,
    chatRoomId: String,
    closeDrawer: Function
});

const emit = defineEmits(['chat-selected', 'create-chat-room', 'delete-chat-room']);

const formatTimeOrNow = (createdAt) => {
    const createdAtDate = new Date(createdAt);
    const now = new Date();
    const diffInSeconds = differenceInSeconds(now, createdAtDate);

    if (diffInSeconds < 60) {
        return 'now';
    } else {
        return formatDistanceToNowStrict(createdAtDate, { addSuffix: false });
    }
};

const refreshKey = ref(Date.now());

const refreshChatList = () => {
    refreshKey.value = Date.now();
};

let intervalId;
let backgroundStatusListener;

onMounted(() => {
    intervalId = setInterval(refreshChatList, 60000);
    
    // 기존 백그라운드 작업 상태 확인
    const activeChatRooms = ChatBackgroundManager.getActiveChatRooms();
    backgroundGeneratingRooms.value = new Set(activeChatRooms);
    
    // 백그라운드 생성 상태 이벤트 리스너 등록
    backgroundStatusListener = (event) => {
        const { chatRoomId, isActive } = event.detail;
        if (isActive) {
            backgroundGeneratingRooms.value.add(chatRoomId);
        } else {
            backgroundGeneratingRooms.value.delete(chatRoomId);
        }
        // ref의 값을 업데이트하여 반응성 트리거
        backgroundGeneratingRooms.value = new Set(backgroundGeneratingRooms.value);
    };
    
    window.addEventListener('background-generation-status', backgroundStatusListener);
});

onUnmounted(() => {
    clearInterval(intervalId);
    if (backgroundStatusListener) {
        window.removeEventListener('background-generation-status', backgroundStatusListener);
    }
});

const selectedChatId = ref(null);
const backgroundGeneratingRooms = ref(new Set()); // 백그라운드 생성 중인 채팅방들

const selectChatRoom = (chat) => {
    selectedChatId.value = chat.id;
    emit('chat-selected', chat);
    if (props.closeDrawer) {
        props.closeDrawer();
    }
};

watch(() => props.chatRoomId, (newVal) => {
    if (newVal) {
        selectedChatId.value = newVal;
    }
}, { immediate: true });

const chatItem = props.chatRoomList;
const searchValue = ref('');
const filteredChats = computed(() => {
    return chatItem.filter((chat) => {
        return chat.name.toLowerCase().includes(searchValue.value.toLowerCase());
    });
});

const getChatRoomName = (chat) => {
    // 참가자가 2명인 경우
    if (chat.participants.length === 2) {
        // 상대방 찾기 (나가 아닌 참가자)
        const otherParticipant = chat.participants.find(participant => participant.email !== props.userInfo.email);
        
        if (otherParticipant) {
            // system chat인 경우
            if (otherParticipant.email === "system@uengine.org") {
                return "Assistant";
            } else {
                // 일반 사용자인 경우 상대방 이름 표시
                return otherParticipant.username || otherParticipant.email;
            }
        }
    }
    
    // 참가자가 3명 이상인 경우 설정된 채팅방 이름 사용
    if (chat.participants.length >= 3) {
        return chat.name || chat.participants.map(participant => participant.username).join(', ');
    }
    
    // 기본값 (예외 상황)
    return chat.name || chat.participants.map(participant => participant.username).join(', ');
}

const getProfile = (participant) => {
    let basePath = window.location.port == '' ? window.location.origin:'' 
    if(participant.email == "system@uengine.org"){
        return `${basePath}/images/chat-icon.png`;
    } else {
        if (participant.profile) {
            if(participant.profile.includes("defaultUser.png")){
                return `${basePath}/images/defaultUser.png`;
            } else {
                const img = new Image();
                img.src = participant.profile;
                img.onerror = () => {
                    return `${basePath}/images/defaultUser.png`;
                };
                return participant.profile;
            }
        } else {
            const user = props.userList.find(user => user.email === participant.email);
            if (user && user.profile) {
                if(user.profile.includes("defaultUser.png")){
                    return `${basePath}/images/defaultUser.png`;
                } else {
                    const img = new Image();
                    img.src = user.profile;
                    img.onerror = () => {
                        return `${basePath}/images/defaultUser.png`;
                    };
                    return user.profile;
                }
            } else {
                return `${basePath}/images/defaultUser.png`;
            }
        }
    }
};

// const items = ref([{ title: 'Sort by time' }, { title: 'Sort by Unread' }, { title: 'Mark all as read' }]);

const dialog = ref(false);
const deleteDialog = ref(false);
const inputObj = ref({
    name: '',
    participants: []
});

const editMode = ref(false);

// 이름 입력 필드에 대한 검증 규칙
const nameRules = [
    v => !!v || proxy.$t('chatListing.enterChatRoomName'),
];

// 참여자 선택 필드에 대한 검증 규칙
const participantsRules = [
    v => (v && v.length > 0) || proxy.$t('chatListing.selectAtLeastOneParticipant'),
];

const confirmDialog = () => {
    if (!inputObj.value.name || !inputObj.value.participants.length) {
        console.log('Invalid input');
        return;
    }
    emit('create-chat-room', inputObj.value);
    dialog.value = false;
    // 여기서 서버에 데이터를 보내거나 추가 처리를 할 수 있습니다.
};

const openDialog = () => {
    inputObj.value = {
        name: '',
        participants: []
    }
    editMode.value = false;
    dialog.value = true;
};
const openEditDialog = (chat) => {
    inputObj.value = { ...chat };
    editMode.value = true;
    dialog.value = true;
};

const openDeleteDialog = (chat) => {
    inputObj.value = { ...chat };
    deleteDialog.value = true;
};

const deleteChatRoom = () => {
    emit('delete-chat-room', inputObj.value.id);
    deleteDialog.value = false;
};

</script>
<template>
    <v-sheet>
        <div class="px-6 pt-3">
            <v-row class="align-center flex-fill border border-borderColor header-search rounded-pill px-5 ma-0 pa-0"
                style="min-width:100%;"
            >
                <Icons :icon="'magnifer-linear'" :size="22" />
                <v-text-field v-model="searchValue" variant="plain" density="compact"
                    class="position-relative pt-0 ml-3 custom-placeholer-color" :placeholder="$t('chatListing.search')"
                    single-line hide-details
                ></v-text-field>
            </v-row>
        </div>
    </v-sheet>
    <!-- <v-sheet>
        <div class="px-6 pt-3">
            <div class="d-flex">
                <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                    <v-text-field v-model="searchValue" variant="plain" density="compact"
                        class="position-relative pt-0 ml-3 custom-placeholer-color" :placeholder="$t('chatListing.search')"
                        single-line hide-details
                    ></v-text-field>
                </div>
                <v-btn @click="openDialog"
                    density="comfortable" 
                    icon
                    class="ml-auto"
                >
                    <v-icon>mdi-chat-plus</v-icon>
                </v-btn>
            </div>
            <v-menu>
                <template v-slot:activator="{ props }">
                    <v-btn color="white" variant="flat" class="mt-4 text-medium-emphasis" v-bind="props"
                        >Recent Chats <ChevronDownIcon size="18" class="ml-2" />
                    </v-btn>
                </template>
<v-list class="elevation-10">
    <v-list-item v-for="(item, index) in items" :key="index" :value="index">
        <v-list-item-title>{{ item.title }}</v-list-item-title>
    </v-list-item>
</v-list>
</v-menu> 
        </div>
    </v-sheet> -->
    <v-dialog v-model="dialog" persistent max-width="600px">
        <v-card class="ma-0 pa-4">
            <v-row class="ma-0 pa-0">
                <v-card-title class="pa-0">
                    {{ $t('chatListing.title') }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="dialog = false" icon variant="text" density="comfortable"
                    style="margin-top:-8px;"
                >
                    <Icons :icon="'close'" :size="16" />
                </v-btn>
            </v-row>
            <v-card-text class="ma-0 pa-0 pb-2 pt-4">
                <v-text-field :label="$t('chatListing.chatRoomName')" v-model="inputObj.name" :rules="nameRules"></v-text-field>
                <v-autocomplete v-model="inputObj.participants" :items="userList" chips closable-chips
                    color="blue-grey-lighten-2" item-title="username" :item-value="item => item" multiple :label="$t('chatListing.selectParticipants')"
                    small-chips :item-avatar="'image'" :rules="participantsRules">
                    <template v-slot:chip="{ props, item }">
                        <v-chip v-if="item.raw.profile" v-bind="props" :prepend-avatar="item.raw.profile" :text="item.raw.username ? item.raw.username:item.raw.email"></v-chip>
                        <v-chip v-else-if="item.raw.id == 'system_id'" v-bind="props" prepend-avatar="/src/assets/images/chat/chat-icon.png" text="System"></v-chip>
                        <v-chip v-else v-bind="props" prepend-icon="mdi-account-circle" :text="item.raw.username ? item.raw.username:item.raw.email"></v-chip>
                    </template>

                    <template v-slot:item="{ props, item }">
                        <v-list-item v-if="item.raw.profile" v-bind="props" :prepend-avatar="item.raw.profile" :title="item.raw.username ? item.raw.username:item.raw.email"
                            :subtitle="item.raw.email"></v-list-item>
                        <v-list-item v-else-if="item.raw.id == 'system_id'" v-bind="props" prepend-avatar="/src/assets/images/chat/chat-icon.png" title="System"></v-list-item>
                        <v-list-item v-else v-bind="props" :title="item.raw.username ? item.raw.username:item.raw.email"
                            :subtitle="item.raw.email">
                            <template v-slot:prepend>
                                <v-icon style="position: relative; margin-right: 10px; margin-left: -3px;" size="48">mdi-account-circle</v-icon>
                            </template>
                        </v-list-item>
                    </template>
                </v-autocomplete>
            </v-card-text>
            <v-row class="ma-0 pa-0">
                <v-spacer></v-spacer>
                <v-btn color="primary" class="ma-0 pa-0" rounded @click="confirmDialog">{{ editMode ? $t('chatListing.save') : $t('chatListing.create') }}</v-btn>
            </v-row>
        </v-card>
    </v-dialog>
    <v-dialog v-model="deleteDialog" persistent max-width="600px">
        <v-card class="pa-4">
            <v-row class="ma-0 pa-0">
                <v-card-title class="ma-0 pa-0">
                    {{ $t('chatListing.deleteChatRoom') }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="deleteDialog = false"
                    icon variant="text" density="comfortable"
                    size="24"
                >
                    <Icons :icon="'close'" :size="16"/>
                </v-btn>
            </v-row>
            <v-card-text class="ma-0 pa-0 pt-4 pb-4">
                "{{ inputObj.name }}" {{ $t('chatListing.confirmDeleteChatRoom') }}
            </v-card-text>
            <v-row class="ma-0 pa-0">
                <v-spacer></v-spacer>
                <v-btn color="primary" rounded @click="deleteChatRoom">{{ $t('chatListing.delete') }}</v-btn>
            </v-row>
        </v-card>
    </v-dialog>
    <perfect-scrollbar>
        <v-list class="chat-listing-lgScroll">
            <!---Single Item-->
            <v-list-item 
                :value="chat.id" 
                color="primary" class="text-no-wrap chatItem" 
                v-for="chat in filteredChats"
                :key="chat.id" lines="two" @click="selectChatRoom(chat)"
                :class="{ 'selected-chat': chat.id === selectedChatId }"
            >
                <!---Avatar-->
                <template v-slot:prepend>
                    <v-avatar color="#f0f5f9" size="large"
                        style="width: 50px; height: 50px; display: flex; flex-wrap: wrap;">
                        <template v-if="chat.participants.length">
                            <template
                                v-if="chat.participants.filter(participant => participant.email !== userInfo.email).length === 1">
                                <!-- 참가자가 나 이외 한 명만 있는 경우 -->
                                <img :src="getProfile(chat.participants.find(participant => participant.email !== userInfo.email))"
                                    :alt="chat.participants.find(participant => participant.email !== userInfo.email).username"
                                    style="width: 100%; height: 100%; object-fit: cover;" />
                            </template>
                            <template v-else>
                                <!-- 참가자가 여러 명이며 본인을 제외한 경우 -->
                                <div v-for="(participant, index) in chat.participants.filter(participant => participant.email !== userInfo.email).slice(0, 4)"
                                    :key="participant.id" style="width: 50%; height: 50%; position: relative;">
                                    <img :src="getProfile(participant)" :alt="participant.username"
                                        style="width: 100%; height: 100%; object-fit: cover;" />
                                </div>
                            </template>
                        </template>
                        <template v-else>
                            <v-icon icon="mdi-account-multiple" size="large"></v-icon>
                        </template>
                    </v-avatar>
                </template>
                <!---Name-->
                <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">{{ getChatRoomName(chat) }}</v-list-item-title>
                <!---Subtitle-->
                <v-sheet v-if="chat.message.type == 'img'">
                    <small class="textPrimary text-subtitle-2">Sent a Photo</small>
                </v-sheet>
                <div v-else class="text-subtitle-2 textPrimary mt-1 text-truncate w-100"
                    :class="{ 'font-weight-bold': chat.participants.find(participant => participant.email == userInfo.email).isExistUnReadMessage }">
                    <span v-if="backgroundGeneratingRooms.has(chat.id)" class="generating-status">
                        <v-icon size="small" class="mr-1">mdi-dots-horizontal</v-icon>
                    </span>
                    <span v-else>{{ chat.message.msg }}</span>
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div :key="refreshKey">
                        <small class="textPrimary text-subtitle-2">
                            {{ formatTimeOrNow(chat.message.createdAt) }}
                            <v-badge
                                v-if="chat.participants.find(participant => participant.email == userInfo.email).isExistUnReadMessage"
                                style="position: relative; top: 1.5px;" dot inline color="info">
                            </v-badge>
                            <v-menu location="end">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" size="x-small" icon>
                                        <v-icon>mdi-dots-vertical</v-icon>
                                    </v-btn>
                                </template>
                                <v-list style="width: 70px; text-align-last: center;">
                                    <v-list-item @click="openEditDialog(chat)">
                                        <v-list-item-title>{{ $t('chatListing.setting') }}</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item @click="openDeleteDialog(chat)">
                                        <v-list-item-title style="color: red;">{{ $t('chatListing.delete') }}</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </small>
                    </div>
                </template>
            </v-list-item>
        </v-list>
    </perfect-scrollbar>
</template>
<style>
.chatItem {
    padding: 16px 24px !important;
    border-bottom: 1px solid rgb(var(--v-theme-inputBorder), 0.1);
}

.font-weight-bold {
    font-weight: bold;
}

.chat-listing-lgScroll {
    height: calc(100vh - 240px);
    overflow: auto !important;
}

.selected-chat {
    background-color: aliceblue;
}
@media only screen and (max-width: 1279px) {
    .chat-listing-lgScroll {
        height: calc(100vh - 220px);
    }
}

@media only screen and (max-width: 768px) {
    .chat-listing-lgScroll {
        height: calc(100vh - 165px);
    }
}

.generating-status {
    color: rgb(var(--v-theme-primary)) !important;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
}

.generating-status .v-icon {
    animation: blink 1.5s infinite;
}

</style>

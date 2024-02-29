<script setup>
import { ref, onMounted, computed } from 'vue';
import { formatDistanceToNowStrict } from 'date-fns';
import { last } from 'lodash';

const props = defineProps({
  chatRoomList: Array,
  userList: Array
});

const emit = defineEmits(['chat-selected', 'create-chat-room']);

onMounted(() => {

});


const selectChatRoom = (chat) => {
    emit('chat-selected', chat);
};

const chatItem = props.chatRoomList;
const searchValue = ref('');
const filteredChats = computed(() => {
    return chatItem.filter((chat) => {
        return chat.name.toLowerCase().includes(searchValue.value.toLowerCase());
    });
});

const items = ref([{ title: 'Sort by time' }, { title: 'Sort by Unread' }, { title: 'Mark all as read' }]);

const dialog = ref(false);
const inputObj = ref({
    name: '',
    participants: []
});

const editMode = ref(false);

// 이름 입력 필드에 대한 검증 규칙
const nameRules = [
  v => !!v || '채팅방 이름을 입력해주세요.',
];

// 참여자 선택 필드에 대한 검증 규칙
const participantsRules = [
  v => (v && v.length > 0) || '참여자를 하나 이상 선택해주세요.',
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

const openEditDialog = (chat) => {
    inputObj.value = { ...chat };
    editMode.value = true;
    dialog.value = true;
};

</script>
<template>
    <v-sheet>
        <div class="px-6 pt-3">
            <div class="d-flex">
                <v-text-field
                    variant="outlined"
                    v-model="searchValue"
                    append-inner-icon="mdi-magnify"
                    placeholder="Search Contact"
                    hide-details
                    density="compact"
                ></v-text-field>
                <v-btn icon @click="dialog = true" style="margin-left: 10px;">
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
    </v-sheet>
    <v-dialog v-model="dialog" persistent max-width="600px">
      <v-card>
        <v-card-title>
            채팅방 설정
        </v-card-title>
        <v-card-text>
          <v-text-field label="채팅방 이름" v-model="inputObj.name" :rules="nameRules"></v-text-field>
          <v-autocomplete
                v-model="inputObj.participants"
                :items="userList"
                chips
                closable-chips
                color="blue-grey-lighten-2"
                item-title="username"
                item-value="email"
                multiple
                label="참여자 선택"
                small-chips
                :item-avatar="'image'"
                :rules="participantsRules"
            >
              <template v-slot:chip="{ props, item }">
                <v-chip
                  v-bind="props"
                  :prepend-avatar="item.raw.profile"
                  :text="item.raw.username"
                ></v-chip>
              </template>

              <template v-slot:item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :prepend-avatar="item.raw.profile"
                  :title="item.raw.username"
                  :subtitle="item.raw.email"
                ></v-list-item>
              </template>
            </v-autocomplete>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="dialog = false">취소</v-btn>
          <v-btn color="blue darken-1" text @click="confirmDialog">{{ editMode ? '수정' : '생성' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <perfect-scrollbar class="lgScroll h-100">
        <v-list>
            <!---Single Item-->
            <v-list-item
                :value="chat.id"
                color="secondary"
                class="text-no-wrap chatItem"
                v-for="chat in filteredChats"
                :key="chat.id"
                lines="two"
                @click="selectChatRoom(chat)"
            >
                <!---Avatar-->
                <template v-slot:prepend>
                    <v-avatar color="#f0f5f9">
                        <!-- <img :src="chat.thumb" alt="pro" width="50" /> -->
                        <v-icon
                            icon="mdi-account-multiple"
                            size="large"
                        ></v-icon>
                    </v-avatar>
                    <v-badge
                        class="badg-dot"
                        dot
                        :color="
                            chat.status === 'away'
                                ? 'warning'
                                : chat.status === 'busy'
                                ? 'error'
                                : chat.status === 'online'
                                ? 'success'
                                : 'containerBg'
                        "
                    >
                    </v-badge>
                </template>
                <!---Name-->
                <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">{{ chat.name }}</v-list-item-title>
                <!---Subtitle-->
                <v-sheet v-if="chat.message.type == 'img'">
                    <small class="textPrimary text-subtitle-2">Sent a Photo</small>
                </v-sheet>
                <div class="text-subtitle-2 textPrimary mt-1 text-truncate w-100" v-else>
                    {{ chat.message.msg }}
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div class="d-flex flex-column text-right w-25" style="margin-right: -40px;">
                        <small class="textPrimary text-subtitle-2">
                            {{
                                formatDistanceToNowStrict(new Date(chat.message.createdAt), {
                                    addSuffix: false
                                })
                            }}
                            <v-btn style="margin-left: 5px; margin-right: -5px;" icon @click="openEditDialog(chat)">
                                <v-icon>mdi-dots-vertical</v-icon>
                            </v-btn>
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
.badg-dot {
    left: -17px;
    position: relative;
    bottom: -10px;
}
.lgScroll {
    height: 500px;
}
</style>

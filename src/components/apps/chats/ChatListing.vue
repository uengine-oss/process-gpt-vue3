<script setup>
import { ref, onMounted, computed } from 'vue';
import { formatDistanceToNowStrict } from 'date-fns';
import { last } from 'lodash';

const props = defineProps({
  chatRoomList: Array
});

const emit = defineEmits(['chat-selected']);

onMounted(() => {

});


const selectChat = (chatId) => {
    emit('chat-selected', chatId);
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
const srcs = {
    1: 'https://cdn.vuetifyjs.com/images/lists/1.jpg',
    2: 'https://cdn.vuetifyjs.com/images/lists/2.jpg',
    3: 'https://cdn.vuetifyjs.com/images/lists/3.jpg',
    4: 'https://cdn.vuetifyjs.com/images/lists/4.jpg',
    5: 'https://cdn.vuetifyjs.com/images/lists/5.jpg',
}

const users = [
    { name: 'Sandra Adams', email: 'test1.gmail.com', avatar: srcs[1] },
    { name: 'Ali Connors', email: 'test2.gmail.com', avatar: srcs[2] },
    { name: 'Trevor Hansen', email: 'test3.gmail.com', avatar: srcs[3] },
    { name: 'Tucker Smith', email: 'test4.gmail.com', avatar: srcs[2] },
    { name: 'Britta Holt', email: 'test5.gmail.com', avatar: srcs[4] },
    { name: 'Jane Smith ', email: 'test6.gmail.com', avatar: srcs[5] },
    { name: 'John Smith', email: 'test7.gmail.com', avatar: srcs[1] },
    { name: 'Sandra Williams', email: 'test8.gmail.com', avatar: srcs[3] },
]

const confirmDialog = () => {
  console.log(inputObj.value);
  dialog.value = false;
  // 여기서 서버에 데이터를 보내거나 추가 처리를 할 수 있습니다.
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
          새 채팅방 생성
        </v-card-title>
        <v-card-text>
          <v-text-field label="채팅방 이름" v-model="inputObj.name"></v-text-field>
          <v-autocomplete
                v-model="inputObj.participants"
                :items="users"
                chips
                closable-chips
                color="blue-grey-lighten-2"
                item-title="name"
                item-value="email"
                multiple
                label="참여자 선택"
                small-chips
                :item-avatar="'image'"
            >
              <template v-slot:chip="{ props, item }">
                <v-chip
                  v-bind="props"
                  :prepend-avatar="item.raw.avatar"
                  :text="item.raw.name"
                ></v-chip>
              </template>

              <template v-slot:item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :prepend-avatar="item.raw.avatar"
                  :title="item.raw.name"
                  :subtitle="item.raw.email"
                ></v-list-item>
              </template>
            </v-autocomplete>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="dialog = false">취소</v-btn>
          <v-btn color="blue darken-1" text @click="confirmDialog">확인</v-btn>
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
                @click="selectChat(chat.id)"
            >
                <!---Avatar-->
                <template v-slot:prepend>
                    <v-avatar>
                        <img :src="chat.thumb" alt="pro" width="50" />
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
                <v-sheet v-if="chat.lastMessage.type == 'img'">
                    <small class="textPrimary text-subtitle-2">Sent a Photo</small>
                </v-sheet>
                <div class="text-subtitle-2 textPrimary mt-1 text-truncate w-100" v-else>
                    {{ chat.lastMessage.msg }}
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div class="d-flex flex-column text-right w-25">
                        <small class="textPrimary text-subtitle-2">
                            {{
                                formatDistanceToNowStrict(new Date(chat.lastMessage.createdAt), {
                                    addSuffix: false
                                })
                            }}
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

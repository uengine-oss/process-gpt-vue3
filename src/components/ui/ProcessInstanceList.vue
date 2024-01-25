<template>
    <v-sheet>
        <div class="px-6 pt-3">
            <v-text-field
                variant="outlined"
                v-model="searchValue"
                append-inner-icon="mdi-magnify"
                placeholder="Search Contact"
                hide-details
                density="compact"
            ></v-text-field>

            <div class="d-flex">
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-btn color="white" variant="flat" class="mt-4 text-medium-emphasis" v-bind="props">
                            Recent Chats 
                            <ChevronDownIcon size="18" class="ml-2" />
                        </v-btn>
                    </template>
                    <v-list class="elevation-10">
                        <v-list-item v-for="(item, index) in menuItems" :key="index" :value="index">
                            <v-list-item-title>{{ item.title }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>

                <v-btn color="primary" variant="flat" class="mt-4 ml-auto text-medium-emphasis" @click="newInstanceChat">
                    New Chat
                </v-btn>
            </div>
        </div>
    </v-sheet>

    <perfect-scrollbar class="lgScroll h-100">
        <v-list>
            <!---Single Item-->
            <v-list-item
                v-for="item in instanceList"
                :key="item.instanceId"
                :value="item.instanceId"
                color="secondary"
                class="text-no-wrap chatItem"
                lines="two"
                :active="currentChatId === item.instanceId"
                @click="selectChat(item.instanceId)"
            >
                <!-- Participants User  -->
                <!-- <template v-slot:prepend>
                    <v-avatar size="32">
                        <v-img src="" width="32" height="32" />
                    </v-avatar>
                </template> -->
                <!---Name-->
                <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">
                    <!-- {{ item.currentUserId }} -->
                    {{ item.instanceName }}
                </v-list-item-title>
                <!---Subtitle-->
                <div class="text-subtitle-2 textPrimary mt-1 text-truncate w-100">
                    {{ item.currentActivityName }}
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div class="d-flex flex-column text-right w-25">
                        <small class="textPrimary text-subtitle-2">
                            {{ item.timeStamp }}
                        </small>
                    </div>
                </template>
            </v-list-item>
        </v-list>
    </perfect-scrollbar>
</template>

<script>

import { getGlobalContext } from '@/stores/auth';

const globalContext = getGlobalContext();

export default {
    data: () => ({
        path: "instances",
        instanceList: [],
        searchValue: "",
        currentChatId: "",
        menuItems: [
            { title: 'Sort by Time' }, 
            { title: 'Sort by Completed' }
        ],
        userInfo: null,
    }),
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    await this.init();
                }
            }
        },
    },
    async created() {
        this.userInfo = globalContext.storage.userInfo;
        await this.init();
    },
    methods: {
        async init(path) {
            if (this.$route.params && this.$route.params.id) {
                this.currentChatId = this.$route.params.id;
            }

            const callPath = path ? path : this.path;
            await globalContext.storage.watch(`db://${callPath}`, (callback) => {
                this.instanceList = [];
                if (callback) {
                    const keys = Object.keys(callback);
                    keys.forEach(async key => {
                        const item = callback[key];
                        if (item && item.participants) {
                            if (item.participants.includes(this.userInfo.email)) {
                                item.instanceId = key;
                                this.instanceList.push(item);
                            }
                        }
                    });
                }
            });
        },
        selectChat(id) {
            this.currentChatId = id;
            this.$emit('selectedChatId', id);
            this.$router.push(`/${this.path}/${id}`);
        },
        newInstanceChat() {
            this.currentChatId = "";
            this.$router.push(`/${this.path}/chat`);
        },
    }
};
</script>

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
    height: 500px !important;
}
</style>

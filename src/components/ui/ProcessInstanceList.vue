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
        </div>
    </v-sheet>
    <perfect-scrollbar class="lgScroll h-100">
        <v-list>
            <!---Single Item-->
            <v-list-item
                v-for="item in instanceChats"
                :key="item.instanceId"
                :value="item.instanceId"
                color="secondary"
                class="text-no-wrap chatItem"
                lines="two"
                :active="currentChatId === item.instanceId"
                @click="select(item.instanceId)"
            >
                <!---Avatar-->
                <!-- <template v-slot:prepend>
                    <v-avatar>
                        <img :src="chat.thumb" alt="pro" width="50" />
                    </v-avatar>
                    <v-badge
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
                </template> -->
                <!---Name-->
                <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">
                    {{ item.currentUserId }}
                </v-list-item-title>
                <!---Subtitle-->
                <div class="text-subtitle-2 textPrimary mt-1 text-truncate w-100">
                    {{ item.currentActivityId }}
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div class="d-flex flex-column text-right w-25">
                        <!-- <small class="textPrimary text-subtitle-2">
                            {{
                                formatDistanceToNowStrict(new Date(lastActivity(chat)), {
                                    addSuffix: false
                                })
                            }}
                        </small> -->
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
        path: 'instances',
        instanceChats: [],
        currentChatId: '',
        searchValue: '',
        menuItems: [{ title: 'Sort by Time' }, { title: 'Sort by Completed' }]
    }),
    async created() {
        await this.init();
    },
    methods: {
        async init(path) {
            const callPath = path ? path : this.path;
            await globalContext.storage.watch(`db://${callPath}`, (callback) => {
                if (callback) {
                    const keys = Object.keys(callback);
                    this.instanceChats = [];
                    keys.forEach((key) => {
                        const item = callback[key];
                        item.instanceId = key;
                        this.instanceChats.push(item);
                    });
                }
            });
        },
        select(id) {
            this.currentChatId = id;
            this.$emit('selectedChatId', id);
        }
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

<template>
    <v-sheet>
        <div class="px-6 pt-3">
            <v-text-field
                variant="outlined"
                v-model="searchValue"
                append-inner-icon="mdi-magnify"
                :placeholder="$t('processExecution.search')"
                hide-details
                density="compact"
            ></v-text-field>

            <div class="d-flex">
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-btn color="white" variant="flat" class="mt-4 text-medium-emphasis" v-bind="props">
                            {{ $t('processExecution.recentChats') }}
                            <ChevronDownIcon size="18" class="ml-2" />
                        </v-btn>
                    </template>
                    <v-list class="elevation-10">
                        <v-list-item v-for="(item, index) in menuItems" :key="index" :value="index">
                            <v-list-item-title>{{ $t(item.title) }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>

                <v-btn color="primary" variant="flat" class="mt-4 ml-auto text-medium-emphasis" @click="newInstanceChat">
                    {{ $t('processExecution.newChat') }}
                </v-btn>
            </div>
        </div>
    </v-sheet>

    <perfect-scrollbar class="lgScroll h-100">
        <v-list>
            <!---Single Item-->
            <v-list-item
                v-for="item in instanceList"
                :key="item.proc_inst_id"
                :value="item.proc_inst_id"
                color="secondary"
                class="text-no-wrap chatItem"
                lines="two"
                :active="currentChatId === item.proc_inst_id"
                @click="selectChat(item.proc_inst_id)"
            >
                <!---Name-->
                <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">
                    {{ item.proc_inst_name }}
                </v-list-item-title>
                <!---Subtitle-->
                <div class="text-subtitle-2 textPrimary mt-1 text-truncate w-100">
                    {{
                        item.current_activity_ids.length > 0 ? 
                            item.current_activity_ids : '다음 액티비티가 없습니다.'
                    }}
                </div>
                <!---Last seen--->
                <template v-slot:append>
                    <div class="d-flex flex-column text-right w-25">
                        <DotsVerticalIcon size="15" />
                        <v-menu activator="parent">
                            <v-list density="compact">
                                <v-list-item value="Delete">
                                    <v-list-item-title @click="deleteInstance(item.proc_inst_id)">
                                        Delete
                                    </v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </div>
                </template>
            </v-list-item>
        </v-list>
    </perfect-scrollbar>
</template>

<script>
import StorageBase from '@/utils/StorageBase';

export default {
    data: () => ({
        path: "instances",
        instanceList: [],
        searchValue: "",
        currentChatId: "",
        menuItems: [
            { title: 'processExecution.sortByTime' },
            { title: 'processExecution.sortByCompleted' }
        ],
        email: "",
        storage: null,
    }),
    watch: {
        "$route": {
            deep: true,
            async handler(newVal) {
                if (!newVal.query.id) {
                    this.currentChatId = "";
                }
            }
        },
    },
    async created() {
        this.storage = StorageBase.getStorage("supabase");
        this.email = localStorage.getItem("email")
        await this.init();
    },
    methods: {
        async init() {
            if (this.$route.query && this.$route.query.id) {
                const id = this.$route.query.id;
                this.currentChatId = id;
            }

            var me = this;
            var list = await this.storage.list(`${this.path}`);
            // var list = await this.storage.list(`${this.path}/${this.email}`, {key: 'user_id'});
            if (list && list.length > 0) {
                me.instanceList = [];
                list.forEach(async item => {
                    if (item.user_ids.includes(this.email)) {
                        var def_id = item.id.split('.')[0];
                        var inst = await this.storage.getObject(`${def_id}/${item.id}`, {key: 'proc_inst_id'});
                        if (inst) {
                            me.instanceList.push(inst);
                        }
                    }
                })
            }

            await this.storage.watch(`${this.path}`)
        },
        selectChat(id) {
            this.currentChatId = id;
            this.$router.push(`/${this.path}/chat?id=${id}`);
        },
        newInstanceChat() {
            this.currentChatId = "";
            this.$router.push(`/${this.path}/chat`);
        },
        async deleteInstance(id) {
            // TODO delete 트리거 처리 
            var def_id = id.split('.')[0];
            await this.storage.delete(`${def_id}/${id}`, {key: 'proc_inst_id'});
            await this.storage.delete(`${this.path}/${id}`, {key: "id"});

            await this.init();

            if (this.currentChatId == id) {
                this.newInstanceChat();
            }            
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

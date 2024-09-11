<template>
    <v-sheet>
        <div class="px-6 pt-3">
            <div class="d-flex">
                <v-text-field variant="outlined" v-model="searchValue" append-inner-icon="mdi-magnify"
                    placeholder="Search User" hide-details density="compact"></v-text-field>
            </div>
        </div>
    </v-sheet>
    <perfect-scrollbar class="lgScroll">
        <v-list>
            <v-list-item v-for="user in filteredUsers" :key="user.id" class="text-no-wrap userItem" @click="selectedUser(user)">
                <template v-slot:prepend>
                    <v-avatar color="#f0f5f9" size="large" style="width: 50px; height: 50px;">
                        <img :src="getProfile(user.email)" :alt="user.username" style="width: 100%; height: 100%; object-fit: cover;" />
                    </v-avatar>
                </template>
                <v-list-item-content>
                    <v-list-item-title class="text-subtitle-1 textPrimary w-100 font-weight-semibold">{{ user.username }}</v-list-item-title>
                    <v-list-item-subtitle class="text-subtitle-2 textPrimary">{{ user.email }}</v-list-item-subtitle>
                    <div v-if="selectedUserInfo && selectedUserInfo.id === user.id">
                        <v-tooltip location="bottom" text="1:1 chat">
                            <template v-slot:activator="{ props }">
                                <v-btn @click="startChat('chat')" icon v-bind="props">
                                    <v-icon>mdi-message-text-outline</v-icon>
                                </v-btn>
                            </template> 
                        </v-tooltip>
                        <v-tooltip location="bottom" text="업무 지시">
                            <template v-slot:activator="{ props }">
                                <v-btn @click="startChat('work')" icon v-bind="props">
                                    <v-icon>mdi-file-document-outline</v-icon>
                                </v-btn>
                            </template> 
                        </v-tooltip>
                    </div>
                </v-list-item-content>
            </v-list-item>
        </v-list>
    </perfect-scrollbar>
</template>

<script setup>
import { ref, computed } from 'vue';
import { defineProps } from 'vue';

const props = defineProps({
    userList: Array,
});

const emit = defineEmits(['startChat', 'selectedUser']);

const searchValue = ref('');

const filteredUsers = computed(() => {
    return props.userList.filter((user) => {
        const searchLower = searchValue.value.toLowerCase();
        return user.username.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower);
    });
});

const getProfile = (email) => {
    let basePath = window.location.port == '' ? window.location.origin:'' 
    if(email == "system@uengine.org"){
        return `${basePath}/images/chat-icon.png`;
    } else {
        const user = props.userList.find(user => user.email === email);
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
};
const selectedUserInfo = ref(null);
const selectedUser = (user) => {
    selectedUserInfo.value = user;
    emit('selectedUser', user);
};

const startChat = (type) => {
    emit('startChat', type);
};
</script>

<style scoped>
.userItem {
    padding: 16px 24px !important;
    border-bottom: 1px solid rgb(var(--v-theme-inputBorder), 0.1);
}

.lgScroll {
    height: calc(100vh - 360px);
}
</style>
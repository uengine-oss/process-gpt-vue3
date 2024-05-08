<script setup lang="ts">
import { onMounted } from 'vue';
import { CircleXIcon, MailIcon } from 'vue-tabler-icons';
import { profileDD } from '@/_mockApis/headerData';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@iconify/vue';

const defaultPicture = 'https://github-production-user-asset-6210df.s3.amazonaws.com/59447401/328736072-ee824977-e07b-4e90-ad92-e5ba82fa6bb9.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20240508%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240508T024233Z&X-Amz-Expires=300&X-Amz-Signature=fca37f9fe89a5686e8565764af1050148193f9394bc7f63733754827355405fc&X-Amz-SignedHeaders=host&actor_id=59447401&key_id=0&repo_id=743777629'; // 기본 이미지 URL 설정
let picture = localStorage.getItem("picture");

onMounted(() => {
  if (!picture || picture == "null") {
    localStorage.setItem("picture", defaultPicture);
    picture = defaultPicture;
  }
});

const name = localStorage.getItem("userName");
const isAdmin = localStorage.getItem("isAdmin");
</script>

<template>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <!-- <v-menu :close-on-content-click="true" class="profile_popup"> -->
            <router-link class="custom-hover-primary text-left px-0 cursor-pointer text-decoration-none" variant="text" :to="`/pages/account-settings`">
                <div class="d-flex align-center">
                    <!-- user profile -->
                    <v-avatar size="50">
                        <v-img :src="picture" width="50" />
                    </v-avatar>
                    <div class="ml-md-4 d-md-block d-none">
                        <h6 class="text-h6 d-flex align-center text-black font-weight-semibold">{{ name }}</h6>
                        <span class="text-subtitle-2 font-weight-medium text-grey100">
                            {{ isAdmin == 'true' ? 'Admin' : ''}}
                        </span>
                    </div>
                </div>
            </router-link>
        <!-- <v-sheet rounded="lg" width="385" elevation="10" class="mt-5">
            <div class="px-8 pt-6">
                <div class="d-flex align-center justify-space-between">
                    <h6 class="text-h5 font-weight-semibold">User Profile</h6>
                    <CircleXIcon size="22" class="text-grey100 cursor-pointer opacity-50" />
                </div>

                <div class="d-flex align-center mt-5 pb-6">
                    <v-avatar size="90">
                        <v-img :src="picture" width="50" />
                    </v-avatar>
                    <div class="ml-5">
                        <h6 class="text-h5 mb-n1">{{ name }}</h6>
                        <span class="text-subtitle-1 font-weight-regular text-grey100 font-weight-medium">Admin</span>
                        <div class="d-flex align-center mt-1">
                            <MailIcon size="18" stroke-width="1.5" class="text-grey100" />
                            <span class="text-subtitle-1 text-grey100 font-weight-medium ml-2">{{ email }}</span>
                        </div>
                    </div>
                </div>
                <v-divider></v-divider>
            </div>
            <perfect-scrollbar style="height: calc(100vh - 240px); max-height: 240px">
                <v-list class="py-0 theme-list" lines="two">
                    <v-list-item v-for="item in profileDD" :key="item.title" class="py-4 px-8 custom-text-primary"
                        :to="item.href">
                        <template v-slot:prepend>
                            <v-avatar size="40" class="mr-5 rounded-lg" :class="'bg-light' + item.bgcolor">
                                <component :is="item.avatar" stroke-width="2" size="25" :class="'text-' + item.bgcolor" />
                                <Icon :icon="'solar:' + item.avatar" width="25" height="25"   :class="'text-' + item.bgcolor"/>
                            </v-avatar>
                        </template>
                        <div>
                            <h6 class="text-h6 font-weight-medium mb-1 custom-title">{{ item.title }}</h6>
                        </div>
                        <p class="text-subtitle-1 font-weight-regular text-grey100">{{ item.subtitle }}</p>
                    </v-list-item>
                </v-list>
            </perfect-scrollbar>
            <div class=" pb-6 px-8 text-center">
                <v-btn color="primary" size="large" rounded="pill" block @click="authStore.logout()">Logout</v-btn>
            </div>
        </v-sheet> -->
    <!-- </v-menu> -->
</template>

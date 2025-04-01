<script setup lang="ts">
import { onMounted } from 'vue';
import { CircleXIcon, MailIcon } from 'vue-tabler-icons';
import { profileDD } from '@/_mockApis/headerData';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@iconify/vue';

let picture = localStorage.getItem("picture");

const name = localStorage.getItem("userName");
const isAdmin = localStorage.getItem("isAdmin");
</script>

<template>
    <router-link class="custom-hover-primary text-left px-0 cursor-pointer text-decoration-none" variant="text" :to="`/account-settings`">
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
</template>

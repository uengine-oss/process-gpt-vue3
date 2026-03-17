<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { authClaimsState } from '@/utils/authClaims';

let picture = ref('');
let name = ref('');
const isAdmin = computed(() => authClaimsState.isAdmin);

onMounted(() => {
    picture.value = localStorage.getItem('picture');
    name.value = localStorage.getItem('userName');
});
</script>

<template>
    <v-tooltip :text="$t('headerMenu.setting')">
        <template v-slot:activator="{ props }">
            <router-link
                class="custom-hover-primary text-left px-0 cursor-pointer text-decoration-none"
                variant="text"
                :to="`/account-settings`"
            >
                <div class="d-flex align-center">
                    <v-btn style="margin-left: -4px" icon flat size="small" v-bind="props">
                        <SettingsIcon />
                    </v-btn>
                </div>
            </router-link>
        </template>
    </v-tooltip>
    <!-- <router-link class="custom-hover-primary text-left px-0 cursor-pointer text-decoration-none" variant="text" :to="`/account-settings`">
        <div class="d-flex align-center">
            <v-avatar size="50">
                <v-img :src="picture" width="50" />
            </v-avatar>
            <div class="ml-md-4 d-md-block d-none">
                <h6 class="text-h6 d-flex align-center text-black font-weight-semibold">{{ name }}</h6>
                <span class="text-subtitle-2 font-weight-medium text-grey100">
                    {{ isAdmin ? 'Admin' : ''}}
                </span>
            </div>
        </div>
    </router-link> -->
</template>

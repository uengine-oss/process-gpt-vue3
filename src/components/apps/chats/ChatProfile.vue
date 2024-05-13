<script setup>
import { ref } from 'vue';

const name = localStorage.getItem("userName");
const email = localStorage.getItem("email");
const picture = localStorage.getItem("picture");
</script>

<template>
    <v-sheet>
        <!---Topbar Row-->
        <div class="d-flex gap-2 align-center pa-6">
            <!---User Avatar-->
            <v-avatar size="large">
                <img :src="picture" alt="pro" width="54" />
            </v-avatar>

            <v-badge class="badg-dotDetail" dot color="success"> </v-badge>
            <!---Name & Last seen-->
            <div>
                <h5 class="text-subtitle-1 font-weight-semibold">{{ name }}</h5>
                <span class="text-subtitle-2 font-weight-medium text-grey100">Admin</span>
            </div>
        </div>
    </v-sheet>
</template>

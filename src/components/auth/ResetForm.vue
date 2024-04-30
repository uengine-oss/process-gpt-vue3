<script setup lang="ts">
import { ref } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();

const props = defineProps({
  type: String
});

const email = ref('');
const emailRules = ref([(v: string) => !!v || 'E-mail is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']);

const password = ref('');
const passwordRules = ref([
    (v: string) => !!v || 'Password is required',
    (v: string) => (v && v.length <= 10) || 'Password must be less than 10 characters'
]);

function resetPassword() {
    authStore.resetPassword(email.value);
}

function updatePassword() {
    authStore.updatePassword(email.value, password.value);
}
</script>

<template>
    <div>
        <v-form v-if="type === 'email'" ref="form" @submit.prevent="resetPassword" lazy-validation class="mt-sm-13 mt-8">
            <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText">{{ $t('forgotPassword.email') }}</v-label>
            <VTextField v-model="email" :rules="emailRules" required></VTextField>
            <v-btn size="large" color="primary" block type="submit" rounded="pill" class="mt-4">
                {{ $t('forgotPassword.sendEmail') }}
            </v-btn>
        </v-form>
        <v-form v-if="type === 'password'" ref="form" @submit.prevent="updatePassword" lazy-validation class="mt-sm-13 mt-8">
            <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText">{{ $t('forgotPassword.password') }}</v-label>
            <VTextField v-model="password" :rules="passwordRules" required type="password"></VTextField>
            <v-btn size="large" color="primary" block type="submit" rounded="pill" class="mt-4">
                {{ $t('forgotPassword.updatePassword') }}
            </v-btn>
        </v-form>
    </div>
</template>

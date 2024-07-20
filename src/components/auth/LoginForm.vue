<script setup lang="ts">
import { Form } from 'vee-validate';
import { ref } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
const checkbox = ref(false);
const password = ref('admin123');

// localStorage에서 이메일을 가져오고, 없으면 빈 문자열로 설정
const storedEmail = localStorage.getItem('email') || '';
const username = ref(storedEmail);

const passwordRules = ref([
    (v: string) => !!v || 'Password is required',
    (v: string) => (v && v.length <= 10) || 'Password must be less than 10 characters'
]);
const emailRules = ref([(v: string) => !!v || 'E-mail is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']);

function validate(values: any, { setErrors }: any) {
    return authStore.signIn(username.value, password.value);
}
</script>

<template>
    <Form @submit="validate" v-slot="{ errors, isSubmitting }" class="mt-5">
        <v-label class="text-subtitle-1 font-weight-semibold pb-2 text-grey200">{{ $t('loginPage.userName') }}</v-label>
        <VTextField
            v-model="username"
            :rules="emailRules"
            class="mb-8 cp-id"
            required
            hide-details="auto"
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-semibold pb-2 text-grey200">{{ $t('loginPage.password') }}</v-label>
        <VTextField
            v-model="password"
            :rules="passwordRules"
            required
            hide-details="auto"
            type="password"
            class="pwdInput cp-pwd"
        ></VTextField>
        <div class="d-flex flex-wrap align-center my-3 ml-n2">
            <v-checkbox v-model="checkbox" :rules="[(v:any) => !!v || 'You must agree to continue!']" required hide-details color="primary">
                <template v-slot:label>{{ $t('loginPage.remeber') }}</template>
            </v-checkbox>
        </div>
        <v-btn class="cp-login" size="large" rounded="pill" :loading="isSubmitting" color="primary" block type="submit" flat>{{ $t('loginPage.login') }}</v-btn>
        <div v-if="errors.apiError" class="mt-2">
            <v-alert color="error">{{ errors.apiError }}</v-alert>
        </div>
    </Form>
</template>
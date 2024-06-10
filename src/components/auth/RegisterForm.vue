<script setup lang="ts">
import { Form } from 'vee-validate';
import { ref } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();

/*Social icons*/
//import google from '@/assets/images/svgs/google-icon.svg';

const password = ref('');
const email = ref('');
const passwordRules = ref([
    (v: string) => !!v || 'Password is required',
    (v: string) => (v && v.length <= 10) || 'Password must be less than 10 characters'
]);
const emailRules = ref([(v: string) => !!v || 'E-mail is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']);
const username = ref('');
const usernameRules = ref([
    (v: string) => !!v || 'Name is required',
    (v: string) => (v && v.length <= 10) || 'Name must be less than 10 characters'
]);

function validate(values: any, { setErrors }: any) {
    return authStore.signUp(username.value, email.value, password.value);
}
</script>
<template>
    <!-- Social -->
    <!-- <v-row class="d-flex mb-3">
        <v-col cols="12" sm="12">
            <v-btn variant="outlined" size="large" class="border text-subtitle-1 text-gray200 font-weight-semibold" block>
                <img :src="google" height="16" class="mr-2" alt="google" />
                <span class="d-sm-flex d-none mr-1">{{ $t('createAccount.google') }}</span>
            </v-btn>
        </v-col>
    </v-row>
    <div class="d-flex align-center text-center mb-6">
        <div class="text-h6 w-100 px-5 font-weight-regular auth-divider position-relative">
            <span class="bg-surface px-5 py-3 position-relative text-subtitle-1 text-grey100">{{ $t('createAccount.or') }}</span>
        </div>  
    </div> -->
    <Form @submit="validate" v-slot="{ errors, isSubmitting }" class="mt-5">
        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ $t('createAccount.normalRegister') }}
        </v-label>
        <v-divider class="mb-4" />

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.userName') }}</v-label>
        <VTextField 
            v-model="username" 
            :rules="usernameRules" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.email') }}</v-label>
        <VTextField 
            v-model="email" 
            :rules="emailRules" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.password') }}</v-label>
        <VTextField
            v-model="password"
            :counter="10"
            :rules="passwordRules"
            required
            variant="outlined"
            type="password"
            color="primary"
        ></VTextField>
        <v-btn 
            size="large" 
            class="mt-2" 
            color="primary" 
            block 
            rounded="pill"
            :loading="isSubmitting"
            type="submit"
        >Sign up</v-btn>
    </Form>
</template>

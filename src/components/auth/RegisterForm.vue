<script setup lang="ts">
import { Form } from 'vee-validate';
import { ref, getCurrentInstance } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
const { proxy } = getCurrentInstance();

/*Social icons*/
//import google from '@/assets/images/svgs/google-icon.svg';

const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const email = ref('');
const passwordRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterPassword'),
]);
const emailRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterEmail'), 
    (v: string) => /.+@.+\..+/.test(v) || proxy.$t('createAccount.invalidEmailFormat')
]);
const username = ref('');
const usernameRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterName'),
]);

// 비밀번호 일치 여부 검증 함수
const confirmPasswordRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterConfirmPassword'),
    (v: string) => v === password.value || proxy.$t('createAccount.passwordMismatch')
]);

function validate(values: any, { setErrors }: any) {
    // 비밀번호 일치 여부 확인
    if (password.value !== confirmPassword.value) {
        setErrors({ confirmPassword: proxy.$t('createAccount.passwordMismatch') });
        return;
    }
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
        <!-- 암호 확인 부분 -->
        <div>
            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.password') }}</v-label>
            <VTextField
                v-model="password"
                :rules="passwordRules"
                required
                variant="outlined"
                :type="showPassword ? 'text' : 'password'"
                color="primary"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.confirmPassword') }}</v-label>
            <VTextField
                v-model="confirmPassword"
                :rules="confirmPasswordRules"
                required
                variant="outlined"
                :type="showConfirmPassword ? 'text' : 'password'"
                color="primary"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
            ></VTextField>
        </div>
        
        <v-btn 
            size="large" 
            class="mt-2" 
            color="primary" 
            block 
            rounded="pill"
            :loading="isSubmitting"
            type="submit"
        >{{ $t('createAccount.signUp') }}</v-btn>
    </Form>
</template>
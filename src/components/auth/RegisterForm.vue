<script setup lang="ts">
import { Form } from 'vee-validate';
import { ref, computed, getCurrentInstance, defineProps } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
const { proxy } = getCurrentInstance();

/*Social icons*/
//import google from '@/assets/images/svgs/google-icon.svg';

const { isTenantRegister } = defineProps<{ isTenantRegister: boolean }>();

const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const email = ref('');
const passwordRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterPassword'),
    (v: string) => (v.length >= 8 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v)) || proxy.$t('createAccount.passwordRequirement'),
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

const isRegisterFormValid = computed(() => {
    if (!username.value) return false;
    if (!email.value || !/.+@.+\..+/.test(email.value)) return false;
    if (!password.value || password.value.length < 8) return false;
    if (!/[a-zA-Z]/.test(password.value)) return false;
    if (!/[0-9]/.test(password.value)) return false;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password.value)) return false;
    if (!confirmPassword.value || confirmPassword.value !== password.value) return false;
    return true;
});

function validate(values: any, { setErrors }: any) {
    // 필수 입력값 및 이메일 형식 검증
    let hasError = false;
    if (!username.value) {
        setErrors({ username: proxy.$t('createAccount.enterName') });
        hasError = true;
    }
    if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        setErrors({ email: proxy.$t('createAccount.invalidEmailFormat') });
        hasError = true;
    }
    if (!password.value) {
        setErrors({ password: proxy.$t('createAccount.enterPassword') });
        hasError = true;
    } else if (password.value.length < 8 || !/[a-zA-Z]/.test(password.value) || !/[0-9]/.test(password.value) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password.value)) {
        setErrors({ password: proxy.$t('createAccount.passwordRequirement') });
        hasError = true;
    }
    if (!confirmPassword.value || password.value !== confirmPassword.value) {
        setErrors({ confirmPassword: proxy.$t('createAccount.passwordMismatch') });
        hasError = true;
    }

    // 검증 결과에 따른 메시지 출력
    return (window as any).$app_.try({
        action: async () => {
            if (hasError) {
                throw new Error(); // 오류 발생 시 빈 오류 던지기
            }
            await authStore.signUp(username.value, email.value, password.value, proxy);
        },
        errorMsg: proxy.$t('createAccount.registrationFailed') // 실패 시 이 메시지 사용
    });
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
            {{ isTenantRegister ? $t('createAccount.tenantRegister') : $t('createAccount.normalRegister') }}
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
            :disabled="!isRegisterFormValid"
            type="submit"
        >{{ $t('createAccount.signUp') }}</v-btn>
    </Form>
</template>
<script setup lang="ts">
import { ref, computed, getCurrentInstance } from 'vue';

import { useAuthStore } from '@/stores/auth';
import { createPasswordRules, getPasswordPolicyHint, isPasswordValid } from '@/utils/passwordPolicy';
const authStore = useAuthStore();

const props = defineProps({
    type: String
});
const { proxy } = getCurrentInstance();

const email = ref('');
const emailRules = ref([(v: string) => !!v || 'E-mail is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']);

const translate = (key: string, named?: Record<string, unknown>) => proxy.$t(key, named);

const password = ref('');
const passwordRules = ref(createPasswordRules(translate));
const passwordPolicyHint = computed(() => getPasswordPolicyHint(translate));

const confirmPassword = ref('');
const confirmPasswordRules = computed(() => [
    (v: string) => !!v || 'Password confirmation is required',
    (v: string) => v === password.value || proxy.$t('forgotPassword.passwordMismatch')
]);

const showPassword = ref(false);
const showConfirmPassword = ref(false);

const isPasswordMatched = computed(() => {
    return password.value.length > 0 && password.value === confirmPassword.value;
});

// 비밀번호 정책(10자 이상, 대/소문자·숫자·특수문자 각 1자 이상)까지 만족해야 변경 버튼이 활성화된다.
const isNewPasswordValid = computed(() => isPasswordMatched.value && isPasswordValid(password.value));

function resetPassword() {
    authStore.resetPassword(email.value, proxy);
}

function updatePassword() {
    if (password.value !== confirmPassword.value) return;
    if (!isPasswordValid(password.value)) return;
    authStore.updatePassword(password.value, proxy);
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
            <VTextField
                v-model="password"
                :rules="passwordRules"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="showPassword = !showPassword"
                :hint="passwordPolicyHint"
                persistent-hint
                required
            ></VTextField>
            <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText">{{ $t('forgotPassword.confirmPassword') }}</v-label>
            <VTextField
                v-model="confirmPassword"
                :rules="confirmPasswordRules"
                :type="showConfirmPassword ? 'text' : 'password'"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
                required
            ></VTextField>
            <v-btn size="large" color="primary" block type="submit" rounded="pill" class="mt-4" :disabled="!isNewPasswordValid">
                {{ $t('forgotPassword.updatePassword') }}
            </v-btn>
        </v-form>
    </div>
</template>

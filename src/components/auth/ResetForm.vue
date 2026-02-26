<script setup lang="ts">
import { ref, computed, getCurrentInstance } from 'vue';

import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();

const props = defineProps({
  type: String
});
const { proxy } = getCurrentInstance();

const email = ref('');
const emailRules = ref([(v: string) => !!v || 'E-mail is required', (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid']);

const password = ref('');
const passwordRules = ref([
    (v: string) => !!v || proxy.$t('createAccount.enterPassword'),
    (v: string) => v.length >= 8 || proxy.$t('createAccount.passwordMinLength'),
    (v: string) => /[a-zA-Z]/.test(v) || proxy.$t('createAccount.passwordNeedLetter'),
    (v: string) => /[0-9]/.test(v) || proxy.$t('createAccount.passwordNeedNumber'),
    (v: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v) || proxy.$t('createAccount.passwordNeedSpecial'),
]);

const confirmPassword = ref('');
const confirmPasswordRules = computed(() => [
    (v: string) => !!v || 'Password confirmation is required',
    (v: string) => v === password.value || proxy.$t('forgotPassword.passwordMismatch'),
]);

const showPassword = ref(false);
const showConfirmPassword = ref(false);

const isPasswordMatched = computed(() => {
    return password.value.length > 0 && password.value === confirmPassword.value;
});

function resetPassword() {
    authStore.resetPassword(email.value, proxy);
}

function updatePassword() {
    if (password.value !== confirmPassword.value) return;
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
            <v-btn size="large" color="primary" block type="submit" rounded="pill" class="mt-4" :disabled="!isPasswordMatched">
                {{ $t('forgotPassword.updatePassword') }}
            </v-btn>
        </v-form>
    </div>
</template>

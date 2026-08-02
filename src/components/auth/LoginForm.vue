<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const username = ref(localStorage.getItem('email') || '');
const password = ref('');
const remember = ref(true);
const showPassword = ref(false);
const isCapsLockOn = ref(false);
const submitting = ref(false);
const touched = ref(false);

const emailError = computed(() => {
    if (!touched.value) return '';
    if (!username.value) return 'E-mail is required';
    // 도메인에 점을 강제하지 않는다. `demo@localhost` 같은 인트라넷 주소도 유효하고,
    // 실제로 로컬/사내 설치본이 그런 계정을 쓴다.
    if (!/^[^@\s]+@[^@\s]+$/.test(username.value)) return 'E-mail must be valid';
    return '';
});
const passwordError = computed(() => {
    if (!touched.value) return '';
    return password.value ? '' : 'Password is required';
});
const canSubmit = computed(() => !!username.value && !!password.value);

function checkCapsLock(event: KeyboardEvent | FocusEvent) {
    if ('getModifierState' in event) {
        isCapsLockOn.value = (event as KeyboardEvent).getModifierState('CapsLock');
    }
}

async function submit() {
    touched.value = true;
    if (!canSubmit.value || emailError.value) return;

    submitting.value = true;
    try {
        if (remember.value) localStorage.setItem('email', username.value.toLowerCase());
        else localStorage.removeItem('email');

        // signIn 은 내부에서 에러 표시와 라우팅까지 처리한다
        await authStore.signIn(username.value.toLowerCase(), password.value);
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <form class="login-form" novalidate @submit.prevent="submit">
        <PgTextField
            v-model="username"
            :label="$t('loginPage.userName')"
            type="email"
            autocomplete="username"
            :error="emailError"
            class="cp-id"
        />

        <div class="login-form__password">
            <PgTextField
                v-model="password"
                :label="$t('loginPage.password')"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :error="passwordError"
                class="cp-pwd"
                @keydown="checkCapsLock"
                @keyup="checkCapsLock"
                @focus="checkCapsLock"
            >
                <template #append>
                    <button
                        class="login-form__reveal"
                        type="button"
                        :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 표시'"
                        @click="showPassword = !showPassword"
                    >
                        <PgIcon :name="showPassword ? 'mdi-eye-off' : 'mdi-eye'" :size="16" />
                    </button>
                </template>
            </PgTextField>

            <PgChip v-if="isCapsLockOn" tone="warning" size="sm" class="login-form__caps">
                <PgIcon name="mdi-lock-alert" :size="12" />
                Caps Lock이 켜져있습니다
            </PgChip>
        </div>

        <PgCheckbox v-model="remember" :label="$t('loginPage.remeber')" />

        <PgButton type="submit" variant="primary" size="lg" block :loading="submitting" :disabled="!canSubmit" class="cp-login">
            {{ $t('loginPage.login') }}
        </PgButton>
    </form>
</template>

<style scoped>
.login-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-top: 24px;
}

.login-form__password {
    position: relative;
}

.login-form__reveal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--cds-text-muted);
    cursor: pointer;
}
.login-form__reveal:hover {
    color: var(--cds-text-secondary);
}

.login-form__caps {
    margin-top: 6px;
}
</style>

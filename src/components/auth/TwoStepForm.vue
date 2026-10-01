<script setup lang="ts">
/**
 * MFA(TOTP) 챌린지 폼 (docs/security.md 2-3, 항목 3)
 *
 * 로그인은 통과했지만 아직 aal1 인 세션에서 인증 앱의 6자리 코드를 받아
 * challenge + verify 로 aal2 까지 올린다. 성공하면 ?redirect= 로 실려 온
 * 원래 목적지로 돌아간다.
 *
 * 템플릿(6칸 입력 + verify 버튼)은 기존 디자인 그대로 두고 로직만 붙였다.
 */
import { nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAal, listTotpFactors, mfaErrorMessage, needsChallenge, verifyTotp } from '@/utils/mfa';
import { safeRedirectTarget } from '@/utils/mfaGate';

const DIGITS = 6;

const route = useRoute();
const router = useRouter();

// main.ts 의 createI18n 은 legacy 모드라 setup 에서 useI18n() 을 쓸 수 없다.
// 레포 표준대로 전역 인스턴스의 t 를 쓴다 (템플릿에서는 $t 를 그대로 쓴다).
const i18n = () => (window as any).$i18n?.global;
const t = (key: string, params?: any): string => (params ? i18n()?.t(key, params) : i18n()?.t(key)) ?? key;

const digits = ref<string[]>(Array(DIGITS).fill(''));
const fieldsRef = ref<HTMLElement | null>(null);
const verifying = ref(false);
const loading = ref(true);
const errorMessage = ref('');
const factorId = ref('');

const redirectTarget = () => safeRedirectTarget(route.query.redirect, '/');

function inputEls(): HTMLInputElement[] {
    if (!fieldsRef.value) return [];
    return Array.from(fieldsRef.value.querySelectorAll('input'));
}

function focusIndex(index: number) {
    const el = inputEls()[index];
    if (el) {
        el.focus();
        el.select?.();
    }
}

function clearCode(focusFirst = true) {
    digits.value = Array(DIGITS).fill('');
    if (focusFirst) void nextTick(() => focusIndex(0));
}

onMounted(async () => {
    try {
        const aal = await getAal();

        // 세션이 없으면 로그인부터.
        if (!aal.currentLevel) {
            await router.replace('/auth/login');
            return;
        }

        // 이미 통과했거나 등록된 팩터가 없으면 여기 머무를 이유가 없다.
        if (!needsChallenge(aal)) {
            await router.replace(redirectTarget());
            return;
        }

        const { verified } = await listTotpFactors();
        if (verified.length === 0) {
            await router.replace(redirectTarget());
            return;
        }
        factorId.value = verified[0].id;
        void nextTick(() => focusIndex(0));
    } catch (e) {
        errorMessage.value = mfaErrorMessage(e) || t('mfa.verifyFailed');
    } finally {
        loading.value = false;
    }
});

function onInput(index: number, value: string) {
    errorMessage.value = '';
    const onlyDigits = String(value ?? '').replace(/\D/g, '');

    if (onlyDigits.length > 1) {
        // 붙여넣기 등으로 여러 자리가 한 칸에 들어온 경우 뒤 칸으로 펼친다.
        const next = [...digits.value];
        for (let i = 0; i < onlyDigits.length && index + i < DIGITS; i++) {
            next[index + i] = onlyDigits[i];
        }
        digits.value = next;
        const landed = Math.min(index + onlyDigits.length, DIGITS - 1);
        void nextTick(() => focusIndex(landed));
    } else {
        digits.value[index] = onlyDigits;
        if (onlyDigits && index < DIGITS - 1) {
            void nextTick(() => focusIndex(index + 1));
        }
    }

    if (digits.value.every((d) => d !== '')) {
        void submit();
    }
}

function onKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
        event.preventDefault();
        digits.value[index - 1] = '';
        focusIndex(index - 1);
    } else if (event.key === 'Enter') {
        void submit();
    }
}

async function submit() {
    if (verifying.value) return;

    const code = digits.value.join('');
    if (code.length !== DIGITS) {
        errorMessage.value = t('mfa.codeLength', { length: DIGITS });
        return;
    }
    if (!factorId.value) {
        errorMessage.value = t('mfa.noFactor');
        return;
    }

    verifying.value = true;
    errorMessage.value = '';
    try {
        await verifyTotp(factorId.value, code);
        await router.replace(redirectTarget());
    } catch (e) {
        // 코드가 틀렸는지 만료됐는지 서버가 구분해 주지 않으므로 한 문구로 안내한다.
        errorMessage.value = t('mfa.verifyFailed');
        clearCode();
    } finally {
        verifying.value = false;
    }
}

async function backToLogin() {
    try {
        await (window as any).$supabase?.auth?.signOut?.();
    } catch (_e) {
        /* 세션 정리 실패해도 로그인 화면으로는 보낸다 */
    }
    await router.replace('/auth/login');
}
</script>

<template>
    <div class="mt-sm-13 mt-8">
        <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText">{{ $t('mfa.enterCode') }}</v-label>
        <div ref="fieldsRef" class="d-flex justify-space-between gap-3 mb-2 verification">
            <VTextField
                v-for="(_digit, index) in digits"
                :key="index"
                :model-value="digits[index]"
                @update:model-value="(value: string) => onInput(index, value)"
                @keydown="(event: KeyboardEvent) => onKeydown(index, event)"
                :disabled="loading || verifying"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                hide-details
            ></VTextField>
        </div>
        <v-alert v-if="errorMessage" type="error" density="compact" variant="tonal" class="mb-3">{{ errorMessage }}</v-alert>
        <v-btn color="primary" size="large" block flat :loading="verifying" :disabled="loading" @click="submit">{{
            $t('mfa.verifyButton')
        }}</v-btn>
        <h6 class="text-h6 mt-5 font-weight-regular">
            {{ $t('mfa.lostDevice') }}
            <a
                href="#"
                class="text-primary text-subtitle-1 text-decoration-none pl-1 font-weight-medium"
                @click.prevent="backToLogin"
                >{{ $t('mfa.backToLogin') }}</a
            >
        </h6>
    </div>
</template>

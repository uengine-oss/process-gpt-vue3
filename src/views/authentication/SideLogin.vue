<script setup lang="ts">
import { ref } from 'vue';
import LoginForm from '@/components/auth/LoginForm.vue';

const isTenantServer = ref(window.$isTenantServer);
const tenantId = ref(window.$tenantName);
</script>

<template>
    <div class="login">
        <div class="login__card">
            <div class="login__brand">
                <span class="login__spark" aria-hidden="true">
                    <PgIcon name="mdi-star-four-points" :size="26" />
                </span>
                <span>Process GPT</span>
            </div>

            <h1 class="login__title">{{ $t('loginPage.title') }}</h1>

            <LoginForm />

            <div class="login__links">
                <RouterLink
                    v-if="isTenantServer || tenantId == 'localhost'"
                    :to="isTenantServer ? '/tenant/register' : '/auth/register'"
                    class="login__link"
                >
                    {{ $t('loginPage.create') }}
                </RouterLink>
                <span class="pg-spacer" />
                <RouterLink to="/auth/forgot-password" class="login__link">
                    {{ $t('loginPage.forgotPassword') }}
                </RouterLink>
            </div>
        </div>

        <p class="login__foot">업무를 프로세스로 만들고, 에이전트가 실행합니다.</p>
    </div>
</template>

<style scoped>
.login {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 100vh;
    padding: 24px;
    background: var(--cds-surface-0);
}

/* 컴포저와 동일한 표면 언어: 흰 카드 + 옅은 확산 그림자 + 0.5px 헤어라인 */
.login__card {
    width: 100%;
    max-width: 400px;
    padding: 32px;
    border-radius: var(--cds-radius-composer);
    background: var(--cds-surface-2);
    box-shadow: var(--cds-shadow-composer);
}

.login__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--cds-font-voice);
    font-size: 22px;
    letter-spacing: -0.01em;
    color: var(--cds-text-primary);
}
.login__spark {
    display: inline-flex;
    color: hsl(var(--accent-brand));
}

.login__title {
    margin-top: 20px;
    font-family: var(--cds-font-voice);
    font-size: 28px;
    font-weight: var(--cds-font-weight-regular);
    line-height: 1.25;
    letter-spacing: -0.01em;
}

.login__links {
    display: flex;
    align-items: center;
    margin-top: 20px;
}
.login__link {
    color: var(--cds-text-secondary);
    font-size: var(--cds-font-size-footnote);
    line-height: var(--cds-leading-footnote);
    font-weight: var(--cds-font-weight-medium);
    text-decoration: none;
}
.login__link:hover {
    color: var(--cds-text-primary);
    text-decoration: underline;
}

.login__foot {
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
}
</style>

<script setup lang="ts">
import { onMounted } from 'vue';
import Logo from '@/layouts/full/logo/Logo.vue';
import ResetPassword from '@/components/auth/ResetForm.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

onMounted(async () => {
    // 이메일 링크로 들어온 경우 해시에 복구 토큰이 있음. 이때는 signOut하면 안 됨(복구 세션 제거됨).
    const hash = window.location.hash || '';
    const hasRecoveryToken = /type=recovery|access_token=/.test(hash);

    // 비밀번호 재설정은 이메일 링크(복구 토큰)로만 진행하므로, 복구 링크가 아닐 때만 기존 로그인 세션을 비운다.
    if (hasRecoveryToken) return;

    const storage = StorageBaseFactory.getStorage();
    try {
        if (await storage.isConnection()) {
            await storage.signOut();
        }
    } catch (e) {
        console.warn('[SideResetPassword] 세션 정리 중 오류:', e);
    }
});
</script>

<template>
    <div class="pa-3">
        <v-row class="h-100vh mh-100 auth">
            <v-col cols="12" lg="8" xl="8" xxl="9" class="d-lg-flex align-center justify-center authentication position-relative">
                <div class="auth-header pt-sm-6 pt-2 px-sm-6 px-3 pb-sm-6 pb-0">
                    <div class="position-relative"><Logo /></div>
                </div>
                <div class="">
                    <img src="@/assets/images/backgrounds/login-bg.svg" height="450" class="position-relative d-none d-lg-flex" alt="login-background" />
                </div>
            </v-col>
            <v-col cols="12" lg="4" xl="4" xxl="3" class="d-flex align-center justify-center bg-surface">
                <div class="pa-sm-7 pa-4">
                    <h2 class="text--darken-2 text-h4 font-weight-semibold">{{ $t('forgotPassword.resetPassword') }}</h2>
                    <p class="text-subtitle-1 text-grey100 py-4 text-10">
                        {{ $t('forgotPassword.passwordExplanation') }}
                    </p>
                    <ResetPassword :type="'password'" />
                    <v-btn size="large" color="lightprimary" to="/auth/login" block class="mt-5 text-primary" rounded="pill">
                        {{ $t('forgotPassword.login') }}
                    </v-btn>
                </div>
            </v-col>
        </v-row>
    </div>
</template>

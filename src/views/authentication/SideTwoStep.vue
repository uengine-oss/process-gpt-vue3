<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Logo from '@/layouts/full/logo/Logo.vue';
/*form component*/
import TwoStepForm from '@/components/auth/TwoStepForm.vue';

// 어느 계정으로 2단계 인증 중인지 보여준다 (기존 템플릿의 마스킹된 번호 자리).
const accountEmail = ref('');

onMounted(async () => {
    try {
        const { data } = (await (window as any).$supabase?.auth?.getUser?.()) || {};
        accountEmail.value = data?.user?.email || localStorage.getItem('email') || '';
    } catch (_e) {
        accountEmail.value = localStorage.getItem('email') || '';
    }
});
</script>

<template>
    <div class="pa-3">
        <v-row class="h-100vh mh-100 auth">
            <v-col cols="12" lg="8" xl="9" class="d-lg-flex align-center justify-center authentication position-relative">
                <div class="auth-header pt-sm-6 pt-2 px-sm-6 px-3 pb-sm-6 pb-0">
                    <div class="position-relative">
                        <Logo />
                    </div>
                </div>
                <div class="">
                    <img
                        src="@/assets/images/backgrounds/login-bg.svg"
                        height="450"
                        class="position-relative d-none d-lg-flex"
                        alt="login-background"
                    />
                </div>
            </v-col>
            <v-col cols="12" lg="4" xl="3" class="d-flex align-center justify-center bg-surface">
                <div class="pa-sm-6 pa-4 w-100">
                    <h3 class="text-h4 font-weight-semibold">{{ $t('mfa.challengeTitle') }}</h3>
                    <p class="text-subtitle-1 text-grey100 mt-2 text-13">
                        {{ $t('mfa.challengeSubtitle') }}
                    </p>
                    <h6 v-if="accountEmail" class="text-subtitle-1 mt-3 font-weight-medium">{{ accountEmail }}</h6>
                    <!---Form---->
                    <TwoStepForm />
                    <!------->
                </div>
            </v-col>
        </v-row>
    </div>
</template>

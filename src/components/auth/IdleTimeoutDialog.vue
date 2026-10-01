<!--
    유휴 세션 타임아웃 경고 (docs/security.md 2-1, 항목 12)

    App.vue 에 한 번만 얹어 두는 전역 모달이다. 타이머 자체는
    @/composables/useIdleTimeout 이 돌리고, 여기서는 남은 시간을 보여주고
    "로그인 유지" 를 받는 일만 한다.

    테넌트 설정(configuration.session_timeout)이 0 이면 컴포저블이 타이머를
    켜지 않으므로 이 모달은 뜨지 않는다.
-->
<template>
    <v-dialog v-model="warningVisible" max-width="420" persistent>
        <v-card rounded="lg">
            <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                <v-icon size="18" color="warning" class="mr-2">mdi-clock-alert-outline</v-icon>
                {{ $t('sessionTimeout.title') }}
            </v-card-title>

            <v-card-text class="pa-4 pt-2">
                <div class="text-body-2">{{ $t('sessionTimeout.message', { minutes: idleMinutes }) }}</div>
                <div class="text-caption text-disabled mt-2">
                    {{ $t('sessionTimeout.countdown', { seconds: remainingSeconds }) }}
                </div>
            </v-card-text>

            <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="text" @click="logoutNow">{{ $t('sessionTimeout.logoutNow') }}</v-btn>
                <v-btn color="primary" variant="flat" @click="extend">{{ $t('sessionTimeout.extend') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { useIdleTimeout } from '@/composables/useIdleTimeout';

const { warningVisible, remainingSeconds, idleMinutes, extend, logoutNow } = useIdleTimeout();
</script>

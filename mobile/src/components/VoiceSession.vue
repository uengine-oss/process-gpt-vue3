<template>
    <!--
        말로 하는 대화. 오디오·WebSocket 을 다루는 부분은 포털과 **같은 컴포넌트**를
        그대로 쓴다(VoiceAgentDesktopMode). 그쪽은 화면이 없는 부품이라, 여기서는
        휴대폰에 맞는 화면만 입힌다.
    -->
    <VoiceAgentDesktopMode
        :active="active"
        :origin="origin"
        :chat-room-id="roomId"
        :agent-info="agent"
        :conversation-history="history"
        @started="status = 'listening'"
        @stopped="onStopped"
        @speaking-start="status = 'speaking'"
        @speaking-stop="status = 'responding'"
        @ai-audio-start="status = 'playing'"
        @ai-audio-stop="status = 'listening'"
        @user-transcript="(t: string) => emit('user-said', t)"
        @ai-transcript-delta="(d: string) => emit('agent-delta', d)"
        @ai-transcript-done="(t: string) => emit('agent-said', t)"
        @ai-interrupted="emit('agent-interrupted')"
        @error="onError"
    />

    <!--
        말하는 동안 화면에는 글자가 거의 없다. 지금 듣고 있는지 대답하는 중인지
        말해 주지 않으면 사용자는 멈춘 줄 알고 다시 누른다.
    -->
    <div v-if="active" class="voice" role="status" aria-live="polite">
        <span class="voice__pulse" :class="`voice__pulse--${status}`" aria-hidden="true"></span>
        <span class="voice__body">
            <strong>{{ statusText }}</strong>
            <span v-if="error" class="voice__hint">{{ error }}</span>
            <span v-else class="voice__hint">말이 끝나면 알아서 대답합니다. 끊으려면 종료를 누르세요.</span>
        </span>
        <button type="button" class="m-btn voice__stop" @click="emit('close')">종료</button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import VoiceAgentDesktopMode from '@/components/ui/VoiceAgentDesktopMode.vue';
import { voiceStatusText } from '@/shared/voice/index.js';

const props = defineProps<{
    active: boolean;
    /** 조직 서버 주소. 앱 화면은 https://localhost 라 이것 없이는 연결되지 않는다. */
    origin: string;
    roomId: string;
    agent: any;
    history: any[];
}>();

const emit = defineEmits<{
    (e: 'user-said', text: string): void;
    (e: 'agent-delta', delta: string): void;
    (e: 'agent-said', text: string): void;
    (e: 'agent-interrupted'): void;
    (e: 'close'): void;
}>();

const status = ref('idle');
const error = ref('');

const statusText = computed(() => voiceStatusText(error.value ? 'error' : status.value));

watch(
    () => props.active,
    (on) => {
        status.value = on ? 'connecting' : 'idle';
        error.value = '';
    }
);

function onStopped() {
    status.value = 'idle';
}

/**
 * 연결에 실패했을 때.
 *
 * 조용히 닫으면 사용자는 자기가 뭘 잘못한 줄 안다. 무슨 일인지 말하고 잠시
 * 두었다가 닫는다 — 읽을 시간은 줘야 한다.
 */
function onError(e: any) {
    console.error('[voice] 실패', e);
    error.value = '음성 서버에 연결하지 못했습니다.';
    status.value = 'error';
    setTimeout(() => emit('close'), 3000);
}
</script>

<style scoped>
.voice {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(var(--composer-h, 132px) + 12px);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--rule);
    box-shadow: 0 6px 24px rgb(0 0 0 / 12%);
}

.voice__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.voice__body strong {
    font-size: 0.94rem;
}

.voice__hint {
    font-size: 0.78rem;
    color: var(--ink-faint);
}

.voice__pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
    background: var(--rule);
}

/* 듣는 중과 대답하는 중을 눈으로 구분한다 — 글자를 읽지 않아도 알게. */
.voice__pulse--listening,
.voice__pulse--speaking {
    background: var(--brand);
    animation: voice-pulse 1.4s ease-in-out infinite;
}

.voice__pulse--responding,
.voice__pulse--playing {
    background: var(--brand);
    box-shadow: 0 0 0 4px var(--brand-wash);
}

.voice__pulse--error {
    background: var(--danger, #c0392b);
}

.voice__stop {
    flex: none;
}

@keyframes voice-pulse {
    0%,
    100% {
        box-shadow: 0 0 0 0 var(--brand-wash);
    }
    50% {
        box-shadow: 0 0 0 6px transparent;
    }
}

@media (prefers-reduced-motion: reduce) {
    .voice__pulse--listening,
    .voice__pulse--speaking {
        animation: none;
    }
}
</style>

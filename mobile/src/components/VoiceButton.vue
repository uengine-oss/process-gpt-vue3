<template>
    <button
        v-if="supported"
        type="button"
        class="voice"
        :class="{ 'voice--on': recording }"
        :disabled="busy || working"
        :aria-label="recording ? '녹음 멈추기' : '음성으로 입력'"
        :title="hint"
        @click="toggle"
    >
        <span v-if="working" class="voice__dots" aria-hidden="true"></span>
        <Icon v-else :name="recording ? 'stop' : 'microphone'" :size="18" />
    </button>
</template>

<script setup lang="ts">
/**
 * 말로 입력하기.
 *
 * 작은 자판으로 긴 글을 적는 것보다 말하는 편이 빠르다. 현장에서 한 손으로
 * 쓰는 상황도 많다. 그래서 글을 적는 자리마다 붙인다.
 *
 * 받아쓴 글은 **덧붙인다.** 덮어쓰면 이미 적어 둔 것이 사라진다.
 */

import { onUnmounted, ref } from 'vue';

import Icon from './Icon.vue';
import axios from '@/utils/axios';

import { appendTranscript, canRecord, reasonText, startRecording, transcribe } from '../lib/voice.js';

const props = defineProps<{ modelValue?: string; busy?: boolean }>();
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'error', message: string): void;
}>();

const supported = canRecord();
const recording = ref(false);
const working = ref(false);
const hint = ref('음성으로 입력');

let session: any = null;

async function toggle() {
    if (recording.value) return void stop();
    await start();
}

async function start() {
    const result = await startRecording();
    if (!result.ok) {
        emit('error', reasonText(result.reason));
        return;
    }
    session = result;
    recording.value = true;
}

async function stop() {
    recording.value = false;
    working.value = true;
    try {
        const blob = await session?.stop();
        session = null;

        const result = await transcribe(blob, { post: (url: string, body: any) => axios.post(url, body) });
        if (!result.ok) {
            emit('error', reasonText(result.reason));
            return;
        }
        emit('update:modelValue', appendTranscript(props.modelValue, result.text));
    } finally {
        working.value = false;
    }
}

onUnmounted(() => {
    // 화면을 떠나도 마이크가 켜져 있으면 녹음 표시가 계속 남는다.
    void session?.stop();
});
</script>

<style scoped>
.voice {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    border: 1px solid var(--rule);
    background: var(--ground);
    color: var(--ink-soft);
}

.voice--on {
    background: var(--danger-wash);
    border-color: transparent;
    color: var(--danger);
}

/* 받아쓰는 동안. 아이콘 자리에 점 세 개가 뛴다. */
.voice__dots {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: currentColor;
    opacity: 0.5;
}

.voice:disabled {
    opacity: 0.4;
}

@media (prefers-reduced-motion: no-preference) {
    .voice--on {
        animation: voice-pulse 1.2s ease-in-out infinite;
    }
    @keyframes voice-pulse {
        50% {
            opacity: 0.55;
        }
    }
}
</style>

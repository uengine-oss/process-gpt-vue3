<template>
    <UnifiedChatInput
        :showExamples="true"
        :disableChat="isUploading"
        @sendMessage="handleUnifiedSend"
        @recording-mode-change="handleRecordingModeChange"
    />
</template>

<script>
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';

export default {
    name: 'MainChatInput',
    components: {
        UnifiedChatInput
    },
    props: {
        agentInfo: {
            type: Object,
            default: null
        },
        userId: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            isUploading: false,
            recordingMode: false
        };
    },
    methods: {
        handleUnifiedSend(payload) {
            // 기존 인터페이스 유지: 부모는 @submit만 받음
            this.$emit('submit', payload);
        },
        // 음성 대화 모드 변경 처리
        handleRecordingModeChange(isRecording) {
            this.recordingMode = isRecording;
            this.$emit('recording-mode-change', isRecording);
        },
    }
};
</script>

<style scoped>
/* 스타일은 UnifiedChatInput.vue로 이동 */
</style>

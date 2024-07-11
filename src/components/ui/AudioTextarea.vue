<template>
    <div class="mb-4">
        <v-checkbox v-model="useTextAudio" label="자유롭게 결과 입력" hide-details density="compact"></v-checkbox>
        <v-textarea v-if="useTextAudio" v-model="newMessage" hide-details density="compact" rows="3" no-resize>
            <template v-slot:append-inner>
                <div class="d-flex align-self-end pb-3 cursor-pointer" @click="onClickMic">
                    <Icon v-if="!isMicRecording && !isMicRecorderLoading" icon="ic:sharp-mic" width="24" height="24" />
                    <Icon v-else-if="!isMicRecorderLoading" icon="fa-solid:stop" width="20" height="20" />
                    <Icon v-else-if="isMicRecorderLoading" icon="eos-icons:bubble-loading" width="24" height="24" />
                </div>
            </template>
        </v-textarea>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    props: {
        modelValue: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
            useTextAudio: false,
            newMessage: '',
            // audio recording
            isMicRecording: false,
            micRecorder: null,
            micAudioChunks: [],
            isMicRecorderLoading: false,
        }
    },
    watch: {
        modelValue(newVal) {
            this.newMessage = newVal;
        },
        newMessage(newVal) {
            this.$emit('update:modelValue', newVal);
        }
    },
    created() {
        this.newMessage = this.modelValue;
    },
    methods: {
        onClickMic() {
            if (this.isMicRecording) {
                this.stopVoiceRecording();
            } else {
                this.startVoiceRecording();
            }
        },
        async startVoiceRecording() {
            this.isMicRecording = true;

            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micRecorder = new MediaRecorder(stream);
            this.micAudioChunks = [];
            this.micRecorder.ondataavailable = e => {
                this.micAudioChunks.push(e.data);
            };
            this.micRecorder.start();
        },
        stopVoiceRecording() {
            this.isMicRecording = false;
            // MediaRecorder의 상태가 'recording'인 경우에만 stop 메서드를 호출
            if (this.micRecorder && this.micRecorder.state === 'recording') {
                this.micRecorder.stop();
                this.micRecorder.onstop = async () => {
                const audioBlob = new Blob(this.micAudioChunks, { type: 'audio/wav' });
                await this.uploadAudio(audioBlob);
                };
            }
        },
        async uploadAudio(audioBlob) {
            this.isMicRecorderLoading = true; // 로딩 상태 시작

            const formData = new FormData();
            formData.append('audio', audioBlob);

            try {
                const response = await axios.post(`/execution/upload`, formData);
                const data = response.data;
                this.newMessage = data.transcript;
            } catch (error) {
                console.error('Error:', error);
            } finally {
                this.isMicRecorderLoading = false; // 로딩 상태 종료
            }
        },
    }
}
</script>
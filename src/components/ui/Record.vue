<template>
    <div class="container">
        <v-btn class="record-close-btn" icon density="comfortable" @click="closeRecording">
            <v-icon>mdi-close</v-icon>
        </v-btn>
        <div class="circle" :style="{ width: circleSize + 'px', height: circleSize + 'px' }"></div>
        <div class="controls">
            <v-btn v-if="!isRecording" @click="toggleRecording" icon density="comfortable">
                <Icon icon='bi:mic-fill' width="24" height="24" />
            </v-btn>
            <v-btn v-else @click="stopRecording" icon density="comfortable">
                <Icon icon='fa-solid:stop' width="24" height="24" />
            </v-btn>
            <div class="bars">
                <div v-for="n in 4" :key="n" class="bar" :style="{ height: boxHeight(n) + 'px' }"></div>
            </div>
        </div>
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';

export default {
    components: {
        Icon
    },
    data() {
        return {
            audioContext: null,
            analyser: null,
            microphone: null,
            dataArray: null,
            volume: 0, // 데시벨 수치
            threshold: 15, // 임계값 설정
            isRecording: false, // 녹음 상태
            stream: null // 마이크 스트림
        };
    },
    methods: {
        async getMicrophoneInput() {
            if (!navigator.mediaDevices) {
                alert("브라우저가 마이크 입력을 지원하지 않습니다.");
                return;
            }
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.updateVolume();
        },
        updateVolume() {
            if (!this.isRecording) return;
            this.analyser.getByteFrequencyData(this.dataArray);
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            this.volume = sum / this.dataArray.length;
            requestAnimationFrame(this.updateVolume);
        },
        boxHeight(n) {
            if (this.volume < this.threshold) return 10; // 임계값 이하일 때 높이 고정
            return 10 + ((this.volume - this.threshold) / (100 - this.threshold)) * (n * 10); // 각 박스마다 높이가 다르게 조정
        },
        async toggleRecording() {
            if (this.isRecording) {
                this.isRecording = false;
            } else {
                this.isRecording = true;
                await this.getMicrophoneInput();
            }
            this.$emit('start');
        },
        stopRecording() {
            this.isRecording = false;
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            this.$emit('stop');
        },
        closeRecording() {
            this.stopRecording();
            this.$emit('close');
        }
    },
    computed: {
        circleSize() {
            if (this.volume < this.threshold) return 250; // 임계값 이하일 때 기본 크기
            return 250 + ((this.volume - this.threshold) / (100 - this.threshold)) * 20; // 원의 기본 크기 100px에 볼륨에 따라 크기 조정 (증가 폭을 줄임)
        }
    }
};
</script>


<style scoped>
@keyframes breathe {
  0%, 100% {
    transform: scale(0.97);  /* 기본 크기 */
    opacity: 1;  /* 약간 투명 */
  }
  50% {
    transform: scale(1);  /* 20% 더 크게 */
    opacity: 0.9;  /* 완전 불투명 */
  }
}
.record-close-btn {
    position:absolute;
    top:10px;
    right:10px;
}
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 155px); /* 화면 중앙 배치를 위해 추가 */
    background-color: black; /* 배경색 추가 */
}

.circle {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: white; /* 배경색 검은색으로 변경 */
    position: absolute;
    top:120px;
    animation: breathe 2s infinite ease-in-out;
}

.controls {
    display: flex;
    align-items: flex-end; /* 아이템들을 아래쪽 정렬 */
    gap: 20px; /* 버튼과 바 사이의 간격 설정 */
    position: absolute;
    bottom:30px;
}

.bars {
    display: flex;
    align-items: flex-end; /* 박스가 아래쪽을 기준으로 정렬되도록 설정 */
    gap: 5px; /* 각 bar 사이의 간격 설정 */
}

.bar {
    width: 10px;
    background-color: white; /* bar 배경색 검은색으로 변경 */
    margin: 0 0 10px 0; /* 각 bar의 margin 제거 */
    align-self: flex-end; /* 각 bar가 아래쪽 끝에서 시작하도록 설정 */
    border-radius: 10px;
}

@media only screen and (max-width: 1279px) {
    .record-close-btn {
        position:absolute;
        top:50px;
        right:10px;
    }
    .container {
        height: calc(100vh - 194px); /* 화면 중앙 배치를 위해 추가 */
    }
}
</style>

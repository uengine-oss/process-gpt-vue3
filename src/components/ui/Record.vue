<template>
    <div class="container">
        <v-btn class="record-close-btn" icon density="comfortable" @click="closeRecording">
            <v-icon>mdi-close</v-icon>
        </v-btn>
        <div v-if="isLoading" class="loading-circle">
            <div class="child-circle" v-for="n in 5" :key="n"></div>
        </div>
        <div v-else-if="isAudioPlaying" class="audio-bar-box">
            <div v-for="n in 4" :key="n" class="audio-bar" :class="'gpt-animation' + n"></div>
        </div>
        <div v-else class="circle" :style="{ width: circleSize + 'px', height: circleSize + 'px' }"></div>
        <AudioStream
            @update:isLoading="updateLoadingStatus"
            @audio:start="startAudio"
            @audio:stop="stopAudio"
            :audioResponse="audioResponse"
            :isLoading="isLoading"
        />
        <div class="controls">
            <v-btn v-if="!isRecording" @click="toggleRecording" icon density="comfortable">
                <Icon icon='bi:mic-fill' width="24" height="24" />
            </v-btn>
            <v-btn v-else @click="stopRecording" icon density="comfortable">
                <Icon icon='fa-solid:stop' width="24" height="24" />
            </v-btn>
            <div v-if="!isAudioPlaying" class="bars">
                <div v-for="n in 4" :key="n" class="bar" :style="{ height: boxHeight(n) + 'px' }"></div>
            </div>
        </div>
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';
import AudioStream from './AudioStream.vue';

export default {
    components: {
        Icon,
        AudioStream,
    },
    props: {
        audioResponse: String
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
            stream: null, // 마이크 스트림
            isLoading: false,
            isAudioPlaying: false, // 오디오 재생 상태
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
            if (this.volume < this.threshold) return 20;
            return 20 + ((this.volume - this.threshold) / (100 - this.threshold)) * (n * 10);
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
            this.updateLoadingStatus(true);
        },
        updateLoadingStatus(status) {
            this.isLoading = status;
        },
        closeRecording() {
            this.stopRecording();
            this.$emit('close');
        },
        startAudio() {
            this.isAudioPlaying = true;
        },
        stopAudio() {
            this.isAudioPlaying = false;
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
/* ===== GPT 답변 애니메이션 시작 */
@keyframes increaseHeight1 {
  0%, 100% {
    height: 50px;
  }
  50% {
    height: 100px;
  }
}

@keyframes increaseHeight2 {
  0%, 100% {
    height: 40px;
  }
  50% {
    height: 140px;
  }
}

@keyframes increaseHeight3 {
  0%, 100% {
    height: 50px;
  }
  50% {
    height: 120px;
  }
}

@keyframes increaseHeight4 {
  0%, 100% {
    height: 50px;
  }
  50% {
    height: 110px;
  }
}

.audio-bar-box {
    display: flex;
    align-items: flex-end;
    gap: 5px;
}

.audio-bar {
    width: 50px;
    background-color: white;
    margin: 0 0 10px 0;
    align-self: flex-end;
    border-radius: 30px;
}

.gpt-animation1 {
    animation: increaseHeight1 1.65s infinite ease-in-out;
}

.gpt-animation2 {
    animation: increaseHeight2 1.8s infinite ease-in-out;
}

.gpt-animation3 {
    animation: increaseHeight3 1.2s infinite ease-in-out;
}

.gpt-animation4 {
    animation: increaseHeight4 1.5s infinite ease-in-out;
}


/* ===== GPT 답변 애니메이션 끝 */


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

@keyframes rotate {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

@keyframes move-position {
    0%, 100% {
        top: 120px;
    }
    25% {
        top: 110px;
    }
    50% {
        top: 130px;
    }
    75% {
        top: 110px;
    }
}

@keyframes move-child {
    0%, 100% {
        top: 0px;
        left: 30px;
    }
    50% {
        top: 60px;
        left: 120px;
    }
}

.loading-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: white;
    width: 235px;
    height: 235px;
    position: absolute;
    top: 120px;
    animation: rotate 8s infinite linear, move-position 4s infinite ease-in-out;
}

.child-circle {
  position: absolute;
  width: 155px;
  height: 155px;
  background-color: white;
  border-radius: 50%;
}

.child-circle:nth-child(1) {
  transform: rotate(0deg) translate(68px) rotate(0deg);
}

.child-circle:nth-child(2) {
  transform: rotate(72deg) translate(70px) rotate(-72deg);
}

.child-circle:nth-child(3) {
  transform: rotate(144deg) translate(65px) rotate(-144deg);
}

.child-circle:nth-child(4) {
  transform: rotate(216deg) translate(75px) rotate(-216deg);
}

.child-circle:nth-child(5) {
  transform: rotate(288deg) translate(72px) rotate(-288deg);
}


/* =============== */
.record-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 155px);
  background-color: black;
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
  align-items: flex-end;
  gap: 20px;
  position: absolute;
  bottom: 30px;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 5px;
}

.bar {
  width: 20px;
  background-color: white;
  margin: 0 0 10px 0;
  align-self: flex-end;
  border-radius: 10px;
}

@media only screen and (max-width: 1279px) {
  .record-close-btn {
    position: absolute;
    top: 50px;
    right: 10px;
  }
  .container {
    height: calc(100vh - 194px);
  }
}
</style>
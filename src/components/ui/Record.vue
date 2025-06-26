<template>
    <v-dialog v-model="recordingMode" fullscreen>
        <div class="container" :style="containerStyle">
            <v-btn class="record-close-btn" icon density="comfortable" @click="closeRecording"
                :style="!$globalState.state.isRightZoomed ? '' : 'top:10px; z-index: 9999;'"
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
            
            <!-- <div v-if="isLoading" class="loading-circle">
                <div class="child-circle" v-for="n in 5" :key="n"></div>
            </div>
            <div v-else-if="isAudioPlaying" class="audio-bar-box">
                <div v-for="n in 4" :key="n" class="audio-bar" :style="{ height: AudioPlayingBarHeight(n) + 'px' }"></div>
            </div>
            <div v-else class="circle" :style="{ width: circleSize + 'px', height: circleSize + 'px' }"></div> -->
            
            <PaintWaveAnimation 
                :size="circleSize" 
                :isActive="isLoading"
                :isAudioPlaying="isAudioPlaying"
                :audioBars="audioBars"
                :volume="volume"
                :threshold="threshold"
            />
            
            <AudioStream
                @update:isLoading="updateLoadingStatus"
                @audio:start="startAudio"
                @audio:stop="stopAudio"
                @update:audioBars="updateAudioBars"
                :audioResponse="audioResponse"
                :isLoading="isLoading"
                :stopAudioStreamStatus="stopAudioStreamStatus"
                :chatRoomId="chatRoomId"
            />
            <div v-if="!isAudioPlaying && !isLoading" class="chatgpt-waveform">
                <canvas ref="waveformCanvas" :width="canvasWidth" :height="canvasHeight"></canvas>
            </div>
            <div v-else-if="isLoading" class="chatgpt-waveform">
                <div style="color: white;">서버로부터 응답을 기다리는 중입니다
                    <span class="loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                    </span>
                </div>
            </div>
            <div class="controls">
                <v-btn v-if="!isRecording && !isAudioPlaying && !isLoading" @click="toggleRecording()" icon density="comfortable">
                    <Icons :icon="'sharp-mic'"  />
                </v-btn>
                <v-btn v-else-if="!sendRecordingStatus" @click="sendRecording()" icon density="comfortable">
                    <Icons :icon="'stop'"  />
                </v-btn>
                <v-btn v-else @click="stopAudioStream()" icon density="comfortable">
                    <Icons :icon="'stop'"  />
                </v-btn>
            </div>
        </div>
    </v-dialog>
</template>

<script>
import { Icon } from '@iconify/vue';
import AudioStream from './AudioStream.vue';
import { getPrimary } from '@/utils/UpdateColors';
import PaintWaveAnimation from './PaintWaveAnimation.vue';


export default {
    components: {
        Icon,
        AudioStream,
        PaintWaveAnimation,
    },
    props: {
        recordingMode: Boolean,
        audioResponse: String,
        chatRoomId: String
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
            stopAudioStreamStatus: false,
            sendRecordingStatus: false,
            audioBars: [],
            canvasWidth: Math.floor(window.innerWidth * 0.96), // 96vw 적용
            canvasHeight: 100,
            waveformData: [], // 파형 데이터 저장
            animationId: null,
            scrollPosition: 0, // 스크롤 위치
            lastUpdateTime: 0, // 마지막 업데이트 시간
        };
    },
    methods: {
        updateAudioBars(dataArray) {
            this.audioBars = dataArray;
        },
        AudioPlayingBarHeight(index) {
            if (this.audioBars.length === 0) return 30; // 기본 높이
            const baseHeight = 30; // 기본 높이
            const maxHeight = 60 + (index * 30); // 각 바의 최대 높이 설정 (60, 90, 120, 150)
            const volume = this.audioBars[index] || 0;
            const normalizedVolume = Math.min(volume / 255, 1); // 볼륨을 0과 1 사이로 정규화
            return baseHeight + ((maxHeight - baseHeight) * normalizedVolume);
        },
        stopAudioStream() {
            this.stopAudioStreamStatus = true
            this.sendRecordingStatus = false
        },
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
            
            // 파형 데이터 추가 (음성이 있을 때만 진폭 생성)
            const amplitude = this.volume > this.threshold 
                ? (this.volume - this.threshold) / (100 - this.threshold) * 25
                : 0;
            this.waveformData.push(amplitude);
            
            // 배열 크기 제한
            if (this.waveformData.length > this.canvasWidth * 2) {
                this.waveformData.shift();
            }
            
            requestAnimationFrame(this.updateVolume);
        },
        boxHeight(n) {
            if (this.volume < this.threshold) return 20;
            return 20 + ((this.volume - this.threshold) / (100 - this.threshold)) * (n * 10);
        },
        async toggleRecording() {
            if (this.isRecording) {
                this.isRecording = false;
                this.stopWaveformAnimation();
            } else {
                this.isRecording = true;
                await this.getMicrophoneInput();
                this.startWaveformAnimation();
            }
            this.$emit('start');
        },
        sendRecording() {
            this.isRecording = false;
            this.stopAudioStreamStatus = false;
            this.sendRecordingStatus = true;
            this.stopWaveformAnimation();
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
            this.$emit('close');
            this.EventBus.emit('instances-updated');
        },
        startAudio() {
            this.isAudioPlaying = true;
        },
        stopAudio() {
            this.isAudioPlaying = false;
            this.isRecording = false;
            this.isLoading = false;
            this.stopAudioStreamStatus = false;
            this.sendRecordingStatus = false
        },
        drawWaveform() {
            const canvas = this.$refs.waveformCanvas;
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const centerY = this.canvasHeight / 2;
            const waveSpacing = 4; // 각 파형 간격 (픽셀)
            
            // 캔버스 클리어
            ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            
            // 매우 천천히 스크롤 (매 프레임마다 아주 작은 값으로 증가)
            this.scrollPosition += 0.02;
            
            // 파형 데이터가 없어도 기본 점선이 지나가도록 최소 데이터 생성
            const displayData = [];
            const totalPoints = Math.floor(this.canvasWidth / waveSpacing) + 10; // 여유분 추가
            
            // 기존 파형 데이터 복사
            for (let i = 0; i < this.waveformData.length; i++) {
                displayData.push(this.waveformData[i]);
            }
            
            // 부족한 부분은 0으로 채워서 점선이 계속 지나가도록
            while (displayData.length < totalPoints) {
                displayData.push(0);
            }
            
            // 파형 그리기 (점선 + 실선)
            for (let i = 0; i < displayData.length; i++) {
                const x = this.canvasWidth - (displayData.length - i) * waveSpacing - (this.scrollPosition % waveSpacing) + waveSpacing * 5;
                const amplitude = displayData[i];
                
                if (x >= -waveSpacing && x <= this.canvasWidth + waveSpacing) {
                    if (amplitude > 0) {
                        // 음성이 있는 부분: 실선 파형
                        ctx.strokeStyle = 'rgb(255, 255, 255)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([]);
                        const yTop = centerY - amplitude;
                        const yBottom = centerY + amplitude;
                        ctx.beginPath();
                        ctx.moveTo(x, yTop);
                        ctx.lineTo(x, yBottom);
                        ctx.stroke();
                    } else {
                        // 음성이 없는 부분: 점선
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([2, 2]);
                        ctx.beginPath();
                        ctx.moveTo(x, centerY - 1);
                        ctx.lineTo(x, centerY + 1);
                        ctx.stroke();
                    }
                }
            }
            
            // 애니메이션 계속
            this.animationId = requestAnimationFrame(this.drawWaveform);
        },
        
        startWaveformAnimation() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            this.drawWaveform();
        },
        
        stopWaveformAnimation() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        },
    },
    computed: {
        circleSize() {
            if (this.volume < this.threshold) return 250; // 임계값 이하일 때 기본 크기
            return 250 + ((this.volume - this.threshold) / (100 - this.threshold)) * 20; // 원의 기본 크기 100px에 볼륨에 따라 크기 조정 (증가 폭을 줄임)
        },
        containerStyle() {
            return {
                backgroundColor: getPrimary.value,
                height: '100vh'
            };
        }
    }
};
</script>


<style scoped>
/* ===== GPT 답변 애니메이션 시작 */
@keyframes increaseHeight1 {
  0%, 100% {
    height: 30px;
  }
  50% {
    height: 60px;
  }
}

@keyframes increaseHeight2 {
  0%, 100% {
    height: 30px;
  }
  50% {
    height: 80px;
  }
}

@keyframes increaseHeight3 {
  0%, 100% {
    height: 30px;
  }
  50% {
    height: 100px;
  }
}

@keyframes increaseHeight4 {
  0%, 100% {
    height: 30px;
  }
  50% {
    height: 120px;
  }
}

.audio-bar-box {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    position: relative; /* 상대 위치 설정 */
    height: 100px; /* 최대 높이 설정 */
    top: -160px;
}

.audio-bar {
    width: 50px;
    background-color: white;
    margin: 0 0 10px 0;
    border-radius: 50px;
    transform-origin: bottom; /* 변환의 기준점을 하단으로 설정 */
}

.gpt-animation1 {
    animation: increaseHeight1 0.7s infinite ease-in-out;
}

.gpt-animation2 {
    animation: increaseHeight2 0.7s infinite ease-in-out;
}

.gpt-animation3 {
    animation: increaseHeight3 0.7s infinite ease-in-out;
}

.gpt-animation4 {
    animation: increaseHeight4 0.7s infinite ease-in-out;
}


/* ===== GPT 답변 애니메이션 끝 */


@keyframes breathe {
    0%, 100% {
        transform: scale(0.97);  /* 기본 크기 */
        opacity: 1;  /* 약간 투명 */
    }
    50% {
        transform: scale(1.1);  /* 20% 더 크게 */
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
    max-width: 100% !important;
}

.circle {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: white;
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
    top: 50px !important;
    right: 30px;
  }
  .container {
    height: calc(100vh - 194px);
  }
}

@media only screen and (max-width: 700px) {
  .record-close-btn {
    position: absolute;
    top: 10px !important;
    right:10px;
  }
  .container {
    height: calc(100vh - 194px);
  }
}

.chatgpt-waveform {
    position: absolute;
    bottom: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96vw;
    height: 100px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 20px;
    padding: 10px;
}

.chatgpt-waveform canvas {
    border-radius: 10px;
}

.loading-dots span {
    animation: loading-dot 2s infinite;
    animation-fill-mode: both;
    opacity: 0;
}

.loading-dots span:nth-child(1) {
    animation-delay: 0s;
}

.loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

.loading-dots span:nth-child(4) {
    animation-delay: 0.6s;
}

.loading-dots span:nth-child(5) {
    animation-delay: 0.8s;
}

@keyframes loading-dot {
    0% {
        opacity: 0;
        transform: scale(0);
    }
    5% {
        opacity: 1;
        transform: scale(1);
    }
    65% {
        opacity: 1;
        transform: scale(1);
    }
    70%, 100% {
        opacity: 0;
        transform: scale(0);
    }
}
</style>
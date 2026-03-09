<template>
    <div></div>
</template>

<script>
const BUFFER_SIZE = 4800;

class Player {
    constructor() {
        this.playbackNode = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.onAudioData = null;
        this.onPlaybackComplete = null;
        this.lastAudioTime = 0;
        this.silenceCheckInterval = null;
    }
    async init(sampleRate, onAudioData = null, onPlaybackComplete = null) {
        this.audioContext = new AudioContext({ sampleRate });
        await this.audioContext.audioWorklet.addModule('/static/audio-playback-worklet.js');
        this.playbackNode = new AudioWorkletNode(this.audioContext, 'audio-playback-worklet');

        // AI 오디오 주파수 데이터 추출용 analyser 설정
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.onAudioData = onAudioData;
        this.onPlaybackComplete = onPlaybackComplete;

        // playbackNode를 analyser와 destination에 연결
        this.playbackNode.connect(this.analyser);
        this.playbackNode.connect(this.audioContext.destination);

        // AI 오디오 주파수 데이터 추출 시작
        if (this.onAudioData) {
            this.startAudioAnalysis();
        }

        // 오디오 재생 완료 감지 시작
        this.startPlaybackMonitoring();
    }
    startAudioAnalysis() {
        const updateAudioData = () => {
            if (this.analyser && this.onAudioData) {
                this.analyser.getByteFrequencyData(this.dataArray);
                this.onAudioData(Array.from(this.dataArray));
                requestAnimationFrame(updateAudioData);
            }
        };
        updateAudioData();
    }
    startPlaybackMonitoring() {
        // 오디오 재생 완료 감지 (2초 침묵)
        this.silenceCheckInterval = setInterval(() => {
            if (this.analyser) {
                this.analyser.getByteFrequencyData(this.dataArray);
                const volume = Array.from(this.dataArray).reduce((a, b) => a + b, 0) / this.dataArray.length;

                if (volume > 3) {
                    this.lastAudioTime = Date.now();
                } else if (this.lastAudioTime > 0 && Date.now() - this.lastAudioTime > 2000) {
                    // 2초 침묵 감지 시 실제 재생 완료
                    console.log('🎯 실제 오디오 재생 완료 감지');
                    if (this.onPlaybackComplete) {
                        this.onPlaybackComplete();
                        this.lastAudioTime = 0;
                    }
                }
            }
        }, 100);
    }
    play(buffer) {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(buffer);
            this.lastAudioTime = Date.now();
        }
    }
    stop() {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(null);
        }
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }
        this.lastAudioTime = 0;
    }
}

class Recorder {
    constructor(onDataAvailable) {
        this.onDataAvailable = onDataAvailable;
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaStreamSource = null;
        this.workletNode = null;
    }
    async start(stream) {
        try {
            if (this.audioContext) {
                await this.audioContext.close();
            }
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await this.audioContext.audioWorklet.addModule('/static/audio-processor-worklet.js');
            this.mediaStream = stream;
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet');
            this.workletNode.port.onmessage = (event) => {
                this.onDataAvailable(event.data.buffer);
            };
            this.mediaStreamSource.connect(this.workletNode);
        } catch (error) {
            this.stop();
        }
    }
    async stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        this.mediaStreamSource = null;
        this.workletNode = null;
    }
}

export default {
    props: {
        chatRoomId: String,
        startAudioStream: Boolean,
        stopAudioStreamStatus: Boolean
    },
    data() {
        return {
            ws: null,
            audioPlayer: null,
            audioRecorder: null,
            buffer: new Uint8Array(),
            userEmail: '',
            isAudioOn: false,
            analyser: null,
            dataArray: null,
            analyserAnimationId: null,
            isUserSpeaking: false,
            isAiPlaying: false,
            hasAudioData: false
        };
    },
    watch: {
        startAudioStream(newVal) {
            if (newVal && !this.isAudioOn) {
                this.startAudio();
            }
        },
        stopAudioStreamStatus(newVal) {
            if (newVal) {
                this.stopAudio();
            }
        }
    },
    beforeUnmount() {
        this.stopAudio();
    },
    methods: {
        async startAudio() {
            try {
                let url = null;
                if (window.location.href.includes('https://')) {
                    url = `wss://${window.location.host}/voice/ws`;
                } else {
                    url = `ws://${window.location.host}/voice/ws`;
                }
                this.ws = new WebSocket(url);
                this.userEmail = localStorage.getItem('email');

                this.ws.onopen = () => {
                    this.ws.send(
                        JSON.stringify({
                            type: 'user_info',
                            email: this.userEmail,
                            chat_room_id: this.chatRoomId,
                            tenant_id: window.$tenantName
                        })
                    );
                };

                this.ws.onclose = () => {
                    // WebSocket 끊어져도 오디오가 계속 재생되므로 애니메이션 유지
                    // 실제 오디오 재생 완료는 Player의 모니터링으로 감지
                };

                this.ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log('📨 수신 이벤트:', data.type);

                    if (data?.type === 'response.audio.delta') {
                        this.hasAudioData = true;
                        if (!this.isAiPlaying) {
                            console.log('🎬 AI 오디오 시작');
                            this.isAiPlaying = true;
                            this.$emit('ai-audio:start');
                        }

                        const binary = atob(data.delta);
                        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
                        const pcmData = new Int16Array(bytes.buffer);
                        this.audioPlayer.play(pcmData);
                    } else if (data?.type === 'response.audio.done') {
                        console.log('📡 백엔드: 오디오 스트리밍 완료 (실제 재생 대기중)');
                        // 즉시 완료 처리하지 않음! Player의 침묵 감지에서 처리
                    } else if (data?.type === 'response.done') {
                        if (this.hasAudioData) {
                            console.log('📝 오디오 있음 - response.done 무시 (Player 감지 대기)');
                            // 즉시 완료 처리하지 않음! Player의 침묵 감지에서 처리
                        } else {
                            console.log('📝 텍스트 전용 응답 완료');
                            this.isAiPlaying = false;
                            this.$emit('ai-audio:stop');
                        }
                    }
                };

                // Player 초기화
                this.audioPlayer = new Player();
                await this.audioPlayer.init(
                    24000,
                    (audioData) => {
                        // AI 오디오 주파수 데이터 처리
                        this.handleAiAudioData(audioData);
                    },
                    () => {
                        // 실제 오디오 재생 완료 콜백
                        this.handleActualAudioComplete();
                    }
                );
                const appendToBuffer = (newData) => {
                    const newBuffer = new Uint8Array(this.buffer.length + newData.length);
                    newBuffer.set(this.buffer);
                    newBuffer.set(newData, this.buffer.length);
                    this.buffer = newBuffer;
                };
                const handleAudioData = (data) => {
                    // AI 재생 중이면 마이크 데이터 전송 완전 차단
                    if (this.isAiPlaying) {
                        return;
                    }

                    const uint8Array = new Uint8Array(data);
                    appendToBuffer(uint8Array);
                    if (this.buffer.length >= BUFFER_SIZE) {
                        const toSend = new Uint8Array(this.buffer.slice(0, BUFFER_SIZE));
                        this.buffer = new Uint8Array(this.buffer.slice(BUFFER_SIZE));
                        const regularArray = String.fromCharCode(...toSend);
                        const base64 = btoa(regularArray);
                        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                            this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }));
                        }
                    }
                };
                this.audioRecorder = new Recorder(handleAudioData);
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                await this.audioRecorder.start(stream);
                this.isAudioOn = true; // setupAnalyser 호출 전에 true로 설정
                this.setupAnalyser(this.audioRecorder.audioContext, this.audioRecorder.mediaStreamSource);
                this.$emit('audio:start');
            } catch (error) {
                this.isAudioOn = false;
            }
        },

        // 🔥 새로운 메서드 추가
        handleAudioComplete() {
            this.isAiPlaying = false;
            this.hasAudioData = false;
            this.$emit('ai-audio:stop');

            // 백엔드에 완료 신호 전송
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(
                    JSON.stringify({
                        type: 'client_audio_playback_complete'
                    })
                );
                console.log('📤 백엔드에 오디오 완료 신호 전송');
            }
        },

        setupAnalyser(audioContext, sourceNode) {
            this.analyser = audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            sourceNode.connect(this.analyser);
            this.updateAudioBars();
        },
        updateAudioBars() {
            if (!this.isAudioOn) return;

            // AI 재생 중이 아닐 때만 사용자 마이크 모니터링
            if (this.analyser && !this.isAiPlaying) {
                this.analyser.getByteFrequencyData(this.dataArray);
                const audioData = Array.from(this.dataArray);
                this.$emit('update:audioBars', audioData);
            }

            this.analyserAnimationId = requestAnimationFrame(this.updateAudioBars);
        },
        handleAiAudioData(audioData) {
            if (this.isAiPlaying) {
                this.$emit('update:audioBars', audioData);
            }
        },
        handleActualAudioComplete() {
            console.log('🎯 실제 오디오 재생 완료 - 상태 변경');
            this.isAiPlaying = false;
            this.hasAudioData = false;
            this.$emit('ai-audio:stop');

            // 백엔드에 완료 신호 전송
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(
                    JSON.stringify({
                        type: 'client_audio_playback_complete'
                    })
                );
                console.log('📤 백엔드에 실제 재생 완료 신호 전송');
            }
        },
        handleAudioPlaybackComplete() {
            // 이제 사용하지 않음 - handleActualAudioComplete 사용
        },
        stopAudio() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            if (this.audioPlayer) {
                this.audioPlayer.stop();
                this.audioPlayer = null;
            }
            if (this.audioRecorder) {
                this.audioRecorder.stop();
                this.audioRecorder = null;
            }
            if (this.analyserAnimationId) {
                cancelAnimationFrame(this.analyserAnimationId);
                this.analyserAnimationId = null;
            }

            this.analyser = null;
            this.dataArray = null;
            this.buffer = new Uint8Array();
            this.isAudioOn = false;
            this.isUserSpeaking = false;
            this.isAiPlaying = false;
            this.hasAudioData = false; // 상태 리셋
            this.$emit('audio:stop');
        }
    }
};
</script>

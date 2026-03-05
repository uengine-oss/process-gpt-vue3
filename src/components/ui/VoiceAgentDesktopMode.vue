<template>
    <!-- 헤드리스 컴포넌트: WebSocket + 마이크 + 오디오 재생 관리, UI는 부모가 처리 -->
    <div></div>
</template>

<script>
const BUFFER_SIZE = 4800;

// ── AI 응답 오디오 재생 (AudioStream.vue의 Player와 동일) ──────────────────────
class DesktopPlayer {
    constructor() {
        this.playbackNode = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.onPlaybackComplete = null;
        this.lastAudioTime = 0;
        this.silenceCheckInterval = null;
    }

    async init(sampleRate, onPlaybackComplete = null) {
        this.audioContext = new AudioContext({ sampleRate });
        await this.audioContext.audioWorklet.addModule('/static/audio-playback-worklet.js');
        this.playbackNode = new AudioWorkletNode(this.audioContext, 'audio-playback-worklet');

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.onPlaybackComplete = onPlaybackComplete;

        this.playbackNode.connect(this.analyser);
        this.playbackNode.connect(this.audioContext.destination);
        this._startSilenceMonitoring();
    }

    _startSilenceMonitoring() {
        this.silenceCheckInterval = setInterval(() => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(this.dataArray);
            const volume =
                Array.from(this.dataArray).reduce((a, b) => a + b, 0) / this.dataArray.length;
            if (volume > 3) {
                this.lastAudioTime = Date.now();
            } else if (this.lastAudioTime > 0 && Date.now() - this.lastAudioTime > 2000) {
                if (this.onPlaybackComplete) {
                    this.onPlaybackComplete();
                    this.lastAudioTime = 0;
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

    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.playbackNode = null;
        this.analyser = null;
        this.dataArray = null;
    }
}

// ── 마이크 녹음 (AudioStream.vue의 Recorder와 동일) ──────────────────────────
class DesktopRecorder {
    constructor(onDataAvailable) {
        this.onDataAvailable = onDataAvailable;
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaStreamSource = null;
        this.workletNode = null;
    }

    async start(stream) {
        if (this.audioContext) await this.audioContext.close();
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000,
        });
        await this.audioContext.audioWorklet.addModule('/static/audio-processor-worklet.js');
        this.mediaStream = stream;
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet');
        this.workletNode.port.onmessage = (e) => this.onDataAvailable(e.data.buffer);
        this.mediaStreamSource.connect(this.workletNode);
    }

    async stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
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

// ─────────────────────────────────────────────────────────────────────────────

export default {
    name: 'VoiceAgentDesktopMode',
    props: {
        active: {
            type: Boolean,
            default: false,
        },
        chatRoomId: {
            type: String,
            default: '',
        },
        agentInfo: {
            type: Object,
            default: null,
        },
        conversationHistory: {
            type: Array,
            default: () => [],
        },
    },
    emits: [
        'user-transcript',      // 사용자가 말한 텍스트 (완성)
        'ai-transcript-delta',  // AI 응답 텍스트 스트리밍 청크
        'ai-transcript-done',   // AI 응답 텍스트 완성
        'started',              // 연결 및 마이크 시작됨
        'stopped',              // 연결 종료됨
        'speaking-start',       // 사용자 발화 시작
        'speaking-stop',        // 사용자 발화 종료
        'ai-audio-start',       // AI 오디오 재생 시작
        'ai-audio-stop',        // AI 오디오 재생 종료
        'ai-interrupted',       // 사용자 발화로 AI 응답 인터럽트됨
        'error',                // 에러 발생
    ],
    data() {
        return {
            ws: null,
            audioRecorder: null,
            audioPlayer: null,
            buffer: new Uint8Array(),
            isConnected: false,
            _didStart: false,     // start() 끝까지 성공했는지 여부
            isAiPlaying: false,   // AI 오디오 재생 중이면 마이크 전송 차단
            hasAudioData: false,  // 이번 응답에 오디오 델타가 있었는지
            currentAiTranscript: '',
        };
    },
    watch: {
        active(val) {
            if (val) this.start();
            else this.stop();
        },
    },
    beforeUnmount() {
        this.stop();
    },
    methods: {
        async start() {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const url = `${protocol}//${window.location.host}/voice/ws`;

                this.ws = new WebSocket(url);
                const email = localStorage.getItem('email') || '';

                this.ws.onopen = () => {
                    this.ws.send(
                        JSON.stringify({
                            type: 'user_info',
                            email,
                            chat_room_id: this.chatRoomId,
                            tenant_id: window.$tenantName || '',
                            agent_info: this.agentInfo || null,
                            conversation_history: this.conversationHistory || [],
                        })
                    );
                    this.isConnected = true;
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleServerEvent(data);
                    } catch (e) { /* ignore parse errors */ }
                };

                this.ws.onclose = () => {
                    const wasStarted = this._didStart;
                    this.isConnected = false;
                    if (!wasStarted) {
                        // start()가 완료되기 전에 닫힘 = 서버 연결 실패
                        this.$emit('error', new Error('음성 서버에 연결할 수 없습니다'));
                    } else {
                        this.$emit('stopped');
                    }
                };

                this.ws.onerror = () => {
                    // onerror 뒤에 onclose도 반드시 호출되므로 여기서는 별도 처리 없음
                };

                // 오디오 플레이어 초기화
                this.audioPlayer = new DesktopPlayer();
                await this.audioPlayer.init(24000, () => {
                    // 침묵 감지 → 실제 재생 완료
                    this._onActualPlaybackComplete();
                });

                // 마이크 시작 — 에코 캔슬레이션/노이즈 억제를 명시적으로 활성화해
                // AI 스피커 출력이 마이크로 피드백되는 것을 브라우저 레벨에서 차단한다.
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                this.audioRecorder = new DesktopRecorder((rawData) => {
                    this.handleMicData(rawData);
                });
                await this.audioRecorder.start(stream);

                // 오디오 설정이 완료되기 전에 WebSocket 연결이 실패했을 수 있으므로
                // WS 상태를 재확인한다. 연결이 이미 닫혔으면 조용히 종료한다.
                if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
                    this.stop();
                    return;
                }

                this._didStart = true;
                this.$emit('started');
            } catch (err) {
                console.error('[VoiceDesktop] start error:', err);
                this.$emit('error', err);
                this.stop();
            }
        },

        handleMicData(rawData) {
            // AI 재생 중에도 마이크 데이터를 전송해야 OpenAI VAD가 인터럽트를 감지할 수 있다.
            // 에코/하울링 방지는 getUserMedia의 echoCancellation 옵션으로 처리한다.
            const uint8 = new Uint8Array(rawData);
            const newBuf = new Uint8Array(this.buffer.length + uint8.length);
            newBuf.set(this.buffer);
            newBuf.set(uint8, this.buffer.length);
            this.buffer = newBuf;

            if (this.buffer.length >= BUFFER_SIZE) {
                const toSend = new Uint8Array(this.buffer.slice(0, BUFFER_SIZE));
                this.buffer = new Uint8Array(this.buffer.slice(BUFFER_SIZE));
                const chars = String.fromCharCode(...toSend);
                const base64 = btoa(chars);
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(
                        JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
                    );
                }
            }
        },

        handleServerEvent(data) {
            const t = data.type;

            // ── VAD 이벤트 ──────────────────────────
            if (t === 'input_audio_buffer.speech_started') {
                // 인터럽트: AI 오디오 재생 중이면 즉시 중단
                if (this.isAiPlaying) {
                    this._interruptAiPlayback();
                }
                this.$emit('speaking-start');

            } else if (t === 'input_audio_buffer.speech_stopped') {
                this.$emit('speaking-stop');

            // ── AI 오디오 재생 ───────────────────────
            } else if (t === 'response.audio.delta') {
                this.hasAudioData = true;
                if (!this.isAiPlaying) {
                    this.isAiPlaying = true;
                    this.$emit('ai-audio-start');
                }
                const binary = atob(data.delta);
                const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
                const pcmData = new Int16Array(bytes.buffer);
                this.audioPlayer?.play(pcmData);

            } else if (t === 'response.audio.done') {
                // 스트리밍 완료 — 실제 재생 완료는 침묵 감지로 처리

            } else if (t === 'response.done') {
                if (!this.hasAudioData) {
                    // 오디오 없는 텍스트 전용 응답
                    this.isAiPlaying = false;
                    this.$emit('ai-audio-stop');
                }

            // ── 텍스트 트랜스크립트 ──────────────────
            } else if (t === 'response.audio_transcript.delta') {
                const delta = data.delta || '';
                this.currentAiTranscript += delta;
                this.$emit('ai-transcript-delta', delta);

            } else if (t === 'response.audio_transcript.done') {
                const finalText = data.transcript || this.currentAiTranscript;
                this.$emit('ai-transcript-done', finalText);
                this.currentAiTranscript = '';

            } else if (t === 'conversation.item.input_audio_transcription.completed') {
                const transcript = (data.transcript || '').trim();
                if (transcript) {
                    this.$emit('user-transcript', transcript);
                }
            }
        },

        _onActualPlaybackComplete() {
            this.isAiPlaying = false;
            this.hasAudioData = false;
            this.$emit('ai-audio-stop');

            // 백엔드에 재생 완료 신호 전송 (턴 관리용)
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'client_audio_playback_complete' }));
            }
        },

        // 사용자 발화로 AI 오디오를 즉시 중단 (인터럽트)
        _interruptAiPlayback() {
            this.audioPlayer?.stop();
            this.isAiPlaying = false;
            this.hasAudioData = false;
            this.currentAiTranscript = '';
            this.$emit('ai-audio-stop');
            this.$emit('ai-interrupted');
            // 백엔드에 재생 완료 신호 전송 (턴 관리용 — 서버가 이미 cancel했지만 상태 동기화)
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'client_audio_playback_complete' }));
            }
        },

        stop() {
            if (this.ws) {
                try { this.ws.close(); } catch (e) {}
                this.ws = null;
            }
            if (this.audioPlayer) {
                this.audioPlayer.destroy();
                this.audioPlayer = null;
            }
            if (this.audioRecorder) {
                this.audioRecorder.stop();
                this.audioRecorder = null;
            }
            this.buffer = new Uint8Array();
            this.isConnected = false;
            this._didStart = false;
            this.isAiPlaying = false;
            this.hasAudioData = false;
            this.currentAiTranscript = '';
        },
    },
};
</script>

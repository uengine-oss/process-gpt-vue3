<template>
    <div></div>
</template>

<script>
const BUFFER_SIZE = 4800;

class Player {
    constructor() {
        this.playbackNode = null;
    }
    async init(sampleRate) {
        const audioContext = new AudioContext({ sampleRate });
        await audioContext.audioWorklet.addModule("/static/audio-playback-worklet.js");
        this.playbackNode = new AudioWorkletNode(audioContext, "audio-playback-worklet");
        this.playbackNode.connect(audioContext.destination);
    }
    play(buffer) {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(buffer);
        }
    }
    stop() {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(null);
        }
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
            await this.audioContext.audioWorklet.addModule("/static/audio-processor-worklet.js");
            this.mediaStream = stream;
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.workletNode = new AudioWorkletNode(this.audioContext, "audio-processor-worklet");
            this.workletNode.port.onmessage = event => {
                this.onDataAvailable(event.data.buffer);
            };
            this.mediaStreamSource.connect(this.workletNode);
        } catch (error) {
            this.stop();
        }
    }
    async stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
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
        }
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
                if (window.location.href.includes("https://")){
                    url = `wss://${window.location.host}/ws`
                } else if(window.location.href.includes("localhost")){
                    url = `ws://localhost:3000/ws`
                } else {
                    url = `ws://${window.location.host}/ws`
                }
                console.log(url);
                this.ws = new WebSocket(url);
                this.userEmail = localStorage.getItem('email');
                this.ws.onopen = () => {
                    this.ws.send(JSON.stringify({
                        type: 'user_info',
                        email: this.userEmail,
                        chat_room_id: this.chatRoomId,
                        tenant_id: window.$tenantName
                    }));
                };
                this.audioPlayer = new Player();
                await this.audioPlayer.init(24000);
                this.ws.onmessage = event => {
                    const data = JSON.parse(event.data);
                    if (data?.type !== 'response.audio.delta') return;
                    const binary = atob(data.delta);
                    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                    const pcmData = new Int16Array(bytes.buffer);
                    this.audioPlayer.play(pcmData);
                };
                const appendToBuffer = (newData) => {
                    const newBuffer = new Uint8Array(this.buffer.length + newData.length);
                    newBuffer.set(this.buffer);
                    newBuffer.set(newData, this.buffer.length);
                    this.buffer = newBuffer;
                };
                const handleAudioData = (data) => {
                    const uint8Array = new Uint8Array(data);
                    appendToBuffer(uint8Array);
                    if (this.buffer.length >= BUFFER_SIZE) {
                        const toSend = new Uint8Array(this.buffer.slice(0, BUFFER_SIZE));
                        this.buffer = new Uint8Array(this.buffer.slice(BUFFER_SIZE));
                        const regularArray = String.fromCharCode(...toSend);
                        const base64 = btoa(regularArray);
                        this.ws.send(JSON.stringify({type: 'input_audio_buffer.append', audio: base64}));
                    }
                };
                this.audioRecorder = new Recorder(handleAudioData);
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                await this.audioRecorder.start(stream);
                this.setupAnalyser(this.audioRecorder.audioContext, this.audioRecorder.mediaStreamSource);
                this.isAudioOn = true;
                this.$emit('audio:start');
            } catch (error) {
                this.isAudioOn = false;
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
            if (this.analyser) {
                this.analyser.getByteFrequencyData(this.dataArray);
                this.$emit('update:audioBars', Array.from(this.dataArray));
                
                // 사용자 음성 감지 - AI 오디오 중단
                this.checkUserSpeech();
                
                this.analyserAnimationId = requestAnimationFrame(this.updateAudioBars);
            }
        },
        checkUserSpeech() {
            if (!this.dataArray || this.dataArray.length === 0) return;
            
            // 볼륨 계산
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            const volume = sum / this.dataArray.length;
            
            if (volume > 40 && this.audioPlayer) {
                // console.log('User speaking detected, stopping AI audio. Volume:', volume);
                this.audioPlayer.stop();
            }
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
            this.$emit('audio:stop');
        },
    }
};
</script>

<style scoped>
</style>

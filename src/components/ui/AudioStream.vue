<template>
    <div>
        <audio ref="audioPlay"></audio>
    </div>
</template>

<script>
export default {
    props: {
        audioResponse: String,
        isLoading: Boolean,
        offStream: Boolean,
        stopAudioStreamStatus: Boolean,
        chatRoomId: String,
    },
    data() {
        return {
            audio: null,
            mediaSource: null,
            sourceBuffer: null,
            mediaStream: null, // MediaStream을 추적하기 위한 변수 추가
            abortController: null, // AbortController 인스턴스 추가
            audioContext: null,
            analyser: null,
            dataArray: null,
        }
    },
    mounted() {
        this.setupAudioStream();
    },
    watch: {
        stopAudioStreamStatus(newVal) {
            if(newVal) {
                this.stopStream()
            }
        },
        audioResponse(newVal) {
            if(newVal == "" || newVal == null) return
            let result = newVal.replace(/[\n\r]/g, '');
            this.playResponseData(result);
        },
        offStream(newVal) {
            if (newVal === true) {
                this.streamOff();
            }
        }
    },
    methods: {
        setupAudioStream() {
            this.audio = this.$refs.audioPlay;
            this.audio.autoplay = true;

            // AudioContext 생성
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            // 오디오 요소로부터 MediaStreamAudioSourceNode 생성
            const audioElement = this.$refs.audioPlay;
            const source = this.audioContext.createMediaElementSource(audioElement);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            this.updateAudioBars();
        },
        onSourceOpen() {
            this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
        },
        stopStream() {
            if (this.abortController) {
                this.abortController.abort(); // fetch 요청 중단
            }
            if (this.audio) {
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            if (this.sourceBuffer && this.sourceBuffer.updating) {
                this.sourceBuffer.abort();
            }
            if (this.mediaSource && this.mediaSource.readyState === 'open') {
                this.mediaSource.endOfStream();
            }
            this.$emit('audio:stop');
        },
        async playResponseData(response) {
            var me = this;
            me.abortController = new AbortController();
            const signal = me.abortController.signal;

            var input = {
                query: response,
                chat_room_id: me.chatRoomId
            }
            const token = localStorage.getItem('accessToken');
            fetch(`/execution/audio-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(input),
                signal: signal
            }).then(response => {
                const reader = response.body.getReader();
                const push = () => {
                    reader.read().then(async ({ done, value }) => {
                        if (done) {
                            me.audio.onended = () => {
                                me.$emit('audio:stop');
                            };
                            return;
                        }
                        try {
                            const audioBuffer = await me.audioContext.decodeAudioData(value.buffer);
                            const source = me.audioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(me.audioContext.destination);
                            source.start();
                        } catch (error) {
                            console.error('Error decoding audio data', error);
                        }

                        me.$emit('update:isLoading', false);
                        me.$emit('audio:start');
                        me.updateAudioBars();

                        push();
                    }).catch(error => {
                        console.error('Error fetching audio stream', error);
                        me.$emit('update:isLoading', false);
                    });
                };
                push();
            }).catch(error => {
                if (error.name === 'AbortError') {
                    console.log('Fetch aborted');
                } else {
                    console.error('Fetch error:', error);
                }
            });
        },
        updateAudioBars() {
            if (this.analyser) {
                this.analyser.getByteFrequencyData(this.dataArray);
                this.$emit('update:audioBars', Array.from(this.dataArray));
                requestAnimationFrame(this.updateAudioBars);
            }
        },
    }
};
</script>


<style scoped>
/* 필요에 따라 스타일 추가 */
</style>

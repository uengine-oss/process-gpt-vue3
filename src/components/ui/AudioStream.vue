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
            sourceBuffer: null,
            abortController: null, // AbortController 인스턴스 추가
            audioContext: null,
            analyser: null,
            dataArray: null,
            audioQueue: [], // 오디오 버퍼를 저장할 큐
            isPlaying: false, // 현재 오디오가 재생 중인지 여부
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

            const audioElement = this.$refs.audioPlay;
            const source = this.audioContext.createMediaElementSource(audioElement);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            this.updateAudioBars();
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
            this.audioQueue = []; // Clear the audio queue
            this.isPlaying = false; // Reset the playing state
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
                            return;
                        }
                        try {
                            const audioBuffer = await me.audioContext.decodeAudioData(value.buffer);
                            me.audioQueue.push(audioBuffer); // 큐에 오디오 버퍼 추가
                            me.playNextInQueue(); // 큐에서 다음 오디오 재생 시도
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
        playNextInQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) {
                return;
            }

            const audioBuffer = this.audioQueue.shift(); // 큐에서 다음 오디오 버퍼 꺼내기
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // 소스를 분석기 노드에 연결한 후, 오디오 컨텍스트의 목적지에 연결
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            source.onended = () => {
                this.isPlaying = false;
                this.playNextInQueue(); // 현재 오디오가 끝나면 다음 오디오 재생
            };

            source.start();
            this.isPlaying = true;
        },
        updateAudioBars() {
            if (this.analyser) {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                this.analyser.getByteFrequencyData(this.dataArray);
                console.log('dataArray', Array.from(this.dataArray))
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

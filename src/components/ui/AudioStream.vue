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
            this.mediaSource = new MediaSource();
            this.audio.src = URL.createObjectURL(this.mediaSource);
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
            me.abortController = new AbortController(); // 새로운 AbortController 생성
            const signal = me.abortController.signal; // signal 추출

            if(me.sourceBuffer == null) {
                me.sourceBuffer = me.mediaSource.addSourceBuffer('audio/mpeg');
            }
            await this.$setSupabaseEndpoint();
            var url = window.$backend == '' ? 'http://localhost:8000' : window.$backend;
            var input = {
                query: response,
                chat_room_id: me.chatRoomId,
            }
            const token = localStorage.getItem('accessToken');
            fetch(`${url}/audio-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(input),    //'{"query": "'+ response +'"}',
                signal: signal // fetch 요청에 signal 추가
            }).then(response => {
                const reader = response.body.getReader();
                const push = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            me.mediaSource.endOfStream();
                            me.audio.onended = () => {
                                me.$emit('audio:stop');
                            };
                            return;
                        }
                        if (!me.sourceBuffer.updating) {
                            me.sourceBuffer.appendBuffer(value);
                            me.audio.play();
                            me.$emit('update:isLoading', false);
                            me.$emit('audio:start');
                        }
                        me.sourceBuffer.addEventListener('updateend', push, { once: true });
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
        }
    }
};
</script>


<style scoped>
/* 필요에 따라 스타일 추가 */
</style>

<template>
    <div>
        <audio ref="audioPlay"></audio>
    </div>
</template>

<script>
export default {
    props: {
        audioResponse: String,
        isLoading: Boolean
    },
    data() {
        return {
            audio: null,
            mediaSource: null,
            sourceBuffer: null,
        }
    },
    mounted() {
        this.setupAudioStream();
    },
    watch: {
        audioResponse(newVal) {
            console.log('audioResponse changed:', newVal);
            let result = newVal.replace(/[\n\r]/g, '');
            this.playResponseData(result);
        }
    },
    methods: {
        setupAudioStream() {
            this.audio = this.$refs.audioPlay;
            this.audio.autoplay = true;
            this.mediaSource = new MediaSource();
            this.audio.src = URL.createObjectURL(this.mediaSource);
        },
        playResponseData(response) {
            var me = this;
            if(me.sourceBuffer == null) {
                me.sourceBuffer = me.mediaSource.addSourceBuffer('audio/mpeg');
            }
            var url = window.$backend == '' ? 'http://localhost:8000' : window.$backend
            fetch(`${url}/audio-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: '{"query": "'+ response +'"}'
            }).then(response => {
                const reader = response.body.getReader();
                const push = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            me.mediaSource.endOfStream();
                            me.audio.onended = () => {
                                me.$emit('audio:stop'); // 오디오 재생이 끝났을 때 'audio:stop' 이벤트를 발생시킵니다.
                            };
                            return;
                        }
                        if (!me.sourceBuffer.updating) {
                            me.sourceBuffer.appendBuffer(value);
                            me.audio.play();
                            me.$emit('update:isLoading', false);  // 로딩 상태를 false로 설정합니다.
                            me.$emit('audio:start'); // 오디오 재생이 시작되었음을 알립니다.
                        }
                        me.sourceBuffer.addEventListener('updateend', push, { once: true });
                    }).catch(error => {
                        console.error('Error fetching audio stream', error);
                        me.$emit('update:isLoading', false);  // 에러 발생 시 로딩 상태를 false로 설정합니다.
                    });
                };
                push();
            });
        },
    }
};
</script>

<style scoped>
/* 필요에 따라 스타일 추가 */
</style>

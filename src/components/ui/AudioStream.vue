<template>
    <div>
        <audio ref="audio"></audio>
    </div>
</template>

<script>
export default {
    props: {
        audioResponse : String,
    },
    data() {
        return {
            audio : null,
            mediaSource : null,
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
            this.playResponseData(result)
            // 추가 작업을 여기에 수행
        }
    },
    methods: {
        setupAudioStream() {
            this.audio  = this.$refs.audio;
            this.audio.autoplay = true;  // autoplay 속성 추가
            this.mediaSource  = new MediaSource();
            this.audio.src = URL.createObjectURL(this.mediaSource);
        },
        playResponseData(response) {
            var me = this
            // this.mediaSource.addEventListener('sourceopen', () => {
                if(me.sourceBuffer == null) {
                    me.sourceBuffer = me.mediaSource.addSourceBuffer('audio/mpeg');
                }
                fetch('http://localhost:8000/audio-stream', {
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
                                return;
                            }
                            if (!me.sourceBuffer.updating) {
                                me.sourceBuffer.appendBuffer(value);
                                me.audio.play();
                            }
                            me.sourceBuffer.addEventListener('updateend', push, { once: true });
                        }).catch(error => {
                            console.error('Error fetching audio stream', error);
                        });
                    };
                    push();
                });
            // });
        }
    }
};
</script>

<style scoped>
/* 필요에 따라 스타일 추가 */
</style>

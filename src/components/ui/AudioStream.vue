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
            stopTimeout: null, // 중지 타이머를 저장할 변수
            totalPlayTime: 0 // 총 재생 시간 (초)
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
                            me.$emit('update:isLoading', false);  // 로딩 상태를 false로 설정
                            me.$emit('audio:start'); // 오디오가 시작되었음을 알림
                            me.extendStopTimer(); // 타이머 연장
                        }
                        me.sourceBuffer.addEventListener('updateend', push, { once: true });
                    }).catch(error => {
                        console.error('Error fetching audio stream', error);
                        me.$emit('update:isLoading', false);  // 에러 발생 시 로딩 상태를 false로 설정
                    });
                };
                push();
            });
        },
        extendStopTimer() {
            if (this.stopTimeout) {
                clearTimeout(this.stopTimeout); // 기존 타이머 제거
            }
            this.totalPlayTime += 2; // 총 재생 시간을 3초씩 증가
            this.stopTimeout = setTimeout(() => {
                this.$emit('audio:stop'); // 총 재생 시간이 지난 후 오디오 중지 이벤트 발생
            }, this.totalPlayTime * 1000);
        }
    }
};
</script>

<style scoped>
/* 필요에 따라 스타일 추가 */
</style>

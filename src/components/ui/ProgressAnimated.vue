<template>
</template>
<script>
  export default {
    components: {
    },
    props: {
    },
    data() {
        return {
            borderCompletedAnimated: false,
        };
    },
    computed: {
        
    },
    methods: {
        animateBorder() {
            this.borderCompletedAnimated = true; // 클릭 시 true로 변경
            setTimeout(() => {
                this.borderCompletedAnimated = false;
            }, 500); // 1000밀리초 후 실행
        }
    }
};
</script>
  
<style>
.progress-border{
    position: relative;
    border: 1px solid #ccc;
    border-radius: 10px;
    overflow: hidden;
}
.progress-border .progress-border-span:nth-child(1) {
    position: absolute;
    background: linear-gradient(to right, darkblue, #FF33FF); /* 예시로 선형 그라데이션 적용 */
    transition: width 0.1s, height 0.1s linear 0.1s; /* transition 규칙을 최적화 */
}
.progress-border .progress-border-span:nth-child(2) {
    position: absolute;
    background: linear-gradient(to bottom, #FF33FF, darkblue); /* 예시로 선형 그라데이션 적용 */
    transition: width 0.1s, height 0.1s linear 0.1s; /* transition 규칙을 최적화 */
}

.progress-border .progress-border-span:nth-child(3) {
    position: absolute;
    background: linear-gradient(to left, darkblue ,#FF33FF); /* 예시로 선형 그라데이션 적용 */
    transition: width 0.1s, height 0.1s linear 0.1s; /* transition 규칙을 최적화 */
}

.progress-border .progress-border-span:nth-child(4) {
    position: absolute;
    background: linear-gradient(to top, #FF33FF, darkblue); /* 예시로 선형 그라데이션 적용 */
    transition: width 0.1s, height 0.1s linear 0.1s; /* transition 규칙을 최적화 */
}

.progress-border .progress-border-span:nth-child(1) {left: 0; top: 0; width: 0; height: 5px;}
.progress-border .progress-border-span:nth-child(2) {right: 0; top: 0; width: 5px; height: 0;}
.progress-border .progress-border-span:nth-child(3) {right: 0; bottom: 0; width: 0; height: 5px;}
.progress-border .progress-border-span:nth-child(4) {left: 0; bottom: 0; width: 5px; height: 0;}
.progress-border .progress-border-span:nth-child(1) {left: 0; top: 0; width: 0; height: 5px; transition: width 0.1s;}
.progress-border .progress-border-span:nth-child(2) {right: 0; top: 0; width: 5px; height: 0; transition: height 0.1s linear 0.1s;}
.progress-border .progress-border-span:nth-child(1) {left: 0; top: 0; width: 0; height: 5px; transition: width 0.1s;}
.progress-border .progress-border-span:nth-child(2) {right: 0; top: 0; width: 5px; height: 0; transition: height 0.1s linear 0.1s;}
.progress-border .progress-border-span:nth-child(3) {right: 0; bottom: 0; width: 0; height: 5px; transition: width 0.1s linear 0.2s;}
.progress-border .progress-border-span:nth-child(4) {left: 0; bottom: 0; width: 5px; height: 0; transition: height 0.1s linear 0.3s;}
.progress-border.animate .progress-border-span:nth-child(1) {width: 100%;}
.progress-border.animate .progress-border-span:nth-child(2) {height: 100%;}
.progress-border.animate .progress-border-span:nth-child(3) {width: 100%;}
.progress-border.animate .progress-border-span:nth-child(4) {height: 100%;}
</style>
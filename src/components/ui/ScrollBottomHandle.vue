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
            userScrolled: false,
        };
    },
    watch: {
        filteredMessages() {
            if (!this.userScrolled) {
                this.scrollToBottom();
            }
        },
    },
    computed: {
        
    },
    methods: {
        scrollToBottom() {
            this.$nextTick(() => {
                const container = this.$refs.scrollContainer.$el;
                container.scrollTop = container.scrollHeight;
            });
        },
        // 사용자가 스크롤을 조작할 때 호출되는 함수
        handleScroll() {
            const container = this.$refs.scrollContainer.$el;
            // 사용자가 스크롤을 최하단에서 멀어지면 userScrolled를 true로 설정
            this.userScrolled = container.scrollTop + container.clientHeight < container.scrollHeight;
        },
    }
};
</script>
  
<style>
</style>
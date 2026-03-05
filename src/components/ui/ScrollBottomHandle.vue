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
            isAtBottom: true,
            // 상단에서 히스토리 더 불러오기 트리거 throttle
            _lastTopFetchAt: 0,
        };
    },
    watch: {
        filteredMessages() {
            if (this.isAtBottom) {
                this.scrollToBottom();
            } else {
                this.showNewMessage();
            }
        },
    },
    computed: {
        
    },
    methods: {
        scrollToBottom() {
            setTimeout(() => {
                if(this.$refs.scrollContainer) {
                    const container = this.$refs.scrollContainer.$el;
                    container.scrollTop = container.scrollHeight;
                }
            }, 300);
            // this.$nextTick(() => {
            //     const container = this.$refs.scrollContainer.$el;
            //     container.scrollTop = container.scrollHeight;
            // });
        },
        handleScroll() {
            if(this.$refs.scrollContainer) {
                const container = this.$refs.scrollContainer.$el;
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    const scrollPosition = Math.round(container.scrollTop + container.clientHeight) + 1;
                    const isAtBottom = scrollPosition >= container.scrollHeight;
                    this.isAtBottom = isAtBottom;

                    // 상단(또는 상단 근처) 도달 시: 부모에게 더 불러오기 요청
                    // - Chat.vue는 getMoreChat() 메서드로 emit('getMoreChat')을 제공함
                    // - 다른 컴포넌트에서 mixin으로 쓰더라도 메서드가 없으면 무시
                    const isNearTop = (container.scrollTop || 0) <= 20;
                    if (isNearTop) {
                        const now = Date.now();
                        if (!this._lastTopFetchAt || (now - this._lastTopFetchAt) > 800) {
                            this._lastTopFetchAt = now;
                            try {
                                if (typeof this.getMoreChat === 'function') {
                                    this.getMoreChat();
                                }
                            } catch (e) {
                                // ignore
                            }
                        }
                    }
                }, 200);    
            }
            
        },
    }
};
</script>
  
<style>
</style>
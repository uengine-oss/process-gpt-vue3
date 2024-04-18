<template>
    <div>
        <v-btn class="full-width" color="primary" @click="onClickSubmit">Submit</v-btn>
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    props: {
        vueRenderUUID: String,
        tagName: String
    },
    data() {
        return {
            onClickSubmit: () => {}
        };
    },
    created() {
        
    },
    methods: {
 
    }
};
</script>

<style lang="scss">
.full-width {
    width: 100%; // 부모 요소의 전체 너비를 차지하도록 설정
}
</style>
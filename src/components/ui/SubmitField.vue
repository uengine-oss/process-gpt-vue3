<template>
    <div>
        <input type="submit" value="Submit" @click="$emit('onClickSubmit')">
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    emits: [
        "onClickSubmit"
    ],
    props: {
        vueRenderUUID: String,
        tagName: String
    },
    data() {
        return {
         
        };
    },
    created() {
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>
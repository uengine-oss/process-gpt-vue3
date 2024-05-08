<template>
    <div v-show="false">
        <slot ></slot>
    </div>
</template>

<script>
export default {
    name: "ScriptField",
    
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        watchName: String
    },

    data() {
        return {
        };
    },

    created() {
        this.$emit('update:modelValue', this.$slots.default(0)[0].children)
    }
}
</script>

<style lang="scss">

</style>

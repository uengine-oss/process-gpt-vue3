<template>
    <div v-show="false">
        <slot ></slot>
    </div>
</template>

<script>
export default {
    name: "ScriptField",
    
    props: {
        modelValue: Object,
        vueRenderUUID: String,
        tagName: String,

        event_type: String,
        watch_name: String
    },

    data() {
        return {
        };
    },

    created() {
        if (this.event_type === "watch") {
            this.$emit('update:modelValue', {
                eventType: this.event_type,
                watchName: this.watch_name,
                script: this.$slots.default(0)[0].children
            });
        }
        else if (this.event_type === "validate") {
            this.$emit('update:modelValue', {
                eventType: this.event_type,
                script: this.$slots.default(0)[0].children
            });
        }
    }
}
</script>

<style lang="scss">

</style>

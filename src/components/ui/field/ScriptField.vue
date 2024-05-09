<template>
    <div v-show="false">
        <slot ></slot>
    </div>

    <div class="d-flex align-center justify-center">
        <img class="mr-2" src="/snippets/default/preview/script.png" style="width: 25px;" />
        <p>{{ localName }}</p>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "ScriptField",
    
    props: {
        modelValue: Object,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        event_type: String,
        watch_name: String,
        encoded_script: String
    },

    data() {
        return {
            localName: "",

            settingInfos: [
                commonSettingInfos["localName"]
            ]
        };
    },

    created() {
        this.localName = this.name

        if(this.encoded_script === undefined) {
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
}
</script>

<style lang="scss">

</style>

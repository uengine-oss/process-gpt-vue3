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
            localEventType: "",

            settingInfos: [
                commonSettingInfos["localName"],
                {
                    dataToUse: "localEventType",
                    htmlAttribute: "event_type",
                    settingLabel: "Event Type",
                    settingType: "select",
                    settingValue: ["watch", "validate"]
                }
            ]
        };
    },

    created() {
        this.localName = this.name
        this.localEventType = this.event_type

        if(this.encoded_script === undefined) {
            if (this.localEventType === "watch") {
                this.$emit('update:modelValue', {
                    eventType: this.localEventType,
                    watchName: this.watch_name,
                    script: this.$slots.default(0)[0].children
                });
            }
            else if (this.localEventType === "validate") {
                this.$emit('update:modelValue', {
                    eventType: this.localEventType,
                    script: this.$slots.default(0)[0].children
                });
            }
        }
    }
}
</script>

<style lang="scss">

</style>

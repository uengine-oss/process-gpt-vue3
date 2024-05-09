<template>
    <div v-show="false">
        <slot ></slot>
    </div>

    <div v-if="(this.localEventType !== 'click') && (this.encoded_script !== undefined)" class="d-flex align-center justify-center">
        <img class="mr-2" src="/snippets/default/preview/script.png" style="width: 25px;" />
        <p>{{ localLabel }}</p>
    </div>
    <div v-else-if="this.localEventType === 'click'">
        <v-btn color="primary" class="w-100 my-5" @click="$emit('onClick')">{{ localLabel }}</v-btn>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "ScriptField",

    emits: [
        "update:modelValue",
        "onClick"
    ],
    
    props: {
        modelValue: Object,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        event_type: String,
        watch_name: String,
        encoded_script: String
    },

    data() {
        return {
            localName: "",
            localAlias: "",
            localEventType: "",
            localWatchName: "",

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                {
                    dataToUse: "localEventType",
                    htmlAttribute: "event_type",
                    settingLabel: "Event Type",
                    settingType: "select",
                    settingValue: ["click", "initialize", "validate", "watch"]
                },

                {
                    dataToUse: "localWatchName",
                    htmlAttribute: "watch_name",
                    settingLabel: "Name to watch",
                    settingType: "select",
                    settingValue: ["name-1", "name-2"],
                    isShowCheck: (props) => {
                        return props.localEventType === "watch"
                    }
                }
            ]
        };
    },

    computed: {
        localLabel() {
            return (this.localAlias && this.localAlias.length > 0) ? this.localAlias : this.localName
        }
    },

    created() {
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localEventType = this.event_type ?? "click"
        this.localWatchName = this.watch_name ?? ""

        if(this.encoded_script === undefined) {
            switch(this.localEventType) {
                case "click":
                case "initialize":
                case "validate":
                    this.$emit('update:modelValue', {
                        eventType: this.localEventType,
                        script: this.$slots.default(0)[0].children
                    });
                    break;
                case "watch":
                    this.$emit('update:modelValue', {
                        eventType: this.localEventType,
                        watchName: this.watch_name,
                        script: this.$slots.default(0)[0].children
                    });
                    break;
            }
        }
    }
}
</script>

<style lang="scss">

</style>

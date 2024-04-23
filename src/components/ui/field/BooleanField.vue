<template>
    <div>
        <v-checkbox 
            :label="localAlias ?? localName" 
            v-model="localModelValue"
            :disabled="localDisabled"
        ></v-checkbox>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "BooleanField",
    
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: this.modelValue ?? false,

            localName: this.name,
            localAlias: this.alias,
            localDisabled: this.disabled === "true",

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"]
            ]
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue = this.modelValue ?? false
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        }
    },
}
</script>

<style lang="scss">

</style>

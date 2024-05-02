<template>
    <div>
        <v-checkbox 
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName" 
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
        modelValue: Boolean,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: false,

            localName: "",
            localAlias: "",
            localDisabled: false,

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

    created() {
        this.localModelValue = this.modelValue ?? false
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
    }
}
</script>

<style lang="scss">

</style>

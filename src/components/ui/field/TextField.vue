<template>
    <div>
        <v-text-field v-model="localModelValue">
            <template v-slot:label>
                <span style="color:black;">
                    {{localAlias ?? localName}}
                </span>
            </template>
        </v-text-field>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "TextField",
    
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String
    },

    data() {
        return {
            localModelValue: this.modelValue,

            localName: this.name,
            localAlias: this.alias,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"]
            ]
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue  = ((this.modelValue && this.modelValue.length > 0) ? this.modelValue : "")
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

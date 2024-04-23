<template>
    <div>
        <v-text-field v-model="localModelValue" :type="localType" :disabled="localDisabled">
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
        alias: String,
        type: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: this.modelValue,

            localName: this.name,
            localAlias: this.alias,
            localType: this.type ?? "text",
            localDisabled: this.disabled === "true",

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],

                {
                    dataToUse: "localType",
                    htmlAttribute: "type",
                    settingLabel: "Type",
                    settingType: "select",
                    settingValue: ["text", "number", "email", "url", "date", "datetime-local", "month", "week", "time", "password", "tel", "color"]
                }
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

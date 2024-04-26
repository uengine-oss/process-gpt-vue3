<template>
    <div>
        <v-textarea v-model="localModelValue" :disabled="localDisabled" :rows="rows">
            <template v-slot:label>
                <span style="color:black;">
                    {{(localAlias && localAlias.length > 0) ? localAlias : localName}}
                </span>
            </template>
        </v-textarea>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "TextareaField",
    
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        rows: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: "",

            localName: "",
            localAlias: "",
            localRows: "",
            localDisabled: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                {
                    dataToUse: "localRows",
                    htmlAttribute: "rows",
                    settingLabel: "Rows",
                    settingType: "number",
                    validCheck: (value) => {
                        if(!value || Number(value) <= 0) return "Rows 속성에 0 이상의 값을 입력해 주세요."
                        return null
                    }
                },
                commonSettingInfos["localDisabled"]
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

    created() {
        this.localModelValue = this.modelValue
        
        this.localName = this.name
        this.localAlias = this.alias
        this.localRows = this.rows
        this.localDisabled = this.disabled === "true"
    }
}
</script>

<style lang="scss">

</style>

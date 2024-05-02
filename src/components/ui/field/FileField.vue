<template>
    <div>
        <v-file-input
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName"
            v-model="selectedFiles"
            :disabled="localDisabled"
        ></v-file-input>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
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
            localName: "",
            localAlias: "",
            localDisabled: false,
            
            selectedFiles: null,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"]
            ]
        };
    },

    watch: {
        selectedFiles() {
            if (!this.selectedFiles || this.selectedFiles.length <= 0) {
                this.$emit('update:modelValue', "")
                return
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.$emit('update:modelValue', e.target.result)
            }
            reader.readAsDataURL(this.selectedFiles[0])
        }
    },

    created() {
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"

        this.$emit('update:modelValue', "")
    }
};
</script>

<style lang="scss">

</style>

<template>
    <div>
        <v-file-input
            :label="localAlias ?? localName"
            v-model="selectedFiles"
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
        alias: String
    },

    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            selectedFiles: null,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"]
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
        this.$emit('update:modelValue', "")
    }
};
</script>

<style lang="scss">

</style>

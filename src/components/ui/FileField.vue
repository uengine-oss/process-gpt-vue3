<template>
    <div>
        <v-file-input
            :label="label"
            v-model="selectedFiles"
        ></v-file-input>
    </div>
</template>

<script>

export default {
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,
        name: String,
        alias: String
    },

    computed: {
        label() {
            if (this.localAlias) return this.localAlias
            else if (this.localName) return this.localName
            else return ""
        }
    },

    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            selectedFiles: null
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

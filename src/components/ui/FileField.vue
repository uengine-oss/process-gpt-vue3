<template>
    <div>
        <v-file-input
            :label="label"
            v-model="selectedFiles"
            @change="convertToBase64"
        ></v-file-input>
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    props: {
        vueRenderUUID: String,
        tagName: String,
        name: String,
        alias: String
    },
    computed: {
        label() {
            return this.localAlias || this.localName;
        }
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            selectedFiles: null,
            inputedValue: ""
        };
    },
    created() {
    },
    methods: {
        convertToBase64() {
            if (!this.selectedFiles && this.selectedFiles.length <= 0) return

            const reader = new FileReader();
            reader.onload = (e) => {
                this.inputedValue = e.target.result
            }
            reader.readAsDataURL(this.selectedFiles[0])
        }
    }
};
</script>

<style lang="scss">

</style>

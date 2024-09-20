<template>
    <div>
        <textarea class="xml-editor" v-model="xml" @input="updateText" @change="changeBpmn"></textarea>
    </div>
</template>

<script>
export default {
    name: 'XMLEditor',
    data() {
        return {
        }
    },
    props: {
        xml: {
            type: String,
            required: true
        }
    },
    methods: {
        changeBpmn(newVal) {
            this.$emit('changeBpmn', this.xml);
        }
    }
}
</script>

<style scoped>
.xml-editor {
    width: 100vw;
    height: 100vh;
    font-family: monospace;
    font-size: 14px;
    padding: 10px;
    box-sizing: border-box;
}
</style>

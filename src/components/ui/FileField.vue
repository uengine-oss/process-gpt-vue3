<template>
    <div>
        <v-file-input
            :label="label"
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
        };
    },
    created() {
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>

<template>
    <div>
        <v-text-field :label="label"></v-text-field>
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
    data() {
        return {
            localName: this.name,
            localAlias: this.alias
        };
    },
    computed: {
        label() {
            return this.localAlias || this.localName;
        }
    },
    created() {
    },
    methods: {
        
    }
};
</script>

<style lang="scss">

</style>

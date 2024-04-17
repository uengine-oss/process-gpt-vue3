<template>
    <div>
        <v-text-field v-model="inputedValue">
            <template v-slot:label>
                <span style="color:black;">
                    {{label}}
                </span>
            </template>
        </v-text-field>
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
            if(this.localAlias && this.localName) return `${this.localAlias}(${this.localName})`
            else if (this.localAlias) return this.localAlias
            else if (this.localName) return this.localName
            else return ""
        }
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            inputedValue: ""
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

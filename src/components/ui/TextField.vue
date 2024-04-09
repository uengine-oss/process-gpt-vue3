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
        name: String,
        alias: String
    },
    computed: {
        label() {
            return this.alias || this.name;
        }
    },
    data() {
        return {
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

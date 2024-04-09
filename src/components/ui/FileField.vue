<template>
    <div>
        <v-file-input
            :label="label"
            :accept="accept"
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
        name: String,
        alias: String,
        accept: String
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

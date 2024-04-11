<template>
    <div>
        <label :for="for_id"><slot></slot></label>
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    props: {
        for_id: String
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

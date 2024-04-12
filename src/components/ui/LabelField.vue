<template>
    <div>
        <label>{{localLabel}}</label>
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
        label: String
    },
    computed: {
    },
    data() {
        return {
            localLabel: this.label
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

<template>
    {{element.$type}}
</template>

<script>

    export default {
        name: 'gateway-panel',
        props: {
            element: Object,
        },
        data() {
            return {
            }
        },
        created: function () {
        },
        mounted: function () {
            console.log('gatewayType: ', this.element.$type);
        },
        computed: {},
        watch: {},
        methods: {}
    }
</script>


<style lang="scss" rel="stylesheet/scss">

</style>


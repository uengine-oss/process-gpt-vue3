<template>
    <div>
        <label>{{localLabel}}</label>
    </div>
</template>

<script>

export default {
    props: {
        vueRenderUUID: String,
        tagName: String,
        label: String
    },

    data() {
        return {
            localLabel: this.label
        };
    }
};
</script>

<style lang="scss">

</style>

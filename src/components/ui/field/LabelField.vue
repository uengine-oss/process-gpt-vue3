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
            localLabel: this.label,

            settingInfos: [
                {
                    dataToUse: "localLabel",
                    htmlAttribute: "label",
                    settingLabel: "Label",
                    settingType: "text"
                }
            ]
        };
    }
};
</script>

<style lang="scss">

</style>

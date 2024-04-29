<template>
    <div>
        <v-autocomplete v-model="localModelValue" :items="usersToSelect" :label="(localAlias && localAlias.length > 0) ? localAlias : localName" :disabled="localDisabled"
                        item-title="id" :item-value="id" chips closable-chips multiple small-chips>
                        <template v-slot:chip="{ props, item }">
                            <v-chip v-bind="props" :text="item.raw.username ?? item.raw.email"></v-chip>
                        </template>

                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :title="item.raw.username ?? item.raw.email" :subtitle="item.raw.email"></v-list-item>
                        </template>
        </v-autocomplete>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: "UserSelectField",

    props: {
        modelValue: Array,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: [],

            localName: "",
            localAlias: "",
            localDisabled: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"]
            ],

            usersToSelect: []
        };
    },

    watch: {
        modelValue: {
            handler() {
                if(JSON.stringify(this.localModelValue) === JSON.stringify(this.modelValue)) return
                this.localModelValue = (this.modelValue && this.modelValue.length > 0) ? this.modelValue : []
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                if(JSON.stringify(this.localModelValue) === JSON.stringify(this.modelValue)) return
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        }
    },

    async created() {
        this.localModelValue = this.modelValue ?? []
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"

        this.usersToSelect = (await StorageBaseFactory.getStorage().list(`users`))
    }
};
</script>

<style lang="scss">

</style>

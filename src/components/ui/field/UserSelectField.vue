<template>
    <div class="form-user-select-field">
        <v-autocomplete v-model="localModelValue" 
            :items="usersToSelect" 
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName" 
            :disabled="localDisabled"
            item-title="username" 
            :item-value="itemValue" 
            chips closable-chips multiple small-chips
            :readonly="localReadonly"
            :variant="localReadonly ? 'filled' : 'outlined'"
        >
            <template v-slot:chip="{ props, item }">
                <v-chip v-bind="props" :text="item.raw.username ?? item.raw.email"></v-chip>
            </template>

            <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props"
                    :title="item.raw.username ?? item.raw.email" 
                    :subtitle="item.raw.email"
                ></v-list-item>
            </template>
        </v-autocomplete>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: "UserSelectField",

    props: {
        modelValue: Array,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,
        readonly: String,
        itemValue: {
            type: String,
            default: "id"
        }
    },

    data() {
        return {
            localModelValue: [],

            localName: "",
            localAlias: "",
            localDisabled: false,
            localReadonly: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"]
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
        this.localReadonly = this.readonly === "true"
        
        this.usersToSelect = await backend.getUserList();
    }
};
</script>

<style lang="scss">
.form-user-select-field {
    margin-bottom: 16px;
}
</style>

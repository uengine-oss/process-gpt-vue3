<template>
    <div class="form-checkbox-box">
        <label class="form-checkbox-label">{{(localAlias && localAlias.length > 0) ? localAlias : localName}}</label>
        <div v-for="(item, index) in localItems" :key="index">
            <div v-for="(value, key) in item" :key="key">
                <v-checkbox
                    v-model="localModelValue"
                    :label="key"
                    :value="key"
                    :disabled="localDisabled"
                ></v-checkbox>
            </div>
        </div>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    props: {
        modelValue: Array,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        items: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: this.modelValue ?? [],

            localName: this.name,
            localAlias: this.alias,
            localItems: this.items,
            localDisabled: this.disabled === "true",

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localItems"],
                commonSettingInfos["localDisabled"]
            ]
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.loadLocalItems()
                
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

    methods: {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        loadLocalItems() {
            try {
                if(typeof(this.items) === "string")
                    this.localItems = JSON.parse(this.items.replace(/'/g, '"'))
                else
                    this.localItems = this.items
            } catch (e) {
                console.log("### items 파싱 에러 ###")
                console.log(this.items.replace(/'/g, '"'))
                console.error(e);
            }
        }
    }
};
</script>

<style lang="scss">

</style>

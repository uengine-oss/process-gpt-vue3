<template>
    <div class="form-radio-box">
        <label class="form-radio-label">{{(localAlias && localAlias.length > 0) ? localAlias : localName}}</label>
        <v-radio-group v-model="localModelValue">
            <div v-for="(item, index) in localItems" :key="index">
                <div v-for="(value, key) in item" :key="key">
                    <v-radio :label="key" :value="key" :disabled="localDisabled"></v-radio>
                </div>
            </div>
        </v-radio-group>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        items: String,
        disabled: String
    },

    data() {
        return {
            localModelValue: this.modelValue,

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
                
                if(this.modelValue && this.modelValue.length > 0)
                    this.localModelValue = this.modelValue
                else if(this.localItems.length > 0)
                    this.localModelValue = Object.keys(this.localItems[0])[0]
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
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

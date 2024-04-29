<template>
    <div class="form-checkbox-box">
        <label class="form-checkbox-label">{{(localAlias && localAlias.length > 0) ? localAlias : localName}}</label>
        <div v-for="(item, index) in controlItems" :key="index">
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
            localModelValue: "",

            localName: "",
            localAlias: "",
            localItems: [],
            localDisabled: false,

            controlItems: [],

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
                this.loadControlItems()
                
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
        },

        localItems: {handler() {this.loadControlItems()}, deep: true, immediate: true}
    },

    methods: {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        async loadControlItems() {
            this.controlItems = this.localItems
        }
    },

    created() {
        this.localModelValue = this.modelValue
        
        this.localName = this.name
        this.localAlias = this.alias
        this.localDisabled = this.disabled === "true"


        try {
            if(typeof(this.items) === "string")
                this.localItems = JSON.parse(this.items.replace(/'/g, '"'))
            else
                this.localItems = this.items
        } catch (e) {
            console.log("### items 파싱 에러 ###")
            console.log(this.items.replace(/'/g, '"'))
            console.error(e);
            this.localItems = []
        }

        this.loadControlItems()
    }
};
</script>

<style lang="scss">

</style>

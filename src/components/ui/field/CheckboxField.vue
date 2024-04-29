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
import axios from 'axios';
import jp from 'jsonpath';

export default {
    props: {
        modelValue: Array,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,

        items: String,
        is_dynamic_load: String,
        dynamic_load_url: String,
        dynamic_load_key_json_path: String,
        dynamic_load_value_json_path: String
    },

    data() {
        return {
            localModelValue: "",

            localName: "",
            localAlias: "",
            localItems: [],
            localDisabled: false,

            localIsDynamicLoad: false,
            localDynamicLoadURL: "",
            localDynamicLoadKeyJsonPath: "",
            localDynamicLoadValueJsonPath: "",

            controlItems: [],

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                ...commonSettingInfos["localItemsWithDynamicList"]
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

        localItems: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localIsDynamicLoad: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localDynamicLoadURL: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localDynamicLoadKeyJsonPath: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localDynamicLoadValueJsonPath: {handler() {this.loadControlItems()}, deep: true, immediate: true}
    },

    methods: {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        async loadControlItems() {
            if(this.localIsDynamicLoad) {
                if(!this.localDynamicLoadURL || this.localDynamicLoadURL.length === 0) return
                if(!this.localDynamicLoadKeyJsonPath || this.localDynamicLoadKeyJsonPath.length === 0) return
                if(!this.localDynamicLoadValueJsonPath || this.localDynamicLoadValueJsonPath.length === 0) return

                try {
                    const response = await axios.get(this.localDynamicLoadURL)
                    
                    const keys = jp.query(response.data, this.localDynamicLoadKeyJsonPath)
                    const values = jp.query(response.data, this.localDynamicLoadValueJsonPath)

                    if(keys.length !== values.length) throw new Error("keys.length != values.length")
                    this.controlItems = keys.map((key, index) => ({ [key]: values[index] }))
                } catch(e) {
                    console.log("### items 동적 로드 에러 ###")
                    console.error(e)
                }

            } else
                this.controlItems = this.localItems
        }
    },

    async created() {
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
        this.localIsDynamicLoad = this.is_dynamic_load === "true"
        this.localDynamicLoadURL = this.dynamic_load_url ?? ""
        this.localDynamicLoadKeyJsonPath = this.dynamic_load_key_json_path ?? ""
        this.localDynamicLoadValueJsonPath = this.dynamic_load_value_json_path ?? ""


        await this.loadControlItems()
    }
};
</script>

<style lang="scss">

</style>

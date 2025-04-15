<template>
    <div class="form-select-field">
        <v-select
            :items="selectItems"
            :item-title="item => item.value"
            :item-value="item => item.key"
            v-model="localModelValue"
            :disabled="localDisabled"
            :readonly="localReadonly"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
        >
        <template v-slot:label>
            <span style="color:black;">
                {{(localAlias && localAlias.length > 0) ? localAlias : localName}}
            </span>
        </template>
        </v-select>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import axios from 'axios';
import jp from 'jsonpath';

export default {
    props: {
        // UI 관련 설정 props 시작 
        hideDetails: {
            type: Boolean,
            default: false
        },
        density: {
            type: String,
            default: 'compact'
        },
        // UI 관련 설정 props 끝
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,
        readonly: String,

        items: String,
        is_dynamic_load: String,
        dynamic_load_url: String,
        dynamic_load_key_json_path: String,
        dynamic_load_value_json_path: String
    },

    computed: {
        selectItems() {
            if(this.controlItems === undefined || this.controlItems === null ||
               this.controlItems.length === 0 || this.controlItems === "[]") return []
            return this.controlItems.map(item => ({key: Object.keys(item)[0], value: Object.values(item)[0]}))
        }
    },

    data() {
        return {
            localModelValue: "",

            localName: "",
            localAlias: "",
            localItems: [],
            localDisabled: false,
            localReadonly: false,

            localIsDynamicLoad: false,
            localDynamicLoadURL: "",
            localDynamicLoadKeyJsonPath: "",
            localDynamicLoadValueJsonPath: "",

            controlItems: [],

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"],
                ...commonSettingInfos["localItemsWithDynamicList"]
            ]
        };
    },

    watch: {
        modelValue: {
            async handler() {
                await this.loadControlItems()

                if(this.modelValue && this.modelValue.length > 0)
                {
                    const foundItem = this.controlItems.find(item => Object.keys(item)[0] === this.modelValue)
                    if(!foundItem) return

                    this.localModelValue = Object.keys(foundItem)[0]
                }
                else
                {
                    if(this.controlItems.length > 0)
                        this.localModelValue = Object.keys(this.controlItems[0])[0]
                }
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
        this.localModelValue = this.modelValue ?? ""
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"

        try {
            if(!(this.items) || this.items.length === 0)
                this.localItems = []
            else if(typeof(this.items) === "string")
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
        if((this.controlItems.length > 0) && !this.localModelValue)
            this.localModelValue = Object.keys(this.controlItems[0])[0]
    }
};
</script>

<style lang="scss">
.form-select-field {
    margin-bottom: 16px;
}
</style>

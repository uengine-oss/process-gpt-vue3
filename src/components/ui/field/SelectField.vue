<template>
    <div>
        <v-select
            :items="localKeys"
            v-model="localModelValue"
            :disabled="localDisabled"
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
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        items: String,
        disabled: String
    },

    computed: {
        localKeys() {
            if(this.controlItems === undefined || this.controlItems === null ||
               this.controlItems.length === 0 || this.controlItems === "[]") return []
            return this.controlItems.map(item => Object.keys(item)[0])
        }
    },

    data() {
        return {
            localModelValue: "",

            localName: "",
            localAlias: "",
            localItems: [],
            localDisabled: this.disabled === "true",

            localIsDynamicLoad: false,
            localDynamicLoadURL: "http://localhost:8088/api/data/1",
            localDynamicLoadKeyJsonPath: "$.values[*].key",
            localDynamicLoadValueJsonPath: "$.values[*].value",

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
        localDynamicLoadURL: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localDynamicLoadKeyJsonPath: {handler() {this.loadControlItems()}, deep: true, immediate: true},
        localDynamicLoadValueJsonPath: {handler() {this.loadControlItems()}, deep: true, immediate: true}
    },

    methods: {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        async loadControlItems() {
            if(this.localIsDynamicLoad) {

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

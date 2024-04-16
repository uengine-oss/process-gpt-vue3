<template>
    <div>
        <v-select
            :items="localKeyValueStrs"
            v-model="inputedValue"
        >
        <template v-slot:label>
            <span style="color:black;">
                {{label}}
            </span>
        </template>
        </v-select>
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    props: {
        vueRenderUUID: String,
        tagName: String,
        name: String,
        alias: String,
        items: String
    },
    computed: {
        label() {
            if(this.localAlias && this.localName) return `${this.localAlias}(${this.localName})`
            else if (this.localAlias) return this.localAlias
            else if (this.localName) return this.localName
            else return ""
        },
        localValues() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return []
            return this.localItems.map((item) => Object.values(item)[0])
        },
        localKeys() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return []
            return this.localItems.map((item) => Object.keys(item)[0])
        },
        localKeyValueStrs() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return []
            return this.localItems.map((item) => `${Object.keys(item)[0]}(${Object.values(item)[0]})`)
        },
        inputedItem() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return ""
            return this.localItems.find((item) => Object.keys(item)[0] === this.inputedValue.split("(")[0])
        }
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            localItems: [],
            inputedValue: ""
        };
    },
    created() {
        try {
            // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
            if(typeof(this.items) === "string")
                this.localItems = JSON.parse(this.items.replace(/'/g, '"'))
            else
                this.localItems = this.items
        } catch (e) {
            console.log("### items 파싱 에러 ###")
            console.log(this.items.replace(/'/g, '"'))
            console.error(e);
        }
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>

<template>
    <div>
        <label>{{ label }}</label>
        <div v-for="(item, index) in localItems" :key="index">
            <div v-for="(value, key) in item" :key="key">
                <v-checkbox
                    v-model="selectedKeys"
                    :label="`${key}(${value})`"
                    :value="key"
                ></v-checkbox>
            </div>
        </div>
    </div>
</template>

<script>

export default {
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
        }
    },

    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            localItems: [],
            
            selectedKeys: [],
            inputedValue: [],
            initialValue: [],
            onChange: () => {}
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

    watch: {
        initialValue() {
            this.selectedKeys = this.initialValue.map(item => Object.keys(item)[0])
        },

        selectedKeys() {
            this.inputedValue = this.selectedKeys.map(key => ({ [key]: this.localItems.find(item => Object.keys(item)[0] === key)[key] }))
            this.onChange(this.inputedValue)
        }
    }
};
</script>

<style lang="scss">

</style>

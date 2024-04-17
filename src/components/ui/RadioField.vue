<template>
    <div>
        <label>{{ label }}</label>
        <v-radio-group v-model="selectedKey">
            <div v-for="(item, index) in localItems" :key="index">
                <div v-for="(value, key) in item" :key="key">
                    <v-radio :label="`${key}(${value})`" :value="key"></v-radio>
                </div>
            </div>
        </v-radio-group>
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

            selectedKey: null,
            inputedValue: null,
            initialValue: null,
            onChange: () => {}
        };
    },

    watch: {
        localItems: {
            handler: function() {
                if(this.localItems && this.localItems.length > 0)
                    this.selectedKey = Object.keys(this.localItems[0])[0]
                else
                    this.selectedKey = null
            },
            deep: true
        },

        initialValue() {
            this.selectedKey = Object.keys(this.initialValue)[0]
        },

        selectedKey() {
            this.inputedValue = this.localItems.find(item => Object.keys(item)[0] === this.selectedKey)
            this.onChange(this.inputedValue)
        }
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
    }
};
</script>

<style lang="scss">

</style>

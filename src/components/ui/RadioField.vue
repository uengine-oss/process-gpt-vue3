<template>
    <div>
        <label>{{ label }}</label>
        <v-radio-group v-model="inputedValue">
            <div v-for="(item, index) in localItems" :key="index">
                <div v-for="(value, key) in item" :key="key">
                    <v-radio :label="`${key}(${value})`" :value="value"></v-radio>
                </div>
            </div>
        </v-radio-group>
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
        }
    },
    watch: {
        localItems: {
            handler: function() {
                if(this.localItem && this.localItems.length > 0)
                    this.inputedValue = Object.values(this.localItems[0])[0]
                else
                    this.inputedValue = null
            },
            deep: true
        }
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            localItems: [],
            inputedValue: null
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

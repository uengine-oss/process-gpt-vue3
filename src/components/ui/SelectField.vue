<template>
    <div>
        <v-select
            :label="label"
            :items="localKeys"
        ></v-select>
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
            return this.localAlias || this.localName;
        },
        localValues() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return []
            return this.localItems.map((item) => Object.values(item)[0])
        },
        localKeys() {
            if(this.localItems === undefined || this.localItems === null || this.localItems.length === 0) return []
            return this.localItems.map((item) => Object.keys(item)[0])
        },
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            localItems: []
        };
    },
    created() {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        if(typeof(this.items) === "string")
            this.localItems = JSON.parse(this.items.replace(/'/g, '"'))
        else
            this.localItems = this.items
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>

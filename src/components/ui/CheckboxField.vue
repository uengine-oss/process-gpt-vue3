<template>
    <div>
        <label>{{ label }}</label>
        <div v-for="(item, index) in localItems" :key="index">
            <div v-for="(value, key) in item" :key="key">
                <v-checkbox
                    v-model="inputedValue"
                    :label="key"
                    :value="value"
                ></v-checkbox>
            </div>
        </div>
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
        }
    },
    data() {
        return {
            localName: this.name,
            localAlias: this.alias,
            localItems: [],
            inputedValue: []
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

<template>
    <div>
        <label>{{ label }}</label>
        <v-radio-group v-model="selected">
            <div v-for="(item, index) in viewItems" :key="index">
                <div v-for="(value, key) in item" :key="key">
                    <v-radio :label="key" :value="value"></v-radio>
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
        name: String,
        alias: String,
        items: String
    },
    computed: {
        label() {
            return this.alias || this.name;
        }
    },
    data() {
        return {
            viewItems: [],
            selected: null
        };
    },
    created() {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        if(typeof(this.items) === "string")
            this.viewItems = JSON.parse(this.items.replace(/'/g, '"'))
        else
            this.viewItems = this.items
        
        this.selected = Object.values(this.viewItems[0])[0]
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>

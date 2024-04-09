<template>
    <div>
        <div v-for="(item, index) in viewItems" :key="index">
            <div v-for="(value, key) in item" :key="key">
                <v-checkbox
                    v-model="selected"
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
        items: String
    },
    data() {
        return {
            viewItems: [],
            selected: []
        };
    },
    created() {
        // 문자열로 형태로 items의 값이 전달되었을 경우, 리스트 형태로 변환해서 반영시키기 위해서
        if(typeof(this.items) === "string")
            this.viewItems = JSON.parse(this.items.replace(/'/g, '"'))
        else
            this.viewItems = this.items
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>

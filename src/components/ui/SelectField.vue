<template>
    <div>
        <v-select
            :label="label"
            :items="viewItems"
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
            viewItems: []
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

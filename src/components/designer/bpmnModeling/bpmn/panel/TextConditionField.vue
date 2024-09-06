<template>
    <div>
        <v-text-field v-model="condition" />
    </div>
</template>

<script>
export default {
    props: {
        value: String
    },
    data() {
        return {
            condition: ''
        };
    },
    watch: {
        condition: {
            deep: true,
            handler(val) {
                console.log(val);
                this.$emit('update:value', val);
            }
        }
    },
    created() {
        if (this.value) {
            this.condition = this.value;
        } else {
            this.condition = '';
        }
    },
    methods: {
    }
};
</script>

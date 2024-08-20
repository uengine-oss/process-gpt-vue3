<template>
    <div>
        <v-text-field v-model="instruction" label="설명"></v-text-field>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: String,
    },
    data() {
        return {
            instruction: JSON.parse(JSON.stringify(this.modelValue)),            
        };
    },

    watch: {
        instruction: {
            deep: true,
            handler(newValue) {
                this.$emit('update:modelValue', newValue);
            }
        }
    },
    methods: {
    }
};
</script>

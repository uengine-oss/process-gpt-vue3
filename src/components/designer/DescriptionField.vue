<template>
    <div>
        <v-textarea v-model="description" label="설명" rows="3"></v-textarea>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: String,
    },
    data() {
        return {
            description: this.modelValue ? JSON.parse(JSON.stringify(this.modelValue)) : '',            
        };
    },

    watch: {
        description: {
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

<template>
    <div class="mt-4">
        <h6 class="text-h6 mb-2">Instruction</h6>
        <v-text-field v-model="instruction" v-bind="$attrs"></v-text-field>
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

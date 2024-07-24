<template>
    <div v-if="inputItems.length > 0" class="input-group" style="width: 100%;">
        <div v-for="item in inputItems" :key="item.key" class="pa-1">
            <v-text-field
                v-model="item.value"
                :label="item.key"
                :disabled="isComplete"
                hide-details
            ></v-text-field>
        </div>
    </div>
    <div v-else>
        <div class="d-flex justify-center">
            <v-subheader class="text-center">No input fields available</v-subheader>
        </div>
    </div>
</template>

<script>
export default {
    props:{
        inputItems: {
            type: Array,
            default: function () {
                return []
            },
        },
        isComplete: Boolean,
    },
}
</script>


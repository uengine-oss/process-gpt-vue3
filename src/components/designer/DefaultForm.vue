<template>
    <div v-if="inputItems.length > 0" class="input-group" style="width: 100%;">
        <v-row v-for="item in inputItems" :key="item.name">
            <v-col cols="4">
                <v-list-subheader>{{item.name}}</v-list-subheader>
            </v-col>
            <v-col cols="8">
                <v-text-field
                    v-model="item.value"
                    :disabled="isComplete"
                ></v-text-field>
            </v-col>
        </v-row>
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


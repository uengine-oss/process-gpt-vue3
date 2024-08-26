<template>
    <div v-if="inputItems.length > 0" class="input-group" style="width: 100%;">
        <div v-for="item in inputItems" :key="item.key" class="pa-1">
            <div v-if="Array.isArray(item.value)">
                <v-card outlined class="pa-3 mb-3">
                    <div class="d-flex align-center">
                        <div class="flex-grow-1 mt-2" style="font-size: 24px; height: 24px; width: 50px;">{{item.key}}</div>
                        <v-btn @click="addSubItem(item)" class="mdi mdi-plus ml-2" style="font-size: 36px; height: 36px; width: 24px; color: green;"></v-btn>
                    </div>
                    <template v-for="(subItem, index) in item.value" :key="index">
                        <div class="d-flex align-center mt-2">
                            <v-text-field
                                v-model="item.value[index]"
                                :disabled="isComplete"
                                hide-details
                                class="flex-grow-1 mr-2"
                                outlined
                            ></v-text-field>
                            <v-btn @click="deleteSubItem(item, index)" class="mdi mdi-minus ml-2" style="font-size: 36px; height: 36px; width: 24px; color: red;"></v-btn>
                        </div>
                    </template>
                </v-card>
            </div>
            <v-text-field
                v-else
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
    methods: {
        addSubItem(item) {
            item.value.push('');
        },
        deleteSubItem(item, index) {
            item.value.splice(index, 1);
        }
    }
}
</script>


<template>
    <div>
        <h6 class="text-body-1 ml-2">체크포인트</h6>
        <div class="check-points-field-box">
            <div v-for="(checkpoint, idx) in checkpoints" :key="idx">
                <v-text-field v-model="checkpoints[idx]">
                    <template v-slot:prepend-inner>
                        <span>{{ idx + 1 }}. </span>
                    </template>
                    <template v-slot:append-inner>
                        <v-icon @click="addCheckpoint()" class="mr-2">mdi-plus</v-icon>
                        <v-icon @click="deleteCheckpoint(idx)">mdi-delete</v-icon>
                    </template>
                </v-text-field>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: {
            type: Array,
            default: () => [ "" ]
        }
    },
    data() {
        return {
            checkpoints: JSON.parse(JSON.stringify(this.modelValue)),            
        };
    },
    watch: {
        checkpoints: {
            deep: true,
            handler(newValue) {
                this.$emit('update:modelValue', newValue);
            }
        }
    },
    methods: {
        addCheckpoint() {
            this.checkpoints.push("");
        },
        deleteCheckpoint(index) {
            if (index > -1) {
                this.checkpoints.splice(index, 1);
            }
        },
    }
};
</script>

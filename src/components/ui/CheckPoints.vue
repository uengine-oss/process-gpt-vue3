<template>
    <v-sheet v-if="checkPoints" class="mt-auto pa-3 border border-success rounded">
        <div class="text-success font-weight-semibold">
            <v-icon class="mr-2">$success</v-icon>
            CheckPoint ({{ checkedCount }}/{{ checkPoints ? checkPoints.length : 0 }})
        </div>
        <div v-for="(checkPoint, index) in checkPoints" :key="index">
            <v-checkbox v-model="checkPoint.checked" :label="checkPoint.name" hide-details
                density="compact" color="success"></v-checkbox>
        </div>
    </v-sheet>
</template>

<script>
export default {
    props: {
        workItem: {
            type: Object,
            default: function () {
                return {}
            }
        },
    },
    data: () => ({
        checkPoints: null,
    }),
    computed: {
        checkedCount() {
            if (!this.checkPoints) return 0;
            return this.checkPoints.filter((checkPoint) => checkPoint.checked).length;
        },
    },
    watch: {
        workItem(newVal) {
            if (newVal && newVal.activity && newVal.activity.checkpoints) {
                this.checkPoints = newVal.activity.checkpoints.map((checkpoint) => ({
                    name: checkpoint,
                    checked: false
                }));
            }
        }
    },
    created() {
        if (this.workItem && this.workItem.activity.checkpoints) {
            this.checkPoints = this.workItem.activity.checkpoints.map((checkpoint) => ({
                name: checkpoint,
                checked: false
            }));
        }
    }
}
</script>

<template>
    <v-sheet v-if="checkPoints" class="mt-auto pa-3 border border-success rounded">
        <div class="text-success font-weight-semibold">
            <v-icon class="mr-2">$success</v-icon>
            Checkpoints ({{ checkedCount }}/{{ checkPoints ? checkPoints.length : 0 }})
        </div>
        <div v-for="(checkPoint, index) in checkPoints" :key="index" class="mt-2">
            <v-checkbox v-model="checkPoint.checked" hide-details density="compact" color="success">
                <template v-slot:label>
                    <span class="text-body-1" style="line-height: 1.3;">{{ checkPoint.name }}</span>
                </template>
            </v-checkbox>
        </div>
    </v-sheet>
    <v-snackbar v-model="snackbar" class="custom-snackbar" timeout="3000" color="warning" elevation="24" location="top">
        체크포인트를 확인해주세요.
        <template v-slot:actions>
            <v-btn variant="text" @click="snackbar = false">x </v-btn>
        </template>
    </v-snackbar>
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
        snackbar: false,
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
                this.updateCheckpoints();
            }
        }
    },
    created() {
        if (this.workItem && this.workItem.activity.checkpoints) {
            this.checkPoints = this.workItem.activity.checkpoints.map((checkpoint) => ({
                name: checkpoint,
                checked: false
            }));
            this.updateCheckpoints();
        }
    },
    methods: {
        updateCheckpoints() {
            const allChecked = this.checkPoints.every(checkPoint => checkPoint.checked);
            this.$emit('update-checkpoints', allChecked);
        }
    }
}
</script>

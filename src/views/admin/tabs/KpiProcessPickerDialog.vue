<template>
    <v-dialog
        :model-value="modelValue"
        width="60%"
        persistent
        @update:model-value="onDialogToggle"
    >
        <v-card class="picker-card">
            <v-card-title class="d-flex align-center">
                <v-icon color="primary" class="me-2">mdi-sitemap</v-icon>
                <span>프로세스 선택</span>
            </v-card-title>
            <v-divider />

            <KpiProcessPicker v-model="selectedIds" :exclude-ids="excludeIds" class="picker-flex" />

            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="onCancel">취소</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :disabled="selectedIds.length === 0"
                    @click="onConfirm"
                >
                    확인
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, watch } from 'vue';
import KpiProcessPicker from './KpiProcessPicker.vue';

export default defineComponent({
    name: 'KpiProcessPickerDialog',
    components: { KpiProcessPicker },
    props: {
        modelValue: { type: Boolean, default: false },
        initialIds: { type: Array, default: () => [] },
        // 트리에서 숨길 sub-process id 목록 (다른 KPI 목표에 이미 할당된 것 — 본 target 자신은 제외)
        excludeIds: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'confirm'],

    setup(props, { emit }) {
        const selectedIds = ref([...props.initialIds]);

        watch(
            () => props.modelValue,
            (visible) => {
                if (visible) selectedIds.value = [...props.initialIds];
            }
        );

        watch(
            () => props.initialIds,
            (ids) => {
                if (props.modelValue) selectedIds.value = [...(ids || [])];
            }
        );

        function onDialogToggle(value) {
            if (!value) onCancel();
        }
        function onCancel() {
            emit('update:modelValue', false);
        }
        function onConfirm() {
            emit('confirm', [...selectedIds.value]);
            emit('update:modelValue', false);
        }

        return { selectedIds, onDialogToggle, onCancel, onConfirm };
    }
});
</script>

<style scoped>
.picker-card {
    height: 80vh;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.picker-flex {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}
</style>

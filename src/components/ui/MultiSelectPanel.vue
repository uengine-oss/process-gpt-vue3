<template>
    <div v-if="selectedElements.length >= 2" class="multi-select-panel">
        <div class="multi-select-header d-flex align-center pa-2 px-3">
            <v-icon size="18" class="mr-2">mdi-select-multiple</v-icon>
            <span class="text-subtitle-2 font-weight-medium">{{ $t('multiSelect.title') }}</span>
            <v-spacer />
            <v-chip size="x-small" color="primary">
                {{ $t('multiSelect.selectedCount', { n: selectedElements.length }) }}
            </v-chip>
            <v-btn icon variant="text" size="x-small" class="ml-1" @click="$emit('close')">
                <v-icon size="16">mdi-close</v-icon>
            </v-btn>
        </div>
        <div class="multi-select-body pa-3">
            <!-- Duration -->
            <v-text-field
                v-model="editValues.duration"
                :label="$t('multiSelect.duration')"
                :placeholder="durationMixed ? $t('multiSelect.mixed') : ''"
                type="number"
                density="compact"
                variant="outlined"
                class="mb-3"
                hide-details
            ></v-text-field>

            <!-- Future Status -->
            <v-select
                v-model="editValues.futureStatus"
                :label="$t('multiSelect.futureStatus')"
                :placeholder="futureStatusMixed ? $t('multiSelect.mixed') : ''"
                :items="futureStatusOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                class="mb-3"
                hide-details
                clearable
            ></v-select>

            <!-- Cost Type -->
            <v-select
                v-model="editValues.costType"
                :label="$t('multiSelect.costType')"
                :placeholder="costTypeMixed ? $t('multiSelect.mixed') : ''"
                :items="costTypeOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                class="mb-3"
                hide-details
                clearable
            ></v-select>

            <v-btn
                color="primary"
                variant="flat"
                size="small"
                block
                @click="confirmApply"
            >
                {{ $t('multiSelect.applyChanges') }}
            </v-btn>
        </div>

        <!-- Confirm Dialog -->
        <v-dialog v-model="confirmDialog" max-width="400">
            <v-card>
                <v-card-text class="pa-4">
                    {{ confirmMessage }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" size="small" @click="confirmDialog = false">{{ $t('common.cancel') }}</v-btn>
                    <v-btn color="primary" variant="flat" size="small" @click="applyChanges">OK</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    name: 'MultiSelectPanel',
    props: {
        selectedElements: {
            type: Array,
            default: () => []
        }
    },
    emits: ['close', 'applyBatch'],
    data() {
        return {
            editValues: {
                duration: null,
                futureStatus: null,
                costType: null
            },
            confirmDialog: false,
            confirmMessage: ''
        };
    },
    computed: {
        futureStatusOptions() {
            return [
                { title: this.$t('futureStatus.maintain'), value: 'maintain' },
                { title: this.$t('futureStatus.sunset'), value: 'sunset' },
                { title: this.$t('futureStatus.new'), value: 'new' },
                { title: this.$t('futureStatus.automation_planned'), value: 'automation_planned' }
            ];
        },
        costTypeOptions() {
            return [
                { title: this.$t('costType.fte'), value: 'FTE' },
                { title: this.$t('costType.opex'), value: 'OPEX' }
            ];
        },
        durationMixed() {
            return this.hasMixedValues('duration');
        },
        futureStatusMixed() {
            return this.hasMixedValues('futureStatus');
        },
        costTypeMixed() {
            return this.hasMixedValues('costType');
        }
    },
    watch: {
        selectedElements: {
            immediate: true,
            handler() {
                this.loadCommonValues();
            }
        }
    },
    methods: {
        hasMixedValues(field) {
            if (!this.selectedElements.length) return false;
            const values = this.selectedElements.map(el => {
                const props = this.getUengineProperties(el);
                return props?.[field] || null;
            });
            const unique = [...new Set(values)];
            return unique.length > 1;
        },
        getUengineProperties(element) {
            try {
                const bo = element.businessObject;
                if (!bo?.extensionElements?.values) return {};
                const ext = bo.extensionElements.values.find(v => v.$type === 'uengine:Properties');
                if (ext?.text) return JSON.parse(ext.text);
                return {};
            } catch {
                return {};
            }
        },
        loadCommonValues() {
            this.editValues = { duration: null, futureStatus: null, costType: null };
            if (!this.selectedElements.length) return;

            const allProps = this.selectedElements.map(el => this.getUengineProperties(el));
            ['duration', 'futureStatus', 'costType'].forEach(field => {
                const values = allProps.map(p => p[field] || null);
                const unique = [...new Set(values)];
                if (unique.length === 1) {
                    this.editValues[field] = unique[0];
                }
            });
        },
        confirmApply() {
            const changedFields = Object.entries(this.editValues)
                .filter(([, v]) => v !== null && v !== '')
                .map(([k]) => k);

            if (changedFields.length === 0) return;

            this.confirmMessage = this.$t('multiSelect.applyConfirm', {
                n: this.selectedElements.length,
                field: changedFields.join(', ')
            });
            this.confirmDialog = true;
        },
        applyChanges() {
            this.confirmDialog = false;
            const changes = {};
            Object.entries(this.editValues).forEach(([k, v]) => {
                if (v !== null && v !== '') changes[k] = v;
            });
            this.$emit('applyBatch', {
                elements: this.selectedElements,
                changes
            });
        }
    }
};
</script>

<style scoped>
.multi-select-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 300px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
}
.multi-select-header {
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 8px 8px 0 0;
    min-height: 36px;
}
.multi-select-body {
    max-height: 400px;
    overflow-y: auto;
}
</style>

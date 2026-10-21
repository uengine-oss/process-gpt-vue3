<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue';
import {
    DEFAULT_THRESHOLDS,
    THRESHOLD_GROUPS,
    loadThresholds,
    saveThresholds,
    validateThresholds,
    type DashboardThresholds,
    type ThresholdKey
} from '@/services/dashboardThresholdsService';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void;
    (e: 'saved', values: DashboardThresholds): void;
}>();

const instance = getCurrentInstance();
const t = (key: string, params?: Record<string, unknown>) => instance?.proxy?.$t(key, params) || key;

const edit = ref<Record<ThresholdKey, number | string>>({ ...DEFAULT_THRESHOLDS });
const original = ref<DashboardThresholds>({ ...DEFAULT_THRESHOLDS });
const loading = ref(false);
const saving = ref(false);
const errorMsg = ref('');

const errors = computed(() => validateThresholds(edit.value));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const changedKeys = computed(() =>
    (Object.keys(DEFAULT_THRESHOLDS) as ThresholdKey[]).filter((k) => Number(edit.value[k]) !== original.value[k])
);

/** 뷰(진행현황/운영현황/입력정확도)별로 묶어 보여준다 */
const sections = computed(() => {
    const byView = new Map<string, typeof THRESHOLD_GROUPS>();
    for (const g of THRESHOLD_GROUPS) {
        if (!byView.has(g.view)) byView.set(g.view, []);
        byView.get(g.view)!.push(g);
    }
    return Array.from(byView.entries()).map(([view, groups]) => ({ view, groups }));
});

async function onOpen() {
    errorMsg.value = '';
    loading.value = true;
    try {
        const values = await loadThresholds(true);
        original.value = { ...values };
        edit.value = { ...values };
    } catch (e: any) {
        errorMsg.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

function isDefault(key: ThresholdKey) {
    return Number(edit.value[key]) === DEFAULT_THRESHOLDS[key];
}

function resetDefaults() {
    edit.value = { ...DEFAULT_THRESHOLDS };
}

async function save() {
    if (hasErrors.value) return;
    saving.value = true;
    errorMsg.value = '';
    try {
        const values = Object.fromEntries(
            (Object.keys(DEFAULT_THRESHOLDS) as ThresholdKey[]).map((k) => [k, Number(edit.value[k])])
        ) as unknown as DashboardThresholds;
        const saved = await saveThresholds(values);
        emit('saved', saved);
        emit('update:modelValue', false);
    } catch (e: any) {
        errorMsg.value = e?.message || String(e);
    } finally {
        saving.value = false;
    }
}

function close() {
    emit('update:modelValue', false);
}
</script>

<template>
    <v-dialog
        :model-value="props.modelValue"
        max-width="760"
        persistent
        scrollable
        @update:model-value="emit('update:modelValue', $event)"
        @after-enter="onOpen"
    >
        <v-card rounded="lg" class="threshold-dialog">
            <v-card-title class="d-flex align-center ga-2 pa-5 pb-3">
                <v-icon size="20" color="primary">mdi-tune-variant</v-icon>
                <span class="text-h6 font-weight-bold">{{ t('analysisDashboard.thresholds.title') }}</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-5">
                <p class="text-body-2 text-medium-emphasis mb-4">{{ t('analysisDashboard.thresholds.description') }}</p>

                <v-alert v-if="errorMsg" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="errorMsg = ''">
                    {{ errorMsg }}
                </v-alert>

                <div v-if="loading" class="d-flex justify-center py-8">
                    <v-progress-circular indeterminate color="primary" />
                </div>

                <template v-else>
                    <section v-for="section in sections" :key="section.view" class="mb-5">
                        <div class="view-title">{{ section.view }}</div>
                        <div
                            v-for="group in section.groups"
                            :key="group.id"
                            class="group-card"
                            :class="{ 'group-card--error': errors[group.id] }"
                        >
                            <div class="group-head">
                                <span class="group-chart">{{ group.chart }}</span>
                                <span class="group-desc">{{ group.description }}</span>
                            </div>
                            <div class="field-row">
                                <v-text-field
                                    v-for="field in group.fields"
                                    :key="field.key"
                                    v-model="edit[field.key]"
                                    type="number"
                                    :label="field.label"
                                    :suffix="field.unit"
                                    :hint="
                                        isDefault(field.key)
                                            ? field.hint
                                            : `${t('analysisDashboard.thresholds.default')} ${DEFAULT_THRESHOLDS[field.key]}${
                                                  field.hint ? ' · ' + field.hint : ''
                                              }`
                                    "
                                    persistent-hint
                                    variant="outlined"
                                    density="compact"
                                    class="field"
                                    :data-threshold-key="field.key"
                                />
                            </div>
                            <div v-if="errors[group.id]" class="group-error">
                                <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
                                {{ errors[group.id] }}
                            </div>
                        </div>
                    </section>

                    <div class="d-flex align-center ga-2 text-caption text-medium-emphasis">
                        <v-icon size="16">mdi-history</v-icon>
                        {{ t('analysisDashboard.thresholds.auditNote') }}
                    </div>
                </template>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-4">
                <v-btn variant="text" prepend-icon="mdi-restore" :disabled="loading || saving" @click="resetDefaults">
                    {{ t('analysisDashboard.thresholds.resetDefaults') }}
                </v-btn>
                <v-spacer />
                <span v-if="changedKeys.length" class="text-caption text-medium-emphasis mr-2">
                    {{ t('analysisDashboard.thresholds.changedCount', { count: changedKeys.length }) }}
                </span>
                <v-btn variant="text" @click="close">{{ t('analysisDashboard.settings.cancel') }}</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :loading="saving"
                    :disabled="loading || hasErrors || !changedKeys.length"
                    @click="save"
                >
                    {{ t('analysisDashboard.settings.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.view-title {
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
    margin-bottom: 8px;
}
.group-card {
    border: 1px solid #eceff5;
    border-radius: 12px;
    padding: 12px;
    background: #fbfcff;
    margin-bottom: 8px;
}
.group-card--error {
    border-color: rgba(var(--v-theme-error), 0.5);
}
.group-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 12px;
}
.group-chart {
    font-size: 14px;
    font-weight: 600;
}
.group-desc {
    font-size: 12px;
    color: #64748b;
}
.field-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.field {
    flex: 1 1 180px;
}
.group-error {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 12px;
    color: rgb(var(--v-theme-error));
}
</style>

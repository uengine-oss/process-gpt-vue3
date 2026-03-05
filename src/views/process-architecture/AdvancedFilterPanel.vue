<template>
    <!-- Right side panel drawer -->
    <v-navigation-drawer
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        location="right"
        temporary
        width="380"
        class="advanced-filter-panel"
    >
        <div class="panel-header d-flex align-center justify-space-between pa-4 pb-3">
            <div class="d-flex align-center ga-2">
                <v-icon color="primary" size="20">mdi-filter-cog</v-icon>
                <span class="text-subtitle-1 font-weight-bold">{{ $t('processArchitecture.advancedFilter.title') }}</span>
                <v-chip v-if="activeFilterCount > 0" color="primary" size="x-small" variant="flat">
                    {{ activeFilterCount }}
                </v-chip>
            </div>
            <v-btn icon variant="text" size="small" @click="$emit('update:modelValue', false)">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </div>

        <v-divider />

        <div class="panel-body pa-4">
            <!-- Process Status -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.status') }}</div>
                <div class="d-flex flex-wrap ga-1 mt-2">
                    <v-chip
                        v-for="s in STATUS_OPTIONS"
                        :key="s.value"
                        :color="localFilters.statuses.includes(s.value) ? s.color : undefined"
                        :variant="localFilters.statuses.includes(s.value) ? 'flat' : 'outlined'"
                        size="small"
                        class="cursor-pointer"
                        @click="toggleStatus(s.value)"
                    >
                        <v-icon start size="12">{{ s.icon }}</v-icon>
                        {{ s.label }}
                    </v-chip>
                </div>
            </div>

            <v-divider class="mb-4" />

            <!-- Date Range -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.dateRange') }}</div>
                <v-btn-toggle
                    v-model="localFilters.dateMode"
                    density="compact"
                    color="primary"
                    class="mt-2 mb-2"
                    @update:model-value="onDateModeChange"
                >
                    <v-btn value="none" size="x-small">{{ $t('processArchitecture.advancedFilter.dateNone') }}</v-btn>
                    <v-btn value="relative" size="x-small">{{ $t('processArchitecture.advancedFilter.relative') }}</v-btn>
                    <v-btn value="absolute" size="x-small">{{ $t('processArchitecture.advancedFilter.absolute') }}</v-btn>
                </v-btn-toggle>

                <!-- Relative date -->
                <v-select
                    v-if="localFilters.dateMode === 'relative'"
                    v-model="localFilters.relativeDays"
                    :items="RELATIVE_DATE_OPTIONS"
                    item-title="label"
                    item-value="value"
                    :label="$t('processArchitecture.advancedFilter.relativeRange')"
                    variant="outlined"
                    density="compact"
                    hide-details
                />

                <!-- Absolute date -->
                <div v-if="localFilters.dateMode === 'absolute'" class="d-flex ga-2">
                    <v-text-field
                        v-model="localFilters.dateFrom"
                        type="date"
                        :label="$t('processArchitecture.advancedFilter.from')"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                    <v-text-field
                        v-model="localFilters.dateTo"
                        type="date"
                        :label="$t('processArchitecture.advancedFilter.to')"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                </div>
            </div>

            <v-divider class="mb-4" />

            <!-- Ownership Filter -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.ownership') }}</div>
                <v-autocomplete
                    v-model="localFilters.owners"
                    :items="ownerOptions"
                    item-title="label"
                    item-value="email"
                    :label="$t('processArchitecture.advancedFilter.ownerSearch')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    multiple
                    chips
                    closable-chips
                    class="mt-2"
                />
                <v-select
                    v-model="localFilters.ownerRole"
                    :items="OWNER_ROLE_OPTIONS"
                    item-title="label"
                    item-value="value"
                    :label="$t('processArchitecture.advancedFilter.ownerRole')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mt-2"
                />
            </div>

            <v-divider class="mb-4" />

            <!-- Tag Filter -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.tags') }}</div>
                <v-autocomplete
                    v-model="localFilters.tags"
                    :items="availableTags"
                    :label="$t('processArchitecture.advancedFilter.tagSearch')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    multiple
                    chips
                    closable-chips
                    class="mt-2"
                />
            </div>

            <v-divider class="mb-4" />

            <!-- Numerical Range: FTE & Lead-time -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.numericalRange') }}</div>

                <!-- FTE Range -->
                <div class="mt-3">
                    <div class="d-flex justify-space-between align-center mb-1">
                        <span class="text-caption text-grey-darken-1">{{ $t('processArchitecture.advancedFilter.fteRange') }}</span>
                        <span class="text-caption font-weight-medium">
                            {{ localFilters.fteRange[0].toFixed(1) }} – {{ localFilters.fteRange[1].toFixed(1) }}
                        </span>
                    </div>
                    <v-range-slider
                        v-model="localFilters.fteRange"
                        :min="0"
                        :max="10"
                        :step="0.1"
                        color="primary"
                        density="compact"
                        hide-details
                        thumb-size="14"
                    />
                </div>

                <!-- Lead-time Range -->
                <div class="mt-3">
                    <div class="d-flex justify-space-between align-center mb-1">
                        <span class="text-caption text-grey-darken-1">{{ $t('processArchitecture.advancedFilter.leadTimeRange') }}</span>
                        <span class="text-caption font-weight-medium">
                            {{ localFilters.leadTimeRange[0] }} – {{ localFilters.leadTimeRange[1] }} {{ $t('processArchitecture.advancedFilter.days') }}
                        </span>
                    </div>
                    <v-range-slider
                        v-model="localFilters.leadTimeRange"
                        :min="0"
                        :max="365"
                        :step="1"
                        color="primary"
                        density="compact"
                        hide-details
                        thumb-size="14"
                    />
                </div>
            </div>

            <v-divider class="mb-4" />

            <!-- System / OSS Filter -->
            <div class="filter-section mb-4">
                <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.systems') }}</div>
                <v-autocomplete
                    v-model="localFilters.systems"
                    :items="availableSystems"
                    :label="$t('processArchitecture.advancedFilter.systemSearch')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    multiple
                    chips
                    closable-chips
                    class="mt-2"
                />
            </div>

            <v-divider class="mb-4" />

            <!-- Filter Presets -->
            <div class="filter-section mb-2">
                <div class="d-flex align-center justify-space-between">
                    <div class="filter-section-label">{{ $t('processArchitecture.advancedFilter.presets') }}</div>
                    <v-btn
                        variant="text"
                        size="x-small"
                        color="primary"
                        prepend-icon="mdi-content-save-outline"
                        :disabled="activeFilterCount === 0"
                        @click="showSavePreset = true"
                    >
                        {{ $t('processArchitecture.advancedFilter.savePreset') }}
                    </v-btn>
                </div>

                <!-- Preset chips -->
                <div v-if="presets.length > 0" class="d-flex flex-wrap ga-1 mt-2">
                    <v-chip
                        v-for="preset in presets"
                        :key="preset.name"
                        :color="activePresetName === preset.name ? 'primary' : undefined"
                        :variant="activePresetName === preset.name ? 'flat' : 'outlined'"
                        size="small"
                        class="cursor-pointer"
                        closable
                        @click="applyPreset(preset)"
                        @click:close.stop="deletePreset(preset.name)"
                    >
                        {{ preset.name }}
                    </v-chip>
                </div>
                <div v-else class="text-caption text-grey mt-2">
                    {{ $t('processArchitecture.advancedFilter.noPresets') }}
                </div>

                <!-- Save preset dialog -->
                <v-dialog v-model="showSavePreset" max-width="320">
                    <v-card>
                        <v-card-title class="text-subtitle-1 pa-4 pb-2">
                            {{ $t('processArchitecture.advancedFilter.savePresetTitle') }}
                        </v-card-title>
                        <v-card-text class="pa-4 pt-2">
                            <v-text-field
                                v-model="newPresetName"
                                :label="$t('processArchitecture.advancedFilter.presetName')"
                                variant="outlined"
                                density="compact"
                                autofocus
                                @keyup.enter="savePreset"
                            />
                        </v-card-text>
                        <v-card-actions class="pa-4 pt-0">
                            <v-spacer />
                            <v-btn variant="text" @click="showSavePreset = false">{{ $t('common.cancel') }}</v-btn>
                            <v-btn color="primary" variant="flat" :disabled="!newPresetName.trim()" @click="savePreset">
                                {{ $t('common.save') }}
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </div>
        </div>

        <v-divider />

        <!-- Actions -->
        <div class="panel-footer d-flex ga-2 pa-4">
            <v-btn variant="outlined" size="small" @click="resetFilters" :disabled="activeFilterCount === 0">
                {{ $t('processArchitecture.advancedFilter.reset') }}
            </v-btn>
            <v-spacer />
            <v-btn color="primary" variant="flat" size="small" @click="applyFilters">
                {{ $t('processArchitecture.advancedFilter.apply') }}
                <template v-if="activeFilterCount > 0">&nbsp;({{ activeFilterCount }})</template>
            </v-btn>
        </div>
    </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance } from 'vue';

const _inst = getCurrentInstance()!;
const t = (key: string) => _inst.proxy!.$t(key);

const props = defineProps<{
    modelValue: boolean;
    ownerOptions?: Array<{ email: string; label: string }>;
    availableTags?: string[];
    availableSystems?: string[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'apply', filters: AdvancedFilters): void;
}>();

export interface AdvancedFilters {
    statuses: string[];
    dateMode: 'none' | 'relative' | 'absolute';
    relativeDays: number | null;
    dateFrom: string;
    dateTo: string;
    owners: string[];
    ownerRole: 'any' | 'primary' | 'co' | 'master';
    tags: string[];
    fteRange: [number, number];
    leadTimeRange: [number, number];
    systems: string[];
}

const PRESETS_KEY = 'process_arch_filter_presets';

const STATUS_OPTIONS = computed(() => [
    { value: 'draft', label: t('processArchitecture.advancedFilter.statusDraft'), color: 'grey', icon: 'mdi-pencil-outline' },
    { value: 'review', label: t('processArchitecture.advancedFilter.statusReview'), color: 'orange', icon: 'mdi-eye-outline' },
    { value: 'public_review', label: t('processArchitecture.advancedFilter.statusPublicReview'), color: 'blue', icon: 'mdi-account-group-outline' },
    { value: 'published', label: t('processArchitecture.advancedFilter.statusPublished'), color: 'success', icon: 'mdi-check-circle-outline' },
    { value: 'wip', label: t('processArchitecture.advancedFilter.statusWip'), color: 'amber', icon: 'mdi-wrench-outline' }
]);

const RELATIVE_DATE_OPTIONS = computed(() => [
    { value: 7, label: t('processArchitecture.advancedFilter.last7days') },
    { value: 30, label: t('processArchitecture.advancedFilter.last30days') },
    { value: 90, label: t('processArchitecture.advancedFilter.last90days') },
    { value: 180, label: t('processArchitecture.advancedFilter.last180days') }
]);

const OWNER_ROLE_OPTIONS = computed(() => [
    { value: 'any', label: t('processArchitecture.advancedFilter.ownerRoleAny') },
    { value: 'primary', label: t('processArchitecture.advancedFilter.ownerRolePrimary') },
    { value: 'co', label: t('processArchitecture.advancedFilter.ownerRoleCo') },
    { value: 'master', label: t('processArchitecture.advancedFilter.ownerRoleMaster') }
]);

function defaultFilters(): AdvancedFilters {
    return {
        statuses: [],
        dateMode: 'none',
        relativeDays: 30,
        dateFrom: '',
        dateTo: '',
        owners: [],
        ownerRole: 'any',
        tags: [],
        fteRange: [0, 10],
        leadTimeRange: [0, 365],
        systems: []
    };
}

const localFilters = ref<AdvancedFilters>(defaultFilters());

// Systems list: use prop if provided, otherwise empty
const availableSystems = computed(() => props.availableSystems || []);

// Presets management (persisted in localStorage)
interface FilterPreset {
    name: string;
    filters: AdvancedFilters;
}

const presets = ref<FilterPreset[]>(loadPresets());
const activePresetName = ref<string | null>(null);
const showSavePreset = ref(false);
const newPresetName = ref('');

function loadPresets(): FilterPreset[] {
    try {
        const raw = localStorage.getItem(PRESETS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function savePresets(list: FilterPreset[]) {
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    } catch {}
}

function savePreset() {
    const name = newPresetName.value.trim();
    if (!name) return;
    const existing = presets.value.findIndex(p => p.name === name);
    const newPreset = { name, filters: JSON.parse(JSON.stringify(localFilters.value)) };
    if (existing >= 0) {
        presets.value[existing] = newPreset;
    } else {
        presets.value.push(newPreset);
    }
    savePresets(presets.value);
    activePresetName.value = name;
    showSavePreset.value = false;
    newPresetName.value = '';
}

function applyPreset(preset: FilterPreset) {
    localFilters.value = JSON.parse(JSON.stringify(preset.filters));
    activePresetName.value = preset.name;
}

function deletePreset(name: string) {
    presets.value = presets.value.filter(p => p.name !== name);
    savePresets(presets.value);
    if (activePresetName.value === name) activePresetName.value = null;
}

// Active filter count
const activeFilterCount = computed(() => {
    let count = 0;
    const f = localFilters.value;
    if (f.statuses.length > 0) count++;
    if (f.dateMode !== 'none') count++;
    if (f.owners.length > 0) count++;
    if (f.tags.length > 0) count++;
    if (f.fteRange[0] !== 0 || f.fteRange[1] !== 10) count++;
    if (f.leadTimeRange[0] !== 0 || f.leadTimeRange[1] !== 365) count++;
    if (f.systems.length > 0) count++;
    return count;
});

function toggleStatus(value: string) {
    const idx = localFilters.value.statuses.indexOf(value);
    if (idx >= 0) {
        localFilters.value.statuses.splice(idx, 1);
    } else {
        localFilters.value.statuses.push(value);
    }
    activePresetName.value = null;
}

function onDateModeChange() {
    activePresetName.value = null;
}

function resetFilters() {
    localFilters.value = defaultFilters();
    activePresetName.value = null;
    emit('apply', defaultFilters());
}

function applyFilters() {
    emit('apply', JSON.parse(JSON.stringify(localFilters.value)));
    emit('update:modelValue', false);
}

// Reset preset indicator when filters change manually
watch(localFilters, () => {
    // Intentionally not resetting activePresetName here so chip stays highlighted
}, { deep: true });
</script>

<style scoped>
.advanced-filter-panel {
    overflow: hidden;
}

.panel-header {
    background: #fafafa;
    flex-shrink: 0;
}

.panel-body {
    overflow-y: auto;
    flex: 1;
}

.panel-footer {
    flex-shrink: 0;
    background: #fafafa;
}

.filter-section-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #757575;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}
</style>

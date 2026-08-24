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
                <v-btn-toggle v-model="localFilters.dateMode" density="compact" color="primary" class="mt-2 mb-2">
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
                    item-value="value"
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
import { getStageDef } from '@/utils/processStages';

const _inst = getCurrentInstance()!;
const t = (key: string) => _inst.proxy!.$t(key);

const props = defineProps<{
    modelValue: boolean;
    ownerOptions?: Array<{ value: string; label: string }>;
    availableSystems?: string[];
    initialFilters?: AdvancedFilters;
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
    systems: string[];
}

const STATUS_OPTIONS = computed(() =>
    (['draft', 'in_review', 'public_feedback', 'final_edit', 'published'] as const).map((stage) => {
        const def = getStageDef(stage);
        return {
            value: def.stage,
            label: def.label,
            color: def.vuetifyColor,
            icon: def.icon
        };
    })
);

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
        systems: []
    };
}

const localFilters = ref<AdvancedFilters>(props.initialFilters ? JSON.parse(JSON.stringify(props.initialFilters)) : defaultFilters());

// Sync localFilters when the panel opens (modelValue becomes true)
watch(
    () => props.modelValue,
    (open) => {
        if (open && props.initialFilters) {
            localFilters.value = JSON.parse(JSON.stringify(props.initialFilters));
        }
    }
);

// Systems list: use prop if provided, otherwise empty
const availableSystems = computed(() => props.availableSystems || []);

// Active filter count
const activeFilterCount = computed(() => {
    let count = 0;
    const f = localFilters.value;
    if (f.statuses.length > 0) count++;
    if (f.dateMode !== 'none') count++;
    if (f.owners.length > 0) count++;
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
}

function resetFilters() {
    localFilters.value = defaultFilters();
    emit('apply', defaultFilters());
}

function applyFilters() {
    emit('apply', JSON.parse(JSON.stringify(localFilters.value)));
    emit('update:modelValue', false);
}
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

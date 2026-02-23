<template>
    <v-card elevation="0" class="process-architecture" style="overflow: auto; height: 100%;">
        <!-- Header -->
        <div class="pa-6 pb-0">
            <div class="d-flex align-center justify-space-between mb-1">
                <div>
                    <h4 class="text-h4 font-weight-bold">{{ $t('processArchitecture.title') }}</h4>
                    <p class="text-body-2 text-grey-darken-1 mt-1 mb-0">
                        {{ $t('processArchitecture.subtitle') }}
                    </p>
                </div>
                <div class="d-flex align-center ga-2">
                    <v-btn
                        variant="outlined"
                        size="small"
                        prepend-icon="mdi-download"
                        @click="exportImage"
                    >
                        {{ $t('processArchitecture.export') }}
                    </v-btn>
                    <v-btn
                        color="primary"
                        size="small"
                        prepend-icon="mdi-plus"
                        @click="showNewProcessDialog = true"
                    >
                        {{ $t('processArchitecture.newProcess') }}
                    </v-btn>
                </div>
            </div>

            <!-- Toolbar: View Toggle -->
            <div class="d-flex align-center mt-4 mb-3">
                <v-btn-toggle
                    v-model="activeView"
                    mandatory
                    density="compact"
                    color="primary"
                    class="view-toggle"
                >
                    <v-btn value="card" size="small">
                        <v-icon start size="16">mdi-view-grid-outline</v-icon>
                        {{ $t('processArchitecture.views.card') }}
                    </v-btn>
                    <v-btn value="tree" size="small">
                        <v-icon start size="16">mdi-file-tree</v-icon>
                        {{ $t('processArchitecture.views.tree') }}
                    </v-btn>
                    <v-btn value="matrix" size="small">
                        <v-icon start size="16">mdi-table</v-icon>
                        {{ $t('processArchitecture.views.matrix') }}
                    </v-btn>
                    <v-btn value="hierarchy" size="small">
                        <v-icon start size="16">mdi-sitemap</v-icon>
                        {{ $t('processArchitecture.views.hierarchy') }}
                    </v-btn>
                </v-btn-toggle>
            </div>

            <!-- Search + Domain Filter -->
            <div class="d-flex align-center ga-3 mb-3 flex-wrap">
                <v-text-field
                    v-model="searchQuery"
                    :placeholder="$t('processArchitecture.searchPlaceholder')"
                    prepend-inner-icon="mdi-magnify"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    style="max-width: 320px; min-width: 200px;"
                />
                <v-chip-group v-model="selectedDomainIndex" class="domain-chips">
                    <v-chip
                        :color="selectedDomain === null ? 'primary' : undefined"
                        :variant="selectedDomain === null ? 'flat' : 'outlined'"
                        size="small"
                        @click="selectedDomain = null"
                    >
                        {{ $t('processArchitecture.allDomains') }}
                    </v-chip>
                    <v-chip
                        v-for="domain in domains"
                        :key="domain.id"
                        :color="domain.color || 'grey'"
                        :variant="selectedDomain === domain.name ? 'flat' : 'outlined'"
                        size="small"
                        @click="selectedDomain = selectedDomain === domain.name ? null : domain.name"
                    >
                        {{ domain.name }}
                    </v-chip>
                </v-chip-group>
            </div>

            <!-- Stats Bar -->
            <div class="d-flex align-center ga-4 mb-4 stats-bar flex-wrap">
                <div class="stat-item">
                    <span class="stat-label">{{ $t('processArchitecture.stats.total') }}</span>
                    <span class="stat-value font-weight-bold">{{ stats.total }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <span class="stat-label">{{ $t('processArchitecture.stats.subProcesses') }}</span>
                    <span class="stat-value font-weight-bold">{{ stats.subTotal }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" color="success" class="mr-1">mdi-check-circle</v-icon>
                    <span class="stat-label">{{ $t('processArchitecture.stats.published') }}</span>
                    <span class="stat-value font-weight-bold text-success">{{ stats.published }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" color="orange" class="mr-1">mdi-eye-outline</v-icon>
                    <span class="stat-label">{{ $t('processArchitecture.stats.review') }}</span>
                    <span class="stat-value font-weight-bold text-orange">{{ stats.review }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" color="grey" class="mr-1">mdi-pencil-outline</v-icon>
                    <span class="stat-label">{{ $t('processArchitecture.stats.draft') }}</span>
                    <span class="stat-value font-weight-bold text-grey">{{ stats.draft }}</span>
                </div>
            </div>
        </div>

        <v-divider />

        <!-- Loading -->
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <!-- View Area -->
        <div id="processArchView" class="view-area pa-6" v-if="!loading">
            <ProcessArchCardView
                v-if="activeView === 'card'"
                :procMap="filteredProcMap"
                :domains="domains"
                :processStatuses="processStatuses"
                :selectedDomain="selectedDomain"
                @navigate="navigateToProcess"
            />
            <ProcessArchTreeView
                v-else-if="activeView === 'tree'"
                :procMap="filteredProcMap"
                :domains="domains"
                :processStatuses="processStatuses"
                :selectedDomain="selectedDomain"
                @navigate="navigateToProcess"
            />
            <ProcessArchMatrixView
                v-else-if="activeView === 'matrix'"
                :metricsMap="filteredMetricsMap"
                :processStatuses="processStatuses"
                :selectedDomain="selectedDomain"
                @navigate="navigateToProcess"
            />
            <ProcessArchHierarchyView
                v-else-if="activeView === 'hierarchy'"
                :procMap="filteredProcMap"
                :domains="domains"
                :processStatuses="processStatuses"
                :selectedDomain="selectedDomain"
                @navigate="navigateToProcess"
            />
        </div>

        <!-- New Process Dialog -->
        <NewProcessDialog
            v-model="showNewProcessDialog"
            :procMap="procMap"
            :domains="domains"
            @created="onProcessCreated"
        />
    </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useProcessArchitecture } from './useProcessArchitecture';
import ProcessArchCardView from './ProcessArchCardView.vue';
import ProcessArchTreeView from './ProcessArchTreeView.vue';
import ProcessArchMatrixView from './ProcessArchMatrixView.vue';
import ProcessArchHierarchyView from './ProcessArchHierarchyView.vue';
import NewProcessDialog from './NewProcessDialog.vue';

const {
    procMap,
    loading,
    searchQuery,
    selectedDomain,
    activeView,
    processStatuses,
    domains,
    filteredProcMap,
    filteredMetricsMap,
    stats,
    navigateToProcess,
    loadData
} = useProcessArchitecture();

const showNewProcessDialog = ref(false);
const selectedDomainIndex = ref(undefined);

// Sync chip group index with selectedDomain
watch(selectedDomain, (val) => {
    if (val === null) {
        selectedDomainIndex.value = undefined;
    }
});

loadData();

async function exportImage() {
    try {
        const el = document.getElementById('processArchView');
        if (!el) return;
        const { default: domtoimage } = await import('dom-to-image');
        const blob = await domtoimage.toBlob(el);
        const link = document.createElement('a');
        link.download = 'process-architecture.png';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (e) {
        console.error('Export failed:', e);
    }
}

function onProcessCreated(newProc: { id: string; name: string }) {
    navigateToProcess(newProc.id, newProc.name);
    loadData();
}
</script>

<style scoped>
.process-architecture {
    background: #fafafa;
}

.view-toggle :deep(.v-btn) {
    text-transform: none;
    letter-spacing: 0;
}

.domain-chips :deep(.v-chip) {
    font-weight: 500;
}

.stats-bar {
    padding: 8px 16px;
    background: #f5f5f5;
    border-radius: 8px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.stat-label {
    font-size: 0.8rem;
    color: #757575;
}

.stat-value {
    font-size: 0.9rem;
}

.stat-divider {
    height: 20px;
    opacity: 0.3;
}

.view-area {
    min-height: 400px;
}
</style>

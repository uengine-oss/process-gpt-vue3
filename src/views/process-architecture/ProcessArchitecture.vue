<template>
    <v-card elevation="0" class="process-architecture" style="height: calc(100vh - 130px); overflow: hidden; display: flex; flex-direction: column">
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
                    <!-- Export Dropdown -->
                    <v-menu v-model="showExportMenu" :close-on-content-click="false" location="bottom end">
                        <template #activator="{ props: menuProps }">
                            <v-btn
                                v-bind="menuProps"
                                variant="outlined"
                                size="small"
                                prepend-icon="mdi-download"
                                append-icon="mdi-chevron-down"
                            >
                                {{ $t('processArchitecture.export') }}
                            </v-btn>
                        </template>
                        <v-card min-width="260" class="pa-1">
                            <!-- Export Scope -->
                            <div class="px-3 pt-2 pb-1">
                                <p class="text-caption text-grey font-weight-bold mb-1 text-uppercase">
                                    {{ $t('processArchitecture.exportMenu.scope') }}
                                </p>
                                <v-btn-toggle v-model="exportScope" mandatory density="compact" color="primary" class="w-100">
                                    <v-btn value="visible" size="x-small" class="flex-grow-1">
                                        {{ $t('processArchitecture.exportMenu.visibleOnly') }}
                                    </v-btn>
                                    <v-btn value="full" size="x-small" class="flex-grow-1">
                                        {{ $t('processArchitecture.exportMenu.fullHierarchy') }}
                                    </v-btn>
                                </v-btn-toggle>
                            </div>
                            <v-divider class="my-1" />
                            <!-- Format Options -->
                            <v-list density="compact" class="py-0">
                                <v-list-item
                                    prepend-icon="mdi-microsoft-excel"
                                    :title="$t('processArchitecture.exportMenu.excel')"
                                    :subtitle="$t('processArchitecture.exportMenu.excelDesc')"
                                    @click="runExport('excel')"
                                />
                                <v-list-item
                                    prepend-icon="mdi-file-pdf-box"
                                    :title="$t('processArchitecture.exportMenu.pdf')"
                                    :subtitle="$t('processArchitecture.exportMenu.pdfDesc')"
                                    @click="runExport('pdf')"
                                />
                                <v-list-item
                                    prepend-icon="mdi-image-outline"
                                    :title="$t('processArchitecture.exportMenu.png')"
                                    :subtitle="$t('processArchitecture.exportMenu.pngDesc')"
                                    @click="runExport('png')"
                                />
                                <v-list-item
                                    prepend-icon="mdi-code-json"
                                    :title="$t('processArchitecture.exportMenu.json')"
                                    :subtitle="$t('processArchitecture.exportMenu.jsonDesc')"
                                    @click="runExport('json')"
                                />
                                <v-list-item
                                    prepend-icon="mdi-chart-timeline-variant"
                                    :title="$t('processArchitecture.exportMenu.mermaid')"
                                    :subtitle="$t('processArchitecture.exportMenu.mermaidDesc')"
                                    @click="runExport('mermaid')"
                                />
                            </v-list>
                            <v-divider class="my-1" />
                            <div v-if="exporting" class="d-flex align-center ga-2 px-3 py-2">
                                <v-progress-circular size="14" width="2" indeterminate color="primary" />
                                <span class="text-caption text-grey">{{ $t('processArchitecture.exportMenu.exporting') }}</span>
                            </div>
                        </v-card>
                    </v-menu>
                    <v-btn v-if="isAdmin" color="primary" size="small" prepend-icon="mdi-plus" @click="showNewProcessDialog = true">
                        {{ $t('processArchitecture.newProcess') }}
                    </v-btn>
                </div>
            </div>

            <!-- Toolbar: View Toggle + To-Be Toggle -->
            <div class="d-flex align-center justify-space-between mt-4 mb-3 flex-wrap ga-2">
                <v-btn-toggle v-model="activeView" mandatory density="compact" color="primary" class="view-toggle">
                    <v-btn value="card" size="small">
                        <v-icon start size="16">mdi-view-grid-outline</v-icon>
                        {{ $t('processArchitecture.views.card') }}
                    </v-btn>
                    <v-btn value="matrix" size="small">
                        <v-icon start size="16">mdi-table</v-icon>
                        {{ $t('processArchitecture.views.matrix') }}
                    </v-btn>
                    <v-btn value="tree" size="small">
                        <v-icon start size="16">mdi-file-tree</v-icon>
                        {{ $t('processArchitecture.views.tree') }}
                    </v-btn>
                    <v-btn value="mermaid" size="small">
                        <v-icon start size="16">mdi-chart-timeline-variant</v-icon>
                        {{ $t('processArchitecture.views.hierarchy') }}
                    </v-btn>
                </v-btn-toggle>

                <!-- To-Be Toggle -->
                <v-chip
                    :color="showToBe ? 'deep-purple' : 'grey'"
                    :variant="showToBe ? 'flat' : 'outlined'"
                    size="small"
                    class="tobe-toggle-chip"
                    @click="showToBe = !showToBe"
                    prepend-icon="mdi-swap-horizontal"
                >
                    {{ $t('processArchitecture.toBeToggle') }}
                </v-chip>
                <v-btn
                    v-if="isAdmin"
                    :color="showRestructureMode ? 'deep-orange' : undefined"
                    :variant="showRestructureMode ? 'flat' : 'outlined'"
                    size="small"
                    prepend-icon="mdi-source-branch"
                    class="text-none"
                    @click="showRestructureMode = !showRestructureMode"
                >
                    {{ showRestructureMode ? 'Re-structuring On' : 'Re-structuring Mode' }}
                </v-btn>
            </div>

            <ProcessArchRestructureStudio
                v-if="showRestructureMode && isAdmin"
                :procMap="procMap"
                :maintenanceMode="maintenanceMode"
                @applyDraft="applyRestructureDraft"
                @scheduleCutover="scheduleRestructureDraft"
                @openSystemOps="openSystemOperations"
                @openReviewBoard="openReviewBoard"
            />

            <!-- Search + Domain Filter -->
            <div class="d-flex align-center ga-3 mb-3 flex-wrap">
                <!-- Smart Search Bar -->
                <div class="smart-search-wrapper" ref="searchWrapperRef">
                    <v-text-field
                        v-model="searchQuery"
                        :placeholder="$t('processArchitecture.searchPlaceholder')"
                        prepend-inner-icon="mdi-magnify"
                        variant="outlined"
                        density="compact"
                        hide-details
                        clearable
                        style="max-width: 320px; min-width: 200px"
                        @focus="onSearchFocus"
                        @input="onSearchInput"
                    />
                    <!-- Smart Dropdown -->
                    <div v-if="showSearchDropdown && topRecentlyViewed.length > 0 && !searchQuery" class="search-dropdown elevation-4">
                        <div class="search-dropdown-header">
                            {{ $t('processArchitecture.search.recentlyViewed') }}
                        </div>
                        <v-list density="compact" class="py-0">
                            <v-list-item
                                v-for="item in topRecentlyViewed"
                                :key="item.id"
                                class="search-dropdown-item"
                                @click="handleRecentItemClick(item)"
                            >
                                <template #prepend>
                                    <v-icon size="16" color="grey-darken-1">mdi-history</v-icon>
                                </template>
                                <v-list-item-title class="text-body-2">{{ item.name }}</v-list-item-title>
                                <v-list-item-subtitle class="text-caption text-grey">{{ item.id }}</v-list-item-subtitle>
                                <template #append>
                                    <v-btn
                                        :icon="isFavorite(item.id) ? 'mdi-star' : 'mdi-star-outline'"
                                        :color="isFavorite(item.id) ? 'amber' : 'grey-lighten-1'"
                                        size="x-small"
                                        variant="text"
                                        @click.stop="toggleFavorite(item.id)"
                                    />
                                </template>
                            </v-list-item>
                        </v-list>
                    </div>
                </div>

                <!-- Advanced Filters button -->
                <v-btn
                    :color="hasAdvancedFilters ? 'primary' : undefined"
                    :variant="hasAdvancedFilters ? 'flat' : 'outlined'"
                    size="small"
                    prepend-icon="mdi-filter-cog"
                    @click="showAdvancedFilter = true"
                >
                    {{ $t('processArchitecture.advancedFilter.button') }}
                    <v-chip v-if="hasAdvancedFilters" size="x-small" color="white" class="ml-1">
                        {{ advancedFilterCount }}
                    </v-chip>
                </v-btn>

                <!-- My Processes Filter (inline chips) -->
                <div class="d-flex align-center ga-1">
                    <v-chip
                        :color="myProcessFilter.favorites ? 'amber-darken-2' : undefined"
                        :variant="myProcessFilter.favorites ? 'flat' : 'outlined'"
                        size="small"
                        prepend-icon="mdi-star"
                        @click="toggleMyProcessChip('favorites')"
                    >
                        {{ $t('processArchitecture.myProcesses.favorites') }}
                    </v-chip>
                    <v-chip
                        :color="myProcessFilter.myCreation ? 'primary' : undefined"
                        :variant="myProcessFilter.myCreation ? 'flat' : 'outlined'"
                        size="small"
                        prepend-icon="mdi-account-edit"
                        @click="toggleMyProcessChip('myCreation')"
                    >
                        {{ $t('processArchitecture.myProcesses.myCreation') }}
                    </v-chip>
                    <v-chip
                        :color="myProcessFilter.myOrganization ? 'teal' : undefined"
                        :variant="myProcessFilter.myOrganization ? 'flat' : 'outlined'"
                        size="small"
                        prepend-icon="mdi-account-group"
                        @click="toggleMyProcessChip('myOrganization')"
                    >
                        {{ $t('processArchitecture.myProcesses.myOrganization') }}
                    </v-chip>
                </div>

                <!-- Multi-select Domain Filter -->
                <div class="domain-filter-wrapper d-flex align-center flex-wrap ga-1">
                    <v-chip
                        :color="!selectedDomains || selectedDomains.length === 0 ? 'primary' : undefined"
                        :variant="!selectedDomains || selectedDomains.length === 0 ? 'flat' : 'outlined'"
                        size="small"
                        @click="selectedDomains = []"
                    >
                        {{ $t('processArchitecture.allDomains') }}
                    </v-chip>
                    <v-chip
                        v-for="domain in domains"
                        :key="domain.id"
                        :color="domain.color || 'grey'"
                        :variant="selectedDomains?.includes(domain.name) ? 'flat' : 'outlined'"
                        size="small"
                        @click="toggleDomain(domain.name)"
                    >
                        {{ domain.name }}
                    </v-chip>
                    <!-- 도메인 추가 (PAL 모드 + 관리자) — 주변 칩과 동일 스타일 -->
                    <v-chip
                        v-if="isAdmin && isPalMode"
                        size="small"
                        variant="outlined"
                        color="grey"
                        class="domain-add-chip"
                        prepend-icon="mdi-plus"
                        clickable
                        @click="openDomainAddDialog"
                    >
                        {{ $t('metricsView.addDomain') || '도메인 추가' }}
                    </v-chip>
                </div>

                <!-- Quick Filters -->
                <div class="quick-filters d-flex align-center flex-wrap ga-1">
                    <span class="text-caption text-grey mr-1">{{ $t('processArchitecture.quickFilters.label') }}:</span>
                    <v-chip
                        :color="quickFilterNeedFeedback ? 'orange' : undefined"
                        :variant="quickFilterNeedFeedback ? 'flat' : 'outlined'"
                        size="small"
                        prepend-icon="mdi-bullhorn-outline"
                        @click="quickFilterNeedFeedback = !quickFilterNeedFeedback"
                    >
                        {{ $t('processArchitecture.quickFilters.needFeedback') }}
                    </v-chip>
                    <v-chip
                        :color="quickFilterWIL ? 'deep-purple' : undefined"
                        :variant="quickFilterWIL ? 'flat' : 'outlined'"
                        size="small"
                        prepend-icon="mdi-robot-outline"
                        @click="quickFilterWIL = !quickFilterWIL"
                    >
                        {{ $t('processArchitecture.quickFilters.wil') }}
                    </v-chip>
                </div>
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

        <!-- View Area (스크롤 영역) -->
        <div id="processArchView" class="view-area pa-6" v-if="!loading" style="flex: 1; min-height: 0; overflow: hidden">
            <!-- Empty State -->
            <div v-if="isFilteredEmpty" class="empty-state">
                <svg class="empty-state-illustration" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="30" y="40" width="140" height="90" rx="8" fill="#f0f4ff" stroke="#c5cae9" stroke-width="2" />
                    <rect x="50" y="60" width="60" height="8" rx="4" fill="#c5cae9" />
                    <rect x="50" y="76" width="100" height="6" rx="3" fill="#e8eaf6" />
                    <rect x="50" y="90" width="80" height="6" rx="3" fill="#e8eaf6" />
                    <circle cx="155" cy="50" r="22" fill="#fff" stroke="#c5cae9" stroke-width="2" />
                    <line x1="148" y1="43" x2="162" y2="57" stroke="#9fa8da" stroke-width="2.5" stroke-linecap="round" />
                    <line x1="162" y1="43" x2="148" y2="57" stroke="#9fa8da" stroke-width="2.5" stroke-linecap="round" />
                </svg>
                <p class="empty-state-message">{{ $t('processArchitecture.emptyState.message') }}</p>
                <v-btn color="primary" variant="outlined" size="small" prepend-icon="mdi-filter-remove" @click="resetAllFilters">
                    {{ $t('processArchitecture.emptyState.resetFilters') }}
                </v-btn>
            </div>

            <template v-else>
                <ProcessArchCardView
                    v-if="activeView === 'card'"
                    :procMap="filteredProcMap"
                    :domains="domains"
                    :processStatuses="processStatuses"
                    :selectedDomain="selectedDomain"
                    :showToBe="showToBe"
                    :isAdmin="isAdmin"
                    :favorites="favorites"
                    @navigate="navigateToProcess"
                    @toggleFavorite="toggleFavorite"
                />
                <div v-else class="view-scroll-shell">
                    <ProcessArchTreeView
                        v-if="activeView === 'tree'"
                        :procMap="filteredProcMap"
                        :domains="filteredDomainsForViews"
                        :processStatuses="processStatuses"
                        :selectedDomain="selectedDomain"
                        :showToBe="showToBe"
                        :hideDomainRoots="hasActiveDomainFilter"
                        :favorites="favorites"
                        @navigate="navigateToProcess"
                        @moveSub="handleMoveSub"
                        @toggleFavorite="toggleFavorite"
                        @openPermission="handleOpenPermission"
                    />
                    <ProcessArchMatrixView
                        v-else-if="activeView === 'matrix'"
                        :metricsMap="filteredMetricsMap"
                        :processStatuses="processStatuses"
                        :selectedDomain="selectedDomain"
                        :showToBe="showToBe"
                        :favorites="favorites"
                        @navigate="navigateToProcess"
                        @toggleFavorite="toggleFavorite"
                    />
                    <ProcessArchMermaidView
                        v-else-if="activeView === 'mermaid'"
                        :procMap="filteredProcMap"
                        :domains="filteredDomainsForViews"
                        :processStatuses="processStatuses"
                        :selectedDomain="selectedDomain"
                        :hideDomainRoots="hasActiveDomainFilter"
                        :favorites="favorites"
                        @navigate="navigateToProcess"
                        @toggleFavorite="toggleFavorite"
                    />
                </div>
            </template>
        </div>

        <!-- New Process Dialog -->
        <NewProcessDialog v-model="showNewProcessDialog" :procMap="procMap" :domains="domains" @created="onProcessCreated" />

        <!-- Advanced Filter Panel -->
        <AdvancedFilterPanel
            v-model="showAdvancedFilter"
            :owner-options="ownerOptionsForFilter"
            :available-tags="availableTagsForFilter"
            :available-systems="availableSystemsForFilter"
            @apply="onAdvancedFilterApply"
        />

        <!-- Permission Dialog -->
        <v-dialog v-model="permissionDialog" max-width="560" persistent>
            <PermissionDialog
                v-if="permissionDialog && permissionProcess"
                :procDef="permissionProcess"
                :processMap="procMap"
                :metricsMap="metricsMap"
                @close:permissionDialog="permissionDialog = false"
                @saved="permissionDialog = false"
            />
        </v-dialog>

        <!-- Domain Add Dialog -->
        <v-dialog v-model="domainAddDialog.show" max-width="400" persistent>
            <v-card class="pa-4 rounded-lg">
                <v-card-title class="px-0 pt-0 text-h6 font-weight-bold">
                    {{ t('metricsView.addDomain') || '도메인 추가' }}
                </v-card-title>
                <v-text-field
                    v-model="domainAddDialog.name"
                    :label="t('metricsView.domainName') || '도메인 명'"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                    class="mt-2"
                    @keyup.enter="saveDomainAdd"
                    autofocus
                />
                <div class="mt-4">
                    <div class="text-subtitle-2 mb-2">{{ t('processDefinitionMap.selectColor') || '색상 선택' }}</div>
                    <div class="d-flex flex-wrap" style="gap: 8px">
                        <div
                            v-for="color in domainColors"
                            :key="color"
                            class="color-option"
                            :class="{ 'color-selected': domainAddDialog.color === color }"
                            :style="{ backgroundColor: color }"
                            @click="domainAddDialog.color = color"
                        />
                    </div>
                    <v-btn v-if="domainAddDialog.color" variant="text" size="small" class="mt-2" @click="domainAddDialog.color = null">
                        {{ t('common.reset') || '초기화' }}
                    </v-btn>
                </div>
                <v-card-actions class="px-0 pb-0 pt-3">
                    <v-spacer />
                    <v-btn variant="text" @click="domainAddDialog.show = false">{{ t('common.cancel') || '취소' }}</v-btn>
                    <v-btn color="primary" variant="flat" :disabled="!domainAddDialog.name.trim()" @click="saveDomainAdd">
                        {{ t('common.save') || '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Export notification snackbar -->
        <v-snackbar v-model="exportSnackbar.show" :color="exportSnackbar.color" :timeout="exportSnackbar.timeout" location="bottom right">
            <div class="d-flex align-center ga-2">
                <v-progress-circular v-if="exportSnackbar.loading" size="16" width="2" indeterminate color="white" />
                <span>{{ exportSnackbar.message }}</span>
            </div>
        </v-snackbar>
    </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProcessArchitecture } from './useProcessArchitecture';
import { authClaimsState } from '@/utils/authClaims';
import ProcessArchCardView from './ProcessArchCardView.vue';
import ProcessArchTreeView from './ProcessArchTreeView.vue';
import ProcessArchMatrixView from './ProcessArchMatrixView.vue';
import ProcessArchMermaidView from './ProcessArchMermaidView.vue';
import ProcessArchRestructureStudio from './ProcessArchRestructureStudio.vue';
import NewProcessDialog from './NewProcessDialog.vue';
import AdvancedFilterPanel from './AdvancedFilterPanel.vue';
import PermissionDialog from '@/components/apps/definition-map/PermissionDialog.vue';
import type { RecentlyViewedItem } from './useProcessArchitecture';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE
} from '@/views/process-hierarchy/navigation';

const instance = getCurrentInstance()!;
const t = (key: string) => instance.proxy!.$t(key);
const router = useRouter();
const adminStore = useAdminConsoleStore();

const {
    procMap,
    metricsMap,
    loading,
    searchQuery,
    selectedDomain,
    selectedDomains,
    quickFilterNeedFeedback,
    quickFilterWIL,
    activeView,
    processStatuses,
    allProcDefs,
    domains,
    filteredProcMap,
    filteredMetricsMap,
    stats,
    navigateToProcess,
    loadData,
    topRecentlyViewed,
    favorites,
    toggleFavorite,
    isFavorite,
    myProcessFilter,
    loadCurrentUserOrgs,
    showToBe,
    saveProcMap,
    saveMetricsMap,
    advancedFilters
} = useProcessArchitecture();

const isAdmin = computed(() => {
    const role = localStorage.getItem('role');
    return role === 'superAdmin' || authClaimsState.isAdmin;
});

const isPalMode = computed(() => typeof window !== 'undefined' && !!(window as any).$pal);
const maintenanceMode = computed(() => adminStore.maintenanceMode);

const showNewProcessDialog = ref(false);
const showAdvancedFilter = ref(false);
const showRestructureMode = ref(false);
const hasActiveDomainFilter = computed(() => !!selectedDomain.value || selectedDomains.value.length > 0);

const filteredDomainsForViews = computed(() => {
    if (!hasActiveDomainFilter.value) return domains.value;

    const visibleDomainKeys = new Set<string>();
    for (const mega of filteredProcMap.value?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            const domainKey = major.domain || major.domain_id;
            if (domainKey) visibleDomainKeys.add(domainKey);
        }
    }

    return (domains.value || []).filter((domain: any) => visibleDomainKeys.has(domain.name) || visibleDomainKeys.has(domain.id));
});

// Permission dialog state
const permissionDialog = ref(false);
const permissionProcess = ref<any>(null);

function handleOpenPermission(row: any) {
    // Build a procDef-like object with _permLevel so PermissionDialog knows the opening level
    permissionProcess.value = {
        id: row.id,
        name: row.name,
        _permLevel: row.type // 'domain' | 'mega' | 'major' | 'sub'
    };
    permissionDialog.value = true;
}

// 도메인 추가 다이얼로그
const domainAddDialog = ref({
    show: false,
    name: '',
    color: null as string | null
});
const domainColors = [
    '#E53935',
    '#D81B60',
    '#8E24AA',
    '#5E35B1',
    '#3949AB',
    '#1E88E5',
    '#00ACC1',
    '#00897B',
    '#43A047',
    '#7CB342',
    '#FB8C00',
    '#6D4C41'
];

function openDomainAddDialog() {
    domainAddDialog.value = { show: true, name: '', color: null };
}

async function saveDomainAdd() {
    const trimmedName = domainAddDialog.value.name.trim();
    if (!trimmedName) return;
    const current = metricsMap.value || { domains: [], mega_processes: [], processes: [] };
    const domainsList = Array.isArray(current.domains) ? [...current.domains] : [];
    const isDuplicate = domainsList.some((d: any) => (d.name || '').toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
        alert(t('processDefinitionMap.duplicateName') || '동일한 이름이 이미 존재합니다.');
        return;
    }
    const newId = trimmedName.toLowerCase().replace(/[/.]/g, '_');
    const newOrder = domainsList.length + 1;
    domainsList.push({
        id: newId,
        name: trimmedName,
        color: domainAddDialog.value.color,
        order: newOrder
    });
    const updated = {
        ...current,
        domains: domainsList,
        mega_processes: current.mega_processes ?? [],
        processes: current.processes ?? []
    };
    try {
        await saveMetricsMap(updated);
        domainAddDialog.value.show = false;
    } catch (e) {
        console.error('Failed to save domain:', e);
        alert(t('common.saveFailed') || '저장에 실패했습니다.');
    }
}
const selectedDomainIndex = ref(undefined);
const showSearchDropdown = ref(false);
const searchWrapperRef = ref<HTMLElement | null>(null);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Advanced filter helpers
const hasAdvancedFilters = computed(() => {
    const af = advancedFilters.value;
    return (
        af.statuses.length > 0 ||
        af.dateMode !== 'none' ||
        af.owners.length > 0 ||
        af.tags.length > 0 ||
        af.fteRange[0] !== 0 ||
        af.fteRange[1] !== 10 ||
        af.leadTimeRange[0] !== 0 ||
        af.leadTimeRange[1] !== 365 ||
        af.systems.length > 0
    );
});

const advancedFilterCount = computed(() => {
    let count = 0;
    const af = advancedFilters.value;
    if (af.statuses.length > 0) count++;
    if (af.dateMode !== 'none') count++;
    if (af.owners.length > 0) count++;
    if (af.tags.length > 0) count++;
    if (af.fteRange[0] !== 0 || af.fteRange[1] !== 10) count++;
    if (af.leadTimeRange[0] !== 0 || af.leadTimeRange[1] !== 365) count++;
    if (af.systems.length > 0) count++;
    return count;
});

// Owner options for filter panel (derived from loaded proc definitions)
const ownerOptionsForFilter = computed(() => {
    const emails = new Set<string>();
    for (const def of allProcDefs.value) {
        if (def.owner) emails.add(def.owner);
    }
    return [...emails].map((email) => ({ email, label: email }));
});

// Tags from all proc definitions
const availableTagsForFilter = computed(() => {
    const tags = new Set<string>();
    for (const def of allProcDefs.value) {
        for (const tag of def.tags || []) {
            tags.add(tag);
        }
    }
    return [...tags];
});

// Systems/OSS from proc_map sub-processes
const availableSystemsForFilter = computed(() => {
    const systems = new Set<string>();
    const map = procMap.value;
    if (map?.mega_proc_list) {
        for (const mega of map.mega_proc_list) {
            for (const major of mega.major_proc_list || []) {
                for (const sub of major.sub_proc_list || []) {
                    for (const s of sub.systems || sub.oss || []) {
                        systems.add(s);
                    }
                }
            }
        }
    }
    return [...systems];
});

function onAdvancedFilterApply(filters: any) {
    advancedFilters.value = filters;
}

function resetAdvancedFilters() {
    advancedFilters.value = {
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

function toggleDomain(name: string) {
    const idx = selectedDomains.value.indexOf(name);
    if (idx >= 0) {
        selectedDomains.value = selectedDomains.value.filter((d) => d !== name);
    } else {
        selectedDomains.value = [...selectedDomains.value, name];
    }
}

function toggleMyProcessChip(key: 'favorites' | 'myCreation' | 'myOrganization') {
    // Lazily load org info when myOrganization is first toggled
    if (key === 'myOrganization') loadCurrentUserOrgs();

    myProcessFilter.value[key] = !myProcessFilter.value[key];
    const f = myProcessFilter.value;
    myProcessFilter.value.enabled = f.favorites || f.myCreation || f.myOrganization;
}

// Empty state: true when filters/search are active but no results
const isFilteredEmpty = computed(() => {
    const hasFilter =
        searchQuery.value ||
        selectedDomain.value ||
        (selectedDomains.value?.length ?? 0) > 0 ||
        quickFilterNeedFeedback.value ||
        quickFilterWIL.value ||
        myProcessFilter.value.enabled ||
        hasAdvancedFilters.value;
    if (!hasFilter) return false;

    // Check if filteredProcMap has any sub processes
    const map = filteredProcMap.value;
    if (map && map.mega_proc_list) {
        for (const mega of map.mega_proc_list) {
            for (const major of mega.major_proc_list || []) {
                if ((major.sub_proc_list || []).length > 0) return false;
            }
        }
        // Check if any major process itself matched (no sub_proc_list case)
        if (map.mega_proc_list.length > 0) {
            const hasMajors = map.mega_proc_list.some((m: any) => (m.major_proc_list || []).length > 0);
            if (hasMajors) return false;
        }
    }
    return true;
});

function resetAllFilters() {
    searchQuery.value = '';
    selectedDomain.value = null;
    selectedDomainIndex.value = undefined;
    selectedDomains.value = [];
    quickFilterNeedFeedback.value = false;
    quickFilterWIL.value = false;
    myProcessFilter.value.enabled = false;
    myProcessFilter.value.favorites = false;
    myProcessFilter.value.myCreation = false;
    myProcessFilter.value.myOrganization = false;
    resetAdvancedFilters();
}

// Sync chip group index with selectedDomain
watch(selectedDomain, (val) => {
    if (val === null) {
        selectedDomainIndex.value = undefined;
    }
});

function onSearchFocus() {
    showSearchDropdown.value = true;
    document.addEventListener('click', onClickOutside, true);
}

function onSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        // debounce: searchQuery is already v-model bound, filtering happens reactively
        showSearchDropdown.value = !searchQuery.value;
    }, 300);
}

function onClickOutside(e: MouseEvent) {
    if (searchWrapperRef.value && !searchWrapperRef.value.contains(e.target as Node)) {
        showSearchDropdown.value = false;
        document.removeEventListener('click', onClickOutside, true);
    }
}

function handleRecentItemClick(item: RecentlyViewedItem) {
    showSearchDropdown.value = false;
    document.removeEventListener('click', onClickOutside, true);
    navigateToProcess(item.id, item.name);
}

loadData();

onMounted(() => {
    if (isAdmin.value) {
        adminStore.fetchMaintenanceMode();
    }
});

function openSystemOperations() {
    router.push({ name: 'Admin System Operations' });
}

function openReviewBoard() {
    router.push('/review-board');
}

async function handleMoveSub(subId: string, fromMajorId: string, toMajorId: string) {
    // Deep-clone the proc map to avoid mutating the reactive ref directly
    const newMap = JSON.parse(JSON.stringify(procMap.value));
    let movedSub: any = null;

    // Remove sub from source major (keep internal UID unchanged)
    for (const mega of newMap.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            if (major.id === fromMajorId) {
                const idx = (major.sub_proc_list || []).findIndex((s: any) => s.id === subId);
                if (idx >= 0) {
                    movedSub = major.sub_proc_list.splice(idx, 1)[0];
                }
            }
        }
    }

    if (!movedSub) return;

    // Re-number the business ID: newId = toMajorId + '.' + (nextIndex)
    for (const mega of newMap.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            if (major.id === toMajorId) {
                const subs: any[] = major.sub_proc_list || [];
                const maxIdx = subs.reduce((max: number, s: any) => {
                    const prefix = toMajorId + '.';
                    if (s.id?.startsWith(prefix)) {
                        const n = parseInt(s.id.slice(prefix.length), 10);
                        return isNaN(n) ? max : Math.max(max, n);
                    }
                    return max;
                }, 0);
                movedSub.id = `${toMajorId}.${maxIdx + 1}`;
                subs.push(movedSub);
                major.sub_proc_list = subs;
                break;
            }
        }
    }

    await saveProcMap(newMap);
}

function resolveCutoverActor() {
    return (window as any).$userName || (window as any).$user?.email || 'admin';
}

function buildCutoverJobPayload(draft: any, status: 'scheduled' | 'running' | 'completed' | 'failed') {
    return {
        id: `cutover-${draft.id}`,
        draft_id: draft.id,
        title: `Scenario 4 Cut-over · ${draft.operation}`,
        operation: draft.operation,
        approval_type: draft.approvalType || 'structure_restructure',
        approval_title: draft.approvalTitle || draft.summary || 'Scenario 4 cut-over',
        version_label: draft.versionLabel || '',
        status,
        summary: draft.summary || '구조개편 draft cut-over 적용',
        change_summary: draft.changeSummary || [],
        impacted_mega_count: draft.blastRadius?.impactedMegaCount || 0,
        impacted_major_count: draft.blastRadius?.impactedMajorCount || 0,
        impacted_sub_count: draft.blastRadius?.impactedSubCount || 0,
        before_snapshot: draft.beforeSnapshot
            ? {
                  mega_count: draft.beforeSnapshot.megaCount || 0,
                  major_count: draft.beforeSnapshot.majorCount || 0,
                  sub_count: draft.beforeSnapshot.subCount || 0,
                  highlights: draft.beforeSnapshot.highlights || []
              }
            : null,
        after_snapshot: draft.afterSnapshot
            ? {
                  mega_count: draft.afterSnapshot.megaCount || 0,
                  major_count: draft.afterSnapshot.majorCount || 0,
                  sub_count: draft.afterSnapshot.subCount || 0,
                  highlights: draft.afterSnapshot.highlights || []
              }
            : null,
        created_at: draft.createdAt || new Date().toISOString(),
        created_by: resolveCutoverActor(),
        maintenance_message: maintenanceMode.value?.message || ''
    };
}

function scheduleRestructureDraft(draft: any) {
    if (!draft?.id) return;
    const now = new Date().toISOString();
    adminStore.recordCutoverJob({
        ...buildCutoverJobPayload(draft, 'scheduled'),
        scheduled_at: now
    });
}

async function applyRestructureDraft(draft: any) {
    if (!draft?.map) return;
    if (!maintenanceMode.value?.enabled) {
        showExportNotification('maintenance mode를 먼저 활성화해야 구조개편 cut-over를 적용할 수 있습니다.', 'warning');
        return;
    }

    const jobId = `cutover-${draft.id}`;
    const startedAt = new Date().toISOString();
    const actor = resolveCutoverActor();
    adminStore.recordCutoverJob({
        ...buildCutoverJobPayload(draft, 'running'),
        scheduled_at: draft.createdAt || startedAt,
        started_at: startedAt,
        executed_by: actor
    });

    try {
        await saveProcMap(draft.map);
        adminStore.updateCutoverJob(jobId, {
            status: 'completed',
            started_at: startedAt,
            executed_at: new Date().toISOString(),
            executed_by: actor,
            error_message: ''
        });
        await loadData();
        showRestructureMode.value = false;
        showExportNotification('구조개편 target architecture draft가 maintenance cut-over로 반영되었습니다.', 'success');
    } catch (e: any) {
        console.error('Failed to apply restructure draft:', e);
        adminStore.updateCutoverJob(jobId, {
            status: 'failed',
            started_at: startedAt,
            failed_at: new Date().toISOString(),
            executed_by: actor,
            error_message: e?.message || 'unknown error'
        });
        showExportNotification('구조개편 draft 반영에 실패했습니다.', 'error');
    }
}

// --- Export ---
const showExportMenu = ref(false);
const exportScope = ref<'visible' | 'full'>('visible');
const exporting = ref(false);

const LARGE_DATA_THRESHOLD = 500;

const exportSnackbar = ref({
    show: false,
    message: '',
    color: 'primary',
    loading: false,
    timeout: 4000
});

function showExportNotification(message: string, color = 'primary', loading = false, timeout = 4000) {
    exportSnackbar.value = { show: true, message, color, loading, timeout };
}

function countSubProcesses(map: any): number {
    let count = 0;
    if (!map?.mega_proc_list) return count;
    for (const mega of map.mega_proc_list) {
        for (const major of mega.major_proc_list || []) {
            count += (major.sub_proc_list || []).length;
        }
    }
    return count;
}

type ExportFormat = 'excel' | 'pdf' | 'png' | 'json' | 'mermaid';

function getExportProcMap() {
    return exportScope.value === 'visible' ? filteredProcMap.value : procMap.value;
}

function getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Flatten proc_map to row array for tabular exports */
function flattenProcMap(map: any): any[] {
    const rows: any[] = [];
    if (!map?.mega_proc_list) return rows;
    // Build a lookup map from allProcDefs for FTE and system info
    const defLookup = new Map<string, any>();
    for (const def of allProcDefs.value) {
        defLookup.set(def.id, def);
    }
    for (const mega of map.mega_proc_list) {
        for (const major of mega.major_proc_list || []) {
            const domain = major.domain || major.domain_id || '';
            for (const sub of major.sub_proc_list || []) {
                const status = processStatuses.value.get(sub.id);
                const def = defLookup.get(sub.id);
                // FTE: from proc definition fte field or fte_config
                const fte = def?.fte ?? def?.fte_value ?? sub.fte ?? '';
                // OSS/System: from proc definition systems or oss fields
                const oss =
                    (def?.systems || def?.oss_list || sub.systems || [])
                        .map((s: any) => (typeof s === 'string' ? s : s.name || s.id || ''))
                        .join(', ') || '';
                rows.push({
                    pid: sub.id,
                    domain,
                    mega: mega.name || mega.id,
                    major: major.name,
                    sub: sub.name,
                    status: status?.status || '',
                    version: status?.version || '',
                    owner: sub.owner || major.owner || '',
                    fte,
                    oss
                });
            }
        }
    }
    return rows;
}

/** Build Mermaid graph text from proc_map */
function buildMermaidText(map: any): string {
    const lines: string[] = ['graph TD'];
    if (!map?.mega_proc_list) return lines.join('\n');
    for (const mega of map.mega_proc_list) {
        const megaId = `mega_${mega.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
        lines.push(`    ${megaId}["${mega.name || mega.id}"]`);
        for (const major of mega.major_proc_list || []) {
            const majorId = `major_${major.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
            lines.push(`    ${megaId} --> ${majorId}["[${major.id}] ${major.name}"]`);
            for (const sub of major.sub_proc_list || []) {
                const subId = `sub_${sub.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
                lines.push(`    ${majorId} --> ${subId}["[${sub.id}] ${sub.name}"]`);
            }
        }
    }
    return lines.join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function hasScrollableAxis(el: HTMLElement, axis: 'x' | 'y') {
    const style = window.getComputedStyle(el);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    return overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden';
}

async function createExportSnapshotTarget(sourceEl: HTMLElement) {
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-100000px';
    sandbox.style.top = '0';
    sandbox.style.zIndex = '-1';
    sandbox.style.pointerEvents = 'none';
    sandbox.style.background = '#ffffff';
    sandbox.style.padding = '0';
    sandbox.style.margin = '0';

    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.id = `${sourceEl.id || 'process-arch-export'}-snapshot`;
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.minHeight = '0';
    clone.style.background = '#ffffff';

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    const sourceNodes = [sourceEl, ...Array.from(sourceEl.querySelectorAll<HTMLElement>('*'))];
    const clonedNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
    const nodeCount = Math.min(sourceNodes.length, clonedNodes.length);

    for (let i = 0; i < nodeCount; i += 1) {
        const original = sourceNodes[i];
        const copied = clonedNodes[i];

        copied.scrollTop = 0;
        copied.scrollLeft = 0;

        if (original.scrollHeight > original.clientHeight && hasScrollableAxis(original, 'y')) {
            copied.style.height = `${original.scrollHeight}px`;
            copied.style.maxHeight = 'none';
            copied.style.overflowY = 'visible';
        }

        if (original.scrollWidth > original.clientWidth && hasScrollableAxis(original, 'x')) {
            copied.style.width = `${original.scrollWidth}px`;
            copied.style.maxWidth = 'none';
            copied.style.overflowX = 'visible';
        }

        if (copied.classList.contains('cards-list')) {
            copied.style.height = `${original.scrollHeight}px`;
            copied.style.overflowY = 'visible';
        }

        if (
            copied.classList.contains('columns-wrapper') ||
            copied.classList.contains('matrix-scroll-area') ||
            copied.classList.contains('hierarchy-diagram-wrapper')
        ) {
            copied.style.width = `${original.scrollWidth}px`;
            copied.style.overflowX = 'visible';
        }
    }

    clone.style.width = `${Math.max(sourceEl.scrollWidth, sourceEl.clientWidth)}px`;

    await nextTick();

    const width = Math.ceil(Math.max(clone.scrollWidth, clone.clientWidth));
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.clientHeight));

    return {
        target: clone,
        width,
        height,
        cleanup: () => {
            sandbox.remove();
        }
    };
}

async function logExport(format: ExportFormat, scope: string, recordCount?: number) {
    /*
     * Audit log saved to Supabase `export_log` table.
     * If the table does not exist, create it with:
     *
     * CREATE TABLE IF NOT EXISTS export_log (
     *   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     *   user_id     text,
     *   export_format text NOT NULL,
     *   export_scope  text NOT NULL,
     *   exported_at   timestamptz NOT NULL DEFAULT now(),
     *   record_count  integer
     * );
     */
    try {
        const supabase = (window as any).$supabase;
        if (supabase) {
            const userId = (window as any).$user?.id || (window as any).$user?.email || 'unknown';
            await supabase.from('export_log').insert({
                user_id: userId,
                export_format: format,
                export_scope: scope,
                exported_at: new Date().toISOString(),
                record_count: recordCount ?? null
            });
        }
    } catch (e) {
        // Non-blocking: only log to console, do not affect user experience
        console.error('[Export Audit] Failed to save audit log:', e);
    }
}

async function runExport(format: ExportFormat) {
    exporting.value = true;
    showExportMenu.value = false;
    const map = getExportProcMap();
    const ts = getTimestamp();
    const scope = exportScope.value;

    const subCount = countSubProcesses(map);
    const isLargeData = subCount > LARGE_DATA_THRESHOLD;

    if (isLargeData) {
        showExportNotification(t('processArchitecture.exportMenu.processingLargeData'), 'primary', true, -1);
        // Run the heavy export work asynchronously so the UI can update first
        await new Promise<void>((resolve) => {
            const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 0));
            idle(() => resolve());
        });
    }

    try {
        if (format === 'excel') {
            const ExcelJS = await import('exceljs').catch(() => null);
            if (!ExcelJS) {
                alert('exceljs 패키지가 설치되어 있지 않습니다. npm install exceljs 를 실행해주세요.');
                return;
            }
            const rows = flattenProcMap(map);
            const headers = [
                'PID',
                'Domain',
                'Mega Process',
                'Major Process',
                'Sub Process',
                'Status',
                'Version',
                'Owner',
                'FTE',
                'OSS/System'
            ];
            const wsData = [
                headers,
                ...rows.map((r) => [r.pid, r.domain, r.mega, r.major, r.sub, r.status, r.version, r.owner, r.fte, r.oss])
            ];
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Processes');
            worksheet.addRows(wsData);
            worksheet.columns = [12, 18, 24, 24, 24, 14, 12, 18, 10, 20].map((width) => ({ width }));
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            downloadBlob(blob, `process-architecture-${ts}.xlsx`);
        } else if (format === 'json') {
            const json = JSON.stringify(map, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            downloadBlob(blob, `process-architecture-${ts}.json`);
        } else if (format === 'mermaid') {
            const text = buildMermaidText(map);
            const blob = new Blob([text], { type: 'text/plain' });
            downloadBlob(blob, `process-architecture-${ts}.mmd`);
        } else if (format === 'png' || format === 'pdf') {
            const el = document.getElementById('processArchView');
            if (!el) return;
            const { default: domtoimage } = await import('dom-to-image');
            const snapshot = await createExportSnapshotTarget(el);

            try {
                const dataUrl = await domtoimage.toPng(snapshot.target, {
                    bgcolor: '#ffffff',
                    width: snapshot.width,
                    height: snapshot.height,
                    style: {
                        width: `${snapshot.width}px`,
                        height: `${snapshot.height}px`,
                        transform: 'none'
                    }
                });

                if (format === 'png') {
                    // Overlay logo watermark on canvas
                    const img = new Image();
                    img.src = dataUrl;
                    await new Promise((res) => {
                        img.onload = res;
                    });
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0);
                    // Logo: top-left
                    ctx.fillStyle = 'rgba(33, 150, 243, 0.85)';
                    ctx.font = `bold ${Math.max(16, Math.round(img.width * 0.012))}px Arial, sans-serif`;
                    const logoText = 'Process GPT';
                    const padding = 12;
                    const textWidth = ctx.measureText(logoText).width;
                    const textHeight = Math.max(16, Math.round(img.width * 0.012));
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.fillRect(padding - 4, padding - 4, textWidth + 12, textHeight + 10);
                    ctx.fillStyle = 'rgba(33, 150, 243, 0.9)';
                    ctx.fillText(logoText, padding + 2, padding + textHeight);
                    // Timestamp: bottom-right
                    ctx.font = `${Math.max(10, Math.round(img.width * 0.008))}px Arial, sans-serif`;
                    ctx.fillStyle = 'rgba(120,120,120,0.7)';
                    const tsText = `Exported: ${new Date().toLocaleString()}`;
                    const tsWidth = ctx.measureText(tsText).width;
                    ctx.fillText(tsText, img.width - tsWidth - padding, img.height - padding);
                    canvas.toBlob((blob) => {
                        if (blob) downloadBlob(blob, `process-architecture-${ts}.png`);
                    }, 'image/png');
                } else {
                    const jsPDF = await import('jspdf').then((m) => m.default || m.jsPDF).catch(() => null);
                    if (!jsPDF) {
                        const win = window.open('', '_blank');
                        if (win) {
                            win.document.write(`<img src="${dataUrl}" style="max-width:100%" />`);
                            win.document.title = 'Process Architecture';
                        }
                        return;
                    }
                    const img = new Image();
                    img.src = dataUrl;
                    await new Promise((res) => {
                        img.onload = res;
                    });
                    const pdf = new (jsPDF as any)({
                        orientation: img.width > img.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [img.width, img.height]
                    });
                    pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
                    pdf.setFontSize(14);
                    pdf.setTextColor(33, 150, 243);
                    pdf.text('Process GPT', 12, 20);
                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Exported: ${new Date().toLocaleString()}`, img.width - 10, img.height - 6, { align: 'right' });
                    pdf.save(`process-architecture-${ts}.pdf`);
                }
            } finally {
                snapshot.cleanup();
            }
        }

        const rows = flattenProcMap(map);
        await logExport(format, scope, rows.length);
        if (isLargeData) {
            showExportNotification(t('processArchitecture.exportMenu.exportComplete'), 'success', false, 3000);
        }
    } catch (e) {
        console.error(`[Export] ${format} failed:`, e);
        if (isLargeData) {
            showExportNotification(t('processArchitecture.exportMenu.exportFailed'), 'error', false, 3000);
        }
    } finally {
        exporting.value = false;
    }
}

async function onProcessCreated(newProc: { id: string; name: string }) {
    await router.push({
        path: `/process-hierarchy/${encodeURIComponent(newProc.id)}`,
        query: buildProcessHierarchyQuery({
            name: newProc.name,
            entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE,
            mode: PROCESS_HIERARCHY_MODE.EDIT
        })
    });
    loadData();
}
</script>

<style scoped>
.process-architecture {
    background: #ffffff;
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
    display: flex;
    flex-direction: column;
}

.view-scroll-shell {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-right: 4px;
}

.view-scroll-shell > * {
    min-height: 100%;
}

.smart-search-wrapper {
    position: relative;
}

.search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 320px;
    background: #fff;
    border-radius: 8px;
    z-index: 200;
    overflow: hidden;
}

.search-dropdown-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: #757575;
    padding: 8px 16px 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.search-dropdown-item {
    cursor: pointer;
}

.search-dropdown-item:hover {
    background: #f5f5f5;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    gap: 16px;
    text-align: center;
}

.empty-state-illustration {
    width: 160px;
    height: 128px;
    opacity: 0.85;
}

.empty-state-message {
    font-size: 0.95rem;
    color: #757575;
    margin: 0;
}

.tobe-toggle-chip {
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
}
</style>

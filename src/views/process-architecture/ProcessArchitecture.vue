<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header (공통 page-header 패턴) -->
        <div class="page-header pb-0">
            <div class="page-header-left">
                <h1 class="page-title">프로세스 체계도</h1>
                <p class="page-subtitle">프로세스 체계도 기반 트리</p>
            </div>
            <div class="page-header-right">
                <!-- 재구성 모드 -->
                <v-btn
                    v-if="isAdmin"
                    :color="showRestructureMode ? 'deep-orange' : undefined"
                    :variant="showRestructureMode ? 'flat' : 'outlined'"
                    size="small"
                    prepend-icon="mdi-source-branch"
                    class="text-none"
                    @click="showRestructureMode = !showRestructureMode"
                >
                    {{ showRestructureMode ? '재구성 모드 ON' : '재구성 모드' }}
                </v-btn>
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
                <v-btn v-if="canCreateProcess && isEditMode" color="primary" size="small" prepend-icon="mdi-plus" @click="showNewProcessDialog = true">
                    {{ $t('processArchitecture.newProcess') }}
                </v-btn>
                <!-- Edit Mode Toggle -->
                <v-btn
                    v-if="canCreateProcess"
                    :color="isEditMode ? 'deep-orange' : 'primary'"
                    :variant="isEditMode ? 'flat' : 'outlined'"
                    size="small"
                    :prepend-icon="isEditMode ? 'mdi-pencil-off-outline' : 'mdi-pencil-outline'"
                    @click="isEditMode ? exitEditMode() : enterEditMode()"
                >
                    {{ isEditMode ? '편집 종료' : '편집 모드' }}
                </v-btn>
            </div>
        </div>

        <!-- Body -->
        <div class="pa-4 pb-0">
            <ProcessArchRestructureStudio
                v-if="showRestructureMode && isAdmin"
                :procMap="procMap"
                :domains="domains"
                :maintenanceMode="maintenanceMode"
                :cutoverJobs="adminStore.cutoverJobs"
                @applyDraft="applyRestructureDraft"
                @scheduleCutover="scheduleRestructureDraft"
                @openSystemOps="openSystemOperations"
                @openReviewBoard="openReviewBoard"
            />

            <!-- Edit Lock Banner (다른 사용자가 편집 중) -->
            <v-alert
                v-if="editLock.locked && !editLock.isMine"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-3 mb-0"
                icon="mdi-lock-outline"
            >
                <strong>{{ lockDisplayName || editLock.lockedBy }}</strong> 님이 체계도를 편집 중입니다. 편집이 완료될 때까지 수정할 수 없습니다.
            </v-alert>

            <!-- Edit Mode Indicator (내가 편집 중) -->
            <v-alert
                v-else-if="isEditMode"
                type="info"
                variant="tonal"
                density="compact"
                class="mt-3 mb-0"
                icon="mdi-pencil-outline"
                closable
                @click:close="exitEditMode()"
            >
                편집 모드입니다. 체계도를 수정할 수 있습니다.
            </v-alert>

            <!-- View Toggle + Search + Domain Filter -->
            <div class="d-flex align-center ga-3 mb-4 flex-wrap">
                <v-btn-toggle v-model="activeView" mandatory density="compact" color="primary" class="view-toggle">
                    <v-btn value="mermaid" size="small">
                        <v-icon start size="16">mdi-chart-timeline-variant</v-icon>
                        {{ $t('processArchitecture.views.hierarchy') }}
                    </v-btn>
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
                </v-btn-toggle>

                <div class="d-flex align-center flex-wrap ga-3 ms-auto">
                    <!-- Smart Search Bar -->
                    <div class="smart-search-wrapper" ref="searchWrapperRef">
                        <v-text-field
                            v-model="searchInput"
                            :placeholder="$t('processArchitecture.searchPlaceholder')"
                            prepend-inner-icon="mdi-magnify"
                            variant="outlined"
                            density="compact"
                            hide-details
                            clearable
                            style="max-width: 320px; min-width: 320px"
                            @focus="onSearchFocus"
                            @input="onSearchInput"
                            @keydown.enter.prevent="applySearchInput"
                            @click:clear="onSearchClear"
                        />
                        <!-- Smart Dropdown -->
                        <div v-if="showSearchDropdown && topRecentlyViewed.length > 0 && !searchInput" class="search-dropdown elevation-4">
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
                    </div>

                    <!-- Multi-select Domain Filter -->
                    <div class="domain-filter-wrapper d-flex align-center flex-wrap ga-1">
                        <v-chip
                            :color="!selectedDomain && (!selectedDomains || selectedDomains.length === 0) ? 'primary' : undefined"
                            :variant="!selectedDomain && (!selectedDomains || selectedDomains.length === 0) ? 'flat' : 'outlined'"
                            size="small"
                            @click="clearDomainFilters"
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
                </div>
            </div>

            <!-- Stats Bar -->
            <div class="d-flex align-center ga-4 mb-4 stats-bar flex-wrap">
                <div class="stat-item">
                    <span class="stat-label">전체프로세스</span>
                    <span class="stat-value font-weight-bold">{{ stats.subTotal }}개</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" :color="getStageDef('draft').color" class="mr-1">{{ getStageDef('draft').icon }}</v-icon>
                    <span class="stat-label">{{ getStageDef('draft').label }}</span>
                    <span class="stat-value font-weight-bold" :style="{ color: getStageDef('draft').color }">{{ stats.draft }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" :color="getStageDef('in_review').color" class="mr-1">{{ getStageDef('in_review').icon }}</v-icon>
                    <span class="stat-label">{{ getStageDef('in_review').label }}</span>
                    <span class="stat-value font-weight-bold" :style="{ color: getStageDef('in_review').color }">{{ stats.inReview }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" :color="getStageDef('public_feedback').color" class="mr-1">{{ getStageDef('public_feedback').icon }}</v-icon>
                    <span class="stat-label">{{ getStageDef('public_feedback').label }}</span>
                    <span class="stat-value font-weight-bold" :style="{ color: getStageDef('public_feedback').color }">{{ stats.publicFeedback }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" :color="getStageDef('final_edit').color" class="mr-1">{{ getStageDef('final_edit').icon }}</v-icon>
                    <span class="stat-label">{{ getStageDef('final_edit').label }}</span>
                    <span class="stat-value font-weight-bold" :style="{ color: getStageDef('final_edit').color }">{{ stats.finalEdit }}</span>
                </div>
                <v-divider vertical class="stat-divider" />
                <div class="stat-item">
                    <v-icon size="14" :color="getStageDef('published').color" class="mr-1">{{ getStageDef('published').icon }}</v-icon>
                    <span class="stat-label">{{ getStageDef('published').label }}</span>
                    <span class="stat-value font-weight-bold" :style="{ color: getStageDef('published').color }">{{ stats.published }}</span>
                </div>
            </div>
        </div>

        <v-divider />

        <!-- Loading -->
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <!-- View Area (스크롤 영역) -->
        <div id="processArchView" class="view-area pa-4" v-if="!loading" style="flex: 1; min-height: 0; overflow: hidden">
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
                <KeepAlive>
                    <ProcessArchCardView
                        v-if="activeView === 'card'"
                        :procMap="filteredProcMap"
                        :domains="filteredDomainsForViews"
                        :processStatuses="processStatuses"
                        :selectedDomain="selectedDomain"
                        :showToBe="showToBe"
                        :isAdmin="isAdmin"
                        :favorites="favorites"
                        :hideEmptyColumns="hasProcessResultFilter"
                        :isUpdatedSinceLastVisit="isUpdatedSinceLastVisit"
                        :readonly="!isEditMode"
                        :kpiTaggedProcessIds="kpiTaggedProcessIds"
                        @navigate="navigateToProcess"
                        @toggleFavorite="toggleFavorite"
                        @moveSub="handleMoveSub"
                        @moveMajor="handleMoveMajor"
                        @editProcess="openEditProcessDialog"
                        @addProcess="openAddProcessDialog"
                    />
                </KeepAlive>
                <div v-show="activeView !== 'card'" class="view-scroll-shell">
                    <KeepAlive>
                        <ProcessArchTreeView
                            v-if="activeView === 'tree'"
                            :procMap="filteredProcMap"
                            :domains="filteredDomainsForViews"
                            :processStatuses="processStatuses"
                            :selectedDomain="selectedDomain"
                            :showToBe="showToBe"
                            :hideDomainRoots="hideDomainRootsForViews"
                            :favorites="favorites"
                            :searchQuery="searchQuery"
                            :isUpdatedSinceLastVisit="isUpdatedSinceLastVisit"
                            :readonly="!isEditMode"
                            :kpiTaggedProcessIds="kpiTaggedProcessIds"
                            @navigate="navigateToProcess"
                            @moveSub="handleMoveSub"
                            @toggleFavorite="toggleFavorite"
                            @openPermission="handleOpenPermission"
                            @editProcess="openEditProcessDialog"
                            @addProcess="openAddProcessDialog"
                        />
                        <ProcessArchMatrixView
                            v-else-if="activeView === 'matrix'"
                            :procMap="filteredProcMap"
                            :domains="filteredDomainsForViews"
                            :processStatuses="processStatuses"
                            :selectedDomain="selectedDomain"
                            :favorites="favorites"
                            :isUpdatedSinceLastVisit="isUpdatedSinceLastVisit"
                            :readonly="!isEditMode"
                            :kpiTaggedProcessIds="kpiTaggedProcessIds"
                            @navigate="navigateToProcess"
                            @toggleFavorite="toggleFavorite"
                            @editProcess="openEditProcessDialog"
                            @addProcess="openAddProcessDialog"
                        />
                        <ProcessArchMermaidView
                            v-else-if="activeView === 'mermaid'"
                            :procMap="filteredProcMap"
                            :domains="filteredDomainsForViews"
                            :processStatuses="processStatuses"
                            :selectedDomain="selectedDomain"
                            :hideDomainRoots="hideDomainRootsForViews"
                            :favorites="favorites"
                            :isUpdatedSinceLastVisit="isUpdatedSinceLastVisit"
                            :readonly="!isEditMode"
                            :kpiTaggedProcessIds="kpiTaggedProcessIds"
                            @navigate="navigateToProcess"
                            @toggleFavorite="toggleFavorite"
                            @editProcess="openEditProcessDialog"
                            @addProcess="openAddProcessDialog"
                        />
                    </KeepAlive>
                </div>
            </template>
        </div>

        <!-- New Process Dialog -->
        <NewProcessDialog v-model="showNewProcessDialog" :procMap="procMap" :domains="domains" @created="onProcessCreated" />

        <!-- Advanced Filter Panel -->
        <AdvancedFilterPanel
            v-model="showAdvancedFilter"
            :owner-options="ownerOptionsForFilter"
            :available-systems="availableSystemsForFilter"
            :initial-filters="advancedFilters"
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

        <!-- Mega/Major 프로세스 편집/추가 다이얼로그 -->
        <v-dialog v-model="editProcessDialog.show" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <template v-if="editProcessDialog.mode === 'add'">
                        {{ editProcessDialog.type === 'mega' ? '메가 프로세스 추가' : '메이저 프로세스 추가' }}
                    </template>
                    <template v-else>
                        {{ editProcessDialog.type === 'mega' ? '메가 프로세스 편집' : '메이저 프로세스 편집' }}
                    </template>
                </v-card-title>
                <v-card-text class="pa-4 pt-2">
                    <v-text-field
                        v-model="editProcessDialog.name"
                        label="이름"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-4"
                    />
                    <!-- 메이저 프로세스: 도메인 -->
                    <v-select
                        v-if="editProcessDialog.type === 'major'"
                        v-model="editProcessDialog.domain"
                        :items="domains"
                        item-title="name"
                        item-value="name"
                        label="도메인"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-4"
                    />
                    <!-- 메이저 프로세스: 소속 메가 프로세스 -->
                    <v-select
                        v-if="editProcessDialog.type === 'major'"
                        v-model="editProcessDialog.megaId"
                        :items="megaOptionsForEdit"
                        item-title="name"
                        item-value="id"
                        label="소속 메가 프로세스"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-4"
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="editProcessDialog.show = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" :loading="editProcessDialog.saving" @click="saveEditProcess">
                        {{ editProcessDialog.mode === 'add' ? '추가' : '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProcessArchitecture } from './useProcessArchitecture';
import { authClaimsState } from '@/utils/authClaims';
import { resolveRole, isReviewerOrAbove, isOwnerOrAbove } from '@/utils/roles';
import ProcessArchCardView from './ProcessArchCardView.vue';
import ProcessArchTreeView from './ProcessArchTreeView.vue';
import ProcessArchMatrixView from './ProcessArchMatrixView.vue';
import ProcessArchMermaidView from './ProcessArchMermaidView.vue';
import ProcessArchRestructureStudio from './ProcessArchRestructureStudio.vue';
import NewProcessDialog from './NewProcessDialog.vue';
import AdvancedFilterPanel from './AdvancedFilterPanel.vue';
import PermissionDialog from '@/components/apps/definition-map/PermissionDialog.vue';
import { getStageDef } from '@/utils/processStages';
import { formatKST } from '@/utils/datetime';
import { generateProcessId, getNextSequenceFromIds } from '@/utils/processIdGenerator';
import type { RecentlyViewedItem } from './useProcessArchitecture';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE
} from '@/views/process-hierarchy/navigation';
import { getMajorBusinessDomain } from './processClassification';
import { applyMajorStageMove, applySubMajorMove } from './processMapMove';

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
    advancedFilters,
    isUpdatedSinceLastVisit,
    loadProcessStatuses,
    editLock,
    checkEditLock,
    acquireEditLock,
    releaseEditLock
} = useProcessArchitecture();

const searchInput = ref(searchQuery.value);

const isAdmin = computed(() => {
    const role = localStorage.getItem('role');
    return role === 'superAdmin' || authClaimsState.isAdmin;
});

// ---- Edit Mode / Lock ----
const isEditMode = ref(false);
const lockDisplayName = ref('');
let lockCheckTimer: ReturnType<typeof setInterval> | null = null;

async function resolveLockDisplayName(userId: string) {
    if (!userId) { lockDisplayName.value = ''; return; }
    try {
        const supabase = (window as any).$supabase;
        if (!supabase) { lockDisplayName.value = userId; return; }
        const { data } = await supabase
            .from('users')
            .select('username, email')
            .eq('id', userId)
            .eq('tenant_id', (window as any).$tenantName)
            .maybeSingle();
        lockDisplayName.value = data?.username || data?.email || userId;
    } catch {
        lockDisplayName.value = userId;
    }
}

watch(() => editLock.value.lockedBy, (val) => {
    if (val && !editLock.value.isMine) resolveLockDisplayName(val);
    else lockDisplayName.value = '';
});

/** 편집 모드 진입 — lock 획득 시도 */
async function enterEditMode() {
    const result = await acquireEditLock();
    if (result.acquired) {
        isEditMode.value = true;
    } else {
        await checkEditLock();
    }
}

/** 편집 모드 종료 — lock 해제 */
async function exitEditMode() {
    isEditMode.value = false;
    await releaseEditLock();
}

const userRole = computed(() => resolveRole(authClaimsState.isAdmin, authClaimsState.role));
const isViewerOnly = computed(() => !isReviewerOrAbove(userRole.value));
// 프로세스 생성 · 체계도 편집 모드는 owner 이상
// (DB 측 configuration_modify_proc_map_owner / proc_def_insert_editor 정책과 동일 기준)
const canCreateProcess = computed(() => {
    if (isAdmin.value) return true;
    if (isOwnerOrAbove(userRole.value)) return true;
    // SSO claims 보강 전이라도 판단 가능하도록 localStorage 의 resolved role 로 fallback
    return isOwnerOrAbove((localStorage.getItem('role') || '').toLowerCase());
});

const isPalMode = computed(() => typeof window !== 'undefined' && !!(window as any).$pal);
const maintenanceMode = computed(() => adminStore.maintenanceMode);

// 올해 KPI 목표가 할당된 sub-process id → 조직 라벨 매핑
// store 에 다른 연도 항목이 남아있을 수 있어 computed 안에서 올해(year) 한 번 더 필터.
// 라벨: target.org_name (KPI 에 등록된 조직이 이미 고객사 기준 본부로 매핑돼 있어 추가 parent 표시 불필요)
const kpiTaggedProcessIds = computed(() => {
    const currentYear = new Date().getFullYear();
    const map = new Map<string, string>();
    for (const target of (adminStore.kpiTargets as any[]) || []) {
        if (target.year !== currentYear) continue;
        const label = (target.org_name || '').trim();
        for (const pid of target.process_ids || []) {
            const key = pid ? String(pid) : '';
            if (key && !map.has(key)) map.set(key, label);
        }
    }
    return map;
});

const showNewProcessDialog = ref(false);
const showAdvancedFilter = ref(false);
const showRestructureMode = ref(false);
const hasActiveDomainFilter = computed(() => !!selectedDomain.value || selectedDomains.value.length > 0);
const hideDomainRootsForViews = computed(() => false);

const hasProcessResultFilter = computed(() => {
    const af = advancedFilters.value;
    const hasActiveAdvancedFilters =
        af.statuses.length > 0 ||
        af.dateMode !== 'none' ||
        af.owners.length > 0 ||
        af.systems.length > 0;
    const hasFilter =
        !!searchQuery.value ||
        hasActiveDomainFilter.value ||
        quickFilterNeedFeedback.value ||
        quickFilterWIL.value ||
        myProcessFilter.value.enabled ||
        hasActiveAdvancedFilters;
    return hasFilter;
});

const filteredDomainsForViews = computed(() => {
    if (!hasProcessResultFilter.value) return domains.value;

    const visibleDomainKeys = new Set<string>();
    const map = filteredProcMap.value;

    for (const mega of map?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            const domainValue = getMajorBusinessDomain(major, domains.value);
            const matchedDomain = (domains.value || []).find((domain: any) => domain.name === domainValue || domain.id === domainValue);
            if (matchedDomain) {
                if (matchedDomain.name) visibleDomainKeys.add(matchedDomain.name);
                if (matchedDomain.id) visibleDomainKeys.add(matchedDomain.id);
            }
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
        af.systems.length > 0
    );
});

const advancedFilterCount = computed(() => {
    let count = 0;
    const af = advancedFilters.value;
    if (af.statuses.length > 0) count++;
    if (af.dateMode !== 'none') count++;
    if (af.owners.length > 0) count++;
    if (af.systems.length > 0) count++;
    return count;
});

// Owner options for filter panel. Keep the stored identifier as the value,
// but resolve/display username so the autocomplete searches by name.
const ownerOptionsForFilter = ref<Array<{ value: string; label: string }>>([]);

function normalizeOwnerIdentifier(value: unknown): string {
    return String(value ?? '').trim();
}

function addOwnerIdentifier(target: Set<string>, value: unknown) {
    if (Array.isArray(value)) {
        for (const item of value) addOwnerIdentifier(target, item);
        return;
    }

    if (value && typeof value === 'object') {
        const item = value as Record<string, unknown>;
        for (const candidate of [item.id, item.uid, item.user_id, item.email, item.username, item.employee_no, item.name]) {
            addOwnerIdentifier(target, candidate);
        }
        return;
    }

    const identifier = normalizeOwnerIdentifier(value);
    if (identifier) target.add(identifier);
}

function collectOwnerIdentifiersFromProcMap(): Set<string> {
    const identifiers = new Set<string>();
    const map = procMap.value;
    for (const mega of map?.mega_proc_list || []) {
        addOwnerIdentifier(identifiers, mega.owner);
        for (const major of mega.major_proc_list || []) {
            addOwnerIdentifier(identifiers, major.owner);
            for (const sub of major.sub_proc_list || []) {
                addOwnerIdentifier(identifiers, sub.owner);
                addOwnerIdentifier(identifiers, sub.primary_owner);
                addOwnerIdentifier(identifiers, sub.primaryOwner);
                addOwnerIdentifier(identifiers, sub.co_owners);
                addOwnerIdentifier(identifiers, sub.field_owners);
                addOwnerIdentifier(identifiers, sub.hq_owners);
                addOwnerIdentifier(identifiers, sub.master);
                addOwnerIdentifier(identifiers, sub.master_owner);
                addOwnerIdentifier(identifiers, sub.masterOwner);
            }
        }
    }
    return identifiers;
}

watch([allProcDefs, procMap], async ([defs]) => {
    const ownerIdentifiers = collectOwnerIdentifiersFromProcMap();
    for (const def of defs) {
        addOwnerIdentifier(ownerIdentifiers, def.owner);
        addOwnerIdentifier(ownerIdentifiers, def.created_by);
        addOwnerIdentifier(ownerIdentifiers, def.primary_owner);
        addOwnerIdentifier(ownerIdentifiers, def.primaryOwner);
        addOwnerIdentifier(ownerIdentifiers, def.co_owners);
        addOwnerIdentifier(ownerIdentifiers, def.field_owners);
        addOwnerIdentifier(ownerIdentifiers, def.hq_owners);
        addOwnerIdentifier(ownerIdentifiers, def.master);
        addOwnerIdentifier(ownerIdentifiers, def.master_owner);
        addOwnerIdentifier(ownerIdentifiers, def.masterOwner);
        addOwnerIdentifier(ownerIdentifiers, def.definition?.meta?.owners?.primaryOwner);
        addOwnerIdentifier(ownerIdentifiers, def.definition?.meta?.owners?.fieldOwners);
        addOwnerIdentifier(ownerIdentifiers, def.definition?.meta?.owners?.hqOwners);
        addOwnerIdentifier(ownerIdentifiers, def.definition?.meta?.owners?.masterOwner);
    }
    if (ownerIdentifiers.size === 0) {
        ownerOptionsForFilter.value = [];
        return;
    }

    const identifierToName: Record<string, string> = {};
    try {
        const supabase = (window as any).$supabase;
        const tenantId = (window as any).$tenantName;
        if (supabase && tenantId) {
            const { data } = await supabase
                .from('users')
                .select('id, email, username, employee_no')
                .eq('tenant_id', tenantId);
            for (const u of data || []) {
                const displayName =
                    normalizeOwnerIdentifier(u?.username) ||
                    normalizeOwnerIdentifier(u?.email) ||
                    normalizeOwnerIdentifier(u?.employee_no) ||
                    normalizeOwnerIdentifier(u?.id);
                if (!displayName) continue;
                for (const key of [u?.id, u?.email, u?.username, u?.employee_no]) {
                    const identifier = normalizeOwnerIdentifier(key);
                    if (identifier) identifierToName[identifier] = displayName;
                }
            }
        }
    } catch (e) {
        console.warn('[ProcessArchitecture] Failed to resolve owner names:', e);
    }

    ownerOptionsForFilter.value = [...ownerIdentifiers]
        .map((identifier) => ({
            value: identifier,
            label: identifierToName[identifier] || identifier
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}, { immediate: true });

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
        systems: []
    };
}

function toggleDomain(name: string) {
    selectedDomain.value = null;
    const idx = selectedDomains.value.indexOf(name);
    if (idx >= 0) {
        selectedDomains.value = selectedDomains.value.filter((d) => d !== name);
    } else {
        selectedDomains.value = [...selectedDomains.value, name];
    }
}

function clearDomainFilters() {
    selectedDomain.value = null;
    selectedDomains.value = [];
}

function toggleMyProcessChip(key: 'favorites' | 'myCreation' | 'myOrganization') {
    myProcessFilter.value[key] = !myProcessFilter.value[key];
    const f = myProcessFilter.value;
    myProcessFilter.value.enabled = f.favorites || f.myCreation || f.myOrganization;

    // Lazily load current user / team identifiers when my filters are first toggled
    if (key === 'myCreation' || key === 'myOrganization') loadCurrentUserOrgs();
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
    searchInput.value = '';
    searchQuery.value = '';
    selectedDomainIndex.value = undefined;
    clearDomainFilters();
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
        showSearchDropdown.value = !searchInput.value;
    }, 300);
}

function applySearchInput() {
    const keyword = searchInput.value.trim();
    searchInput.value = keyword;
    searchQuery.value = keyword;
    showSearchDropdown.value = false;
}

function onSearchClear() {
    searchInput.value = '';
    searchQuery.value = '';
    showSearchDropdown.value = false;
}

watch(searchQuery, (value) => {
    if (value !== searchInput.value.trim()) {
        searchInput.value = value;
    }
});

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

onMounted(async () => {
    if (isAdmin.value) {
        await Promise.all([adminStore.fetchMaintenanceMode(), adminStore.loadCutoverJobs()]);
    }
    // 올해 KPI 목표 로드 (sub-process 카드의 "동부" 태그 노출용)
    adminStore.fetchKpiTargets(new Date().getFullYear());
    // 진입 시 lock 상태 확인 + 주기적 체크 (30초)
    await checkEditLock();
    lockCheckTimer = setInterval(() => checkEditLock(), 30_000);
});

onUnmounted(() => {
    // 편집 모드면 lock 해제
    if (isEditMode.value) {
        releaseEditLock();
        isEditMode.value = false;
    }
    if (lockCheckTimer) {
        clearInterval(lockCheckTimer);
        lockCheckTimer = null;
    }
});


function openSystemOperations() {
    router.push({ name: 'Admin System Operations' });
}

function openReviewBoard(jobId = '') {
    router.push({
        path: '/review-board/restructure',
        query: jobId ? { jobId } : undefined
    });
}

async function handleMoveSub(subId: string, fromMajorId: string, toMajorId: string) {
    const newMap = JSON.parse(JSON.stringify(procMap.value));
    if (!applySubMajorMove(newMap, subId, fromMajorId, toMajorId)) return;
    await saveProcMap(newMap);
}

async function handleMoveMajor(majorId: string, _megaId: string, newStage: string) {
    const newMap = JSON.parse(JSON.stringify(procMap.value));
    if (!applyMajorStageMove(newMap, { majorId, sourceMegaId: _megaId, newStage, domains: domains.value })) return;
    await saveProcMap(newMap);
}

// ---- 메가/메이저 프로세스 편집 ----
const editProcessDialog = ref({
    show: false,
    saving: false,
    mode: 'edit' as 'edit' | 'add',
    type: '' as 'mega' | 'major',
    id: '',
    name: '',
    domain: '',
    megaId: '',        // major의 현재 소속 mega
    originalMegaId: '' // 변경 전 소속 mega (이동 판별용)
});

const megaOptionsForEdit = computed(() => {
    if (!procMap.value?.mega_proc_list) return [];
    return procMap.value.mega_proc_list.map((m: any) => ({ id: m.id, name: m.name }));
});

function resolveDomainName(rawDomain: string): string {
    if (!rawDomain) return '';
    const matched = domains.value.find((d: any) => d.name === rawDomain || d.id === rawDomain);
    return matched?.name || rawDomain;
}

function openEditProcessDialog(row: any) {
    editProcessDialog.value.mode = 'edit';
    editProcessDialog.value.type = row.type;
    editProcessDialog.value.id = row.id;
    editProcessDialog.value.name = row.name;
    editProcessDialog.value.saving = false;

    if (row.type === 'major') {
        // major의 도메인과 소속 mega 찾기
        const map = procMap.value;
        for (const mega of map?.mega_proc_list || []) {
            const found = (mega.major_proc_list || []).find((m: any) => m.id === row.id);
            if (found) {
                editProcessDialog.value.domain = resolveDomainName(getMajorBusinessDomain(found, domains.value));
                editProcessDialog.value.megaId = mega.id;
                editProcessDialog.value.originalMegaId = mega.id;
                break;
            }
        }
    } else {
        editProcessDialog.value.domain = '';
        editProcessDialog.value.megaId = '';
        editProcessDialog.value.originalMegaId = '';
    }

    editProcessDialog.value.show = true;
}

function openAddProcessDialog(row: any) {
    editProcessDialog.value.mode = 'add';
    editProcessDialog.value.type = row.type; // 'mega' or 'major'
    editProcessDialog.value.id = '';
    editProcessDialog.value.name = '';
    editProcessDialog.value.domain = '';
    editProcessDialog.value.megaId = row.megaId || '';
    editProcessDialog.value.originalMegaId = '';
    editProcessDialog.value.saving = false;
    editProcessDialog.value.show = true;
}

async function saveEditProcess() {
    const d = editProcessDialog.value;
    if (!d.name.trim()) return;
    d.saving = true;

    try {
        const newMap = JSON.parse(JSON.stringify(procMap.value));
        if (!newMap.mega_proc_list) newMap.mega_proc_list = [];
        const resolvedDomainName = resolveDomainName(d.domain);
        const resolvedDomainId = domains.value.find((dm: any) => dm.name === resolvedDomainName || dm.id === resolvedDomainName)?.id || resolvedDomainName;

        // --- ADD 모드 ---
        if (d.mode === 'add') {
            if (d.type === 'mega') {
                const existingIds = newMap.mega_proc_list.map((m: any) => m.id);
                const nextSeq = getNextSequenceFromIds(existingIds, 'mega');
                const newId = generateProcessId('mega', nextSeq);
                newMap.mega_proc_list.push({
                    id: newId,
                    name: d.name.trim(),
                    major_proc_list: [],
                });
            } else if (d.type === 'major') {
                const mega = (newMap.mega_proc_list || []).find((m: any) => m.id === d.megaId);
                if (mega) {
                    if (!mega.major_proc_list) mega.major_proc_list = [];
                    const allMajorIds: string[] = [];
                    newMap.mega_proc_list.forEach((m: any) => {
                        (m.major_proc_list || []).forEach((maj: any) => allMajorIds.push(maj.id));
                    });
                    const nextSeq = getNextSequenceFromIds(allMajorIds, 'major');
                    const newId = generateProcessId('major', nextSeq);
                    mega.major_proc_list.push({
                        id: newId,
                        name: d.name.trim(),
                        domain: resolvedDomainName,
                        ...(resolvedDomainId ? { domain_id: resolvedDomainId } : {}),
                        sub_proc_list: [],
                    });
                }
            }
            await saveProcMap(newMap);
            d.show = false;
            return;
        }

        // --- EDIT 모드 ---
        let edited = false;
        if (d.type === 'mega') {
            // 메가 프로세스 이름 변경
            const mega = (newMap.mega_proc_list || []).find((m: any) => m.id === d.id);
            if (mega) {
                mega.name = d.name.trim();
                edited = true;
            } else {
                console.warn('[editProcess] mega not found by id:', d.id, 'available:', newMap.mega_proc_list?.map((m: any) => m.id));
            }
        } else if (d.type === 'major') {
            const megaMoved = d.megaId !== d.originalMegaId;

            if (megaMoved) {
                // 소속 메가 변경: 기존 메가에서 제거 → 새 메가에 추가
                let movedMajor: any = null;
                for (const mega of newMap.mega_proc_list || []) {
                    if (mega.id === d.originalMegaId) {
                        const idx = (mega.major_proc_list || []).findIndex((m: any) => m.id === d.id);
                        if (idx >= 0) {
                            movedMajor = mega.major_proc_list.splice(idx, 1)[0];
                        }
                        break;
                    }
                }
                if (movedMajor) {
                    movedMajor.name = d.name.trim();
                    movedMajor.domain = resolvedDomainName;
                    movedMajor.domain_id = resolvedDomainId;
                    const targetMega = (newMap.mega_proc_list || []).find((m: any) => m.id === d.megaId);
                    if (targetMega) {
                        if (!targetMega.major_proc_list) targetMega.major_proc_list = [];
                        targetMega.major_proc_list.push(movedMajor);
                        edited = true;
                    } else {
                        console.warn('[editProcess] target mega not found:', d.megaId);
                    }
                } else {
                    console.warn('[editProcess] major not found in original mega:', d.id, 'originalMega:', d.originalMegaId);
                }
            } else {
                // 같은 메가 내 이름/도메인 변경
                for (const mega of newMap.mega_proc_list || []) {
                    const major = (mega.major_proc_list || []).find((m: any) => m.id === d.id);
                    if (major) {
                        major.name = d.name.trim();
                        major.domain = resolvedDomainName;
                        major.domain_id = resolvedDomainId;
                        edited = true;
                        break;
                    }
                }
                if (!edited) {
                    console.warn('[editProcess] major not found by id:', d.id, 'all majors:', newMap.mega_proc_list?.flatMap((m: any) => (m.major_proc_list || []).map((j: any) => j.id)));
                }
            }
        }

        if (!edited) {
            console.warn('[editProcess] target not found:', { type: d.type, id: d.id, megaId: d.megaId });
            showExportNotification('수정 대상을 찾지 못했습니다.', 'warning', false, 4000);
            return;
        }

        await saveProcMap(newMap);
        await loadData();
        d.show = false;
        showExportNotification('저장되었습니다.', 'success', false, 2000);
    } catch (e) {
        console.error('Failed to save process edit:', e);
        showExportNotification('저장에 실패했습니다.', 'error', false, 4000);
    } finally {
        d.saving = false;
    }
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
        maintenance_message: maintenanceMode.value?.message || '',
        approval_status: 'pending' as const,
        draft_map: draft.map
    };
}

async function scheduleRestructureDraft(draft: any) {
    if (!draft?.id) return;
    const now = new Date().toISOString();
    try {
        await adminStore.recordCutoverJob({
            ...buildCutoverJobPayload(draft, 'scheduled'),
            scheduled_at: now
        });
        await adminStore.writeAdminAuditLog({
            action: 'restructure_draft_create',
            target_type: 'system',
            target_id: `cutover-${draft.id}`,
            target_name: draft.approvalTitle || draft.summary || draft.id,
            after_value: {
                approval_status: 'pending',
                operation: draft.operation,
                version_label: draft.versionLabel || ''
            }
        });
        showExportNotification('구조변경 draft가 생성되었습니다. 특별 결재 라인에서 승인 후 cut-over를 진행하세요.', 'info');
    } catch (e: any) {
        console.error('Failed to schedule restructure draft:', e);
        showExportNotification('구조개편 draft 저장에 실패했습니다.', 'error');
    }
}

async function applyRestructureDraft(draft: any) {
    if (!draft?.map) return;
    const jobId = `cutover-${draft.id}`;

    try {
        await adminStore.runCutoverJob(jobId);
        await loadData();
        showRestructureMode.value = false;
        showExportNotification('구조개편 target architecture draft가 점검 모드 cut-over로 반영되었습니다.', 'success');
    } catch (e: any) {
        console.error('Failed to apply restructure draft:', e);
        showExportNotification(e?.message || '구조개편 draft 반영에 실패했습니다.', 'error');
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
            const domain = getMajorBusinessDomain(major, domains.value);
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
    sandbox.style.position = 'absolute';
    sandbox.style.left = '-99999px';
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
    clone.style.width = 'auto';
    clone.style.background = '#ffffff';

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    // Phase 1: 모든 노드의 overflow/height/width 제약을 해제하여
    // 콘텐츠가 자연스럽게 전체 크기를 결정하도록 함
    const allClonedNodes = clone.querySelectorAll<HTMLElement>('*');
    for (const copied of allClonedNodes) {
        const cs = window.getComputedStyle(copied);

        // overflow 제약 해제
        if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            copied.style.overflow = 'visible';
        }

        // 높이 제약 해제 (flex/percentage/fixed → auto)
        if (cs.maxHeight !== 'none') copied.style.maxHeight = 'none';
        if (cs.height !== 'auto' && (cs.height.endsWith('%') || cs.height === '0px')) {
            copied.style.height = 'auto';
        }

        // flex 축소 방지
        if (cs.minHeight === '0px' && cs.display?.includes('flex')) {
            copied.style.minHeight = 'auto';
        }

        // 최소 너비 보장 (fit-content)
        if (cs.minWidth === '0px' && cs.display?.includes('flex')) {
            copied.style.minWidth = 'fit-content';
        }

        copied.scrollTop = 0;
        copied.scrollLeft = 0;
    }

    // Phase 2: 레이아웃 재계산 후 scrollWidth/scrollHeight 기반으로 명시적 픽셀 크기 지정
    await nextTick();

    const sourceNodes = [sourceEl, ...Array.from(sourceEl.querySelectorAll<HTMLElement>('*'))];
    const clonedNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
    const nodeCount = Math.min(sourceNodes.length, clonedNodes.length);

    for (let i = 0; i < nodeCount; i += 1) {
        const original = sourceNodes[i];
        const copied = clonedNodes[i];

        // 원본에서 스크롤 가능했던 영역은 원본의 scrollWidth/scrollHeight로 확장
        if (original.scrollHeight > original.clientHeight) {
            copied.style.height = `${original.scrollHeight}px`;
        }
        if (original.scrollWidth > original.clientWidth) {
            copied.style.width = `${original.scrollWidth}px`;
        }
    }

    await nextTick();

    // Phase 3: clone의 자연 콘텐츠 크기 측정
    const width = Math.ceil(Math.max(clone.scrollWidth, clone.clientWidth));
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.clientHeight));

    // sandbox 크기를 콘텐츠에 맞춤
    sandbox.style.width = `${width}px`;
    clone.style.width = `${width}px`;

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
                    const tsText = `Exported: ${formatKST(new Date())}`;
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
                    pdf.text(`Exported: ${formatKST(new Date())}`, img.width - 10, img.height - 6, { align: 'right' });
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
        name: 'Process Hierarchy',
        query: {
            ...buildProcessHierarchyQuery({
                name: newProc.name,
                entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE,
                mode: PROCESS_HIERARCHY_MODE.EDIT
            }),
            id: newProc.id
        }
    });
    loadData();
}
</script>

<style scoped>

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

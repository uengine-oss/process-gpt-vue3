<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { Component } from 'vue';
import type { DashboardTab, NativeDashboardView } from '@/services/dashboardSettingsService';
import { defaultViewRole, loadTabs } from '@/services/dashboardSettingsService';
import { hasRoleAtLeast, resolveRole } from '@/utils/roles';
import type { AnalysisDashboardFilters, DateRangePreset } from '@/stores/analytics/analysisDashboardStore';
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore';
import { authClaimsState } from '@/utils/authClaims';
import { getSsoUser } from '@/utils/ssoAuth';
import AnalysisDashboardSettings from './AnalysisDashboardSettings.vue';
import { defineAsyncComponent } from 'vue';

const nativeComponentMap: Record<NativeDashboardView, Component> = {
    'operational-board': defineAsyncComponent(() => import('./tabs/OperationalBoard.vue')),
    'executive-summary': defineAsyncComponent(() => import('./tabs/ExecutiveSummary.vue')),
    'process-analytics': defineAsyncComponent(() => import('./tabs/ProcessAnalytics.vue')),
    'governance-quality': defineAsyncComponent(() => import('./tabs/GovernanceQuality.vue'))
};

const instance = getCurrentInstance();
const t = (key: string, params?: Record<string, unknown>) => instance?.proxy?.$t(key, params) || key;

const dashboardStore = useAnalysisDashboardStore();

/** 상단 글로벌 필터 UI 노출 여부 — 현재 숨김 처리 (기본값 필터는 내부적으로 유지) */
const showGlobalControls = false;

// ============== Global Controls State ==============
const dashboardFilters = reactive<AnalysisDashboardFilters>({
    domains: [],
    orgCode: '',
    includeSubOrgs: true,
    dateRangePreset: 'quarter',
    customDateRange: null,
    comparisonMode: false
});

const customFrom = ref('');
const customTo = ref('');
const showCustomDateMenu = ref(false);

// Organization list from SSO org chart
const orgList = ref<Array<{ org_code: string; org_name: string }>>([]);

const domainScopeOptions = computed(() => {
    const base = dashboardStore.domainOptions;
    return base.length > 0 ? base : ['Access', 'Core', 'IP'];
});

const dateRangeOptions = computed(() => [
    { title: t('analysisDashboard.globalControls.thisQuarter'), value: 'quarter' as DateRangePreset },
    { title: t('analysisDashboard.globalControls.ytd'), value: 'ytd' as DateRangePreset },
    { title: t('analysisDashboard.globalControls.customRange'), value: 'custom' as DateRangePreset }
]);

const domainDisplay = computed(() => {
    if (dashboardFilters.domains.length === 0) return t('analysisDashboard.globalControls.domainAll');
    return dashboardFilters.domains.join(', ');
});

// ============== Tab State ==============
const activeTabKey = ref('');
const tabs = ref<DashboardTab[]>([]);
const loading = ref(true);
const showSettings = ref(false);
const refreshTimerId = ref<number | null>(null);

const isAdmin = computed(() => authClaimsState.isAdmin);
const currentRole = computed(() => resolveRole(authClaimsState.isAdmin, authClaimsState.role));
// 탭별 View 권한(viewRole) 이상 역할에게만 노출 — 미지정 시 embed=admin(어드민 전용), native=viewer(전체)
const visibleTabs = computed(() =>
    tabs.value.filter((tab) => hasRoleAtLeast(currentRole.value, tab.viewRole ?? defaultViewRole(tab.mode)))
);
const currentTab = computed(() => visibleTabs.value.find((tab) => tab.key === activeTabKey.value) || visibleTabs.value[0]);
const currentTabIsEmbed = computed(() => currentTab.value?.mode !== 'native');
const hasCurrentUrl = computed(() => Boolean(currentTab.value?.url) && currentTabIsEmbed.value);

// ============== Tab Loading ==============
async function fetchTabs() {
    loading.value = true;
    try {
        tabs.value = await loadTabs();
        if (visibleTabs.value.length > 0 && !visibleTabs.value.find((tab) => tab.key === activeTabKey.value)) {
            activeTabKey.value = visibleTabs.value[0].key;
        }
    } finally {
        loading.value = false;
    }
}

// ============== Organization Loading ==============
async function fetchOrgList() {
    try {
        const supabase = (window as any).$supabase;
        const tenantId = (window as any).$tenantName || 'default';
        if (!supabase) return;

        const { data } = await supabase
            .from('configuration')
            .select('value')
            .eq('key', 'organization')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!data?.value) return;

        const orgData = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        const chart = orgData.chart || orgData;
        const result: Array<{ org_code: string; org_name: string }> = [];

        function walk(node: any) {
            if (!node) return;
            const code = node.id || '';
            const name = node.data?.name || node.id || '';
            if (code) result.push({ org_code: code, org_name: name });
            if (Array.isArray(node.children)) node.children.forEach(walk);
        }
        walk(chart);
        orgList.value = result;
    } catch (e) {
        console.error('fetchOrgList error:', e);
    }
}

// ============== Helpers ==============

/**
 * embed 모드 탭의 base URL에 현재 필터를 Grafana 변수(var-xxx)로 주입한 URL을 반환한다.
 * Grafana는 URL query parameter로 var-<name>=<value> 형태의 변수를 받아 대시보드 변수에 반영한다.
 */
function buildEmbedUrl(tab: DashboardTab): string {
    if (!tab.url) return '';

    const tenantId = (window as any).$tenantName || 'default';

    // base URL에서 기존 var- 파라미터를 제거하고 새로 주입
    const [base, existingQuery] = tab.url.split('?');
    const params = new URLSearchParams(existingQuery || '');

    // 기존 var-tenant_id, var-domain 제거
    params.delete('var-tenant_id');
    params.delete('var-domain');

    // tenant_id 주입
    params.set('var-tenant_id', tenantId);

    // domain 필터 주입 (multi-value: 각 값을 별도 var-domain으로 추가)
    if (dashboardFilters.domains.length > 0) {
        for (const domain of dashboardFilters.domains) {
            params.append('var-domain', domain);
        }
    } else {
        params.set('var-domain', 'All');
    }

    // Grafana kiosk 모드 유지 (이미 있으면 그대로)
    if (!params.has('kiosk')) {
        params.set('kiosk', '');
    }

    return `${base}?${params.toString()}`;
}

/** embed 탭별로 필터가 반영된 최종 URL을 캐시 */
const embedUrlMap = computed(() => {
    const map: Record<string, string> = {};
    for (const tab of tabs.value) {
        if (tab.mode !== 'native' && tab.url) {
            map[tab.key] = buildEmbedUrl(tab);
        }
    }
    return map;
});

function resolveDataSourceLabel(tab?: DashboardTab) {
    if (!tab) return '';
    if (tab.dataPath === 'operational') return t('analysisDashboard.dataSourceOperational');
    return tab.mode === 'native' ? t('analysisDashboard.dataSourceAnalyticalNative') : t('analysisDashboard.dataSourceAnalyticalEmbed');
}

function getNativeComponent(tab?: DashboardTab | null) {
    if (!tab?.nativeView) return null;
    return nativeComponentMap[tab.nativeView] || null;
}

function onSettingsSaved(updated: DashboardTab[]) {
    tabs.value = updated;
    if (visibleTabs.value.length > 0 && !visibleTabs.value.find((tab) => tab.key === activeTabKey.value)) {
        activeTabKey.value = visibleTabs.value[0].key;
    }
}

function openCurrentGrafana() {
    if (!currentTab.value?.url || currentTab.value.mode === 'native') return;
    const url = embedUrlMap.value[currentTab.value.key] || currentTab.value.url;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ============== Filter Actions ==============
function onDateRangePresetChange(preset: DateRangePreset) {
    dashboardFilters.dateRangePreset = preset;
    if (preset !== 'custom') {
        dashboardFilters.customDateRange = null;
        customFrom.value = '';
        customTo.value = '';
    }
}

function applyCustomDateRange() {
    if (customFrom.value && customTo.value) {
        dashboardFilters.customDateRange = { from: customFrom.value, to: customTo.value };
        showCustomDateMenu.value = false;
    }
}

function resetFilters() {
    dashboardFilters.domains = [];
    dashboardFilters.orgCode = '';
    dashboardFilters.includeSubOrgs = true;
    dashboardFilters.dateRangePreset = 'quarter';
    dashboardFilters.customDateRange = null;
    dashboardFilters.comparisonMode = false;
    customFrom.value = '';
    customTo.value = '';
}

// ============== Auto-Refresh ==============
function stopOperationalRefresh() {
    if (refreshTimerId.value !== null) {
        window.clearInterval(refreshTimerId.value);
        refreshTimerId.value = null;
    }
}

async function refreshOperationalBoard() {
    dashboardStore.setFilters(dashboardFilters);
    await dashboardStore.fetchAllTabB();
}

function startOperationalRefresh(tab?: DashboardTab) {
    stopOperationalRefresh();
    if (!tab || tab.mode !== 'native' || tab.nativeView !== 'operational-board' || !tab.refreshSeconds || tab.refreshSeconds <= 0) return;
    refreshTimerId.value = window.setInterval(() => {
        void refreshOperationalBoard();
    }, tab.refreshSeconds * 1000);
}

// ============== Watchers ==============
watch(
    currentTab,
    (tab) => {
        if (tab?.mode === 'native' && tab.nativeView === 'operational-board') {
            void refreshOperationalBoard();
        }
        startOperationalRefresh(tab);
    },
    { immediate: true }
);

watch(
    () => ({ ...dashboardFilters }),
    () => {
        if (currentTab.value?.mode === 'native') {
            dashboardStore.setFilters(dashboardFilters);
        }
    },
    { deep: true }
);

// ============== Lifecycle ==============
onMounted(async () => {
    const ssoUser = getSsoUser();
    if (ssoUser?.org_code) {
        dashboardFilters.orgCode = ssoUser.org_code;
    }
    await Promise.all([fetchTabs(), fetchOrgList(), dashboardStore.fetchDomainOptions()]);
});

onUnmounted(stopOperationalRefresh);
</script>

<template>
    <v-card elevation="10" class="rounded-xl sk-page-card analysis-dashboard-root">
        <!-- Header (공통 page-header 패턴) -->
        <div class="page-header pb-0">
            <div class="page-header-left">
                <h1 class="page-title">분석 대시보드</h1>
                <p class="page-subtitle">프로세스 운영 현황 대시보드</p>
            </div>
            <div class="page-header-right">
                <v-btn
                    v-if="isAdmin"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-open-in-new"
                    :disabled="!hasCurrentUrl"
                    @click="openCurrentGrafana"
                >
                    새 탭에서 열기
                </v-btn>
                <v-btn v-if="isAdmin" icon variant="text" size="small" @click="showSettings = true">
                    <v-icon>mdi-cog-outline</v-icon>
                    <v-tooltip activator="parent" location="bottom">{{ t('analysisDashboard.settings.title') }}</v-tooltip>
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4">
            <!-- Global Controls (숨김 상태 — showGlobalControls 로 재노출 가능) -->
            <v-card v-if="showGlobalControls" variant="outlined" rounded="lg" class="global-controls mb-5">
                <div class="gc-row">
                    <!-- Domain Scope -->
                    <div class="gc-field gc-field--domain">
                        <label class="gc-label">
                            <v-icon size="14" class="mr-1">mdi-domain</v-icon>
                            {{ t('analysisDashboard.globalControls.domainScope') }}
                        </label>
                        <v-select
                            v-model="dashboardFilters.domains"
                            :items="domainScopeOptions"
                            :placeholder="t('analysisDashboard.globalControls.domainAll')"
                            multiple
                            clearable
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="gc-input"
                        >
                            <template #selection="{ index }">
                                <span v-if="index === 0" class="text-body-2">{{ domainDisplay }}</span>
                            </template>
                        </v-select>
                    </div>

                    <!-- Organization -->
                    <div class="gc-field gc-field--org">
                        <label class="gc-label">
                            <v-icon size="14" class="mr-1">mdi-office-building-outline</v-icon>
                            {{ t('analysisDashboard.globalControls.organization') }}
                        </label>
                        <v-select
                            v-model="dashboardFilters.orgCode"
                            :items="orgList"
                            item-title="org_name"
                            item-value="org_code"
                            :placeholder="t('analysisDashboard.globalControls.orgAll')"
                            clearable
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="gc-input"
                        />
                        <v-checkbox
                            v-model="dashboardFilters.includeSubOrgs"
                            :label="t('analysisDashboard.globalControls.includeSubOrgs')"
                            density="compact"
                            hide-details
                            class="gc-checkbox"
                        />
                    </div>

                    <!-- Date Range -->
                    <div class="gc-field gc-field--date">
                        <label class="gc-label">
                            <v-icon size="14" class="mr-1">mdi-calendar-range</v-icon>
                            {{ t('analysisDashboard.globalControls.dateRange') }}
                        </label>
                        <v-btn-toggle
                            :model-value="dashboardFilters.dateRangePreset"
                            mandatory
                            color="primary"
                            density="compact"
                            rounded="lg"
                            class="gc-date-toggle"
                            @update:model-value="onDateRangePresetChange"
                        >
                            <v-btn v-for="opt in dateRangeOptions" :key="opt.value" :value="opt.value" size="small" variant="text" class="gc-date-btn">
                                {{ opt.title }}
                            </v-btn>
                        </v-btn-toggle>

                        <div v-if="dashboardFilters.dateRangePreset === 'custom'" class="gc-custom-range">
                            <v-text-field
                                v-model="customFrom"
                                type="date"
                                :label="t('analysisDashboard.globalControls.dateFrom')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="gc-date-input"
                            />
                            <span class="gc-date-sep">~</span>
                            <v-text-field
                                v-model="customTo"
                                type="date"
                                :label="t('analysisDashboard.globalControls.dateTo')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="gc-date-input"
                            />
                            <v-btn
                                size="small"
                                color="primary"
                                variant="tonal"
                                :disabled="!customFrom || !customTo"
                                @click="applyCustomDateRange"
                            >
                                {{ t('analysisDashboard.globalControls.apply') }}
                            </v-btn>
                        </div>
                        <span class="gc-hint">{{ t('analysisDashboard.globalControls.dateBasedOn') }}</span>
                    </div>

                    <!-- Comparison Mode -->
                    <div class="gc-field gc-field--compare">
                        <label class="gc-label">
                            <v-icon size="14" class="mr-1">mdi-compare-horizontal</v-icon>
                            {{ t('analysisDashboard.globalControls.comparisonMode') }}
                        </label>
                        <v-checkbox
                            v-model="dashboardFilters.comparisonMode"
                            :label="t('analysisDashboard.globalControls.vsLastQuarter')"
                            density="compact"
                            hide-details
                            color="primary"
                            class="gc-checkbox"
                        />
                        <span class="gc-hint">{{ t('analysisDashboard.globalControls.comparisonHint') }}</span>
                    </div>

                    <!-- Reset -->
                    <div class="gc-field gc-field--actions">
                        <v-btn size="small" variant="text" color="secondary" prepend-icon="mdi-refresh" @click="resetFilters">
                            {{ t('analysisDashboard.globalControls.reset') }}
                        </v-btn>
                    </div>
                </div>
            </v-card>

            <!-- Tab Card -->
            <v-card variant="flat" rounded="lg" class="tab-card">
                <div v-if="visibleTabs.length > 0" class="tab-toolbar">
                    <v-tabs v-model="activeTabKey" color="primary" class="tab-header" height="56">
                        <v-tab v-for="tab in visibleTabs" :key="tab.key" :value="tab.key" class="tab-item">
                            {{ tab.label || tab.key }}
                        </v-tab>
                    </v-tabs>
                </div>

                <v-divider />

                <div v-if="currentTab" class="tab-context-bar">
                    <div class="tab-context-item">
                        <span class="tab-context-label">{{ t('analysisDashboard.dataSource') }}</span>
                        <span class="tab-context-value">{{ resolveDataSourceLabel(currentTab) }}</span>
                    </div>
                    <div class="tab-context-item">
                        <span class="tab-context-label">{{
                            t('analysisDashboard.activeTab', { tab: currentTab.label || currentTab.key })
                        }}</span>
                        <span class="tab-context-value">{{ currentTab.key }}</span>
                    </div>
                </div>

                <div v-if="currentTab" class="tab-content-area">
                    <div v-if="currentTab.mode === 'native'" class="native-board-wrap">
                        <component :is="getNativeComponent(currentTab)" v-if="getNativeComponent(currentTab)" :filters="dashboardFilters" />

                        <div v-else class="grafana-empty-state">
                            <div class="empty-icon">
                                <v-icon size="28" color="primary">mdi-view-dashboard-edit-outline</v-icon>
                            </div>
                            <h2 class="text-h6 font-weight-bold text-textPrimary mb-2">
                                {{ t('analysisDashboard.nativeViewMissingTitle') }}
                            </h2>
                            <p class="text-body-2 text-medium-emphasis mb-2">
                                {{ t('analysisDashboard.nativeViewMissingDescription') }}
                            </p>
                        </div>
                    </div>

                    <div v-else-if="currentTab.url" class="grafana-frame-wrap">
                        <iframe :src="embedUrlMap[currentTab.key] || currentTab.url" :title="`${currentTab.label || currentTab.key} Dashboard`" class="grafana-frame" frameborder="0" />
                    </div>

                    <div v-else class="grafana-empty-state">
                        <div class="empty-icon">
                            <v-icon size="28" color="primary">mdi-chart-box-outline</v-icon>
                        </div>
                        <h2 class="text-h6 font-weight-bold text-textPrimary mb-2">
                            {{ t('analysisDashboard.emptyTitle', { tab: currentTab.label || currentTab.key }) }}
                        </h2>
                        <p class="text-body-2 text-medium-emphasis mb-2">
                            {{ t('analysisDashboard.settings.emptyHint') }}
                        </p>
                        <v-btn
                            v-if="isAdmin"
                            variant="tonal"
                            color="primary"
                            prepend-icon="mdi-cog-outline"
                            @click="showSettings = true"
                        >
                            {{ t('analysisDashboard.settings.title') }}
                        </v-btn>
                    </div>
                </div>

                <div v-if="!loading && visibleTabs.length === 0" class="grafana-empty-state">
                    <div class="empty-icon">
                        <v-icon size="28" color="primary">mdi-chart-box-outline</v-icon>
                    </div>
                    <h2 class="text-h6 font-weight-bold text-textPrimary mb-2">
                        {{ t('analysisDashboard.settings.noTabs') }}
                    </h2>
                    <p class="text-body-2 text-medium-emphasis mb-2">
                        {{ t('analysisDashboard.settings.emptyHint') }}
                    </p>
                    <v-btn v-if="isAdmin" variant="tonal" color="primary" prepend-icon="mdi-cog-outline" @click="showSettings = true">
                        {{ t('analysisDashboard.settings.title') }}
                    </v-btn>
                </div>
            </v-card>
        </v-card-text>

        <AnalysisDashboardSettings v-model="showSettings" :tabs="tabs" @saved="onSettingsSaved" />
    </v-card>
</template>

<style scoped>
/* page-header 계열 클래스는 src/assets/css/SKGlobalStyle.scss 에 글로벌 정의되어 있음 */

/* ===== Global Controls ===== */
.global-controls {
    border-color: #e0e3ea;
    background: linear-gradient(180deg, #fbfcff 0%, #f8f9fc 100%);
    padding: 16px 20px;
}

.gc-row {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
}

.gc-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.gc-field--domain {
    flex: 0 0 200px;
}

.gc-field--org {
    flex: 0 0 220px;
}

.gc-field--date {
    flex: 1 1 320px;
}

.gc-field--compare {
    flex: 0 0 180px;
}

.gc-field--actions {
    flex: 0 0 auto;
    justify-content: flex-end;
    align-self: flex-end;
}

.gc-label {
    display: flex;
    align-items: center;
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(15, 23, 42, 0.56);
}

.gc-input {
    max-width: 100%;
}

.gc-checkbox {
    margin-top: -2px;
}

.gc-checkbox :deep(.v-label) {
    font-size: 12.5px;
    opacity: 0.8;
}

.gc-date-toggle {
    border: 1px solid #e0e0e0;
    background: #fff;
}

.gc-date-btn {
    text-transform: none !important;
    font-weight: 600;
    letter-spacing: 0.01em !important;
    font-size: 12.5px !important;
}

.gc-custom-range {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
}

.gc-date-input {
    flex: 1;
    max-width: 160px;
}

.gc-date-sep {
    font-size: 14px;
    color: #9e9e9e;
    flex-shrink: 0;
}

.gc-hint {
    font-size: 11px;
    color: rgba(15, 23, 42, 0.42);
    letter-spacing: 0.02em;
}

/* ===== sk-page-card overflow 글로벌 스타일 override ===== */
.analysis-dashboard-root.sk-page-card {
    overflow: visible !important;
    height: auto !important;
    min-height: 100%;
}

/* ===== Tab Area ===== */
.tab-card {
    border: 1px solid #e8eaed;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(8px);
    overflow: visible;
}

.tab-content-area {
    overflow: visible;
}

.tab-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    background: linear-gradient(180deg, #fbfcff 0%, #f5f7fb 100%);
}

.tab-header {
    flex: 1;
}

.tab-item {
    min-width: 92px;
    text-transform: none !important;
    font-weight: 700;
    letter-spacing: 0.04em !important;
}

.tab-context-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    background: #fbfcff;
    border-bottom: 1px solid #edf1f7;
    flex-wrap: wrap;
}

.tab-context-item {
    display: flex;
    align-items: center;
    gap: 10px;
}

.tab-context-label {
    color: rgba(15, 23, 42, 0.58);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.tab-context-value {
    color: #0f172a;
    font-size: 0.92rem;
    font-weight: 600;
}

.grafana-frame-wrap {
    height: calc(100vh - 460px);
    min-height: 540px;
    background: #f4f6fb;
}

.native-board-wrap {
    overflow: visible;
    padding: 20px;
    background: #fff;
}

.grafana-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: #fff;
}

.grafana-empty-state {
    min-height: calc(100vh - 460px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
    background: radial-gradient(circle at center, rgba(63, 81, 181, 0.06), transparent 55%), #fbfcff;
}

.empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(63, 81, 181, 0.1);
}

@media (max-width: 960px) {
    .gc-row {
        flex-direction: column;
        gap: 14px;
    }

    .gc-field--domain,
    .gc-field--org,
    .gc-field--date,
    .gc-field--compare {
        flex: 1 1 100%;
    }

    .tab-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .tab-context-bar {
        flex-direction: column;
        align-items: flex-start;
    }

    .grafana-frame-wrap,
    .grafana-empty-state {
        min-height: calc(100vh - 560px);
        height: calc(100vh - 560px);
    }
}
</style>

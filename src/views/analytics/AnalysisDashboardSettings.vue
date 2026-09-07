<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue';
import type {
    DashboardDataPath,
    DashboardTab,
    DashboardTabMode,
    NativeDashboardView
} from '@/services/dashboardSettingsService';
import { NATIVE_VIEW_LABELS, defaultViewRole, saveTabs } from '@/services/dashboardSettingsService';
import { ROLES, type RoleType } from '@/utils/roles';

const props = defineProps<{
    modelValue: boolean;
    tabs: DashboardTab[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void;
    (e: 'saved', tabs: DashboardTab[]): void;
}>();

const instance = getCurrentInstance();
const t = (key: string, params?: Record<string, unknown>) => instance?.proxy?.$t(key, params) || key;

const editTabs = ref<DashboardTab[]>([]);
const saving = ref(false);
const errorMsg = ref('');

const modeOptions = computed(() => [
    { title: t('analysisDashboard.settings.modeEmbed'), value: 'embed' as DashboardTabMode },
    { title: t('analysisDashboard.settings.modeNative'), value: 'native' as DashboardTabMode }
]);

const dataPathOptions = computed(() => [
    { title: t('analysisDashboard.settings.dataPathAnalytical'), value: 'analytical' as DashboardDataPath },
    { title: t('analysisDashboard.settings.dataPathOperational'), value: 'operational' as DashboardDataPath }
]);

const nativeViewOptions = computed(() =>
    (Object.entries(NATIVE_VIEW_LABELS) as [NativeDashboardView, string][]).map(([value, title]) => ({ title, value }))
);

const viewRoleOptions = computed<{ title: string; value: RoleType }[]>(() => [
    { title: t('analysisDashboard.settings.viewRoleAdmin'), value: ROLES.ADMIN },
    { title: t('analysisDashboard.settings.viewRoleOwner'), value: ROLES.OWNER },
    { title: t('analysisDashboard.settings.viewRoleEditor'), value: ROLES.EDITOR },
    { title: t('analysisDashboard.settings.viewRoleReviewer'), value: ROLES.REVIEWER },
    { title: t('analysisDashboard.settings.viewRoleAll'), value: ROLES.VIEWER }
]);

function createDefaultTab(index: number): DashboardTab {
    return {
        key: String.fromCharCode(65 + index),
        label: '',
        url: '',
        mode: 'embed',
        dataPath: 'analytical',
        refreshSeconds: 0,
        latencyLabel: '',
        viewRole: defaultViewRole('embed')
    };
}

function cloneTab(tab: DashboardTab, index: number): DashboardTab {
    return {
        ...createDefaultTab(index),
        ...tab,
        url: tab.url || '',
        mode: tab.mode || 'embed',
        dataPath: tab.dataPath || 'analytical',
        refreshSeconds: typeof tab.refreshSeconds === 'number' && Number.isFinite(tab.refreshSeconds) ? tab.refreshSeconds : 0,
        latencyLabel: tab.latencyLabel || '',
        viewRole: tab.viewRole || defaultViewRole(tab.mode)
    };
}

function onOpen() {
    editTabs.value = props.tabs.map((tab, i) => cloneTab(tab, i));
    errorMsg.value = '';
}

function addTab() {
    editTabs.value.push(createDefaultTab(editTabs.value.length));
}

function removeTab(index: number) {
    editTabs.value.splice(index, 1);
}

function onModeChange(tab: DashboardTab) {
    if (tab.mode === 'native') {
        tab.nativeView = tab.nativeView || 'operational-board';
        onNativeViewChange(tab);
        return;
    }
    tab.dataPath = 'analytical';
    tab.refreshSeconds = 0;
}

function onNativeViewChange(tab: DashboardTab) {
    if (tab.nativeView === 'operational-board') {
        tab.dataPath = 'operational';
        if (!tab.refreshSeconds) tab.refreshSeconds = 5;
        return;
    }
    tab.dataPath = 'analytical';
    tab.refreshSeconds = 0;
}

async function save() {
    saving.value = true;
    errorMsg.value = '';
    try {
        const cleaned: DashboardTab[] = editTabs.value.map((tab, i) => ({
            key: tab.key || String.fromCharCode(65 + i),
            label: tab.label?.trim() || tab.key || String.fromCharCode(65 + i),
            url: tab.url?.trim() || '',
            mode: tab.mode || 'embed',
            nativeView: tab.nativeView,
            dataPath: tab.dataPath || 'analytical',
            refreshSeconds:
                typeof tab.refreshSeconds === 'number' && Number.isFinite(tab.refreshSeconds)
                    ? Math.max(0, Math.round(tab.refreshSeconds))
                    : 0,
            latencyLabel: tab.latencyLabel?.trim() || '',
            viewRole: tab.viewRole || defaultViewRole(tab.mode)
        }));

        await saveTabs(cleaned);
        emit('saved', cleaned);
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
        :model-value="modelValue"
        max-width="860"
        persistent
        @update:model-value="emit('update:modelValue', $event)"
        @after-enter="onOpen"
    >
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center ga-2 pa-5 pb-3">
                <v-icon size="20" color="primary">mdi-cog-outline</v-icon>
                <span class="text-h6 font-weight-bold">{{ t('analysisDashboard.settings.title') }}</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-5">
                <p class="text-body-2 text-medium-emphasis mb-4">
                    {{ t('analysisDashboard.settings.description') }}
                </p>

                <v-alert v-if="errorMsg" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="errorMsg = ''">
                    {{ errorMsg }}
                </v-alert>

                <div class="tab-list">
                    <div v-for="(tab, index) in editTabs" :key="index" class="tab-card mb-3">
                        <div class="tab-row tab-row--primary">
                            <v-text-field
                                v-model="tab.label"
                                :label="t('analysisDashboard.settings.tabName')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-label-field"
                            />
                            <v-select
                                v-model="tab.mode"
                                :items="modeOptions"
                                item-title="title"
                                item-value="value"
                                :label="t('analysisDashboard.settings.tabMode')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-mode-field"
                                @update:model-value="onModeChange(tab)"
                            />
                            <v-select
                                v-model="tab.dataPath"
                                :items="dataPathOptions"
                                item-title="title"
                                item-value="value"
                                :label="t('analysisDashboard.settings.dataPath')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-path-field"
                            />
                            <v-btn icon variant="text" size="small" color="error" @click="removeTab(index)">
                                <v-icon size="18">mdi-delete-outline</v-icon>
                            </v-btn>
                        </div>

                        <div class="tab-row">
                            <v-select
                                v-if="tab.mode === 'native'"
                                v-model="tab.nativeView"
                                :items="nativeViewOptions"
                                item-title="title"
                                item-value="value"
                                :label="t('analysisDashboard.settings.nativeView')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-native-field"
                                @update:model-value="onNativeViewChange(tab)"
                            />
                            <v-text-field
                                v-else
                                v-model="tab.url"
                                :label="t('analysisDashboard.settings.grafanaUrl')"
                                placeholder="https://grafana.example.com/d/..."
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-url-field"
                            />

                            <v-text-field
                                v-model.number="tab.refreshSeconds"
                                :label="t('analysisDashboard.settings.refreshSeconds')"
                                type="number"
                                min="0"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-refresh-field"
                            />

                            <v-text-field
                                v-model="tab.latencyLabel"
                                :label="t('analysisDashboard.settings.latencyLabel')"
                                :placeholder="t('analysisDashboard.settings.latencyPlaceholder')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-latency-field"
                            />

                            <v-select
                                v-model="tab.viewRole"
                                :items="viewRoleOptions"
                                item-title="title"
                                item-value="value"
                                :label="t('analysisDashboard.settings.viewRole')"
                                prepend-inner-icon="mdi-eye-lock-outline"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="tab-viewrole-field"
                            />
                        </div>
                    </div>
                </div>

                <v-btn variant="tonal" size="small" color="primary" prepend-icon="mdi-plus" class="mt-2" @click="addTab">
                    {{ t('analysisDashboard.settings.addTab') }}
                </v-btn>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn variant="text" @click="close">{{ t('analysisDashboard.settings.cancel') }}</v-btn>
                <v-btn color="primary" variant="flat" :loading="saving" @click="save">
                    {{ t('analysisDashboard.settings.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.tab-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tab-card {
    border: 1px solid #eceff5;
    border-radius: 12px;
    padding: 12px;
    background: #fbfcff;
}

.tab-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tab-row + .tab-row {
    margin-top: 8px;
}

.tab-row--primary {
    align-items: flex-start;
}

.tab-label-field {
    flex: 0 0 180px;
}

.tab-mode-field {
    flex: 0 0 160px;
}

.tab-path-field {
    flex: 0 0 180px;
}

.tab-native-field,
.tab-url-field {
    flex: 1;
}

.tab-refresh-field {
    flex: 0 0 140px;
}

.tab-latency-field {
    flex: 0 0 200px;
}

.tab-viewrole-field {
    flex: 0 0 160px;
}

@media (max-width: 960px) {
    .tab-row {
        flex-direction: column;
        align-items: stretch;
    }

    .tab-label-field,
    .tab-mode-field,
    .tab-path-field,
    .tab-native-field,
    .tab-url-field,
    .tab-refresh-field,
    .tab-latency-field,
    .tab-viewrole-field {
        flex: 1 1 auto;
    }
}
</style>

<template>
    <div class="sysops-wrapper">
        <!-- ===================== Section 1: Global Notice Banner ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-bullhorn-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.systemOps.bannerTitle') }}</span>
            </div>
            <div class="section-body">
                <!-- Enable toggle -->
                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.systemOps.bannerEnabled') }}</span>
                    <v-switch
                        v-model="bannerForm.enabled"
                        color="primary"
                        hide-details
                        density="compact"
                        inset
                    />
                </div>

                <v-divider class="field-divider" />

                <!-- Banner text -->
                <div class="field-row column">
                    <span class="field-label">{{ $t('adminConsole.systemOps.bannerText') }}</span>
                    <v-text-field
                        v-model="bannerForm.text"
                        :placeholder="$t('adminConsole.systemOps.bannerTextPlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="field-input"
                    />
                </div>

                <v-divider class="field-divider" />

                <!-- Color selector -->
                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.systemOps.bannerColor') }}</span>
                    <div class="color-chips">
                        <button
                            v-for="opt in colorOptions"
                            :key="opt.value"
                            class="color-chip"
                            :class="[`color-chip--${opt.value}`, { active: bannerForm.color === opt.value }]"
                            @click="bannerForm.color = opt.value"
                        >
                            <v-icon size="14">{{ opt.icon }}</v-icon>
                            <span>{{ opt.label }}</span>
                        </button>
                    </div>
                </div>

                <v-divider class="field-divider" />

                <!-- Date pickers -->
                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.systemOps.bannerPeriod') }}</span>
                    <div class="date-range">
                        <v-text-field
                            v-model="bannerForm.start_date"
                            :label="$t('adminConsole.systemOps.bannerStartDate')"
                            type="date"
                            variant="outlined"
                            density="compact"
                            hide-details
                            class="date-input"
                        />
                        <span class="date-separator">–</span>
                        <v-text-field
                            v-model="bannerForm.end_date"
                            :label="$t('adminConsole.systemOps.bannerEndDate')"
                            type="date"
                            variant="outlined"
                            density="compact"
                            hide-details
                            class="date-input"
                        />
                    </div>
                </div>

                <v-divider class="field-divider" />

                <!-- Preview -->
                <div class="field-row column">
                    <span class="field-label">{{ $t('adminConsole.systemOps.bannerPreview') }}</span>
                    <div
                        class="banner-preview"
                        :class="`banner-preview--${bannerForm.color}`"
                        :style="{ opacity: bannerForm.enabled ? 1 : 0.45 }"
                    >
                        <v-icon size="16" class="banner-preview-icon">{{ colorOptions.find(c => c.value === bannerForm.color)?.icon || 'mdi-information-outline' }}</v-icon>
                        <span class="banner-preview-text">{{ bannerForm.text || $t('adminConsole.systemOps.bannerTextPlaceholder') }}</span>
                        <span v-if="bannerForm.start_date || bannerForm.end_date" class="banner-preview-period">
                            {{ bannerForm.start_date }} ~ {{ bannerForm.end_date }}
                        </span>
                    </div>
                </div>

                <!-- Save button -->
                <div class="action-row">
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        @click="saveBanner"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.systemOps.bannerSave') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== Section 2: Maintenance Mode ===================== -->
        <div class="section-card" :class="{ 'section-card--danger': maintenanceForm.enabled }">
            <div class="section-header" :class="{ 'section-header--danger': maintenanceForm.enabled }">
                <v-icon class="section-icon" :color="maintenanceForm.enabled ? '#dc2626' : undefined" size="20">
                    mdi-shield-alert-outline
                </v-icon>
                <span class="section-title">{{ $t('adminConsole.systemOps.maintenanceTitle') }}</span>
                <div v-if="maintenanceForm.enabled" class="danger-badge">ACTIVE</div>
            </div>
            <div class="section-body">
                <!-- Big danger toggle -->
                <div class="maintenance-toggle-row">
                    <div class="maintenance-toggle-info">
                        <span class="maintenance-toggle-label">
                            {{ $t('adminConsole.systemOps.maintenanceEnabled') }}
                        </span>
                        <span class="maintenance-warning-text">
                            <v-icon size="14" color="warning">mdi-alert-outline</v-icon>
                            {{ $t('adminConsole.systemOps.maintenanceWarning') }}
                        </span>
                    </div>
                    <v-switch
                        v-model="maintenancePendingEnabled"
                        :color="maintenanceForm.enabled ? 'error' : 'error'"
                        hide-details
                        density="compact"
                        inset
                        class="maintenance-switch"
                        @update:model-value="onMaintenanceToggle"
                    />
                </div>

                <v-divider class="field-divider" />

                <!-- Message input -->
                <div class="field-row column">
                    <span class="field-label">{{ $t('adminConsole.systemOps.maintenanceMessage') }}</span>
                    <v-textarea
                        v-model="maintenanceForm.message"
                        :placeholder="$t('adminConsole.systemOps.maintenanceMessagePlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        rows="3"
                        auto-grow
                        class="field-input"
                        :disabled="!maintenanceForm.enabled"
                    />
                </div>

                <!-- Activated info (shown when active) -->
                <template v-if="maintenanceForm.enabled && (store.maintenanceMode.activated_by || store.maintenanceMode.activated_at)">
                    <v-divider class="field-divider" />
                    <div class="activated-info">
                        <div v-if="store.maintenanceMode.activated_by" class="activated-row">
                            <v-icon size="14" color="#9ca3af">mdi-account-outline</v-icon>
                            <span class="activated-key">{{ $t('adminConsole.systemOps.maintenanceActivatedBy') }}</span>
                            <span class="activated-value">{{ store.maintenanceMode.activated_by }}</span>
                        </div>
                        <div v-if="store.maintenanceMode.activated_at" class="activated-row">
                            <v-icon size="14" color="#9ca3af">mdi-clock-outline</v-icon>
                            <span class="activated-key">{{ $t('adminConsole.systemOps.maintenanceActivatedAt') }}</span>
                            <span class="activated-value">{{ formatDateTime(store.maintenanceMode.activated_at) }}</span>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- ===================== Section 3: Restructure Cut-over Jobs ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-source-branch</v-icon>
                <span class="section-title">Restructure Cut-over Jobs</span>
            </div>
            <div class="section-body">
                <div v-if="store.cutoverJobs.length === 0" class="cutover-empty">
                    <v-icon size="28" color="grey-lighten-1">mdi-timeline-outline</v-icon>
                    <span>아직 구조개편 cut-over 이력이 없습니다.</span>
                </div>
                <template v-else>
                    <div class="cutover-overview">
                        <div v-for="metric in cutoverStatusSummary" :key="metric.status" class="cutover-overview__card">
                            <div class="cutover-overview__label">{{ metric.label }}</div>
                            <div class="cutover-overview__value">{{ metric.count }}</div>
                        </div>
                    </div>
                    <div class="cutover-list">
                        <div v-for="job in store.cutoverJobs" :key="job.id" class="cutover-job">
                            <div class="cutover-job__top">
                                <div>
                                    <div class="cutover-job__title">{{ job.title }}</div>
                                    <div class="cutover-job__meta">
                                        {{ job.draft_id }} · {{ job.approval_type }} · {{ job.version_label || 'version n/a' }}
                                    </div>
                                </div>
                                <v-chip size="small" :color="cutoverStatusColor(job.status)" variant="tonal">
                                    {{ job.status }}
                                </v-chip>
                            </div>
                            <div class="cutover-job__summary">{{ job.summary }}</div>
                            <div class="cutover-job__metrics">
                                <span>Mega {{ job.impacted_mega_count }}</span>
                                <span>Major {{ job.impacted_major_count }}</span>
                                <span>Sub {{ job.impacted_sub_count }}</span>
                            </div>
                            <div class="cutover-job__timeline">
                                <span v-if="job.scheduled_at">Scheduled {{ formatDateTime(job.scheduled_at) }}</span>
                                <span v-if="job.started_at">Started {{ formatDateTime(job.started_at) }}</span>
                                <span v-if="job.executed_at">Completed {{ formatDateTime(job.executed_at) }}</span>
                                <span v-if="job.failed_at">Failed {{ formatDateTime(job.failed_at) }}</span>
                            </div>
                            <div v-if="job.maintenance_message" class="cutover-job__maintenance">
                                Maintenance Message: {{ job.maintenance_message }}
                            </div>
                            <div class="cutover-job__actions">
                                <v-btn size="small" variant="text" class="text-none" @click="openCutoverJob(job)">
                                    상세 보기
                                </v-btn>
                            </div>
                        </div>
                    </div>

                    <div v-if="selectedCutoverJob" class="cutover-detail">
                        <div class="cutover-detail__header">
                            <div>
                                <div class="cutover-detail__title">{{ selectedCutoverJob.title }}</div>
                                <div class="cutover-detail__meta">
                                    {{ selectedCutoverJob.approval_title || selectedCutoverJob.summary }}
                                </div>
                            </div>
                            <v-chip size="small" :color="cutoverStatusColor(selectedCutoverJob.status)" variant="flat">
                                {{ selectedCutoverJob.status }}
                            </v-chip>
                        </div>

                        <div class="cutover-detail__grid">
                            <div class="cutover-detail__panel">
                                <div class="cutover-detail__panel-title">Execution Timeline</div>
                                <div class="cutover-detail__timeline">
                                    <div class="cutover-detail__timeline-row">
                                        <span class="cutover-detail__timeline-key">Created</span>
                                        <span>{{ formatDateTime(selectedCutoverJob.created_at) }} · {{ selectedCutoverJob.created_by || 'system' }}</span>
                                    </div>
                                    <div class="cutover-detail__timeline-row">
                                        <span class="cutover-detail__timeline-key">Scheduled</span>
                                        <span>{{ selectedCutoverJob.scheduled_at ? formatDateTime(selectedCutoverJob.scheduled_at) : '—' }}</span>
                                    </div>
                                    <div class="cutover-detail__timeline-row">
                                        <span class="cutover-detail__timeline-key">Started</span>
                                        <span>{{ selectedCutoverJob.started_at ? formatDateTime(selectedCutoverJob.started_at) : '—' }}</span>
                                    </div>
                                    <div class="cutover-detail__timeline-row">
                                        <span class="cutover-detail__timeline-key">Completed</span>
                                        <span>{{ selectedCutoverJob.executed_at ? formatDateTime(selectedCutoverJob.executed_at) : '—' }}</span>
                                    </div>
                                    <div class="cutover-detail__timeline-row">
                                        <span class="cutover-detail__timeline-key">Failed</span>
                                        <span>{{ selectedCutoverJob.failed_at ? formatDateTime(selectedCutoverJob.failed_at) : '—' }}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="cutover-detail__panel">
                                <div class="cutover-detail__panel-title">Before / After Snapshot</div>
                                <div class="cutover-detail__snapshot-grid">
                                    <div class="cutover-detail__snapshot-card">
                                        <div class="cutover-detail__snapshot-title">Before</div>
                                        <div class="cutover-detail__snapshot-metrics">
                                            <span>Mega {{ selectedCutoverJob.before_snapshot?.mega_count ?? 0 }}</span>
                                            <span>Major {{ selectedCutoverJob.before_snapshot?.major_count ?? 0 }}</span>
                                            <span>Sub {{ selectedCutoverJob.before_snapshot?.sub_count ?? 0 }}</span>
                                        </div>
                                        <div class="cutover-detail__snapshot-lines">
                                            <div
                                                v-for="line in selectedCutoverJob.before_snapshot?.highlights || []"
                                                :key="`before-${line}`"
                                                class="cutover-detail__snapshot-line"
                                            >
                                                {{ line }}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="cutover-detail__snapshot-card">
                                        <div class="cutover-detail__snapshot-title">After</div>
                                        <div class="cutover-detail__snapshot-metrics">
                                            <span>Mega {{ selectedCutoverJob.after_snapshot?.mega_count ?? 0 }}</span>
                                            <span>Major {{ selectedCutoverJob.after_snapshot?.major_count ?? 0 }}</span>
                                            <span>Sub {{ selectedCutoverJob.after_snapshot?.sub_count ?? 0 }}</span>
                                        </div>
                                        <div class="cutover-detail__snapshot-lines">
                                            <div
                                                v-for="line in selectedCutoverJob.after_snapshot?.highlights || []"
                                                :key="`after-${line}`"
                                                class="cutover-detail__snapshot-line"
                                            >
                                                {{ line }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="selectedCutoverJob.change_summary?.length" class="cutover-detail__panel cutover-detail__panel--full">
                            <div class="cutover-detail__panel-title">Change Summary</div>
                            <div class="cutover-detail__summary-list">
                                <div
                                    v-for="line in selectedCutoverJob.change_summary"
                                    :key="line"
                                    class="cutover-detail__summary-item"
                                >
                                    <v-icon size="14" color="primary">mdi-arrow-right</v-icon>
                                    <span>{{ line }}</span>
                                </div>
                            </div>
                        </div>

                        <div v-if="selectedCutoverJob.error_message" class="cutover-detail__error">
                            {{ selectedCutoverJob.error_message }}
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- ===================== Confirmation Dialog ===================== -->
        <v-dialog v-model="confirmDialog" max-width="460" persistent>
            <v-card class="confirm-dialog-card">
                <div class="confirm-dialog-header">
                    <v-icon color="error" size="28">mdi-alert-circle-outline</v-icon>
                    <span class="confirm-dialog-title">{{ $t('adminConsole.systemOps.maintenanceConfirm') }}</span>
                </div>
                <div class="confirm-dialog-body">
                    <p class="confirm-warning">
                        <v-icon size="14" color="warning">mdi-alert-outline</v-icon>
                        {{ $t('adminConsole.systemOps.maintenanceWarning') }}
                    </p>
                    <v-textarea
                        v-model="confirmMessage"
                        :placeholder="$t('adminConsole.systemOps.maintenanceMessagePlaceholder')"
                        :label="$t('adminConsole.systemOps.maintenanceMessage')"
                        variant="outlined"
                        density="compact"
                        rows="3"
                        auto-grow
                        class="confirm-message-input"
                    />
                </div>
                <div class="confirm-dialog-actions">
                    <button class="dialog-btn dialog-btn--cancel" @click="cancelMaintenanceToggle">
                        {{ $t('common.cancel') || 'Cancel' }}
                    </button>
                    <button class="dialog-btn dialog-btn--danger" :disabled="store.loading" @click="confirmMaintenanceEnable">
                        <v-progress-circular v-if="store.loading" indeterminate size="14" width="2" color="white" />
                        <span v-else>{{ $t('common.confirm') || 'Confirm' }}</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, reactive, onMounted, watch, computed } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';

export default defineComponent({
    name: 'SystemOperations',

    setup() {
        const store = useAdminConsoleStore();

        // ---- Banner form state ----
        const bannerForm = reactive({
            enabled: false,
            text: '',
            color: 'info',
            start_date: '',
            end_date: ''
        });

        // ---- Maintenance form state ----
        const maintenanceForm = reactive({
            enabled: false,
            message: ''
        });

        // Tracks the switch visual state before confirmation
        const maintenancePendingEnabled = ref(false);

        // Confirmation dialog
        const confirmDialog = ref(false);
        const confirmMessage = ref('');
        const selectedCutoverJobId = ref('');

        // Color options for banner
        const colorOptions = [
            { value: 'info', label: 'Info', icon: 'mdi-information-outline', hex: '#2563eb' },
            { value: 'warning', label: 'Warning', icon: 'mdi-alert-outline', hex: '#d97706' },
            { value: 'error', label: 'Error', icon: 'mdi-alert-circle-outline', hex: '#dc2626' },
            { value: 'success', label: 'Success', icon: 'mdi-check-circle-outline', hex: '#16a34a' }
        ];

        // ---- Sync store → local form ----
        function syncBannerFromStore() {
            const s = store.noticeBanner;
            bannerForm.enabled = s.enabled;
            bannerForm.text = s.text;
            bannerForm.color = s.color || 'info';
            bannerForm.start_date = s.start_date || '';
            bannerForm.end_date = s.end_date || '';
        }

        function syncMaintenanceFromStore() {
            const s = store.maintenanceMode;
            maintenanceForm.enabled = s.enabled;
            maintenanceForm.message = s.message || '';
            maintenancePendingEnabled.value = s.enabled;
        }

        // ---- Banner save ----
        async function saveBanner() {
            try {
                await store.saveNoticeBanner({ ...bannerForm });
            } catch (e) {
                console.error('Failed to save notice banner:', e);
            }
        }

        // ---- Maintenance toggle handler ----
        function onMaintenanceToggle(newVal) {
            if (newVal === true) {
                // Turning ON: show confirmation dialog
                maintenancePendingEnabled.value = true;
                confirmMessage.value = maintenanceForm.message || '';
                confirmDialog.value = true;
            } else {
                // Turning OFF: no confirmation needed
                disableMaintenance();
            }
        }

        function cancelMaintenanceToggle() {
            // Revert the switch back to false
            maintenancePendingEnabled.value = false;
            confirmDialog.value = false;
            confirmMessage.value = '';
        }

        async function confirmMaintenanceEnable() {
            try {
                await store.toggleMaintenanceMode(true, confirmMessage.value);
                maintenanceForm.enabled = true;
                maintenanceForm.message = confirmMessage.value;
                confirmDialog.value = false;
                confirmMessage.value = '';
            } catch (e) {
                console.error('Failed to enable maintenance mode:', e);
                maintenancePendingEnabled.value = false;
                confirmDialog.value = false;
            }
        }

        async function disableMaintenance() {
            try {
                await store.toggleMaintenanceMode(false, maintenanceForm.message);
                maintenanceForm.enabled = false;
                maintenancePendingEnabled.value = false;
            } catch (e) {
                console.error('Failed to disable maintenance mode:', e);
                maintenancePendingEnabled.value = true;
            }
        }

        // ---- Helpers ----
        function formatDateTime(iso) {
            if (!iso) return '';
            try {
                const d = new Date(iso);
                return d.toLocaleString();
            } catch {
                return iso;
            }
        }

        function cutoverStatusColor(status) {
            if (status === 'running') return 'info';
            if (status === 'completed') return 'success';
            if (status === 'failed') return 'error';
            return 'warning';
        }

        const cutoverStatusSummary = computed(() => {
            const jobs = store.cutoverJobs || [];
            return [
                { status: 'scheduled', label: 'Scheduled', count: jobs.filter(job => job.status === 'scheduled').length },
                { status: 'running', label: 'Running', count: jobs.filter(job => job.status === 'running').length },
                { status: 'completed', label: 'Completed', count: jobs.filter(job => job.status === 'completed').length },
                { status: 'failed', label: 'Failed', count: jobs.filter(job => job.status === 'failed').length }
            ];
        });

        const selectedCutoverJob = computed(() => {
            const jobs = store.cutoverJobs || [];
            return jobs.find(job => job.id === selectedCutoverJobId.value) || jobs[0] || null;
        });

        function openCutoverJob(job) {
            selectedCutoverJobId.value = job.id;
        }

        // ---- Watch store changes (reactive sync) ----
        watch(() => store.noticeBanner, syncBannerFromStore, { deep: true });
        watch(() => store.maintenanceMode, syncMaintenanceFromStore, { deep: true });
        watch(
            () => store.cutoverJobs,
            (jobs) => {
                if (!jobs.length) {
                    selectedCutoverJobId.value = '';
                    return;
                }
                if (!jobs.some(job => job.id === selectedCutoverJobId.value)) {
                    selectedCutoverJobId.value = jobs[0].id;
                }
            },
            { deep: true, immediate: true }
        );

        // ---- Lifecycle ----
        onMounted(async () => {
            await Promise.all([
                store.fetchNoticeBanner(),
                store.fetchMaintenanceMode()
            ]);
            store.loadCutoverJobs();
            syncBannerFromStore();
            syncMaintenanceFromStore();
        });

        return {
            store,
            bannerForm,
            maintenanceForm,
            maintenancePendingEnabled,
            confirmDialog,
            confirmMessage,
            colorOptions,
            saveBanner,
            onMaintenanceToggle,
            cancelMaintenanceToggle,
            confirmMaintenanceEnable,
            formatDateTime,
            cutoverStatusColor,
            cutoverStatusSummary,
            selectedCutoverJob,
            openCutoverJob
        };
    }
});
</script>

<style scoped>
/* ── Wrapper ─────────────────────────────────────────────────── */
.sysops-wrapper {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    background: #f8fafc;
    min-height: 100%;
}

/* ── Section Card ────────────────────────────────────────────── */
.section-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.section-card--danger {
    border-color: #fca5a5;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.08);
}

/* ── Section Header ──────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.section-header--danger {
    background: #fff5f5;
    border-bottom-color: #fecaca;
}

.section-icon {
    color: #3b82f6;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
}

.danger-badge {
    background: #dc2626;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 4px;
}

/* ── Section Body ────────────────────────────────────────────── */
.section-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
}

/* ── Field Row ───────────────────────────────────────────────── */
.field-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
}

.field-row.column {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
}

.field-label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    min-width: 120px;
    flex-shrink: 0;
}

.field-input {
    width: 100%;
}

.field-divider {
    margin: 0;
    border-color: #f3f4f6;
}

/* ── Color Chips ─────────────────────────────────────────────── */
.color-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.color-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 20px;
    border: 2px solid transparent;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
}

.color-chip--info {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
}
.color-chip--info:hover,
.color-chip--info.active {
    background: #dbeafe;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

.color-chip--warning {
    background: #fffbeb;
    color: #d97706;
    border-color: #fde68a;
}
.color-chip--warning:hover,
.color-chip--warning.active {
    background: #fef3c7;
    border-color: #d97706;
    box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.18);
}

.color-chip--error {
    background: #fff5f5;
    color: #dc2626;
    border-color: #fecaca;
}
.color-chip--error:hover,
.color-chip--error.active {
    background: #fee2e2;
    border-color: #dc2626;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.18);
}

.color-chip--success {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
}
.color-chip--success:hover,
.color-chip--success.active {
    background: #dcfce7;
    border-color: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.18);
}

/* ── Date Range ──────────────────────────────────────────────── */
.date-range {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
}

.date-input {
    flex: 1;
    min-width: 0;
}

.date-separator {
    font-size: 16px;
    color: #9ca3af;
    flex-shrink: 0;
}

/* ── Banner Preview ──────────────────────────────────────────── */
.banner-preview {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 13px;
    border: 1px solid transparent;
    transition: opacity 0.2s ease;
    flex-wrap: wrap;
}

.banner-preview--info {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
}
.banner-preview--warning {
    background: #fffbeb;
    color: #92400e;
    border-color: #fde68a;
}
.banner-preview--error {
    background: #fff5f5;
    color: #991b1b;
    border-color: #fecaca;
}
.banner-preview--success {
    background: #f0fdf4;
    color: #166534;
    border-color: #bbf7d0;
}

.banner-preview-icon {
    flex-shrink: 0;
}

.banner-preview-text {
    flex: 1;
    font-weight: 500;
}

.banner-preview-period {
    font-size: 11px;
    opacity: 0.7;
    white-space: nowrap;
}

/* ── Action Row ──────────────────────────────────────────────── */
.action-row {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
}

/* ── Maintenance Toggle ──────────────────────────────────────── */
.maintenance-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
}

.maintenance-toggle-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.maintenance-toggle-label {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
}

.maintenance-warning-text {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #b45309;
}

.maintenance-switch {
    flex-shrink: 0;
}

/* ── Activated Info ──────────────────────────────────────────── */
.activated-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    background: #fff5f5;
    border: 1px solid #fecaca;
    border-radius: 6px;
    margin-top: 4px;
}

.activated-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.activated-key {
    font-size: 12px;
    color: #6b7280;
    min-width: 100px;
}

.activated-value {
    font-size: 12px;
    font-weight: 500;
    color: #dc2626;
}

/* ── Cut-over Jobs ──────────────────────────────────────────── */
.cutover-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
    color: #6b7280;
    font-size: 13px;
}

.cutover-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cutover-overview {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.cutover-overview__card {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
}

.cutover-overview__label {
    font-size: 12px;
    color: #6b7280;
}

.cutover-overview__value {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 700;
    color: #111827;
}

.cutover-job {
    padding: 14px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #f8fafc;
}

.cutover-job__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.cutover-job__title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
}

.cutover-job__meta {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
}

.cutover-job__summary {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.5;
    color: #374151;
}

.cutover-job__metrics {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: #1d4ed8;
    font-weight: 600;
}

.cutover-job__timeline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: #6b7280;
}

.cutover-job__maintenance {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fff7ed;
    color: #9a3412;
    font-size: 12px;
}

.cutover-job__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
}

.cutover-detail {
    margin-top: 18px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #dbeafe;
    background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.cutover-detail__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.cutover-detail__title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
}

.cutover-detail__meta {
    margin-top: 4px;
    font-size: 12px;
    color: #4b5563;
}

.cutover-detail__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 14px;
}

.cutover-detail__panel {
    padding: 14px;
    border-radius: 10px;
    border: 1px solid #dbeafe;
    background: rgba(255, 255, 255, 0.92);
}

.cutover-detail__panel--full {
    margin-top: 14px;
}

.cutover-detail__panel-title {
    font-size: 13px;
    font-weight: 700;
    color: #1e3a8a;
}

.cutover-detail__timeline {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
}

.cutover-detail__timeline-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    font-size: 12px;
    color: #374151;
}

.cutover-detail__timeline-key {
    min-width: 84px;
    font-weight: 600;
    color: #1f2937;
}

.cutover-detail__snapshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
}

.cutover-detail__snapshot-card {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
}

.cutover-detail__snapshot-title {
    font-size: 12px;
    font-weight: 700;
    color: #111827;
}

.cutover-detail__snapshot-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: #2563eb;
    font-weight: 600;
}

.cutover-detail__snapshot-lines {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.cutover-detail__snapshot-line {
    font-size: 12px;
    color: #4b5563;
}

.cutover-detail__summary-list {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cutover-detail__summary-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    color: #374151;
}

.cutover-detail__error {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff5f5;
    border: 1px solid #fecaca;
    color: #991b1b;
    font-size: 12px;
}

/* ── Confirmation Dialog ─────────────────────────────────────── */
.confirm-dialog-card {
    border-radius: 12px;
    overflow: hidden;
    padding: 0;
}

.confirm-dialog-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #fee2e2;
    background: #fff5f5;
}

.confirm-dialog-title {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
}

.confirm-dialog-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.confirm-warning {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 0;
    line-height: 1.5;
}

.confirm-message-input {
    width: 100%;
}

.confirm-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 24px 20px;
    border-top: 1px solid #f3f4f6;
}

.dialog-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
    min-width: 80px;
}

.dialog-btn--cancel {
    background: #f3f4f6;
    color: #374151;
}

.dialog-btn--cancel:hover {
    background: #e5e7eb;
}

.dialog-btn--danger {
    background: #dc2626;
    color: #ffffff;
}

.dialog-btn--danger:hover:not(:disabled) {
    background: #b91c1c;
}

.dialog-btn--danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>

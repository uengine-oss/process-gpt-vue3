<template>
    <v-card elevation="10" style="position: relative">
        <v-tooltip :text="$t('accountTab.driveSetupGuideTooltip')" location="top">
            <template v-slot:activator="{ props }">
                <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    class="drive-setup-guide-btn"
                    @click="showSetupGuide = true"
                >
                    <v-icon>mdi-information-outline</v-icon>
                </v-btn>
            </template>
        </v-tooltip>
        <v-card-text class="pt-2">
            <v-alert v-if="driveFolderJobStatus === 'running'" type="info" variant="tonal" class="mb-4">
                {{ $t('accountTab.driveIndexingInProgress') }}
                <span
                    v-if="
                        driveFolderJobProgress &&
                        (driveFolderJobProgress.total || driveFolderJobProgress.processed || driveFolderJobProgress.failed)
                    "
                >
                    ({{ driveFolderJobProgress.processed || 0 }}/{{ driveFolderJobProgress.total || '?' }}, failed:
                    {{ driveFolderJobProgress.failed || 0 }})
                </span>
            </v-alert>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.clientId') }}</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    type="text"
                    v-model="driveInfo.client_id"
                    hide-details
                    :disabled="!isEditMode"
                ></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.clientSecret') }}</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    type="password"
                    v-model="driveInfo.client_secret"
                    hide-details
                    :disabled="!isEditMode"
                ></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">Redirect URI</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    type="text"
                    v-model="driveInfo.redirect_uri"
                    hide-details
                    :disabled="!isEditMode"
                ></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.folderId') }}</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    type="text"
                    v-model="driveInfo.drive_folder_id"
                    hide-details
                    :disabled="!isEditMode"
                ></v-text-field>
            </div>
        </v-card-text>

        <v-card-actions class="justify-end">
            <v-btn
                v-if="!isEditMode"
                @click="processDriveFolderDocuments"
                :disabled="!canProcessDriveFolder"
                :loading="isProcessingDriveFolder"
                color="success"
                variant="elevated"
                class="rounded-pill"
                >{{ $t('accountTab.processDocuments') }}</v-btn
            >
            <div v-if="isEditMode">
                <v-btn @click="cancelEdit" color="grey" variant="elevated" class="rounded-pill mr-2">{{ $t('accountTab.cancel') }}</v-btn>
                <v-btn @click="saveDriveInfo" color="primary" variant="elevated" class="rounded-pill">{{ $t('accountTab.save') }}</v-btn>
            </div>
            <v-btn v-else @click="startEdit" color="primary" variant="elevated" class="rounded-pill">{{ $t('accountTab.edit') }}</v-btn>
        </v-card-actions>

        <v-dialog v-model="showSetupGuide" max-width="620">
            <v-card class="drive-setup-guide-card" rounded="lg">
                <div class="drive-setup-guide-header">
                    <div class="drive-setup-guide-header-icon">
                        <v-icon size="22" color="white">mdi-cog-outline</v-icon>
                    </div>
                    <div class="drive-setup-guide-header-text">
                        <div class="drive-setup-guide-header-title">{{ $t('accountTab.driveSetupGuideTitle') }}</div>
                        <div class="drive-setup-guide-header-subtitle">{{ $t('accountTab.driveSetupGuideSubtitle') }}</div>
                    </div>
                    <v-btn @click="showSetupGuide = false" variant="text" density="compact" icon class="drive-setup-guide-close">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>

                <v-card-text class="drive-setup-guide-body">
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">1</span>
                        <div class="drive-setup-guide-step-text">
                            {{ $t('accountTab.driveSetupGuideStep1') }}
                            <a
                                href="https://console.cloud.google.com/projectselector2/home/dashboard"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="drive-setup-guide-link"
                            >
                                <v-icon size="14">mdi-open-in-new</v-icon>
                                {{ $t('accountTab.driveSetupGuideGcpLink') }}
                            </a>
                        </div>
                    </div>
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">2</span>
                        <div class="drive-setup-guide-step-text">{{ $t('accountTab.driveSetupGuideStep2') }}</div>
                    </div>
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">3</span>
                        <div class="drive-setup-guide-step-text">
                            {{ $t('accountTab.driveSetupGuideStep3') }}
                            <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="drive-setup-guide-link"
                            >
                                <v-icon size="14">mdi-open-in-new</v-icon>
                                {{ $t('accountTab.driveSetupGuideCredentialsLink') }}
                            </a>
                        </div>
                    </div>
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">4</span>
                        <div class="drive-setup-guide-step-text">{{ $t('accountTab.driveSetupGuideStep4') }}</div>
                    </div>
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">5</span>
                        <div class="drive-setup-guide-step-text">
                            {{ $t('accountTab.driveSetupGuideStep5') }}
                            <div class="drive-setup-guide-uri-box">
                                <code class="drive-setup-guide-uri">{{ setupGuideRedirectUri }}</code>
                                <v-tooltip :text="$t('accountTab.copy')" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            @click="copySetupGuideRedirectUri"
                                            icon
                                            variant="text"
                                            size="small"
                                            density="compact"
                                        >
                                            <v-icon size="18">mdi-content-copy</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </div>
                        </div>
                    </div>
                    <div class="drive-setup-guide-step">
                        <span class="drive-setup-guide-badge">6</span>
                        <div class="drive-setup-guide-step-text">{{ $t('accountTab.driveSetupGuideStep6') }}</div>
                    </div>

                    <v-alert type="warning" variant="tonal" density="compact" class="drive-setup-guide-note" icon="mdi-alert-outline">
                        {{ $t('accountTab.driveSetupGuideNote') }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="justify-end drive-setup-guide-actions">
                    <v-btn @click="showSetupGuide = false" color="primary" variant="elevated" class="rounded-pill">{{
                        $t('accountTab.close')
                    }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { getTenantUrl } from '@/utils/domainUtils';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        showSetupGuide: false,
        isEditMode: false,
        isProcessingDriveFolder: false,
        isReauthorizing: false,
        driveFolderJobId: null,
        driveFolderJobStatus: 'idle', // idle | running | completed | failed
        driveFolderJobProgress: null,
        driveFolderJobError: null,
        driveFolderStatusTimerId: null,
        driveInfo: {
            tenant_id: `${window.$tenantName}`,
            client_id: '',
            client_secret: '',
            drive_folder_id: '',
            redirect_uri: ''
        },
        savedDriveInfo: null
    }),
    computed: {
        setupGuideRedirectUri() {
            return getTenantUrl(window.$tenantName, '/definition-map');
        },
        canProcessDriveFolder() {
            if (this.isEditMode || this.isProcessingDriveFolder) return false;
            if (this.driveFolderJobStatus === 'running') return false;
            const info = this.savedDriveInfo || this.driveInfo;
            if (!info) return false;
            if (!info.drive_folder_id) return false;
            // OAuth 완료 후에만 활성화 (google_credentials가 없으면 save 시 리다이렉트될 수 있음)
            const hasOAuth = !!info.google_credentials || !!info.google_credentials_updated_at;
            return hasOAuth;
        }
    },
    watch: {
        '$route.query': {
            handler(newVal) {
                if (newVal.code && newVal.state && newVal.scope) {
                    this.getOAuth();
                }
            }
        }
    },
    async mounted() {
        const value = await backend.getDriveInfo();
        if (value) {
            this.driveInfo = value;
            this.savedDriveInfo = JSON.parse(JSON.stringify(value));
        }

        if (this.$route.query.code && this.$route.query.state && this.$route.query.scope) {
            await this.getOAuth();
        }

        this.restoreDriveFolderJobAndPoll();
    },
    beforeUnmount() {
        this.stopDriveFolderPolling();
    },
    methods: {
        getDriveFolderJobStorageKey() {
            return `drive_folder_process_job_id:${window.$tenantName}`;
        },
        notifySnackbar(message, color = 'success', detail = null) {
            if (!window.$app_) return;
            window.$app_.snackbarMessage = message;
            window.$app_.snackbarColor = color;
            window.$app_.snackbar = true;
            window.$app_.snackbarSuccessStatus = color === 'success';
            window.$app_.snackbarMessageDetail = detail;
            window.$app_.clickCount = 0;
        },
        restoreDriveFolderJobAndPoll() {
            const storedJobId = localStorage.getItem(this.getDriveFolderJobStorageKey());
            if (!storedJobId) return;
            this.driveFolderJobId = storedJobId;
            this.startDriveFolderPolling(storedJobId);
        },
        startDriveFolderPolling(jobId) {
            this.stopDriveFolderPolling();
            this.driveFolderJobStatus = 'running';
            this.driveFolderJobId = jobId;
            // 즉시 1회 조회 후, 주기적으로 폴링
            this.fetchDriveFolderJobStatus().catch(() => {});
            this.driveFolderStatusTimerId = window.setInterval(() => {
                this.fetchDriveFolderJobStatus().catch(() => {});
            }, 3000);
        },
        stopDriveFolderPolling() {
            if (this.driveFolderStatusTimerId) {
                clearInterval(this.driveFolderStatusTimerId);
                this.driveFolderStatusTimerId = null;
            }
        },
        normalizeDriveJobStatus(raw) {
            const s = String(raw || '').toLowerCase();
            if (['running', 'in_progress', 'started', 'processing'].includes(s)) return 'running';
            if (['completed', 'done', 'success', 'succeeded'].includes(s)) return 'completed';
            if (['failed', 'error', 'errored'].includes(s)) return 'failed';
            if (['idle', 'none'].includes(s)) return 'idle';
            return s || 'running';
        },
        async fetchDriveFolderJobStatus() {
            if (!this.driveFolderJobId) return;

            const res = await backend.getDriveFolderProcessStatus({
                tenant_id: window.$tenantName,
                job_id: this.driveFolderJobId
            });

            const status = this.normalizeDriveJobStatus(res?.status);
            this.driveFolderJobProgress = {
                total: res?.total ?? res?.progress?.total,
                processed: res?.processed ?? res?.progress?.processed,
                failed: res?.failed ?? res?.progress?.failed
            };
            this.driveFolderJobError = res?.error || null;

            if (status === 'running') {
                this.driveFolderJobStatus = 'running';
                return;
            }

            // 완료/실패/idle: 폴링 종료 + 로컬 상태 정리
            this.stopDriveFolderPolling();
            localStorage.removeItem(this.getDriveFolderJobStorageKey());

            if (status === 'completed') {
                this.driveFolderJobStatus = 'completed';
                this.notifySnackbar(this.$t('accountTab.driveIndexingCompleted'), 'success');
                this.driveFolderJobId = null;
                return;
            }

            if (status === 'failed') {
                this.driveFolderJobStatus = 'failed';
                this.notifySnackbar(this.$t('accountTab.driveIndexingFailed'), 'error', this.driveFolderJobError);
                this.driveFolderJobId = null;
                return;
            }

            // idle 또는 알 수 없는 상태
            this.driveFolderJobStatus = 'idle';
            this.driveFolderJobId = null;
        },
        async copySetupGuideRedirectUri() {
            try {
                await navigator.clipboard.writeText(this.setupGuideRedirectUri);
                this.notifySnackbar('클립보드에 복사되었습니다.', 'success');
            } catch (error) {
                console.error('클립보드 복사 실패:', error);
            }
        },
        startEdit() {
            this.isEditMode = true;
        },
        cancelEdit() {
            if (this.savedDriveInfo) {
                this.driveInfo = JSON.parse(JSON.stringify(this.savedDriveInfo));
            }
            this.isEditMode = false;
        },
        async getOAuth() {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const state = urlParams.get('state');
                const scope = urlParams.get('scope');
                const email = (this.userInfo && this.userInfo.email) || localStorage.getItem('email');

                const response = await fetch('/memento/auth/google/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, state, scope, user_email: email })
                });
                const result = await response.json();
                if (result.success) {
                    if (this.$router) {
                        await this.$router.replace({ path: this.$route.path, query: {} });
                    }
                    const value = await backend.getDriveInfo();
                    if (value) {
                        this.driveInfo = value;
                        this.savedDriveInfo = JSON.parse(JSON.stringify(value));
                    }
                }
            } catch (error) {
                console.error('OAuth 실패:', error);
            }
        },
        saveDriveInfo() {
            var me = this;
            me.$try({
                action: async () => {
                    await backend.saveDriveInfo(this.driveInfo);
                    this.driveInfo = await backend.getDriveInfo();
                    this.savedDriveInfo = JSON.parse(JSON.stringify(this.driveInfo));
                    this.isEditMode = false;
                },
                successMsg: '구글 드라이브 연동 정보가 저장되었습니다.'
            });
        },
        async reauthorizeGoogleDrive() {
            this.isReauthorizing = true;
            try {
                const axios = (await import('axios')).default;
                const response = await axios.get('/memento/auth/google/url', {
                    params: { tenant_id: window.$tenantName }
                });
                if (response.data && response.data.auth_url) {
                    window.location.href = response.data.auth_url;
                } else {
                    this.notifySnackbar('인증 URL을 받지 못했습니다', 'error', JSON.stringify(response.data));
                    this.isReauthorizing = false;
                }
            } catch (e) {
                console.error('Google Drive 재인증 실패:', e);
                this.notifySnackbar('재인증 요청 실패', 'error', e?.response?.data?.detail || e?.message);
                this.isReauthorizing = false;
            }
        },
        processDriveFolderDocuments() {
            const me = this;
            me.$try({
                action: async () => {
                    me.isProcessingDriveFolder = true;
                    try {
                        const info = me.savedDriveInfo || me.driveInfo;
                        const result = await backend.processDriveFolder({
                            drive_folder_id: info.drive_folder_id
                        });
                        const jobId = result?.job_id || result?.jobId || result?.id || null;
                        if (jobId) {
                            me.driveFolderJobId = jobId;
                            me.driveFolderJobStatus = 'running';
                            localStorage.setItem(me.getDriveFolderJobStorageKey(), jobId);
                            me.startDriveFolderPolling(jobId);
                        }
                    } finally {
                        me.isProcessingDriveFolder = false;
                    }
                },
                successMsg: me.$t('accountTab.processDocumentsStarted')
            });
        }
    }
};
</script>

<style scoped>
.drive-setup-guide-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
}

.drive-setup-guide-card {
    overflow: hidden;
}

.drive-setup-guide-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 20px;
    background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgba(var(--v-theme-primary), 0.75) 100%);
}

.drive-setup-guide-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.18);
}

.drive-setup-guide-header-text {
    flex: 1;
    min-width: 0;
}

.drive-setup-guide-header-title {
    color: #fff;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
}

.drive-setup-guide-header-subtitle {
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.8rem;
    margin-top: 2px;
}

.drive-setup-guide-close {
    color: #fff !important;
    flex-shrink: 0;
}

.drive-setup-guide-body {
    padding: 24px 24px 8px;
}

.drive-setup-guide-step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding-bottom: 18px;
    position: relative;
}

.drive-setup-guide-step:not(:last-of-type)::before {
    content: '';
    position: absolute;
    left: 13px;
    top: 28px;
    bottom: 0;
    width: 2px;
    background-color: rgba(var(--v-theme-on-surface), var(--v-border-opacity, 0.12));
}

.drive-setup-guide-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    border-radius: 50%;
    background-color: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
    font-size: 0.8rem;
    font-weight: 700;
    z-index: 1;
}

.drive-setup-guide-step-text {
    padding-top: 3px;
    line-height: 1.55;
    font-size: 0.9rem;
}

.drive-setup-guide-link {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: 6px;
    color: rgb(var(--v-theme-primary));
    font-size: 0.82rem;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
}

.drive-setup-guide-link:hover {
    text-decoration: underline;
}

.drive-setup-guide-uri-box {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    padding: 6px 6px 6px 12px;
    background-color: rgba(var(--v-theme-on-surface), 0.05);
    border: 1px solid rgba(var(--v-theme-on-surface), var(--v-border-opacity, 0.12));
    border-radius: 8px;
}

.drive-setup-guide-uri {
    flex: 1;
    min-width: 0;
    background: none;
    word-break: break-all;
    font-size: 0.82rem;
    color: rgb(var(--v-theme-primary));
}

.drive-setup-guide-note {
    margin-top: 4px;
    margin-bottom: 16px;
}

.drive-setup-guide-actions {
    padding: 8px 24px 20px;
}
</style>

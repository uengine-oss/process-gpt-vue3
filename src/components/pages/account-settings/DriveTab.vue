<template>
    <v-card elevation="10">
        <v-card-text class="pt-2">
            <v-alert
                v-if="driveFolderJobStatus === 'running'"
                type="info"
                variant="tonal"
                class="mb-4"
            >
                {{ $t('accountTab.driveIndexingInProgress') }}
                <span v-if="driveFolderJobProgress && (driveFolderJobProgress.total || driveFolderJobProgress.processed || driveFolderJobProgress.failed)">
                    ({{ driveFolderJobProgress.processed || 0 }}/{{ driveFolderJobProgress.total || '?' }}, failed: {{ driveFolderJobProgress.failed || 0 }})
                </span>
            </v-alert>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.clientId') }}</v-label>
                <v-text-field color="primary" variant="outlined" type="text" v-model="driveInfo.client_id" hide-details :disabled="!isEditMode"></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.clientSecret') }}</v-label>
                <v-text-field color="primary" variant="outlined" type="password" v-model="driveInfo.client_secret" hide-details :disabled="!isEditMode"></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">Redirect URI</v-label>
                <v-text-field color="primary" variant="outlined" type="text" v-model="driveInfo.redirect_uri" hide-details :disabled="!isEditMode"></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.folderId') }}</v-label>
                <v-text-field color="primary" variant="outlined" type="text" v-model="driveInfo.drive_folder_id" hide-details :disabled="!isEditMode"></v-text-field>
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
            >{{ $t('accountTab.processDocuments') }}</v-btn>
            <div v-if="isEditMode">
                <v-btn @click="cancelEdit"
                    color="grey"
                    variant="elevated"
                    class="rounded-pill mr-2"
                >{{ $t('accountTab.cancel') }}</v-btn>
                <v-btn @click="saveDriveInfo"
                    color="primary"
                    variant="elevated"
                    class="rounded-pill"
                >{{ $t('accountTab.save') }}</v-btn>
            </div>
            <v-btn v-else @click="startEdit"
                color="primary"
                variant="elevated"
                class="rounded-pill"
            >{{ $t('accountTab.edit') }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        isEditMode: false,
        isProcessingDriveFolder: false,
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
            redirect_uri: '',
        },
        savedDriveInfo: null,
    }),
    computed: {
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
            },
        },
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
                failed: res?.failed ?? res?.progress?.failed,
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
                successMsg: "구글 드라이브 연동 정보가 저장되었습니다."
            });
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

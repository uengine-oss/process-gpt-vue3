<template>
    <v-row class="ma-0 pa-0">
        <v-col cols="12" md="9">
            <v-card flat class="pa-1">
                <v-card-item class="pa-0">
                    <h4 class="text-h4">{{ $t('accountTab.drive') }}</h4>
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
                </v-card-item>
            </v-card>
        </v-col>
    </v-row>

    <div class="d-flex justify-end mt-5 pb-3">
        <div v-if="isEditMode">
            <v-btn size="large" color="grey" variant="flat" rounded="pill" class="mr-2" @click="isEditMode = false">{{ $t('accountTab.cancel') }}</v-btn>
            <v-btn size="large" color="primary" variant="flat" rounded="pill" class="mr-4" @click="saveDriveInfo">{{ $t('accountTab.save') }}</v-btn>
        </div>
        <v-btn v-else size="large" color="primary" variant="flat" rounded="pill" class="mr-4" @click="isEditMode = true">{{ $t('accountTab.edit') }}</v-btn>

    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        isEditMode: false,
        driveInfo: {
            tenant_id: `${window.$tenantName}`,
            client_id: '',
            client_secret: '',
            drive_folder_id: '',
            provider: 'google',
            redirect_uri: '',
        },
    }),
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
        }

        if (this.$route.query.code && this.$route.query.state && this.$route.query.scope) {
            await this.getOAuth();
        }
    },
    methods: {
        async getOAuth() {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const state = urlParams.get('state');
                const scope = urlParams.get('scope');
                const email = this.userInfo.email;

                const response = await fetch('/memento/auth/google/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, state, scope, user_email: email })
                });
                const result = await response.json();
                if (result.success) {
                    this.$route.query = {}
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
                    this.isEditMode = false;
                },
                successMsg: "구글 드라이브 연동 정보가 저장되었습니다."
            });
        }
    }
};
</script>

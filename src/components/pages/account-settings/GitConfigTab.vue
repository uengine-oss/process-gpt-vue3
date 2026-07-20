<template>
    <div class="pa-4">
        <!-- 헤더 -->
        <v-row class="ma-0 pa-0 mb-4" align="center">
            <v-col>
                <h4 class="text-h4">{{ $t('accountTab.gitConfig') }}</h4>
                <p class="text-body-2 text--secondary ma-0 mt-1">{{ $t('accountTab.gitConfigDescription') }}</p>
            </v-col>
            <v-col cols="auto">
                <v-btn color="primary" variant="flat" rounded @click="openAddDialog">
                    <v-icon class="mr-2">mdi-plus</v-icon>
                    {{ $t('accountTab.addGitConfig') }}
                </v-btn>
            </v-col>
        </v-row>

        <!-- 설정 목록 -->
        <v-row v-if="configs.length === 0" class="ma-0 pa-0">
            <v-col cols="12">
                <v-card variant="outlined" class="pa-8 text-center">
                    <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-git</v-icon>
                    <div class="text-body-1 text-medium-emphasis">{{ $t('accountTab.noGitConfig') }}</div>
                </v-card>
            </v-col>
        </v-row>

        <v-row class="ma-0 pa-0">
            <v-col v-for="config in configs" :key="config.id" cols="12" md="6">
                <v-card variant="outlined" class="pa-4">
                    <v-row align="center" no-gutters class="mb-2">
                        <v-icon :color="providerColor(config.provider)" class="mr-2">{{ providerIcon(config.provider) }}</v-icon>
                        <span class="text-subtitle-1 font-weight-medium">{{ providerLabel(config.provider) }}</span>
                        <v-chip v-if="config.is_default" color="primary" size="x-small" class="ml-2">
                            {{ $t('accountTab.default') }}
                        </v-chip>
                        <v-spacer></v-spacer>
                        <v-btn icon variant="text" density="compact" @click="openEditDialog(config)">
                            <v-icon size="18">mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn icon variant="text" density="compact" color="error" @click="confirmDelete(config)">
                            <v-icon size="18">mdi-delete</v-icon>
                        </v-btn>
                    </v-row>
                    <div class="text-body-2 text-medium-emphasis">
                        <div>
                            <strong>{{ $t('accountTab.username') }}:</strong> {{ config.username }}
                        </div>
                        <div v-if="config.base_url">
                            <strong>{{ $t('accountTab.baseUrl') }}:</strong> {{ config.base_url }}
                        </div>
                    </div>
                </v-card>
            </v-col>
        </v-row>

        <!-- 추가/수정 다이얼로그 -->
        <v-dialog v-model="dialog" max-width="560" persistent>
            <v-card>
                <v-row class="ma-0 pa-4 pb-0 align-center">
                    <v-card-title class="pa-0">{{
                        editingId ? $t('accountTab.editGitConfig') : $t('accountTab.addGitConfig')
                    }}</v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="closeDialog" variant="text" density="compact" icon>
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-card-text class="pt-4">
                    <!-- Provider 선택 -->
                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.provider') }}</v-label>
                    <v-select
                        v-model="form.provider"
                        :items="providerOptions"
                        item-title="label"
                        item-value="value"
                        variant="outlined"
                        color="primary"
                        hide-details
                        class="mb-4"
                        :disabled="!!editingId"
                    ></v-select>

                    <!-- Base URL (gitlab/gitea만) -->
                    <template v-if="form.provider === 'gitlab' || form.provider === 'gitea'">
                        <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.baseUrl') }}</v-label>
                        <v-text-field
                            v-model="form.base_url"
                            color="primary"
                            variant="outlined"
                            :placeholder="form.provider === 'gitea' ? 'https://gitea.example.com' : 'https://gitlab.example.com'"
                            hide-details
                            class="mb-4"
                        ></v-text-field>
                    </template>

                    <!-- Username -->
                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.username') }}</v-label>
                    <v-text-field v-model="form.username" color="primary" variant="outlined" hide-details class="mb-4"></v-text-field>

                    <!-- Token -->
                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.token') }}</v-label>
                    <v-text-field
                        v-model="form.token"
                        color="primary"
                        variant="outlined"
                        :type="showToken ? 'text' : 'password'"
                        hide-details
                        class="mb-4"
                        :append-inner-icon="showToken ? 'mdi-eye-off' : 'mdi-eye'"
                        @click:append-inner="showToken = !showToken"
                    ></v-text-field>

                    <!-- 기본 설정 여부 -->
                    <v-checkbox v-model="form.is_default" color="primary" :label="$t('accountTab.setAsDefault')" hide-details></v-checkbox>

                    <!-- 안내 문구 -->
                    <v-alert type="info" variant="tonal" class="mt-4" density="compact">
                        {{ tokenHint }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="justify-end pa-4 pt-0">
                    <v-btn @click="closeDialog" color="grey" variant="elevated" class="rounded-pill mr-2">{{
                        $t('accountTab.cancel')
                    }}</v-btn>
                    <v-btn @click="saveConfig" color="primary" variant="elevated" class="rounded-pill" :loading="saving">{{
                        $t('accountTab.save')
                    }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>{{ $t('accountTab.deleteGitConfig') }}</v-card-title>
                <v-card-text>{{
                    $t('accountTab.deleteGitConfigConfirm', { provider: providerLabel(deletingConfig?.provider) })
                }}</v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn @click="deleteDialog = false" color="grey" variant="text">{{ $t('accountTab.cancel') }}</v-btn>
                    <v-btn @click="deleteConfig" color="error" variant="elevated" class="rounded-pill" :loading="deleting">{{
                        $t('accountTab.delete')
                    }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        configs: [],
        dialog: false,
        deleteDialog: false,
        showToken: false,
        saving: false,
        deleting: false,
        editingId: null,
        deletingConfig: null,
        form: {
            provider: 'github',
            base_url: '',
            username: '',
            token: '',
            is_default: false
        },
        providerOptions: [
            { label: 'GitHub', value: 'github' },
            { label: 'GitLab', value: 'gitlab' },
            { label: 'Gitea', value: 'gitea' }
        ]
    }),
    computed: {
        tokenHint() {
            const hints = {
                github: this.$t('accountTab.tokenHintGithub'),
                gitlab: this.$t('accountTab.tokenHintGitlab'),
                gitea: this.$t('accountTab.tokenHintGitea')
            };
            return hints[this.form.provider] || '';
        }
    },
    async mounted() {
        await this.loadConfigs();
    },
    methods: {
        async loadConfigs() {
            this.configs = await backend.getGitConfigs();
        },
        providerIcon(provider) {
            return { github: 'mdi-github', gitlab: 'mdi-gitlab', gitea: 'mdi-git' }[provider] || 'mdi-git';
        },
        providerColor(provider) {
            return { github: 'black', gitlab: 'orange', gitea: 'green' }[provider] || 'grey';
        },
        providerLabel(provider) {
            return { github: 'GitHub', gitlab: 'GitLab', gitea: 'Gitea' }[provider] || provider;
        },
        openAddDialog() {
            this.editingId = null;
            this.form = { provider: 'github', base_url: '', username: '', token: '', is_default: false };
            this.showToken = false;
            this.dialog = true;
        },
        openEditDialog(config) {
            this.editingId = config.id;
            this.form = {
                provider: config.provider,
                base_url: config.base_url || '',
                username: config.username,
                token: config.token,
                is_default: config.is_default
            };
            this.showToken = false;
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
            this.editingId = null;
            this.showToken = false;
        },
        async saveConfig() {
            if (!this.form.username || !this.form.token) return;
            this.saving = true;
            try {
                await backend.saveGitConfig({ id: this.editingId, ...this.form });
                await this.loadConfigs();
                this.closeDialog();
                window.$app_.snackbarMessage = this.$t('accountTab.gitConfigSaveSuccess');
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                window.$app_.snackbarSuccessStatus = true;
            } catch (e) {
                window.$app_.snackbarMessage = e.message;
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
            } finally {
                this.saving = false;
            }
        },
        confirmDelete(config) {
            this.deletingConfig = config;
            this.deleteDialog = true;
        },
        async deleteConfig() {
            this.deleting = true;
            try {
                await backend.deleteGitConfig(this.deletingConfig.id);
                await this.loadConfigs();
                this.deleteDialog = false;
                this.deletingConfig = null;
                window.$app_.snackbarMessage = this.$t('accountTab.gitConfigDeleteSuccess');
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                window.$app_.snackbarSuccessStatus = true;
            } catch (e) {
                window.$app_.snackbarMessage = e.message;
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
            } finally {
                this.deleting = false;
            }
        }
    }
};
</script>

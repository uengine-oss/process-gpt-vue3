<template>
    <v-card elevation="10">
        <v-card-text class="pt-2">
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.githubUsername') }}</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    type="text"
                    v-model="githubInfo.github_username"
                    hide-details
                    :disabled="!isEditMode"
                ></v-text-field>
            </div>
            <div class="mt-6">
                <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.githubToken') }}</v-label>
                <v-text-field
                    color="primary"
                    variant="outlined"
                    :type="showToken ? 'text' : 'password'"
                    v-model="githubInfo.github_token"
                    hide-details
                    :disabled="!isEditMode"
                    :append-inner-icon="isEditMode ? (showToken ? 'mdi-eye-off' : 'mdi-eye') : ''"
                    @click:append-inner="showToken = !showToken"
                ></v-text-field>
            </div>
            <v-alert type="info" variant="tonal" class="mt-6" density="compact">
                {{ $t('accountTab.githubTokenHint') }}
            </v-alert>
        </v-card-text>

        <v-card-actions class="justify-end">
            <div v-if="isEditMode">
                <v-btn @click="cancelEdit" color="grey" variant="elevated" class="rounded-pill mr-2">{{ $t('accountTab.cancel') }}</v-btn>
                <v-btn @click="saveGithubInfo" color="primary" variant="elevated" class="rounded-pill">{{ $t('accountTab.save') }}</v-btn>
            </div>
            <v-btn v-else @click="startEdit" color="primary" variant="elevated" class="rounded-pill">{{ $t('accountTab.edit') }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        isEditMode: false,
        showToken: false,
        githubInfo: {
            github_username: '',
            github_token: ''
        },
        savedGithubInfo: null
    }),
    async mounted() {
        const value = await backend.getGithubInfo();
        if (value) {
            this.githubInfo = {
                github_username: value.github_username || '',
                github_token: value.github_token || ''
            };
            this.savedGithubInfo = { ...this.githubInfo };
        }
    },
    methods: {
        startEdit() {
            this.isEditMode = true;
        },
        cancelEdit() {
            if (this.savedGithubInfo) {
                this.githubInfo = { ...this.savedGithubInfo };
            }
            this.showToken = false;
            this.isEditMode = false;
        },
        saveGithubInfo() {
            this.$try({
                action: async () => {
                    await backend.saveGithubInfo(this.githubInfo);
                    this.savedGithubInfo = { ...this.githubInfo };
                    this.showToken = false;
                    this.isEditMode = false;
                },
                successMsg: this.$t('accountTab.githubSaveSuccess')
            });
        }
    }
};
</script>

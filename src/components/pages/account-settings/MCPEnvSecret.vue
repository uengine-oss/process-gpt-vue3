<template>
    <v-row class="ma-0 pa-0">
        <v-col cols="12">
            <v-card flat class="mb-8 pa-1">
                <v-card-item class="pa-0">
                    <v-row class="ma-0 pa-0 mb-4">
                        <!-- <h5 class="text-h5">MCP Environments</h5> -->
                        <v-spacer></v-spacer>
                        <v-btn 
                            color="primary" 
                            variant="flat"
                            rounded
                            @click="openDialog('environment')"
                        >
                            <v-row class="pa-0 ma-0 align-center">
                                <v-icon class="mr-2" style="padding-top: 3px;">mdi-plus</v-icon>
                                <div>{{ $t('accountTab.addEnvironment') }}</div>
                            </v-row>
                        </v-btn>
                    </v-row>
                    <v-data-table
                        :headers="headers"
                        :items="envItems"
                        class="elevation-1"
                        :loading="loading"
                        :loading-text="$t('MCPEnvSecret.loadingEnvironments')"
                    >
                        <template #item.actions="{ item }">
                            <v-icon size="small" class="me-2" @click="editItem(item, 'environment')"> mdi-pencil </v-icon>
                            <v-icon size="small" @click="deleteItem(item, 'environment')"> mdi-delete </v-icon>
                        </template>
                    </v-data-table>
                </v-card-item>
            </v-card>

            <v-divider class="my-6"></v-divider>

            <v-card flat class="pa-1">
                <v-card-item class="pa-0">
                    <v-row class="ma-0 pa-0 mb-4">
                        <h5 class="text-h5">{{ $t('MCPEnvSecret.mcpSecrets') }}</h5>
                        <v-spacer></v-spacer>
                        <v-btn
                            color="primary" 
                            variant="flat"
                            rounded
                            @click="openDialog('secret')"
                        >
                            <v-row class="pa-0 ma-0 align-center">
                                <v-icon class="mr-2" style="padding-top: 3px;">mdi-plus</v-icon>
                                <div>{{ $t('accountTab.addSecret') }}</div>
                            </v-row>
                        </v-btn>
                    </v-row>
                    <v-data-table
                        :headers="headers"
                        :items="secretItems"
                        class="elevation-1"
                        :loading="loading"
                        :loading-text="$t('MCPEnvSecret.loadingSecrets')"
                    >
                        <template #item.actions="{ item }">
                            <v-icon size="small" class="me-2" @click="editItem(item, 'secret')"> mdi-pencil </v-icon>
                            <v-icon size="small" @click="deleteItem(item, 'secret')"> mdi-delete </v-icon>
                        </template>
                    </v-data-table>
                </v-card-item>
            </v-card>
        </v-col>
    </v-row>

    <!-- Unified Dialog -->
    <v-dialog v-model="dialog"
        max-width="800px"
        persistent
        :fullscreen="isMobile"
    >
        <v-card class="pa-4">
            <v-row class="ma-0 pa-0 align-center">
                <v-card-title class="pa-0"
                >{{ editing ? (currentType === 'environment' ? $t('accountTab.editEnvironment') : $t('accountTab.editSecret')) : (currentType === 'environment' ? $t('accountTab.addEnvironment') : $t('accountTab.addSecret')) }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="closeDialog"
                    class="ml-auto" 
                    variant="text" 
                    density="compact"
                    icon
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>
            <v-card-text class="ma-0 pa-0 pt-4">
                <v-container class="ma-0 pa-0">
                    <v-row class="ma-0 pa-0">
                        <v-col v-if="!editing"
                            cols="12"
                            class="pa-0"
                        >
                            <v-select v-model="currentType" :items="typeOptions" :label="$t('MCPEnvSecret.type') + '*'" required :disabled="editing"></v-select>
                        </v-col>
                        <v-col cols="12"
                            class="pa-0"
                        >
                            <v-text-field
                                v-model="form.name"
                                :label="`${currentType === 'environment' ? $t('MCPEnvSecret.environmentName') : $t('MCPEnvSecret.secretName')}*`"
                                required
                                :rules="[(v) => !!v || $t('MCPEnvSecret.nameRequired')]"
                            ></v-text-field>
                        </v-col>
                        <h6 class="text-h6 pa-0 pt-2">{{ $t('accountTab.indicatesRequiredField') }}</h6>
                        <v-col cols="12"
                            class="pa-0 pt-4"
                        >
                            <vue-monaco-editor
                                :class="currentType === 'environment' ? 'mcp-environment-monaco-editor' : 'mcp-secret-monaco-editor'"
                                v-model:value="form.data"
                                language="json"
                                :options="MONACO_EDITOR_OPTIONS"
                                @mount="handleMount"
                            />
                            <v-checkbox
                                v-if="currentType === 'secret'"
                                v-model="showPassword"
                                :label="$t('accountTab.showSecretData')"
                                density="compact"
                            ></v-checkbox>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            <!-- <v-card-actions>
                <v-spacer></v-spacer> 
                <v-btn color="blue-darken-1" variant="text" @click="closeDialog"> Cancel </v-btn>
                <v-btn color="blue-darken-1" variant="text" @click="saveItem" :loading="saving"> Save </v-btn>
            </v-card-actions>-->

            <v-row class="ma-0 pa-0 mt-4">
                <v-spacer></v-spacer>
                <v-btn @click="saveItem"
                    :loading="saving"
                    :disabled="!form.data || !form.name" 
                    color="primary" 
                    variant="flat" 
                    rounded 
                >{{ $t('accountTab.save') }}</v-btn>
            </v-row>
        </v-card>
        
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data() {
        return {
            headers: [
                { title: this.$t('MCPEnvSecret.name'), key: 'name' },
                { title: this.$t('MCPEnvSecret.data'), key: 'data' },
                { title: this.$t('MCPEnvSecret.actions'), key: 'actions' }
            ],
            envItems: [],
            secretItems: [],
            loading: false,
            saving: false,
            MONACO_EDITOR_OPTIONS: {
                automaticLayout: true,
                formatOnType: true,
                formatOnPaste: true
            },
            // Unified Dialog
            dialog: false,
            editing: false,
            currentType: 'environment',
            typeOptions: [
                { title: this.$t('MCPEnvSecret.environment'), value: 'environment' },
                { title: this.$t('MCPEnvSecret.secret'), value: 'secret' }
            ],
            form: {
                name: '',
                data: ''
            },
            showPassword: false
        };
    },
    async mounted() {
        this.getEnv();
        this.getSecrets();
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    },
    methods: {
        async getEnv() {
            this.loading = true;
            try {
                await backend.getEnvByTenant().then((res) => {
                    this.envItems = res;
                });
            } catch (error) {
                console.error('Error loading environments:', error);
            } finally {
                this.loading = false;
            }
        },

        async getSecrets() {
            this.loading = true;
            try {
                await backend.getSecretByTenant().then((res) => {
                    this.secretItems = res;
                });
            } catch (error) {
                console.error('Error loading secrets:', error);
            } finally {
                this.loading = false;
            }
        },

        // Unified Dialog Methods
        openDialog(type) {
            this.editing = false;
            this.currentType = type;
            this.form = { name: '', data: '' };
            this.showPassword = false;
            this.dialog = true;
        },

        editItem(item, type) {
            this.editing = true;
            this.currentType = type;
            this.form = { name: item.name, data: JSON.stringify(item.data) };
            this.showPassword = false;
            this.dialog = true;
        },

        closeDialog() {
            this.dialog = false;
            this.form = { name: '', data: '' };
            this.editing = false;
            this.showPassword = false;
            this.currentType = 'environment';
        },

        async saveItem() {
            if (!this.form.name || !this.form.data) {
                return;
            }

            this.saving = true;
            let tmp = {
                name: this.form.name,
                data: JSON.parse(this.form.data)
            };
            try {
                if (this.currentType === 'environment') {
                    if (this.editing) {
                        await backend.updateEnvByTenant(tmp);
                    } else {
                        await backend.createEnvByTenant(tmp);
                    }
                    await this.getEnv();
                } else {
                    if (this.editing) {
                        await backend.updateSecretByTenant(tmp);
                    } else {
                        await backend.createSecretByTenant(tmp);
                    }
                    await this.getSecrets();
                }

                this.closeDialog();

                this.$emit('snackbar', {
                    show: true,
                    text: this.editing 
                        ? (this.currentType === 'environment' ? this.$t('MCPEnvSecret.environmentUpdated') : this.$t('MCPEnvSecret.secretUpdated'))
                        : (this.currentType === 'environment' ? this.$t('MCPEnvSecret.environmentCreated') : this.$t('MCPEnvSecret.secretCreated')),
                    color: 'success'
                });
            } catch (error) {
                console.error(`Error saving ${this.currentType}:`, error);
                this.$emit('snackbar', {
                    show: true,
                    text: this.currentType === 'environment' ? this.$t('MCPEnvSecret.errorSavingEnvironment') : this.$t('MCPEnvSecret.errorSavingSecret'),
                    color: 'error'
                });
            } finally {
                this.saving = false;
            }
        },

        async deleteItem(item, type) {
            const confirmMessage = type === 'environment' 
                ? this.$t('MCPEnvSecret.confirmDeleteEnvironment', { name: item.name })
                : this.$t('MCPEnvSecret.confirmDeleteSecret', { name: item.name });
            if (confirm(confirmMessage)) {
                try {
                    if (type === 'environment') {
                        await backend.deleteEnvByTenant(item.name);
                        await this.getEnv();
                    } else {
                        await backend.deleteSecretByTenant(item.name);
                        await this.getSecrets();
                    }

                    this.$emit('snackbar', {
                        show: true,
                        text: type === 'environment' ? this.$t('MCPEnvSecret.environmentDeleted') : this.$t('MCPEnvSecret.secretDeleted'),
                        color: 'success'
                    });
                } catch (error) {
                    console.error(`Error deleting ${type}:`, error);
                    this.$emit('snackbar', {
                        show: true,
                        text: type === 'environment' ? this.$t('MCPEnvSecret.errorDeletingEnvironment') : this.$t('MCPEnvSecret.errorDeletingSecret'),
                        color: 'error'
                    });
                }
            }
        }
    }
};
</script>

<style scoped>
.v-list-item {
    transition: background-color 0.2s ease;
}

.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

/* 모바일 다이얼로그 스타일 */
.dialog-bottom-transition-enter-active,
.dialog-bottom-transition-leave-active {
    transition: transform 0.3s ease-in-out;
}

.dialog-bottom-transition-enter-from,
.dialog-bottom-transition-leave-to {
    transform: translateY(100%);
}
</style>

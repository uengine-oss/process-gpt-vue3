<template>
    <v-row class="justify-center">
        <v-col cols="12">
            <v-card flat class="mb-6">
                <v-card-item>
                    <div class="d-flex justify-space-between align-center mb-4">
                        <h5 class="text-h5">MCP Environments</h5>
                        <v-btn color="primary" @click="openDialog('environment')">
                            <v-icon class="me-2">mdi-plus</v-icon>
                            Add Environment
                        </v-btn>
                    </div>
                    <v-data-table
                        :headers="headers"
                        :items="envItems"
                        class="elevation-1"
                        :loading="loading"
                        loading-text="Loading Environments..."
                    >
                        <template #item.actions="{ item }">
                            <v-icon size="small" class="me-2" @click="editItem(item, 'environment')"> mdi-pencil </v-icon>
                            <v-icon size="small" @click="deleteItem(item, 'environment')"> mdi-delete </v-icon>
                        </template>
                    </v-data-table>
                </v-card-item>
            </v-card>

            <v-divider class="my-6"></v-divider>

            <v-card flat>
                <v-card-item>
                    <div class="d-flex justify-space-between align-center mb-4">
                        <h5 class="text-h5">MCP Secrets</h5>
                        <v-btn color="primary" @click="openDialog('secret')">
                            <v-icon class="me-2">mdi-plus</v-icon>
                            Add Secret
                        </v-btn>
                    </div>
                    <v-data-table
                        :headers="headers"
                        :items="secretItems"
                        class="elevation-1"
                        :loading="loading"
                        loading-text="Loading Secrets..."
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
    <v-dialog v-model="dialog" max-width="800px" max-height="800px" persistent>
        <v-card>
            <v-card-title>
                <span class="text-h5">{{ editing ? 'Edit' : 'Add' }} {{ currentType === 'environment' ? 'Environment' : 'Secret' }}</span>
            </v-card-title>
            <v-card-text>
                <v-container>
                    <v-row>
                        <v-col cols="12" v-if="!editing">
                            <v-select v-model="currentType" :items="typeOptions" label="Type*" required :disabled="editing"></v-select>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field
                                v-model="form.name"
                                :label="`${currentType === 'environment' ? 'Environment' : 'Secret'} Name*`"
                                required
                                :rules="[(v) => !!v || 'Name is required']"
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <vue-monaco-editor
                                height="400px"
                                v-model:value="form.data"
                                language="json"
                                :options="MONACO_EDITOR_OPTIONS"
                                @mount="handleMount"
                            />
                            <v-checkbox
                                v-if="currentType === 'secret'"
                                v-model="showPassword"
                                label="Show secret data"
                                density="compact"
                            ></v-checkbox>
                        </v-col>
                    </v-row>
                </v-container>
                <small>*indicates required field</small>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue-darken-1" variant="text" @click="closeDialog"> Cancel </v-btn>
                <v-btn color="blue-darken-1" variant="text" @click="saveItem" :loading="saving"> Save </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        headers: [
            { title: 'Name', key: 'name' },
            { title: 'Data', key: 'data' },
            { title: 'Actions', key: 'actions' }
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
            { title: 'Environment', value: 'environment' },
            { title: 'Secret', value: 'secret' }
        ],
        form: {
            name: '',
            data: ''
        },
        showPassword: false
    }),
    async mounted() {
        this.getEnv();
        this.getSecrets();
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
                    text: `${this.currentType === 'environment' ? 'Environment' : 'Secret'} ${
                        this.editing ? 'updated' : 'created'
                    } successfully`,
                    color: 'success'
                });
            } catch (error) {
                console.error(`Error saving ${this.currentType}:`, error);
                this.$emit('snackbar', {
                    show: true,
                    text: `Error saving ${this.currentType}`,
                    color: 'error'
                });
            } finally {
                this.saving = false;
            }
        },

        async deleteItem(item, type) {
            const typeName = type === 'environment' ? 'environment' : 'secret';
            if (confirm(`Are you sure you want to delete ${typeName} "${item.name}"?`)) {
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
                        text: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} deleted successfully`,
                        color: 'success'
                    });
                } catch (error) {
                    console.error(`Error deleting ${typeName}:`, error);
                    this.$emit('snackbar', {
                        show: true,
                        text: `Error deleting ${typeName}`,
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

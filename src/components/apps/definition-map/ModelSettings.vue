<template>
    <v-dialog v-model="dialog" max-width="600px" persistent>
        <v-card>
            <v-card-title class="d-flex align-center justify-space-between">
                <span class="text-h6">{{ $t('ModelSettings.title') }}</span>
                <v-btn @click="closeDialog" icon size="small" variant="text">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            
            <v-divider></v-divider>
            
            <v-card-text class="pa-6">
                <v-container>
                    <v-row>
                        <v-col cols="12">
                            <v-text-field
                                v-model="modelName"
                                :label="$t('ModelSettings.name')"
                                variant="outlined"
                                density="comfortable"
                                hide-details
                            ></v-text-field>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            
            <v-divider></v-divider>
            
            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn
                    @click="closeDialog"
                    variant="outlined"
                    color="grey"
                >
                    {{ $t('ModelSettings.cancel') }}
                </v-btn>
                <v-btn
                    @click="confirmSettings"
                    color="primary"
                    variant="flat"
                    class="ml-2"
                >
                    {{ $t('ModelSettings.confirm') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    name: 'ModelSettings',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'confirm'],
    data() {
        return {
            modelName: ''
        }
    },
    computed: {
        dialog: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit('update:modelValue', value);
            }
        }
    },
    methods: {
        closeDialog() {
            this.dialog = false;
            this.modelName = '';
        },
        confirmSettings() {
            this.$emit('confirm', {
                modelName: this.modelName
            });
            this.closeDialog();
        }
    }
};
</script>

<style scoped>
.v-card {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.v-card-title {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
}

.v-card-text {
    min-height: 200px;
}

.v-card-actions {
    background-color: #f8f9fa;
}

.v-btn {
    border-radius: 8px;
    text-transform: none;
    font-weight: 500;
}
</style> 
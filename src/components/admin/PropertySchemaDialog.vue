<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600">
        <v-card>
            <v-card-title>
                {{ schema ? $t('taskCatalog.editProperty') : $t('taskCatalog.addProperty') }}
            </v-card-title>

            <v-card-text>
                <v-form ref="formRef" v-model="formValid">
                    <v-row>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="formData.property_key"
                                :label="$t('taskCatalog.propertyKey')"
                                :rules="[v => !!v || $t('taskCatalog.required'), v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) || $t('taskCatalog.invalidKey')]"
                                required
                                hint="camelCase or snake_case"
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="formData.property_label"
                                :label="$t('taskCatalog.propertyLabel')"
                                :rules="[v => !!v || $t('taskCatalog.required')]"
                                required
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12" md="4">
                            <v-select
                                v-model="formData.property_type"
                                :items="propertyTypes"
                                :label="$t('taskCatalog.propertyType')"
                                item-title="label"
                                item-value="value"
                            />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-select
                                v-model="formData.applies_to"
                                :items="appliesToOptions"
                                :label="$t('taskCatalog.appliesTo')"
                                item-title="label"
                                item-value="value"
                            />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-text-field
                                v-model.number="formData.display_order"
                                :label="$t('taskCatalog.order')"
                                type="number"
                                min="0"
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="formData.placeholder"
                                :label="$t('taskCatalog.placeholder')"
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="formData.default_value"
                                :label="$t('taskCatalog.defaultValue')"
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12" md="6">
                            <v-switch
                                v-model="formData.is_mandatory"
                                :label="$t('taskCatalog.mandatory')"
                                color="error"
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-switch
                                v-model="formData.visible_by_default"
                                :label="$t('taskCatalog.visibleByDefault')"
                                color="primary"
                            />
                        </v-col>
                    </v-row>

                    <!-- Config for db-select / formula -->
                    <v-row v-if="formData.property_type === 'db-select' || formData.property_type === 'formula'">
                        <v-col cols="12">
                            <v-text-field
                                v-model="configText"
                                :label="$t('taskCatalog.config')"
                                :placeholder="$t('taskCatalog.configPlaceholder')"
                                :hint="formData.property_type === 'db-select' ? 'DB: table_name' : 'SUM(tasks.fte)'"
                                persistent-hint
                            />
                        </v-col>
                    </v-row>

                    <!-- Layout Settings -->
                    <v-divider class="my-4" />
                    <div class="text-subtitle-2 mb-2">{{ $t('taskCatalog.layoutSettings') }}</div>

                    <v-row>
                        <v-col cols="12" md="4">
                            <v-text-field
                                v-model.number="formData.row_index"
                                :label="$t('taskCatalog.rowIndex')"
                                type="number"
                                min="0"
                            />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-select
                                v-model="formData.col_span"
                                :items="colSpanOptions"
                                :label="$t('taskCatalog.colSpan')"
                                item-title="label"
                                item-value="value"
                            />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-text-field
                                v-model="formData.section_name"
                                :label="$t('taskCatalog.sectionName')"
                            />
                        </v-col>
                    </v-row>

                    <!-- Options for select type -->
                    <v-row v-if="formData.property_type === 'select'">
                        <v-col cols="12">
                            <v-label>{{ $t('taskCatalog.options') }}</v-label>
                            <div
                                v-for="(option, index) in formData.options"
                                :key="index"
                                class="d-flex align-center mb-2"
                            >
                                <v-text-field
                                    v-model="option.label"
                                    :label="$t('taskCatalog.optionLabel')"
                                    density="compact"
                                    class="mr-2"
                                />
                                <v-text-field
                                    v-model="option.value"
                                    :label="$t('taskCatalog.optionValue')"
                                    density="compact"
                                    class="mr-2"
                                />
                                <v-btn
                                    icon
                                    size="small"
                                    color="error"
                                    variant="text"
                                    @click="removeOption(index)"
                                >
                                    <v-icon>mdi-minus</v-icon>
                                </v-btn>
                            </div>
                            <v-btn
                                variant="outlined"
                                size="small"
                                @click="addOption"
                            >
                                <v-icon start>mdi-plus</v-icon>
                                {{ $t('taskCatalog.addOption') }}
                            </v-btn>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn
                    variant="text"
                    @click="$emit('update:modelValue', false)"
                >
                    {{ $t('taskCatalog.cancel') }}
                </v-btn>
                <v-btn
                    color="primary"
                    :loading="loading"
                    :disabled="!formValid"
                    @click="save"
                >
                    {{ $t('taskCatalog.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, watch, computed, getCurrentInstance } from 'vue';
import { useTaskCatalogStore, PROPERTY_TYPES, APPLIES_TO_OPTIONS } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'PropertySchemaDialog',
    props: {
        modelValue: Boolean,
        schema: Object,
        taskType: String
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const store = useTaskCatalogStore();
        const configText = ref('');

        const propertyTypes = computed(() => PROPERTY_TYPES);
        const appliesToOptions = computed(() => {
            return APPLIES_TO_OPTIONS.map(item => ({
                ...item,
                label: locale.value === 'ko' ? (item.labelKo || item.label) : item.label,
            }));
        });

        const colSpanOptions = [
            { label: '1/12 (좁음)', value: 1 },
            { label: '2/12', value: 2 },
            { label: '3/12 (1/4)', value: 3 },
            { label: '4/12 (1/3)', value: 4 },
            { label: '5/12', value: 5 },
            { label: '6/12 (1/2)', value: 6 },
            { label: '7/12', value: 7 },
            { label: '8/12 (2/3)', value: 8 },
            { label: '9/12 (3/4)', value: 9 },
            { label: '10/12', value: 10 },
            { label: '11/12', value: 11 },
            { label: '12/12 (전체)', value: 12 }
        ];

        const defaultFormData = () => ({
            property_key: '',
            property_label: '',
            property_type: 'string',
            is_mandatory: false,
            visible_by_default: true,
            default_value: '',
            display_order: 0,
            options: [],
            applies_to: 'both',
            placeholder: '',
            config: null,
            row_index: 0,
            col_span: 12,
            section_name: ''
        });

        const formData = ref(defaultFormData());

        watch(() => props.modelValue, (open) => {
            if (open) {
                if (props.schema) {
                    formData.value = {
                        ...props.schema,
                        options: props.schema.options ? [...props.schema.options] : [],
                    // Serialize config
                    if (props.schema.config) {
                        if (props.schema.property_type === 'db-select') {
                            configText.value = 'DB: ' + (props.schema.config.table || '');
                        } else if (props.schema.property_type === 'formula') {
                            configText.value = props.schema.config.expression || '';
                        } else {
                            configText.value = JSON.stringify(props.schema.config);
                        }
                    } else {
                        configText.value = '';
                    }
                } else {
                    formData.value = defaultFormData();
                    configText.value = '';
                }
            }
        });

        const addOption = () => {
            if (!formData.value.options) {
                formData.value.options = [];
            }
            formData.value.options.push({ label: '', value: '' });
        };

        const removeOption = (index) => {
            formData.value.options.splice(index, 1);
        };

        const parseConfig = (type, text) => {
            if (!text || !text.trim()) return null;
            const trimmed = text.trim();
            if (type === 'db-select') {
                const match = trimmed.match(/^(?:DB:\s*)?(.+)/i);
                const tableName = match ? match[1].trim() : trimmed;
                return { table: tableName, label_col: 'name', value_col: 'id' };
            }
            if (type === 'formula') {
                return { expression: trimmed };
            }
            try { return JSON.parse(trimmed); } catch { return { value: trimmed }; }
        };

        const save = async () => {
            loading.value = true;
            try {
                const config = parseConfig(formData.value.property_type, configText.value);
                await store.saveSchema({
                    ...formData.value,
                    id: props.schema?.id,
                    task_type: formData.value.applies_to,
                    config,
                });
                emit('saved');
            } catch (error) {
                console.error('Failed to save schema:', error);
            } finally {
                loading.value = false;
            }
        };

        return {
            formRef,
            formValid,
            loading,
            formData,
            configText,
            propertyTypes,
            appliesToOptions,
            colSpanOptions,
            addOption,
            removeOption,
            save
        };
    }
});
</script>

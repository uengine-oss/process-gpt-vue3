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
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="formData.property_type"
                                :items="propertyTypes"
                                :label="$t('taskCatalog.propertyType')"
                                item-title="label"
                                item-value="value"
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model.number="formData.display_order"
                                :label="$t('taskCatalog.order')"
                                type="number"
                                min="0"
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12">
                            <v-switch
                                v-model="formData.is_mandatory"
                                :label="$t('taskCatalog.mandatory')"
                                color="error"
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12">
                            <v-text-field
                                v-model="formData.default_value"
                                :label="$t('taskCatalog.defaultValue')"
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
import { defineComponent, ref, watch, computed } from 'vue';
import { useTaskCatalogStore, PROPERTY_TYPES } from '@/stores/taskCatalog';

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

        const formRef = ref(null);
        const formValid = ref(false);
        const loading = ref(false);

        const propertyTypes = computed(() => PROPERTY_TYPES);

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
            default_value: '',
            display_order: 0,
            options: [],
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
                        row_index: props.schema.row_index ?? 0,
                        col_span: props.schema.col_span ?? 12,
                        section_name: props.schema.section_name ?? ''
                    };
                } else {
                    formData.value = defaultFormData();
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

        const save = async () => {
            loading.value = true;
            try {
                await store.saveSchema({
                    ...formData.value,
                    id: props.schema?.id,
                    task_type: props.taskType
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
            propertyTypes,
            colSpanOptions,
            addOption,
            removeOption,
            save
        };
    }
});
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center pa-4 pb-2">
                <span class="text-h6">{{ $t('processArchitecture.newProcessDialog.title') }}</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-4">
                <!-- Process Name -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-1">
                        {{ $t('processArchitecture.newProcessDialog.processName') }} *
                    </label>
                    <v-text-field
                        v-model="form.name"
                        :placeholder="$t('processArchitecture.newProcessDialog.processNamePlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        :rules="[v => !!v || $t('processArchitecture.newProcessDialog.nameRequired')]"
                    />
                </div>

                <!-- Hierarchy Location -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.hierarchyLocation') }}
                    </label>
                    <v-row dense>
                        <v-col cols="4">
                            <v-select
                                v-model="form.domain"
                                :items="domainOptions"
                                item-title="name"
                                item-value="name"
                                :label="$t('processArchitecture.newProcessDialog.domain')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                            />
                        </v-col>
                        <v-col cols="4">
                            <v-select
                                v-model="form.mega"
                                :items="megaOptions"
                                item-title="name"
                                item-value="id"
                                :label="$t('processArchitecture.newProcessDialog.megaProcess')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                            />
                        </v-col>
                        <v-col cols="4">
                            <v-select
                                v-model="form.major"
                                :items="majorOptions"
                                item-title="name"
                                item-value="id"
                                :label="$t('processArchitecture.newProcessDialog.majorProcess')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                            />
                        </v-col>
                    </v-row>
                </div>

                <!-- Creation Type -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.creationType') }}
                    </label>
                    <v-btn-toggle v-model="form.creationType" mandatory density="compact" color="primary">
                        <v-btn value="scratch" size="small">
                            {{ $t('processArchitecture.newProcessDialog.scratch') }}
                        </v-btn>
                        <v-btn value="template" size="small">
                            {{ $t('processArchitecture.newProcessDialog.template') }}
                        </v-btn>
                        <v-btn value="clone" size="small">
                            {{ $t('processArchitecture.newProcessDialog.clone') }}
                        </v-btn>
                    </v-btn-toggle>
                </div>

                <!-- Template / Clone selector -->
                <div v-if="form.creationType === 'template' || form.creationType === 'clone'" class="mb-2">
                    <v-autocomplete
                        v-model="form.sourceProcessId"
                        :items="existingProcesses"
                        item-title="name"
                        item-value="id"
                        :label="form.creationType === 'template'
                            ? $t('processArchitecture.newProcessDialog.selectTemplate')
                            : $t('processArchitecture.newProcessDialog.selectCloneSource')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        clearable
                    />
                </div>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn variant="text" @click="close">
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :disabled="!canCreate"
                    :loading="creating"
                    @click="createProcess"
                >
                    {{ $t('processArchitecture.newProcessDialog.createAndOpen') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';

const props = defineProps<{
    modelValue: boolean;
    procMap: any;
    domains: any[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'created', proc: { id: string; name: string }): void;
}>();

const backend = BackendFactory.createBackend() as any;

const form = ref({
    name: '',
    domain: null as string | null,
    mega: null as string | null,
    major: null as string | null,
    creationType: 'scratch' as 'scratch' | 'template' | 'clone',
    sourceProcessId: null as string | null
});

const creating = ref(false);
const existingProcesses = ref<any[]>([]);

// Load existing processes for template/clone
watch(() => props.modelValue, async (open) => {
    if (open) {
        try {
            const defs = await backend.listDefinition('', { match: { isdeleted: false } });
            existingProcesses.value = (defs || []).map((d: any) => ({ id: d.id, name: d.name || d.id }));
        } catch (e) {
            console.error('Failed to load process list:', e);
        }
    }
});

const domainOptions = computed(() => props.domains || []);

const megaOptions = computed(() => {
    if (!props.procMap?.mega_proc_list) return [];
    return props.procMap.mega_proc_list.map((m: any) => ({ id: m.id, name: m.name }));
});

const majorOptions = computed(() => {
    if (!form.value.mega || !props.procMap?.mega_proc_list) return [];
    const mega = props.procMap.mega_proc_list.find((m: any) => m.id === form.value.mega);
    if (!mega) return [];
    return (mega.major_proc_list || []).map((m: any) => ({ id: m.id, name: m.name }));
});

// Reset major when mega changes
watch(() => form.value.mega, () => {
    form.value.major = null;
});

const canCreate = computed(() => {
    if (!form.value.name.trim()) return false;
    if (form.value.creationType !== 'scratch' && !form.value.sourceProcessId) return false;
    return true;
});

function close() {
    emit('update:modelValue', false);
    resetForm();
}

function resetForm() {
    form.value = {
        name: '',
        domain: null,
        mega: null,
        major: null,
        creationType: 'scratch',
        sourceProcessId: null
    };
}

async function createProcess() {
    if (!canCreate.value) return;
    creating.value = true;
    try {
        let newId: string;
        const name = form.value.name.trim();

        if (form.value.creationType === 'scratch') {
            // Create empty process
            const result = await backend.createDefinition(name);
            newId = result?.id || result;
        } else {
            // Clone/Template: duplicate from source
            const sourceId = form.value.sourceProcessId;
            const result = await backend.duplicateDefinition(sourceId, name);
            newId = result?.newId || result?.id || result;
        }

        if (newId) {
            emit('created', { id: newId, name });
        }
        close();
    } catch (e: any) {
        console.error('Failed to create process:', e);
    } finally {
        creating.value = false;
    }
}
</script>

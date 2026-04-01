<template>
    <v-dialog v-model="isOpen" max-width="400" persistent>
        <v-card>
            <v-card-title class="d-flex align-center pa-4 pb-2">
                <v-icon class="mr-2">mdi-account-edit</v-icon>
                {{ $t('ownerSettingDialog.title') }}
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pa-4 pt-2">
                <!-- 프로세스 정보 -->
                <div class="text-body-2 text-grey mb-3">
                    {{ processName }}
                </div>

                <!-- 담당자 선택 (uEngine 모드에서는 Keycloak 유저 목록 사용) -->
                <OwnerSelect
                    v-model="selectedOwner"
                    :label="$t('ownerSettingDialog.owner')"
                    :placeholder="$t('ownerSettingDialog.placeholder')"
                    :use-keycloak-users="true"
                    hide-details
                />
            </v-card-text>

            <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="text" @click="close">
                    {{ $t('ownerSettingDialog.cancel') }}
                </v-btn>
                <v-btn color="primary" variant="flat" :loading="saving" @click="save">
                    {{ $t('ownerSettingDialog.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed } from 'vue';
import OwnerSelect from './OwnerSelect.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default defineComponent({
    name: 'OwnerSettingDialog',
    components: {
        OwnerSelect
    },
    props: {
        // 다이얼로그 열기/닫기
        modelValue: {
            type: Boolean,
            default: false
        },
        // 프로세스 정보
        process: {
            type: Object,
            default: null
        }
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const isOpen = ref(false);
        const selectedOwner = ref('');
        const saving = ref(false);
        const backend = BackendFactory.createBackend();

        const processName = computed(() => {
            return props.process?.name || props.process?.id || '';
        });

        // modelValue 변경 감지
        watch(
            () => props.modelValue,
            async (newVal) => {
                isOpen.value = newVal;
                if (newVal && props.process?.id) {
                    // 기존 owner 로드
                    await loadCurrentOwner();
                }
            }
        );

        // isOpen 변경 시 emit
        watch(isOpen, (newVal) => {
            emit('update:modelValue', newVal);
        });

        // 현재 owner 로드 (uEngine: 맵 JSON proc_def_owners, 그 외: Supabase proc_def)
        const loadCurrentOwner = async () => {
            try {
                const isUEngine = (window as any).$mode === 'uEngine';
                if (isUEngine && typeof backend.getOwnerByProcDef === 'function') {
                    const owner = await backend.getOwnerByProcDef(props.process.id);
                    selectedOwner.value = owner ?? '';
                    return;
                }
                const supabase = (window as any).$supabase;
                if (supabase) {
                    const { data, error } = await supabase
                        .from('proc_def')
                        .select('owner')
                        .eq('id', props.process.id)
                        .maybeSingle();
                    if (!error && data && data.owner != null && data.owner !== '') {
                        selectedOwner.value = data.owner;
                        return;
                    }
                }
                const procDef = await backend.getRawDefinition(props.process.id);
                if (procDef && procDef.owner) {
                    selectedOwner.value = procDef.owner;
                } else {
                    selectedOwner.value = '';
                }
            } catch (error) {
                console.error('Owner 로드 실패:', error);
                selectedOwner.value = '';
            }
        };

        const close = () => {
            isOpen.value = false;
            selectedOwner.value = '';
        };

        const save = async () => {
            if (!props.process?.id) return;

            saving.value = true;
            try {
                const isUEngine = (window as any).$mode === 'uEngine';
                if (isUEngine && typeof backend.putOwner === 'function') {
                    await backend.putOwner(props.process.id, selectedOwner.value || null);
                } else {
                    const supabase = window.$supabase;
                    if (supabase) {
                        const { error } = await supabase
                            .from('proc_def')
                            .update({ owner: selectedOwner.value || null })
                            .eq('id', props.process.id);
                        if (error) throw error;
                    }
                }

                emit('saved', {
                    processId: props.process.id,
                    owner: selectedOwner.value
                });

                close();
            } catch (error) {
                console.error('Owner 저장 실패:', error);
            } finally {
                saving.value = false;
            }
        };

        return {
            isOpen,
            selectedOwner,
            processName,
            saving,
            close,
            save
        };
    }
});
</script>

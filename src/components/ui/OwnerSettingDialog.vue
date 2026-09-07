<template>
    <v-dialog v-model="isOpen" max-width="560" persistent>
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

                <div class="d-flex flex-column ga-3">
                    <OwnerSelect v-model="primaryOwner" label="프로세스 담당자" placeholder="프로세스 담당자를 선택하세요" hide-details />
                    <OwnerSelect v-model="fieldOwners" label="현업 담당자" placeholder="현업 담당자를 선택하세요" multiple hide-details />
                    <OwnerSelect v-model="hqOwners" label="검토담당자" placeholder="검토담당자를 선택하세요" multiple hide-details />
                    <OwnerSelect v-model="masterOwner" label="최종검토자" placeholder="최종검토자를 선택하세요" hide-details />
                </div>
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
        const primaryOwner = ref('');
        const fieldOwners = ref<string[]>([]);
        const hqOwners = ref<string[]>([]);
        const masterOwner = ref('');
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

        // 현재 owner 로드
        const loadCurrentOwner = async () => {
            try {
                const procDef = await backend.getRawDefinition(props.process.id);
                const owners = procDef?.definition?.meta?.owners || {};
                primaryOwner.value = owners.primaryOwner || procDef?.owner || '';
                fieldOwners.value = Array.isArray(owners.fieldOwners) ? owners.fieldOwners : [];
                hqOwners.value = Array.isArray(owners.hqOwners) ? owners.hqOwners : [];
                masterOwner.value = owners.masterOwner || '';
            } catch (error) {
                console.error('Owner 로드 실패:', error);
                resetOwners();
            }
        };

        const resetOwners = () => {
            primaryOwner.value = '';
            fieldOwners.value = [];
            hqOwners.value = [];
            masterOwner.value = '';
        };

        const close = () => {
            isOpen.value = false;
            resetOwners();
        };

        const save = async () => {
            if (!props.process?.id) return;

            saving.value = true;
            try {
                // 네 역할을 proc_def.definition.meta.owners의 단일 모델로 저장한다.
                const supabase = window.$supabase;
                if (supabase) {
                    const procDef = await backend.getRawDefinition(props.process.id);
                    const definition = { ...(procDef?.definition || {}) };
                    definition.meta = { ...(definition.meta || {}) };
                    definition.meta.owners = {
                        ...(definition.meta.owners || {}),
                        primaryOwner: primaryOwner.value || null,
                        fieldOwners: [...fieldOwners.value],
                        hqOwners: [...hqOwners.value],
                        masterOwner: masterOwner.value || null
                    };
                    const { error } = await supabase
                        .from('proc_def')
                        .update({ owner: primaryOwner.value || null, definition })
                        .eq('id', props.process.id)
                        .eq('tenant_id', window.$tenantName);

                    if (error) throw error;
                }

                emit('saved', {
                    processId: props.process.id,
                    owner: primaryOwner.value,
                    fieldOwners: [...fieldOwners.value],
                    hqOwners: [...hqOwners.value],
                    masterOwner: masterOwner.value
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
            primaryOwner,
            fieldOwners,
            hqOwners,
            masterOwner,
            processName,
            saving,
            close,
            save
        };
    }
});
</script>

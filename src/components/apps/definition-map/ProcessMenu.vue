<template>
    <div>
        <div v-if="enableEdit || canEditDeleteMega" class="proc-menu-btn-box text-right">
            <!-- Add button for mega/major types (Major 추가는 process-manager도 가능) -->
            <v-tooltip v-if="enableEdit && (type === 'mega' || type === 'major') && (selectedDomain || isPal)" :text="addTooltipText">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="addProcess" icon v-bind="props" density="compact" size="small">
                        <v-icon size="14">mdi-plus</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="canSetPermission" :text="$t('ProcessMenu.setPermission')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="setPermission" icon v-bind="props" density="compact" size="small">
                        <Icons :icon="'user-lock'" :width="14" :height="14" />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="canEditDeleteMega && type != 'map' && type != 'sub'" :text="$t('ProcessMenu.edit')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="openEditDialog('update')" icon v-bind="props" density="compact" size="small">
                        <Icons :icon="'pencil'" :width="12" :height="12" />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type === 'sub' && isPal" :text="$t('ProcessMenu.settings')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="openSubprocessSettings" icon v-bind="props" density="compact" size="small">
                        <v-icon size="12">mdi-cog</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type === 'sub'" :text="$t('ProcessMenu.setOwner')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="setOwner" icon v-bind="props" density="compact" size="small">
                        <v-icon size="12">mdi-account-edit</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type === 'sub'" :text="$t('ProcessMenu.duplicate')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="duplicateProcess" icon v-bind="props" density="compact" size="small">
                        <v-icon size="12">mdi-content-copy</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="canEditDeleteMega && type != 'map'" :text="$t('ProcessMenu.delete')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="deleteProcess" icon v-bind="props" density="compact" size="small" class="process-delete-btn">
                        <Icons :icon="'trash'" :width="12" :height="12" />
                    </v-btn>
                </template>
            </v-tooltip>
        </div>
    </div>
</template>

<script>
import ProcessDialog from './ProcessDialog.vue';
import { canManageProcess as hasProcessManagementAccess, isAdminUser } from '@/utils/processManagement';

export default {
    components: {
        ProcessDialog
    },
    props: {
        size: Number,
        type: String,
        process: Object,
        enableEdit: Boolean,
        /** Mega 카드 전용: 수정/삭제는 admin만. 미주입 시 enableEdit 사용 */
        enableEditMega: { type: Boolean, default: undefined },
        selectedDomain: [String, Number]
    },
    data: () => ({
        newProcess: {
            id: '',
            label: ''
        },
        processDialogStatus: false,
        processType: ''
    }),
    computed: {
        /** Mega일 때 수정/삭제용 (admin만). 없으면 enableEdit */
        canEditDeleteMega() {
            return this.type === 'mega' && this.enableEditMega !== undefined ? this.enableEditMega : this.enableEdit;
        },
        addType() {
            if (this.type == 'map') {
                return 'mega';
            } else if (this.type == 'mega') {
                return 'major';
            } else if (this.type == 'major') {
                return 'sub';
            }
        },
        isPal() {
            return typeof window !== 'undefined' && window.$pal;
        },
        canManageProcess() {
            return hasProcessManagementAccess();
        },
        canSetPermission() {
            // Mega 카드: 권한 설정은 admin만 표시 (process-manager는 숨김)
            if (this.type === 'mega') {
                return this.isPal || isAdminUser();
            }
            // 그 외: PAL 모드이거나 프로세스 관리 권한이 있으면 표시
            return this.isPal || this.canManageProcess;
        },
        addTooltipText() {
            if (this.type === 'mega') {
                return this.$t('processDefinitionMap.addMajor');
            } else if (this.type === 'major') {
                return this.$t('processDefinitionMap.addSub');
            }
            return '';
        }
    },
    watch: {},
    created() {},
    methods: {
        openEditDialog(processType) {
            this.$emit('editProcessdialog', processType);
        },
        deleteProcess() {
            this.$emit('delete');
        },
        editProcess() {
            this.$emit('modeling');
        },
        setPermission() {
            this.$emit('setPermission', this.process);
        },
        duplicateProcess() {
            this.$emit('duplicate', this.process);
        },
        setOwner() {
            this.$emit('setOwner', this.process);
        },
        openSubprocessSettings() {
            this.$emit('openSubprocessSettings', this.process);
        },
        addProcess() {
            this.$emit('add');
        }
    }
};
</script>

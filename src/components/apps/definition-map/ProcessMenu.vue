<template>
    <div>
        <div v-if="enableEdit" class="proc-menu-btn-box text-right">
            <!-- Add button for mega/major types -->
            <v-tooltip v-if="(type === 'mega' || type === 'major') && (selectedDomain || isPal) && !isUncategorized" :text="addTooltipText">
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
            <v-tooltip v-if="type != 'map' && type != 'sub' && !isUncategorized" :text="$t('ProcessMenu.edit')">
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
            <v-tooltip v-if="type != 'map' && !isUncategorized" :text="$t('ProcessMenu.delete')">
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
import { isUncategorizedProcess } from '@/utils/uncategorizedProcess';

export default {
    components: {
        ProcessDialog
    },
    props: {
        size: Number,
        type: String,
        process: Object,
        enableEdit: Boolean,
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
        isAdmin() {
            return localStorage.getItem('isAdmin') === 'true';
        },
        canSetPermission() {
            // 미분류는 실제 저장되는 노드가 아니라 권한 설정 대상이 될 수 없다.
            if (this.isUncategorized) return false;
            // PAL 모드이거나 관리자 권한이 있으면 표시
            return this.isPal || this.isAdmin;
        },
        // 미분류 Mega/Major 는 로드 시 임시로 만들어지는 노드(저장 시 제거됨)라
        // 추가/수정/삭제 결과가 저장되지 않으므로 편집 버튼을 노출하지 않는다.
        isUncategorized() {
            if (this.type !== 'mega' && this.type !== 'major') return false;
            return isUncategorizedProcess(this.process, this.$t('processDefinitionMap.uncategorized'));
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

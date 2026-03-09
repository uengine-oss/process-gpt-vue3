<template>
    <div
        class="align-center pa-2 sub-process-style pr-3 pl-3"
        :class="isProcessLocked() ? 'sub-process-disabled' : 'cursor-pointer sub-process-hover'"
    >
        <div v-if="!processDialogStatus || processType === 'add'">
            <ProcessTooltip
                :processInfo="processTooltipInfo"
                :loading="loadingTooltip"
                :disabled="!showTooltip"
                location="right"
                @mouseenter.native="loadProcessInfo"
            >
                <template #default="tooltipProps">
                    <h6
                        v-bind="tooltipProps"
                        @click="handleClick"
                        @dblclick.stop="handleDoubleClick"
                        @mouseenter="loadProcessInfo"
                        class="text-subtitle-2 font-weight-semibold ma-0 pa-0"
                        :class="{ 'text-disabled': isProcessLocked() }"
                    >
                        {{ value.name }}
                    </h6>
                </template>
            </ProcessTooltip>
            <div class="d-flex align-center mt-1" style="gap: 4px">
                <ProgressBadge
                    v-if="showStatusBadge && processStatus === 'draft'"
                    type="status"
                    :status="processStatus"
                    :customText="draftBadgeText"
                    size="x-small"
                    :showIcon="true"
                />
                <v-chip v-if="isNew(value.id) && !enableEdit" color="primary" variant="outlined" size="x-small">New</v-chip>
                <v-spacer />
                <v-btn
                    v-if="isExecutionByProject"
                    variant="elevated"
                    color="primary"
                    size="x-small"
                    @click="clickPlayBtn()"
                    class="rounded-pill"
                >
                    {{ $t('SubProcess.execute') }}
                </v-btn>
                <ProcessMenu
                    :size="16"
                    :type="type"
                    :process="value"
                    :enableEdit="enableEdit"
                    @delete="deleteProcess"
                    @editProcessdialog="editProcessdialog"
                    @modeling="editProcessModel"
                    @setPermission="openPermissionDialog(value)"
                    @duplicate="duplicateProcess"
                    @setOwner="openOwnerDialog"
                    @openSubprocessSettings="openSubprocessSettingsDialog"
                />
            </div>
        </div>
        <ProcessDialog
            v-else-if="processDialogStatus && enableEdit && processType === 'update'"
            :enableEdit="enableEdit"
            :process="value"
            :processDialogStatus="processDialogStatus"
            :processType="processType"
            :type="type"
            @edit="editProcess"
            @closeProcessDialog="closeProcessDialog"
        />

        <!-- 담당자 설정 다이얼로그 -->
        <OwnerSettingDialog v-model="ownerDialogOpen" :process="value" @saved="onOwnerSaved" />

        <!-- PAL 전용: 서브프로세스 설정 (공통 모듈) 다이얼로그 -->
        <v-dialog v-model="subprocessSettingsDialog" max-width="400" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ $t('ProcessMenu.settings') }}
                </v-card-title>
                <v-card-text>
                    <v-switch
                        v-model="subprocessSettingsCommonModule"
                        :label="$t('ProcessMenu.commonModule')"
                        color="primary"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="subprocessSettingsDialog = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="saveSubprocessSettings">
                        {{ $t('common.save') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue';
import BackendFactory from '@/components/api/BackendFactory';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import ProcessTooltip from '@/components/ui/ProcessTooltip.vue';
import OwnerSettingDialog from '@/components/ui/OwnerSettingDialog.vue';
import { getOrganizationProvider } from '@/providers/organization';

export default {
    components: {
        ProcessMenu,
        ProcessDialog,
        ProgressBadge,
        ProcessTooltip,
        OwnerSettingDialog
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
        isExecutionByProject: Boolean,
        // 상태 뱃지 표시 여부
        showStatusBadge: {
            type: Boolean,
            default: true
        },
        // 툴팁 표시 여부
        showTooltip: {
            type: Boolean,
            default: true
        }
    },
    data: () => ({
        type: 'sub',
        definition: null,
        checkedProcess: [],
        // 담당자 설정 다이얼로그
        ownerDialogOpen: false,
        // 툴팁 관련 데이터
        loadingTooltip: false,
        processTooltipInfo: {
            id: '',
            name: '',
            owner: '',
            status: 'draft',
            updatedAt: null,
            description: '',
            taskCount: 0,
            completionRate: 0
        },
        processStatus: null,
        lockUserName: '',
        tooltipLoaded: false,
        // PAL 전용: 서브프로세스 설정 다이얼로그
        subprocessSettingsDialog: false,
        subprocessSettingsCommonModule: false
    }),
    computed: {
        draftBadgeText() {
            if (this.processStatus === 'draft' && this.lockUserName) {
                const label = this.$t('progressBadge.processEditing');
                return `${label}(${this.lockUserName})`;
            }
            return '';
        }
    },
    async created() {
        this.checkedProcess = JSON.parse(localStorage.getItem('checkedProcess')) || [];

        // 다른 곳에서 프로세스 다이얼로그가 열리면 자신의 다이얼로그 닫기
        this._processDialogId = Math.random().toString(36).substr(2, 9);
        this._closeDialogHandler = (event) => {
            if (event.detail !== this._processDialogId) {
                this.processDialogStatus = false;
            }
        };
        window.addEventListener('closeAllProcessDialogs', this._closeDialogHandler);

        // 컴포넌트 생성 시 프로세스 상태 정보 로드 (뱃지 표시용)
        if (this.showStatusBadge) {
            this.loadProcessStatus();
        }
    },
    beforeUnmount() {
        window.removeEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    methods: {
        isNew(id) {
            return !this.checkedProcess.includes(id);
        },
        isProcessLocked() {
            return this.processStatus === 'draft';
        },
        handleClick() {
            if (this.isExecutionByProject) return;
            if (this.isProcessLocked()) {
                this.$try({
                    action: async () => {},
                    warningMsg: this.$t('SubProcess.lockedWarning', { name: this.lockUserName })
                });
                return;
            }

            if (window.$mode == 'ProcessGPT') {
                this.goProcess(this.value.id, 'sub');
            } else {
                this.$emit('clickProcess', this.value.path);
            }
            if (!this.checkedProcess.includes(this.value.id)) {
                this.checkedProcess.push(this.value.id);
                localStorage.setItem('checkedProcess', JSON.stringify(this.checkedProcess));
            }
        },
        handleDoubleClick() {
            if (this.isExecutionByProject) return;
            if (this.isProcessLocked()) {
                this.$try({
                    action: async () => {},
                    warningMsg: this.$t('SubProcess.lockedWarning', { name: this.lockUserName })
                });
                return;
            }
            const path = this.value.id ?? this.value.path;
            if (!path) return;
            // PAL 모드 또는 uEngine 모드: 더블클릭 시 SubProcessDetail 화면으로 이동
            if (window.$pal || window.$mode === 'uEngine') {
                this.goProcess(path, 'sub');
            }
        },
        deleteProcess() {
            this.parent.sub_proc_list = this.parent.sub_proc_list.filter((item) => item.id != this.value.id);

            // 성공 메시지 표시
            if (window.$app_) {
                window.$app_.snackbarMessage = this.$t('successMsg.delete');
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                window.$app_.snackbarSuccessStatus = true;
            }
        },
        async editProcessModel() {
            const id = this.value.id.replace(/ /g, '_');
            const backend = BackendFactory.createBackend();
            const value = await backend.getRawDefinition(id);
            let url;
            if (value && value.id) {
                url = `/definitions/${value.id}?modeling=true`;
            } else {
                url = `/definitions/chat?id=${id}&name=${this.value.name}&modeling=true`;
            }
            window.open(url, '_blank');
        },
        clickPlayBtn() {
            this.$emit('clickPlayBtn', this.value);
        },
        /**
         * 담당자 설정 다이얼로그 열기
         */
        openOwnerDialog() {
            this.ownerDialogOpen = true;
        },
        /** PAL 전용: 서브프로세스 설정 다이얼로그 열기 (공통 모듈 토글) */
        openSubprocessSettingsDialog() {
            this.subprocessSettingsCommonModule = !!this.value.commonModule;
            this.subprocessSettingsDialog = true;
        },
        /** PAL 전용: 공통 모듈 설정 저장 후 정의체계도 저장 */
        saveSubprocessSettings() {
            this.value.commonModule = this.subprocessSettingsCommonModule;
            this.subprocessSettingsDialog = false;
            this.EventBus.emit('saveProcessDefinitionMap');
            if (window.$app_) {
                window.$app_.snackbarMessage = this.$t('successMsg.save') || '저장되었습니다.';
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
            }
        },
        /**
         * 담당자 저장 완료 처리
         */
        async onOwnerSaved(data) {
            this.$toast?.success(this.$t('ownerSettingDialog.saveSuccess') || '담당자가 설정되었습니다.');
            // 툴팁 정보 갱신 - ID를 이름으로 변환
            if (this.processTooltipInfo && data.owner) {
                const ownerName = await this.resolveOwnerName(data.owner);
                this.processTooltipInfo.owner = ownerName;
            } else if (this.processTooltipInfo) {
                this.processTooltipInfo.owner = '';
            }
            this.tooltipLoaded = false; // 다음 hover 시 새로 로드
        },
        async duplicateProcess(process) {
            try {
                const backend = BackendFactory.createBackend();

                // Generate unique name with copy suffix
                let baseName = process.name;
                let newName = `${baseName} (${this.$t('ProcessMenu.copySuffix') || '복사'})`;

                // 원본 프로세스 정의(BPMN XML) 가져오기
                const originalDef = await backend.getRawDefinition(process.id, null);
                const bpmn = originalDef?.bpmn || '';
                const definition = originalDef?.definition || null;

                // duplicateLocalProcess 사용 (ID는 _copy 형태로 자동 생성)
                const result = await backend.duplicateLocalProcess(process.id, newName, bpmn, definition);

                if (result.success) {
                    // Add to parent's sub_proc_list
                    const newProcess = {
                        id: result.newId,
                        name: newName
                    };
                    this.parent.sub_proc_list.push(newProcess);

                    this.$toast.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
                } else {
                    throw new Error('Duplication failed');
                }
            } catch (error) {
                console.error('프로세스 복제 중 오류:', error);
                this.$toast.error(this.$t('ProcessMenu.duplicateFailed') || '프로세스 복사에 실패했습니다.');
            }
        },
        /**
         * 프로세스 상태만 가볍게 로드 (뱃지 표시용)
         * lock 테이블에 있으면 '작성중(draft)', 없으면 '완료(published)'
         */
        async loadProcessStatus() {
            try {
                const supabase = window.$supabase;
                if (!supabase) return;

                const { data: lockData } = await supabase
                    .from('lock')
                    .select('id, user_id')
                    .eq('id', this.value.id)
                    .eq('tenant_id', window.$tenantName)
                    .maybeSingle();

                if (lockData) {
                    this.processStatus = 'draft';
                    if (lockData.user_id) {
                        this.lockUserName = await this.resolveOwnerName(lockData.user_id);
                    }
                }
            } catch (error) {
                console.error('프로세스 상태 로드 실패:', error);
            }
        },
        /**
         * 프로세스 정보를 로드하여 툴팁에 표시
         */
        async loadProcessInfo() {
            // 이미 로드되었으면 다시 로드하지 않음
            if (this.tooltipLoaded || this.loadingTooltip) return;

            this.loadingTooltip = true;

            try {
                const backend = BackendFactory.createBackend();
                const procDef = await backend.getRawDefinition(this.value.id);

                if (procDef) {
                    const definition = procDef.definition;
                    const activities = definition?.activities || [];

                    let status = null;
                    let lockUserId = '';
                    const supabase = window.$supabase;
                    if (supabase) {
                        const { data: lockData } = await supabase
                            .from('lock')
                            .select('id, user_id')
                            .eq('id', this.value.id)
                            .eq('tenant_id', window.$tenantName)
                            .maybeSingle();
                        if (lockData) {
                            status = 'draft';
                            lockUserId = lockData.user_id || '';
                        }
                    }

                    // owner ID를 이름으로 변환
                    let ownerName = '';
                    if (procDef.owner) {
                        ownerName = await this.resolveOwnerName(procDef.owner);
                    }

                    this.processTooltipInfo = {
                        id: this.value.id,
                        name: procDef.name || this.value.name,
                        owner: ownerName,
                        status: status,
                        updatedAt: procDef.updated_at,
                        description: definition?.description || '',
                        taskCount: activities.length,
                        completionRate: 0
                    };

                    this.processStatus = status;
                    if (lockUserId) {
                        this.lockUserName = await this.resolveOwnerName(lockUserId);
                    } else {
                        this.lockUserName = '';
                    }
                    this.tooltipLoaded = true;
                }
            } catch (error) {
                console.error('프로세스 정보 로드 실패:', error);
                this.processTooltipInfo = {
                    id: this.value.id,
                    name: this.value.name,
                    owner: '',
                    status: null,
                    updatedAt: null,
                    description: '',
                    taskCount: 0,
                    completionRate: 0
                };
            } finally {
                this.loadingTooltip = false;
            }
        },
        /**
         * Owner ID를 이름으로 변환
         */
        async resolveOwnerName(ownerId) {
            if (!ownerId) return '';

            try {
                const provider = getOrganizationProvider();
                if (provider.initialize) {
                    await provider.initialize();
                }
                const member = await provider.getMember(ownerId);
                return member?.name || ownerId;
            } catch (error) {
                console.warn('Owner 이름 조회 실패:', error);
                return ownerId; // 실패 시 ID 그대로 반환
            }
        }
    }
};
</script>

<style scoped>
.sub-process-style {
    background-color: transparent;
    padding: 5px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* 연한 그림자 추가 */
}
.sub-process-hover:hover {
    background-color: #e7ecf0 !important;
}
.sub-process-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>

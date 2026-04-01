<template>
    <div class="align-center pa-2 cursor-pointer sub-process-hover sub-process-style pr-3 pl-3 position-relative">
        <span
            v-if="isNew(value.id) && !enableEdit"
            class="unread-dot subprocess-edge-dot"
        ></span>
        <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-2 font-weight-semibold">
            <v-row class="ma-0 pa-0 align-center">
                <ProcessTooltip
                    :processInfo="processTooltipInfo"
                    :loading="loadingTooltip"
                    :disabled="!showTooltip"
                    location="right"
                    @mouseenter.native="loadProcessInfo"
                >
                    <template #default="tooltipProps">
                        <div
                            v-bind="tooltipProps"
                            @click="handleClick"
                            @dblclick.stop="handleDoubleClick"
                            @mouseenter="loadProcessInfo"
                            class="ma-0 pa-0 d-flex align-center"
                            style="flex: 1; min-width: 0; gap: 4px"
                        >
                            <div>{{ value.name }}</div>
                        </div>
                    </template>
                </ProcessTooltip>

                <!-- 진척률/상태 뱃지 - 항상 표시 -->
                <ProgressBadge
                    v-if="shouldShowStatusBadge"
                    type="status"
                    :status="processStatus"
                    size="x-small"
                    :showIcon="true"
                />
                <div class="ml-auto add-sub-process d-flex align-center" style="flex-shrink: 0; gap: 4px">
                    <v-tooltip
                        v-if="!isExecutionByProject && canManageProcess"
                        :disabled="enableEdit"
                        location="top"
                    >
                        <template #activator="{ props: tipProps }">
                            <span v-bind="tipProps" class="d-inline-flex">
                                <v-btn
                                    variant="tonal"
                                    color="primary"
                                    size="x-small"
                                    class="rounded-pill"
                                    @click.stop="goToEditor"
                                >
                                    {{ $t('processDefinitionMap.checkOut') || $t('common.edit') || '편집' }}
                                </v-btn>
                            </span>
                        </template>
                        {{ $t('processDefinitionMap.subProcessEditHint') }}
                    </v-tooltip>
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
            </v-row>
        </h6>
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

        <!-- PAL 전용: 서브프로세스 설정 (이름, 공통 모듈) 다이얼로그 -->
        <v-dialog v-model="subprocessSettingsDialog" max-width="400" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ $t('ProcessMenu.settings') || '설정' }}
                </v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="subprocessSettingsDisplayName"
                        :label="$t('ProcessMenu.duplicateName') || '이름'"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        class="mb-3"
                    />
                    <v-switch
                        v-model="subprocessSettingsCommonModule"
                        :label="$t('ProcessMenu.commonModule') || '공통 모듈'"
                        color="primary"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="subprocessSettingsDialog = false">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="saveSubprocessSettings">
                        {{ $t('common.save') || '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 프로세스 복제: 이름/ID 입력 다이얼로그 -->
        <v-dialog v-model="duplicateDialog" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ $t('ProcessMenu.duplicate') || '프로세스 복제' }}
                </v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="duplicateForm.name"
                        :label="$t('ProcessMenu.duplicateName') || '이름'"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                        class="mb-3"
                    />
                    <v-text-field
                        v-model="duplicateForm.id"
                        :label="$t('ProcessMenu.duplicateId') || 'ID (경로)'"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                        :hint="$t('ProcessMenu.duplicateIdHint') || '복제된 프로세스의 고유 ID입니다. 공백은 _ 로 저장됩니다.'"
                        persistent-hint
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="duplicateDialog = false">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" :loading="duplicateLoading" @click="confirmDuplicate">
                        {{ $t('ProcessMenu.duplicateConfirm') || '복제' }}
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
import { getKeycloakUserDisplayName } from '@/utils/keycloak';
import { canManageProcess as hasProcessManagementAccess } from '@/utils/processManagement';
import { hasActorValue, resolveUpdatedByForDisplay, trimmedActorId } from '@/utils/definitionActorDisplay';
import { fetchDefinitionRowMeta, syncBpmnDefinitionDisplayName } from '@/utils/procDefListMeta';

const uengineTaskCountCache = new Map();
const uengineTaskCountPending = new Map();

const UENGINE_ACTIVITY_TAGS = new Set([
    'task',
    'userTask',
    'manualTask',
    'serviceTask',
    'scriptTask',
    'businessRuleTask',
    'sendTask',
    'receiveTask',
    'callActivity',
    'subProcess',
    'adHocSubProcess',
    'transaction'
]);

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
    inject: {
        updateProcDefOwner: { default: null }
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
            isUnchecked: false,
            status: 'draft',
            updatedAt: null,
            description: '',
            taskCount: 0,
            completionRate: 0,
            lastModifiedByActor: ''
        },
        processStatus: null,
        tooltipLoaded: false,
        // PAL 전용: 서브프로세스 설정 다이얼로그
        subprocessSettingsDialog: false,
        subprocessSettingsDisplayName: '',
        subprocessSettingsCommonModule: false,
        // 프로세스 복제 다이얼로그
        duplicateDialog: false,
        duplicateForm: { name: '', id: '' },
        duplicatePendingProcess: null,
        duplicateLoading: false
    }),
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
    computed: {
        canManageProcess() {
            return hasProcessManagementAccess();
        },
        shouldShowStatusBadge() {
            if (!this.showStatusBadge || !this.processStatus) return false;
            if (window.$pal && this.processStatus === 'published') return false;
            return true;
        }
    },
    methods: {
        isUEngineMode() {
            return window.$mode === 'uEngine';
        },
        isNew(id) {
            return !this.checkedProcess.includes(id);
        },
        countActivitiesFromBpmnXml(xml) {
            if (!xml || typeof xml !== 'string') return 0;

            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xml, 'text/xml');
                const parseError = xmlDoc.getElementsByTagName('parsererror');
                if (parseError && parseError.length > 0) return 0;

                let count = 0;
                const allElements = xmlDoc.getElementsByTagName('*');
                for (const element of allElements) {
                    const localName = element.localName || element.nodeName?.split(':').pop();
                    if (localName && UENGINE_ACTIVITY_TAGS.has(localName)) {
                        count++;
                    }
                }

                return count;
            } catch (e) {
                console.warn('BPMN XML 파싱 실패:', e);
                return 0;
            }
        },
        async getUEngineTaskCount(defId) {
            if (!defId) return 0;

            if (uengineTaskCountCache.has(defId)) {
                return uengineTaskCountCache.get(defId) || 0;
            }

            if (uengineTaskCountPending.has(defId)) {
                return uengineTaskCountPending.get(defId);
            }

            const taskCountPromise = (async () => {
                try {
                    const backend = BackendFactory.createBackend();
                    const bpmnXml = await backend.getRawDefinition(defId, { type: 'bpmn' });
                    const count = this.countActivitiesFromBpmnXml(bpmnXml);
                    uengineTaskCountCache.set(defId, count);
                    return count;
                } catch (e) {
                    console.warn('uEngine task count 조회 실패:', e);
                    uengineTaskCountCache.set(defId, 0);
                    return 0;
                } finally {
                    uengineTaskCountPending.delete(defId);
                }
            })();

            uengineTaskCountPending.set(defId, taskCountPromise);
            return taskCountPromise;
        },
        handleClick() {
            if (this.isExecutionByProject) return;

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
        /** 새 창 /definitions/{id}?edit=1 — ProcessDefinitionChat에서 연필(toggleLock)과 동일 */
        goToEditor() {
            const id = (this.value.id || '').replace(/ /g, '_');
            if (!id) return;
            const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
            const path = `${base}/definitions/${id}`;
            const absolute = path.startsWith('http') ? path : `${window.location.origin}${path}`;
            const url = absolute.includes('?') ? `${absolute}&edit=1` : `${absolute}?edit=1`;
            window.open(url, '_blank');
        },
        async editProcessModel() {
            const id = this.value.id.replace(/ /g, '_');
            const backend = BackendFactory.createBackend();
            const value = await backend.getRawDefinition(id);
            // uEngine: getRawDefinition이 BPMN 문자열만 반환(객체 아님) → id로 편집 URL
            const hasMeta = value && typeof value === 'object' && value.id;
            const url = hasMeta
                ? `/definitions/${value.id}?modeling=true&edit=1`
                : `/definitions/chat?id=${id}&name=${this.value.name || ''}&modeling=true`;
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
        /** PAL 전용: 서브프로세스 설정 다이얼로그 열기 (맵 표시 이름, 공통 모듈) */
        openSubprocessSettingsDialog() {
            this.subprocessSettingsDisplayName = this.value.name || '';
            this.subprocessSettingsCommonModule = !!this.value.commonModule;
            this.subprocessSettingsDialog = true;
        },
        /** PAL 전용: 맵에 저장되는 이름·공통 모듈 설정 저장 후 정의체계도 저장 */
        async saveSubprocessSettings() {
            const trimmed = (this.subprocessSettingsDisplayName != null && String(this.subprocessSettingsDisplayName).trim()) ? String(this.subprocessSettingsDisplayName).trim() : null;
            this.value.name = (trimmed !== null && trimmed !== '') ? trimmed : (this.value.name || '');
            this.value.commonModule = this.subprocessSettingsCommonModule;
            this.subprocessSettingsDialog = false;
            this.EventBus.emit('saveProcessDefinitionMap');
            if (this.isUEngineMode() && this.value.id && this.value.name) {
                try {
                    const backend = BackendFactory.createBackend();
                    const r = await syncBpmnDefinitionDisplayName(backend, this.value.id, this.value.name);
                    if (!r.ok && r.reason !== 'no_xml' && r.reason !== 'empty') {
                        console.warn('[SubProcess] 정의 표시명 동기화:', r.reason);
                    }
                } catch (e) {
                    console.warn('[SubProcess] 정의 표시명 동기화 실패:', e);
                }
            }
            this.tooltipLoaded = false;
            if (window.$app_) {
                window.$app_.snackbarMessage = this.$t('successMsg.save') || '저장되었습니다.';
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
            }
        },
        /**
         * 정의체계도에서 서브 이름 수정 시 BaseProcess.editProcess 대신 호출: 맵 + TB 표시명 동기화
         */
        async editProcess(process) {
            this.value.id = process.id;
            if (process.label !== undefined) {
                this.value.label = process.label;
            }
            this.value.name = process.name;
            if (this.isUEngineMode() && process.id && process.name) {
                try {
                    const backend = BackendFactory.createBackend();
                    const r = await syncBpmnDefinitionDisplayName(backend, process.id, process.name);
                    if (!r.ok && r.reason !== 'no_xml' && r.reason !== 'empty') {
                        this.$toast?.error?.(
                            this.$t('processDefinitionMap.nameSyncFailed') || '정의 서버 표시명 저장에 실패했습니다.'
                        );
                    }
                } catch (e) {
                    console.error('[SubProcess] editProcess name sync:', e);
                    this.$toast?.error?.(this.$t('processDefinitionMap.nameSyncFailed') || '정의 서버 표시명 저장에 실패했습니다.');
                }
            }
            this.tooltipLoaded = false;
        },
        /**
         * 담당자 저장 완료 처리
         * uEngine: 루트 맵(this.value)의 proc_def_owners도 동기화해 두어, 나중에 '정의 체계도 저장' 버튼으로 덮어쓰여지지 않도록 함.
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
            // uEngine: 루트 맵의 proc_def_owners 동기화 (저장 버튼 누르기 전에 날아가지 않도록)
            if (this.isUEngineMode() && this.updateProcDefOwner && data?.processId) {
                this.updateProcDefOwner(data.processId, data.owner || null);
            }
        },
        /** 복제 제안 ID 생성 (경로 규칙: 공백→_, .bpmn 제거 후 _copy) */
        suggestDuplicateId(sourceId) {
            if (!sourceId) return '_copy';
            return String(sourceId)
                .trim()
                .replace(/\s+/g, '_')
                .replace(/\.bpmn$/i, '') + '_copy';
        },
        /** 복제 버튼 클릭 시: 이름/ID 입력 다이얼로그 열기 */
        duplicateProcess(process) {
            this.duplicatePendingProcess = process;
            this.duplicateForm.name = `${process.name} (${this.$t('ProcessMenu.copySuffix') || '복사'})`;
            this.duplicateForm.id = this.suggestDuplicateId(process.id);
            this.duplicateDialog = true;
        },
        /** 다이얼로그에서 복제 확인 시: 입력한 이름·ID로 실제 복제 수행 */
        async confirmDuplicate() {
            const process = this.duplicatePendingProcess;
            const newName = (this.duplicateForm.name || '').trim();
            const desiredId = (this.duplicateForm.id || '').trim().replace(/\s+/g, '_');
            if (!process) return;
            if (!newName) {
                this.$toast?.error(this.$t('ProcessMenu.duplicateNameRequired') || '이름을 입력해 주세요.');
                return;
            }
            if (!desiredId) {
                this.$toast?.error(this.$t('ProcessMenu.duplicateIdRequired') || 'ID를 입력해 주세요.');
                return;
            }
            this.duplicateLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const originalDef = await backend.getRawDefinition(process.id, { type: 'bpmn' });
                const bpmn =
                    typeof originalDef === 'string'
                        ? originalDef
                        : (originalDef?.bpmn ?? originalDef?.definition ?? '');
                const definition = typeof originalDef === 'object' ? originalDef?.definition ?? null : null;

                if (!bpmn || typeof bpmn !== 'string') {
                    throw new Error('BPMN 내용을 가져올 수 없습니다.');
                }
                if (!backend.duplicateLocalProcess) {
                    throw new Error('이 환경에서는 프로세스 복제를 지원하지 않습니다.');
                }

                const result = await backend.duplicateLocalProcess(
                    process.id,
                    newName,
                    bpmn,
                    definition,
                    desiredId
                );

                if (result.success) {
                    this.parent.sub_proc_list.push({
                        id: result.newId,
                        name: newName
                    });
                    this.duplicateDialog = false;
                    this.duplicatePendingProcess = null;
                    this.$toast?.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
                } else {
                    throw new Error('Duplication failed');
                }
            } catch (error) {
                console.error('프로세스 복제 중 오류:', error);
                this.$toast?.error(
                    error?.message || this.$t('ProcessMenu.duplicateFailed') || '프로세스 복사에 실패했습니다.'
                );
            } finally {
                this.duplicateLoading = false;
            }
        },
        /**
         * 프로세스 상태만 가볍게 로드 (뱃지 표시용)
         * lock 테이블에 있으면 '작성중(draft)', 없으면 '완료(published)'
         */
        async loadProcessStatus() {
            try {
                const supabase = window.$supabase;
                if (!supabase) {
                    this.processStatus = 'published';
                    return;
                }

                // lock 테이블에서 해당 프로세스가 잠겨있는지 확인
                const { data: lockData } = await supabase.from('lock').select('id').eq('id', this.value.id).maybeSingle();

                // lock이 있으면 작성중, 없으면 완료
                this.processStatus = lockData ? 'draft' : 'published';
            } catch (error) {
                console.error('프로세스 상태 로드 실패:', error);
                this.processStatus = 'published';
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
                let listRowMeta = null;
                if (this.isUEngineMode()) {
                    listRowMeta = await fetchDefinitionRowMeta((p) => backend.listDefinition(p), this.value.id);
                }

                let procDef = await backend.getRawDefinition(this.value.id);
                // uEngine: getRawDefinition이 BPMN 문자열만 반환 → 툴팁용 최소 객체로 보정
                if (procDef != null && typeof procDef === 'string') {
                    procDef = { name: this.value.name, owner: '', updated_at: null, definition: null };
                }

                // 담당자(owner): uEngine은 맵 JSON proc_def_owners, 그 외 Supabase proc_def
                const supabase = window.$supabase;
                if (procDef) {
                    if (this.isUEngineMode() && typeof backend.getOwnerByProcDef === 'function') {
                        const owner = await backend.getOwnerByProcDef(this.value.id);
                        if (owner) procDef.owner = owner;
                    } else if (supabase) {
                        const { data: ownerRow } = await supabase
                            .from('proc_def')
                            .select('owner')
                            .eq('id', this.value.id)
                            .maybeSingle();
                        if (ownerRow && ownerRow.owner != null && ownerRow.owner !== '') {
                            procDef.owner = ownerRow.owner;
                        }
                    }
                }

                if (procDef) {
                    const definition = procDef.definition;
                    const activities = definition?.activities || [];
                    const taskCount = this.isUEngineMode()
                        ? await this.getUEngineTaskCount(this.value.id)
                        : activities.length;

                    // lock 테이블에서 상태 확인 (작성중/완료)
                    let status = 'published';
                    if (supabase) {
                        const { data: lockData } = await supabase.from('lock').select('id').eq('id', this.value.id).maybeSingle();
                        status = lockData ? 'draft' : 'published';
                    }

                    // owner ID를 이름으로 변환
                    let ownerName = '';
                    if (procDef.owner) {
                        ownerName = await this.resolveOwnerName(procDef.owner);
                    }

                    const savedTitle =
                        (listRowMeta?.name && String(listRowMeta.name).trim()) ||
                        (procDef.name && String(procDef.name).trim()) ||
                        (this.value.name && String(this.value.name).trim()) ||
                        this.value.id;
                    const rawActor =
                        (listRowMeta?.updatedByName && hasActorValue(listRowMeta.updatedByName)
                            ? trimmedActorId(listRowMeta.updatedByName)
                            : '') ||
                        (procDef.updatedByName && hasActorValue(procDef.updatedByName)
                            ? trimmedActorId(procDef.updatedByName)
                            : '');
                    const lastActor = rawActor ? await resolveUpdatedByForDisplay(rawActor) : '';

                    this.processTooltipInfo = {
                        id: this.value.id,
                        name: savedTitle,
                        owner: ownerName,
                        isUnchecked: this.isNew(this.value.id) && !this.enableEdit,
                        status: status,
                        updatedAt: procDef.updated_at ?? null,
                        description: definition?.description || '',
                        taskCount,
                        completionRate: 0,
                        lastModifiedByActor: lastActor
                    };

                    this.processStatus = status;
                    this.tooltipLoaded = true;
                }
            } catch (error) {
                console.error('프로세스 정보 로드 실패:', error);
                // 기본 정보 설정
                this.processTooltipInfo = {
                    id: this.value.id,
                    name: this.value.name,
                    owner: '',
                    isUnchecked: this.isNew(this.value.id) && !this.enableEdit,
                    status: 'published',
                    updatedAt: null,
                    description: '',
                    taskCount: 0,
                    completionRate: 0,
                    lastModifiedByActor: ''
                };
            } finally {
                this.loadingTooltip = false;
            }
        },
        /**
         * Owner ID를 이름으로 변환 (uEngine 모드에서는 Keycloak, 그 외 조직도)
         */
        async resolveOwnerName(ownerId) {
            if (!ownerId) return '';

            if (window.$mode === 'uEngine') {
                try {
                    return await getKeycloakUserDisplayName(ownerId);
                } catch (error) {
                    console.warn('Owner 이름 조회 실패 (Keycloak):', error);
                    return ownerId;
                }
            }

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

.unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: rgb(var(--v-theme-primary));
    display: inline-block;
    flex-shrink: 0;
}

.subprocess-edge-dot {
    position: absolute;
    top: 3px;
    right: 3px;
    z-index: 1;
}
</style>

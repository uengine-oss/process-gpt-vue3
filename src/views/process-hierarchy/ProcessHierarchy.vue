<template>
    <div class="process-hierarchy-container">
        <!-- Left Panel: Tree -->
        <div class="hierarchy-left-panel" :style="{ width: leftPanelWidth + 'px' }">
            <ProcessHierarchyTree
                :procMap="procMap"
                :metricsMap="metricsMap"
                :definitionList="definitionList"
                :selectedId="selectedProcessId"
                @select="handleSelectProcess"
            />
            <div class="resize-handle-left" @mousedown="startResizeLeft"></div>
        </div>
        <!-- Center Panel: BPMN Designer -->
        <div class="hierarchy-center-panel">
            <ProcessHierarchyDesigner
                ref="designer"
                :bpmn="bpmnXml"
                :processName="selectedProcessName"
                :processDefinition="processDefinition"
                :definitionPath="selectedProcessId"
                :definitionList="definitionList"
                :loading="loading"
                :useLock="useLock"
                :lock="lock"
                :editUser="editUser"
                :editUserDisplayName="editUserDisplayName"
                :currentUserId="currentUserId"
                @openPanel="handleOpenPanel"
                @updateXml="handleUpdateXml"
                @definition="handleDefinition"
                @save="handleSave"
                @clone="handleClone"
                @versionHistory="handleVersionHistory"
                @toggleWip="handleToggleWip"
                @requestLock="requestLock"
                @releaseLock="releaseLock"
            />
        </div>

        <!-- Right Panel: 선택만 되면 마운트 유지(v-show) — 툴바 저장 시 프로세스 탭 설명이 XML에 반영되도록 -->
        <div
            v-if="selectedProcessId"
            v-show="showProperties"
            class="hierarchy-right-panel"
            :style="{ width: rightPanelWidth + 'px' }"
        >
            <div class="resize-handle-right" @mousedown="startResizeRight"></div>
            <ProcessHierarchyProperties
                ref="propertiesPanel"
                :processDefinition="processDefinition"
                :element="selectedElement"
                :isViewMode="!hierarchyCanEdit"
                :roles="roles"
                :processVariables="processVariables"
                :definitionPath="selectedProcessId"
                :definition="bpmnDefinitions"
                @save="handlePropertiesSave"
                @close="handleCloseProperties"
            />
        </div>

        <!-- Toggle Properties Button -->
        <v-btn v-if="!showProperties && selectedProcessId" icon size="small" class="toggle-properties-btn" @click="showProperties = true">
            <v-icon>mdi-chevron-left</v-icon>
        </v-btn>

        <!-- Version History Dialog -->
        <process-definition-version-dialog
            v-if="versionDialog"
            :process="processDefinition"
            :open="versionDialog"
            :definitionPath="selectedProcessId"
            :processName="selectedProcessName"
            :type="'bpmn'"
            :currentBpmn="bpmnXml"
            @close="versionDialog = false"
            @save="handleVersionSave"
        />

        <!-- Approval Warning Dialog -->
        <v-dialog v-model="approvalWarningDialog" max-width="460" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
                    {{ $t('approval.inProgressTitle') || '승인 진행 중' }}
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <p class="mb-3">
                        {{
                            $t('approval.inProgressMessage') ||
                            '현재 이 프로세스에 대해 승인이 진행 중입니다. 저장하면 기존 승인이 취소되고 새로 검토 요청됩니다.'
                        }}
                    </p>
                    <v-alert v-if="activeApprovalState" type="info" variant="tonal" density="compact">
                        <div class="text-body-2">
                            <strong>{{ $t('approval.currentState') || '현재 상태' }}:</strong> {{ activeApprovalState.state }}
                        </div>
                        <div v-if="activeApprovalState.version" class="text-body-2">
                            <strong>{{ $t('approval.version') || '버전' }}:</strong> v{{ activeApprovalState.version }}
                        </div>
                        <div v-if="activeApprovalState.submitted_by" class="text-body-2">
                            <strong>{{ $t('approval.submittedBy') || '제출자' }}:</strong> {{ activeApprovalState.submitted_by }}
                        </div>
                    </v-alert>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        @click="
                            approvalWarningDialog = false;
                            activeApprovalState = null;
                        "
                    >
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn color="warning" variant="flat" @click="proceedAfterApprovalWarning">
                        {{ $t('approval.cancelAndSave') || '기존 승인 취소 후 저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Save & Version Dialog -->
        <v-dialog v-model="saveVersionDialog" max-width="440" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">mdi-content-save-check</v-icon>
                    {{ $t('processHierarchy.saveVersion') }}
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="saveVersionDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="px-4 pb-2">
                    <div class="d-flex align-center mb-4 pa-3 rounded-lg" style="background: #f5f7fa">
                        <v-icon size="18" class="mr-2" color="grey-darken-1">mdi-tag-outline</v-icon>
                        <span class="text-body-2 text-medium-emphasis">{{ $t('processHierarchy.currentVersionLabel') }}:</span>
                        <v-chip size="small" color="primary" variant="flat" class="ml-2">v{{ saveVersion }}</v-chip>
                    </div>
                    <v-textarea
                        v-model="saveVersionMessage"
                        :label="$t('processHierarchy.changeNote')"
                        :placeholder="$t('processHierarchy.changeNotePlaceholder')"
                        variant="outlined"
                        density="compact"
                        rows="2"
                        hide-details
                        class="mb-3"
                    />
                    <v-checkbox
                        v-if="!isPal"
                        v-model="submitReviewAfterSave"
                        :label="$t('processHierarchy.submitForReviewAfterSave')"
                        color="primary"
                        density="compact"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" @click="saveVersionDialog = false" :disabled="savingVersion">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="confirmSaveVersion" :loading="savingVersion">
                        <v-icon start>mdi-content-save</v-icon>
                        {{ $t('processHierarchy.saveAndContinue') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 프로세스 복제: 정의체계도(SubProcess)와 동일 — 이름·ID(경로) 입력 -->
        <v-dialog v-model="duplicateDialog" max-width="480" persistent>
            <v-card rounded="lg">
                <v-card-title class="text-subtitle-1 pa-4 pb-2">
                    {{ $t('ProcessMenu.duplicate') || '프로세스 복제' }}
                </v-card-title>
                <v-card-text class="px-4 pb-2">
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
                        :hint="$t('ProcessMenu.duplicateIdHint') || '복제된 정의의 고유 경로입니다. 폴더/파일.bpmn 형태 가능.'"
                        persistent-hint
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" :disabled="duplicateLoading" @click="duplicateDialog = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" :loading="duplicateLoading" @click="confirmDuplicateProcess">
                        {{ $t('ProcessMenu.duplicateConfirm') || '복제' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import ProcessHierarchyDesigner from './ProcessHierarchyDesigner.vue';
import ProcessHierarchyProperties from './ProcessHierarchyProperties.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { getKeycloakUserById, getKeycloakUserDisplayName } from '@/utils/keycloak';
import { formatKeycloakUserAsNameAndLoginId } from '@/utils/definitionActorDisplay';
import { canBypassLock } from '@/utils/processManagement';
import { parseUengineProcessRootMetaFromXml } from '@/utils/bpmnHierarchyProcessMeta';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'ProcessHierarchy',
    components: {
        ProcessHierarchyTree,
        ProcessHierarchyDesigner,
        ProcessHierarchyProperties,
        ProcessDefinitionVersionDialog
    },
    data() {
        return {
            procMap: null,
            metricsMap: null,
            definitionList: [],
            selectedProcessId: '',
            selectedProcessName: '',
            /** 트리(체계도)에서 선택 시 표시명 — 헤더·프로퍼티 제목을 BPMN definitionName과 맞춤 */
            treeLabelForSelectedProcess: '',
            bpmnXml: '',
            processDefinition: null,
            bpmnDefinitions: null,
            selectedElement: null,
            roles: [],
            processVariables: [],
            loading: false,
            showProperties: true,
            versionDialog: false,
            // Save & Version dialog
            saveVersionDialog: false,
            saveVersionTag: 'minor',
            saveVersionMessage: '',
            submitReviewAfterSave: true,
            latestVersion: '0.0',
            savingVersion: false,
            pendingSaveXml: '',
            duplicateDialog: false,
            duplicateForm: { name: '', id: '' },
            duplicateLoading: false,
            // Approval warning
            approvalWarningDialog: false,
            activeApprovalState: null,
            leftPanelWidth: 280,
            rightPanelWidth: 340,
            resizing: null,
            resizeStartX: 0,
            resizeStartWidth: 0,
            selectionListenerCleanup: null,
            // Lock (uEngine: 동시 수정 방지)
            lock: false,
            editUser: '',
            editUserDisplayName: ''
        };
    },
    async mounted() {
        await this.loadInitialData();
        // Auto-select process from query parameter (from Process Architecture navigation)
        const queryId = this.$route?.query?.id;
        const queryName = this.$route?.query?.name;
        if (queryId) {
            await this.handleSelectProcess(queryId, queryName || queryId);
        }
        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
        if (this.selectionListenerCleanup) {
            this.selectionListenerCleanup();
            this.selectionListenerCleanup = null;
        }
    },
    computed: {
        isPal() {
            return !!(typeof window !== 'undefined' && window.$pal);
        },
        useLock() {
            return typeof window !== 'undefined' && window.$mode === 'uEngine' && typeof backend.getLock === 'function';
        },
        currentUserId() {
            return typeof window !== 'undefined' ? localStorage.getItem('uid') || '' : '';
        },
        /** lock 보유 시에만 편집 가능 → Properties 패널 viewMode */
        hierarchyCanEdit() {
            if (!this.useLock) return true;
            return !!(this.lock && this.editUser === this.currentUserId);
        },
        saveVersion() {
            // 저장할 때마다 minor +1 (거버넌스: Draft 단계에서 저장 시마다 마이너 버전 자동 기록)
            const base = this.latestVersion;
            if (!base || base === '0.0') return '0.1';
            const parts = String(base).split('.');
            const major = parseInt(parts[0]) || 0;
            const minor = (parseInt(parts[1]) || 0) + 1;
            return `${major}.${minor}`;
        }
    },
    methods: {
        async loadInitialData() {
            this.loading = true;
            try {
                const supabase = window.$supabase;
                const isUEngine = typeof window !== 'undefined' && window.$mode === 'uEngine';
                const promises = [
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap(),
                    backend.listDefinition('', { match: { tenant_id: window.$tenantName } }),
                    isUEngine
                        ? Promise.resolve([])
                        : storage.list('proc_def_version', {
                              sort: 'desc',
                              orderBy: 'timeStamp'
                          })
                ];
                // proc_def_approval_state 일괄 조회
                if (supabase) {
                    promises.push(
                        supabase
                            .from('proc_def_approval_state')
                            .select('proc_def_id, state, created_at, updated_at')
                            .eq('tenant_id', window.$tenantName)
                            .order('created_at', { ascending: false })
                            .then((res) => res.data || [])
                    );
                }

                const [procMapResult, metricsResult, defList, versionList, approvalStates] = await Promise.all(promises);
                let procMap = procMapResult;
                // uEngine: 권한 사용 시 읽기 권한 없는 프로세스는 리스트에 표시하지 않음
                if (isUEngine && typeof backend.checkUsePermissions === 'function' && typeof backend.filterProcDefMap === 'function') {
                    try {
                        const usePerm = await backend.checkUsePermissions();
                        if (usePerm && procMap) {
                            procMap = await backend.filterProcDefMap(procMap);
                        }
                    } catch (e) {
                        console.warn('[ProcessHierarchy] permission filter skip:', e);
                    }
                }
                this.procMap = procMap;
                this.metricsMap = metricsResult;

                // uEngine: 트리와 id 일치시키기 위해 procMap에서 리프( sub_proc_list )만 평면 목록으로 구성
                let listForVersion = defList || [];
                if (isUEngine && procMap?.mega_proc_list?.length > 0) {
                    const flatFromMap = [];
                    procMap.mega_proc_list.forEach((mega) => {
                        (mega.major_proc_list || []).forEach((major) => {
                            (major.sub_proc_list || []).forEach((sub) => {
                                const sid = sub.id ?? sub.path ?? sub.name;
                                if (sid) flatFromMap.push({ id: sid, file_name: sid, name: sub.name ?? sid });
                            });
                        });
                    });
                    if (flatFromMap.length > 0) listForVersion = flatFromMap;
                }

                // 각 정의의 최신 버전 매핑
                const latestVersionMap = {};
                if (isUEngine && listForVersion.length > 0) {
                    // uEngine: 백엔드 버전 API로 정의별 최신 버전 조회 (getDefinitionVersions)
                    const normalizeId = (id) => (typeof id === 'string' ? id.replace(/\.bpmn$/i, '') : id);
                    const versionResults = await Promise.all(
                        listForVersion.map((def) => {
                            const id = normalizeId(def.id || def.file_name);
                            if (!id) return Promise.resolve([]);
                            return backend.getDefinitionVersions(id, { sort: 'desc', orderBy: 'version' });
                        })
                    );
                    versionResults.forEach((versions, idx) => {
                        const rawId = listForVersion[idx]?.id ?? listForVersion[idx]?.file_name;
                        if (!rawId || !versions?.length) return;
                        const sorted = [...versions].sort((a, b) => {
                            const [aM, am] = String(a.version).split('.').map(Number);
                            const [bM, bm] = String(b.version).split('.').map(Number);
                            return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                        });
                        latestVersionMap[rawId] = String(sorted[0].version);
                    });
                } else if (versionList && versionList.length > 0) {
                    versionList.forEach((v) => {
                        const defId = v.proc_def_id;
                        if (defId && !latestVersionMap[defId]) {
                            latestVersionMap[defId] = v.version;
                        }
                    });
                }

                // 각 정의의 최신 승인 상태 매핑
                const approvalMap = {};
                if (approvalStates && approvalStates.length > 0) {
                    approvalStates.forEach((row) => {
                        if (row.proc_def_id && !approvalMap[row.proc_def_id]) {
                            approvalMap[row.proc_def_id] = row.state;
                        }
                    });
                }

                const defs = listForVersion;
                defs.forEach((def) => {
                    const id = def.id || def.file_name;
                    if (id && latestVersionMap[id]) {
                        def.version = latestVersionMap[id];
                    }
                    // WIP flag from definition JSONB
                    const defObj = typeof def.definition === 'string' ? JSON.parse(def.definition || '{}') : def.definition || {};
                    if (defObj.wip) {
                        def.approval_state = 'wip';
                    }
                    // approval_state 매핑 (proc_def 테이블에 없는 경우 보충)
                    else if (id && approvalMap[id] && !def.approval_state) {
                        const state = approvalMap[id];
                        // proc_def_approval_state의 state 값을 UI 상태로 매핑
                        if (state === 'public_feedback') def.approval_state = 'public_review';
                        else if (state === 'in_review' || state === 'final_edit') def.approval_state = 'review';
                        else if (state === 'published') def.approval_state = 'published';
                        else def.approval_state = state;
                    }
                });
                this.definitionList = defs;
            } catch (e) {
                console.error('Failed to load initial data:', e);
            } finally {
                this.loading = false;
            }
        },

        async handleSelectProcess(id, name) {
            const normalizedId = typeof id === 'string' ? id.trim() : id;
            if (this.selectedProcessId === normalizedId) return;

            // uEngine lock: 이전 선택에 대한 잠금 해제 (본인이 잡은 경우만)
            if (this.useLock && this.selectedProcessId && this.editUser === this.currentUserId) {
                try {
                    await backend.deleteLock(this.selectedProcessId);
                } catch (e) {
                    console.warn('deleteLock on switch process:', e);
                }
                this.lock = false;
                this.editUser = '';
                this.editUserDisplayName = '';
            }

            // 이전 element 선택 초기화
            this.selectedElement = null;
            this.selectedProcessId = normalizedId;
            this.selectedProcessName = name;
            this.treeLabelForSelectedProcess =
                name != null && String(name).trim() !== '' ? String(name).trim() : '';
            await this.loadProcess(normalizedId);

            // uEngine lock: 선택 시에는 잠금을 잡지 않고, 현재 잠금 상태만 갱신 → 기본은 연필(보기)로 표시. 연필 클릭 시 tryLock
            if (this.useLock && this.selectedProcessId) {
                await this.refreshLockState(this.selectedProcessId);
            }
        },

        async loadProcess(id) {
            if (!id) return;
            this.loading = true;
            this.bpmnXml = '';
            let metaFromBpmn = null;
            try {
                // definitionList에서 해당 프로세스 찾기
                let def = this.definitionList.find((d) => d.id === id || d.file_name === id);

                // uEngine 모드: definitionList에 없으면 getRawDefinition으로 직접 로드 (트리 id는 map 기준이라 listDefinition 결과와 불일치할 수 있음)
                if (typeof window !== 'undefined' && window.$mode === 'uEngine') {
                    const rawBpmn = await backend.getRawDefinition(id, { type: 'bpmn' });
                    if (rawBpmn && typeof rawBpmn === 'string') {
                        def = {
                            id,
                            file_name: id,
                            bpmn: rawBpmn,
                            definition: {}
                        };
                    }
                }

                if (def) {
                    def.processDefinitionId = def.processDefinitionId || def.id || def.file_name || id;
                    const bpmnStr = def.bpmn || '';
                    // uEngine: 프로세스 탭 메타는 XML에서 복원 (이름은 트리 표시명 우선)
                    if (typeof window !== 'undefined' && window.$mode === 'uEngine' && bpmnStr) {
                        metaFromBpmn = parseUengineProcessRootMetaFromXml(bpmnStr);
                        if (metaFromBpmn) {
                            def.description = metaFromBpmn.description ?? def.description ?? '';
                            if (metaFromBpmn._shortDescriptionShape) {
                                def.shortDescription = { ...metaFromBpmn._shortDescriptionShape };
                            }
                            if (metaFromBpmn.systems) def.systems = metaFromBpmn.systems;
                            if (metaFromBpmn.fte) def.fte = metaFromBpmn.fte;
                            Object.keys(metaFromBpmn).forEach((k) => {
                                if (k.startsWith('_') || ['name', 'description', 'systems', 'fte'].includes(k)) return;
                                if (metaFromBpmn[k] !== undefined && def[k] === undefined) def[k] = metaFromBpmn[k];
                            });
                        }
                    }

                    const treeLabel = (this.treeLabelForSelectedProcess || '').trim();
                    const sameSelection = String(id) === String(this.selectedProcessId);
                    if (treeLabel && sameSelection) {
                        def.name = treeLabel;
                        def.processDefinitionName = treeLabel;
                        this.selectedProcessName = treeLabel;
                    } else {
                        def.name =
                            def.name ||
                            metaFromBpmn?.name ||
                            this.selectedProcessName ||
                            def.processDefinitionName ||
                            def.processDefinitionId;
                        def.processDefinitionName =
                            def.processDefinitionName || def.name || this.selectedProcessName || def.processDefinitionId;
                        this.selectedProcessName = this.selectedProcessName || def.processDefinitionName;
                    }

                    this.processDefinition = def;
                    this.bpmnXml = bpmnStr;
                    this.processVariables = def.definition?.data || [];
                    this.roles = def.definition?.roles || [];
                } else {
                    this.processDefinition = null;
                    this.bpmnXml = '';
                    this.processVariables = [];
                    this.roles = [];
                }
            } catch (e) {
                console.error('Failed to load process:', e);
                this.processDefinition = null;
                this.bpmnXml = '';
            } finally {
                this.loading = false;
            }
        },

        /** 잠금 보유자 sub → `성 이름 (로그인ID)` 한 줄 */
        async buildEditUserDisplayLine(userId) {
            if (!userId) return '';
            const holder = await getKeycloakUserById(userId);
            if (holder) {
                const label = formatKeycloakUserAsNameAndLoginId(holder);
                if (label) return label;
            }
            const nm = (await getKeycloakUserDisplayName(userId)).trim();
            if (nm && nm !== userId) return nm;
            return userId;
        },

        /** 선택 시 호출: 잠금을 잡지 않고 현재 잠금 상태만 조회 → 기본 연필(보기) 유지 */
        async refreshLockState(id) {
            if (!this.useLock || !id || !backend.getLock) return;
            try {
                const lockRes = await backend.getLock(id);
                if (lockRes?.user_id) {
                    this.lock = true;
                    this.editUser = lockRes.user_id;
                    this.editUserDisplayName = await this.buildEditUserDisplayLine(lockRes.user_id);
                } else {
                    this.lock = false;
                    this.editUser = '';
                    this.editUserDisplayName = '';
                }
            } catch (e) {
                this.lock = false;
                this.editUser = '';
                this.editUserDisplayName = '';
            }
        },

        async tryLock(id) {
            if (!this.useLock || !id || !backend.setLock || !backend.getLock) return;
            const uid = this.currentUserId;
            if (!uid) return;
            try {
                await backend.setLock({ id, user_id: uid });
                this.lock = true;
                this.editUser = uid;
                this.editUserDisplayName = await this.buildEditUserDisplayLine(uid);
            } catch (e) {
                if (e?.response?.status === 409 || e?.status === 409) {
                    try {
                        const lockRes = await backend.getLock(id);
                        const holderId = lockRes?.user_id;
                        const holder = holderId ? await getKeycloakUserById(holderId) : null;
                        if (holder && !canBypassLock()) {
                            this.lock = true;
                            this.editUser = holderId;
                            this.editUserDisplayName = await this.buildEditUserDisplayLine(holderId);
                            if (this.$toast) {
                                this.$toast.info(
                                    (this.$t('processHierarchy.lockedByUser') || '%s님이 수정 중입니다.').replace('%s', this.editUserDisplayName)
                                );
                            }
                            return;
                        }
                        await backend.deleteLock(id);
                        await backend.setLock({ id, user_id: uid });
                        this.lock = true;
                        this.editUser = uid;
                        this.editUserDisplayName = await this.buildEditUserDisplayLine(uid);
                    } catch (err) {
                        console.warn('tryLock after 409:', err);
                    }
                } else {
                    console.warn('setLock failed:', e);
                }
            }
        },

        async requestLock() {
            if (!this.useLock || !this.selectedProcessId) return;
            // 수정 권한 확인: 쓰기 권한 없으면 편집 불가
            if (typeof backend.checkProcessPermission === 'function') {
                try {
                    const perm = await backend.checkProcessPermission(this.selectedProcessId);
                    if (!perm.writable && !perm.isPublic) {
                        if (this.$toast) {
                            this.$toast.error(this.$t('processHierarchy.noWritePermission') || '이 프로세스를 수정할 권한이 없습니다.');
                        }
                        return;
                    }
                } catch (e) {
                    console.warn('[ProcessHierarchy] checkProcessPermission:', e);
                    if (this.$toast) {
                        this.$toast.error(this.$t('processHierarchy.noWritePermission') || '이 프로세스를 수정할 권한이 없습니다.');
                    }
                    return;
                }
            }
            await this.tryLock(this.selectedProcessId);
        },

        async releaseLock() {
            if (!this.useLock || !this.selectedProcessId) return;
            try {
                await backend.deleteLock(this.selectedProcessId);
            } catch (e) {
                console.warn('releaseLock deleteLock:', e);
            }
            this.lock = false;
            this.editUser = '';
            this.editUserDisplayName = '';
            // lock 풀렸으므로 현재 프로세스 다시 조회하여 갱신
            await this.loadProcess(this.selectedProcessId);
        },

        handleOpenPanel(elementId) {
            if (!elementId) return;
            if (elementId.startsWith('Collaboration_') || elementId.startsWith('Process_')) {
                this.selectedElement = null;
                return;
            }

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const elementRegistry = modeler.get('elementRegistry');
            if (!elementRegistry) return;

            const element = elementRegistry.get(elementId);
            if (!element) {
                this.selectedElement = null;
                return;
            }

            // Extend uEngine properties if needed (businessObject 전달)
            const bpmnVue = this.$refs.designer?.$refs?.bpmnVue;
            if (bpmnVue && bpmnVue.extendUEngineProperties) {
                bpmnVue.extendUEngineProperties({ businessObject: element.businessObject });
            }

            this.selectedElement = element;
            this.showProperties = true;
        },

        handleDefinition(def) {
            this.bpmnDefinitions = def;
            // BPMN definitions 로드 완료 → selection 리스너 등록
            this.setupSelectionListener();
        },

        setupSelectionListener() {
            // 이전 리스너 정리
            if (this.selectionListenerCleanup) {
                this.selectionListenerCleanup();
                this.selectionListenerCleanup = null;
            }

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const eventBus = modeler.get('eventBus');
            if (!eventBus) return;

            // element 클릭(선택) 시 자동으로 Properties 패널에 반영
            const onSelectionChanged = (event) => {
                const newSelection = event.newSelection || [];
                if (newSelection.length === 1) {
                    const element = newSelection[0];
                    // Root element 무시
                    if (element.type === 'bpmn:Process' || element.type === 'bpmn:Collaboration') {
                        this.selectedElement = null;
                        return;
                    }
                    // extendUEngineProperties 호출 (businessObject 전달)
                    const bpmnVue = this.$refs.designer?.$refs?.bpmnVue;
                    if (bpmnVue && bpmnVue.extendUEngineProperties) {
                        bpmnVue.extendUEngineProperties({ businessObject: element.businessObject });
                    }
                    this.selectedElement = element;
                    this.showProperties = true;
                } else if (newSelection.length === 0) {
                    this.selectedElement = null;
                }
            };

            eventBus.on('selection.changed', onSelectionChanged);

            this.selectionListenerCleanup = () => {
                eventBus.off('selection.changed', onSelectionChanged);
            };
        },

        handleCloseProperties() {
            this.selectedElement = null;
        },

        handleUpdateXml(xml) {
            this.bpmnXml = xml;
        },

        getCurrentProcessTitleForSave() {
            const pr = this.$refs.propertiesPanel;
            return (
                (pr && typeof pr.getEffectiveProcessTitleForBpmn === 'function' && pr.getEffectiveProcessTitleForBpmn()) ||
                this.selectedProcessName ||
                this.processDefinition?.name ||
                ''
            );
        },

        /** uEngine: 저장 직전 XML 문자열에 프로세스 메타(definitionName, shortDescription.text)를 강제 반영 */
        applyProcessMetaToXml(xml) {
            try {
                const pr = this.$refs.propertiesPanel;
                const title = this.getCurrentProcessTitleForSave();
                const description =
                    (pr && typeof pr.getEffectiveProcessDescriptionForBpmn === 'function' && pr.getEffectiveProcessDescriptionForBpmn()) ||
                    '';
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, 'application/xml');
                const ns = 'http://uengine';
                const props = doc.getElementsByTagNameNS(ns, 'properties');

                for (let i = 0; i < props.length; i++) {
                    const el = props[i];
                    const parent = el.parentElement;
                    if (!parent || parent.localName !== 'extensionElements') continue;
                    const grandParent = parent.parentElement;
                    if (!grandParent || grandParent.localName !== 'process') continue;

                    let raw = el.getAttribute('json');
                    if ((!raw || !String(raw).trim()) && el.getElementsByTagNameNS(ns, 'json').length) {
                        raw = (el.getElementsByTagNameNS(ns, 'json')[0].textContent || '').trim();
                    }

                    let obj = {};
                    try {
                        obj = raw ? JSON.parse(raw) : {};
                    } catch {
                        obj = {};
                    }

                    obj.definitionName = title || obj.definitionName || '';
                    const prevSd = obj.shortDescription;
                    if (prevSd && typeof prevSd === 'object' && !Array.isArray(prevSd)) {
                        obj.shortDescription = { ...prevSd, text: description };
                    } else {
                        obj.shortDescription = { text: description };
                    }

                    const nextJson = JSON.stringify(obj);
                    el.setAttribute('json', nextJson);
                    const jsonEls = el.getElementsByTagNameNS(ns, 'json');
                    if (jsonEls.length) {
                        jsonEls[0].textContent = nextJson;
                    }
                }

                return new XMLSerializer().serializeToString(doc);
            } catch (e) {
                console.warn('applyProcessMetaToXml failed, using original xml:', e);
                return xml;
            }
        },

        /** 현재 선택된 프로세스 이름을 procMap 리프(sub_proc_list) name에도 동기화 */
        async syncSelectedProcessNameToMap(newName) {
            const targetId = String(this.selectedProcessId || '').trim();
            const nextName = String(newName || '').trim();
            if (!targetId || !nextName || !this.procMap?.mega_proc_list?.length) return false;

            const updatedMap = JSON.parse(JSON.stringify(this.procMap));
            let updated = false;

            updatedMap.mega_proc_list.forEach((mega) => {
                (mega.major_proc_list || []).forEach((major) => {
                    (major.sub_proc_list || []).forEach((sub) => {
                        const subId = String(sub?.id ?? sub?.path ?? '').trim();
                        if (subId === targetId) {
                            sub.name = nextName;
                            updated = true;
                        }
                    });
                });
            });

            if (!updated) return false;

            this.procMap = updatedMap;
            this.treeLabelForSelectedProcess = nextName;
            this.selectedProcessName = nextName;
            if (this.processDefinition) {
                this.processDefinition.name = nextName;
                this.processDefinition.processDefinitionName = nextName;
            }
            const def = this.definitionList.find((d) => {
                const id = String(d?.id ?? d?.file_name ?? '').trim();
                return id === targetId;
            });
            if (def) {
                def.name = nextName;
                def.processDefinitionName = nextName;
            }

            if (typeof window !== 'undefined' && window.$mode === 'uEngine') {
                await backend.putProcessDefinitionMap(updatedMap);
            }

            return true;
        },

        async handleSave() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                // uEngine: 상단 저장만 눌러도 프로세스 탭(설명 등)이 BPMN 루트 JSON에 들어가게
                if (typeof window !== 'undefined' && window.$mode === 'uEngine' && this.selectedProcessId) {
                    await this.$nextTick();
                    const pr = this.$refs.propertiesPanel;
                    if (pr && typeof pr.applyProcessTabToBpmnRoot === 'function') {
                        pr.applyProcessTabToBpmnRoot();
                    }
                }
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                this.pendingSaveXml =
                    typeof window !== 'undefined' && window.$mode === 'uEngine' ? this.applyProcessMetaToXml(xml) : xml;

                const isUEngine = typeof window !== 'undefined' && window.$mode === 'uEngine';
                const versionId = String(this.selectedProcessId || '').replace(/\.bpmn$/i, '');

                // 최신 버전 조회 (uEngine: API 경로 불일치/404 시에도 저장 플로우는 계속)
                let versions = [];
                try {
                    const v = await backend.getDefinitionVersions(versionId, {
                        sort: 'desc',
                        orderBy: 'version'
                    });
                    versions = Array.isArray(v) ? v : [];
                } catch (e) {
                    if (isUEngine) {
                        console.warn('[ProcessHierarchy] getDefinitionVersions 실패, 기본 버전 사용:', e);
                    } else {
                        throw e;
                    }
                }
                if (versions.length > 0) {
                    const sorted = [...versions].sort((a, b) => {
                        const [aM, am] = String(a.version).split('.').map(Number);
                        const [bM, bm] = String(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
                    });
                    this.latestVersion = String(sorted[0].version);
                } else {
                    this.latestVersion = '0.0';
                }

                // 활성 승인 건 체크 (ProcessGPT 중심; uEngine은 스킵)
                if (!isUEngine) {
                    try {
                        const activeApproval = await backend.getActiveApprovalState(this.selectedProcessId);
                        if (activeApproval) {
                            this.activeApprovalState = activeApproval;
                            this.approvalWarningDialog = true;
                            return;
                        }
                    } catch (e) {
                        console.warn('승인 상태 확인 실패:', e);
                    }
                }

                // 다이얼로그 초기화 후 열기
                this.saveVersionTag = 'minor';
                this.saveVersionMessage = '';
                this.submitReviewAfterSave = true;
                this.saveVersionDialog = true;
            } catch (e) {
                console.error('Save preparation failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.savePrepFailed'));
                }
            }
        },

        updateXmlVersion(xml, version) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, 'application/xml');
                const ns = 'http://uengine';
                const props = doc.getElementsByTagNameNS(ns, 'properties');
                for (let i = 0; i < props.length; i++) {
                    const el = props[i];
                    // process-level properties (direct child of extensionElements under bpmn:process)
                    const parent = el.parentElement;
                    if (!parent || parent.localName !== 'extensionElements') continue;
                    const grandParent = parent.parentElement;
                    if (!grandParent || grandParent.localName !== 'process') continue;

                    const jsonAttr = el.getAttribute('json');
                    if (jsonAttr) {
                        try {
                            const obj = JSON.parse(jsonAttr);
                            obj.version = version;
                            el.setAttribute('json', JSON.stringify(obj));
                        } catch (e) {
                            console.warn('Failed to parse uengine:properties json:', e);
                        }
                    }
                }
                const serializer = new XMLSerializer();
                return serializer.serializeToString(doc);
            } catch (e) {
                console.warn('updateXmlVersion failed, using original xml:', e);
                return xml;
            }
        },

        proceedAfterApprovalWarning() {
            this.approvalWarningDialog = false;
            this.activeApprovalState = null;
            // 승인 취소는 submitForReview에서 자동 처리됨 → 저장 다이얼로그 열기
            this.saveVersionTag = 'minor';
            this.saveVersionMessage = '';
            this.submitReviewAfterSave = true;
            this.saveVersionDialog = true;
        },

        async confirmSaveVersion() {
            this.savingVersion = true;
            try {
                const version = this.saveVersion;
                const titleForSave = this.getCurrentProcessTitleForSave();
                // BPMN XML 내부 uengine:properties의 version 필드 업데이트
                let xml = this.updateXmlVersion(this.pendingSaveXml, version);
                if (typeof window !== 'undefined' && window.$mode === 'uEngine') {
                    xml = this.applyProcessMetaToXml(xml);
                }
                this.bpmnXml = xml;

                // 새 minor 버전으로 저장 (거버넌스: 저장 시마다 마이너 버전 자동 기록)
                await backend.putRawDefinition(xml, this.selectedProcessId, {
                    name: titleForSave || this.selectedProcessName,
                    definition: this.processDefinition?.definition || null,
                    version: version,
                    version_tag: null,
                    arcv_id: `${this.selectedProcessId}_${version}`,
                    message: this.saveVersionMessage || null
                });

                if (titleForSave && titleForSave !== this.treeLabelForSelectedProcess) {
                    try {
                        await this.syncSelectedProcessNameToMap(titleForSave);
                    } catch (mapErr) {
                        console.warn('syncSelectedProcessNameToMap failed:', mapErr);
                    }
                }

                // 검토 요청 (PAL/uEngine 제외 — ProcessGPT 승인 플로만)
                if (!window.$pal && window.$mode !== 'uEngine' && this.submitReviewAfterSave) {
                    try {
                        await backend.submitForReview(this.selectedProcessId, this.saveVersionMessage || undefined, version);
                    } catch (reviewErr) {
                        console.warn('submitForReview failed (may already be in review):', reviewErr);
                    }
                }

                this.saveVersionDialog = false;

                if (this.useLock && this.selectedProcessId) {
                    try {
                        await backend.deleteLock(this.selectedProcessId);
                    } catch (lockErr) {
                        console.warn('deleteLock after save:', lockErr);
                    }
                    this.lock = false;
                    this.editUser = '';
                    this.editUserDisplayName = '';
                }

                // 저장 후 definition 목록·맵 갱신; lock 풀렸으므로 현재 프로세스도 다시 조회
                await this.loadProcess(this.selectedProcessId);

                if (this.$toast) {
                    const msg = (window.$pal || !this.submitReviewAfterSave) ? this.$t('successMsg.save') : this.$t('processHierarchy.savedAndSubmitted');
                    this.$toast.success(msg);
                }

                // definitionList 갱신
                await this.loadInitialData();
            } catch (e) {
                console.error('Save failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.saveFailed'));
                }
            } finally {
                this.savingVersion = false;
            }
        },

        handleClone() {
            if (!this.selectedProcessId || !this.processDefinition) return;
            const baseName = this.selectedProcessName || this.$t('processHierarchy.defaultProcessName');
            this.duplicateForm.name = `${baseName} (${this.$t('ProcessMenu.copySuffix') || this.$t('processHierarchy.copySuffix')})`;
            this.duplicateForm.id = this.suggestDuplicateId(this.selectedProcessId);
            this.duplicateDialog = true;
        },
        suggestDuplicateId(sourceId) {
            if (!sourceId) return '_copy';
            return String(sourceId)
                .trim()
                .replace(/\s+/g, '_')
                .replace(/\.bpmn$/i, '') + '_copy';
        },
        async confirmDuplicateProcess() {
            if (!this.selectedProcessId || !this.processDefinition) return;
            const newName = (this.duplicateForm.name || '').trim();
            const desiredId = (this.duplicateForm.id || '').trim().replace(/\s+/g, '_');
            if (!newName) {
                if (this.$toast) {
                    this.$toast.error(this.$t('ProcessMenu.duplicateNameRequired') || '이름을 입력해 주세요.');
                }
                return;
            }
            if (!desiredId) {
                if (this.$toast) {
                    this.$toast.error(this.$t('ProcessMenu.duplicateIdRequired') || 'ID를 입력해 주세요.');
                }
                return;
            }
            if (typeof backend.duplicateLocalProcess !== 'function') {
                if (this.$toast) {
                    this.$toast.error(this.$t('ProcessMenu.duplicateFailed') || '복제를 지원하지 않습니다.');
                }
                return;
            }
            this.duplicateLoading = true;
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                let currentBpmn = this.bpmnXml;
                if (modeler) {
                    const { xml } = await modeler.saveXML({ format: true });
                    currentBpmn = xml;
                }
                if (!currentBpmn || typeof currentBpmn !== 'string') {
                    throw new Error(this.$t('processHierarchy.emptyBpmnForClone') || '복제할 BPMN이 없습니다.');
                }
                const result = await backend.duplicateLocalProcess(
                    this.selectedProcessId,
                    newName,
                    currentBpmn,
                    this.processDefinition,
                    desiredId
                );
                if (result && result.success) {
                    this.duplicateDialog = false;
                    if (this.$toast) {
                        this.$toast.success(this.$t('ProcessMenu.duplicateSuccess'));
                    }
                    await this.loadInitialData();
                    const newId = result.newId;
                    if (newId) {
                        this.treeLabelForSelectedProcess = newName;
                        await this.handleSelectProcess(newId, newName);
                    }
                }
            } catch (e) {
                console.error('Clone failed:', e);
                if (this.$toast) {
                    this.$toast.error(e?.message || this.$t('ProcessMenu.duplicateFailed'));
                }
            } finally {
                this.duplicateLoading = false;
            }
        },

        handleVersionHistory() {
            // Version Comparison 페이지로 이동
            this.$router.push({
                path: '/version-comparison',
                query: { processId: this.selectedProcessId }
            });
        },

        async handleVersionSave(info) {
            this.versionDialog = false;
            await this.handleSave();
        },

        async handlePropertiesSave(data) {
            if (!this.processDefinition) return;
            try {
                if (data.name) this.selectedProcessName = data.name;
                Object.assign(this.processDefinition, data);
                await this.handleSave();
            } catch (e) {
                console.error('Properties save failed:', e);
            }
        },

        async handleToggleWip() {
            if (!this.selectedProcessId) return;
            const supabase = window.$supabase;
            if (!supabase) return;

            // 현재 정의 찾기
            const def = this.definitionList.find((d) => (d.file_name || d.id) === this.selectedProcessId);
            if (!def) return;

            const isCurrentlyWip = def.approval_state === 'wip' || def.status === 'wip';
            const newWipFlag = !isCurrentlyWip;

            try {
                // WIP is a work-in-progress flag stored in proc_def.definition JSONB
                const currentDef = typeof def.definition === 'string' ? JSON.parse(def.definition || '{}') : def.definition || {};
                currentDef.wip = newWipFlag;

                const { error } = await supabase.from('proc_def').update({ definition: currentDef }).eq('id', this.selectedProcessId);

                if (error) throw error;

                // 로컬 definitionList 갱신
                def.definition = currentDef;
                if (newWipFlag) {
                    def.approval_state = 'wip';
                } else {
                    // Restore actual governance state
                    delete def.approval_state;
                }

                if (this.$toast) {
                    const msg = newWipFlag ? this.$t('processHierarchy.wipEnabled') : this.$t('processHierarchy.wipDisabled');
                    this.$toast.success(msg);
                }
            } catch (e) {
                console.error('WIP toggle failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.wipFailed'));
                }
            }
        },

        // Resize handlers
        startResizeLeft(e) {
            this.resizing = 'left';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.leftPanelWidth;
            e.preventDefault();
        },
        startResizeRight(e) {
            this.resizing = 'right';
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.rightPanelWidth;
            e.preventDefault();
        },
        onResize(e) {
            if (!this.resizing) return;
            if (this.resizing === 'left') {
                const diff = e.clientX - this.resizeStartX;
                this.leftPanelWidth = Math.max(200, Math.min(500, this.resizeStartWidth + diff));
            } else if (this.resizing === 'right') {
                const diff = this.resizeStartX - e.clientX;
                this.rightPanelWidth = Math.max(250, Math.min(500, this.resizeStartWidth + diff));
            }
        },
        stopResize() {
            this.resizing = null;
        }
    }
};
</script>

<style scoped>
.process-hierarchy-container {
    display: flex;
    height: calc(100vh - 125px);
    overflow: hidden;
    position: relative;
    background: #fafafa;
}

.hierarchy-left-panel {
    position: relative;
    flex-shrink: 0;
    border-right: 1px solid #e0e0e0;
    overflow: hidden;
}

.hierarchy-center-panel {
    flex: 1;
    min-width: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.hierarchy-right-panel {
    position: relative;
    flex-shrink: 0;
    border-left: 1px solid #e0e0e0;
    overflow-y: auto;
}

.resize-handle-left {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-left:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.resize-handle-right {
    position: absolute;
    top: 0;
    left: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle-right:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.toggle-properties-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
}
</style>

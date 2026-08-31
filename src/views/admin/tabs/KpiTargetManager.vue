<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">KPI 목표</h1>
                </div>
            </div>
        </div>

        <v-card-text class="pa-4 sk-page-card-text">
            <!-- Filter Bar -->
            <v-row class="mb-4" dense align="center">
                <v-col cols="12" sm="auto">
                    <v-select
                        v-model="selectedYear"
                        :items="yearOptions"
                        label="연도"
                        density="compact"
                        variant="outlined"
                        hide-details
                        style="min-width: 120px;"
                        @update:model-value="onYearChange"
                    />
                </v-col>
                <v-col cols="12" sm="auto" style="min-width: 320px;">
                    <v-text-field
                        v-model="searchKeyword"
                        label="검색"
                        placeholder="본부 / 팀 / 프로세스명으로 필터"
                        prepend-inner-icon="mdi-magnify"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                    />
                </v-col>
                <v-spacer />
                <v-col cols="12" sm="auto">
                    <v-btn
                        variant="outlined"
                        prepend-icon="mdi-file-excel-outline"
                        :disabled="filteredKpiTargets.length === 0 || exporting"
                        :loading="exporting"
                        @click="exportToExcel"
                    >
                        Excel 내보내기
                    </v-btn>
                </v-col>
                <v-col v-if="isAdmin && isEditMode" cols="12" sm="auto">
                    <v-btn
                        color="primary"
                        prepend-icon="mdi-plus"
                        @click="openAddDialog"
                    >
                        목표 할당
                    </v-btn>
                </v-col>
                <v-col v-if="isAdmin" cols="12" sm="auto">
                    <v-btn
                        :color="isEditMode ? 'deep-orange' : 'primary'"
                        :variant="isEditMode ? 'flat' : 'outlined'"
                        :prepend-icon="isEditMode ? 'mdi-pencil-off-outline' : 'mdi-pencil-outline'"
                        @click="isEditMode ? exitEditMode() : enterEditMode()"
                    >
                        {{ isEditMode ? '편집 종료' : '편집 모드' }}
                    </v-btn>
                </v-col>
            </v-row>

            <!-- Edit Lock Banner (다른 사용자가 편집 중) -->
            <v-alert
                v-if="editLock.locked && !editLock.isMine"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
                icon="mdi-lock-outline"
            >
                <strong>{{ lockDisplayName || editLock.lockedBy }}</strong> 님이 KPI 목표를 편집 중입니다. 편집이 완료될 때까지 수정할 수
                없습니다.
            </v-alert>

            <!-- Edit Mode Indicator (내가 편집 중) -->
            <v-alert
                v-else-if="isEditMode"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-3"
                icon="mdi-pencil-outline"
                closable
                @click:close="exitEditMode()"
            >
                편집 모드입니다. KPI 목표를 수정할 수 있습니다.
            </v-alert>

            <!-- Error Alert -->
            <v-alert
                v-if="store.error"
                type="error"
                density="compact"
                variant="tonal"
                class="mb-3"
                closable
                @click:close="store.error = ''"
            >
                {{ store.error }}
            </v-alert>

            <!-- Data Table -->
            <v-data-table
                :headers="headers"
                :items="filteredKpiTargets"
                :loading="store.loading"
                no-data-text="KPI 목표가 없습니다."
                density="compact"
                hover
                fixed-header
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                item-value="id"
                class="sk-data-table"
            >
                <template v-slot:[`item.year`]="{ item }">
                    <span class="font-weight-medium">{{ item.year }}</span>
                </template>

                <template v-slot:[`item.org_name`]="{ item }">
                    <v-chip size="small" color="primary" variant="tonal">
                        {{ item.org_name }}
                    </v-chip>
                </template>

                <template v-slot:[`item.target`]="{ item }">
                    {{ item.target }}
                </template>

                <template v-slot:[`item.processes`]="{ item }">
                    <div v-if="item.process_ids && item.process_ids.length > 0" class="d-flex flex-column align-start proc-chip-col">
                        <v-chip
                            v-for="pid in item.process_ids"
                            :key="pid"
                            size="x-small"
                            variant="tonal"
                            color="grey"
                            class="proc-chip"
                            @click.stop="goToProcess(pid)"
                        >
                            {{ procNameMap[pid] || pid }}
                        </v-chip>
                    </div>
                    <span v-else class="cell-muted">-</span>
                </template>

                <template v-slot:[`item.published_count`]="{ item }">
                    {{ item.published_count ?? 0 }}
                </template>

                <template v-slot:[`item.achievement_rate`]="{ item }">
                    <div class="d-flex align-center" style="gap: 8px; min-width: 140px">
                        <v-progress-linear
                            :model-value="Math.min(item.achievement_rate ?? 0, 100)"
                            :color="getRateColor(item.achievement_rate)"
                            height="6"
                            rounded
                            style="flex: 1"
                        />
                        <span
                            class="text-caption font-weight-bold"
                            :class="`text-${getRateColor(item.achievement_rate)}`"
                            style="min-width: 38px; text-align: right"
                        >
                            {{ item.achievement_rate ?? 0 }}%
                        </span>
                    </div>
                </template>

                <template v-slot:[`item.updated_at`]="{ item }">
                    <span class="cell-date">{{ formatDate(item.updated_at) }}</span>
                </template>

                <template v-slot:[`item.actions`]="{ item }">
                    <template v-if="isAdmin && isEditMode">
                        <v-tooltip text="목표 수정" location="top">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-pencil-outline"
                                    size="x-small"
                                    variant="text"
                                    @click="openPickerForEdit(item)"
                                />
                            </template>
                        </v-tooltip>
                        <v-tooltip text="목표 삭제" location="top">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-trash-can-outline"
                                    size="x-small"
                                    variant="text"
                                    color="error"
                                    @click="promptDelete(item)"
                                />
                            </template>
                        </v-tooltip>
                    </template>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Add Target Dialog -->
        <v-dialog v-model="addDialogVisible" width="60%" persistent>
            <v-card class="add-dialog-card">
                <v-card-title class="d-flex align-center">
                    <v-icon color="primary" class="me-2">mdi-target</v-icon>
                    목표 할당
                </v-card-title>
                <v-divider />
                <div class="px-4 pt-4 pb-2">
                    <v-row dense>
                        <v-col cols="12" sm="4">
                            <v-select
                                v-model="newYear"
                                :items="yearOptions"
                                label="연도"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                        <v-col cols="12" sm="8">
                            <v-autocomplete
                                v-model="selectedOrg"
                                v-model:search="orgSearchKeyword"
                                :items="orgSearchItems"
                                :loading="orgSearchLoading"
                                label="조직"
                                placeholder="조직명 검색 (SSO)"
                                no-data-text="검색 결과가 없습니다."
                                item-title="name"
                                item-value="id"
                                return-object
                                hide-no-data
                                hide-details
                                density="compact"
                                variant="outlined"
                                clearable
                                @update:search="onOrgSearchInput"
                                @update:modelValue="onTeamSelected"
                            />
                            <div
                                v-if="selectedOrg && (selectedTeamParentLoading || selectedTeamParentLoaded)"
                                class="text-caption text-medium-emphasis mt-1 px-1"
                            >
                                <span v-if="selectedTeamParentLoading">본부 정보 조회 중…</span>
                                <span v-else-if="selectedTeamParent">본부: {{ selectedTeamParent.name }}</span>
                                <span v-else>본부 없음</span>
                            </div>
                        </v-col>
                    </v-row>
                </div>

                <KpiProcessPicker v-model="pendingProcessIds" :exclude-ids="excludeIdsForNewTarget" class="add-dialog-picker" />

                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="store.loading" @click="closeAddDialog">
                        취소
                    </v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :disabled="
                            !selectedOrg || pendingProcessIds.length === 0 || store.loading
                        "
                        :loading="store.loading"
                        @click="handleAddTarget"
                    >
                        확인
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Process Picker Dialog -->
        <KpiProcessPickerDialog
            v-model="pickerVisible"
            :initial-ids="pickerInitialIds"
            :exclude-ids="excludeIdsForEditTarget"
            @confirm="onPickerConfirm"
        />

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="440" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon color="error" class="me-2">mdi-alert-circle-outline</v-icon>
                    목표 삭제
                </v-card-title>

                <v-card-text>
                    <p class="mb-1">이 KPI 목표를 삭제하시겠습니까?</p>
                    <p class="mb-3 text-caption text-medium-emphasis">
                        삭제된 항목은 휴지통에 30일간 보관되며, 그 안에는 휴지통에서 복원할 수 있습니다.
                    </p>
                    <v-sheet
                        v-if="deleteDialog.item"
                        color="grey-lighten-4"
                        rounded
                        class="pa-3"
                    >
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-caption text-medium-emphasis">조직</span>
                            <span class="text-caption font-weight-medium">
                                {{ deleteDialog.item.org_name }}
                            </span>
                        </div>
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-caption text-medium-emphasis">연도</span>
                            <span class="text-caption font-weight-medium">
                                {{ deleteDialog.item.year }}
                            </span>
                        </div>
                        <div class="d-flex justify-space-between">
                            <span class="text-caption text-medium-emphasis">목표 개수</span>
                            <span class="text-caption font-weight-medium">
                                {{ deleteDialog.item.target }}
                            </span>
                        </div>
                    </v-sheet>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="cancelDelete">취소</v-btn>
                    <v-btn
                        color="error"
                        variant="flat"
                        :loading="store.loading"
                        prepend-icon="mdi-trash-can-outline"
                        @click="confirmDelete"
                    >
                        목표 삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import BackendFactory from '@/components/api/BackendFactory';
import KpiProcessPickerDialog from './KpiProcessPickerDialog.vue';
import KpiProcessPicker from './KpiProcessPicker.vue';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';
import { authClaimsState } from '@/utils/authClaims';

// KPI 목표 편집 동시 점유 방지용 lock 식별자 + 상수
//   체계도(proc_map) 와 동일한 lock 테이블·메커니즘을 공유하되, lock id 만 분리
const KPI_TARGETS_LOCK_ID = 'kpi_targets';
const KPI_LOCK_STALE_MINUTES = 5;
const KPI_LOCK_HEARTBEAT_INTERVAL = 30_000;
const KPI_LOCK_CHECK_INTERVAL = 30_000;

export default defineComponent({
    name: 'KpiTargetManager',
    components: { KpiProcessPickerDialog, KpiProcessPicker },

    setup() {
        const store = useAdminConsoleStore();
        const router = useRouter();

        // -------------------------------------------------------
        // 권한: isAdmin 만 +목표할당/수정/삭제 가능 (adminViewer 는 조회 전용)
        // -------------------------------------------------------
        const isAdmin = computed(() => authClaimsState.isAdmin === true);

        // -------------------------------------------------------
        // Edit lock — 체계도(proc_map) 와 동일한 lock 테이블 기반.
        //   한 명만 편집 가능, 다른 사용자는 조회만 가능. 5분 heartbeat 끊기면 stale 처리.
        //   isAdmin 만 편집 모드 진입 가능 + 편집 모드 일 때만 +목표할당/수정/삭제 노출.
        // -------------------------------------------------------
        const isEditMode = ref(false);
        const editLock = ref({ locked: false, lockedBy: '', isMine: false });
        const lockDisplayName = ref('');
        let kpiLockHeartbeatTimer = null;
        let kpiLockCheckTimer = null;

        function getCurrentUserId() {
            return localStorage.getItem('uid') || (window.$user && window.$user.id) || '';
        }

        async function resolveLockDisplayName(userId) {
            if (!userId) {
                lockDisplayName.value = '';
                return;
            }
            try {
                const supabase = window.$supabase;
                if (!supabase) {
                    lockDisplayName.value = userId;
                    return;
                }
                const { data } = await supabase
                    .from('users')
                    .select('username, email')
                    .eq('id', userId)
                    .eq('tenant_id', window.$tenantName)
                    .maybeSingle();
                lockDisplayName.value = (data && (data.username || data.email)) || userId;
            } catch {
                lockDisplayName.value = userId;
            }
        }

        watch(
            () => editLock.value.lockedBy,
            (val) => {
                if (val && !editLock.value.isMine) resolveLockDisplayName(val);
                else lockDisplayName.value = '';
            }
        );

        async function checkEditLock() {
            try {
                const backend = BackendFactory.createBackend();
                const lock = await backend.getLock(KPI_TARGETS_LOCK_ID);
                if (!lock) {
                    editLock.value = { locked: false, lockedBy: '', isMine: false };
                    return;
                }
                const myId = getCurrentUserId();
                const isMine = lock.user_id === myId;
                if (!isMine) {
                    const heartbeat = lock.heartbeat_at ? new Date(lock.heartbeat_at).getTime() : 0;
                    if (Date.now() - heartbeat > KPI_LOCK_STALE_MINUTES * 60 * 1000) {
                        await backend.deleteLock(KPI_TARGETS_LOCK_ID);
                        editLock.value = { locked: false, lockedBy: '', isMine: false };
                        return;
                    }
                }
                editLock.value = { locked: true, lockedBy: lock.user_id, isMine };
            } catch (e) {
                console.warn('[KpiTargetManager] checkEditLock 실패:', e);
            }
        }

        function startLockHeartbeat() {
            stopLockHeartbeat();
            kpiLockHeartbeatTimer = setInterval(async () => {
                try {
                    const backend = BackendFactory.createBackend();
                    await backend.updateLockHeartbeat(KPI_TARGETS_LOCK_ID);
                } catch {
                    // heartbeat 실패는 무시 (stale 로직이 5분 후 정리)
                }
            }, KPI_LOCK_HEARTBEAT_INTERVAL);
        }

        function stopLockHeartbeat() {
            if (kpiLockHeartbeatTimer) {
                clearInterval(kpiLockHeartbeatTimer);
                kpiLockHeartbeatTimer = null;
            }
        }

        async function acquireEditLock() {
            try {
                const myId = getCurrentUserId();
                if (!myId) return { acquired: false, lockedBy: null };
                const backend = BackendFactory.createBackend();
                const result = await backend.acquireLockWithStaleCheck({ id: KPI_TARGETS_LOCK_ID, user_id: myId }, KPI_LOCK_STALE_MINUTES);
                if (result.acquired) {
                    editLock.value = { locked: true, lockedBy: myId, isMine: true };
                    startLockHeartbeat();
                } else {
                    editLock.value = { locked: true, lockedBy: result.lockedBy || '', isMine: false };
                }
                return result;
            } catch (e) {
                console.warn('[KpiTargetManager] acquireEditLock 실패:', e);
                return { acquired: false, lockedBy: null };
            }
        }

        async function releaseEditLock() {
            stopLockHeartbeat();
            try {
                const backend = BackendFactory.createBackend();
                const lock = await backend.getLock(KPI_TARGETS_LOCK_ID);
                if (lock && lock.user_id === getCurrentUserId()) {
                    await backend.deleteLock(KPI_TARGETS_LOCK_ID);
                }
                editLock.value = { locked: false, lockedBy: '', isMine: false };
            } catch (e) {
                console.warn('[KpiTargetManager] releaseEditLock 실패:', e);
            }
        }

        async function enterEditMode() {
            const result = await acquireEditLock();
            if (result.acquired) {
                isEditMode.value = true;
            } else {
                await checkEditLock();
            }
        }

        async function exitEditMode() {
            isEditMode.value = false;
            await releaseEditLock();
        }

        // -------------------------------------------------------
        // Year selector
        // -------------------------------------------------------
        const currentYear = new Date().getFullYear();
        const yearOptions = computed(() => {
            const years = [];
            for (let y = currentYear - 2; y <= currentYear + 2; y++) {
                years.push(y);
            }
            return years;
        });
        const selectedYear = ref(currentYear);

        // -------------------------------------------------------
        // SSO-linked org search dropdown
        // -------------------------------------------------------
        const selectedOrg = ref(null);
        const orgSearchKeyword = ref('');
        const orgSearchItems = ref([]);
        const orgSearchLoading = ref(false);
        let orgSearchDebounce = null;
        let orgSearchSeq = 0;

        // 조직 선택 시 parent(본부) 단건 조회 상태
        const selectedTeamParent = ref(null); // { id, name } | null
        const selectedTeamParentLoading = ref(false);
        const selectedTeamParentLoaded = ref(false);
        let selectedTeamParentSeq = 0;

        async function fetchOrgSearch(keyword) {
            const trimmed = (keyword || '').trim();
            if (!trimmed) {
                orgSearchItems.value = selectedOrg.value ? [selectedOrg.value] : [];
                return;
            }
            const seq = ++orgSearchSeq;
            orgSearchLoading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.searchGroupsByName(trimmed, 0, 20);
                if (seq !== orgSearchSeq) return;
                const groups = (result && result.groups) || [];
                orgSearchItems.value = groups.map((g) => ({ id: g.id, name: g.name }));
            } catch (e) {
                if (seq !== orgSearchSeq) return;
                orgSearchItems.value = [];
            } finally {
                if (seq === orgSearchSeq) orgSearchLoading.value = false;
            }
        }

        function onOrgSearchInput(keyword) {
            orgSearchKeyword.value = keyword || '';
            if (orgSearchDebounce) clearTimeout(orgSearchDebounce);
            orgSearchDebounce = setTimeout(() => fetchOrgSearch(keyword), 250);
        }

        async function fetchTeamParent(teamId) {
            const trimmed = String(teamId || '').trim();
            if (!trimmed) {
                selectedTeamParent.value = null;
                selectedTeamParentLoaded.value = false;
                return;
            }
            const seq = ++selectedTeamParentSeq;
            selectedTeamParentLoading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const detail = await backend.getGroupById(trimmed);
                if (seq !== selectedTeamParentSeq) return;
                selectedTeamParent.value = detail?.parent
                    ? { id: String(detail.parent.id || '').trim(), name: String(detail.parent.name || '') }
                    : null;
                selectedTeamParentLoaded.value = true;
            } catch (e) {
                if (seq !== selectedTeamParentSeq) return;
                console.warn('[KpiTargetManager] 조직 parent 조회 실패:', e);
                selectedTeamParent.value = null;
                selectedTeamParentLoaded.value = false;
            } finally {
                if (seq === selectedTeamParentSeq) selectedTeamParentLoading.value = false;
            }
        }

        function onTeamSelected(newTeam) {
            const nextId = String(newTeam?.id || '').trim();
            if (!nextId) {
                selectedTeamParent.value = null;
                selectedTeamParentLoading.value = false;
                selectedTeamParentLoaded.value = false;
                return;
            }
            fetchTeamParent(nextId);
        }

        // -------------------------------------------------------
        // Process picker state (행 편집용 다이얼로그)
        // -------------------------------------------------------
        const pendingProcessIds = ref([]);
        const pickerVisible = ref(false);
        const pickerInitialIds = ref([]);
        const pickerEditTarget = ref(null);

        // 모든 KPI 목표에 이미 할당된 sub-process id 집합 — picker 에서 중복 할당 방지용
        const allAssignedProcessIds = computed(() => {
            const set = new Set();
            for (const target of (store.kpiTargets || [])) {
                for (const pid of target.process_ids || []) {
                    if (pid) set.add(String(pid));
                }
            }
            return set;
        });

        // 신규 등록 dialog: 모든 할당분 숨김
        const excludeIdsForNewTarget = computed(() => [...allAssignedProcessIds.value]);

        // 수정 dialog: 자신(pickerEditTarget)의 process_ids 는 제외 안 함 (선택 유지/해제 가능해야 함)
        const excludeIdsForEditTarget = computed(() => {
            const editingTarget = pickerEditTarget.value;
            if (!editingTarget) return [...allAssignedProcessIds.value];
            const ownIds = new Set((editingTarget.process_ids || []).map((id) => String(id || '')));
            return [...allAssignedProcessIds.value].filter((id) => !ownIds.has(id));
        });

        // -------------------------------------------------------
        // Add target dialog
        // -------------------------------------------------------
        const addDialogVisible = ref(false);
        const newYear = ref(currentYear);

        // -------------------------------------------------------
        // 통합 검색 필터 — 본부(parent.name) / 팀(org_name) / 프로세스명(process_ids → procNameMap)
        //   3개 필드 중 어느 하나라도 키워드 포함하면 매칭 (OR 조건)
        // -------------------------------------------------------
        const searchKeyword = ref('');
        const filteredKpiTargets = computed(() => {
            const kw = (searchKeyword.value || '').trim().toLowerCase();
            if (!kw) return store.kpiTargets;
            return store.kpiTargets.filter((t) => {
                const division = (t.parent?.name || '').toLowerCase();
                if (division.includes(kw)) return true;
                const team = (t.org_name || '').toLowerCase();
                if (team.includes(kw)) return true;
                const procNames = (t.process_ids || []).some((pid) => {
                    const name = (procNameMap.value[pid] || '').toLowerCase();
                    return name.includes(kw);
                });
                return procNames;
            });
        });

        // -------------------------------------------------------
        // procMap → proc_def_id ↔ name 룩업 + 라우팅
        // -------------------------------------------------------
        const procMap = ref(null);
        const procNameMap = computed(() => {
            const map = {};
            const list = procMap.value?.mega_proc_list || [];
            for (const mega of list) {
                for (const major of mega?.major_proc_list || []) {
                    for (const sub of major?.sub_proc_list || []) {
                        const id = sub?.id == null ? '' : String(sub.id).trim();
                        if (!id) continue;
                        map[id] = sub?.name == null ? id : String(sub.name).trim() || id;
                    }
                }
            }
            return map;
        });

        async function loadProcMap() {
            try {
                const cached = window.$procMap;
                if (cached?.mega_proc_list) {
                    procMap.value = cached;
                    return;
                }
                const backend = BackendFactory.createBackend();
                const result = await backend.getProcessDefinitionMap();
                procMap.value = result?.value || result || null;
            } catch (e) {
                console.error('[KpiTargetManager] loadProcMap error:', e);
            }
        }

        function goToProcess(procDefId) {
            if (!procDefId) return;
            navigateToProcessHierarchy(
                router,
                {
                    id: procDefId,
                    name: procNameMap.value[procDefId] || procDefId,
                    entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE
                },
                { openInNewTab: true }
            );
        }

        // -------------------------------------------------------
        // Delete dialog state
        // -------------------------------------------------------
        const deleteDialog = ref({
            visible: false,
            item: null
        });

        // -------------------------------------------------------
        // Data table headers
        // -------------------------------------------------------
        const headers = computed(() => [
            { title: '연도', key: 'year', align: 'start' },
            { title: '조직', key: 'org_name', align: 'start' },
            { title: '목표 개수', key: 'target', align: 'end' },
            { title: '선택된 프로세스', key: 'processes', align: 'start', sortable: false },
            { title: 'Published 수', key: 'published_count', align: 'end' },
            { title: '달성률', key: 'achievement_rate', align: 'start', sortable: false },
            { title: '최종 수정일', key: 'updated_at', align: 'center' },
            { title: '', key: 'actions', align: 'end', sortable: false }
        ]);

        // -------------------------------------------------------
        // Lifecycle
        // -------------------------------------------------------
        onMounted(async () => {
            store.fetchKpiTargets(selectedYear.value);
            loadProcMap();
            // 진입 시 lock 상태 확인 + 주기적 체크 (점유 변화 UI 반영용)
            await checkEditLock();
            kpiLockCheckTimer = setInterval(() => checkEditLock(), KPI_LOCK_CHECK_INTERVAL);
        });

        onUnmounted(() => {
            // 편집 중인 채로 페이지를 떠나면 lock 해제
            if (isEditMode.value) {
                releaseEditLock();
                isEditMode.value = false;
            }
            if (kpiLockCheckTimer) {
                clearInterval(kpiLockCheckTimer);
                kpiLockCheckTimer = null;
            }
        });

        // -------------------------------------------------------
        // Handlers
        // -------------------------------------------------------
        function onYearChange() {
            store.fetchKpiTargets(selectedYear.value);
        }

        function openAddDialog() {
            newYear.value = selectedYear.value;
            selectedOrg.value = null;
            orgSearchKeyword.value = '';
            orgSearchItems.value = [];
            pendingProcessIds.value = [];
            selectedTeamParent.value = null;
            selectedTeamParentLoading.value = false;
            selectedTeamParentLoaded.value = false;
            addDialogVisible.value = true;
        }

        function closeAddDialog() {
            addDialogVisible.value = false;
            selectedOrg.value = null;
            orgSearchKeyword.value = '';
            orgSearchItems.value = [];
            pendingProcessIds.value = [];
            selectedTeamParent.value = null;
            selectedTeamParentLoading.value = false;
            selectedTeamParentLoaded.value = false;
        }

        async function handleAddTarget() {
            if (!selectedOrg.value || pendingProcessIds.value.length === 0) return;
            try {
                const payload = {
                    year: newYear.value,
                    org_id: selectedOrg.value.id,
                    org_name: selectedOrg.value.name,
                    process_ids: pendingProcessIds.value,
                    target: pendingProcessIds.value.length
                };
                // parent 조회 완료 시점에만 키 포함 (loaded=false 면 backend 기존값 유지)
                if (selectedTeamParentLoaded.value) {
                    payload.parent = selectedTeamParent.value
                        ? { id: selectedTeamParent.value.id, name: selectedTeamParent.value.name }
                        : null;
                }
                await store.saveKpiTarget(payload);
                // 저장된 연도가 현재 필터와 다르면 필터를 그쪽으로 옮긴다
                if (newYear.value !== selectedYear.value) {
                    selectedYear.value = newYear.value;
                    await store.fetchKpiTargets(selectedYear.value);
                }
                closeAddDialog();
            } catch (e) {
                // store.error 로 표시됨
            }
        }

        // -------------------------------------------------------
        // Row edit picker handlers
        // -------------------------------------------------------
        function openPickerForEdit(item) {
            pickerEditTarget.value = item;
            pickerInitialIds.value = Array.isArray(item.process_ids) ? [...item.process_ids] : [];
            pickerVisible.value = true;
        }

        async function onPickerConfirm(ids) {
            const item = pickerEditTarget.value;
            if (!item) return;
            try {
                const payload = {
                    ...item,
                    process_ids: ids,
                    target: ids.length
                };
                // legacy row (parent 키 자체 없음) — 단건조회로 본부 보강해서 함께 저장
                //   → 사용자가 그냥 "확인" 만 눌러도 자동 마이그레이션됨
                if (!('parent' in item) && item.org_id) {
                    try {
                        const backend = BackendFactory.createBackend();
                        const detail = await backend.getGroupById(item.org_id);
                        payload.parent = detail?.parent
                            ? { id: String(detail.parent.id || '').trim(), name: String(detail.parent.name || '') }
                            : null;
                    } catch (e) {
                        console.warn('[KpiTargetManager] legacy parent 보강 실패, parent 키 생략하고 저장:', e);
                    }
                }
                await store.saveKpiTarget(payload);
            } catch (e) {
                // store.error
            } finally {
                pickerEditTarget.value = null;
            }
        }

        function promptDelete(item) {
            deleteDialog.value = { visible: true, item };
        }

        function cancelDelete() {
            deleteDialog.value = { visible: false, item: null };
        }

        async function confirmDelete() {
            const item = deleteDialog.value.item;
            if (!item || !item.id) return;
            try {
                await store.deleteKpiTarget(item.id);
            } catch (e) {
                // store.error
            } finally {
                deleteDialog.value = { visible: false, item: null };
            }
        }

        // -------------------------------------------------------
        // Helpers
        // -------------------------------------------------------
        function getRateColor(rate) {
            const r = rate ?? 0;
            if (r >= 80) return 'success';
            if (r >= 50) return 'warning';
            return 'error';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
            } catch {
                return '-';
            }
        }

        // -------------------------------------------------------
        // Excel export — 표 화면에 보이는 (필터 적용된) 데이터를 그대로 xlsx 로 저장
        // -------------------------------------------------------
        const exporting = ref(false);

        function formatDateForExport(dateStr) {
            if (!dateStr) return '';
            try {
                const d = new Date(dateStr);
                if (Number.isNaN(d.getTime())) return '';
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            } catch {
                return '';
            }
        }

        async function exportToExcel() {
            if (filteredKpiTargets.value.length === 0) return;
            exporting.value = true;
            try {
                const ExcelJS = await import('exceljs').catch(() => null);
                if (!ExcelJS) {
                    alert('exceljs 패키지가 설치되어 있지 않습니다.');
                    return;
                }

                const headers = ['연도', '본부', '팀', '목표 개수', '선택된 프로세스', 'Published 수', '달성률(%)', '최종 수정일'];
                const rows = filteredKpiTargets.value.map((item) => {
                    const procNames = (item.process_ids || []).map((pid) => procNameMap.value[pid] || pid).join(', ');
                    return [
                        item.year ?? '',
                        item.parent?.name || '',
                        item.org_name || '',
                        item.target ?? 0,
                        procNames,
                        item.published_count ?? 0,
                        item.achievement_rate ?? 0,
                        formatDateForExport(item.updated_at)
                    ];
                });

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('KPI 목표');
                worksheet.addRows([headers, ...rows]);
                // 컬럼 폭 (헤더와 동일 순서)
                worksheet.columns = [8, 20, 24, 12, 60, 14, 12, 14].map((width) => ({ width }));

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                const url = URL.createObjectURL(blob);
                const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const fileName = `kpi-targets-${selectedYear.value}-${ts}.xlsx`;
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error('[KpiTargetManager] Excel 내보내기 실패:', e);
                store.error = `Excel 내보내기 실패: ${e?.message || e}`;
            } finally {
                exporting.value = false;
            }
        }

        return {
            store,
            isAdmin,
            isEditMode,
            editLock,
            lockDisplayName,
            enterEditMode,
            exitEditMode,
            yearOptions,
            selectedYear,
            selectedOrg,
            orgSearchKeyword,
            orgSearchItems,
            orgSearchLoading,
            selectedTeamParent,
            selectedTeamParentLoading,
            selectedTeamParentLoaded,
            onOrgSearchInput,
            onTeamSelected,
            pendingProcessIds,
            pickerVisible,
            pickerInitialIds,
            excludeIdsForNewTarget,
            excludeIdsForEditTarget,
            addDialogVisible,
            newYear,
            searchKeyword,
            filteredKpiTargets,
            procNameMap,
            goToProcess,
            deleteDialog,
            headers,
            onYearChange,
            handleAddTarget,
            openAddDialog,
            closeAddDialog,
            openPickerForEdit,
            onPickerConfirm,
            promptDelete,
            cancelDelete,
            confirmDelete,
            getRateColor,
            formatDate,
            exporting,
            exportToExcel
        };
    }
});
</script>

<style scoped>
.proc-chip {
    cursor: pointer;
}

.proc-chip-col {
    gap: 4px;
}

.proc-chip-col .proc-chip {
    align-self: flex-start;
}

.add-dialog-card {
    height: 80vh;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.add-dialog-picker {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}
</style>

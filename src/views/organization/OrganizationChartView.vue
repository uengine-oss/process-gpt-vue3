<template>
    <v-card elevation="10" class="rounded-xl sk-page-card org-page">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">조직도</h1>
                <p class="page-subtitle">부서 {{ teamCount }} · 구성원 {{ assignedCount }} · 미배치 {{ unassignedUsers.length }}</p>
            </div>
            <div class="page-header-right">
                <div class="org-status">
                    <template v-if="!editable">
                        <v-icon size="14">mdi-eye-outline</v-icon>
                        <span>{{ canManageRoles ? '권한만 편집 가능' : '읽기 전용' }}</span>
                    </template>
                    <template v-else-if="saving">
                        <v-progress-circular indeterminate size="12" width="2" />
                        <span>저장 중</span>
                    </template>
                    <template v-else-if="saveError">
                        <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
                        <span class="text-error">저장 실패</span>
                    </template>
                    <template v-else-if="lastSavedLabel">
                        <v-icon size="14" color="success">mdi-check-circle-outline</v-icon>
                        <span>{{ lastSavedLabel }}</span>
                    </template>
                </div>
            </div>
        </div>

        <!-- ───────────── 툴바 ───────────── -->
        <header class="org-toolbar">
            <div class="org-toolbar__search">
                <v-text-field
                    v-model="searchQuery"
                    placeholder="부서 · 이름 · 이메일 검색"
                    variant="solo-filled"
                    flat
                    density="compact"
                    hide-details
                    rounded="pill"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                />
                <span v-if="searchQuery && matchedIds.size" class="org-toolbar__hits">{{ matchedIds.size }}건</span>
            </div>

            <div class="org-toolbar__actions">
                <v-btn
                    v-if="editable"
                    size="small"
                    color="primary"
                    variant="flat"
                    class="text-none"
                    prepend-icon="mdi-plus"
                    @click="openAddTeam(root)"
                >
                    부서 추가
                </v-btn>

                <v-btn
                    v-if="canManageRoles"
                    size="small"
                    variant="tonal"
                    class="text-none"
                    prepend-icon="mdi-account-clock-outline"
                    @click="openPreRegister"
                >
                    구성원 사전등록
                </v-btn>

                <v-divider vertical class="mx-1" />

                <v-btn icon size="small" variant="text" title="모두 펼치기" @click="expandAll">
                    <v-icon size="19">mdi-arrow-expand-vertical</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" title="모두 접기" @click="collapseAll">
                    <v-icon size="19">mdi-arrow-collapse-vertical</v-icon>
                </v-btn>
                <v-btn
                    icon
                    size="small"
                    variant="text"
                    :title="showMembers ? '구성원 숨기기' : '구성원 표시'"
                    :color="showMembers ? 'primary' : undefined"
                    @click="showMembers = !showMembers"
                >
                    <v-icon size="19">mdi-account-multiple-outline</v-icon>
                </v-btn>

                <v-divider vertical class="mx-1" />

                <v-btn icon size="small" variant="text" title="축소" @click="zoomBy(-0.1)">
                    <v-icon size="19">mdi-magnify-minus-outline</v-icon>
                </v-btn>
                <button class="org-zoom" title="100%로 초기화" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</button>
                <v-btn icon size="small" variant="text" title="확대" @click="zoomBy(0.1)">
                    <v-icon size="19">mdi-magnify-plus-outline</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" title="화면에 맞추기" @click="fitToScreen">
                    <v-icon size="19">mdi-fit-to-screen-outline</v-icon>
                </v-btn>

                <v-divider vertical class="mx-1" />

                <v-btn
                    icon
                    size="small"
                    variant="text"
                    :title="panelOpen ? '패널 닫기' : '패널 열기'"
                    :color="panelOpen ? 'primary' : undefined"
                    @click="panelOpen = !panelOpen"
                >
                    <v-icon size="19">mdi-dock-right</v-icon>
                </v-btn>
            </div>
        </header>

        <!-- ───────────── 본문 ───────────── -->
        <div class="org-body">
            <div class="org-main">
                <section
                    ref="canvasRef"
                    class="org-canvas"
                    :class="{ 'org-canvas--panning': panning }"
                    @mousedown="startPan"
                    @wheel="onWheel"
                    @click="clearSelection"
                    @dragover.prevent
                    @drop.prevent="onCanvasDrop"
                >
                    <div v-if="loading" class="org-canvas__state">
                        <v-progress-circular indeterminate size="28" width="3" color="primary" />
                        <p>조직도를 불러오는 중…</p>
                    </div>

                    <div v-else-if="!hasTeams" class="org-canvas__state">
                        <v-icon size="42" color="primary">mdi-sitemap-outline</v-icon>
                        <p>아직 등록된 부서가 없습니다.</p>
                        <v-btn
                            v-if="editable"
                            color="primary"
                            variant="flat"
                            class="text-none"
                            prepend-icon="mdi-plus"
                            @click="openAddTeam(root)"
                        >
                            첫 부서 만들기
                        </v-btn>
                    </div>

                    <div v-else class="org-stage" :style="{ transform: `scale(${zoom})` }">
                        <ul class="org-tree">
                            <OrgTreeNode
                                :node="root"
                                :depth="0"
                                :selected-id="selectedId"
                                :expanded-ids="expandedIds"
                                :matched-ids="matchedIds"
                                :searching="isSearching"
                                :show-members="showMembers"
                                :editable="editable"
                                :drop-target-id="dropTargetId"
                                @action="handleNodeAction"
                            />
                        </ul>
                    </div>
                </section>

                <!-- 미배치 인원 (캔버스 아래 고정 — 조직도를 가리지 않는다) -->
                <div v-if="!loading && unassignedUsers.length" class="org-unassigned" :class="{ 'org-unassigned--open': unassignedOpen }">
                    <button class="org-unassigned__head" @click.stop="unassignedOpen = !unassignedOpen">
                        <v-icon size="16" color="warning">mdi-account-question-outline</v-icon>
                        <span>미배치 인원 {{ unassignedUsers.length }}명</span>
                        <v-icon size="16">{{ unassignedOpen ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
                    </button>
                    <div v-if="unassignedOpen" class="org-unassigned__list">
                        <div
                            v-for="user in unassignedUsers"
                            :key="user.id"
                            class="org-unassigned__chip"
                            :draggable="editable"
                            :title="editable ? '부서 카드로 끌어다 놓으면 배치됩니다' : user.email"
                            @dragstart="onUnassignedDragStart($event, user)"
                            @dragend="resetDrag"
                        >
                            <v-avatar size="18">
                                <v-img v-if="user.profile && user.profile !== '/images/defaultUser.png'" :src="user.profile" cover />
                                <v-icon v-else size="12">{{ user.is_agent ? 'mdi-robot-outline' : 'mdi-account' }}</v-icon>
                            </v-avatar>
                            <span>{{ user.username || user.email || user.id }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <transition name="org-panel-slide">
                <OrgDetailPanel
                    v-if="panelOpen"
                    ref="panelRef"
                    class="org-body__panel"
                    :root="root"
                    :team="selectedTeam"
                    :selected-id="selectedId"
                    :users="users"
                    :editable="editable"
                    :can-manage-roles="canManageRoles"
                    :current-user-id="currentUserId"
                    @update-team="onUpdateTeam"
                    @add-team="openAddTeam"
                    @remove-team="confirmRemoveTeam"
                    @move-team="onMoveTeam"
                    @add-members="onAddMembers"
                    @remove-member="onRemoveMember"
                    @move-member="onMoveMember"
                    @set-leader="onSetLeader"
                    @update-role="onUpdateRole"
                    @update-roles="onUpdateRoles"
                    @select-member="onSelectMemberFromPanel"
                    @create-agent="openAgentDialog"
                    @show-agent="openAgentDetail"
                    @edit-agent="(member) => openAgentEdit(member, 'edit-agent')"
                    @delete-agent="(member) => openAgentEdit(member, 'delete')"
                />
            </transition>
        </div>

        <!-- ───────────── 부서 추가 ───────────── -->
        <v-dialog v-model="addTeamDialog" max-width="420">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">부서 추가</v-card-title>
                <p class="org-dialog__hint">{{ addTeamParentLabel }} 아래에 새 부서를 만듭니다.</p>
                <v-card-text class="pa-0 pt-3">
                    <v-text-field
                        v-model="newTeamName"
                        label="부서명"
                        variant="outlined"
                        density="compact"
                        autofocus
                        hide-details="auto"
                        :error-messages="addTeamError"
                        @keyup.enter="commitAddTeam"
                    />
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="addTeamDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        class="text-none"
                        :disabled="!newTeamName.trim() || !!addTeamError"
                        @click="commitAddTeam"
                    >
                        추가
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="preRegisterDialog" max-width="460">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">구성원 사전등록</v-card-title>
                <p class="org-dialog__hint">가입할 이메일과 배치를 미리 지정합니다. 가입 즉시 자동 적용됩니다.</p>
                <v-card-text class="pa-0 pt-3 d-flex flex-column ga-3">
                    <v-text-field
                        v-model="preRegister.email"
                        label="이메일"
                        type="email"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                    />
                    <v-select
                        v-model="preRegister.teamId"
                        :items="teamOptions"
                        item-title="name"
                        item-value="id"
                        label="부서"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                    <v-select
                        v-model="preRegister.role"
                        :items="preRegisterRoleItems"
                        item-title="title"
                        item-value="value"
                        label="권한"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="preRegisterDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        class="text-none"
                        :loading="preRegisterSaving"
                        :disabled="!validPreRegister"
                        @click="commitPreRegister"
                        >등록</v-btn
                    >
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── 부서 삭제 ───────────── -->
        <v-dialog v-model="removeTeamDialog" max-width="440">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">부서 삭제</v-card-title>
                <v-card-text class="pa-0 pt-3">
                    <p class="mb-2">
                        <strong>{{ removeTeamTarget ? nodeName(removeTeamTarget) : '' }}</strong> 부서를 삭제합니다.
                    </p>
                    <p class="org-dialog__hint">
                        하위 부서 {{ removeTeamStats.teams }}개와 구성원 배치 {{ removeTeamStats.members }}건이 함께 조직도에서 제거됩니다.
                        사용자 계정 자체는 삭제되지 않으며 미배치 인원으로 남습니다.
                    </p>
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="removeTeamDialog = false">취소</v-btn>
                    <v-btn color="error" variant="flat" class="text-none" @click="commitRemoveTeam">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── 에이전트 상세 ───────────── -->
        <AgentBadgesDiagram
            :show="!!agentDetail"
            :agentData="agentDetail"
            @close="agentDetail = null"
            @openEditDialog="(data) => openAgentEdit({ id: data?.id }, 'edit-agent')"
        />

        <!-- ───────────── 에이전트 수정 / 삭제 ───────────── -->
        <v-dialog v-model="agentEditDialog" :max-width="isMobile ? '100vw' : 560" :fullscreen="isMobile">
            <OrganizationEditDialog
                v-if="agentEditNode"
                :dialogType="agentEditType"
                :editNode="agentEditNode"
                @updateNode="onAgentDialogSubmit"
                @deleteAgent="() => {}"
                @closeDialog="closeAgentEdit"
            />
        </v-dialog>

        <!-- ───────────── 에이전트 생성 ───────────── -->
        <v-dialog v-model="agentDialog" max-width="720" :fullscreen="isMobile">
            <AgentCreateDialog :teams="teamOptions" @assignToTeam="onAgentAssigned" @closeDialog="agentDialog = false" />
        </v-dialog>
    </v-card>
</template>

<script>
export default { name: 'OrganizationChartView' };
</script>

<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import AgentBadgesDiagram from '@/components/ui/AgentBadgesDiagram.vue';
import AgentCreateDialog from '@/components/ui/AgentCreateDialog.vue';
import OrganizationEditDialog from '@/components/ui/OrganizationEditDialog.vue';
import OrgDetailPanel from './OrgDetailPanel.vue';
import OrgTreeNode from './OrgTreeNode.vue';
import { hasRoleAtLeast, isAdminRole, ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
import {
    ROOT_ID,
    assignedMemberIds,
    attachNode,
    collectMembers,
    collectTeams,
    createMemberNode,
    createRoot,
    createTeam,
    displayName,
    findNode,
    findParent,
    isDuplicateTeamName,
    isTeam,
    moveNode,
    normalizeTree,
    removeMemberFromTeam,
    removeNodeEverywhere,
    serializeTree,
    teamsOfMember,
    walk
} from './orgChartModel';

const backend = BackendFactory.createBackend();
const instance = getCurrentInstance();
const eventBus = instance?.appContext.config.globalProperties.EventBus;

/* ── 상태 ───────────────────────────────────────────── */

const root = ref(createRoot(window.$tenantName || '조직'));
const configUuid = ref(null);
const users = ref([]);
const registeredUsers = ref([]);
const pendingMembers = ref([]);
const loading = ref(true);
const saving = ref(false);
const saveError = ref(false);
const lastSavedAt = ref(null);

const expandedIds = reactive(new Set([ROOT_ID]));
const matchedIds = reactive(new Set());
const selectedId = ref(ROOT_ID);
const selectedTeamId = ref(ROOT_ID);
const searchQuery = ref('');
const showMembers = ref(true);
const panelOpen = ref(true);
const unassignedOpen = ref(true);
const zoom = ref(1);

const canvasRef = ref(null);
const panelRef = ref(null);
const panning = ref(false);
const dropTargetId = ref(null);
const dragPayload = ref(null);

const addTeamDialog = ref(false);
const addTeamParent = ref(null);
const newTeamName = ref('');
const removeTeamDialog = ref(false);
const removeTeamTarget = ref(null);
const agentDialog = ref(false);
const agentTargetTeamId = ref(null);
const agentDetail = ref(null);
const agentEditDialog = ref(false);
const agentEditNode = ref(null);
const agentEditType = ref('edit-agent');
const preRegisterDialog = ref(false);
const preRegisterSaving = ref(false);
const preRegister = ref({ email: '', teamId: '', role: 'viewer' });

const isMobile = ref(window.innerWidth <= 768);

/* ── 권한 ───────────────────────────────────────────── */

const currentUserId = computed(() => localStorage.getItem('uid') || '');
const currentRole = computed(() => localStorage.getItem('role') || '');
const isAdminFlag = computed(() => localStorage.getItem('isAdmin') === 'true');

/** 조직 구조(부서·배치) 편집 — owner 이상 */
const editable = computed(() => isAdminRole(currentRole.value) || hasRoleAtLeast(currentRole.value, 'owner') || isAdminFlag.value);
/** 사용자 역할 변경 — admin 이상 (ManageAccessTab 과 동일 기준) */
const canManageRoles = computed(() => isAdminRole(currentRole.value) || hasRoleAtLeast(currentRole.value, 'admin') || isAdminFlag.value);

/* ── 파생 ───────────────────────────────────────────── */

const hasTeams = computed(() => (root.value?.children || []).length > 0);
const teamCount = computed(() => collectTeams(root.value, false).length);
const assignedCount = computed(() => assignedMemberIds(root.value).size);
const teamOptions = computed(() => collectTeams(root.value, false).map((entry) => ({ id: entry.node.id, name: entry.path })));
const preRegisterRoleItems = computed(() => ROLE_HIERARCHY.map((role) => ({ value: role, title: ROLE_META[role]?.label || role })));
const validPreRegister = computed(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preRegister.value.email.trim()) && !!preRegister.value.teamId && !!preRegister.value.role
);

const selectedTeam = computed(() => findNode(root.value, selectedTeamId.value) || root.value);

const unassignedUsers = computed(() => {
    const assigned = assignedMemberIds(root.value);
    return users.value.filter((user) => !assigned.has(user.id));
});

const isSearching = computed(() => !!(searchQuery.value || '').trim());

const addTeamParentLabel = computed(() => (addTeamParent.value ? nodeName(addTeamParent.value) : ''));

/** 부서 추가 입력값 검증 — 입력 즉시 중복 여부를 알려준다 */
const addTeamError = computed(() => {
    const name = newTeamName.value.trim();
    if (!name) return '';
    return isDuplicateTeamName(root.value, name) ? '이미 같은 이름의 부서가 있습니다.' : '';
});

const removeTeamStats = computed(() => {
    const target = removeTeamTarget.value;
    if (!target) return { teams: 0, members: 0 };
    let teams = 0;
    let members = 0;
    walk(target, (node) => {
        if (node === target) return;
        if (isTeam(node)) teams += 1;
        else members += 1;
    });
    return { teams, members };
});

const lastSavedLabel = computed(() => {
    if (!lastSavedAt.value) return '';
    const time = new Date(lastSavedAt.value);
    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')} 저장됨`;
});

function nodeName(node) {
    return displayName(node);
}

/* ── 알림 ───────────────────────────────────────────── */

function toast(message, color = 'success') {
    const app = window.$app_;
    if (!app) return;
    app.snackbarMessage = message;
    app.snackbarColor = color;
    app.snackbar = true;
    app.snackbarSuccessStatus = color === 'success';
    app.clickCount = 0;
}

/* ── 로드 / 저장 ────────────────────────────────────── */

async function loadUsers() {
    try {
        const list = await backend.getUserList({
            orderBy: 'username',
            sort: 'asc',
            match: { tenant_id: window.$tenantName }
        });
        registeredUsers.value = (list || []).filter((user) => user && user.id && user.is_draft !== true);
    } catch (error) {
        console.error('[OrganizationChart] 사용자 목록 로드 실패:', error);
        registeredUsers.value = [];
    }
    mergeUsers();
}

function mergeUsers() {
    users.value = [...registeredUsers.value, ...pendingMembers.value];
}

async function loadPendingMembers() {
    try {
        const { data, error } = await window.$supabase
            .from('pending_org_members')
            .select('id,email,role,team_id,created_at')
            .eq('tenant_id', window.$tenantName);
        if (error) throw error;
        pendingMembers.value = (data || []).map((member) => ({
            ...member,
            username: member.email,
            pending: true,
            is_agent: false,
            department_id: member.team_id
        }));
    } catch (error) {
        console.error('[OrganizationChart] 사전등록 목록 로드 실패:', error);
        pendingMembers.value = [];
    }
    mergeUsers();
}

async function loadChart() {
    try {
        const data = await backend.getData('configuration', { match: { key: 'organization' } });
        if (data) {
            configUuid.value = data.uuid || null;
            root.value = normalizeTree(data.value?.chart, window.$tenantName || '조직');
        } else {
            root.value = createRoot(window.$tenantName || '조직');
        }
    } catch (error) {
        console.error('[OrganizationChart] 조직도 로드 실패:', error);
        root.value = createRoot(window.$tenantName || '조직');
    }
    expandAll();
}

let saveTimer = null;
function scheduleSave() {
    if (!editable.value) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
}

async function persist() {
    if (!editable.value) return;
    saving.value = true;
    saveError.value = false;
    try {
        const putObj = { key: 'organization', value: { chart: serializeTree(root.value) } };
        if (configUuid.value) putObj.uuid = configUuid.value;
        await backend.putObject('configuration', putObj, { onConflict: 'key,tenant_id' });
        lastSavedAt.value = Date.now();
        return true;
    } catch (error) {
        console.error('[OrganizationChart] 저장 실패:', error);
        saveError.value = true;
        toast('조직도 저장에 실패했습니다.', 'error');
        return false;
    } finally {
        saving.value = false;
    }
}

/** users 테이블의 부서 정보를 조직도와 동기화 */
async function syncUserDepartments(userIds) {
    const targets = (userIds || []).filter(Boolean);
    if (!targets.length) return;
    await Promise.all(
        targets.map(async (userId) => {
            const user = users.value.find((candidate) => candidate.id === userId);
            if (user?.is_agent) return;
            const teams = teamsOfMember(root.value, userId).filter((team) => team.id !== ROOT_ID);
            const team = teams[0] || null;
            try {
                if (user?.pending) {
                    if (team) {
                        const { error } = await window.$supabase.from('pending_org_members').update({ team_id: team.id }).eq('id', userId);
                        if (error) throw error;
                        user.team_id = team.id;
                    }
                    return;
                }
                await backend.updateUserInfo({
                    type: 'update',
                    user: {
                        id: userId,
                        department_id: team ? team.id : null,
                        department_name: team ? displayName(team) : null
                    }
                });
                if (user) {
                    user.department_id = team ? team.id : null;
                    user.department_name = team ? displayName(team) : null;
                }
            } catch (error) {
                console.error('[OrganizationChart] 부서 동기화 실패:', userId, error);
            }
        })
    );
}

/* ── 검색 ───────────────────────────────────────────── */

function recomputeMatches() {
    matchedIds.clear();
    const query = (searchQuery.value || '').trim().toLowerCase();
    if (!query) return;

    const userById = new Map(users.value.map((user) => [user.id, user]));
    const hits = [];

    walk(root.value, (node) => {
        const user = userById.get(node.id);
        const haystack = [displayName(node), node.data?.email, user?.username, user?.email, node.data?.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        if (haystack.includes(query)) hits.push(node.id);
    });

    for (const id of hits) {
        matchedIds.add(id);
        // 매칭된 노드가 보이도록 상위 부서를 펼친다
        let parent = findParent(root.value, id);
        while (parent) {
            expandedIds.add(parent.id);
            parent = findParent(root.value, parent.id);
        }
    }
}

watch(searchQuery, () => recomputeMatches());
watch(users, () => recomputeMatches());

/* ── 트리 조작 ──────────────────────────────────────── */

function expandAll() {
    walk(root.value, (node) => {
        if (isTeam(node)) expandedIds.add(node.id);
    });
}
function collapseAll() {
    expandedIds.clear();
}

function selectTeam(node) {
    selectedId.value = node.id;
    selectedTeamId.value = node.id;
}

function clearSelection(event) {
    if (event?.target?.closest?.('.org-node') || event?.target?.closest?.('.org-unassigned')) return;
    selectedId.value = null;
}

function handleNodeAction({ type, node, member, payload }) {
    switch (type) {
        case 'select-team':
            selectTeam(node);
            break;
        case 'select-member':
            selectedId.value = member.id;
            selectedTeamId.value = node.id;
            panelOpen.value = true;
            panelRef.value?.focusMembers?.();
            break;
        case 'toggle':
            if (expandedIds.has(node.id)) expandedIds.delete(node.id);
            else expandedIds.add(node.id);
            break;
        case 'add-team':
            openAddTeam(node);
            break;
        case 'add-member':
            selectTeam(node);
            panelOpen.value = true;
            panelRef.value?.focusMembers?.();
            break;
        case 'remove-team':
            confirmRemoveTeam(node);
            break;
        case 'drag-start':
            dragPayload.value = payload;
            break;
        case 'drag-over':
            if (dragPayload.value && dragPayload.value.id !== node.id) dropTargetId.value = node.id;
            break;
        case 'drag-leave':
            if (dropTargetId.value === node.id) dropTargetId.value = null;
            break;
        case 'drop':
            handleDrop(node);
            break;
        case 'drag-end':
            resetDrag();
            break;
        default:
            break;
    }
}

function resetDrag() {
    dragPayload.value = null;
    dropTargetId.value = null;
}

async function handleDrop(targetTeam) {
    const payload = dragPayload.value;
    resetDrag();
    if (!payload || !editable.value || !isTeam(targetTeam)) return;

    if (payload.kind === 'team') {
        if (!moveNode(root.value, payload.id, targetTeam.id)) return;
        expandedIds.add(targetTeam.id);
        scheduleSave();
        toast(`부서를 ${displayName(targetTeam)} 아래로 이동했습니다.`);
        return;
    }

    if (payload.kind === 'member') {
        if (payload.fromTeamId === targetTeam.id) return;
        if (payload.fromTeamId) removeMemberFromTeam(root.value, payload.fromTeamId, payload.id);
        const user = users.value.find((candidate) => candidate.id === payload.id);
        if (!user) return;
        attachNode(root.value, targetTeam.id, createMemberNode(user, targetTeam.id));
        expandedIds.add(targetTeam.id);
        scheduleSave();
        await syncUserDepartments([payload.id]);
        toast(`${user.username || user.email} 님을 ${displayName(targetTeam)} 에 배치했습니다.`);
    }
}

function onCanvasDrop() {
    resetDrag();
}

function onUnassignedDragStart(event, user) {
    if (!editable.value) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', user.id);
    dragPayload.value = { kind: 'member', id: user.id, fromTeamId: null };
}

/* ── 부서 CRUD ──────────────────────────────────────── */

function openAddTeam(parent) {
    addTeamParent.value = parent || root.value;
    newTeamName.value = '';
    addTeamDialog.value = true;
}

function commitAddTeam() {
    // 한글 IME 조합 확정 엔터 등으로 핸들러가 두 번 불려 부서가 중복 생성되던 문제 방지 —
    // 다이얼로그가 이미 닫혔으면(=한 번 처리됐으면) 무시한다.
    if (!addTeamDialog.value) return;

    const name = newTeamName.value.trim();
    const parent = addTeamParent.value || root.value;
    if (!name || addTeamError.value) return;

    addTeamDialog.value = false; // 먼저 닫아 재진입 차단
    const team = createTeam(name, parent.id);
    if (!attachNode(root.value, parent.id, team)) return;
    expandedIds.add(parent.id);
    expandedIds.add(team.id);
    selectTeam(team);
    scheduleSave();
    toast(`'${name}' 부서를 추가했습니다.`);
}

function confirmRemoveTeam(team) {
    if (!team || team.id === ROOT_ID) return;
    removeTeamTarget.value = team;
    removeTeamDialog.value = true;
}

async function commitRemoveTeam() {
    const team = removeTeamTarget.value;
    removeTeamDialog.value = false;
    if (!team) return;
    const affected = collectMembers(team, true).map((member) => member.id);
    const parent = findParent(root.value, team.id);
    removeNodeEverywhere(root.value, team.id);
    selectTeam(parent || root.value);
    scheduleSave();
    const pendingIds = affected.filter((id) => pendingMembers.value.some((member) => member.id === id));
    if (pendingIds.length) {
        const { error } = await window.$supabase.from('pending_org_members').delete().in('id', pendingIds);
        if (error) toast('부서의 사전등록 구성원 정리에 실패했습니다.', 'warning');
        else {
            pendingMembers.value = pendingMembers.value.filter((member) => !pendingIds.includes(member.id));
            mergeUsers();
        }
    }
    await syncUserDepartments(affected.filter((id) => !pendingIds.includes(id)));
    toast(`'${displayName(team)}' 부서를 삭제했습니다.`);
    removeTeamTarget.value = null;
}

function onUpdateTeam({ team, patch }) {
    const target = findNode(root.value, team.id);
    if (!target) return;
    if (patch.name && isDuplicateTeamName(root.value, patch.name, target.id)) {
        toast('이미 같은 이름의 부서가 있습니다.', 'warning');
        return;
    }
    target.data = { ...target.data, ...patch };
    if (patch.name) target.name = patch.name;
    scheduleSave();
}

function onMoveTeam({ team, parentId }) {
    if (!moveNode(root.value, team.id, parentId)) {
        toast('해당 부서로는 이동할 수 없습니다.', 'warning');
        return;
    }
    expandedIds.add(parentId);
    scheduleSave();
    toast('부서를 이동했습니다.');
}

function onSetLeader({ team, memberId }) {
    const target = findNode(root.value, team.id);
    if (!target) return;
    target.data = { ...target.data, leaderId: memberId || undefined };
    scheduleSave();
}

function openPreRegister() {
    preRegister.value = {
        email: '',
        teamId: selectedTeam.value?.id === ROOT_ID ? teamOptions.value[0]?.id || '' : selectedTeam.value.id,
        role: 'viewer'
    };
    preRegisterDialog.value = true;
}

async function commitPreRegister() {
    if (!validPreRegister.value || preRegisterSaving.value) return;
    preRegisterSaving.value = true;
    const email = preRegister.value.email.trim().toLowerCase();
    const team = findNode(root.value, preRegister.value.teamId);
    try {
        if (!team) throw new Error('선택한 부서를 찾을 수 없습니다.');
        if (users.value.some((user) => (user.email || '').trim().toLowerCase() === email)) {
            throw new Error('이미 가입했거나 사전등록된 이메일입니다.');
        }
        const { data, error } = await window.$supabase
            .from('pending_org_members')
            .insert({ tenant_id: window.$tenantName, email, team_id: team.id, role: preRegister.value.role })
            .select('id,email,role,team_id,created_at')
            .single();
        if (error) throw error;
        const pending = { ...data, username: email, pending: true, is_agent: false, department_id: team.id };
        pendingMembers.value.push(pending);
        mergeUsers();
        attachNode(root.value, team.id, createMemberNode(pending, team.id));
        expandedIds.add(team.id);
        const saved = await persist();
        if (!saved) {
            removeMemberFromTeam(root.value, team.id, pending.id);
            pendingMembers.value = pendingMembers.value.filter((member) => member.id !== pending.id);
            mergeUsers();
            await window.$supabase.from('pending_org_members').delete().eq('id', pending.id);
            throw new Error('조직도 저장에 실패해 사전등록을 취소했습니다.');
        }
        preRegisterDialog.value = false;
        toast(`${email} 구성원을 사전등록했습니다.`);
    } catch (error) {
        console.error('[OrganizationChart] 구성원 사전등록 실패:', error);
        toast(error?.message || '구성원 사전등록에 실패했습니다.', 'error');
    } finally {
        preRegisterSaving.value = false;
    }
}

/* ── 구성원 CRUD ────────────────────────────────────── */

async function onAddMembers({ team, userIds }) {
    const target = findNode(root.value, team.id);
    if (!target) return;
    let added = 0;
    for (const userId of userIds) {
        const user = users.value.find((candidate) => candidate.id === userId);
        if (!user) continue;
        if (attachNode(root.value, target.id, createMemberNode(user, target.id))) added += 1;
    }
    if (!added) return;
    expandedIds.add(target.id);
    scheduleSave();
    await syncUserDepartments(userIds);
    toast(`${added}명을 ${displayName(target)} 에 추가했습니다.`);
}

async function onRemoveMember({ team, member }) {
    if (!removeMemberFromTeam(root.value, team.id, member.id)) return;
    if (team.data?.leaderId === member.id) {
        const target = findNode(root.value, team.id);
        if (target) target.data = { ...target.data, leaderId: undefined };
    }
    if (selectedId.value === member.id) selectedId.value = team.id;
    scheduleSave();
    const pending = pendingMembers.value.find((candidate) => candidate.id === member.id);
    if (pending) {
        const { error } = await window.$supabase.from('pending_org_members').delete().eq('id', member.id);
        if (error) {
            toast('사전등록 해제에 실패했습니다.', 'error');
            return;
        }
        pendingMembers.value = pendingMembers.value.filter((candidate) => candidate.id !== member.id);
        mergeUsers();
    } else {
        await syncUserDepartments([member.id]);
    }
    toast(`${displayName(member)} 님을 부서에서 제외했습니다.`);
}

async function onMoveMember({ member, fromTeam, toTeamId }) {
    const targetTeam = findNode(root.value, toTeamId);
    if (!targetTeam) return;
    if (fromTeam) removeMemberFromTeam(root.value, fromTeam.id, member.id);
    const user = users.value.find((candidate) => candidate.id === member.id);
    attachNode(root.value, toTeamId, user ? createMemberNode(user, toTeamId) : { ...member, children: undefined });
    expandedIds.add(toTeamId);
    scheduleSave();
    const pending = pendingMembers.value.find((candidate) => candidate.id === member.id);
    if (pending) {
        const { error } = await window.$supabase.from('pending_org_members').update({ team_id: toTeamId }).eq('id', member.id);
        if (error) toast('사전등록 부서 변경에 실패했습니다.', 'error');
        else pending.team_id = toTeamId;
    } else {
        await syncUserDepartments([member.id]);
    }
    toast(`${displayName(member)} 님을 ${displayName(targetTeam)} 으로 이동했습니다.`);
}

function onSelectMemberFromPanel(member) {
    selectedId.value = member.id;
}

/* ── 권한 ───────────────────────────────────────────── */

async function applyRole(userId, role) {
    if (!canManageRoles.value) return false;
    const user = users.value.find((candidate) => candidate.id === userId);
    if (!user || user.role === 'superAdmin' || userId === currentUserId.value) return false;
    const previousRole = user.role;
    const previousAdmin = user.is_admin;
    user.role = role;
    user.is_admin = role === 'admin';
    try {
        if (user.pending) {
            const { error } = await window.$supabase.from('pending_org_members').update({ role }).eq('id', userId);
            if (error) throw error;
        } else {
            await backend.updateUserInfo({
                type: 'update',
                user: { id: userId, role, is_admin: role === 'admin' }
            });
        }
        // 조직도 노드에 캐시된 role 도 최신으로 유지
        walk(root.value, (node) => {
            if (node.id === userId && node.data) node.data.role = role;
        });
        return true;
    } catch (error) {
        console.error('[OrganizationChart] 권한 변경 실패:', userId, error);
        user.role = previousRole;
        user.is_admin = previousAdmin;
        return false;
    }
}

async function onUpdateRole({ userId, role }) {
    const ok = await applyRole(userId, role);
    if (ok) {
        scheduleSave();
        toast('권한을 변경했습니다.');
    } else {
        toast('권한 변경에 실패했습니다.', 'error');
    }
}

async function onUpdateRoles({ userIds, role }) {
    const results = await Promise.all(userIds.map((userId) => applyRole(userId, role)));
    const succeeded = results.filter(Boolean).length;
    if (succeeded) {
        scheduleSave();
        toast(`${succeeded}명의 권한을 변경했습니다.`);
    }
    if (succeeded < userIds.length) {
        toast(`${userIds.length - succeeded}명은 변경하지 못했습니다.`, 'warning');
    }
}

/* ── 에이전트 ───────────────────────────────────────── */

function openAgentDialog(team) {
    agentTargetTeamId.value = team?.id || selectedTeamId.value;
    agentDialog.value = true;
}

async function onAgentAssigned({ agent, teamId }) {
    agentDialog.value = false;
    await loadUsers();
    const target = findNode(root.value, teamId || agentTargetTeamId.value);
    if (!agent || !agent.id || !target) return;
    attachNode(root.value, target.id, createMemberNode({ ...agent, is_agent: true }, target.id));
    expandedIds.add(target.id);
    scheduleSave();
    toast(`에이전트 '${agent.name}' 를 ${displayName(target)} 에 추가했습니다.`);
}

/** 에이전트 노드 + users 행을 합쳐 상세/편집에 필요한 형태로 만든다 */
function buildAgentData(memberId) {
    const node = findNode(root.value, memberId);
    const user = users.value.find((candidate) => candidate.id === memberId);
    if (!node && !user) return null;
    const nodeData = node?.data || {};
    return {
        ...(user || {}),
        ...nodeData,
        id: memberId,
        name: nodeData.name || user?.username || user?.name || '에이전트',
        img: nodeData.img || nodeData.profile || user?.profile || '/images/chat-icon.png',
        profile: nodeData.profile || nodeData.img || user?.profile || '/images/chat-icon.png',
        type: nodeData.type || user?.agent_type || 'agent',
        isAgent: true
    };
}

function openAgentDetail(member) {
    const data = buildAgentData(member?.id);
    if (!data) return;
    agentDetail.value = data;
}

function openAgentEdit(member, type) {
    const data = buildAgentData(member?.id);
    if (!data) return;
    agentDetail.value = null;
    agentEditNode.value = { id: data.id, name: data.name, data };
    agentEditType.value = type;
    agentEditDialog.value = true;
}

function closeAgentEdit() {
    agentEditDialog.value = false;
    agentEditNode.value = null;
}

async function onAgentDialogSubmit(type, editNode) {
    const data = editNode?.data;
    const id = data?.id || editNode?.id;
    agentEditDialog.value = false;
    if (!id) return;

    if (type === 'delete') {
        try {
            await backend.deleteAgent(id);
        } catch (error) {
            console.error('[OrganizationChart] 에이전트 삭제 실패:', error);
            toast('에이전트 삭제에 실패했습니다.', 'error');
            return;
        }
        removeNodeEverywhere(root.value, id);
        users.value = users.value.filter((user) => user.id !== id);
        eventBus?.emit('agentDeleted', { id });
        scheduleSave();
        toast('에이전트를 삭제했습니다.');
    } else {
        try {
            await backend.putAgent({
                ...data,
                username: data.name || data.username,
                profile: data.img || data.profile,
                agent_type: data.type || data.agent_type,
                is_agent: true
            });
        } catch (error) {
            console.error('[OrganizationChart] 에이전트 수정 실패:', error);
            toast('에이전트 수정에 실패했습니다.', 'error');
            return;
        }
        walk(root.value, (node) => {
            if (node.id === id && node.data) {
                node.data = { ...node.data, ...data };
                node.name = data.name;
            }
        });
        eventBus?.emit('agentUpdated', data);
        await loadUsers();
        scheduleSave();
        toast('에이전트 정보를 수정했습니다.');
    }
    agentEditNode.value = null;
}

/* ── 캔버스 인터랙션 ────────────────────────────────── */

function zoomBy(delta) {
    zoom.value = Math.min(1.6, Math.max(0.4, Math.round((zoom.value + delta) * 100) / 100));
}

function fitToScreen() {
    const canvas = canvasRef.value;
    const stage = canvas?.querySelector('.org-tree');
    if (!canvas || !stage) return;
    const contentWidth = stage.scrollWidth / zoom.value;
    const contentHeight = stage.scrollHeight / zoom.value;
    if (!contentWidth || !contentHeight) return;
    const scale = Math.min((canvas.clientWidth - 48) / contentWidth, (canvas.clientHeight - 48) / contentHeight, 1.4);
    zoom.value = Math.min(1.6, Math.max(0.4, Math.round(scale * 100) / 100));
}

let panOrigin = null;
function startPan(event) {
    if (event.button !== 0) return;
    if (event.target.closest('.org-node') || event.target.closest('.org-unassigned')) return;
    const canvas = canvasRef.value;
    if (!canvas) return;
    panning.value = true;
    panOrigin = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', stopPan);
}
function onPanMove(event) {
    const canvas = canvasRef.value;
    if (!canvas || !panOrigin) return;
    canvas.scrollLeft = panOrigin.left - (event.clientX - panOrigin.x);
    canvas.scrollTop = panOrigin.top - (event.clientY - panOrigin.y);
}
function stopPan() {
    panning.value = false;
    panOrigin = null;
    window.removeEventListener('mousemove', onPanMove);
    window.removeEventListener('mouseup', stopPan);
}

function onWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.08 : 0.08);
}

function onResize() {
    isMobile.value = window.innerWidth <= 768;
    if (isMobile.value) panelOpen.value = false;
}

/* ── EventBus 동기화 ────────────────────────────────── */

async function onUserDeleted(userId) {
    if (removeNodeEverywhere(root.value, userId)) scheduleSave();
    users.value = users.value.filter((user) => user.id !== userId);
}
async function onAgentDeleted(payload) {
    const id = payload?.id || payload;
    if (!id) return;
    if (removeNodeEverywhere(root.value, id)) scheduleSave();
    users.value = users.value.filter((user) => user.id !== id);
}
async function onAgentAdded() {
    await loadUsers();
}

/* ── 라이프사이클 ───────────────────────────────────── */

onMounted(async () => {
    loading.value = true;
    isMobile.value = window.innerWidth <= 768;
    if (isMobile.value) panelOpen.value = false;
    await Promise.all([loadUsers(), loadPendingMembers(), loadChart()]);
    loading.value = false;

    window.addEventListener('resize', onResize);
    eventBus?.on('user-deleted', onUserDeleted);
    eventBus?.on('agentDeleted', onAgentDeleted);
    eventBus?.on('agentAdded', onAgentAdded);
});

onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer);
    stopPan();
    window.removeEventListener('resize', onResize);
    eventBus?.off('user-deleted', onUserDeleted);
    eventBus?.off('agentDeleted', onAgentDeleted);
    eventBus?.off('agentAdded', onAgentAdded);
});
</script>

<style scoped>
/* ── 페이지 카드 박스 ─────────────────────────────────────────────
   레이아웃/타이포는 PAL 공통 디자인 시스템(SKGlobalStyle.scss) 의
   .sk-page-card / .page-header / .page-title / .page-subtitle 을 그대로 사용한다.
   (이 화면은 PAL 모드 전용 라우트이므로 해당 전역 CSS 가 항상 로드된다.)
   여기서는 이 페이지에만 필요한 값만 덮어쓴다. */
.org-page {
    /* sk-page-card 의 height:100% 는 부모(page-wrapper) 높이가 auto 라 계산되지 않는다. */
    height: calc(100vh - 40px) !important;
    min-height: 460px;
    background: var(--cds-surface-2) !important;
}
.page-header {
    flex-wrap: wrap;
    gap: 12px;
}
.page-header-right {
    align-items: center;
    flex-shrink: 0;
}

.org-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    white-space: nowrap;
}

/* 툴바 */
.org-toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--cds-border);
    flex-wrap: wrap;
}
.org-toolbar__search {
    position: relative;
    flex: 1;
    max-width: 320px;
    min-width: 160px;
}
.org-toolbar__hits {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    pointer-events: none;
}
.org-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
}
.org-zoom {
    min-width: 44px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-secondary);
    padding: 2px 4px;
    border-radius: var(--cds-radius--xs);
}
.org-zoom:hover {
    background: var(--cds-bg-neutral);
}

/* 본문 */
.org-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    border-top: 0;
}
.org-body__panel {
    flex: none;
    width: 360px;
    max-width: 46vw;
}

/* 캔버스 */
.org-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.org-canvas {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: 32px 24px 24px;
    cursor: grab;
    background-image: radial-gradient(circle at 1px 1px, var(--cds-border) 1px, transparent 0);
    background-size: 22px 22px;
}
.org-canvas--panning {
    cursor: grabbing;
    user-select: none;
}
.org-canvas__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-footnote);
}
.org-stage {
    flex: 1 0 auto;
    transform-origin: top center;
    transition: transform 0.14s var(--cds-ease-out);
    width: max-content;
    min-width: 100%;
    margin: 0 auto;
}
.org-tree {
    display: flex;
    justify-content: center;
    padding: 0;
    margin: 0;
}

/* 미배치 인원 */
.org-unassigned {
    flex: none;
    background: var(--cds-surface-2);
    border-top: 1px solid var(--cds-border);
    overflow: hidden;
}
.org-unassigned__head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-secondary);
    text-align: left;
}
.org-unassigned__head:hover {
    background: var(--cds-bg-neutral);
}
.org-unassigned__head span {
    flex: 1;
}
.org-unassigned__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 12px 12px;
    max-height: 116px;
    overflow-y: auto;
}
.org-unassigned__chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 3px;
    border: 1px solid var(--cds-border);
    border-radius: 999px;
    background: var(--cds-surface-1);
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-secondary);
    cursor: grab;
}
.org-unassigned__chip:hover {
    border-color: var(--cds-border-strong);
    background: var(--cds-bg-neutral);
}

.org-dialog__hint {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    line-height: 1.6;
}

/* 패널 트랜지션 */
.org-panel-slide-enter-active,
.org-panel-slide-leave-active {
    transition: transform 0.18s var(--cds-ease-out), opacity 0.18s var(--cds-ease-out);
}
.org-panel-slide-enter-from,
.org-panel-slide-leave-to {
    transform: translateX(12px);
    opacity: 0;
}

@media (max-width: 960px) {
    .org-body__panel {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 320px;
        max-width: 92vw;
        z-index: 5;
        box-shadow: var(--cds-shadow-lg);
    }
    .org-body {
        position: relative;
    }
}
@media (max-width: 768px) {
    .org-page {
        height: calc(100vh - 24px) !important;
    }
    .org-toolbar {
        gap: 8px;
        padding: 8px 12px;
    }
    .org-toolbar__search {
        order: 2;
        max-width: none;
        width: 100%;
    }
    .org-toolbar__actions {
        order: 1;
        margin-left: 0;
        width: 100%;
        overflow-x: auto;
    }
    .org-status {
        display: none;
    }
}
</style>
